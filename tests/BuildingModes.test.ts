// tests/BuildingModes.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { BUILDING_MODES } from "../src/core/balance/OperationsBalance";
import { BuildingId } from "../src/core/models/Building";

describe("Building Modes", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      water: 500,
      materials: 500,
    });
  });

  test("new buildings default to normal mode", () => {
    const building = buildings.startBuilding(BuildingId.SOLAR_PANEL, resources, {
      isResearched: () => true,
    } as never);
    expect(building?.mode).toBe("normal");
    expect(building?.broken).toBe(false);
    expect(building?.repairProgress).toBe(0);
  });

  test("setBuildingMode changes mode", () => {
    const building = buildings.startBuilding(BuildingId.SOLAR_PANEL, resources, {
      isResearched: () => true,
    } as never);
    // Complete construction first - mode can only change on active buildings
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    buildings.setBuildingMode(building!.id, "overdrive", resources);
    expect(buildings.getBuilding(building!.id)?.mode).toBe("overdrive");
  });

  test("conservation mode reduces production to 50%", () => {
    expect(BUILDING_MODES.conservation.production).toBe(0.5);
  });

  test("overdrive mode increases production to 150%", () => {
    expect(BUILDING_MODES.overdrive.production).toBe(1.5);
  });

  test("getEffectiveProduction applies mode multiplier", () => {
    // Use Basic Farm which produces food (a stockpiled resource)
    const building = buildings.startBuilding(BuildingId.BASIC_FARM, resources, {
      isResearched: () => true,
    } as never);
    // Complete construction
    for (let i = 0; i < 15; i++) buildings.tick(resources);

    const normalProd = buildings.getEffectiveProduction(building!.id);
    buildings.setBuildingMode(building!.id, "overdrive", resources);
    const overdriveProd = buildings.getEffectiveProduction(building!.id);

    expect(overdriveProd.food).toBe(normalProd.food! * 1.5);
  });
});

describe("Building Breakdown", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      water: 500,
      materials: 500,
    });
  });

  test("breakBuilding sets broken to true", () => {
    const building = buildings.startBuilding(BuildingId.SOLAR_PANEL, resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    buildings.breakBuilding(building!.id, resources);
    expect(buildings.getBuilding(building!.id)?.broken).toBe(true);
  });

  test("broken building produces nothing", () => {
    const building = buildings.startBuilding(BuildingId.SOLAR_PANEL, resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    buildings.breakBuilding(building!.id, resources);
    const prod = buildings.getEffectiveProduction(building!.id);
    expect(prod).toEqual({});
  });

  test("startRepair begins repair process", () => {
    const building = buildings.startBuilding(BuildingId.SOLAR_PANEL, resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);
    buildings.breakBuilding(building!.id, resources);

    const repairCost = buildings.getRepairCost(building!.id);
    expect(repairCost).toBeDefined();
    expect(repairCost!.materials).toBeGreaterThan(0);

    buildings.startRepair(building!.id, resources);
    expect(buildings.getBuilding(building!.id)?.repairProgress).toBeGreaterThan(0);
  });

  test("repair completes after REPAIR_DURATION_SOLS", () => {
    const building = buildings.startBuilding(BuildingId.SOLAR_PANEL, resources, {
      isResearched: () => true,
    } as never);
    for (let i = 0; i < 10; i++) buildings.tick(resources);
    buildings.breakBuilding(building!.id, resources);
    buildings.startRepair(building!.id, resources);

    for (let i = 0; i < 3; i++) buildings.tick(resources);

    expect(buildings.getBuilding(building!.id)?.broken).toBe(false);
    expect(buildings.getBuilding(building!.id)?.repairProgress).toBe(0);
  });
});
