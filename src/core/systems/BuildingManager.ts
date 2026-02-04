import { BUILDING_MODES, REPAIR_DURATION_SOLS } from "../balance/OperationsBalance";
import { getSkillById } from "../data/skills";
import { type Building, type BuildingDefinition, BuildingId } from "../models/Building";
import type { Colonist } from "../models/Colonist";
import { PowerState } from "../models/Grid";
import { TechnologyId } from "../models/Technology";
import type { GameEvent } from "../models/GameEvent";
import type { ResourceDelta } from "../models/Resources";
import {
  applyRushRecyclingPenalty,
  calculateRecycleTime,
  calculateRecycleValue,
  calculateRepairCost,
  calculateRepurposeCost,
  calculateRepurposeTime,
} from "../utils/buildingCosts";
import { applyMultiplier, combineMultipliers } from "../utils/resourceFlow";
import {
  calculateAverageWorkerEfficiency,
  calculateStaffingEfficiency,
} from "../utils/workerEfficiency";
import type { ColonyManager } from "./ColonyManager";
import type { GridManager } from "./GridManager";
import type { IdeologyManager } from "./IdeologyManager";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";
import type { VictoryManager } from "./VictoryManager";
import type { WorkforceManager } from "./WorkforceManager";

export class BuildingManager {
  private definitions: Map<BuildingId, BuildingDefinition> = new Map();
  private buildings: Map<string, Building> = new Map();
  private nextId: number = 1;
  private constructionSpeedBonus: number = 0;
  private autoHousingBlockedShown: boolean = false;
  private colonyManager: ColonyManager | null = null;
  private technologyTree: TechnologyTree | null = null;
  private workforceManager: WorkforceManager | null = null;
  private ideologyManager: IdeologyManager | null = null;
  private victoryManager: VictoryManager | null = null;
  private gridManager: GridManager | null = null;
  private airQualityEfficiency: number = 1;

  setColonyManager(colony: ColonyManager): void {
    this.colonyManager = colony;
  }

  setTechnologyTree(tech: TechnologyTree): void {
    this.technologyTree = tech;
  }

  setWorkforceManager(workforce: WorkforceManager): void {
    this.workforceManager = workforce;
  }

  setAirQualityEfficiency(multiplier: number): void {
    this.airQualityEfficiency = Math.max(0, Math.min(1, multiplier));
  }

  setIdeologyManager(ideology: IdeologyManager): void {
    this.ideologyManager = ideology;
  }

  setVictoryManager(victory: VictoryManager): void {
    this.victoryManager = victory;
  }

  setGridManager(gridManager: GridManager): void {
    this.gridManager = gridManager;
  }

  constructor(defs: BuildingDefinition[]) {
    defs.forEach((d) => {
      this.definitions.set(d.id, d);
    });
  }

  /** Get building and its definition together, or undefined if either missing */
  private getBuildingWithDef(buildingId: string):
    | {
        building: Building;
        def: BuildingDefinition;
      }
    | undefined {
    const building = this.buildings.get(buildingId);
    if (!building) return undefined;
    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;
    return { building, def };
  }

  /** Sum a numeric property from definitions across all active, non-broken buildings */
  private sumActiveBuildings(getter: (def: BuildingDefinition) => number | undefined): number {
    let total = 0;
    for (const building of this.buildings.values()) {
      if (building.status !== "active" || building.broken) continue;
      const def = this.definitions.get(building.definitionId);
      const value = def ? getter(def) : undefined;
      if (value !== undefined) total += value;
    }
    return total;
  }

  private currentSol: number = 0;

  tick(resources: ResourceManager, currentSol?: number): GameEvent[] {
    if (currentSol !== undefined) {
      this.currentSol = currentSol;
    }
    const events: GameEvent[] = [];
    const buildingsToDelete: string[] = [];

    for (const building of this.buildings.values()) {
      const def = this.definitions.get(building.definitionId);
      if (!def) continue;

      this.processConstruction(building, def, resources, events);
      this.processRepairs(building, def, resources, events);
      this.processRecycling(building, def, resources, events, buildingsToDelete);
    }

    // Delete buildings that were recycled (outside of iteration loop)
    if (buildingsToDelete.length > 0) {
      for (const id of buildingsToDelete) {
        this.buildings.delete(id);
      }
      // Update transit clusters when buildings are removed
      const disconnectionEvents = this.triggerClusterUpdate();
      events.push(...disconnectionEvents);
    }

    return events;
  }

