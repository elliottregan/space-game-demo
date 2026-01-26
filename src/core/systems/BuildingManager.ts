import {
  CONDITION_DECAY_AMOUNT,
  CONDITION_DECAY_INTERVAL,
  CONDITION_EFFICIENCY_PENALTY,
  CONDITION_EFFICIENCY_THRESHOLD,
  MAINTENANCE_COST_MULTIPLIER,
  MAINTENANCE_START_SOL,
  OXYGEN_DEFICIT_EFFICIENCY_PENALTY,
} from "../balance/BuildingBalance";
import {
  BUILDING_MODES,
  RECYCLING_RECOVERY_RATES,
  RECYCLING_TIME_MULTIPLIER,
  REPAIR_COST_MULTIPLIER,
  REPAIR_DURATION_SOLS,
  REPURPOSE_COST_MULTIPLIER,
  REPURPOSE_TIME_MULTIPLIER,
  RUSH_RECYCLING_PENALTY,
} from "../balance/OperationsBalance";
import { STAFFING_CURVE_EXPONENT } from "../balance/WorkforceBalance";
import type { Building, BuildingDefinition } from "../models/Building";
import type { GameEvent } from "../models/GameEvent";
import type { ResourceDelta } from "../models/Resources";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";

export class BuildingManager {
  private definitions: Map<string, BuildingDefinition> = new Map();
  private buildings: Map<string, Building> = new Map();
  private nextId: number = 1;
  private constructionSpeedBonus: number = 0;

  constructor(defs: BuildingDefinition[]) {
    defs.forEach((d) => {
      this.definitions.set(d.id, d);
    });
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
      this.processMaintenanceDecay(building, def, resources, events);
    }

    // Delete buildings that were recycled (outside of iteration loop)
    for (const id of buildingsToDelete) {
      this.buildings.delete(id);
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

      // Add mode-adjusted production/consumption
      this.applyBuildingResourceFlow(building.id, resources, true);

      events.push({
        type: "BUILDING_COMPLETE",
        buildingId: building.id,
        buildingName: def.name,
        severity: "info",
        message: `${def.name} construction complete!`,
      });
    }
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

  private processMaintenanceDecay(
    building: Building,
    def: BuildingDefinition,
    resources: ResourceManager,
    events: GameEvent[],
  ): void {
    if (building.status !== "active" || building.broken) return;

    building.age += 1;

    // Condition decay starts after MAINTENANCE_START_SOL
    if (this.currentSol < MAINTENANCE_START_SOL) return;

    // Decay condition every CONDITION_DECAY_INTERVAL sols
    if (building.age % CONDITION_DECAY_INTERVAL !== 0 || building.condition <= 0) return;

    const oldCondition = building.condition;
    building.condition = Math.max(0, building.condition - CONDITION_DECAY_AMOUNT);

    // Check if crossing efficiency threshold - need to update production/consumption
    if (
      oldCondition >= CONDITION_EFFICIENCY_THRESHOLD &&
      building.condition < CONDITION_EFFICIENCY_THRESHOLD
    ) {
      // Remove old production/consumption and re-add with penalty
      this.applyBuildingResourceFlow(building.id, resources, false, oldCondition);
      this.applyBuildingResourceFlow(building.id, resources, true);

      events.push({
        type: "BUILDING_DEGRADED",
        buildingId: building.id,
        buildingName: def.name,
        severity: "warning",
        message: `${def.name} condition critical - efficiency reduced!`,
      });
    }
  }

  canBuild(defId: string, resources: ResourceManager, technology: TechnologyTree): boolean {
    const def = this.definitions.get(defId);
    if (!def) return false;

    if (def.requiredTech && !technology.isResearched(def.requiredTech)) {
      return false;
    }

    return resources.canAfford(def.cost);
  }

  startBuilding(
    defId: string,
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
      condition: 100,
      age: 0,
      lastMaintenance: this.currentSol,
    };

    this.buildings.set(building.id, building);
    return building;
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
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
    const building = this.buildings.get(buildingId);
    if (!building || !building.broken) return undefined;

    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;

    const cost: ResourceDelta = {};
    for (const [key, value] of Object.entries(def.cost)) {
      if (value) cost[key as keyof ResourceDelta] = Math.ceil(value * REPAIR_COST_MULTIPLIER);
    }
    return cost;
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

