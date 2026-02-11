// src/simulation/HeuristicStrategy.ts
// Decision-making logic for Monte Carlo playtest simulation

import { BuildingId } from "../core/models/Building";
import type { EventChoice } from "../core/models/GameEvent";
import type { AxisPosition, NPCFaction } from "../core/models/NPCInfluence";
import { getCapstoneGrants, getDistrictGrantTemplate } from "../core/data/districtGrants";
import type { DistrictGrantId, DistrictGrantTemplate } from "../core/models/DistrictGrant";
import { POLICIES } from "../core/data/policies";
import { rng } from "../core/utils/random";
import type { GameAPI } from "../facade/GameAPI";
import type { FactionSnapshot, IdeologySnapshot } from "../facade/types/ideology";
import type { AvailableGrantSnapshot } from "../facade/types/grants";
import type { ResourceDelta } from "../core/models/Resources";
import type { ActionCategory, BlockedDecision, EventOccurrence, ExecutedAction } from "./types";

/**
 * HeuristicStrategy simulates a "competent player" making reasonable decisions.
 * Called by SimulationRunner each game tick to make decisions before advancing the sol.
 *
 * Priorities (in order):
 * 1. Survival - Ensure food and oxygen are maintained
 * 2. Event Resolution - Handle active events
 * 3. Morale - Build recreation buildings to maintain morale
 * 4. Infrastructure - Research, power, materials
 * 5. Growth - Expand population when stable
 * 6. Ideology Victory - Work toward faction capstone victory
 */
export interface StrategyOptions {
  /** Force commitment to a specific faction baseId (for testing victory paths) */
  targetFaction?: NPCFaction;
}

/**
 * Result of executing a strategy tick.
 */
export interface TickResult {
  category: ActionCategory;
  action: string;
}

export class HeuristicStrategy {
  private blockedDecisions: BlockedDecision[] = [];
  private eventsOccurred: EventOccurrence[] = [];
  private executedActions: ExecutedAction[] = [];

  // Per-tick cache for hasBuilding() - avoids repeated snapshot() and O(n) searches
  private cachedBuildingIds: Set<BuildingId> | null = null;

  // Ideology victory state - stores the dynamic faction id and baseId
  private committedFactionId: string | null = null;
  private committedBaseId: string | null = null;
  // Target capstone -- selected at commitment time and pursued consistently
  private targetCapstoneId: DistrictGrantId | null = null;
  private readonly COMMITMENT_THRESHOLD = 0.4; // 40% council support to commit
  private commitmentMinSol: number; // Set randomly in constructor for variety
  private readonly COMMITMENT_FALLBACK_SOL = 50; // If no faction has threshold by this sol, commit to leader
  private readonly MEGASTRUCTURE_MATERIAL_RESERVE = 400; // Reserve for megastructure once close

  // District growth cap — set once at faction commitment and held steady
  private districtGrowthCapSet = false;

  // Track last grant panel refresh to avoid churning every tick
  private lastGrantRefreshSol = -1;
  private readonly GRANT_REFRESH_COOLDOWN = 10; // Only refresh every 10 sols

  // Strategy options
  private readonly targetFaction: NPCFaction | null;

  constructor(
    private api: GameAPI,
    options?: StrategyOptions,
  ) {
    this.targetFaction = options?.targetFaction ?? null;
    // Commit early to maximize rally time — earlier commitment = more council influence
    this.commitmentMinSol = rng.int(5, 12);
  }

  /**
   * Get all blocked decisions recorded during this game.
   */
  getBlockedDecisions(): BlockedDecision[] {
    return this.blockedDecisions;
  }

  /**
   * Get all events that occurred during this game.
   */
  getEventsOccurred(): EventOccurrence[] {
    return this.eventsOccurred;
  }

  /**
   * Get all actions executed during this game.
   */
  getExecutedActions(): ExecutedAction[] {
    return this.executedActions;
  }

  /**
   * Record an executed action for this sol.
   */
  recordAction(result: TickResult): void {
    this.executedActions.push({
      sol: this.api.game.currentSol(),
      category: result.category,
      action: result.action,
    });
  }

  /**
   * Record a blocked decision attempt.
   */
  private recordBlockedDecision(
    category: BlockedDecision["category"],
    action: string,
    reason: string,
    missingResources?: Record<string, number>,
  ): void {
    const sol = this.api.game.currentSol();
    this.blockedDecisions.push({
      sol,
      category,
      action,
      reason,
      missingResources,
    });
  }

  /**
   * Try to upgrade a building of the specified type.
   * Returns the building ID if upgraded, null otherwise.
   * @param buildingDefId The definition ID of buildings to consider upgrading
   * @param category The category for blocked decision recording
   * @param recordIfBlocked Whether to record blocked decisions
   */
  private tryUpgrade(
    buildingDefId: BuildingId,
    category: BlockedDecision["category"],
    recordIfBlocked = true,
  ): string | null {
    const buildings = this.api.buildings.snapshot();

    // Find active buildings of this type that can be upgraded
    const candidates = buildings.active.filter(
      (b) => b.definitionId === buildingDefId && b.status === "active",
    );

    if (candidates.length === 0) {
      return null;
    }

    // Try to upgrade the first candidate
    for (const building of candidates) {
      const canUpgrade = this.api.buildings.canUpgrade(building.id);
      if (canUpgrade.allowed) {
        const result = this.api.buildings.upgrade(building.id);
        if (result.success) {
          return building.id;
        }
      } else if (recordIfBlocked) {
        this.recordBlockedDecision(
          category,
          `upgrade_${buildingDefId}`,
          canUpgrade.reason ?? "unknown",
        );
        // Only record one blocked decision per type
        return null;
      }
    }

    return null;
  }

  /**
   * Try to build a building in a district.
   * Returns true if built, records blocked decision if not.
   * When committed to a faction, reserves materials for ideology projects.
   */
  private tryBuild(
    buildingId: BuildingId,
    category: BlockedDecision["category"],
    recordIfBlocked = true,
  ): boolean {
    const canBuild = this.api.buildings.canBuild(buildingId);
    if (!canBuild.allowed) {
      if (recordIfBlocked) {
        this.recordBlockedDecision(category, `build_${buildingId}`, canBuild.reason ?? "unknown");
      }
      return false;
    }

    // When committed to a faction, reserve materials for ideology projects.
    // Only reserve for non-survival builds to prevent colony death.
    if (this.committedFactionId && category !== "survival") {
      const def = this.api.buildings.getDefinition(buildingId);
      const buildCost = def?.cost?.materials ?? 0;
      if (buildCost > 0) {
        const currentMaterials = this.api.resources.snapshot().current.materials;
        const reserve = this.getProjectMaterialsReserve();
        if (currentMaterials - buildCost < reserve) {
          return false;
        }
      }
    }

    // Build in the default district (facade defaults to first district)
    const result = this.api.buildings.build(buildingId);
    return result.success;
  }