  private processConstruction(
    building: Building,
    def: BuildingDefinition,
    resources: ResourceManager,
    events: GameEvent[],
  ): void {
    if (building.status !== "pending") return;

    const speedMultiplier = 1.0 + this.constructionSpeedBonus;
    building.constructionProgress += speedMultiplier;

    // Use repurpose time if repurposing
    const constructionTime = building.repurposeFromDefId
      ? this.getRepurposeTime(building.definitionId)
      : def.constructionTime;

    if (building.constructionProgress >= constructionTime) {
      building.status = "active";
      building.constructionProgress = constructionTime;
      building.repurposeFromDefId = undefined; // Clear repurpose flag

      // Auto-assign workers before applying resource flow (staffing affects efficiency)
      this.autoAssignWorkers(building, def);

      // Add mode-adjusted production/consumption
      this.applyBuildingResourceFlow(building.id, resources, true);

      events.push({
        type: "BUILDING_COMPLETE",
        buildingId: building.id,
        buildingName: def.name,
        severity: "info",
        message: `${def.name} construction complete!`,
      });

      // Check for victory building completion
      if (def.isVictoryBuilding && this.victoryManager) {
        const victoryEvent = this.victoryManager.checkBuildingVictory(building.definitionId);
        if (victoryEvent) {
          events.push(victoryEvent);
        }
      }

      // Update transit clusters when a building becomes active
      const disconnectionEvents = this.triggerClusterUpdate();
      events.push(...disconnectionEvents);
    }
  }

  /**
   * Score a colonist for a building based on skill affinity.
   */
  private scoreColonistForBuilding(colonist: Colonist, def: BuildingDefinition): number {
    let score = 0;
    if (def.workerRole) {
      for (const skillId of colonist.skills) {
        const skill = getSkillById(skillId);
        if (skill?.affinity.includes(def.workerRole)) {
          score += skill.efficiencyBonus;
        }
      }
      // Bonus for matching role
      if (colonist.role === def.workerRole) {
        score += 0.5;
      }
    }
    return score;
  }

  /**
   * Auto-assign available colonists to a newly completed building.
   * Prioritizes colonists with skill affinities matching the building's worker role.
   * Respects transit connectivity - only assigns colonists whose housing is in the same cluster.
   */
  private autoAssignWorkers(building: Building, def: BuildingDefinition): void {
    if (!def.workerSlots || !this.colonyManager) return;

    // Check if building is on the grid and get its cluster
    const isOnGrid = this.gridManager?.getPlacement(building.id) !== undefined;
    const workplaceCluster = this.gridManager?.getBuildingClusterId(building.id);

    // Skip if building is on grid but not connected to a habitat
    if (isOnGrid && !workplaceCluster) return;

    // Get all colonists not already assigned to any building
    const assignedColonistIds = new Set<string>();
    for (const b of this.buildings.values()) {
      for (const colonistId of b.assignedWorkers) {
        assignedColonistIds.add(colonistId);
      }
    }

    const allColonists = this.colonyManager.getColonists();
    const availableColonists = allColonists.filter((c) => {
      if (assignedColonistIds.has(c.id)) return false;

      // Check transit connectivity when building is on grid with a cluster
      if (isOnGrid && workplaceCluster && c.housingId) {
        const housingCluster = this.gridManager?.getBuildingClusterId(c.housingId);
        // Colonist's housing must be in the same cluster as workplace
        if (!housingCluster || housingCluster !== workplaceCluster) return false;
      }

      return true;
    });

    if (availableColonists.length === 0) return;

    // Score colonists by skill affinity to the building's worker role
    const scoredColonists = availableColonists.map((colonist) => ({
      colonist,
      score: this.scoreColonistForBuilding(colonist, def),
    }));

    // Sort by score descending (best matches first)
    scoredColonists.sort((a, b) => b.score - a.score);

    // Assign up to workerSlots colonists
    const toAssign = scoredColonists.slice(0, def.workerSlots);
    for (const { colonist } of toAssign) {
      building.assignedWorkers.push(colonist.id);
    }
  }

