import type { GameEvent } from "../models/GameEvent";
import { BuildingId } from "../models/Building";
import { DistrictGrantId, type DistrictGrantTemplate } from "../models/DistrictGrant";
import { getDistrictGrantTemplate, getCapstoneGrants } from "../data/districtGrants";
import { BUILDINGS } from "../data/buildings";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";
import type { DistrictGrantManager } from "./DistrictGrantManager";

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
   * Check if a completed grant is a capstone.
   * Returns a milestone event if the grant is a capstone, null otherwise.
   * NOTE: Capstones unlock megastructure buildings but don't win the game.
   * Victory is achieved by building the megastructure (checked in checkBuildingVictory).
   */
  checkCapstoneGrant(grantId: DistrictGrantId): GameEvent | null {
    const template = getDistrictGrantTemplate(grantId);
    if (!template?.isCapstone) {
      return null;
    }

    return {
      type: "capstone_completed",
      reason: `${template.name} achieved! ${template.description}`,
      severity: "info",
      message: `${template.name} achieved! You can now build your faction's megastructure to win.`,
    };
  }

  /**
   * Check which capstone grants are available to be assigned.
   * A capstone is available when its prerequisites are completed
   * and the colony has sufficient axis progress.
   */
  checkCapstoneAvailability(grantManager: DistrictGrantManager): {
    availableCapstones: DistrictGrantId[];
  } {
    const capstones = getCapstoneGrants();
    const availableCapstones: DistrictGrantId[] = [];

    for (const capstone of capstones) {
      if (grantManager.isGrantCompleted(capstone.id)) {
        continue;
      }

      if (grantManager.isCapstoneUnlocked(capstone.id)) {
        availableCapstones.push(capstone.id);
      }
    }

    return { availableCapstones };
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

  /**
   * Mark game as defeat due to Earth collapse.
   * Called when Earth crisis reaches point of no return.
   */
  markEarthCollapse(): GameEvent | null {
    if (this.status !== "playing") return null;

    this.status = "defeat";
    this.reason =
      "Earth's climate has collapsed. The colony survives, but victory is no longer possible.";

    return {
      type: "DEFEAT",
      reason: this.reason,
      severity: "critical",
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
