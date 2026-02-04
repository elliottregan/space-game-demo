import { describe, expect, test } from "bun:test";
import { TechnologyId } from "../src/core/models/Technology";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import type { Building, BuildingStatus } from "../src/core/models/Building";

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

describe("Building Upgrade Model", () => {
  test("BuildingStatus includes upgrading", () => {
    const status: BuildingStatus = "upgrading";
    expect(status).toBe("upgrading");
  });

  test("Building interface accepts upgrade fields", () => {
    const building: Building = {
      id: "test_1",
      definitionId: BuildingId.HABITAT,
      status: "upgrading",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
      upgradeProgress: 5,
      upgradeTargetDefId: BuildingId.ADVANCED_HABITAT,
    };
    expect(building.upgradeProgress).toBe(5);
    expect(building.upgradeTargetDefId).toBe(BuildingId.ADVANCED_HABITAT);
  });
});
