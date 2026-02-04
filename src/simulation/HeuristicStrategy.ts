// src/simulation/HeuristicStrategy.ts
// Decision-making logic for Monte Carlo playtest simulation

import { BuildingId } from "../core/models/Building";
import type { EventChoice } from "../core/models/GameEvent";
import { DepositType, type GridPosition } from "../core/models/Grid";
import { NPCFaction, ProjectId } from "../core/models/NPCInfluence";
import { getProjectsByFaction } from "../core/data/projects";
import { rng } from "../core/utils/random";
import type { GameAPI } from "../facade/GameAPI";
import type { IdeologySnapshot } from "../facade/types/ideology";
import type { ActionCategory, BlockedDecision, EventOccurrence, ExecutedAction } from "./types";

// Center of the grid (5,5) for power source placement preference
const GRID_CENTER: GridPosition = { x: 5, y: 5 };

// Buildings that produce power (should be placed avoiding deposits)
const POWER_SOURCE_BUILDINGS = new Set([BuildingId.SOLAR_PANEL, BuildingId.NUCLEAR_REACTOR]);

// Buildings that require deposits
const RESOURCE_EXTRACTORS: Record<BuildingId, DepositType> = {
  [BuildingId.WATER_EXTRACTOR]: DepositType.WATER,
  [BuildingId.BASIC_MINE]: DepositType.MINERAL,
  [BuildingId.MINING_STATION]: DepositType.MINERAL,
};

/**
 * Mapping from faction to their victory megastructure building.
 */
const FACTION_MEGASTRUCTURES: Record<NPCFaction, BuildingId> = {
  [NPCFaction.EarthLoyalists]: BuildingId.SPACE_ELEVATOR,
  [NPCFaction.MarsIndependence]: BuildingId.UNITED_MARS_STATION,
  [NPCFaction.CorporateInterests]: BuildingId.ASTEROID_MINING_PLATFORM,
};

/**
 * Mapping from faction to their capstone project.
 */