  /**
   * Get all active buildings that have fewer workers than their worker slots.
   * Sorted by priority: food buildings first, then by most empty slots.
   */
  getUnderstaffedBuildings(): Building[] {
    const result: Building[] = [];
    for (const building of this.buildings.values()) {
      if (building.status !== "active") continue;
      const def = this.definitions.get(building.definitionId);
      if (!def?.workerSlots) continue;
      if (building.assignedWorkers.length < def.workerSlots) {
        result.push(building);
      }
    }
    // Sort: food buildings first, then by most slots needed
    return result.sort((a, b) => {
      const defA = this.definitions.get(a.definitionId);
      const defB = this.definitions.get(b.definitionId);
      if (!defA || !defB) return 0;
      const isFoodA = defA.production?.food ? 1 : 0;
      const isFoodB = defB.production?.food ? 1 : 0;
      if (isFoodA !== isFoodB) return isFoodB - isFoodA;
      const emptyA = (defA.workerSlots ?? 0) - a.assignedWorkers.length;
      const emptyB = (defB.workerSlots ?? 0) - b.assignedWorkers.length;
      return emptyB - emptyA;
    });
  }

  /**
   * Auto-assign all unassigned colonists to understaffed buildings.
   * Prioritizes food buildings, then buildings with more empty slots.
   * Never steals workers from other buildings.
   */
  autoAssignAllWorkers(colonyManager: ColonyManager): GameEvent[] {
    const events: GameEvent[] = [];
    const understaffed = this.getUnderstaffedBuildings();
    if (understaffed.length === 0) return events;

    // Get unassigned colonists
    const assignedIds = new Set<string>();
    for (const b of this.buildings.values()) {
      for (const id of b.assignedWorkers) assignedIds.add(id);
    }
    const unassigned = colonyManager.getColonists().filter((c) => !assignedIds.has(c.id));
    if (unassigned.length === 0) return events;

    for (const building of understaffed) {
      const def = this.definitions.get(building.definitionId);
      if (!def) continue;

      // Check if building is on the grid and get its cluster
      const isOnGrid = this.gridManager?.getPlacement(building.id) !== undefined;
      const workplaceCluster = this.gridManager?.getBuildingClusterId(building.id);

      // Skip buildings that are on the grid but not connected to a habitat
      if (isOnGrid && !workplaceCluster) continue;

      const slotsNeeded = (def.workerSlots ?? 0) - building.assignedWorkers.length;

      // Score and sort available colonists, filtering by transit connectivity
      const scored = unassigned
        .filter((c) => {
          if (assignedIds.has(c.id)) return false;

          // Check transit connectivity when building is on grid with a cluster
          if (isOnGrid && workplaceCluster && c.housingId) {
            const housingCluster = this.gridManager?.getBuildingClusterId(c.housingId);
            // Colonist's housing must be in the same cluster as workplace
            if (!housingCluster || housingCluster !== workplaceCluster) return false;
          }

          return true;
        })
        .map((c) => ({
          colonist: c,
          score: this.scoreColonistForBuilding(c, def),
        }))
        .sort((a, b) => b.score - a.score);

      const toAssign = scored.slice(0, slotsNeeded);
      for (const { colonist } of toAssign) {
        building.assignedWorkers.push(colonist.id);
        assignedIds.add(colonist.id);
        events.push({
          type: "WORKER_AUTO_ASSIGNED",
          message: `${colonist.name} assigned to ${def.name}`,
          severity: "info",
        });
      }
    }
    return events;
  }

  private processRepairs(
    building: Building,
    def: BuildingDefinition,
    resources: ResourceManager,
    events: GameEvent[],
  ): void {
    if (!building.broken || building.repairProgress <= 0) return;

    building.repairProgress += 1;
    if (building.repairProgress >= REPAIR_DURATION_SOLS) {
      building.broken = false;
      building.repairProgress = 0;

      // Re-add production/consumption after repair
      this.applyBuildingResourceFlow(building.id, resources, true);

      events.push({
        type: "BUILDING_REPAIRED",
        buildingId: building.id,
        buildingName: def.name,
        severity: "info",
        message: `${def.name} repaired!`,
      });
    }
  }

