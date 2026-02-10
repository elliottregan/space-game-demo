import type { GameEvent } from "../models/GameEvent";
import { ProjectId } from "../models/NPCInfluence";
import { BuildingId } from "../models/Building";
import { getProject, meetsAxisRequirements } from "../data/projects";
import { BUILDINGS } from "../data/buildings";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";
import type { IdeologyManager } from "./IdeologyManager";

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
   * Check if a passed project is a capstone.
   * Returns a milestone event if the project is a capstone, null otherwise.
   * NOTE: Capstones no longer trigger victory - they unlock megastructure buildings.
   * Victory is achieved by building the megastructure (checked in checkBuildingVictory).
   */
  checkCapstoneVictory(projectId: ProjectId): GameEvent | null {
    const project = getProject(projectId);
    if (!project?.isCapstone) {
      return null;
    }

    // Don't set victory status - capstones unlock megastructures but don't win the game
    return {
      type: "capstone_completed",
      reason: `${project.name} achieved! ${project.description}`,
      severity: "info",
      message: `${project.name} achieved! You can now build your faction's megastructure to win.`,
    };
  }

  /**
   * Check if any faction can propose any capstone project.
   * Returns information about proposable capstones.
   */
  checkCapstoneProposability(
    ideologyManager: IdeologyManager,
  ): {
    canProposeAny: boolean;
    proposableCapstones: Array<{
      projectId: ProjectId;
      factionId: string;
      factionName: string;
    }>;
  } {
    const factions = ideologyManager.getFactions();
    const councilCounts = ideologyManager.getCouncilFactionCounts();
    const totalCouncilSeats = ideologyManager.getCouncil().length;
    const proposableCapstones: Array<{
      projectId: ProjectId;
      factionId: string;
      factionName: string;
    }> = [];

    // Get all capstone projects
    const capstoneProjects = [
      ProjectId.DECLARATION_OF_SOVEREIGNTY,
      ProjectId.EARTH_RELIEF_COMPACT,
      ProjectId.DEEP_SPACE_MINING_CHARTER,
      ProjectId.GENESIS_VAULT,
    ];

    for (const projectId of capstoneProjects) {
      // Skip already completed capstones
      if (ideologyManager.isProjectCompleted(projectId)) {
        continue;
      }

      const project = getProject(projectId);
      if (!project?.isCapstone) {
        continue;
      }

      // Check if any faction meets the axis requirements
      for (const faction of factions) {
        // Check axis requirements
        if (!meetsAxisRequirements(faction.position, project)) {
          continue;
        }

        // Check council support
        const factionCouncilSeats = councilCounts[faction.baseId] ?? 0;
        const requiredSupport = project.requiredCouncilSupport ?? 0.5;
        const factionSupport = totalCouncilSeats > 0 ? factionCouncilSeats / totalCouncilSeats : 0;

        if (factionSupport < requiredSupport) {
          continue;
        }

        // Check prerequisites
        const prerequisites = project.prerequisites ?? [];
        const allPrereqsMet = prerequisites.every((prereq) =>
          ideologyManager.isProjectCompleted(prereq),
        );

        if (!allPrereqsMet) {
          continue;
        }

        // This faction can propose this capstone
        proposableCapstones.push({
          projectId,
          factionId: faction.id,
          factionName: faction.name,
        });
      }
    }

    return {
      canProposeAny: proposableCapstones.length > 0,
      proposableCapstones,
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
