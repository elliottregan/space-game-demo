import { describe, expect, it } from "bun:test";
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
