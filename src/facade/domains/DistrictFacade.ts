import type { GameState } from "../../core/GameState";
import type { DistrictSnapshot } from "../types/district";

/**
 * Provides district snapshot data for the UI.
 * Currently synthesizes a single "Colony" district containing all active buildings,
 * since the core DistrictManager hasn't been implemented yet.
 */
export class DistrictFacade {
  constructor(private gameState: GameState) {}

  snapshot(): DistrictSnapshot {
    const buildings = this.gameState.buildings.getBuildings();
    const activeIds = buildings
      .filter((b) => b.status === "active" || b.status === "pending")
      .map((b) => b.id);

    return {
      districts: [
        {
          id: "colony",
          name: "Colony",
          buildingCount: activeIds.length,
          buildingIds: activeIds,
        },
      ],
    };
  }
}