  /**
   * Calculate materials to reserve for the next identity grant on the victory path.
   * Only reserves for grants that are prerequisites of the target capstone
   * and have not yet been completed.
   */
  private getProjectMaterialsReserve(): number {
    if (!this.committedFactionId || !this.targetCapstoneId) return 0;

    const capstone = getDistrictGrantTemplate(this.targetCapstoneId);
    if (!capstone) return 0;

    const completedGrantIds = this.api.grants.snapshot().active.map((g) => g.templateId);
    const completedGrants = new Set([...this.getCompletedGrantIds(), ...completedGrantIds]);

    const prereqIds = capstone.prerequisites ?? [];

    let minCost = 0;
    for (const prereqId of prereqIds) {
      if (completedGrants.has(prereqId)) continue;

      const template = getDistrictGrantTemplate(prereqId);
      const cost = template?.cost?.materials ?? 0;
      if (cost > 0 && (minCost === 0 || cost < minCost)) {
        minCost = cost;
      }
    }

    return minCost;
  }

  /**
   * Get completed grant IDs from the grant manager snapshot.
   */
  private getCompletedGrantIds(): DistrictGrantId[] {
    // Access completed grants via the axis progress as a proxy,
    // or check active/completed status through the snapshot
    const snapshot = this.api.grants.snapshot();
    // The active grants are currently in progress; completed grants
    // are tracked by the DistrictGrantManager internally.
    // We use the available data to avoid proposing already-active grants.
    return snapshot.active.map((g) => g.templateId);
  }

  /**
   * Check if any building of the given type exists (active or pending).
   * Uses per-tick cache to avoid repeated snapshot() calls and O(n) searches.
   */
  private hasBuilding(buildingId: BuildingId): boolean {
    // Build cache on first access per tick
    if (!this.cachedBuildingIds) {
      const buildings = this.api.buildings.snapshot();
      this.cachedBuildingIds = new Set<BuildingId>();
      for (const b of buildings.active) {
        this.cachedBuildingIds.add(b.definitionId as BuildingId);
      }
      for (const b of buildings.pending) {
        this.cachedBuildingIds.add(b.definitionId as BuildingId);
      }
    }
    return this.cachedBuildingIds.has(buildingId);
  }

  /**
   * Main entry point - called each tick to make decisions.
   * Executes priority handlers in order until one takes action.
   * @returns The action taken this tick, or idle if no action was needed
   */
  executeTick(): TickResult {
    // Invalidate per-tick caches
    this.cachedBuildingIds = null;

    // First, ensure workers are assigned to buildings
    this.handleWorkerAssignment();

    // Manage district growth cap to save materials for the victory path.
    this.manageDistrictGrowthCap();

    // Rally committed faction every few sols (free action, doesn't consume action budget).
    // This nudges colonist ideology toward the faction and boosts aligned conviction,
    // building council majority over time like the old lobbying system.
    if (this.committedBaseId && this.api.ideology.canRally()) {
      this.api.ideology.rallyFaction(this.committedBaseId);
    }

    // Evaluate and assign available grants (free action, doesn't consume action budget)
    this.handleGrantEvaluation();

    // Ensure research is always running (free action — queuing research shouldn't
    // prevent other decisions). Without research, the colony can never reach
    // critical techs like Habitat Fabrication or Robotics.
    this.ensureResearchActive();

    // TOP PRIORITY: If capstone is completed, build megastructure to win!
    if (this.committedFactionId && this.tryBuildMegastructureIfReady()) {
      return { category: "victory", action: "build_megastructure" };
    }

    // Early game bootstrap: ensure at least one farm and oxygen generator exist
    const currentSol = this.api.game.currentSol();
    if (currentSol < 50) {
      const bootstrapResult = this.handleEarlyGameBootstrapWithResult();
      if (bootstrapResult) return bootstrapResult;
    }

    // Execute priority handlers in order
    const survivalResult = this.handleSurvivalWithResult();
    if (survivalResult) return survivalResult;

    const eventResult = this.handleEventResolutionWithResult();
    if (eventResult) return eventResult;

    // Morale: only build morale buildings before earth crisis becomes urgent.
    // After 40% severity, focus actions on ideology victory instead of morale.
    const earthSeverity = this.api.game.earthCrisisSeverity();
    const ideologyUrgent = earthSeverity > 40;

    if (!ideologyUrgent) {
      const moraleResult = this.handleMoraleWithResult();
      if (moraleResult) return moraleResult;
    }

    // Always try ideology first - it's the victory path and falls through quickly
    // when there's nothing actionable (no policy/proposal/building needed).
    // Infrastructure fills in when ideology has no work to do.
    const ideologyResult = this.handleIdeologyVictoryWithResult();
    if (ideologyResult) return ideologyResult;
    const infraResult = this.handleInfrastructureWithResult();
    if (infraResult) return infraResult;

    // Growth is lower priority - don't grow if we're saving for megastructure
    if (!this.shouldReserveMaterials()) {
      const growthResult = this.handleGrowthWithResult();
      if (growthResult) return growthResult;
    }

    return { category: "idle", action: "none" };
  }

  /**
   * Find the capstone grant for the committed faction's current axis position.
   * Returns the capstone and its megastructure building if found.
   */
  private findCommittedCapstone(): {
    capstoneId: DistrictGrantId;
    megastructureId: BuildingId;
  } | null {
    if (!this.targetCapstoneId) return null;

    const capstone = getDistrictGrantTemplate(this.targetCapstoneId);
    if (!capstone) return null;

    const megastructureId = capstone.effect?.unlockBuilding as BuildingId | undefined;
    if (!megastructureId) return null;

    return { capstoneId: capstone.id, megastructureId };
  }

  /**
   * Select the best capstone grant to pursue based on the faction's current position.
   * Picks the capstone whose axis requirements are closest to already being met.
   */
  private selectTargetCapstone(factionPosition: AxisPosition): DistrictGrantId | null {
    const capstones = getCapstoneGrants();
    if (capstones.length === 0) return null;

    let bestCapstone: DistrictGrantTemplate | null = null;
    let bestDistance = Infinity;

    for (const capstone of capstones) {
      // Calculate total path difficulty: capstone + all prerequisites.
      // All distances measured from the COMMITTED faction's position because
      // the faction that champions a grant needs aligned ideology for assignment.
      const allGrants: DistrictGrantTemplate[] = [capstone];
      if (capstone.prerequisites) {
        for (const prereqId of capstone.prerequisites) {
          const prereq = getDistrictGrantTemplate(prereqId);
          if (prereq) allGrants.push(prereq);
        }
      }

      let totalPathDistance = 0;
      for (const grant of allGrants) {
        if (!grant.axisRequirements) continue;
        for (const [axis, req] of Object.entries(grant.axisRequirements)) {
          const value = factionPosition[axis as keyof AxisPosition];
          if (req.min !== undefined && value < req.min) totalPathDistance += req.min - value;
          if (req.max !== undefined && value > req.max) totalPathDistance += value - req.max;
        }
      }

      if (totalPathDistance < bestDistance) {
        bestDistance = totalPathDistance;
        bestCapstone = capstone;
      }
    }

    return bestCapstone?.id ?? null;
  }

  /**
   * Look up a faction snapshot by its dynamic id.
   * Falls back to baseId lookup if the dynamic id has changed (e.g., after faction rebirth).
   * Updates committedFactionId if a rebirth is detected.
   */
  private getFactionById(factionId: string): FactionSnapshot | null {
    const factions = this.api.ideology.getFactions();
    const byId = factions.find((f) => f.id === factionId);
    if (byId) return byId;

    // Faction may have been rebirthed -- look up by baseId
    if (this.committedBaseId) {
      const byBaseId = factions.find((f) => f.baseId === this.committedBaseId);
      if (byBaseId) {
        // Update the stored id to match the new faction instance
        this.committedFactionId = byBaseId.id;
        return byBaseId;
      }
    }

    return null;
  }

