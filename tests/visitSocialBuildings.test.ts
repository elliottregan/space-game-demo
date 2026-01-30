// tests/visitSocialBuildings.test.ts
import { describe, it, expect } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { COLONIST_MORALE } from "../src/core/balance/MoraleBalance";
import { visitSocialBuildings } from "../src/core/tick/phases/colonistMorale";
import { createTickContext } from "../src/core/tick/TickContext";

describe("visitSocialBuildings phase", () => {
  function setupGameWithActiveBuilding(buildingId: BuildingId): GameState {
    const game = new GameState();
    // Give plenty of resources
    game.resources.add({ materials: 500, power: 500, food: 500, water: 500 });
    game.resources.addProduction({ food: 50, water: 50, power: 50, oxygen: 50 });

    // Build and complete the building
    game.buildings.startBuilding(buildingId, game.resources, game.technology);
    // Run enough ticks to complete construction (max 20 for most buildings)
    for (let i = 0; i < 20; i++) {
      game.tick();
    }
    return game;
  }

  it("colonist visiting social building gets morale boost", () => {
    const game = setupGameWithActiveBuilding(BuildingId.COMMON_ROOM);
    const moraleManager = game.getColonistMoraleManager();

    const commonRoom = game.buildings
      .getActiveBuildings()
      .find((b) => b.definitionId === BuildingId.COMMON_ROOM)!;
    expect(commonRoom).toBeDefined();
    expect(commonRoom.status).toBe("active");

    // Set colonist morale to a known value
    const colonist = game.colony.getColonists()[0]!;
    const initialMorale = 50;
    moraleManager.setMorale(colonist.id, initialMorale);
    colonist.socialBuildingIds = [commonRoom.id];

    // Execute just the visitSocialBuildings phase
    const ctx = createTickContext(
      game.currentSol,
      {
        resources: game.resources,
        buildings: game.buildings,
        colony: game.colony,
        workforce: game.workforce,
        colonistMorale: moraleManager,
        technology: game.technology,
        operations: game.operations,
        npcInfluence: game.npcInfluence,
        events: game.events,
        victory: game.victory,
      },
      { autoAssignNewColonists: false },
    );

    visitSocialBuildings.execute(ctx);

    const expectedBoost = 5 / COLONIST_MORALE.SOCIAL_BUILDING_BOOST_DIVISOR; // 0.5
    expect(moraleManager.getMorale(colonist.id)).toBe(initialMorale + expectedBoost);
  });

  it("multiple buildings stack", () => {
    const game = new GameState();
    game.resources.add({ materials: 500, power: 500 });
    game.resources.addProduction({ food: 50, water: 50, power: 50, oxygen: 50 });

    // Build both buildings
    game.buildings.startBuilding(BuildingId.COMMON_ROOM, game.resources, game.technology);
    game.buildings.startBuilding(BuildingId.GYMNASIUM, game.resources, game.technology);
    for (let i = 0; i < 20; i++) {
      game.tick();
    }

    const moraleManager = game.getColonistMoraleManager();
    const buildings = game.buildings.getActiveBuildings();
    const commonRoom = buildings.find((b) => b.definitionId === BuildingId.COMMON_ROOM)!;
    const gymnasium = buildings.find((b) => b.definitionId === BuildingId.GYMNASIUM)!;
    expect(commonRoom).toBeDefined();
    expect(gymnasium).toBeDefined();

    // Set colonist morale and assign to both buildings
    const colonist = game.colony.getColonists()[0]!;
    const initialMorale = 50;
    moraleManager.setMorale(colonist.id, initialMorale);
    colonist.socialBuildingIds = [commonRoom.id, gymnasium.id];

    // Execute just the visitSocialBuildings phase
    const ctx = createTickContext(
      game.currentSol,
      {
        resources: game.resources,
        buildings: game.buildings,
        colony: game.colony,
        workforce: game.workforce,
        colonistMorale: moraleManager,
        technology: game.technology,
        operations: game.operations,
        npcInfluence: game.npcInfluence,
        events: game.events,
        victory: game.victory,
      },
      { autoAssignNewColonists: false },
    );

    visitSocialBuildings.execute(ctx);

    const expectedBoost = (5 + 6) / COLONIST_MORALE.SOCIAL_BUILDING_BOOST_DIVISOR; // 1.1
    expect(moraleManager.getMorale(colonist.id)).toBe(initialMorale + expectedBoost);
  });

  it("inactive buildings give no boost", () => {
    const game = new GameState();
    game.resources.add({ materials: 100 });

    // Start but don't complete construction
    game.buildings.startBuilding(BuildingId.COMMON_ROOM, game.resources, game.technology);
    // Only run 1 tick - not enough to complete
    game.tick();

    const moraleManager = game.getColonistMoraleManager();
    const building = game.buildings.getBuildings()[0]!;
    expect(building.status).not.toBe("active");

    // Set colonist morale and assign to the incomplete building
    const colonist = game.colony.getColonists()[0]!;
    const initialMorale = 50;
    moraleManager.setMorale(colonist.id, initialMorale);
    colonist.socialBuildingIds = [building.id];

    // Execute just the visitSocialBuildings phase
    const ctx = createTickContext(
      game.currentSol,
      {
        resources: game.resources,
        buildings: game.buildings,
        colony: game.colony,
        workforce: game.workforce,
        colonistMorale: moraleManager,
        technology: game.technology,
        operations: game.operations,
        npcInfluence: game.npcInfluence,
        events: game.events,
        victory: game.victory,
      },
      { autoAssignNewColonists: false },
    );

    visitSocialBuildings.execute(ctx);

    // No boost from inactive building
    expect(moraleManager.getMorale(colonist.id)).toBe(initialMorale);
  });

  it("morale caps at 100", () => {
    const game = setupGameWithActiveBuilding(BuildingId.GYMNASIUM);
    const moraleManager = game.getColonistMoraleManager();

    const gymnasium = game.buildings
      .getActiveBuildings()
      .find((b) => b.definitionId === BuildingId.GYMNASIUM)!;

    // Set colonist morale very high
    const colonist = game.colony.getColonists()[0]!;
    moraleManager.setMorale(colonist.id, 99.8);
    colonist.socialBuildingIds = [gymnasium.id];

    // Execute just the visitSocialBuildings phase
    const ctx = createTickContext(
      game.currentSol,
      {
        resources: game.resources,
        buildings: game.buildings,
        colony: game.colony,
        workforce: game.workforce,
        colonistMorale: moraleManager,
        technology: game.technology,
        operations: game.operations,
        npcInfluence: game.npcInfluence,
        events: game.events,
        victory: game.victory,
      },
      { autoAssignNewColonists: false },
    );

    visitSocialBuildings.execute(ctx);

    // Morale should be capped at 100 (99.8 + 0.6 = 100.4 -> 100)
    expect(moraleManager.getMorale(colonist.id)).toBe(100);
  });

  it("colonist with no social buildings is unaffected", () => {
    const game = setupGameWithActiveBuilding(BuildingId.COMMON_ROOM);
    const moraleManager = game.getColonistMoraleManager();

    // Set colonist morale but don't assign to any social building
    const colonist = game.colony.getColonists()[0]!;
    const initialMorale = 50;
    moraleManager.setMorale(colonist.id, initialMorale);
    // colonist.socialBuildingIds is undefined/empty

    // Execute just the visitSocialBuildings phase
    const ctx = createTickContext(
      game.currentSol,
      {
        resources: game.resources,
        buildings: game.buildings,
        colony: game.colony,
        workforce: game.workforce,
        colonistMorale: moraleManager,
        technology: game.technology,
        operations: game.operations,
        npcInfluence: game.npcInfluence,
        events: game.events,
        victory: game.victory,
      },
      { autoAssignNewColonists: false },
    );

    visitSocialBuildings.execute(ctx);

    // No change to morale
    expect(moraleManager.getMorale(colonist.id)).toBe(initialMorale);
  });
});
