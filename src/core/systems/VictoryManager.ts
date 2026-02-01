import type { GameEvent } from "../models/GameEvent";
import { ProjectId } from "../models/NPCInfluence";
import { BuildingId } from "../models/Building";
import { getProject } from "../data/projects";
import { BUILDINGS } from "../data/buildings";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";

export type GameStatus = "playing" | "victory" | "defeat";

export interface VictoryState {
  status: GameStatus;
  reason?: string;
}

export class VictoryManager {
  private status: GameStatus = "playing";
  private reason: string = "";

  tick(
    _technology: TechnologyTree,
    colony: ColonyManager,
    resources: ResourceManager,
  ): GameEvent[] {
    const events: GameEvent[] = [];

    if (this.status !== "playing") return events;

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
    if (resourceState.food === 0) {
      this.status = "defeat";
      this.reason = "Food supplies depleted. The colony has starved.";
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

  /**
   * Check if a passed project triggers a capstone victory.
   * Returns a victory event if the project is a capstone, null otherwise.
   */
  checkCapstoneVictory(projectId: ProjectId): GameEvent | null {
    const project = getProject(projectId);
    if (!project?.isCapstone) {
      return null;
    }

    this.status = "victory";
    this.reason = `${project.name} achieved! ${project.description}`;

    return {
      type: "VICTORY",
      reason: this.reason,
      severity: "info",
      message: this.reason,
    };
  }

  /**
   * Check if a completed building triggers victory.
   * Returns a victory event if the building is a victory building, null otherwise.
   */
  checkBuildingVictory(buildingId: BuildingId): GameEvent | null {
    const def = BUILDINGS.find((b) => b.id === buildingId);
    if (!def?.isVictoryBuilding) {
      return null;
    }

    this.status = "victory";
    this.reason = `${def.name} completed! ${def.description}`;

    return {
      type: "VICTORY",
      reason: this.reason,
      severity: "info",
      message: this.reason,
    };
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