  /**
   * Check if capstone is completed and try to build megastructure.
   * This is checked at the TOP of each tick to ensure victory ASAP.
   * @returns true if megastructure building was started
   */
  private tryBuildMegastructureIfReady(): boolean {
    const capstoneInfo = this.findCommittedCapstone();
    if (!capstoneInfo) return false;

    // Check if the capstone grant has been completed
    const canBuild = this.api.buildings.canBuild(capstoneInfo.megastructureId);
    if (!canBuild.allowed) return false;

    return this.tryBuildMegastructure(capstoneInfo.megastructureId);
  }

  /**
   * Check if we should reserve materials for the megastructure.
   * Returns true when we're close to victory (axis progress is high).
   */
  private shouldReserveMaterials(): boolean {
    const capstoneInfo = this.findCommittedCapstone();
    if (!capstoneInfo) return false;

    const capstone = getDistrictGrantTemplate(capstoneInfo.capstoneId);
    if (!capstone) return false;

    // Check how many prerequisites are completed via the grant snapshot
    const grantsSnapshot = this.api.grants.snapshot();
    const activeTemplateIds = new Set(grantsSnapshot.active.map((g) => g.templateId));
    const prereqIds = capstone.prerequisites ?? [];

    // Count prerequisites that are at least in-progress or completed
    const progressCount = prereqIds.filter((id) => activeTemplateIds.has(id)).length;

    // Reserve materials once we're close to victory
    if (progressCount >= 1 || prereqIds.length === 0) {
      const resources = this.api.resources.snapshot();
      return resources.current.materials < this.MEGASTRUCTURE_MATERIAL_RESERVE;
    }

    return false;
  }

  /**
   * Early game bootstrap phase (first 100 sols).
   * Ensures minimum survival infrastructure is built early.
   * Less restrictive than before - only blocks when we have ZERO critical buildings.
   * @returns true if an action was taken
   */
  private handleEarlyGameBootstrap(): boolean {
    return this.handleEarlyGameBootstrapWithResult() !== null;
  }

  /**
   * Early game bootstrap with action result tracking.
   * Districts provide housing automatically, so bootstrap only needs food production.
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleEarlyGameBootstrapWithResult(): TickResult | null {
    const buildings = this.api.buildings.snapshot();

    // Count active and pending survival buildings
    let farmCount = 0;

    for (const b of buildings.active) {
      if (b.definitionId === BuildingId.BASIC_FARM) farmCount++;
    }

    for (const b of buildings.pending) {
      if (b.definitionId === BuildingId.BASIC_FARM) farmCount++;
    }

    // Critical: must have at least 1 farm
    if (farmCount === 0) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    // If we have basic infrastructure, allow normal flow
    // The regular handleSurvival will continue building more as needed
    return null;
  }

  /**
   * Ensure research is always running when a science station exists.
   * This is a free action (doesn't consume the sol's action budget) because
   * queueing research is a passive decision, not active construction.
   * Without continuous research, critical techs like Habitat Fabrication
   * are never reached and the upgrade/advanced building path is blocked.
   */
  private ensureResearchActive(): void {
    if (!this.hasBuilding(BuildingId.SCIENCE_STATION)) return;

    const techSnapshot = this.api.technology.snapshot();
    if (techSnapshot.currentResearch) return; // Already researching
    if (techSnapshot.available.length === 0) return; // Nothing to research

    const affordableTechs = techSnapshot.available
      .filter((tech) => this.api.technology.canResearch(tech.id).allowed)
      .sort((a, b) => a.cost.sols - b.cost.sols);

    if (affordableTechs.length > 0 && affordableTechs[0]) {
      this.api.technology.startResearch(affordableTechs[0].id);
    }
  }

  /**
   * Manage district growth caps to prevent uncontrolled population growth.
   * Sets caps early to prevent refugee-driven expansion from spiraling.
   */
  private manageDistrictGrowthCap(): void {
    const currentSol = this.api.game.currentSol();

    // Set growth caps starting at sol 20 — early enough to catch refugee waves
    if (currentSol < 20) return;

    const districts = this.api.districts.snapshot();

    // Cap at 50 — allows population to grow enough for a robust economy
    // while still saving materials for the victory path.
    for (const district of districts.districts) {
      if (district.growthCap === null || district.growthCap > 50) {
        this.api.districts.setGrowthCap(district.id, 50);
      }
    }
  }

  /**
   * Get staffing priority for a building definition.
   * Higher values = staff first. Research buildings get top priority because
   * without research, the colony can never progress toward victory.
   */
  private getStaffingPriority(
    def: { researchOutput?: number; production?: ResourceDelta } | undefined,
  ): number {
    if (!def) return 0;
    if (def.researchOutput && def.researchOutput > 0) return 4; // Research is critical for victory
    if (def.production?.food) return 3; // Food prevents starvation
    if (def.production?.water) return 2; // Water supports farms
    if (def.production?.materials) return 1; // Materials for building
    return 0;
  }

  /**
   * Check if resource buildings of a given type are understaffed.
   * Returns true if more than half of worker slots are unfilled.
   */
  private isResourceUnderstaffed(buildingId: BuildingId): boolean {
    const buildings = this.api.buildings.snapshot();
    const defMap = new Map(buildings.definitions.map((d) => [d.id, d]));
    const def = defMap.get(buildingId);
    if (!def?.workerSlots) return false;

    let totalSlots = 0;
    let filledSlots = 0;
    for (const b of buildings.active) {
      if (b.definitionId === buildingId && b.status === "active") {
        totalSlots += def.workerSlots;
        filledSlots += b.assignedWorkers.length;
      }
    }

    // If no buildings of this type, not understaffed
    if (totalSlots === 0) return false;

    // Understaffed if less than half the slots are filled
    return filledSlots < totalSlots * 0.5;
  }

  /**
   * Check if the colony is globally workforce-constrained.
   * Returns true when most worker-requiring buildings are understaffed.
   * This prevents the AI from spam-building when refugees arrive but
   * workers are spread too thin to actually produce anything.
   */
  private isWorkforceConstrained(): boolean {
    const buildings = this.api.buildings.snapshot();
    const defMap = new Map(buildings.definitions.map((d) => [d.id, d]));

    let totalSlots = 0;
    let filledSlots = 0;
    for (const b of buildings.active) {
      const def = defMap.get(b.definitionId);
      if (!def?.workerSlots || b.status !== "active") continue;
      totalSlots += def.workerSlots;
      filledSlots += b.assignedWorkers.length;
    }

    if (totalSlots === 0) return false;
    return filledSlots < totalSlots * 0.6;
  }

