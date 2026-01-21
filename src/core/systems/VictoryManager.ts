import type { GameEvent } from "../models/GameEvent";
import type { TechnologyTree } from "./TechnologyTree";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";

export type GameStatus = "playing" | "victory" | "defeat";

export interface VictoryState {
  status: GameStatus;
  reason?: string;
}

export class VictoryManager {
  private status: GameStatus = "playing";
  private reason: string = "";

  tick(technology: TechnologyTree, colony: ColonyManager, resources: ResourceManager): GameEvent[] {
    const events: GameEvent[] = [];

    if (this.status !== "playing") return events;

    // Victory conditions
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
  }

  toJSON() {
    return {
      status: this.status,
      reason: this.reason,
    };
  }

  static fromJSON(data: { status: GameStatus; reason: string }): VictoryManager {
    const manager = new VictoryManager();
    manager.status = data.status;
    manager.reason = data.reason;
    return manager;
  }
}
