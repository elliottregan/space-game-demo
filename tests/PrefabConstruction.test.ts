import { describe, expect, test } from "bun:test";
import { TechnologyId } from "../src/core/models/Technology";
import { TECHNOLOGIES } from "../src/core/data/technologies";

describe("Prefab Construction", () => {
  test("TechnologyId includes PREFAB_CONSTRUCTION", () => {
    expect(TechnologyId.PREFAB_CONSTRUCTION).toBe("prefab_construction");
  });

  test("TECHNOLOGIES includes Prefab Construction with correct properties", () => {
    const tech = TECHNOLOGIES.find((t) => t.id === TechnologyId.PREFAB_CONSTRUCTION);
    expect(tech).toBeDefined();
    expect(tech!.name).toBe("Prefab Construction");
    expect(tech!.cost.sols).toBe(45);
    expect(tech!.prerequisites).toEqual([TechnologyId.ADVANCED_MATERIALS]);
    expect(tech!.effects).toContainEqual({ type: "auto_housing" });
  });
});