  /**
   * Assign unassigned colonists to buildings with worker slots.
   * Prioritizes: 1) Research 2) Food 3) Water 4) Materials
   * Tries to match colonist roles to building requirements.
   */
  private handleWorkerAssignment(): void {
    const buildings = this.api.buildings.snapshot();
    const colony = this.api.colony.snapshot({ lightweight: true });

    // Build definition lookup map once - O(n) instead of O(n^2) with repeated .find()
    const defMap = new Map(buildings.definitions.map((d) => [d.id, d]));

    // Get buildings that need workers (active, have worker slots, not fully staffed)
    const needsWorkers = buildings.active.filter((b) => {
      const def = defMap.get(b.definitionId);
      if (!def?.workerSlots) return false;
      return b.assignedWorkers.length < def.workerSlots;
    });

    if (needsWorkers.length === 0) return;

    // Sort buildings by staffing priority: research > food > water > materials > other
    needsWorkers.sort((a, b) => {
      const defA = defMap.get(a.definitionId);
      const defB = defMap.get(b.definitionId);
      const priorityA = this.getStaffingPriority(defA);
      const priorityB = this.getStaffingPriority(defB);
      return priorityB - priorityA; // Higher priority first
    });

    // Get unassigned colonists
    const assignedIds = new Set<string>();
    for (const building of buildings.active) {
      for (const id of building.assignedWorkers) {
        assignedIds.add(id);
      }
    }
    const unassigned = colony.colonists.filter((c) => !assignedIds.has(c.id));

    if (unassigned.length === 0) return;

    // Assign colonists to buildings
    for (const building of needsWorkers) {
      const def = defMap.get(building.definitionId);
      if (!def?.workerSlots) continue;

      const slotsNeeded = def.workerSlots - building.assignedWorkers.length;

      // Find best matching colonists (prefer role match)
      const candidates = [...unassigned].sort((a, b) => {
        const aMatch = def.workerRole && a.role === def.workerRole ? 1 : 0;
        const bMatch = def.workerRole && b.role === def.workerRole ? 1 : 0;
        return bMatch - aMatch; // Role matches first
      });

      for (let i = 0; i < slotsNeeded && candidates.length > 0; i++) {
        const colonist = candidates.shift();
        if (!colonist) break;

        const result = this.api.colony.assignToBuilding(colonist.id, building.id);
        if (result.success) {
          // Remove from unassigned list
          const idx = unassigned.findIndex((c) => c.id === colonist.id);
          if (idx !== -1) unassigned.splice(idx, 1);
        }
      }
    }
  }

  /**
   * Priority 1 - Survival: Ensure food, oxygen, and water are maintained.
   * @returns true if an action was taken
   */
  private handleSurvival(): boolean {
    return this.handleSurvivalWithResult() !== null;
  }

  /**
   * Priority 1 - Survival with action result tracking.
   * Life support is handled by the colony-wide ledger; districts provide housing.
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleSurvivalWithResult(): TickResult | null {
    const resources = this.api.resources.snapshot();
    const currentFood = resources.current.food;
    const currentWater = resources.current.water;
    const foodProduction = resources.production.food ?? 0;
    const foodConsumption = resources.consumption.food ?? 0;
    const waterProduction = resources.production.water ?? 0;
    const waterConsumption = resources.consumption.water ?? 0;

    const foodFlow = foodProduction - foodConsumption;
    const waterFlow = waterProduction - waterConsumption;

    // Global workforce check: don't build more resource buildings when existing
    // ones are understaffed. Exception: critical resource shortages.
    // Include negative flow as critical — refugees can spike consumption suddenly.
    const critical = currentFood < 50 || currentWater < 30 || foodFlow < -1 || waterFlow < -1;
    if (!critical && this.isWorkforceConstrained()) return null;

    // Handle water production early - needed for morale recovery
    const waterBuilding = this.handleWaterProduction(
      waterProduction,
      waterConsumption,
      currentWater,
    );
    if (waterBuilding) {
      return { category: "survival", action: `build_${waterBuilding}` };
    }

    // Critical food shortage - prefer greenhouse over basic farm
    if (currentFood < 80 || foodFlow < 0) {
      if (this.tryBuild(BuildingId.GREENHOUSE, "survival", false)) {
        return { category: "survival", action: "build_greenhouse" };
      }
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    // Maintain positive flow with buffer for food
    // Food needs buffer of 2 to handle population growth and events
    // This is proactive, so respect material reserve
    if (foodFlow < 2) {
      if (this.tryBuild(BuildingId.GREENHOUSE, "survival")) {
        return { category: "survival", action: "build_greenhouse" };
      }
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival")) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    return null;
  }

  /**
   * Handle water production by building water extractors or reclaimers.
   * Water Extractor: +4/sol
   * Water Reclaimer: +12/sol, requires WATER_RECYCLING tech
   * @returns the building ID if built, null otherwise
   */
  private handleWaterProduction(
    waterProduction: number,
    waterConsumption: number,
    currentWater: number,
  ): BuildingId | null {
    const waterFlow = waterProduction - waterConsumption;

    // Maintain water buffer of +2 flow to handle population growth and events
    // Also ensure stockpile doesn't drop too low
    const WATER_BUFFER = 2;
    const MIN_WATER_STOCKPILE = 40;

    // Water is fine - no action needed
    if (waterFlow >= WATER_BUFFER && currentWater > MIN_WATER_STOCKPILE) return null;

    // Don't build more water buildings if existing ones are understaffed
    // (exception: critically low stockpile)
    if (currentWater > 20 && this.isResourceUnderstaffed(BuildingId.WATER_EXTRACTOR)) return null;

    // Prefer Water Reclaimer (+12/sol) if tech is available - no deposit needed
    if (this.tryBuild(BuildingId.WATER_RECLAIMER, "survival", false)) {
      return BuildingId.WATER_RECLAIMER;
    }

    // Fall back to Water Extractor (+4/sol)
    if (this.tryBuild(BuildingId.WATER_EXTRACTOR, "survival")) {
      return BuildingId.WATER_EXTRACTOR;
    }

    return null;
  }

  /**
   * Handle materials production - ensure adequate materials flow.
   * Target at least 10 materials/sol production to sustain mid-game expansion.
   * Progression: Basic Mine (4/sol) -> 3D Fabricator (7/sol) -> Automated Factory (15/sol)
   * @returns the building ID that was started, or null if nothing was built
   */
  private handleMaterialsProduction(): BuildingId | null {
    const resources = this.api.resources.snapshot();
    const materialsProd = resources.production.materials ?? 0;

    // Target minimum production rate for sustainable expansion
    const TARGET_MATERIALS_PRODUCTION = 10;

    // If we have enough production, don't build more
    if (materialsProd >= TARGET_MATERIALS_PRODUCTION) return null;

    // Don't build more mines if existing ones are understaffed
    if (this.isResourceUnderstaffed(BuildingId.BASIC_MINE)) return null;

    // Try advanced buildings first (better ROI if tech is available)
    // Automated Factory: 15/sol, no workers needed, requires ROBOTICS
    if (this.tryBuild(BuildingId.AUTOMATED_FACTORY, "infrastructure", false)) {
      return BuildingId.AUTOMATED_FACTORY;
    }

    // 3D Fabricator: 7/sol, requires HABITAT_FABRICATION
    if (this.tryBuild(BuildingId.FABRICATOR_3D, "infrastructure", false)) {
      return BuildingId.FABRICATOR_3D;
    }

    // Basic Mine: 4/sol
    // Build multiple mines to reach target production
    if (this.tryBuild(BuildingId.BASIC_MINE, "infrastructure")) {
      return BuildingId.BASIC_MINE;
    }

    return null;
  }

  /**
   * Priority 2 - Event Resolution: Handle active events.
   * @returns true if an event was resolved
   */
  private handleEventResolution(): boolean {
    return this.handleEventResolutionWithResult() !== null;
  }

