import { describe, expect, it } from "bun:test";
import { GameState } from "../src/core/GameState";
import { STARTING_CONDITIONS, StartingConditionId } from "../src/core/data/startingConditions";
import { BuildingId } from "../src/core/models/Building";

describe("StartingConditions", () => {
  it("should have a default condition with no pre-built buildings", () => {
    const defaultCondition = STARTING_CONDITIONS.find((c) => c.id === StartingConditionId.DEFAULT);
    expect(defaultCondition).toBeDefined();
    expect(defaultCondition!.preBuiltBuildings).toEqual([]);
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
    expect(state.buildings.getBuildingCount()).toBe(0);
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

    // Solar panel produces power
    expect(production.power).toBeGreaterThan(0);
    // Farms consume water and power
    expect(consumption.water).toBeGreaterThan(0);
  });
});
