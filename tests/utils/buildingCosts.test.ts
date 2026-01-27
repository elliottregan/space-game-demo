import { describe, it, expect } from "bun:test";
import {
  scaleCost,
  calculateRepairCost,
  calculateMaintenanceCost,
  calculateRepurposeCost,
  calculateRepurposeTime,
  getRecyclingRate,
  calculateRecycleValue,
  calculateRecycleTime,
  applyRushRecyclingPenalty,
} from "../../src/core/utils/buildingCosts";
import {
  RECYCLING_RECOVERY_RATES,
  RECYCLING_TIME_MULTIPLIER,
  REPAIR_COST_MULTIPLIER,
  REPURPOSE_COST_MULTIPLIER,
  REPURPOSE_TIME_MULTIPLIER,
  RUSH_RECYCLING_PENALTY,
} from "../../src/core/balance/OperationsBalance";
import { MAINTENANCE_COST_MULTIPLIER } from "../../src/core/balance/BuildingBalance";
import { BuildingId, type Building, type BuildingDefinition } from "../../src/core/models/Building";

function createBuildingDefinition(
  overrides: Partial<BuildingDefinition> = {},
): BuildingDefinition {
  return {
    id: BuildingId.HABITAT,
    name: "Test Building",
    description: "A test building",
    cost: { materials: 100, power: 50 },
    constructionTime: 10,
    ...overrides,
  };
}

function createBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: "building-1",
    definitionId: BuildingId.HABITAT,
    status: "active",
    constructionProgress: 10,
    assignedWorkers: [],
    mode: "normal",
    broken: false,
    repairProgress: 0,
    condition: 100,
    age: 0,
    lastMaintenance: 0,
    ...overrides,
  };
}

describe("scaleCost", () => {
  it("scales all resource values by the multiplier", () => {
    const cost = { materials: 100, power: 50 };
    const result = scaleCost(cost, 0.5);
    expect(result.materials).toBe(50);
    expect(result.power).toBe(25);
  });

  it("uses Math.ceil as default rounding function", () => {
    const cost = { materials: 100 };
    const result = scaleCost(cost, 0.33);
    expect(result.materials).toBe(33); // ceil(33) = 33
  });

  it("accepts custom rounding function", () => {
    const cost = { materials: 100 };
    const result = scaleCost(cost, 0.33, Math.floor);
    expect(result.materials).toBe(33); // floor(33) = 33
  });

  it("rounds up fractional values with ceil", () => {
    const cost = { materials: 10 };
    const result = scaleCost(cost, 0.25, Math.ceil);
    expect(result.materials).toBe(3); // ceil(2.5) = 3
  });

  it("rounds down fractional values with floor", () => {
    const cost = { materials: 10 };
    const result = scaleCost(cost, 0.25, Math.floor);
    expect(result.materials).toBe(2); // floor(2.5) = 2
  });

  it("skips zero and undefined values", () => {
    const cost = { materials: 100, power: 0, food: undefined };
    const result = scaleCost(cost, 0.5);
    expect(result.materials).toBe(50);
    expect(result.power).toBeUndefined();
    expect(result.food).toBeUndefined();
  });

  it("returns empty object for empty input", () => {
    const result = scaleCost({}, 0.5);
    expect(result).toEqual({});
  });
});

describe("calculateRepairCost", () => {
  it("calculates repair cost as fraction of building cost", () => {
    const def = createBuildingDefinition({ cost: { materials: 100 } });
    const result = calculateRepairCost(def);
    expect(result.materials).toBe(Math.ceil(100 * REPAIR_COST_MULTIPLIER));
  });

  it("applies to all resource types in cost", () => {
    const def = createBuildingDefinition({ cost: { materials: 100, power: 50 } });
    const result = calculateRepairCost(def);
    expect(result.materials).toBe(Math.ceil(100 * REPAIR_COST_MULTIPLIER));
    expect(result.power).toBe(Math.ceil(50 * REPAIR_COST_MULTIPLIER));
  });
});

describe("calculateMaintenanceCost", () => {
  it("calculates maintenance cost as fraction of building cost", () => {
    const def = createBuildingDefinition({ cost: { materials: 100 } });
    const result = calculateMaintenanceCost(def);
    expect(result.materials).toBe(Math.ceil(100 * MAINTENANCE_COST_MULTIPLIER));
  });
});

describe("calculateRepurposeCost", () => {
  it("calculates repurpose cost as fraction of target building cost", () => {
    const targetDef = createBuildingDefinition({ cost: { materials: 200 } });
    const result = calculateRepurposeCost(targetDef);
    expect(result.materials).toBe(Math.ceil(200 * REPURPOSE_COST_MULTIPLIER));
  });
});