  /**
   * Priority 2 - Event Resolution with action result tracking.
   * @returns TickResult if an event was resolved, null otherwise
   */
  private handleEventResolutionWithResult(): TickResult | null {
    if (!this.api.events.hasActive()) {
      return null;
    }

    const activeEvent = this.api.events.getActive();
    if (!activeEvent) {
      return null;
    }

    const choices = activeEvent.choices;
    if (choices.length === 0) {
      return null;
    }

    // Pick the best choice:
    // 1. Gives most resources, OR
    // 2. Avoids population loss, OR
    // 3. First choice (fallback)
    const chosenChoice = this.selectBestEventChoice(choices);
    this.api.events.resolve(chosenChoice.id);

    // Record the event occurrence
    const effects: EventOccurrence["effects"] = {};
    if (chosenChoice.effects.resources) {
      effects.resources = { ...chosenChoice.effects.resources };
    }
    if (chosenChoice.effects.population !== undefined) {
      effects.population = chosenChoice.effects.population;
    }
    if (chosenChoice.effects.support) {
      effects.support = { ...chosenChoice.effects.support };
    }

    this.eventsOccurred.push({
      sol: this.api.game.currentSol(),
      eventId: activeEvent.definition.id,
      eventName: activeEvent.definition.name,
      choiceId: chosenChoice.id,
      choiceText: chosenChoice.text,
      effects,
    });

    return { category: "event", action: `resolve_${activeEvent.definition.id}` };
  }

  /**
   * Select the best event choice based on heuristics.
   * Scores each choice once (O(n)) instead of re-scoring on each comparison (O(n^2)).
   */
  private selectBestEventChoice(choices: readonly Readonly<EventChoice>[]): Readonly<EventChoice> {
    // Score each choice once upfront
    // Safety: caller guarantees choices.length > 0, but we satisfy the linter
    const firstChoice = choices[0];
    if (!firstChoice) {
      throw new Error("selectBestEventChoice called with empty choices array");
    }
    let bestChoice = firstChoice;
    let bestScore = this.scoreEventChoice(bestChoice);

    for (let i = 1; i < choices.length; i++) {
      const choice = choices[i];
      if (!choice) continue;
      const score = this.scoreEventChoice(choice);
      if (score > bestScore) {
        bestChoice = choice;
        bestScore = score;
      }
    }

    return bestChoice;
  }

  /**
   * Score an event choice. Higher is better.
   * - Positive for resource gains
   * - Large negative for population loss
   */
  private scoreEventChoice(choice: Readonly<EventChoice>): number {
    let score = 0;

    // Population effects
    if (choice.effects.population !== undefined) {
      if (choice.effects.population < 0) {
        // Avoid population loss - heavily penalize
        score -= 1000 * Math.abs(choice.effects.population);
      } else {
        // Population gain is always positive — districts auto-grow housing
        score += 100 * choice.effects.population;
      }
    }

    // Resource effects - sum up net stockpiled resources
    if (choice.effects.resources) {
      const resources = choice.effects.resources;
      score += resources.food ?? 0;
      score += resources.water ?? 0;
      score += resources.materials ?? 0;
    }

    // Support effects are neutral for this heuristic (political)
    // Could be weighted if needed for faction strategies

    return score;
  }

  /**
   * Priority 3 - Morale: Build recreation buildings to maintain colony morale.
   * High morale prevents colonist deaths and keeps productivity up.
   * @returns true if an action was taken
   */
  private handleMorale(): boolean {
    return this.handleMoraleWithResult() !== null;
  }

  /**
   * Priority 3 - Morale with action result tracking.
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleMoraleWithResult(): TickResult | null {
    const colony = this.api.colony.snapshot({ lightweight: true });
    const buildings = this.api.buildings.snapshot();

    // Target morale threshold for healthy colony
    const MORALE_TARGET = 70;

    // Don't build recreation if morale is healthy
    if (colony.morale >= MORALE_TARGET) return null;

    // Calculate current morale boost from buildings
    const currentMoraleBoost = buildings.moraleBoost;

    // Each point of moraleBoost adds 0.1 to recovery rate
    // Base recovery is 0.5, decay is 0.3, so net is +0.2 without buildings
    // With moraleBoost of 10, recovery becomes 0.5 + 1.0 = 1.5, net +1.2
    // We want enough boost to recover morale reliably

    // If we already have decent morale boost (15+), don't over-build
    if (currentMoraleBoost >= 15 && colony.morale > 50) return null;

    // Build recreation buildings in order of cost-effectiveness
    // COMMON_ROOM: 60 materials, +5 boost (0.083 boost per material)
    // GYMNASIUM: 80 materials, +6 boost (0.075 boost per material)
    // OBSERVATORY_DOME: 150 materials, +8 boost (0.053 boost per material, needs tech)

    // Start with common room - cheapest and good boost
    if (!this.hasBuilding(BuildingId.COMMON_ROOM)) {
      if (this.tryBuild(BuildingId.COMMON_ROOM, "morale")) {
        return { category: "morale", action: "build_common_room" };
      }
    }

    // Then gymnasium for additional boost
    if (!this.hasBuilding(BuildingId.GYMNASIUM)) {
      if (this.tryBuild(BuildingId.GYMNASIUM, "morale")) {
        return { category: "morale", action: "build_gymnasium" };
      }
    }

    // Observatory dome if we have tech and need more boost
    if (currentMoraleBoost < 15) {
      if (this.tryBuild(BuildingId.OBSERVATORY_DOME, "morale", false)) {
        return { category: "morale", action: "build_observatory_dome" };
      }
    }

    return null;
  }

  /**
   * Priority 4 - Infrastructure: Research, power, materials.
   * @returns true if an action was taken
   */
  private handleInfrastructure(): boolean {
    return this.handleInfrastructureWithResult() !== null;
  }

  /**
   * Priority 4 - Infrastructure with action result tracking.
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleInfrastructureWithResult(): TickResult | null {
    const techSnapshot = this.api.technology.snapshot();
    const resources = this.api.resources.snapshot();

    // Build Science Station for research capability (needed for any research to progress)
    if (!this.hasBuilding(BuildingId.SCIENCE_STATION)) {
      if (this.tryBuild(BuildingId.SCIENCE_STATION, "infrastructure")) {
        return { category: "infrastructure", action: "build_science_station" };
      }
    }

    // Upgrade Science Station -> Research Lab for 3x research output (requires HABITAT_FABRICATION)
    if (
      this.hasBuilding(BuildingId.SCIENCE_STATION) &&
      !this.hasBuilding(BuildingId.RESEARCH_LAB)
    ) {
      const upgradedId = this.tryUpgrade(BuildingId.SCIENCE_STATION, "infrastructure");
      if (upgradedId) {
        return { category: "infrastructure", action: "upgrade_science_station" };
      }
    }

    // Research is now handled as a free action in ensureResearchActive().
    // Record blocked research for bottleneck analysis only.
    if (!techSnapshot.currentResearch && techSnapshot.available.length > 0) {
      const affordableTechs = techSnapshot.available.filter(
        (tech) => this.api.technology.canResearch(tech.id).allowed,
      );
      if (affordableTechs.length === 0) {
        const firstTech = techSnapshot.available[0];
        if (firstTech) {
          const canResearch = this.api.technology.canResearch(firstTech.id);
          this.recordBlockedDecision(
            "infrastructure",
            `research_${firstTech.id}`,
            canResearch.reason ?? "unknown",
          );
        }
      }
    }

    // Build solar panel if power balance is negative
    const districtPower = this.api.districts.snapshot().power;
    if (districtPower.balance < 0) {
      if (this.tryBuild(BuildingId.SOLAR_PANEL, "infrastructure")) {
        return { category: "infrastructure", action: "build_solar_panel" };
      }
    }

    // Establish materials production - build mines, fabricators, or factories
    const materialsBuilding = this.handleMaterialsProduction();
    if (materialsBuilding) {
      return { category: "infrastructure", action: `build_${materialsBuilding}` };
    }

    // Build speculative solar panels for power headroom
    const productionRatio =
      districtPower.consumption > 0
        ? districtPower.production / districtPower.consumption
        : districtPower.production > 0
          ? 1.0
          : 0;
    if (productionRatio < 1.05) {
      if (this.tryBuild(BuildingId.SOLAR_PANEL, "infrastructure")) {
        return { category: "infrastructure", action: "build_solar_panel" };
      }
    }

    // Build mining station for more materials (requires asteroid_mining tech)
    if (resources.current.materials < 100) {
      if (this.tryBuild(BuildingId.MINING_STATION, "infrastructure")) {
        return { category: "infrastructure", action: "build_mining_station" };
      }
    }

    return null;
  }

  /**
   * Priority 5 - Growth: Expand population when stable.
   * @returns true if an action was taken
   */
  private handleGrowth(): boolean {
    return this.handleGrowthWithResult() !== null;
  }

