// src/simulation/HeuristicStrategy.ts
// Decision-making logic for Monte Carlo playtest simulation

import { BuildingId } from "../core/models/Building";
import type { EventChoice } from "../core/models/GameEvent";
import { TechnologyId } from "../core/models/Technology";
import type { GameAPI } from "../facade/GameAPI";
import type { BlockedDecision, EventOccurrence } from "./types";

/**
 * HeuristicStrategy simulates a "competent player" making reasonable decisions.
 * Called by SimulationRunner each game tick to make decisions before advancing the sol.
 *
 * Priorities (in order):
 * 1. Survival - Ensure food and oxygen are maintained
 * 2. Event Resolution - Handle active events
 * 3. Morale - Build recreation buildings to maintain morale for Colony Charter
 * 4. Infrastructure - Research, power, materials
 * 5. Growth - Expand population when stable
 * 6. Victory Push - Research generation ship when available
 */
export class HeuristicStrategy {
  private blockedDecisions: BlockedDecision[] = [];
  private eventsOccurred: EventOccurrence[] = [];

  constructor(private api: GameAPI) {}

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
   */
  private tryBuild(
    buildingId: BuildingId,
    category: BlockedDecision["category"],
    recordIfBlocked = true,
  ): boolean {
    const canBuild = this.api.buildings.canBuild(buildingId);
    if (canBuild.allowed) {
      this.api.buildings.build(buildingId);
      return true;
    }
    if (recordIfBlocked) {
      this.recordBlockedDecision(category, `build_${buildingId}`, canBuild.reason ?? "unknown");
    }
    return false;
  }

  /**
   * Check if any building of the given type exists (active or pending).
   */
  private hasBuilding(buildingId: BuildingId): boolean {
    const buildings = this.api.buildings.snapshot();
    return (
      buildings.active.some((b) => b.definitionId === buildingId) ||
      buildings.pending.some((b) => b.definitionId === buildingId)
    );
  }

  /**
   * Main entry point - called each tick to make decisions.
   * Executes priority handlers in order until one takes action.
   */
  executeTick(): void {
    // First, ensure workers are assigned to buildings
    this.handleWorkerAssignment();

    // Execute priority handlers in order
    // Each returns true if it took an action, allowing for multiple actions per tick
    // but prioritizing survival/events over growth
    if (this.handleSurvival()) return;
    if (this.handleEventResolution()) return;
    if (this.handleMorale()) return;
    if (this.handleInfrastructure()) return;
    if (this.handleGrowth()) return;
    this.handleVictoryPush();
  }

