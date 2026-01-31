// src/simulation/HeuristicStrategy.ts
// Decision-making logic for Monte Carlo playtest simulation

import { BuildingId } from "../core/models/Building";
import type { EventChoice } from "../core/models/GameEvent";
import { NPCFaction, type ProjectId } from "../core/models/NPCInfluence";
import { getProjectsByFaction } from "../core/data/projects";
import { rng } from "../core/utils/random";
import type { GameAPI } from "../facade/GameAPI";
import type { IdeologySnapshot } from "../facade/types/ideology";
import type { BlockedDecision, EventOccurrence } from "./types";

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

export class HeuristicStrategy {
  private blockedDecisions: BlockedDecision[] = [];
  private eventsOccurred: EventOccurrence[] = [];

  // Per-tick cache for hasBuilding() - avoids repeated snapshot() and O(n) searches
  private cachedBuildingIds: Set<BuildingId> | null = null;

  // Ideology victory state
  private committedFaction: NPCFaction | null = null;
  private readonly COMMITMENT_THRESHOLD = 0.5; // 50% council support to commit
  private commitmentMinSol: number; // Set randomly in constructor for variety
  private readonly COMMITMENT_FALLBACK_SOL = 100; // If no majority by this sol, commit to leading faction
  private readonly LOBBY_AFFINITY_BOOST = 0.15; // Standard lobby boost per action

  // Strategy options
  private readonly targetFaction: NPCFaction | null;

  constructor(
    private api: GameAPI,
    options?: StrategyOptions,
  ) {
    this.targetFaction = options?.targetFaction ?? null;
    // Randomize commitment timing for variety (sol 25-50)
    // This creates natural variation in which faction dominates when commitment happens
    this.commitmentMinSol = rng.int(25, 50);
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
   * Try to build a building. Returns true if built, records blocked decision if not.
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

    this.api.buildings.build(buildingId);
    return true;
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
   */
  executeTick(): void {
    // Invalidate per-tick caches
    this.cachedBuildingIds = null;

    // First, ensure workers are assigned to buildings
    this.handleWorkerAssignment();

    // Early game bootstrap: ensure at least one farm and oxygen generator exist
    const currentSol = this.api.game.currentSol();
    if (currentSol < 50 && this.handleEarlyGameBootstrap()) return;

    // Execute priority handlers in order
    // Each returns true if it took an action, allowing for multiple actions per tick
    // but prioritizing survival/events over growth
    if (this.handleSurvival()) return;
    if (this.handleEventResolution()) return;
    if (this.handleMorale()) return;
    if (this.handleInfrastructure()) return;
    if (this.handleGrowth()) return;
    this.handleIdeologyVictory();
  }

  /**
   * Early game bootstrap phase (first 100 sols).
   * Ensures minimum survival infrastructure is built early.
   * Less restrictive than before - only blocks when we have ZERO critical buildings.
   * @returns true if an action was taken
   */
  private handleEarlyGameBootstrap(): boolean {
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
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) return true;
    }

    if (oxygenGenCount === 0) {
      if (this.tryBuild(BuildingId.OXYGEN_GENERATOR, "survival", false)) return true;
    }

    // If we have basic infrastructure, allow normal flow
    // The regular handleSurvival will continue building more as needed
    return false;
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
    const resources = this.api.resources.snapshot();
    const buildings = this.api.buildings.snapshot();
    const currentFood = resources.current.food;
    const currentWater = resources.current.water;
    const foodProduction = resources.production.food ?? 0;
    const foodConsumption = resources.consumption.food ?? 0;
    const waterProduction = resources.production.water ?? 0;
    const waterConsumption = resources.consumption.water ?? 0;

    // Calculate oxygen contribution from buildings
    const oxygenContribution = buildings.totalOxygenContribution;

    // Handle water production early - needed for morale recovery
    if (this.handleWaterProduction(waterProduction, waterConsumption, currentWater)) {
      return true;
    }

    const foodFlow = foodProduction - foodConsumption;

