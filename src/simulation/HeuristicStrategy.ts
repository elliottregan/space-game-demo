// src/simulation/HeuristicStrategy.ts
// Decision-making logic for Monte Carlo playtest simulation

import type { GameAPI } from "../facade/GameAPI";
import type { EventChoice } from "../core/models/GameEvent";

/**
 * HeuristicStrategy simulates a "competent player" making reasonable decisions.
 * Called by SimulationRunner each game tick to make decisions before advancing the sol.
 *
 * Priorities (in order):
 * 1. Survival - Ensure food and oxygen are maintained
 * 2. Event Resolution - Handle active events
 * 3. Infrastructure - Research, power, materials
 * 4. Growth - Expand population when stable
 * 5. Victory Push - Research generation ship when available
 */
export class HeuristicStrategy {
  constructor(private api: GameAPI) {}

  /**
   * Main entry point - called each tick to make decisions.
   * Executes priority handlers in order until one takes action.
   */
  executeTick(): void {
    // Execute priority handlers in order
    // Each returns true if it took an action, allowing for multiple actions per tick
    // but prioritizing survival/events over growth
    if (this.handleSurvival()) return;
    if (this.handleEventResolution()) return;
    if (this.handleInfrastructure()) return;
    if (this.handleGrowth()) return;
    this.handleVictoryPush();
  }

  /**
   * Priority 1 - Survival: Ensure food and oxygen are maintained.
   * @returns true if an action was taken
   */
  private handleSurvival(): boolean {
    const resources = this.api.resources.snapshot();
    const buildings = this.api.buildings.snapshot();
    const currentFood = resources.current.food;
    const currentOxygen = resources.current.oxygen;
    const foodProduction = resources.production.food ?? 0;
    const foodConsumption = resources.consumption.food ?? 0;
    const oxygenProduction = resources.production.oxygen ?? 0;
    const oxygenConsumption = resources.consumption.oxygen ?? 0;

    // Early game: Build oxygen generator first if we don't have one
    const hasOxygenGenerator = buildings.active.some(b => b.definitionId === "oxygen_generator") ||
                               buildings.pending.some(b => b.definitionId === "oxygen_generator");
    if (!hasOxygenGenerator) {
      const canBuildOxygenGen = this.api.buildings.canBuild("oxygen_generator");
      if (canBuildOxygenGen.allowed) {
        this.api.buildings.build("oxygen_generator");
        return true;
      }
    }

    // IF food < 50 AND can build "basic_farm" -> build farm
    if (currentFood < 50) {
      const canBuildFarm = this.api.buildings.canBuild("basic_farm");
      if (canBuildFarm.allowed) {
        this.api.buildings.build("basic_farm");
        return true;
      }
    }

    // IF oxygen < 50 AND can build "oxygen_generator" -> build oxygen generator
    if (currentOxygen < 50) {
      const canBuildOxygenGen = this.api.buildings.canBuild("oxygen_generator");
      if (canBuildOxygenGen.allowed) {
        this.api.buildings.build("oxygen_generator");
        return true;
      }
    }

    // IF food production <= consumption -> build farm
    if (foodProduction <= foodConsumption) {
      const canBuildFarm = this.api.buildings.canBuild("basic_farm");
      if (canBuildFarm.allowed) {
        this.api.buildings.build("basic_farm");
        return true;
      }
    }

    // IF oxygen production <= consumption -> build oxygen generator
    if (oxygenProduction <= oxygenConsumption) {
      const canBuildOxygenGen = this.api.buildings.canBuild("oxygen_generator");
      if (canBuildOxygenGen.allowed) {
        this.api.buildings.build("oxygen_generator");
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
    return true;
  }

  /**
   * Select the best event choice based on heuristics.
   */
  private selectBestEventChoice(
    choices: readonly Readonly<EventChoice>[]
  ): Readonly<EventChoice> {
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
   * Priority 3 - Infrastructure: Research, power, materials.
   * @returns true if an action was taken
   */
  private handleInfrastructure(): boolean {
    const techSnapshot = this.api.technology.snapshot();
    const resources = this.api.resources.snapshot();

    // IF no research active AND can afford any tech -> start cheapest available
    if (!techSnapshot.currentResearch) {
      const availableTechs = techSnapshot.available;
      if (availableTechs.length > 0) {
        // Find cheapest tech we can research
        const affordableTechs = availableTechs.filter((tech) => {
          const canResearch = this.api.technology.canResearch(tech.id);
          return canResearch.allowed;
        });

        if (affordableTechs.length > 0) {
          // Sort by sol cost (cheapest first)
          affordableTechs.sort((a, b) => a.cost.sols - b.cost.sols);
          const cheapest = affordableTechs[0];
          if (cheapest) {
            this.api.technology.startResearch(cheapest.id);
            return true;
          }
        }
      }
    }

    // IF power production < consumption + 20 -> build solar panel
    const powerProduction = resources.production.power ?? 0;
    const powerConsumption = resources.consumption.power ?? 0;
    if (powerProduction < powerConsumption + 20) {
      const canBuildSolar = this.api.buildings.canBuild("solar_panel");
      if (canBuildSolar.allowed) {
        this.api.buildings.build("solar_panel");
        return true;
      }
    }

    // IF materials < 100 AND can build mine -> build mine
    // Note: "basic_farm" is the food producer, and there's no basic "mine"
    // Looking at buildings.ts, mining_station requires asteroid_mining tech
    // For early game, we don't have a basic mine. Skip this rule if no basic mine exists.
    // The spec says "mine" but the closest is "mining_station" which requires tech.
    const currentMaterials = resources.current.materials;
    if (currentMaterials < 100) {
      // Try mining_station if available (requires asteroid_mining tech)
      const canBuildMine = this.api.buildings.canBuild("mining_station");
      if (canBuildMine.allowed) {
        this.api.buildings.build("mining_station");
        return true;
      }
    }

    return false;
  }

  /**
   * Priority 4 - Growth: Expand population when stable.
   * @returns true if an action was taken
   */
  private handleGrowth(): boolean {
    const colony = this.api.colony.snapshot();

    // IF population < 100 AND morale > 60 AND can build habitat -> build habitat
    if (colony.population < 100 && colony.morale > 60) {
      const canBuildHabitat = this.api.buildings.canBuild("habitat");
      if (canBuildHabitat.allowed) {
        this.api.buildings.build("habitat");
        return true;
      }
    }

    return false;
  }

  /**
   * Priority 5 - Victory Push: Research generation ship when available.
   * @returns true if an action was taken
   */
  private handleVictoryPush(): boolean {
    // IF "generation_ship" available -> research it
    const canResearchGenShip = this.api.technology.canResearch("generation_ship");
    if (canResearchGenShip.allowed) {
      this.api.technology.startResearch("generation_ship");
      return true;
    }

    return false;
  }
}
