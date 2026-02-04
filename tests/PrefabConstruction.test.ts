import { describe, expect, test } from "bun:test";
import { TechnologyId } from "../src/core/models/Technology";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import type { Building, BuildingStatus } from "../src/core/models/Building";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { BUILDINGS } from "../src/core/data/buildings";
import { GameState } from "../src/core/GameState";

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

describe("Auto-Housing", () => {
  test("checkAutoHousing returns empty when tech not researched", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100, food: 0, water: 0 });
    const technology = new TechnologyTree(TECHNOLOGIES);

    const events = buildings.checkAutoHousing(resources, technology, 5, 6);
    expect(events).toEqual([]);
  });

  test("checkAutoHousing returns empty when below 85% capacity", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100, food: 0, water: 0 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // 4 population, 6 capacity = 67% (below 85%)
    const events = buildings.checkAutoHousing(resources, technology, 4, 6);
    expect(events).toEqual([]);
  });

  test("checkAutoHousing starts habitat when at 85% capacity", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100, food: 0, water: 0 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // 6 population, 7 capacity = 86% (above 85%)
    const events = buildings.checkAutoHousing(resources, technology, 6, 7);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("AUTO_HOUSING_STARTED");
    expect(resources.getResources().materials).toBe(50); // 100 - 50 cost
    expect(buildings.getPendingBuildings().length).toBe(1);
    expect(buildings.getPendingBuildings()[0].definitionId).toBe(BuildingId.HABITAT);
  });

  test("checkAutoHousing does not build when habitat already pending", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 200, food: 0, water: 0 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // First auto-build
    buildings.checkAutoHousing(resources, technology, 6, 7);
    expect(buildings.getPendingBuildings().length).toBe(1);

    // Second attempt should not build another
    const events = buildings.checkAutoHousing(resources, technology, 6, 7);
    expect(events).toEqual([]);
    expect(buildings.getPendingBuildings().length).toBe(1);
  });

  test("checkAutoHousing emits blocked event when insufficient materials", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 30, food: 0, water: 0 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    const events = buildings.checkAutoHousing(resources, technology, 6, 7);

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("AUTO_HOUSING_BLOCKED");
    expect(events[0].severity).toBe("warning");
  });
});

describe("Habitat Upgrade", () => {
  test("canUpgradeHabitat returns false for non-habitat buildings", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 200 });

    const farm = buildings.addBuilding({
      definitionId: BuildingId.BASIC_FARM,
      status: "active",
      constructionProgress: 12,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(farm.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns false for pending habitat", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 200 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "pending",
      constructionProgress: 5,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(habitat.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns false when insufficient materials", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 50 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(habitat.id, resources)).toBe(false);
  });

  test("canUpgradeHabitat returns true for active habitat with materials", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    expect(buildings.canUpgradeHabitat(habitat.id, resources)).toBe(true);
  });

  test("startUpgrade deducts materials and sets upgrading status", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 100 });

    const habitat = buildings.addBuilding({
      definitionId: BuildingId.HABITAT,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    const result = buildings.startUpgrade(habitat.id, resources);

    expect(result).toBe(true);
    expect(resources.getResources().materials).toBe(30); // 100 - 70
    const updated = buildings.getBuilding(habitat.id);
    expect(updated?.status).toBe("upgrading");
    expect(updated?.upgradeProgress).toBe(0);
    expect(updated?.upgradeTargetDefId).toBe(BuildingId.ADVANCED_HABITAT);
  });

  test("getUpgradeCost returns 70 materials for habitat", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const cost = buildings.getUpgradeCost(BuildingId.HABITAT);
    expect(cost).toEqual({ materials: 70 });
  });

  test("getUpgradeTime returns 8 sols for habitat", () => {
    const buildings = new BuildingManager(BUILDINGS);
    const time = buildings.getUpgradeTime(BuildingId.HABITAT);
    expect(time).toBe(8);
  });
});

describe("Auto-Housing Tick Phase", () => {
  test("auto-housing triggers during game tick when conditions met", () => {
    const state = new GameState();

    // Research prerequisites
    state.technology.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    state.technology.completeResearch(TechnologyId.PREFAB_CONSTRUCTION);

    // Give enough materials
    state.resources.add({ materials: 200 });

    // Get current housing capacity and set population to 85%+
    const capacity = state.colony.getHousingCapacity(state.buildings);
    const targetPop = Math.ceil(capacity * 0.86);

    // Add colonists to reach threshold
    while (state.colony.getPopulation() < targetPop) {
      state.colony.addColonist();
    }

    const initialPending = state.buildings.getPendingBuildings().length;

    // Run a tick
    const events = state.tick();

    // Should have auto-started a habitat
    const autoHousingEvent = events.find((e) => e.type === "AUTO_HOUSING_STARTED");
    expect(autoHousingEvent).toBeDefined();
    expect(state.buildings.getPendingBuildings().length).toBe(initialPending + 1);
  });
});
