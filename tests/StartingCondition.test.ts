import { describe, expect, it } from "bun:test";
import { GameState } from "../src/core/GameState";
import { STARTING_CONDITIONS, StartingConditionId } from "../src/core/data/startingConditions";
import { BuildingId } from "../src/core/models/Building";
import { GameAPI } from "../src/facade/GameAPI";

describe("StartingConditions", () => {
  it("should have a default condition with minimal life support buildings", () => {
    const defaultCondition = STARTING_CONDITIONS.find((c) => c.id === StartingConditionId.DEFAULT);
    expect(defaultCondition).toBeDefined();
    // Default: 2 solar panels, 1 farm, 1 water extractor, 1 basic mine
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.SOLAR_PANEL);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.BASIC_FARM);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.WATER_EXTRACTOR);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.BASIC_MINE);
    expect(defaultCondition!.preBuiltBuildings.length).toBe(5);
    expect(defaultCondition!.population).toBe(14);
  });

  it("should have an established base condition with pre-built buildings", () => {
    const established = STARTING_CONDITIONS.find(
      (c) => c.id === StartingConditionId.ESTABLISHED_BASE,
    );
    expect(established).toBeDefined();
    expect(established!.preBuiltBuildings).toContain(BuildingId.SOLAR_PANEL);
    expect(established!.preBuiltBuildings).toContain(BuildingId.BASIC_FARM);
  });

  it("should have unique IDs for all conditions", () => {
    const ids = STARTING_CONDITIONS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("GameState with StartingConditions", () => {
  it("should create default state when no condition specified", () => {
    const state = new GameState();
    expect(state.colony.getPopulation()).toBe(14);
    // Default now has 5 starting buildings (includes water extractor and basic mine)
    expect(state.buildings.getBuildingCount()).toBe(5);
  });

  it("should create state with pre-built buildings for established base", () => {
    const state = new GameState(StartingConditionId.ESTABLISHED_BASE);
    expect(state.colony.getPopulation()).toBe(14);
    // 1 solar + 2 farms = 3 buildings
    expect(state.buildings.getBuildingCount()).toBe(3);
    expect(state.buildings.getActiveBuildings().length).toBe(3);
  });

  it("should register production/consumption for pre-built buildings", () => {
    const state = new GameState(StartingConditionId.ESTABLISHED_BASE);
    const production = state.resources.getProduction();
    const consumption = state.resources.getConsumption();

    // Farms produce food
    expect(production.food).toBeGreaterThan(0);
    // Farms consume water
    expect(consumption.water).toBeGreaterThan(0);
    // Power is now a grid metric, not a stockpiled resource
  });
});

describe("GameAPI with StartingConditions", () => {
  it("should start new game with default condition", () => {
    const api = new GameAPI();
    api.newGame();
    expect(api.colony.snapshot().population).toBe(14);
    // Default now has 5 starting buildings (includes water extractor and basic mine)
    expect(api.buildings.snapshot().active.length).toBe(5);
  });

  it("should start new game with specified condition", () => {
    const api = new GameAPI();
    api.newGame(StartingConditionId.ESTABLISHED_BASE);
    expect(api.colony.snapshot().population).toBe(14);
    expect(api.buildings.snapshot().active.length).toBe(3);
  });
});

describe("GameAPI Starting Conditions Query", () => {
  it("should return all available starting conditions", () => {
    const api = new GameAPI();
    const conditions = api.game.getStartingConditions();
    expect(conditions.length).toBeGreaterThanOrEqual(2);
    expect(conditions.find((c) => c.id === StartingConditionId.DEFAULT)).toBeDefined();
    expect(conditions.find((c) => c.id === StartingConditionId.ESTABLISHED_BASE)).toBeDefined();
  });
});
