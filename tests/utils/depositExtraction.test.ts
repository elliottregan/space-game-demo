import { describe, it, expect } from "bun:test";
import {
  createDepositWarningEvent,
  createDepositCriticalEvent,
  createDepositDepletedEvent,
  getDepletionEvents,
  canExtract,
  getBaseProductionForDeposit,
  type WarningLevel,
} from "../../src/core/utils/depositExtraction";
import { BuildingId, type Building, type BuildingDefinition } from "../../src/core/models/Building";
import type { ProspectingSite } from "../../src/core/models/Operation";

function createSite(overrides: Partial<ProspectingSite> = {}): ProspectingSite {
  return {
    id: "site-1",
    resourceType: "water",
    quality: "moderate",
    revealed: true,
    developed: true,
    developmentProgress: 100,
    reserves: 1000,
    estimatedReserves: { min: 900, max: 1100 },
    remainingReserves: 500,
    linkedBuildingId: "building-1",
    ...overrides,
  };
}

function createBuilding(overrides: Partial<Building> = {}): Building {
  return {
    id: "building-1",
    definitionId: BuildingId.WATER_EXTRACTOR,
    status: "active",
    constructionProgress: 10,
    assignedWorkers: [],
    mode: "normal",
    broken: false,
    repairProgress: 0,
    condition: 100,
    age: 0,
    lastMaintenance: 0,
    depositId: "site-1",
    ...overrides,
  };
}

function createDefinition(overrides: Partial<BuildingDefinition> = {}): BuildingDefinition {
  return {
    id: BuildingId.WATER_EXTRACTOR,
    name: "Water Extractor",
    description: "Extracts water from deposits",
    cost: { materials: 100 },
    constructionTime: 10,
    requiresDeposit: true,
    production: { water: 5 },
    ...overrides,
  };
}

describe("createDepositWarningEvent", () => {
  it("creates a warning event with correct structure", () => {
    const site = createSite({ id: "site-1", resourceType: "water", estimatedReserves: { min: 200, max: 300 } });
    const building = createBuilding({ id: "building-1" });

    const event = createDepositWarningEvent(site, building, "Water Extractor");

    expect(event.type).toBe("DEPOSIT_WARNING");
    expect(event.depositId).toBe("site-1");
    expect(event.buildingId).toBe("building-1");
    expect(event.severity).toBe("warning");
    expect(event.message).toContain("Water Extractor");
    expect(event.message).toContain("running low");
    expect(event.message).toContain("300"); // max estimate
    expect(event.message).toContain("water");
  });
});

describe("createDepositCriticalEvent", () => {
  it("creates a critical event with correct structure", () => {
    const site = createSite({ id: "site-2", resourceType: "materials", estimatedReserves: { min: 50, max: 100 } });
    const building = createBuilding({ id: "building-2" });

    const event = createDepositCriticalEvent(site, building, "Mine");

    expect(event.type).toBe("DEPOSIT_CRITICAL");
    expect(event.depositId).toBe("site-2");
    expect(event.buildingId).toBe("building-2");
    expect(event.severity).toBe("critical");
    expect(event.message).toContain("Mine");
    expect(event.message).toContain("nearly exhausted");
  });
});

describe("createDepositDepletedEvent", () => {
  it("creates a depleted event with correct structure", () => {
    const site = createSite({ id: "site-3" });
    const building = createBuilding({ id: "building-3" });

    const event = createDepositDepletedEvent(site, building, "Ice Miner");

    expect(event.type).toBe("DEPOSIT_DEPLETED");
    expect(event.depositId).toBe("site-3");
    expect(event.buildingId).toBe("building-3");
    expect(event.buildingName).toBe("Ice Miner");
    expect(event.severity).toBe("critical");
    expect(event.message).toContain("exhausted");
    expect(event.message).toContain("idle");
  });
});

