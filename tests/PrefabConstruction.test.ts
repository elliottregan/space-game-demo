import { describe, expect, test } from "bun:test";
import { TechnologyId } from "../src/core/models/Technology";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import type { Building, BuildingStatus } from "../src/core/models/Building";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { BUILDINGS } from "../src/core/data/buildings";

describe("Prefab Construction", () => {
  test("TechnologyId includes PREFAB_CONSTRUCTION", () => {
    expect(TechnologyId.PREFAB_CONSTRUCTION).toBe(TechnologyId.PREFAB_CONSTRUCTION);
  });

  test("TECHNOLOGIES includes Prefab Construction with correct properties", () => {
    const tech = TECHNOLOGIES.find((t) => t.id === TechnologyId.PREFAB_CONSTRUCTION);
    expect(tech).toBeDefined();
    expect(tech!.name).toBe("Prefab Construction");
    expect(tech!.cost.sols).toBe(45);
    expect(tech!.prerequisites).toEqual([TechnologyId.HABITAT_FABRICATION]);
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
      definitionId: BuildingId.SCIENCE_STATION,
      status: "upgrading",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
      upgradeProgress: 5,
      upgradeTargetDefId: BuildingId.RESEARCH_LAB,
    };
    expect(building.upgradeProgress).toBe(5);
    expect(building.upgradeTargetDefId).toBe(BuildingId.RESEARCH_LAB);
  });
});

describe("Science Station Upgrade", () => {
  test("getUpgradeCost returns 90 materials for Science Station", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const cost = buildings.getUpgradeCost(BuildingId.SCIENCE_STATION);
    expect(cost).toEqual({ materials: 90 });
  });

  test("getUpgradeTime returns 10 sols for Science Station", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const time = buildings.getUpgradeTime(BuildingId.SCIENCE_STATION);
    expect(time).toBe(10);
  });

  test("getUpgradeRequiredTech returns HABITAT_FABRICATION for Science Station", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const tech = buildings.getUpgradeRequiredTech(BuildingId.SCIENCE_STATION);
    expect(tech).toBe(TechnologyId.HABITAT_FABRICATION);
  });

  test("canUpgradeHabitat returns false without required tech", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 200 });
    const tech = new TechnologyTree(TECHNOLOGIES);

    buildings.setTechnologyTree(tech);

    const station = buildings.addBuilding({
      definitionId: BuildingId.SCIENCE_STATION,
      status: "active",
      constructionProgress: 12,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    // Without HABITAT_FABRICATION researched, should not be able to upgrade
    expect(buildings.canUpgradeHabitat(station.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns true with required tech and resources", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 200 });
    const tech = new TechnologyTree(TECHNOLOGIES);

    // Research the required tech
    tech.completeResearch(TechnologyId.HABITAT_FABRICATION);
    tech.completeResearch(TechnologyId.HABITAT_FABRICATION);

    buildings.setTechnologyTree(tech);

    const station = buildings.addBuilding({
      definitionId: BuildingId.SCIENCE_STATION,
      status: "active",
      constructionProgress: 12,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(station.id, resources)).toBe(true);
  });

  test("startUpgrade works for Science Station with required tech", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 200 });
    const tech = new TechnologyTree(TECHNOLOGIES);

    tech.completeResearch(TechnologyId.HABITAT_FABRICATION);
    tech.completeResearch(TechnologyId.HABITAT_FABRICATION);
    buildings.setTechnologyTree(tech);

    const station = buildings.addBuilding({
      definitionId: BuildingId.SCIENCE_STATION,
      status: "active",
      constructionProgress: 12,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    const result = buildings.startUpgrade(station.id, resources);

    expect(result).toBe(true);
    expect(resources.getResources().materials).toBe(110); // 200 - 90
    const updated = buildings.getBuilding(station.id);
    expect(updated?.status).toBe("upgrading");
    expect(updated?.upgradeProgress).toBe(0);
    expect(updated?.upgradeTargetDefId).toBe(BuildingId.RESEARCH_LAB);
  });

  test("Science Station upgrade completes after 10 sols", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 200 });
    const tech = new TechnologyTree(TECHNOLOGIES);

    tech.completeResearch(TechnologyId.HABITAT_FABRICATION);
    tech.completeResearch(TechnologyId.HABITAT_FABRICATION);
    buildings.setTechnologyTree(tech);

    const station = buildings.addBuilding({
      definitionId: BuildingId.SCIENCE_STATION,
      status: "active",
      constructionProgress: 12,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    buildings.startUpgrade(station.id, resources);

    // Tick 9 times - should still be upgrading
    for (let i = 0; i < 9; i++) {
      buildings.tick(resources);
    }
    expect(buildings.getBuilding(station.id)?.status).toBe("upgrading");
    expect(buildings.getBuilding(station.id)?.upgradeProgress).toBe(9);

    // Tick once more - should complete
    const events = buildings.tick(resources);
    const updated = buildings.getBuilding(station.id);

    expect(updated?.status).toBe("active");
    expect(updated?.definitionId).toBe(BuildingId.RESEARCH_LAB);
    expect(updated?.upgradeProgress).toBeUndefined();
    expect(updated?.upgradeTargetDefId).toBeUndefined();

    const completeEvent = events.find((e) => e.type === "BUILDING_UPGRADE_COMPLETE");
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.buildingName).toBe("Research Lab");
  });
});
