import { describe, expect, test } from "bun:test";
import { BuildingId } from "../src/core/models/Building";
import type { Building } from "../src/core/models/Building";
import type { DriftContext } from "../src/core/data/factionDrift";
import { DRIFT_TRIGGERS } from "../src/core/data/factionDrift";
import type { BuildingManager } from "../src/core/systems/BuildingManager";
import type { ResourceManager } from "../src/core/systems/ResourceManager";
import type { ColonyManager } from "../src/core/systems/ColonyManager";
import type { TechnologyTree } from "../src/core/systems/TechnologyTree";

function createMockBuilding(definitionId: BuildingId): Building {
  return {
    id: `building_${definitionId}`,
    definitionId,
    status: "active",
    constructionProgress: 1,
    assignedWorkers: [],
    mode: "normal",
    broken: false,
    repairProgress: 0,
  };
}

function createMockBuildingManager(buildings: Building[]): BuildingManager {
  return {
    getActiveBuildings: () => buildings,
  } as unknown as BuildingManager;
}

function createDriftContext(activeBuildings: Building[]): DriftContext {
  return {
    resources: {
      getResources: () => ({ food: 300, water: 100, materials: 100 }),
    } as unknown as ResourceManager,
    colony: {
      getPopulation: () => 20,
      getHousingCapacity: () => 30,
      getHealth: () => 70,
      getMorale: () => 70,
    } as unknown as ColonyManager,
    buildings: createMockBuildingManager(activeBuildings),
    technology: {
      getResearchedCount: () => 0,
    } as unknown as TechnologyTree,
  };
}

function findTrigger(id: string) {
  const trigger = DRIFT_TRIGGERS.find((t) => t.id === id);
  if (!trigger) throw new Error(`Trigger "${id}" not found`);
  return trigger;
}

describe("Institutional Building Pressure", () => {
  test("Broadcasting Station applies sovereignty pressure", () => {
    const station = createMockBuilding(BuildingId.BROADCASTING_STATION);
    const ctx = createDriftContext([station]);

    const trigger = findTrigger("institutional_sovereignty");
    const pressure = trigger.evaluate(ctx);

    expect(pressure).toBe(0.01);
  });

  test("Academy applies positive transformation pressure", () => {
    const academy = createMockBuilding(BuildingId.ACADEMY);
    const ctx = createDriftContext([academy]);

    const trigger = findTrigger("institutional_transformation");
    const pressure = trigger.evaluate(ctx);

    expect(pressure).toBe(0.015);
  });

  test("Heritage Museum applies negative transformation pressure", () => {
    const museum = createMockBuilding(BuildingId.HERITAGE_MUSEUM);
    const ctx = createDriftContext([museum]);

    const trigger = findTrigger("institutional_transformation");
    const pressure = trigger.evaluate(ctx);

    expect(pressure).toBe(-0.01);
  });

  test("multiple buildings stack their pressure", () => {
    const station1 = createMockBuilding(BuildingId.BROADCASTING_STATION);
    const station2 = { ...createMockBuilding(BuildingId.BROADCASTING_STATION), id: "building_bs_2" };
    const ctx = createDriftContext([station1, station2]);

    const trigger = findTrigger("institutional_sovereignty");
    const pressure = trigger.evaluate(ctx);

    expect(pressure).toBe(0.02);
  });

  test("Academy and Heritage Museum partially cancel on transformation axis", () => {
    const academy = createMockBuilding(BuildingId.ACADEMY);
    const museum = createMockBuilding(BuildingId.HERITAGE_MUSEUM);
    const ctx = createDriftContext([academy, museum]);

    const trigger = findTrigger("institutional_transformation");
    const pressure = trigger.evaluate(ctx);

    // 0.015 + (-0.01) = 0.005
    expect(pressure).toBeCloseTo(0.005);
  });

  test("buildings without axisPressure do not affect drift", () => {
    const habitat = createMockBuilding(BuildingId.HABITAT);
    const solarPanel = createMockBuilding(BuildingId.SOLAR_PANEL);
    const ctx = createDriftContext([habitat, solarPanel]);

    const solidarityTrigger = findTrigger("institutional_solidarity");
    const sovereigntyTrigger = findTrigger("institutional_sovereignty");
    const transformationTrigger = findTrigger("institutional_transformation");

    expect(solidarityTrigger.evaluate(ctx)).toBe(0);
    expect(sovereigntyTrigger.evaluate(ctx)).toBe(0);
    expect(transformationTrigger.evaluate(ctx)).toBe(0);
  });

  test("no active buildings produce zero institutional pressure", () => {
    const ctx = createDriftContext([]);

    const solidarityTrigger = findTrigger("institutional_solidarity");
    const sovereigntyTrigger = findTrigger("institutional_sovereignty");
    const transformationTrigger = findTrigger("institutional_transformation");

    expect(solidarityTrigger.evaluate(ctx)).toBe(0);
    expect(sovereigntyTrigger.evaluate(ctx)).toBe(0);
    expect(transformationTrigger.evaluate(ctx)).toBe(0);
  });

  test("Broadcasting Station does not affect solidarity or transformation axes", () => {
    const station = createMockBuilding(BuildingId.BROADCASTING_STATION);
    const ctx = createDriftContext([station]);

    const solidarityTrigger = findTrigger("institutional_solidarity");
    const transformationTrigger = findTrigger("institutional_transformation");

    expect(solidarityTrigger.evaluate(ctx)).toBe(0);
    expect(transformationTrigger.evaluate(ctx)).toBe(0);
  });
});
