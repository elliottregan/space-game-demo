// tests/BuildingModes.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { BUILDING_MODES } from "../src/core/balance/OperationsBalance";

describe("Building Modes", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      oxygen: 500,
      water: 500,
      power: 500,
      materials: 500,
    });
  });

  test("new buildings default to normal mode", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    expect(building?.mode).toBe("normal");
    expect(building?.broken).toBe(false);
    expect(building?.repairProgress).toBe(0);
  });

  test("setBuildingMode changes mode", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    buildings.setBuildingMode(building!.id, "overdrive");
    expect(buildings.getBuilding(building!.id)?.mode).toBe("overdrive");
  });

  test("conservation mode reduces production to 50%", () => {
    expect(BUILDING_MODES.conservation.production).toBe(0.5);
  });

  test("overdrive mode increases production to 150%", () => {
    expect(BUILDING_MODES.overdrive.production).toBe(1.5);
  });

  test("getEffectiveProduction applies mode multiplier", () => {
    const building = buildings.startBuilding("solar_panel", resources, {
      isResearched: () => true,
    } as never);
    // Complete construction
    for (let i = 0; i < 10; i++) buildings.tick(resources);

    const normalProd = buildings.getEffectiveProduction(building!.id);
    buildings.setBuildingMode(building!.id, "overdrive");
    const overdriveProd = buildings.getEffectiveProduction(building!.id);

    expect(overdriveProd.power).toBe(normalProd.power! * 1.5);
  });
});