  private processRecycling(
    building: Building,
    def: BuildingDefinition,
    resources: ResourceManager,
    events: GameEvent[],
    buildingsToDelete: string[],
  ): void {
    if (building.status !== "recycling") return;

    building.recyclingProgress = (building.recyclingProgress || 0) + 1;
    const recycleTime = this.getRecycleTime(building.id);

    if (building.recyclingProgress >= recycleTime) {
      const recycleValue = this.getRecycleValue(building.id);
      if (recycleValue) {
        resources.add(recycleValue);
      }

      events.push({
        type: "BUILDING_RECYCLED",
        buildingId: building.id,
        buildingName: def.name,
        severity: "info",
        message: `${def.name} recycled for materials.`,
      });

      buildingsToDelete.push(building.id);
    }
  }

  canBuild(defId: BuildingId, resources: ResourceManager, technology: TechnologyTree): boolean {
    const def = this.definitions.get(defId);
    if (!def) return false;

    if (def.requiredTech && !technology.isResearched(def.requiredTech)) {
      return false;
    }

    // Check project requirements for victory buildings
    if (def.requiredProject) {
      if (!this.ideologyManager || !this.ideologyManager.isProjectCompleted(def.requiredProject)) {
        return false;
      }
    }

    return resources.canAfford(def.cost);
  }

  startBuilding(
    defId: BuildingId,
    resources: ResourceManager,
    technology: TechnologyTree,
  ): Building | null {
    if (!this.canBuild(defId, resources, technology)) return null;

    const def = this.definitions.get(defId);
    if (!def) return null;
    resources.deduct(def.cost);

    const building: Building = {
      id: `building_${this.nextId++}`,
      definitionId: defId,
      status: "pending",
      constructionProgress: 0,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    };

    this.buildings.set(building.id, building);
    return building;
  }

  /**
   * Add a pre-built building directly (used for starting conditions).
   * Does not deduct costs or go through construction.
   */
  addBuilding(buildingWithoutId: Omit<Building, "id">): Building {
    const building: Building = {
      ...buildingWithoutId,
      id: `building_${this.nextId++}`,
    };
    this.buildings.set(building.id, building);
    return building;
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  /** Remove a building directly (for testing or demolition). Does not refund resources. */
  removeBuilding(buildingId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    this.buildings.delete(buildingId);
    return true;
  }

  setBuildingMode(
    buildingId: string,
    mode: "conservation" | "normal" | "overdrive",
    resources: ResourceManager,
  ): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return false;
    if (building.mode === mode) return true; // No change needed

    // Remove old production/consumption
    this.applyBuildingResourceFlow(buildingId, resources, false);

    // Update mode
    building.mode = mode;

    // Add new production/consumption
    this.applyBuildingResourceFlow(buildingId, resources, true);

    return true;
  }

  breakBuilding(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active") return false;

    // Remove production/consumption before breaking
    this.applyBuildingResourceFlow(buildingId, resources, false);

    building.broken = true;
    building.mode = "normal";
    return true;
  }

  getRepairCost(buildingId: string): ResourceDelta | undefined {
    const result = this.getBuildingWithDef(buildingId);
    if (!result || !result.building.broken) return undefined;
    return calculateRepairCost(result.def);
  }

  startRepair(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || !building.broken) return false;

    const cost = this.getRepairCost(buildingId);
    if (!cost || !resources.canAfford(cost)) return false;