  /**
   * Priority 5 - Growth with action result tracking.
   * Districts auto-grow housing, so growth handler focuses on food production
   * to sustain larger populations.
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleGrowthWithResult(): TickResult | null {
    const colony = this.api.colony.snapshot({ lightweight: true });
    const resources = this.api.resources.snapshot();

    // Only grow if population < 80 and morale > 60
    if (colony.population >= 80 || colony.morale <= 60) return null;

    // Don't grow if water is tight - each new colonist needs food, and farms consume water
    const waterSurplus = (resources.production.water ?? 0) - (resources.consumption.water ?? 0);
    if (waterSurplus < 2) return null;

    // Calculate resource surpluses
    const foodSurplus = (resources.production.food ?? 0) - (resources.consumption.food ?? 0);

    // Need at least 4 food surplus to support population growth
    if (foodSurplus < 4) {
      if (this.tryBuild(BuildingId.GREENHOUSE, "growth", false)) {
        return { category: "growth", action: "build_greenhouse" };
      }
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) {
        return { category: "growth", action: "build_basic_farm" };
      }
    }

    // Also check food stockpile - don't grow if food is low
    if (resources.current.food < 80) {
      if (this.tryBuild(BuildingId.GREENHOUSE, "growth", false)) {
        return { category: "growth", action: "build_greenhouse" };
      }
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) {
        return { category: "growth", action: "build_basic_farm" };
      }
    }

    return null;
  }

  /**
   * Ideology Victory: Work toward faction megastructure victory.
   *
   * Strategy:
   * 1. Commit to a faction early (sol 15-30 or when one has 40%+)
   * 2. Declare policies to push axes toward the committed faction's capstone requirements
   * 3. Propose prerequisite projects (accept failed votes, retry when favorable)
   * 4. Propose capstone when prerequisites complete and >=65% council support
   * 5. Build megastructure to win!
   *
   * @returns true if an action was taken
   */
  private handleIdeologyVictory(): boolean {
    return this.handleIdeologyVictoryWithResult() !== null;
  }

  /**
   * Ideology Victory with action result tracking.
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleIdeologyVictoryWithResult(): TickResult | null {
    const ideologySnapshot = this.api.ideology.snapshot();
    const council = ideologySnapshot.council;

    if (council.length === 0) return null; // No council yet

    // Step 1: Check/update faction commitment
    if (!this.committedFactionId) {
      const commitment = this.checkFactionCommitment(ideologySnapshot);
      if (!commitment) {
        // Not yet committed - focus on survival and infrastructure instead
        return null;
      }
      this.committedFactionId = commitment.id;
      this.committedBaseId = commitment.baseId;

      // Select a target capstone based on the faction's current position
      const faction = this.getFactionById(commitment.id);
      if (faction) {
        this.targetCapstoneId = this.selectTargetCapstone(faction.position);
      }
    }

    // Step 1b: If committed faction collapsed and wasn't rebirthed, re-commit immediately
    if (!this.getFactionById(this.committedFactionId)) {
      this.committedFactionId = null;
      this.committedBaseId = null;
      this.targetCapstoneId = null;

      // Try to commit to a new faction right away
      const commitment = this.checkFactionCommitment(ideologySnapshot);
      if (!commitment) return null;
      this.committedFactionId = commitment.id;
      this.committedBaseId = commitment.baseId;
      const faction = this.getFactionById(commitment.id);
      if (faction) {
        this.targetCapstoneId = this.selectTargetCapstone(faction.position);
      }
    }

    // Step 2: Try to advance toward victory
    return this.advanceFactionVictoryWithResult(this.committedFactionId);
  }

  /**
   * Check if any faction has reached the commitment threshold.
   * Returns the faction id and baseId to commit to, or null if still opportunistic.
   * If targetFaction is set, commits immediately to the matching faction.
   * Otherwise waits until COMMITMENT_MIN_SOL, then commits if a faction has threshold+.
   * If no faction has threshold+ by COMMITMENT_FALLBACK_SOL, commits to the leading faction.
   */
  private checkFactionCommitment(
    snapshot: IdeologySnapshot,
  ): { id: string; baseId: string } | null {
    const factions = snapshot.factions;

    // If a target faction is specified, find the matching faction by baseId
    if (this.targetFaction) {
      const matchingFaction = factions.find((f) => f.baseId === this.targetFaction);
      if (!matchingFaction) return null;
      return { id: matchingFaction.id, baseId: matchingFaction.baseId };
    }

    const currentSol = this.api.game.currentSol();

    // Wait for council to stabilize before committing opportunistically
    if (currentSol < this.commitmentMinSol) {
      return null;
    }

    const council = snapshot.council;
    if (council.length === 0) return null;

    const counts = snapshot.councilFactionCounts;
    const totalSeats = council.length;

    // Score each faction by a combination of council representation AND
    // how close their capstone is to being achievable (distance 0 = already met)
    type ScoredFaction = {
      faction: FactionSnapshot;
      seats: number;
      ratio: number;
      capstoneDistance: number;
    };
    const scoredFactions: ScoredFaction[] = [];

    for (const faction of factions) {
      const seats = counts[faction.baseId] ?? 0;
      const ratio = seats / totalSeats;
      const capstoneId = this.selectTargetCapstone(faction.position);

      // Calculate full path distance (capstone + prerequisites) for this faction
      let capstoneDistance = Infinity;
      if (capstoneId) {
        const capstone = getDistrictGrantTemplate(capstoneId);
        if (capstone) {
          capstoneDistance = 0;
          const allGrants: DistrictGrantTemplate[] = [capstone];
          if (capstone.prerequisites) {
            for (const prereqId of capstone.prerequisites) {
              const prereq = getDistrictGrantTemplate(prereqId);
              if (prereq) allGrants.push(prereq);
            }
          }
          for (const grant of allGrants) {
            if (!grant.axisRequirements) continue;
            for (const [axis, req] of Object.entries(grant.axisRequirements)) {
              const value = faction.position[axis as keyof AxisPosition];
              if (req.min !== undefined && value < req.min) capstoneDistance += req.min - value;
              if (req.max !== undefined && value > req.max) capstoneDistance += value - req.max;
            }
          }
        }
      }

      scoredFactions.push({ faction, seats, ratio, capstoneDistance });
    }

    // Commit to the faction with the easiest victory path (lowest total path distance).
    // Rally will build council majority for whichever faction we choose, so
    // current council seats are less important than path feasibility.
    // Use a small weight for seats to break ties.
    scoredFactions.sort((a, b) => {
      // Primary sort: path distance (lower is better)
      const distDiff = a.capstoneDistance - b.capstoneDistance;
      if (Math.abs(distDiff) > 0.1) return distDiff;
      // Tiebreak: prefer more council seats
      return b.seats - a.seats;
    });

    const best = scoredFactions[0];
    if (best && best.capstoneDistance < Infinity) {
      return { id: best.faction.id, baseId: best.faction.baseId };
    }

    return null;
  }