  getMaintenanceCost(buildingId: string): ResourceDelta | undefined {
    const building = this.buildings.get(buildingId);
    if (!building) return undefined;
    if (building.status !== "active" || building.broken) return undefined;

    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;

    const cost: ResourceDelta = {};
    for (const [key, value] of Object.entries(def.cost)) {
      if (value) {
        cost[key as keyof ResourceDelta] = Math.ceil(value * MAINTENANCE_COST_MULTIPLIER);
      }
    }
    return cost;
  }

  canPerformMaintenance(buildingId: string, resources: ResourceManager): boolean {
    const cost = this.getMaintenanceCost(buildingId);
    if (!cost) return false;
    return resources.canAfford(cost);
  }

  performMaintenance(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status !== "active" || building.broken) return false;

    const cost = this.getMaintenanceCost(buildingId);
    if (!cost || !resources.canAfford(cost)) return false;

    // Check if condition was below threshold (production/consumption needs update)
    const wasBelow = building.condition < CONDITION_EFFICIENCY_THRESHOLD;

    resources.deduct(cost);

    // If we were below threshold, remove old production/consumption first
    if (wasBelow) {
      this.applyBuildingResourceFlow(buildingId, resources, false);
    }

    building.condition = 100;
    building.lastMaintenance = this.currentSol;

    // If we were below threshold, add new production/consumption with full efficiency
    if (wasBelow) {
      this.applyBuildingResourceFlow(buildingId, resources, true);
    }

