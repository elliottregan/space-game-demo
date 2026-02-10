import { describe, it, expect, beforeEach, spyOn } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import type { ColonistMoraleManager } from "../src/core/systems/ColonistMoraleManager";

describe("Recreation Buildings", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  it("should calculate total morale boost from active recreation buildings", () => {
    // Build a common room (moraleBoost: 5)
    gameState.buildings.startBuilding(
      BuildingId.COMMON_ROOM,
      gameState.resources,
      gameState.technology,
    );

    // Fast-forward construction (10 sols)
    for (let i = 0; i < 10; i++) {
      gameState.tick();
    }

    // Verify building is active
    const buildings = gameState.buildings.getActiveBuildings();
    const commonRoom = buildings.find((b) => b.definitionId === BuildingId.COMMON_ROOM);
    expect(commonRoom).toBeDefined();
    expect(commonRoom?.status).toBe("active");

    // Get total morale boost
    const totalBoost = gameState.buildings.getTotalMoraleBoost();
    expect(totalBoost).toBe(5);
  });

  it("should not include morale boost from broken buildings", () => {
    // Build a common room
    gameState.buildings.startBuilding(
      BuildingId.COMMON_ROOM,
      gameState.resources,
      gameState.technology,
    );

    // Fast-forward construction
    for (let i = 0; i < 10; i++) {
      gameState.tick();
    }

    // Break the building
    const buildings = gameState.buildings.getActiveBuildings();
    const commonRoom = buildings.find((b) => b.definitionId === BuildingId.COMMON_ROOM);
    if (commonRoom) {
      gameState.buildings.breakBuilding(commonRoom.id, gameState.resources);
    }

    // Morale boost should be 0
    const totalBoost = gameState.buildings.getTotalMoraleBoost();
    expect(totalBoost).toBe(0);
  });

  it("should sum morale boost from multiple recreation buildings", () => {
    // Give enough materials
    gameState.resources.add({ materials: 500 });

    // Build common room (5) and gymnasium (6)
    gameState.buildings.startBuilding(
      BuildingId.COMMON_ROOM,
      gameState.resources,
      gameState.technology,
    );
    gameState.buildings.startBuilding(
      BuildingId.GYMNASIUM,
      gameState.resources,
      gameState.technology,
    );

    // Fast-forward construction (12 sols for gymnasium)
    for (let i = 0; i < 12; i++) {
      gameState.tick();
    }

    const totalBoost = gameState.buildings.getTotalMoraleBoost();
    expect(totalBoost).toBe(11); // 5 + 6
  });

  it("should apply morale boost during colony tick", () => {
    // Mock colonist morale system to isolate recreation building morale boost from social network effects.
    // This prevents the test from being flaky due to centrality calculations and neighbor influences.
    //
    // The morale flow is:
    // 1. processColonyTick applies recreation boost via applyPositiveConditionEffects
    // 2. propagateColonistMorale overwrites colony morale with getColonyMorale() result
    //
    // We mock both propagateMorale (to skip network propagation) and getColonyMorale
    // (to return current colony morale instead of recalculating from individuals).
    const mockPropagateMorale = spyOn(
      gameState.colonistMorale as ColonistMoraleManager,
      "propagateMorale",
    ).mockImplementation(() => {
      // No-op: skip social propagation
    });

    const mockGetColonyMorale = spyOn(
      gameState.colonistMorale as ColonistMoraleManager,
      "getColonyMorale",
    ).mockImplementation(() => {
      // Return current colony morale to prevent overwriting the recreation boost
      return gameState.colony.getMorale();
    });

    // Add sustainable production to offset starting building consumption
    gameState.resources.addProduction({ food: 100, water: 100 });

    // Build extra habitat to push life support capacity above comfortable threshold
    gameState.resources.add({ materials: 200 });
    gameState.buildings.startBuilding(
      BuildingId.BASIC_FARM,
      gameState.resources,
      gameState.technology,
    );

    // Lower morale to see the effect
    gameState.colony.setMorale(50);

    // Build a common room
    gameState.buildings.startBuilding(
      BuildingId.COMMON_ROOM,
      gameState.resources,
      gameState.technology,
    );

    // Fast-forward construction (10 sols for habitat)
    for (let i = 0; i < 12; i++) {
      gameState.tick();
    }

    // Record morale before additional ticks
    const moraleBefore = gameState.colony.getMorale();

    // Tick a few times with positive net flow to see morale boost
    for (let i = 0; i < 5; i++) {
      gameState.tick();
    }

    const moraleAfter = gameState.colony.getMorale();

    // Morale should have increased (base recovery + morale boost)
    expect(moraleAfter).toBeGreaterThan(moraleBefore);

    // Restore the original implementations
    mockPropagateMorale.mockRestore();
    mockGetColonyMorale.mockRestore();
  });
});
