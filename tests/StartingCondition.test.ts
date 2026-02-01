import { describe, expect, it } from "bun:test";
import { GameState } from "../src/core/GameState";
import { STARTING_CONDITIONS, StartingConditionId } from "../src/core/data/startingConditions";
import { BuildingId } from "../src/core/models/Building";
import { GameAPI } from "../src/facade/GameAPI";

describe("StartingConditions", () => {
  it("should have a default condition with minimal life support buildings", () => {
    const defaultCondition = STARTING_CONDITIONS.find((c) => c.id === StartingConditionId.DEFAULT);
    expect(defaultCondition).toBeDefined();
    // Default has minimal life support: 2 solar panels, 1 habitat, 1 farm, 1 oxygen generator, 1 water extractor
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.SOLAR_PANEL);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.HABITAT);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.BASIC_FARM);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.OXYGEN_GENERATOR);
    expect(defaultCondition!.preBuiltBuildings).toContain(BuildingId.WATER_EXTRACTOR);
    expect(defaultCondition!.preBuiltBuildings.length).toBe(6);
    expect(defaultCondition!.population).toBe(14);
  });

  it("should have an established base condition with pre-built buildings", () => {
    const established = STARTING_CONDITIONS.find(
      (c) => c.id === StartingConditionId.ESTABLISHED_BASE,
    );
    expect(established).toBeDefined();
    expect(established!.preBuiltBuildings).toContain(BuildingId.HABITAT);
    expect(established!.preBuiltBuildings).toContain(BuildingId.SOLAR_PANEL);
    expect(established!.preBuiltBuildings).toContain(BuildingId.BASIC_FARM);
    expect(established!.preBuiltBuildings).toContain(BuildingId.OXYGEN_GENERATOR);
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
    // Default now has 6 starting buildings (includes water extractor)
    expect(state.buildings.getBuildingCount()).toBe(6);
  });

  it("should create state with pre-built buildings for established base", () => {
    const state = new GameState(StartingConditionId.ESTABLISHED_BASE);
    expect(state.colony.getPopulation()).toBe(14);
    // 2 habitats + 1 solar + 2 farms + 2 oxygen generators = 7 buildings
    expect(state.buildings.getBuildingCount()).toBe(7);
    expect(state.buildings.getActiveBuildings().length).toBe(7);
  });

  it("should register production/consumption for pre-built buildings", () => {
    const state = new GameState(StartingConditionId.ESTABLISHED_BASE);
    const production = state.resources.getProduction();
    const consumption = state.resources.getConsumption();

    // Farms produce food
    expect(production.food).toBeGreaterThan(0);
    // Farms and oxygen generators consume water
    expect(consumption.water).toBeGreaterThan(0);
    // Power is now a grid metric, not a stockpiled resource
  });
});

describe("GameAPI with StartingConditions", () => {
  it("should start new game with default condition", () => {
    const api = new GameAPI();
    api.newGame();
    expect(api.colony.snapshot().population).toBe(14);
    // Default now has 6 starting buildings (includes water extractor)
    expect(api.buildings.snapshot().active.length).toBe(6);
  });

  it("should start new game with specified condition", () => {
    const api = new GameAPI();
    api.newGame(StartingConditionId.ESTABLISHED_BASE);
    expect(api.colony.snapshot().population).toBe(14);
    expect(api.buildings.snapshot().active.length).toBe(7);
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
