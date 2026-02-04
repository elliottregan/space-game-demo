import { describe, expect, test } from "bun:test";
import { TechnologyId } from "../src/core/models/Technology";

describe("Prefab Construction", () => {
  test("TechnologyId includes PREFAB_CONSTRUCTION", () => {
    expect(TechnologyId.PREFAB_CONSTRUCTION).toBe("prefab_construction");
  });
});