describe("getDepletionEvents", () => {
  const site = createSite();
  const building = createBuilding();
  const buildingName = "Water Extractor";

  it("emits warning event when transitioning from none to warning", () => {
    const events = getDepletionEvents("none", "warning", site, building, buildingName);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("DEPOSIT_WARNING");
  });

  it("emits critical event when transitioning from none to critical", () => {
    const events = getDepletionEvents("none", "critical", site, building, buildingName);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("DEPOSIT_CRITICAL");
  });

  it("emits critical event when transitioning from warning to critical", () => {
    const events = getDepletionEvents("warning", "critical", site, building, buildingName);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("DEPOSIT_CRITICAL");
  });

  it("emits depleted event when transitioning to depleted from any state", () => {
    const fromNone = getDepletionEvents("none", "depleted", site, building, buildingName);
    const fromWarning = getDepletionEvents("warning", "depleted", site, building, buildingName);
    const fromCritical = getDepletionEvents("critical", "depleted", site, building, buildingName);

    expect(fromNone).toHaveLength(1);
    expect(fromNone[0]!.type).toBe("DEPOSIT_DEPLETED");

    expect(fromWarning).toHaveLength(1);
    expect(fromWarning[0]!.type).toBe("DEPOSIT_DEPLETED");

    expect(fromCritical).toHaveLength(1);
    expect(fromCritical[0]!.type).toBe("DEPOSIT_DEPLETED");
  });

  it("emits no events when state does not change", () => {
    expect(getDepletionEvents("none", "none", site, building, buildingName)).toHaveLength(0);
    expect(getDepletionEvents("warning", "warning", site, building, buildingName)).toHaveLength(0);
    expect(getDepletionEvents("critical", "critical", site, building, buildingName)).toHaveLength(0);
  });

  it("emits no events when transitioning from critical to critical (already warned)", () => {
    const events = getDepletionEvents("critical", "critical", site, building, buildingName);
    expect(events).toHaveLength(0);
  });

  it("emits no events for warning->none (recovery, unusual case)", () => {
    const events = getDepletionEvents("warning", "none", site, building, buildingName);
    expect(events).toHaveLength(0);
  });
});

describe("canExtract", () => {
  it("returns true for valid extraction conditions", () => {
    const building = createBuilding({ depositId: "site-1", broken: false });
    const def = createDefinition({ requiresDeposit: true });
    expect(canExtract(building, def)).toBe(true);
  });

  it("returns false when definition is undefined", () => {
    const building = createBuilding();
    expect(canExtract(building, undefined)).toBe(false);
  });

  it("returns false when building does not require deposit", () => {
    const building = createBuilding({ depositId: "site-1" });
    const def = createDefinition({ requiresDeposit: false });
    expect(canExtract(building, def)).toBe(false);
  });

  it("returns false when requiresDeposit is undefined", () => {
    const building = createBuilding({ depositId: "site-1" });
    const def = createDefinition({ requiresDeposit: undefined });
    expect(canExtract(building, def)).toBe(false);
  });

  it("returns false when building has no depositId", () => {
    const building = createBuilding({ depositId: undefined });
    const def = createDefinition({ requiresDeposit: true });
    expect(canExtract(building, def)).toBe(false);
  });

  it("returns false when building is broken", () => {
    const building = createBuilding({ depositId: "site-1", broken: true });
    const def = createDefinition({ requiresDeposit: true });
    expect(canExtract(building, def)).toBe(false);
  });
});

describe("getBaseProductionForDeposit", () => {
  it("returns production rate for matching resource type", () => {
    const def = createDefinition({ production: { water: 5 } });
    expect(getBaseProductionForDeposit(def, "water")).toBe(5);
  });

  it("returns 0 for non-matching resource type", () => {
    const def = createDefinition({ production: { water: 5 } });
    expect(getBaseProductionForDeposit(def, "materials")).toBe(0);
  });

  it("returns 0 when production is undefined", () => {
    const def = createDefinition({ production: undefined });
    expect(getBaseProductionForDeposit(def, "water")).toBe(0);
  });

  it("handles multiple production types", () => {
    const def = createDefinition({ production: { water: 5, materials: 10 } });
    expect(getBaseProductionForDeposit(def, "water")).toBe(5);
    expect(getBaseProductionForDeposit(def, "materials")).toBe(10);
    expect(getBaseProductionForDeposit(def, "food")).toBe(0);
  });
});