    return true;
  }

  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    const building = this.buildings.get(buildingId);
    if (!building) return undefined;

    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;

    let rate: number = RECYCLING_RECOVERY_RATES.standard;

    if (building.broken) {
      rate = RECYCLING_RECOVERY_RATES.damaged;
    } else if (building.status === "idle") {
      rate = RECYCLING_RECOVERY_RATES.depleted;
    } else if (building.status === "active" && building.depositId) {
      rate = RECYCLING_RECOVERY_RATES.active;
    }

    const result: ResourceDelta = {};
    for (const [key, value] of Object.entries(def.cost)) {
      if (value) result[key as keyof ResourceDelta] = Math.floor(value * rate);
    }
    return result;
  }

  getRecycleTime(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    const def = this.definitions.get(building.definitionId);
    if (!def) return 0;

    return Math.ceil(def.constructionTime * RECYCLING_TIME_MULTIPLIER);
  }

  startRecycling(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status === "pending" || building.status === "recycling") return false;

    // Remove production/consumption if active
    if (building.status === "active" && !building.broken) {
      this.applyBuildingResourceFlow(buildingId, resources, false);
    }

    building.status = "recycling";
    building.recyclingProgress = 0;
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
      const penalizedValue: ResourceDelta = {};
      for (const [key, value] of Object.entries(recycleValue)) {
        if (value) {
          penalizedValue[key as keyof ResourceDelta] = Math.floor(
            value * (1 - RUSH_RECYCLING_PENALTY),
          );
        }
      }
      resources.add(penalizedValue);
    }

    this.buildings.delete(buildingId);
    return true;
  }

  canRepurpose(
    buildingId: string,
    targetDefId: string,
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

  getRepurposeCost(targetDefId: string): ResourceDelta | undefined {
    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return undefined;

    const cost: ResourceDelta = {};
    for (const [key, value] of Object.entries(targetDef.cost)) {
      if (value) cost[key as keyof ResourceDelta] = Math.ceil(value * REPURPOSE_COST_MULTIPLIER);
    }
    return cost;
  }

  getRepurposeTime(targetDefId: string): number {
    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return 0;
    return Math.ceil(targetDef.constructionTime * REPURPOSE_TIME_MULTIPLIER);
  }

  startRepurposing(
    buildingId: string,
    targetDefId: string,
    resources: ResourceManager,
    technology: TechnologyTree,
  ): boolean {
    if (!this.canRepurpose(buildingId, targetDefId, resources, technology)) return false;

    const building = this.buildings.get(buildingId);
    if (!building) return false;

    // Remove production/consumption if active
    if (building.status === "active" && !building.broken) {
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

    return true;
  }

  getBuildingMode(buildingId: string): "conservation" | "normal" | "overdrive" | undefined {
    return this.buildings.get(buildingId)?.mode;
  }

  private getConditionMultiplier(condition: number): number {
    if (condition < CONDITION_EFFICIENCY_THRESHOLD) {
      return 1 - CONDITION_EFFICIENCY_PENALTY;
    }
    return 1;
  }

  private getOxygenDeficitMultiplier(): number {
    if (this.getTotalOxygenContribution() < 0) {
      return 1 - OXYGEN_DEFICIT_EFFICIENCY_PENALTY;
    }
    return 1;
  }

  getEffectiveProduction(buildingId: string, overrideCondition?: number): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.production) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].production;
    const condition = overrideCondition ?? building.condition;
    const conditionMultiplier = this.getConditionMultiplier(condition);
    const oxygenMultiplier = this.getOxygenDeficitMultiplier();
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.production)) {
      if (value)
        result[key as keyof ResourceDelta] =
          value * modeMultiplier * conditionMultiplier * oxygenMultiplier;
    }

    return result;
  }

  getEffectiveConsumption(buildingId: string, overrideCondition?: number): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.consumption) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].consumption;
    const condition = overrideCondition ?? building.condition;
    const conditionMultiplier = this.getConditionMultiplier(condition);
    const oxygenMultiplier = this.getOxygenDeficitMultiplier();
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.consumption)) {
      if (value)
        result[key as keyof ResourceDelta] =
          value * modeMultiplier * conditionMultiplier * oxygenMultiplier;
    }

    return result;
  }

  /**
   * Helper to add or remove building's production/consumption from resource manager.
   * @param buildingId - The building to process
   * @param resources - Resource manager to update
   * @param add - true to add, false to remove
   * @param overrideCondition - Optional condition override for calculations
   */
  private applyBuildingResourceFlow(
    buildingId: string,
    resources: ResourceManager,
    add: boolean,
    overrideCondition?: number,
  ): void {
    const prod = this.getEffectiveProduction(buildingId, overrideCondition);
    const cons = this.getEffectiveConsumption(buildingId, overrideCondition);

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

  getDefinition(defId: string): BuildingDefinition | undefined {
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

  getBuildingsByDefinition(defId: string): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.definitionId === defId);
  }

  getBuildingCount(): number {
    return this.buildings.size;
  }

  getActiveBuildingCount(): number {
    return this.getActiveBuildings().length;
  }

  getTotalMoraleBoost(): number {
    let total = 0;
    for (const building of this.buildings.values()) {
      if (building.status !== "active" || building.broken) continue;
      const def = this.definitions.get(building.definitionId);
      if (def?.moraleBoost) {
        total += def.moraleBoost;
      }
    }
    return total;
  }

  getTotalOxygenContribution(): number {
    let total = 0;
    for (const building of this.buildings.values()) {
      if (building.status !== "active" || building.broken) continue;
      const def = this.definitions.get(building.definitionId);
      if (def?.oxygenContribution !== undefined) {
        total += def.oxygenContribution;
      }
    }
    return total;
  }

  setConstructionSpeedBonus(bonus: number): void {
    this.constructionSpeedBonus = bonus;
  }

  assignWorker(buildingId: string, colonistId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active") return false;

    const def = this.definitions.get(building.definitionId);
    if (!def || !def.workerSlots || building.assignedWorkers.length >= def.workerSlots)
      return false;

    if (building.assignedWorkers.includes(colonistId)) return false;

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
   * Formula: 1 - (1 - staffingRatio)^STAFFING_CURVE_EXPONENT
   */
  getStaffingEfficiency(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    const def = this.definitions.get(building.definitionId);
    if (!def || !def.workerSlots) return 1; // No worker slots = always full efficiency

    if (building.assignedWorkers.length === 0) return 0;

    const staffingRatio = building.assignedWorkers.length / def.workerSlots;
    return 1 - (1 - staffingRatio) ** STAFFING_CURVE_EXPONENT;
  }

  toJSON() {
    return {
      buildings: Array.from(this.buildings.values()),
      nextId: this.nextId,
      constructionSpeedBonus: this.constructionSpeedBonus,
    };
  }

  static fromJSON(
    data: {
      buildings: Building[];
      nextId: number;
      constructionSpeedBonus: number;
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
        condition: b.condition ?? 100,
        age: b.age ?? 0,
        lastMaintenance: b.lastMaintenance ?? 0,
      };
      manager.buildings.set(building.id, building);
    });
    manager.nextId = data.nextId;
    manager.constructionSpeedBonus = data.constructionSpeedBonus || 0;
    return manager;
  }
}