const FACTION_CAPSTONES: Record<NPCFaction, ProjectId> = {
  [NPCFaction.EarthLoyalists]: ProjectId.EARTH_RELIEF_COMPACT,
  [NPCFaction.MarsIndependence]: ProjectId.DECLARATION_OF_SOVEREIGNTY,
  [NPCFaction.CorporateInterests]: ProjectId.DEEP_SPACE_MINING_CHARTER,
};

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
  /** Force commitment to a specific faction (for testing victory paths) */
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

  // Ideology victory state
  private committedFaction: NPCFaction | null = null;
  private readonly COMMITMENT_THRESHOLD = 0.4; // 40% council support to commit (lowered)
  private commitmentMinSol: number; // Set randomly in constructor for variety
  private readonly COMMITMENT_FALLBACK_SOL = 50; // If no majority by this sol, commit to leading faction (faster)
  private readonly LOBBY_AFFINITY_BOOST = 0.15; // Standard lobby boost per action
  private readonly MEGASTRUCTURE_MATERIAL_RESERVE = 400; // Reserve for megastructure once close

  // Strategy options
  private readonly targetFaction: NPCFaction | null;

  constructor(
    private api: GameAPI,
    options?: StrategyOptions,
  ) {
    this.targetFaction = options?.targetFaction ?? null;
    // Randomize commitment timing for variety (sol 15-30) - commit early!
    // This creates natural variation in which faction dominates when commitment happens
    this.commitmentMinSol = rng.int(15, 30);
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
   * Try to build a building at an optimal grid position.
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

    // When committed to a faction, reserve materials for ideology projects
    if (this.committedFaction) {
      const def = this.api.buildings.getDefinition(buildingId);
      const buildCost = def?.cost?.materials ?? 0;
      if (buildCost > 0) {
        const currentMaterials = this.api.resources.snapshot().current.materials;
        const reserve = this.getProjectMaterialsReserve();
        if (currentMaterials - buildCost < reserve) {
          // Don't build - would drop below materials reserve for projects
          return false;
        }
      }
    }

    // Find the best position for this building type
    const position = this.findBestPosition(buildingId);
    if (!position) {
      if (recordIfBlocked) {
        this.recordBlockedDecision(category, `build_${buildingId}`, "no valid grid position");
      }
      return false;
    }

    const result = this.api.buildings.buildAtPosition(buildingId, position);
    return result.success;
  }

  /**
   * Find the best grid position for a building based on its type.
   * - Power sources: near center, avoiding deposits
   * - Resource extractors: on matching deposit
   * - Power consumers: in power range, avoiding deposits
   */
  private findBestPosition(buildingId: BuildingId): GridPosition | null {
    // Resource extractors need matching deposit
    const requiredDeposit = RESOURCE_EXTRACTORS[buildingId as keyof typeof RESOURCE_EXTRACTORS];
    if (requiredDeposit) {
      const deposits = this.api.grid.getAvailableDeposits(requiredDeposit);
      if (deposits.length > 0) {
        return deposits[0].position;
      }
      return null; // No available deposit of required type
    }

    // Power sources: prefer center, avoid deposits
    if (POWER_SOURCE_BUILDINGS.has(buildingId)) {
      return this.findPowerSourcePosition();
    }

    // Power consumers: need to be in power range, avoid deposits
    return this.findPoweredPosition();
  }

  /**
   * Find a position for a power source building.
   * Prefers positions near the center, avoiding deposits.
   */
  private findPowerSourcePosition(): GridPosition | null {
    const emptyCells = this.api.grid.getEmptyCells();
    const candidates = emptyCells.filter((pos) => !this.api.grid.hasDeposit(pos));

    if (candidates.length === 0) {
      // Fallback: use any empty cell (even if on deposit)
      return emptyCells.length > 0 ? emptyCells[0] : null;
    }

    // Sort by distance to center (closest first)
    candidates.sort((a, b) => {
      const distA = this.api.grid.calculateDistance(a, GRID_CENTER);
      const distB = this.api.grid.calculateDistance(b, GRID_CENTER);
      return distA - distB;
    });

    return candidates[0];
  }

  /**
   * Find a position for a power-consuming building.
   * Prefers positions in power range, avoiding deposits.
   */
  private findPoweredPosition(): GridPosition | null {
    const emptyCells = this.api.grid.getEmptyCells();

    // First, try to find a powered cell that's not on a deposit
    const poweredCells = new Set(this.api.grid.getCellsInPowerRange().map((p) => `${p.x},${p.y}`));

    // Candidates: empty, in power range, not on deposit
    const poweredCandidates = emptyCells.filter(
      (pos) => poweredCells.has(`${pos.x},${pos.y}`) && !this.api.grid.hasDeposit(pos),
    );

    if (poweredCandidates.length > 0) {
      // Sort by distance to center (prefer central locations)
      poweredCandidates.sort((a, b) => {
        const distA = this.api.grid.calculateDistance(a, GRID_CENTER);
        const distB = this.api.grid.calculateDistance(b, GRID_CENTER);
        return distA - distB;
      });
      return poweredCandidates[0];
    }

    // Fallback: any empty cell not on deposit (building will be unpowered until power expands)
    const fallbackCandidates = emptyCells.filter((pos) => !this.api.grid.hasDeposit(pos));
    if (fallbackCandidates.length > 0) {
      // Sort by distance to center
      fallbackCandidates.sort((a, b) => {
        const distA = this.api.grid.calculateDistance(a, GRID_CENTER);
        const distB = this.api.grid.calculateDistance(b, GRID_CENTER);
        return distA - distB;
      });
      return fallbackCandidates[0];
    }

    // Last resort: any empty cell
    return emptyCells.length > 0 ? emptyCells[0] : null;
  }

  /**
   * Calculate materials to reserve for the next ideology project.
   * Returns the cost of the cheapest unproposed project for our committed faction.
   */
  private getProjectMaterialsReserve(): number {
    if (!this.committedFaction) return 0;

    const completedProjects = this.api.ideology.getCompletedProjects();
    const pendingProposals = this.api.ideology.getPendingProposals();
    const failedProposals = this.api.ideology.getFailedProposals();

    const factionProjects = getProjectsByFaction(this.committedFaction);
    const prerequisites = factionProjects.filter((p) => !p.isCapstone);

    let minCost = 0;
    for (const project of prerequisites) {
      if (completedProjects.includes(project.id)) continue;
      if (pendingProposals.some((p) => p.projectId === project.id)) continue;
      if (failedProposals.includes(project.id)) continue;

      const cost = project.proposalCost?.materials ?? 0;
      if (cost > 0 && (minCost === 0 || cost < minCost)) {
        minCost = cost;
      }
    }

    return minCost;
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

    // TOP PRIORITY: If capstone is completed, build megastructure to win!
    if (this.committedFaction && this.tryBuildMegastructureIfReady()) {
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

    const moraleResult = this.handleMoraleWithResult();
    if (moraleResult) return moraleResult;

    // After basic needs, alternate between infrastructure and ideology
    // This ensures political progress happens alongside building
    if (currentSol % 2 === 0) {
      const ideologyResult = this.handleIdeologyVictoryWithResult();
      if (ideologyResult) return ideologyResult;
      const infraResult = this.handleInfrastructureWithResult();
      if (infraResult) return infraResult;
    } else {
      const infraResult = this.handleInfrastructureWithResult();
      if (infraResult) return infraResult;
      const ideologyResult = this.handleIdeologyVictoryWithResult();
      if (ideologyResult) return ideologyResult;
    }

    // Growth is lower priority - don't grow if we're saving for megastructure
    if (!this.shouldReserveMaterials()) {
      const growthResult = this.handleGrowthWithResult();
      if (growthResult) return growthResult;
    }

    return { category: "idle", action: "none" };
  }

  /**
   * Check if capstone is completed and try to build megastructure.
   * This is checked at the TOP of each tick to ensure victory ASAP.
   * @returns true if megastructure building was started
   */
  private tryBuildMegastructureIfReady(): boolean {
    if (!this.committedFaction) return false;

    const capstoneId = FACTION_CAPSTONES[this.committedFaction];
    const completedProjects = this.api.ideology.getCompletedProjects();

    if (!completedProjects.includes(capstoneId)) return false;

    const megastructureId = FACTION_MEGASTRUCTURES[this.committedFaction];
    return this.tryBuildMegastructure(megastructureId);
  }

  /**
   * Check if we should reserve materials for the megastructure.
   * Returns true when we're close to victory (2+ prerequisites done).
   */
  private shouldReserveMaterials(): boolean {
    if (!this.committedFaction) return false;

    const completedProjects = this.api.ideology.getCompletedProjects();
    const factionProjects = getProjectsByFaction(this.committedFaction);
    const prerequisites = factionProjects.filter((p) => !p.isCapstone);

    // Count completed prerequisites
    const completedPrereqs = prerequisites.filter((p) => completedProjects.includes(p.id)).length;

    // Reserve materials once we're close to victory (2+ prerequisites done)
    if (completedPrereqs >= 2) {
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
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleEarlyGameBootstrapWithResult(): TickResult | null {
    const buildings = this.api.buildings.snapshot();

    // Count active and pending survival buildings
    let farmCount = 0;
    let oxygenGenCount = 0;

    for (const b of buildings.active) {
      if (b.definitionId === BuildingId.BASIC_FARM) farmCount++;
      if (b.definitionId === BuildingId.OXYGEN_GENERATOR) oxygenGenCount++;
    }

    for (const b of buildings.pending) {
      if (b.definitionId === BuildingId.BASIC_FARM) farmCount++;
      if (b.definitionId === BuildingId.OXYGEN_GENERATOR) oxygenGenCount++;
    }

    // Critical: must have at least 1 farm and 1 oxygen generator
    // If missing either, try to build it immediately
    if (farmCount === 0) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    if (oxygenGenCount === 0) {
      if (this.tryBuild(BuildingId.OXYGEN_GENERATOR, "survival", false)) {
        return { category: "survival", action: "build_oxygen_generator" };
      }
    }

    // If we have basic infrastructure, allow normal flow
    // The regular handleSurvival will continue building more as needed
    return null;
  }

  /**
   * Assign unassigned colonists to buildings with worker slots.
   * Prioritizes: 1) Farms for food production 2) Other production buildings
   * Tries to match colonist roles to building requirements.
   */
  private handleWorkerAssignment(): void {
    const buildings = this.api.buildings.snapshot();
    const colony = this.api.colony.snapshot({ lightweight: true });

    // Build definition lookup map once - O(n) instead of O(n²) with repeated .find()
    const defMap = new Map(buildings.definitions.map((d) => [d.id, d]));

    // Get buildings that need workers (active, have worker slots, not fully staffed)
    const needsWorkers = buildings.active.filter((b) => {
      const def = defMap.get(b.definitionId);
      if (!def?.workerSlots) return false;
      return b.assignedWorkers.length < def.workerSlots;
    });

    if (needsWorkers.length === 0) return;

    // Sort buildings by priority: farms first (food production), then others
    needsWorkers.sort((a, b) => {
      const defA = defMap.get(a.definitionId);
      const defB = defMap.get(b.definitionId);
      const aIsFood = defA?.production?.food ? 1 : 0;
      const bIsFood = defB?.production?.food ? 1 : 0;
      return bIsFood - aIsFood; // Food producers first
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
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleSurvivalWithResult(): TickResult | null {
    const resources = this.api.resources.snapshot();
    const buildings = this.api.buildings.snapshot();
    const currentFood = resources.current.food;
    const currentWater = resources.current.water;
    const foodProduction = resources.production.food ?? 0;
    const foodConsumption = resources.consumption.food ?? 0;
    const waterProduction = resources.production.water ?? 0;
    const waterConsumption = resources.consumption.water ?? 0;

    // Calculate air contribution from buildings
    const airContribution = buildings.totalAirContribution;

    // Handle water production early - needed for morale recovery
    if (this.handleWaterProduction(waterProduction, waterConsumption, currentWater)) {
      return { category: "survival", action: "build_water_extractor" };
    }

    const foodFlow = foodProduction - foodConsumption;

    // Critical food shortage
    if (currentFood < 50 || foodFlow < 0) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    // Maintain positive flow with buffer for food
    // Food needs buffer of 4 to handle population growth and events
    if (foodFlow < 4) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival")) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    // Air contribution needs to be maintained for air quality
    if (airContribution < 6) {
      // Oxygen generator provides the most air contribution
      if (this.tryBuild(BuildingId.OXYGEN_GENERATOR, "survival")) {
        return { category: "survival", action: "build_oxygen_generator" };
      }
      // Hydroponic garden provides air contribution without workers
      if (this.tryBuild(BuildingId.HYDROPONIC_GARDEN, "survival")) {
        return { category: "survival", action: "build_hydroponic_garden" };
      }
      // Farm provides food AND air contribution (if workers are assigned)
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival")) {
        return { category: "survival", action: "build_basic_farm" };
      }
    }

    return null;
  }

  /**
   * Handle water production by building water extractors on grid deposits.
   * Uses grid-based deposit placement instead of Operations site workflow.
   * @returns true if an action was taken
   */
  private handleWaterProduction(
    waterProduction: number,
    waterConsumption: number,
    currentWater: number,
  ): boolean {
    const waterFlow = waterProduction - waterConsumption;

    // Water is fine - no action needed
    if (waterFlow > 0 && currentWater > 30) return false;

    // Already have a water extractor and not in crisis
    if (this.hasBuilding(BuildingId.WATER_EXTRACTOR) && waterFlow >= 0) return false;

    // Try to build water extractor on an available water deposit
    // tryBuild() will automatically find an available water deposit via findBestPosition()
    return this.tryBuild(BuildingId.WATER_EXTRACTOR, "survival");
  }

  /**
   * Handle materials production by building basic mines on grid deposits.
   * Uses grid-based deposit placement instead of Operations site workflow.
   * @returns true if an action was taken
   */
  /**
   * Handle materials production - ensure adequate materials flow.
   * Target at least 10 materials/sol production to sustain mid-game expansion.
   * Progression: Basic Mine (4/sol) → 3D Fabricator (7/sol) → Automated Factory (15/sol)
   * @returns the building ID that was started, or null if nothing was built
   */
  private handleMaterialsProduction(): BuildingId | null {
    const resources = this.api.resources.snapshot();
    const materialsProd = resources.production.materials ?? 0;

    // Target minimum production rate for sustainable expansion
    const TARGET_MATERIALS_PRODUCTION = 10;

    // If we have enough production, don't build more
    if (materialsProd >= TARGET_MATERIALS_PRODUCTION) return null;

    // Try advanced buildings first (better ROI if tech is available)
    // Automated Factory: 15/sol, no workers needed, requires ROBOTICS
    if (this.tryBuild(BuildingId.AUTOMATED_FACTORY, "infrastructure", false)) {
      return BuildingId.AUTOMATED_FACTORY;
    }

    // 3D Fabricator: 7/sol, requires ADVANCED_MATERIALS
    if (this.tryBuild(BuildingId.FABRICATOR_3D, "infrastructure", false)) {
      return BuildingId.FABRICATOR_3D;
    }

    // Basic Mine: 4/sol, requires mineral deposit
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
   * Scores each choice once (O(n)) instead of re-scoring on each comparison (O(n²)).
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

    // Population effects are heavily weighted
    if (choice.effects.population !== undefined) {
      if (choice.effects.population < 0) {
        // Avoid population loss - heavily penalize
        score -= 1000 * Math.abs(choice.effects.population);
      } else {
        // Population gain is valuable
        score += 100 * choice.effects.population;
      }
    }

    // Resource effects - sum up net stockpiled resources (power is grid-based, not scored here)
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

    // Start cheapest available research if none active
    if (!techSnapshot.currentResearch && techSnapshot.available.length > 0) {
      const affordableTechs = techSnapshot.available
        .filter((tech) => this.api.technology.canResearch(tech.id).allowed)
        .sort((a, b) => a.cost.sols - b.cost.sols);

      if (affordableTechs.length > 0) {
        const cheapest = affordableTechs[0];
        if (cheapest) {
          this.api.technology.startResearch(cheapest.id);
          return { category: "infrastructure", action: `research_${cheapest.id}` };
        }
      } else {
        // All available techs are blocked - record first one
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

    // Establish materials production - build mines, fabricators, or factories
    const materialsBuilding = this.handleMaterialsProduction();
    if (materialsBuilding) {
      return { category: "infrastructure", action: `build_${materialsBuilding}` };
    }

    // Build solar panel if we have unpowered buildings or production is near consumption
    const powerGrid = this.api.powerGrid.snapshot();
    const hasUnpowered = powerGrid.buildingCounts.unpowered > 0;
    const productionRatio =
      powerGrid.totalConsumption > 0
        ? powerGrid.totalProduction / powerGrid.totalConsumption
        : powerGrid.totalProduction > 0
          ? 1.0
          : 0;
    // Build more solar panels if we have unpowered buildings or less than 20% headroom
    if (hasUnpowered || productionRatio < 1.2) {
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
   * @returns TickResult if an action was taken, null otherwise
   */
  private handleGrowthWithResult(): TickResult | null {
    const colony = this.api.colony.snapshot({ lightweight: true });
    const resources = this.api.resources.snapshot();

    // Only grow if population < 100 and morale > 60
    if (colony.population >= 100 || colony.morale <= 60) return null;

    // Calculate resource surpluses
    const foodSurplus = (resources.production.food ?? 0) - (resources.consumption.food ?? 0);

    // Need at least 4 food surplus before growing (increased from 2)
    // This prevents building habitats when food is barely sufficient
    if (foodSurplus < 4) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) {
        return { category: "growth", action: "build_basic_farm" };
      }
    }

    // Also check food stockpile - don't grow if food is low
    if (resources.current.food < 80) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) {
        return { category: "growth", action: "build_basic_farm" };
      }
      return null; // Don't build habitat if food stockpile is low
    }

    // Build habitat to grow population
    if (this.tryBuild(BuildingId.HABITAT, "growth")) {
      return { category: "growth", action: "build_habitat" };
    }

    return null;
  }

  /**
   * Ideology Victory: Work toward faction megastructure victory.
   *
   * Strategy:
   * 1. Commit to a faction early (sol 15-30 or when one has 40%+)
   * 2. Aggressively lobby to build faction support in council
   * 3. Propose prerequisite projects (accept failed votes, retry when favorable)
   * 4. Propose capstone when prerequisites complete and ≥65% council support
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

    // Step 1: Check/update faction commitment (commit early!)
    if (!this.committedFaction) {
      this.committedFaction = this.checkFactionCommitment(ideologySnapshot);
      if (!this.committedFaction) {
        // Still opportunistic - aggressively lobby for the leading faction
        const leadingFaction = this.getLeadingFaction(ideologySnapshot);
        if (leadingFaction) {
          if (this.tryLobbyForFaction(leadingFaction)) {
            return { category: "victory", action: "lobby_faction" };
          }
        }
        return null;
      }
    }

    // Step 2: Try to advance toward victory
    return this.advanceFactionVictoryWithResult(this.committedFaction);
  }

  /**
   * Check if any faction has reached the commitment threshold.
   * Returns the faction to commit to, or null if still opportunistic.
   * If targetFaction is set, commits immediately to that faction.
   * Otherwise waits until COMMITMENT_MIN_SOL, then commits if a faction has 50%+.
   * If no faction has 50%+ by COMMITMENT_FALLBACK_SOL, commits to the leading faction.
   */
  private checkFactionCommitment(snapshot: IdeologySnapshot): NPCFaction | null {
    // If a target faction is specified, commit immediately
    if (this.targetFaction) {
      return this.targetFaction;
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

    // Track the leading faction
    let leadingFaction: NPCFaction | null = null;
    let maxSeats = 0;

    // Check each faction's council representation
    for (const faction of [
      NPCFaction.EarthLoyalists,
      NPCFaction.MarsIndependence,
      NPCFaction.CorporateInterests,
    ]) {
      const seats = counts[faction] ?? 0;
      const ratio = seats / totalSeats;

      // Track leader
      if (seats > maxSeats) {
        maxSeats = seats;
        leadingFaction = faction;
      }

      // Commit if threshold met
      if (ratio >= this.COMMITMENT_THRESHOLD) {
        return faction;
      }
    }

    // Fallback: if past the fallback sol and no one has 50%, commit to leader
    if (currentSol >= this.COMMITMENT_FALLBACK_SOL && leadingFaction) {
      return leadingFaction;
    }

    return null;
  }

  /**
   * Get the faction to lobby for during opportunistic phase.
   * If targetFaction is set, always returns that faction.
   * Otherwise returns the faction with the most council seats.
   */
  private getLeadingFaction(snapshot: IdeologySnapshot): NPCFaction | null {
    // If targeting a specific faction, always lobby for it
    if (this.targetFaction) {
      return this.targetFaction;
    }

    const counts = snapshot.councilFactionCounts;

    let leadingFaction: NPCFaction | null = null;
    let maxSeats = 0;

    for (const faction of [
      NPCFaction.EarthLoyalists,
      NPCFaction.MarsIndependence,
      NPCFaction.CorporateInterests,
    ]) {
      const seats = counts[faction] ?? 0;
      if (seats > maxSeats) {
        maxSeats = seats;
        leadingFaction = faction;
      }
    }

    return leadingFaction;
  }

  /**
   * Attempt to advance toward the committed faction's megastructure victory.
   * Victory path: 3 prerequisites → 65% council → capstone → megastructure
   * @returns true if an action was taken
   */
  private advanceFactionVictory(faction: NPCFaction): boolean {
    return this.advanceFactionVictoryWithResult(faction) !== null;
  }

  /**
   * Advance faction victory with action result tracking.
   * @returns TickResult if an action was taken, null otherwise
   */
  private advanceFactionVictoryWithResult(faction: NPCFaction): TickResult | null {
    const completedProjects = this.api.ideology.getCompletedProjects();
    const failedProposals = this.api.ideology.getFailedProposals();
    const pendingProposals = this.api.ideology.getPendingProposals();

    // Get faction's projects (non-capstone prerequisites first)
    const factionProjects = getProjectsByFaction(faction);
    const prerequisites = factionProjects.filter((p) => !p.isCapstone);
    const capstoneId = FACTION_CAPSTONES[faction];
    const megastructureId = FACTION_MEGASTRUCTURES[faction];

    // Step 0: If capstone is completed, build megastructure to win!
    if (completedProjects.includes(capstoneId)) {
      if (this.tryBuildMegastructure(megastructureId)) {
        return { category: "victory", action: `build_${megastructureId}` };
      }
    }

    // Check current council support for our faction
    const ideologySnapshot = this.api.ideology.snapshot();
    const counts = ideologySnapshot.councilFactionCounts;
    const totalSeats = ideologySnapshot.council.length;
    const factionSeats = counts[faction] ?? 0;
    const supportRatio = totalSeats > 0 ? factionSeats / totalSeats : 0;
    const needsMoreSupport = supportRatio < 0.65;

    // Step 1: PRIORITY - Lobby to build council support if below 65%
    // This is critical because we can't pass capstone without 65% support
    if (needsMoreSupport) {
      if (this.tryLobbyForFaction(faction)) {
        return { category: "victory", action: "lobby_faction" };
      }
    }

    // Step 2: Clear failed proposals that now have favorable vote projection
    if (this.clearRetryableProposals(faction, failedProposals)) {
      return { category: "victory", action: "clear_failed_proposal" };
    }

    // Step 3: Check if we can propose a prerequisite
    for (const project of prerequisites) {
      if (completedProjects.includes(project.id)) continue;
      if (pendingProposals.some((p) => p.projectId === project.id)) continue;
      if (failedProposals.includes(project.id)) continue;

      if (this.tryProposeProject(project.id)) {
        return { category: "victory", action: `propose_${project.id}` };
      }
    }

    // Step 4: Check if capstone is ready (need 65% + all prerequisites)
    if (this.tryProposeCapstone(capstoneId)) {
      return { category: "victory", action: `propose_${capstoneId}` };
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
   * Attempt to propose a project.
   * Proposes even if vote projection suggests it might fail - accept failed votes
   * and retry when council composition becomes favorable.
   * @returns true if proposal was submitted
   */
  private tryProposeProject(projectId: ProjectId): boolean {
    const eligibility = this.api.ideology.canProposeProject(projectId);
    if (!eligibility.canPropose) return false;

    const result = this.api.ideology.proposeProject(projectId);
    return result.success;
  }

  /**
   * Attempt to propose the capstone if all conditions are met.
   * Capstone requires 65% council support, checked via canProposeProject.
   */
  private tryProposeCapstone(projectId: ProjectId): boolean {
    // canProposeProject checks prerequisites and council support for capstones
    const eligibility = this.api.ideology.canProposeProject(projectId);
    if (!eligibility.canPropose) return false;

    const result = this.api.ideology.proposeProject(projectId);
    return result.success;
  }

  /**
   * Clear failed proposals that now have favorable vote projection.
   * @returns true if any proposal was cleared (action taken)
   */
  private clearRetryableProposals(
    faction: NPCFaction,
    failedProposals: readonly ProjectId[],
  ): boolean {
    const projection = this.api.ideology.getVoteProjection(faction);
    if (!projection.wouldPass) return false;

    for (const projectId of failedProposals) {
      this.api.ideology.clearFailedProposal(projectId);
      return true; // One action per tick
    }
    return false;
  }

  /**
   * Try to lobby a council member to increase faction support.
   * Targets council members who aren't already aligned with our faction.
   * @returns true if lobbying was successful
   */
  private tryLobbyForFaction(faction: NPCFaction): boolean {
    const ideologySnapshot = this.api.ideology.snapshot();
    const council = ideologySnapshot.council;

    if (council.length === 0) return false;

    // Find council members who might be swayed
    // Target those not already aligned with our faction
    const candidates = council.filter((member) => member.faction !== faction);

    // Try to lobby candidates (already sorted by influence from getCouncil)
    for (const candidate of candidates) {
      const eligibility = this.api.ideology.canLobby(
        candidate.colonistId,
        faction,
        this.LOBBY_AFFINITY_BOOST,
      );

      if (eligibility.canLobby) {
        const result = this.api.ideology.lobbyCouncilMember(
          candidate.colonistId,
          faction,
          this.LOBBY_AFFINITY_BOOST,
        );
        if (result.success) {
          return true;
        }
      }
    }

    return false;
  }
}