describe("calculateRepurposeTime", () => {
  it("calculates repurpose time as fraction of target construction time", () => {
    const targetDef = createBuildingDefinition({ constructionTime: 20 });
    const result = calculateRepurposeTime(targetDef);
    expect(result).toBe(Math.ceil(20 * REPURPOSE_TIME_MULTIPLIER));
  });

  it("rounds up to nearest integer", () => {
    const targetDef = createBuildingDefinition({ constructionTime: 7 });
    const result = calculateRepurposeTime(targetDef);
    expect(result).toBe(Math.ceil(7 * REPURPOSE_TIME_MULTIPLIER));
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("getRecyclingRate", () => {
  it("returns damaged rate for broken buildings", () => {
    const building = createBuilding({ broken: true });
    expect(getRecyclingRate(building)).toBe(RECYCLING_RECOVERY_RATES.damaged);
  });

  it("returns depleted rate for idle buildings", () => {
    const building = createBuilding({ status: "idle" });
    expect(getRecyclingRate(building)).toBe(RECYCLING_RECOVERY_RATES.depleted);
  });

  it("returns active rate for active buildings with deposit", () => {
    const building = createBuilding({ status: "active", depositId: "deposit-1" });
    expect(getRecyclingRate(building)).toBe(RECYCLING_RECOVERY_RATES.active);
  });

  it("returns standard rate for active buildings without deposit", () => {
    const building = createBuilding({ status: "active" });
    expect(getRecyclingRate(building)).toBe(RECYCLING_RECOVERY_RATES.standard);
  });

  it("prioritizes broken status over idle status", () => {
    const building = createBuilding({ broken: true, status: "idle" });
    expect(getRecyclingRate(building)).toBe(RECYCLING_RECOVERY_RATES.damaged);
  });

  it("returns standard rate for pending buildings", () => {
    const building = createBuilding({ status: "pending" });
    expect(getRecyclingRate(building)).toBe(RECYCLING_RECOVERY_RATES.standard);
  });
});

describe("calculateRecycleValue", () => {
  it("calculates recycle value based on building state", () => {
    const def = createBuildingDefinition({ cost: { materials: 100 } });
    const building = createBuilding({ status: "active" });
    const result = calculateRecycleValue(building, def);
    expect(result.materials).toBe(Math.floor(100 * RECYCLING_RECOVERY_RATES.standard));
  });

  it("uses floor for rounding (players get less)", () => {
    const def = createBuildingDefinition({ cost: { materials: 100 } });
    const building = createBuilding({ broken: true });
    const result = calculateRecycleValue(building, def);
    // damaged rate is 0.15, so 100 * 0.15 = 15
    expect(result.materials).toBe(Math.floor(100 * RECYCLING_RECOVERY_RATES.damaged));
  });

  it("returns lower value for broken buildings", () => {
    const def = createBuildingDefinition({ cost: { materials: 100 } });
    const normalBuilding = createBuilding({ status: "active" });
    const brokenBuilding = createBuilding({ broken: true });

    const normalValue = calculateRecycleValue(normalBuilding, def);
    const brokenValue = calculateRecycleValue(brokenBuilding, def);

    expect(brokenValue.materials).toBeLessThan(normalValue.materials!);
  });
});

describe("calculateRecycleTime", () => {
  it("calculates recycle time as fraction of construction time", () => {
    const def = createBuildingDefinition({ constructionTime: 20 });
    const result = calculateRecycleTime(def);
    expect(result).toBe(Math.ceil(20 * RECYCLING_TIME_MULTIPLIER));
  });
});

describe("applyRushRecyclingPenalty", () => {
  it("reduces recycle value by rush penalty percentage", () => {
    const recycleValue = { materials: 100 };
    const result = applyRushRecyclingPenalty(recycleValue);
    expect(result.materials).toBe(Math.floor(100 * (1 - RUSH_RECYCLING_PENALTY)));
  });

  it("uses floor for rounding", () => {
    const recycleValue = { materials: 50 };
    const result = applyRushRecyclingPenalty(recycleValue);
    const expected = Math.floor(50 * (1 - RUSH_RECYCLING_PENALTY));
    expect(result.materials).toBe(expected);
  });

  it("applies to all resource types", () => {
    const recycleValue = { materials: 100, power: 50 };
    const result = applyRushRecyclingPenalty(recycleValue);
    expect(result.materials).toBe(Math.floor(100 * (1 - RUSH_RECYCLING_PENALTY)));
    expect(result.power).toBe(Math.floor(50 * (1 - RUSH_RECYCLING_PENALTY)));
  });
});