    resources.deduct(cost);
    building.repairProgress = 0.01; // Mark as repairing
    return true;
  }

  isRepairing(buildingId: string): boolean {
    const building = this.buildings.get(buildingId);
    return building?.broken === true && building.repairProgress > 0;
  }

  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    const result = this.getBuildingWithDef(buildingId);
    if (!result) return undefined;
    return calculateRecycleValue(result.building, result.def);
  }

  getRecycleTime(buildingId: string): number {
    const result = this.getBuildingWithDef(buildingId);
    return result ? calculateRecycleTime(result.def) : 0;
  }

  startRecycling(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status === "pending" || building.status === "recycling") return false;

    // Remove production/consumption if active
    const wasActive = building.status === "active";
    if (wasActive && !building.broken) {
      this.applyBuildingResourceFlow(buildingId, resources, false);
    }

    building.status = "recycling";
    building.recyclingProgress = 0;

    // Update transit clusters when a building becomes inactive
    if (wasActive) {
      this.triggerClusterUpdate();
    }
    return true;
  }

  rushRecycling(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status !== "active" && building.status !== "idle") return false;

    // Remove production/consumption if active
    if (building.status === "active" && !building.broken) {
      this.applyBuildingResourceFlow(buildingId, resources, false);
    }

    // Immediate completion with penalty
    const recycleValue = this.getRecycleValue(buildingId);
    if (recycleValue) {
      resources.add(applyRushRecyclingPenalty(recycleValue));
    }

    this.buildings.delete(buildingId);
    // Update transit clusters when a building is removed
    this.triggerClusterUpdate();
    return true;
  }

  /**
   * Cancel a building under construction and refund resources.
   * Returns the full cost since construction hasn't completed.
   */
  cancelConstruction(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status !== "pending") return false;

    const def = this.definitions.get(building.definitionId);
    if (def) {
      // Refund full cost - building was never completed
      resources.add(def.cost);
    }

    this.buildings.delete(buildingId);
    return true;
  }

  canRepurpose(
    buildingId: string,
    targetDefId: BuildingId,
    resources: ResourceManager,
    technology: TechnologyTree,
  ): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status !== "active" && building.status !== "idle") return false;
    if (building.broken) return false; // Must repair before repurposing
    if (building.assignedWorkers.length > 0) return false; // Must unassign workers first

    const currentDef = this.definitions.get(building.definitionId);
    if (!currentDef?.repurposeTargets?.includes(targetDefId)) return false;

    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return false;

    // Check tech requirements for target
    if (targetDef.requiredTech && !technology.isResearched(targetDef.requiredTech)) {
      return false;
    }

    // Check cost (30% of target building materials)
    const cost = this.getRepurposeCost(targetDefId);
    return cost ? resources.canAfford(cost) : false;
  }

  getRepurposeCost(targetDefId: BuildingId): ResourceDelta | undefined {
    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return undefined;

    return calculateRepurposeCost(targetDef);
  }

  getRepurposeTime(targetDefId: BuildingId): number {
    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return 0;

    return calculateRepurposeTime(targetDef);
  }

  startRepurposing(
    buildingId: string,
    targetDefId: BuildingId,
    resources: ResourceManager,
    technology: TechnologyTree,
  ): boolean {
    if (!this.canRepurpose(buildingId, targetDefId, resources, technology)) return false;

    const building = this.buildings.get(buildingId);
    if (!building) return false;

    // Remove production/consumption if active
    const wasActive = building.status === "active";
    if (wasActive && !building.broken) {
      this.applyBuildingResourceFlow(buildingId, resources, false);
    }

    // Deduct cost
    const cost = this.getRepurposeCost(targetDefId);
    if (cost) resources.deduct(cost);

    // Update building
    const originalDefId = building.definitionId;
    building.definitionId = targetDefId;
    building.repurposeFromDefId = originalDefId;
    building.status = "pending";
    building.constructionProgress = 0;
    building.mode = "normal";
    building.repairProgress = 0;

    // Clear depositId during repurposing - player must re-link to appropriate deposit
    // (deposit types may not be compatible between building types)
    building.depositId = undefined;

    // Update transit clusters when a building becomes inactive
    if (wasActive) {
      this.triggerClusterUpdate();
    }

    return true;
  }

  getBuildingMode(buildingId: string): "conservation" | "normal" | "overdrive" | undefined {
    return this.buildings.get(buildingId)?.mode;
  }

  /**
   * Calculate the combined efficiency multiplier for a building.
   * Factors: air quality, staffing, worker efficiency, team cohesion.
   */
  private getBuildingEfficiencyMultiplier(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    return combineMultipliers(
      this.airQualityEfficiency,
      this.getStaffingEfficiency(buildingId),
      this.getWorkerEfficiency(buildingId),
      this.getTeamCohesionMultiplier(buildingId),
    );
  }

  /**
   * Calculate the team cohesion multiplier for a building based on worker relationships.
   * Workers who have worked together longer are more efficient as a team.
   */
  private getTeamCohesionMultiplier(buildingId: string): number {
    if (!this.workforceManager) return 1.0;

    const building = this.buildings.get(buildingId);
    if (!building || building.assignedWorkers.length < 2) {
      return 1.0;
    }

    return this.workforceManager.getTeamCohesionMultiplier(building.assignedWorkers);
  }

  getEffectiveProduction(buildingId: string): ResourceDelta {
    const result = this.getBuildingWithDef(buildingId);
    if (!result || result.building.status !== "active" || result.building.broken) return {};
    if (!result.def.production) return {};

    // Gate on power state - unpowered buildings produce nothing
    // Only check if building is placed on grid (has a placement record)
    if (this.gridManager) {
      const placement = this.gridManager.getPlacement(buildingId);
      if (placement && placement.powerState === PowerState.UNPOWERED) {
        return {};
      }
    }

    const modeMultiplier = BUILDING_MODES[result.building.mode].production;
    const efficiencyMultiplier = this.getBuildingEfficiencyMultiplier(buildingId);
    return applyMultiplier(result.def.production, modeMultiplier * efficiencyMultiplier);
  }

  getEffectiveConsumption(buildingId: string): ResourceDelta {
    const result = this.getBuildingWithDef(buildingId);
    if (!result || result.building.status !== "active" || result.building.broken) return {};
    if (!result.def.consumption) return {};

    // Gate on power state - unpowered buildings consume nothing
    // Only check if building is placed on grid (has a placement record)
    if (this.gridManager) {
      const placement = this.gridManager.getPlacement(buildingId);
      if (placement && placement.powerState === PowerState.UNPOWERED) {
        return {};
      }
    }

    const modeMultiplier = BUILDING_MODES[result.building.mode].consumption;
    const efficiencyMultiplier = this.getBuildingEfficiencyMultiplier(buildingId);
    return applyMultiplier(result.def.consumption, modeMultiplier * efficiencyMultiplier);
  }

  /**
   * Helper to add or remove building's production/consumption from resource manager.
   * @param buildingId - The building to process
   * @param resources - Resource manager to update
   * @param add - true to add, false to remove
   */
  private applyBuildingResourceFlow(
    buildingId: string,
    resources: ResourceManager,
    add: boolean,
  ): void {
    const prod = this.getEffectiveProduction(buildingId);
    const cons = this.getEffectiveConsumption(buildingId);

    if (Object.keys(prod).length > 0) {
      if (add) {
        resources.addProduction(prod);
      } else {
        resources.removeProduction(prod);
      }
    }
    if (Object.keys(cons).length > 0) {
      if (add) {
        resources.addConsumption(cons);
      } else {
        resources.removeConsumption(cons);
      }
    }
  }

  getDefinition(defId: BuildingId): BuildingDefinition | undefined {
    return this.definitions.get(defId);
  }

  getAllDefinitions(): BuildingDefinition[] {
    return Array.from(this.definitions.values());
  }

  getBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  getActiveBuildings(): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.status === "active");
  }

  getPendingBuildings(): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.status === "pending");
  }

  /** Get depot ranges for all active depot buildings */
  getDepotRanges(): Map<string, number> {
    const ranges = new Map<string, number>();
    for (const [id, building] of this.buildings) {
      if (building.status !== "active") continue;
      const def = this.definitions.get(building.definitionId);
      if (def?.depotRange) {
        ranges.set(id, def.depotRange);
      }
    }
    return ranges;
  }

  /** Get building definition IDs for all active buildings */
  getBuildingDefinitionsMap(): Map<string, BuildingId> {
    const defs = new Map<string, BuildingId>();
    for (const [id, building] of this.buildings) {
      if (building.status !== "active") continue;
      defs.set(id, building.definitionId);
    }
    return defs;
  }

  /** Trigger cluster recalculation in GridManager and handle disconnected buildings */
  triggerClusterUpdate(): GameEvent[] {
    if (!this.gridManager) return [];
    this.gridManager.updateClusters(this.getBuildingDefinitionsMap(), this.getDepotRanges());
    return this.handleDisconnectedBuildings();
  }

  /**
   * Check all buildings for workers whose housing is no longer in the same cluster.
   * Unassigns workers who can no longer reach their workplace.
   * Returns transit disconnection events for the event log.
   */
  handleDisconnectedBuildings(): GameEvent[] {
    if (!this.gridManager || !this.colonyManager) return [];

    const events: GameEvent[] = [];

    for (const [buildingId, building] of this.buildings) {
      if (building.assignedWorkers.length === 0) continue;

      const workplaceCluster = this.gridManager.getBuildingClusterId(buildingId);
      const def = this.definitions.get(building.definitionId);

      // Check each worker's housing cluster
      const workersToRemove: string[] = [];
      for (const colonistId of building.assignedWorkers) {
        const colonist = this.colonyManager.getColonist(colonistId);
        if (!colonist?.housingId) continue;

        const housingCluster = this.gridManager.getBuildingClusterId(colonist.housingId);
        if (housingCluster !== workplaceCluster) {
          workersToRemove.push(colonistId);
        }
      }

      if (workersToRemove.length > 0) {
        for (const colonistId of workersToRemove) {
          this.removeWorker(buildingId, colonistId);
        }
        events.push({
          type: "TRANSIT_DISCONNECTION",
          buildingId,
          buildingName: def?.name ?? "Unknown Building",
          unassignedWorkers: workersToRemove,
          severity: "warning",
          message: `${workersToRemove.length} worker(s) unassigned from ${def?.name ?? "building"} due to transit disconnection`,
        });
      }
    }

    return events;
  }

  getBuildingsByDefinition(defId: BuildingId): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.definitionId === defId);
  }

  getBuildingCount(): number {
    return this.buildings.size;
  }

  getActiveBuildingCount(): number {
    return this.getActiveBuildings().length;
  }

  getTotalMoraleBoost(): number {
    return this.sumActiveBuildings((def) => def.moraleBoost);
  }

  getTotalAirContribution(): number {
    return this.sumActiveBuildings((def) => def.airContribution);
  }

  /**
   * Get total power production from all active, non-broken buildings.
   * Used by PowerGridManager to calculate grid strain.
   */
  getTotalPowerProduction(): number {
    return this.sumActiveBuildings((def) => def.powerProduction);
  }

  /**
   * Get total power consumption from all active, non-broken buildings.
   * Used by PowerGridManager to calculate grid strain.
   */
  getTotalPowerConsumption(): number {
    return this.sumActiveBuildings((def) => def.powerConsumption);
  }

  setConstructionSpeedBonus(bonus: number): void {
    this.constructionSpeedBonus = bonus;
  }

  getConstructionSpeedBonus(): number {
    return this.constructionSpeedBonus;
  }

  assignWorker(buildingId: string, colonistId: string): boolean {
    const result = this.getBuildingWithDef(buildingId);
    if (!result || result.building.status !== "active") return false;
    const { building, def } = result;

    if (!def.workerSlots || building.assignedWorkers.length >= def.workerSlots) return false;
    if (building.assignedWorkers.includes(colonistId)) return false;

    // Check if colonist is already assigned elsewhere
    for (const b of this.buildings.values()) {
      if (b.assignedWorkers.includes(colonistId)) return false;
    }

    // Validate transit connectivity - colonist's housing must be in same cluster as workplace
    if (this.gridManager && this.colonyManager) {
      const colonist = this.colonyManager.getColonist(colonistId);
      if (colonist?.housingId) {
        const housingCluster = this.gridManager.getBuildingClusterId(colonist.housingId);
        const workplaceCluster = this.gridManager.getBuildingClusterId(buildingId);
        if (housingCluster !== workplaceCluster) {
          return false;
        }
      }
    }

    building.assignedWorkers.push(colonistId);
    return true;
  }

  removeWorker(buildingId: string, colonistId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;

    const index = building.assignedWorkers.indexOf(colonistId);
    if (index === -1) return false;

    building.assignedWorkers.splice(index, 1);
    return true;
  }

  /**
   * Calculate staffing efficiency using diminishing returns curve.
   * Returns 1 for buildings without worker slots.
   * Mining buildings get bonus efficiency with Robotics: 1 worker = 80%, 2+ = 100%.
   */
  getStaffingEfficiency(buildingId: string): number {
    const result = this.getBuildingWithDef(buildingId);
    if (!result) return 0;
    const { building, def } = result;

    if (!def.workerSlots) return 1;
    if (building.assignedWorkers.length === 0) return 0;

    // Check for mining efficiency bonus from Robotics
    const isMiningBuilding = def.requiresDeposit && def.production?.materials;
    const hasRobotics = this.technologyTree?.isResearched(TechnologyId.ROBOTICS) ?? false;

    if (isMiningBuilding && hasRobotics) {
      return building.assignedWorkers.length >= 2 ? 1 : 0.8;
    }

    return calculateStaffingEfficiency(building.assignedWorkers.length, def.workerSlots);
  }

  /**
   * Calculate average worker efficiency for a building.
   * Factors in: mastery, skills, role mismatch penalty, training penalty.
   * Returns 1 if no workers assigned or building has no worker slots.
   */
  getWorkerEfficiency(buildingId: string): number {
    const result = this.getBuildingWithDef(buildingId);
    if (!result) return 0;
    const { building, def } = result;

    if (!def.workerSlots || building.assignedWorkers.length === 0) return 1;
    if (!this.colonyManager) return 1;

    const colonists = building.assignedWorkers
      .map((id) => this.colonyManager?.getColonist(id))
      .filter((c) => c !== undefined);

    return calculateAverageWorkerEfficiency(colonists, def.workerRole);
  }

  /**
   * Check if auto-housing should trigger and start building a habitat if needed.
   * Called during the game tick when Prefab Construction technology is researched.
   *
   * Auto-builds a habitat when:
   * - Prefab Construction tech is researched
   * - Population >= 85% of housing capacity
   * - No habitat already under construction
   * - Can afford 50 materials
   */
  checkAutoHousing(
    resources: ResourceManager,
    technology: TechnologyTree,
    population: number,
    housingCapacity: number,
  ): GameEvent[] {
    const events: GameEvent[] = [];

    // Check if tech is researched
    if (!technology.isResearched(TechnologyId.PREFAB_CONSTRUCTION)) {
      return events;
    }

    // Check if below 85% threshold
    if (housingCapacity === 0 || population < housingCapacity * 0.85) {
      this.autoHousingBlockedShown = false; // Reset warning flag
      return events;
    }

    // Check if habitat already under construction
    if (this.hasHabitatUnderConstruction()) {
      return events;
    }

    // Check if can afford
    const habitatDef = this.definitions.get(BuildingId.HABITAT);
    if (!habitatDef || !resources.canAfford(habitatDef.cost)) {
      if (!this.autoHousingBlockedShown) {
        this.autoHousingBlockedShown = true;
        events.push({
          type: "AUTO_HOUSING_BLOCKED",
          severity: "warning",
          message: "Housing needed but insufficient materials for auto-construction",
        });
      }
      return events;
    }

    // Build the habitat
    resources.deduct(habitatDef.cost);
    const building: Building = {
      id: `building_${this.nextId++}`,
      definitionId: BuildingId.HABITAT,
      status: "pending",
      constructionProgress: 0,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    };
    this.buildings.set(building.id, building);

    this.autoHousingBlockedShown = false; // Reset warning flag on success
    events.push({
      type: "AUTO_HOUSING_STARTED",
      severity: "info",
      message: "Prefab habitat construction started automatically",
      buildingId: building.id,
    });

    return events;
  }

  /**
   * Check if there's already a habitat under construction.
   */
  private hasHabitatUnderConstruction(): boolean {
    for (const building of this.buildings.values()) {
      if (building.definitionId === BuildingId.HABITAT && building.status === "pending") {
        return true;
      }
    }
    return false;
  }

  toJSON() {
    return {
      buildings: Array.from(this.buildings.values()),
      nextId: this.nextId,
      constructionSpeedBonus: this.constructionSpeedBonus,
      autoHousingBlockedShown: this.autoHousingBlockedShown,
    };
  }

  static fromJSON(
    data: {
      buildings: Building[];
      nextId: number;
      constructionSpeedBonus: number;
      autoHousingBlockedShown?: boolean;
    },
    defs: BuildingDefinition[],
  ): BuildingManager {
    const manager = new BuildingManager(defs);
    data.buildings.forEach((b) => {
      // Add defaults for new fields (backward compatibility)
      const building: Building = {
        ...b,
        mode: b.mode ?? "normal",
        broken: b.broken ?? false,
        repairProgress: b.repairProgress ?? 0,
        recyclingProgress: b.recyclingProgress,
        repurposeFromDefId: b.repurposeFromDefId,
      };
      manager.buildings.set(building.id, building);
    });
    manager.nextId = data.nextId;
    manager.constructionSpeedBonus = data.constructionSpeedBonus || 0;
    manager.autoHousingBlockedShown = data.autoHousingBlockedShown ?? false;
    return manager;
  }
}