  /**
   * Assign unassigned colonists to buildings with worker slots.
   * Prioritizes: 1) Farms for food production 2) Other production buildings
   * Tries to match colonist roles to building requirements.
   */
  private handleWorkerAssignment(): void {
    const buildings = this.api.buildings.snapshot();
    const colony = this.api.colony.snapshot({ lightweight: true });

    // Get buildings that need workers (active, have worker slots, not fully staffed)
    const needsWorkers = buildings.active.filter((b) => {
      const def = buildings.definitions.find((d) => d.id === b.definitionId);
      if (!def?.workerSlots) return false;
      return b.assignedWorkers.length < def.workerSlots;
    });

    if (needsWorkers.length === 0) return;

    // Sort buildings by priority: farms first (food production), then others
    needsWorkers.sort((a, b) => {
      const defA = buildings.definitions.find((d) => d.id === a.definitionId);
      const defB = buildings.definitions.find((d) => d.id === b.definitionId);
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
      const def = buildings.definitions.find((d) => d.id === building.definitionId);
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
    const currentOxygen = resources.current.oxygen;
    const currentWater = resources.current.water;
    const foodProduction = resources.production.food ?? 0;
    const foodConsumption = resources.consumption.food ?? 0;
    const oxygenProduction = resources.production.oxygen ?? 0;
    const oxygenConsumption = resources.consumption.oxygen ?? 0;
    const waterProduction = resources.production.water ?? 0;
    const waterConsumption = resources.consumption.water ?? 0;

    // Calculate oxygen contribution from buildings (not production)
    const oxygenContribution = buildings.totalOxygenContribution;

    // Handle water production early - needed for morale recovery
    if (this.handleWaterProduction(waterProduction, waterConsumption, currentWater)) {
      return true;
    }

    const foodFlow = foodProduction - foodConsumption;
    const oxygenFlow = oxygenProduction - oxygenConsumption;

    // Critical shortage: address the worse situation first
    // Both farms and hydroponic gardens contribute oxygen
    if (currentFood < 50 || currentOxygen < 80) {
      const foodCritical = currentFood < 50 || foodFlow < 0;
      const oxygenCritical = currentOxygen < 80 || oxygenFlow < 0;

      // Prioritize food slightly since farms also provide oxygen
      if (foodCritical && (!oxygenCritical || currentFood < currentOxygen)) {
        if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) return true;
      }

      // For oxygen, build oxygen generator (produces oxygen directly)
      // or hydroponic garden/farm as fallback
      if (oxygenCritical) {
        if (this.tryBuild(BuildingId.OXYGEN_GENERATOR, "survival", false)) return true;
        if (this.tryBuild(BuildingId.HYDROPONIC_GARDEN, "survival", false)) return true;
        if (this.tryBuild(BuildingId.BASIC_FARM, "survival", false)) return true;
      }
    }

    // Maintain positive flow with buffer for both resources
    // Food needs buffer of 2 (population growth)
    if (foodFlow < 2) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "survival")) return true;
    }

    // Oxygen needs positive flow for population growth
    // Note: oxygenContribution is from buildings, oxygenFlow is from production/consumption
    if (oxygenFlow < 3 || oxygenContribution < 6) {
      // Oxygen generator produces oxygen directly
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
    const waterSites = operations.sites.filter((s) => s.resourceType === "water");

    // Priority 1: Build water extractor on available developed deposit
    const developedAvailable = waterSites.find((s) => s.developed && !s.linkedBuildingId);
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
    const revealedUndeveloped = waterSites.find((s) => s.revealed && !s.developed);
    if (revealedUndeveloped) {
      const canDevelop = this.api.operations.canDevelopSite(revealedUndeveloped.id);
      if (canDevelop.allowed) {
        this.api.operations.developSite(revealedUndeveloped.id);
        return true;
      }
    }

    // Priority 3: Reveal an unrevealed water site
    const unrevealed = waterSites.find((s) => !s.revealed);
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
   */
  private selectBestEventChoice(choices: readonly Readonly<EventChoice>[]): Readonly<EventChoice> {
    // Score each choice and find the best one
    // Use reduce to avoid non-null assertions
    return choices.reduce((best, current) => {
      const currentScore = this.scoreEventChoice(current);
      const bestScore = this.scoreEventChoice(best);
      return currentScore > bestScore ? current : best;
    });
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
      score += resources.oxygen ?? 0;
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

    // Build solar panel if power production is insufficient
    const powerProduction = resources.production.power ?? 0;
    const powerConsumption = resources.consumption.power ?? 0;
    if (powerProduction < powerConsumption + 20) {
      if (this.tryBuild(BuildingId.SOLAR_PANEL, "infrastructure")) return true;
    }

    // Build mining station if materials are low (requires asteroid_mining tech)
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
    const oxygenSurplus = (resources.production.oxygen ?? 0) - (resources.consumption.oxygen ?? 0);
    const foodSurplus = (resources.production.food ?? 0) - (resources.consumption.food ?? 0);

    // Need at least 3 oxygen surplus before building habitat
    if (oxygenSurplus < 3) {
      if (this.tryBuild(BuildingId.HYDROPONIC_GARDEN, "growth", false)) return true;
    }

    // Need at least 2 food surplus before growing
    if (foodSurplus < 2) {
      if (this.tryBuild(BuildingId.BASIC_FARM, "growth", false)) return true;
    }

    // Build habitat to grow population
    if (this.tryBuild(BuildingId.HABITAT, "growth")) return true;

    return false;
  }

  /**
   * Priority 6 - Victory Push: Research generation ship when available.
   * @returns true if an action was taken
   */
  private handleVictoryPush(): boolean {
    // IF "generation_ship" available -> research it
    const canResearchGenShip = this.api.technology.canResearch(TechnologyId.GENERATION_SHIP);
    if (canResearchGenShip.allowed) {
      this.api.technology.startResearch(TechnologyId.GENERATION_SHIP);
      return true;
    } else {
      // Only record if generation ship is in the available list (prerequisites met)
      const techSnapshot = this.api.technology.snapshot();
      const genShipAvailable = techSnapshot.available.some(
        (t) => t.id === TechnologyId.GENERATION_SHIP,
      );
      if (genShipAvailable) {
        this.recordBlockedDecision(
          "victory",
          "research_generation_ship",
          canResearchGenShip.reason ?? "unknown",
        );
      }
    }

    return false;
  }
}