  /**
   * Get the faction id to push policy toward during opportunistic phase.
   * If targetFaction is set, always returns that faction's id.
   * Otherwise returns the faction with the most council seats.
   */
  private getLeadingFactionId(snapshot: IdeologySnapshot): string | null {
    const factions = snapshot.factions;

    // If targeting a specific faction, find it by baseId
    if (this.targetFaction) {
      const matchingFaction = factions.find((f) => f.baseId === this.targetFaction);
      return matchingFaction?.id ?? null;
    }

    const counts = snapshot.councilFactionCounts;

    let leadingFactionId: string | null = null;
    let maxSeats = 0;

    for (const faction of factions) {
      // councilFactionCounts is keyed by baseId
      const seats = counts[faction.baseId] ?? 0;
      if (seats > maxSeats) {
        maxSeats = seats;
        leadingFactionId = faction.id;
      }
    }

    return leadingFactionId;
  }

  /**
   * Advance faction victory with action result tracking.
   * Uses the fixed target capstone selected at commitment time.
   * In the new district grants system, the AI picks grants from the available
   * panel and assigns them to districts rather than proposing projects to council.
   * @returns TickResult if an action was taken, null otherwise
   */
  private advanceFactionVictoryWithResult(factionId: string): TickResult | null {
    const faction = this.getFactionById(factionId);
    if (!faction) return null;

    if (!this.targetCapstoneId) return null;

    const capstone = getDistrictGrantTemplate(this.targetCapstoneId);
    if (!capstone) return null;

    const megastructureId = capstone.effect?.unlockBuilding as BuildingId | undefined;

    // Step 0: If capstone megastructure is buildable, build it to win!
    if (megastructureId) {
      const canBuild = this.api.buildings.canBuild(megastructureId);
      if (canBuild.allowed) {
        if (this.tryBuildMegastructure(megastructureId)) {
          return { category: "victory", action: `build_${megastructureId}` };
        }
      }
    }

    // Step 1: Always keep a policy active to push axes and strengthen faction position.
    // Policies need 30 sols to take effect, so maintaining one continuously is critical.
    if (this.tryDeclarePolicy(factionId)) {
      return { category: "victory", action: "declare_policy" };
    }

    // Step 2: Build institutional buildings for continuous axis pressure.
    // Build early to start nudging faction axes toward capstone requirements.
    const currentSol = this.api.game.currentSol();
    if (currentSol >= 30) {
      if (!this.hasBuilding(BuildingId.BROADCASTING_STATION)) {
        if (this.tryBuild(BuildingId.BROADCASTING_STATION, "victory")) {
          return { category: "victory", action: "build_broadcasting_station" };
        }
      }
      if (!this.hasBuilding(BuildingId.HERITAGE_MUSEUM)) {
        if (this.tryBuild(BuildingId.HERITAGE_MUSEUM, "victory")) {
          return { category: "victory", action: "build_heritage_museum" };
        }
      }
      if (!this.hasBuilding(BuildingId.ACADEMY)) {
        const techSnapshot = this.api.technology.snapshot();
        const hasAdvancedMaterials = techSnapshot.researched.some(
          (t) => t.id === "advanced_materials",
        );
        if (hasAdvancedMaterials) {
          if (this.tryBuild(BuildingId.ACADEMY, "victory")) {
            return { category: "victory", action: "build_academy" };
          }
        }
      }
    }

    // Step 3: Try to assign a victory-path grant from the available panel.
    // The grant panel shows 3 available grants; we pick one that advances the
    // capstone prerequisites or the capstone itself.
    if (this.tryAssignVictoryGrant(capstone)) {
      return { category: "victory", action: "assign_victory_grant" };
    }

    return null;
  }

  /**
   * Try to build the faction's victory megastructure.
   * Bypasses material reserve since this is the final victory action.
   * @returns true if building was started
   */
  private tryBuildMegastructure(buildingId: BuildingId): boolean {
    // Check if already building or built
    if (this.hasBuilding(buildingId)) {
      return false;
    }

    const canBuild = this.api.buildings.canBuild(buildingId);
    if (!canBuild.allowed) {
      this.recordBlockedDecision("victory", `build_${buildingId}`, canBuild.reason ?? "unknown");
      return false;
    }

    // Build the megastructure - this wins the game!
    this.api.buildings.build(buildingId);
    return true;
  }

  /**
   * Try to assign a grant from the available panel that advances the victory path.
   * Prefers grants that are prerequisites of the target capstone, then the capstone itself.
   * If no victory-path grants are available, refreshes the panel (free action).
   * @returns true if a grant was assigned
   */
  private tryAssignVictoryGrant(capstone: DistrictGrantTemplate): boolean {
    const grantsSnapshot = this.api.grants.snapshot();
    const currentSol = this.api.game.currentSol();

    if (grantsSnapshot.available.length === 0) {
      // Panel is empty, refresh it
      if (currentSol - this.lastGrantRefreshSol >= this.GRANT_REFRESH_COOLDOWN) {
        this.api.grants.refreshPanel();
        this.lastGrantRefreshSol = currentSol;
      }
      return false;
    }

    const prereqIds = new Set(capstone.prerequisites ?? []);
    const districts = this.api.districts.snapshot().districts;
    if (districts.length === 0) return false;

    // Pick the first district as the assignment target
    const districtId = districts[0]!.id;

    // First priority: look for prerequisite grants on the panel
    for (const grant of grantsSnapshot.available) {
      if (prereqIds.has(grant.templateId) || grant.templateId === capstone.id) {
        const check = this.api.grants.canAssignGrant(grant.id, districtId);
        if (check.canAssign) {
          const result = this.api.grants.assignGrant(grant.id, districtId);
          return result.success;
        }
      }
    }

    // Second priority: look for any identity grant that aligns with the victory path
    for (const grant of grantsSnapshot.available) {
      if (grant.category === "identity") {
        const check = this.api.grants.canAssignGrant(grant.id, districtId);
        if (check.canAssign) {
          const result = this.api.grants.assignGrant(grant.id, districtId);
          return result.success;
        }
      }
    }

    // No useful grants found — refresh the panel to get new ones (free action)
    // Only refresh with cooldown to avoid churning and let infrastructure grants be picked up
    if (currentSol - this.lastGrantRefreshSol >= this.GRANT_REFRESH_COOLDOWN) {
      this.api.grants.refreshPanel();
      this.lastGrantRefreshSol = currentSol;
    }
    return false;
  }

