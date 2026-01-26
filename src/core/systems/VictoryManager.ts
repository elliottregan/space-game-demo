import type { GameEvent } from "../models/GameEvent";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";

export type GameStatus = "playing" | "victory" | "defeat";

export interface VictoryState {
  status: GameStatus;
  reason?: string;
}

/**
 * Colony Charter victory requirements.
 * Target: ~500-800 sols for a challenging victory path.
 *
 * Balance rationale:
 * - Population 30: Requires 3x starting population, forcing infrastructure scaling
 * - Morale 60: Achievable once water production is established
 * - 200 sustained sols: Stability window after techs complete (reduced from 300)
 * - 3 techs: hydroponics (60) + water_recycling (45) + advanced_materials (75) = 180 sols
 *
 * Expected timeline: ~180 (tech) + growth to 30 pop + ~200 (sustained) = ~500-800 sols
 *
 * Note: Population growth requires pop >= 20, health > 80, morale > 60 with 0.5% chance/sol.
 * Immigration events can accelerate growth with political tradeoffs.
 */
export const COLONY_CHARTER_REQUIREMENTS = {
  minPopulation: 30,
  minMorale: 60,
  sustainedSols: 200,
  requiredTechs: ["hydroponics", "water_recycling", "advanced_materials"],
};

export class VictoryManager {
  private status: GameStatus = "playing";
  private reason: string = "";
  private colonyCharterProgress: number = 0;

  tick(technology: TechnologyTree, colony: ColonyManager, resources: ResourceManager): GameEvent[] {
    const events: GameEvent[] = [];

    if (this.status !== "playing") return events;

    // Victory conditions

    // Colony Charter - faster victory path (~500 sols)
    const charterReqs = COLONY_CHARTER_REQUIREMENTS;
    const hasRequiredTechs = charterReqs.requiredTechs.every((techId) =>
      technology.isResearched(techId),
    );
    const meetsPopulation = colony.getPopulation() >= charterReqs.minPopulation;
    const meetsMorale = colony.getMorale() >= charterReqs.minMorale;

    if (hasRequiredTechs && meetsPopulation && meetsMorale) {
      this.colonyCharterProgress++;
      if (this.colonyCharterProgress >= charterReqs.sustainedSols) {
        this.status = "victory";
        this.reason =
          "Colony Charter achieved! Your colony has been officially recognized as self-sustaining!";
        events.push({
          type: "VICTORY",
          reason: this.reason,
          severity: "info",
          message: this.reason,
        });
        return events;
      }
    } else {
      // Reset progress if conditions not met
      this.colonyCharterProgress = 0;
    }

    // Generation Ship - extended victory path (~2900 sols)
    if (technology.isResearched("generation_ship")) {
      this.status = "victory";
      this.reason = "Generation Ship completed! Humanity can now reach the stars!";
      events.push({
        type: "VICTORY",
        reason: this.reason,
        severity: "info",
        message: this.reason,
      });
      return events;
    }

    if (colony.getPopulation() >= 100) {
      this.status = "victory";
      this.reason = "Colony has reached 100 population! Mars is thriving!";
      events.push({
        type: "VICTORY",
        reason: this.reason,
        severity: "info",
        message: this.reason,
      });
      return events;
    }

    // Defeat conditions
    if (colony.getPopulation() < 5) {
      this.status = "defeat";
      this.reason = "Colony population dropped below 5. The colony has failed.";
      events.push({
        type: "DEFEAT",
        reason: this.reason,
        severity: "critical",
        message: this.reason,
      });
      return events;
    }

    const resourceState = resources.getResources();
    if (resourceState.food === 0 || resourceState.oxygen === 0) {
      this.status = "defeat";
      this.reason =
        resourceState.food === 0
          ? "Food supplies depleted. The colony has starved."
          : "Oxygen supplies depleted. The colony has suffocated.";
      events.push({
        type: "DEFEAT",
        reason: this.reason,
        severity: "critical",
        message: this.reason,
      });
      return events;
    }

    return events;
  }

  getState(): VictoryState {
    return {
      status: this.status,
      reason: this.reason || undefined,
    };
  }

  isGameOver(): boolean {
    return this.status !== "playing";
  }

  reset(): void {
    this.status = "playing";
    this.reason = "";
    this.colonyCharterProgress = 0;
  }

  getColonyCharterProgress(): number {
    return this.colonyCharterProgress;
  }

  toJSON() {
    return {
      status: this.status,
      reason: this.reason,
      colonyCharterProgress: this.colonyCharterProgress,
    };
  }

  static fromJSON(data: {
    status: GameStatus;
    reason: string;
    colonyCharterProgress?: number;
  }): VictoryManager {
    const manager = new VictoryManager();
    manager.status = data.status;
    manager.reason = data.reason;
    manager.colonyCharterProgress = data.colonyCharterProgress ?? 0;
    return manager;
  }
}