    // Critical food shortage
    if (currentFood < 50 || foodFlow < 0) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) return true;
    }

    // Maintain positive flow with buffer for food
    // Food needs buffer of 4 to handle population growth and events
    if (foodFlow < 4) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival")) return true;
    }

    // Oxygen contribution needs to be maintained for air quality
    if (oxygenContribution < 6) {
      // Oxygen generator provides the most oxygen contribution
      if (this.tryBuild(BuildingId.OXYGEN_GENERATOR, "survival")) return true;
      // Hydroponic garden provides oxygen contribution without workers
      if (this.tryBuild(BuildingId.HYDROPONIC_GARDEN, "survival")) return true;
      // Farm provides food AND oxygen contribution (if workers are assigned)
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival")) return true;
    }

    return false;
  }

  /**
   * Handle water production by building water extractors on deposits.
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

    const operations = this.api.operations.snapshot();

    // Single pass to categorize water sites instead of multiple .find() calls
    let developedAvailable: (typeof operations.sites)[0] | null = null;
    let revealedUndeveloped: (typeof operations.sites)[0] | null = null;
    let unrevealed: (typeof operations.sites)[0] | null = null;

    for (const site of operations.sites) {
      if (site.resourceType !== "water") continue;

      if (site.developed && !site.linkedBuildingId && !developedAvailable) {
        developedAvailable = site;
      } else if (site.revealed && !site.developed && !revealedUndeveloped) {
        revealedUndeveloped = site;
      } else if (!site.revealed && !unrevealed) {
        unrevealed = site;
      }

      // Early exit if we found all categories
      if (developedAvailable && revealedUndeveloped && unrevealed) break;
    }

    // Priority 1: Build water extractor on available developed deposit
    if (developedAvailable) {
      const canBuild = this.api.buildings.canBuild(BuildingId.WATER_EXTRACTOR);
      if (canBuild.allowed) {
        const result = this.api.buildings.build(BuildingId.WATER_EXTRACTOR);
        if (result.success && result.data) {
          this.api.buildings.linkToDeposit(result.data.id, developedAvailable.id);
          return true;
        }
      }
    }

    // Priority 2: Develop a revealed water site
    if (revealedUndeveloped) {
      const canDevelop = this.api.operations.canDevelopSite(revealedUndeveloped.id);
      if (canDevelop.allowed) {
        this.api.operations.developSite(revealedUndeveloped.id);
        return true;
      }
    }

    // Priority 3: Reveal an unrevealed water site
    if (unrevealed) {
      const canReveal = this.api.operations.canRevealSite(unrevealed.id);
      if (canReveal.allowed) {
        this.api.operations.revealSite(unrevealed.id);
        return true;
      }
    }

    return false;
  }

  /**
   * Handle materials production by building basic mines on mineral deposits.
   * @returns true if an action was taken
   */
  private handleMaterialsProduction(): boolean {
    const resources = this.api.resources.snapshot();
    const materialsProd = resources.production.materials ?? 0;

    // Already have materials production
    if (materialsProd > 0) return false;

    const operations = this.api.operations.snapshot();

    // Single pass to categorize mineral sites
    let developedAvailable: (typeof operations.sites)[0] | null = null;
    let revealedUndeveloped: (typeof operations.sites)[0] | null = null;
    let unrevealed: (typeof operations.sites)[0] | null = null;

    for (const site of operations.sites) {
      if (site.resourceType !== "minerals") continue;

      if (site.developed && !site.linkedBuildingId && !developedAvailable) {
        developedAvailable = site;
      } else if (site.revealed && !site.developed && !revealedUndeveloped) {
        revealedUndeveloped = site;
      } else if (!site.revealed && !unrevealed) {
        unrevealed = site;
      }

      if (developedAvailable && revealedUndeveloped && unrevealed) break;
    }

    // Priority 1: Build basic mine on available developed deposit
    if (developedAvailable) {
      const canBuild = this.api.buildings.canBuild(BuildingId.BASIC_MINE);
      if (canBuild.allowed) {
        const result = this.api.buildings.build(BuildingId.BASIC_MINE);
        if (result.success && result.data) {
          this.api.buildings.linkToDeposit(result.data.id, developedAvailable.id);
          return true;
        }
      }
    }

    // Priority 2: Develop a revealed mineral site
    if (revealedUndeveloped) {
      const canDevelop = this.api.operations.canDevelopSite(revealedUndeveloped.id);
      if (canDevelop.allowed) {
        this.api.operations.developSite(revealedUndeveloped.id);
        return true;
      }
    }

    // Priority 3: Reveal an unrevealed mineral site
    if (unrevealed) {
      const canReveal = this.api.operations.canRevealSite(unrevealed.id);
      if (canReveal.allowed) {
        this.api.operations.revealSite(unrevealed.id);
        return true;
      }
    }

    return false;
  }

  /**
   * Priority 2 - Event Resolution: Handle active events.
   * @returns true if an event was resolved
   */
  private handleEventResolution(): boolean {
    if (!this.api.events.hasActive()) {
      return false;
    }

    const activeEvent = this.api.events.getActive();
    if (!activeEvent) {
      return false;
    }

    const choices = activeEvent.choices;
    if (choices.length === 0) {
      return false;
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

    return true;
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

    // Resource effects - sum up net resources
    if (choice.effects.resources) {
      const resources = choice.effects.resources;
      score += resources.food ?? 0;
      score += resources.water ?? 0;
      score += resources.power ?? 0;
      score += resources.materials ?? 0;
    }

    // Support effects are neutral for this heuristic (political)
    // Could be weighted if needed for faction strategies

    return score;
  }

  /**
   * Priority 3 - Morale: Build recreation buildings to maintain morale for Colony Charter.
   * Colony Charter requires sustained morale >= 60, so we target 70 as a buffer.
   * @returns true if an action was taken
   */
  private handleMorale(): boolean {
    const colony = this.api.colony.snapshot({ lightweight: true });
    const buildings = this.api.buildings.snapshot();

    // Target morale threshold (Colony Charter needs 60, we want buffer)
    const MORALE_TARGET = 70;

    // Don't build recreation if morale is healthy
    if (colony.morale >= MORALE_TARGET) return false;

    // Calculate current morale boost from buildings
    const currentMoraleBoost = buildings.moraleBoost;

    // Each point of moraleBoost adds 0.1 to recovery rate
    // Base recovery is 0.5, decay is 0.3, so net is +0.2 without buildings
    // With moraleBoost of 10, recovery becomes 0.5 + 1.0 = 1.5, net +1.2
    // We want enough boost to recover morale reliably

    // If we already have decent morale boost (15+), don't over-build
    if (currentMoraleBoost >= 15 && colony.morale > 50) return false;

    // Build recreation buildings in order of cost-effectiveness
    // COMMON_ROOM: 60 materials, +5 boost (0.083 boost per material)
    // GYMNASIUM: 80 materials, +6 boost (0.075 boost per material)
    // OBSERVATORY_DOME: 150 materials, +8 boost (0.053 boost per material, needs tech)

    // Start with common room - cheapest and good boost
    if (!this.hasBuilding(BuildingId.COMMON_ROOM)) {
      if (this.tryBuild(BuildingId.COMMON_ROOM, "morale")) return true;
    }

    // Then gymnasium for additional boost
    if (!this.hasBuilding(BuildingId.GYMNASIUM)) {
      if (this.tryBuild(BuildingId.GYMNASIUM, "morale")) return true;
    }

    // Observatory dome if we have tech and need more boost
    if (currentMoraleBoost < 15) {
      if (this.tryBuild(BuildingId.OBSERVATORY_DOME, "morale", false)) return true;
    }

    return false;
  }

  /**
   * Priority 4 - Infrastructure: Research, power, materials.
   * @returns true if an action was taken
   */
  private handleInfrastructure(): boolean {
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
          return true;
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

    // Establish materials production early via basic mines
    if (this.handleMaterialsProduction()) return true;

    // Build solar panel if power production is insufficient
    const powerProduction = resources.production.power ?? 0;
    const powerConsumption = resources.consumption.power ?? 0;
    if (powerProduction < powerConsumption + 20) {
      if (this.tryBuild(BuildingId.SOLAR_PANEL, "infrastructure")) return true;
    }

    // Build mining station for more materials (requires asteroid_mining tech)
    if (resources.current.materials < 100) {
      if (this.tryBuild(BuildingId.MINING_STATION, "infrastructure")) return true;
    }

    return false;
  }

  /**
   * Priority 5 - Growth: Expand population when stable.
   * @returns true if an action was taken
   */
  private handleGrowth(): boolean {
    const colony = this.api.colony.snapshot({ lightweight: true });
    const resources = this.api.resources.snapshot();

    // Only grow if population < 100 and morale > 60
    if (colony.population >= 100 || colony.morale <= 60) return false;

    // Calculate resource surpluses
    const foodSurplus = (resources.production.food ?? 0) - (resources.consumption.food ?? 0);

    // Need at least 4 food surplus before growing (increased from 2)
    // This prevents building habitats when food is barely sufficient
    if (foodSurplus < 4) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) return true;
    }

    // Also check food stockpile - don't grow if food is low
    if (resources.current.food < 80) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) return true;
      return false; // Don't build habitat if food stockpile is low
    }

    // Build habitat to grow population
    if (this.tryBuild(BuildingId.HABITAT, "growth")) return true;

    return false;
  }

  /**
   * Priority 6 - Ideology Victory: Work toward faction capstone victory.
   *
   * Strategy:
   * 1. If no faction committed, check if any has ≥50% council seats
   * 2. If still opportunistic, lobby for the leading faction to build support
   * 3. Once committed, propose prerequisite projects (accept failed votes)
   * 4. Clear failed proposals when vote projection becomes favorable
   * 5. Lobby council members when stuck to build faction support
   * 6. Propose capstone when prerequisites complete and ≥65% council support
   *
   * @returns true if an action was taken
   */
  private handleIdeologyVictory(): boolean {
    const ideologySnapshot = this.api.ideology.snapshot();
    const council = ideologySnapshot.council;

    if (council.length === 0) return false; // No council yet

    // Step 1: Check/update faction commitment
    if (!this.committedFaction) {
      this.committedFaction = this.checkFactionCommitment(ideologySnapshot);
      if (!this.committedFaction) {
        // Still opportunistic - lobby for the leading faction to build support
        const leadingFaction = this.getLeadingFaction(ideologySnapshot);
        if (leadingFaction) {
          return this.tryLobbyForFaction(leadingFaction);
        }
        return false;
      }
    }

    // Step 2: Try to advance toward capstone
    return this.advanceFactionVictory(this.committedFaction);
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
   * Attempt to advance toward the committed faction's capstone victory.
   * @returns true if an action was taken
   */
  private advanceFactionVictory(faction: NPCFaction): boolean {
    const completedProjects = this.api.ideology.getCompletedProjects();
    const failedProposals = this.api.ideology.getFailedProposals();
    const pendingProposals = this.api.ideology.getPendingProposals();

    // Get faction's projects (non-capstone prerequisites first)
    const factionProjects = getProjectsByFaction(faction);
    const prerequisites = factionProjects.filter((p) => !p.isCapstone);
    const capstone = factionProjects.find((p) => p.isCapstone);

    if (!capstone) return false;

    // Step 1: Clear failed proposals that now have favorable vote projection
    if (this.clearRetryableProposals(faction, failedProposals)) {
      return true;
    }

    // Step 2: Check if we can propose a prerequisite
    for (const project of prerequisites) {
      if (completedProjects.includes(project.id)) continue;
      if (pendingProposals.some((p) => p.projectId === project.id)) continue;
      if (failedProposals.includes(project.id)) continue;

      if (this.tryProposeProject(project.id)) {
        return true;
      }
    }

    // Step 3: Check if capstone is ready
    if (this.tryProposeCapstone(capstone.id)) {
      return true;
    }

    // Step 4: Lobby council members to build faction support
    if (this.tryLobbyForFaction(faction)) {
      return true;
    }

    return false;
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