  /**
   * Evaluate available grants and assign the best one (free action).
   * Prioritizes victory-path identity grants, then infrastructure grants.
   * Also refreshes the panel (with cooldown) when no useful grants are available.
   */
  private handleGrantEvaluation(): void {
    const grantsSnapshot = this.api.grants.snapshot();
    const currentSol = this.api.game.currentSol();

    if (grantsSnapshot.available.length === 0) {
      this.maybeRefreshPanel(currentSol);
      return;
    }

    const districts = this.api.districts.snapshot().districts;
    if (districts.length === 0) return;

    const districtId = districts[0]!.id;

    // Priority 1: Victory-path grants (identity grants for capstone prerequisites)
    if (this.committedFactionId && this.targetCapstoneId) {
      const capstone = getDistrictGrantTemplate(this.targetCapstoneId);
      if (capstone) {
        const prereqIds = new Set(capstone.prerequisites ?? []);
        // Look for capstone or prerequisite grants
        for (const grant of grantsSnapshot.available) {
          if (prereqIds.has(grant.templateId) || grant.templateId === capstone.id) {
            const check = this.api.grants.canAssignGrant(grant.id, districtId);
            if (check.canAssign) {
              this.api.grants.assignGrant(grant.id, districtId);
              return;
            }
          }
        }
        // Look for any assignable identity grant
        for (const grant of grantsSnapshot.available) {
          if (grant.category === "identity") {
            const check = this.api.grants.canAssignGrant(grant.id, districtId);
            if (check.canAssign) {
              this.api.grants.assignGrant(grant.id, districtId);
              return;
            }
          }
        }
      }
    }

    // Priority 2: Infrastructure grants
    const resources = this.api.resources.snapshot();
    let bestGrant: AvailableGrantSnapshot | null = null;
    let bestScore = -Infinity;

    for (const grant of grantsSnapshot.available) {
      if (grant.category === "identity") continue;

      let score = 10;
      const foodFlow = (resources.production.food ?? 0) - (resources.consumption.food ?? 0);
      const waterFlow = (resources.production.water ?? 0) - (resources.consumption.water ?? 0);

      if (foodFlow < 2) score += 10;
      if (waterFlow < 2) score += 10;
      if (resources.current.materials < 100) score += 10;

      const materialCost = grant.cost?.materials ?? 0;
      if (materialCost > 0 && resources.current.materials < materialCost) continue;

      if (score > bestScore) {
        bestScore = score;
        bestGrant = grant;
      }
    }

    if (bestGrant && bestScore > 0) {
      const check = this.api.grants.canAssignGrant(bestGrant.id, districtId);
      if (check.canAssign) {
        this.api.grants.assignGrant(bestGrant.id, districtId);
        return;
      }
    }

    // No grants assigned — refresh the panel with cooldown
    if (this.committedFactionId) {
      this.maybeRefreshPanel(currentSol);
    }
  }

  /**
   * Refresh the grant panel if cooldown has elapsed.
   */
  private maybeRefreshPanel(currentSol: number): void {
    if (currentSol - this.lastGrantRefreshSol >= this.GRANT_REFRESH_COOLDOWN) {
      this.api.grants.refreshPanel();
      this.lastGrantRefreshSol = currentSol;
    }
  }

  /**
   * Try to declare a policy that helps advance the committed faction's victory.
   * Considers both capstone/prerequisite axis requirements AND faction alignment.
   * @returns true if a policy was declared
   */
  private tryDeclarePolicy(factionId: string): boolean {
    // Don't declare if a policy is already active
    const activePolicy = this.api.ideology.getActivePolicy();
    if (activePolicy) return false;

    const faction = this.getFactionById(factionId);
    if (!faction) return false;

    // Also don't declare if food production is negative (colony is starving)
    const resources = this.api.resources.snapshot();
    const foodSurplus = (resources.production.food ?? 0) - (resources.consumption.food ?? 0);
    if (foodSurplus < 0) return false;

    // Find the best policy for our victory path first, then check cost
    const relevantGrants = this.getVictoryPathGrants();
    const bestPolicy = this.findBestPolicyForGrants(faction.position, relevantGrants);
    if (!bestPolicy) return false;

    // Check if we can afford the actual policy cost
    const policyMaterialCost = bestPolicy.cost.materials ?? 0;
    if (resources.current.materials < policyMaterialCost) return false;

    return this.api.ideology.declarePolicy(bestPolicy.id);
  }

  /**
   * Get all grants on the victory path: the target capstone and its prerequisites.
   * If no target is set, returns all capstones to guide policy toward one.
   */
  private getVictoryPathGrants(): readonly DistrictGrantTemplate[] {
    if (this.targetCapstoneId) {
      const capstone = getDistrictGrantTemplate(this.targetCapstoneId);
      if (capstone) {
        const prereqIds = capstone.prerequisites ?? [];
        const prereqs: DistrictGrantTemplate[] = [];
        for (const id of prereqIds) {
          const prereq = getDistrictGrantTemplate(id);
          if (prereq) prereqs.push(prereq);
        }
        return [capstone, ...prereqs];
      }
    }

    // No target capstone set -- return all capstones
    return getCapstoneGrants();
  }

  /**
   * Find the best policy to declare based on what axis movement is needed.
   * Considers both meeting unmet grant axis requirements and maintaining met ones.
   * Unmet requirements are weighted heavily; policies that endanger met requirements are penalized.
   */
  private findBestPolicyForGrants(
    factionPosition: AxisPosition,
    grants: readonly DistrictGrantTemplate[],
  ): (typeof POLICIES)[number] | null {
    let bestPolicy: (typeof POLICIES)[number] | null = null;
    let bestScore = -Infinity;

    for (const policy of POLICIES) {
      let score = 0;
      const movement = policy.direction * policy.strength;

      for (const grant of grants) {
        if (!grant.axisRequirements) continue;
        const req = grant.axisRequirements[policy.axis as keyof AxisPosition];
        if (!req) continue;

        const currentValue = factionPosition[policy.axis as keyof AxisPosition];

        if (req.min !== undefined) {
          const gap = req.min - currentValue;
          if (gap > 0) {
            // Unmet requirement: strongly favor policies that push toward it
            score += movement > 0 ? gap * 5 : -gap * 3;
          } else {
            // Met requirement: penalize policies that could drop us below
            const margin = -gap; // How much above the minimum
            if (movement < 0 && margin < 0.2) {
              score -= (0.2 - margin) * 4; // Strong penalty near the threshold
            }
          }
        }

        if (req.max !== undefined) {
          const gap = currentValue - req.max;
          if (gap > 0) {
            // Unmet requirement: strongly favor policies that push toward it
            score += movement < 0 ? gap * 5 : -gap * 3;
          } else {
            // Met requirement: penalize policies that could push us above
            const margin = -gap;
            if (movement > 0 && margin < 0.2) {
              score -= (0.2 - margin) * 4;
            }
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestPolicy = policy;
      }
    }

    // Only return a policy if it has a positive score (actually helps close axis gaps)
    // If all policies score <= 0, axes are already in position - save materials
    return bestScore > 0 ? bestPolicy : null;
  }
}
