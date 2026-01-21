// tests/DepositDepletion.test.ts
import { describe, test, expect } from "bun:test";
import type { ProspectingSite } from "../src/core/models/Operation";
import type { Building } from "../src/core/models/Building";
import {
  DEPOSIT_RESERVES,
  EXTRACTION_RATE_MULTIPLIERS,
  ESTIMATE_UNCERTAINTY,
  DEPLETION_THRESHOLDS,
  RECYCLING_RECOVERY_RATES,
  RECYCLING_TIME_MULTIPLIER,
  RUSH_RECYCLING_PENALTY,
  REPURPOSE_COST_MULTIPLIER,
  REPURPOSE_TIME_MULTIPLIER,
} from "../src/core/balance/OperationsBalance";

describe("Deposit Model", () => {
  test("ProspectingSite has reserve fields", () => {
    const site: ProspectingSite = {
      id: "site_1",
      resourceType: "materials" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: null,
    };

    expect(site.reserves).toBe(500);
    expect(site.estimatedReserves.min).toBe(400);
    expect(site.remainingReserves).toBe(500);
    expect(site.linkedBuildingId).toBeNull();
  });
});

describe("Deposit Balance Constants", () => {
  test("DEPOSIT_RESERVES defines ranges for each quality and resource", () => {
    expect(DEPOSIT_RESERVES.materials.moderate.min).toBe(400);
    expect(DEPOSIT_RESERVES.materials.moderate.max).toBe(800);
    expect(DEPOSIT_RESERVES.water.rich.min).toBe(600);
  });

  test("EXTRACTION_RATE_MULTIPLIERS defines multipliers per quality", () => {
    expect(EXTRACTION_RATE_MULTIPLIERS.poor).toBe(0.5);
    expect(EXTRACTION_RATE_MULTIPLIERS.moderate).toBe(1.0);
    expect(EXTRACTION_RATE_MULTIPLIERS.rich).toBe(1.5);
  });

  test("ESTIMATE_UNCERTAINTY defines accuracy at extraction thresholds", () => {
    expect(ESTIMATE_UNCERTAINTY.initial).toBe(0.3);
    expect(ESTIMATE_UNCERTAINTY.at25Percent).toBe(0.2);
    expect(ESTIMATE_UNCERTAINTY.at50Percent).toBe(0.1);
    expect(ESTIMATE_UNCERTAINTY.at75Percent).toBe(0.05);
  });

  test("DEPLETION_THRESHOLDS defines warning levels", () => {
    expect(DEPLETION_THRESHOLDS.warning).toBe(0.25);
    expect(DEPLETION_THRESHOLDS.critical).toBe(0.10);
  });
});

describe("Building Model Extensions", () => {
  test("Building can have idle status and depositId", () => {
    const building: Building = {
      id: "building_1",
      definitionId: "water_extractor",
      status: "idle",
      constructionProgress: 0,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
      depositId: "site_1",
    };

    expect(building.status).toBe("idle");
    expect(building.depositId).toBe("site_1");
  });
});

import { OperationsManager } from "../src/core/systems/OperationsManager";

describe("OperationsManager Deposit Generation", () => {
  test("generateProspectingSite creates site with reserves", () => {
    const manager = new OperationsManager();
    manager.addUnrevealedSite();
    const sites = manager.getSites();

    expect(sites.length).toBe(1);
    const site = sites[0];

    expect(site.reserves).toBeGreaterThan(0);
    expect(site.remainingReserves).toBe(site.reserves);
    expect(site.estimatedReserves.min).toBeLessThan(site.reserves);
    expect(site.estimatedReserves.max).toBeGreaterThan(site.reserves);
    expect(site.linkedBuildingId).toBeNull();
  });
});

describe("Deposit Extraction", () => {
  test("extractFromDeposit reduces remainingReserves", () => {
    const manager = new OperationsManager();

    // Manually create a site with known reserves
    const site = {
      id: "test_site",
      resourceType: "materials" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: "building_1",
    };

    // Use internal method to add site
    (manager as any).sites = [site];

    const extracted = manager.extractFromDeposit("test_site", 15);

    expect(extracted).toBe(15);
    expect(manager.getSites()[0].remainingReserves).toBe(485);
  });

  test("extractFromDeposit returns 0 when deposit is empty", () => {
    const manager = new OperationsManager();

    const site = {
      id: "test_site",
      resourceType: "materials" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 10,
      estimatedReserves: { min: 8, max: 12 },
      remainingReserves: 5,
      linkedBuildingId: "building_1",
    };

    (manager as any).sites = [site];

    const extracted = manager.extractFromDeposit("test_site", 15);

    expect(extracted).toBe(5); // Only get what's left
    expect(manager.getSites()[0].remainingReserves).toBe(0);
  });

  test("extractFromDeposit updates estimate accuracy over time", () => {
    const manager = new OperationsManager();

    const site = {
      id: "test_site",
      resourceType: "materials" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 100,
      estimatedReserves: { min: 70, max: 130 }, // ±30%
      remainingReserves: 100,
      linkedBuildingId: "building_1",
    };

    (manager as any).sites = [site];

    // Extract 50% (should tighten estimate to ±10%)
    manager.extractFromDeposit("test_site", 50);

    const updatedSite = manager.getSites()[0];
    const range = updatedSite.estimatedReserves.max - updatedSite.estimatedReserves.min;

    // Range should be tighter (±10% of 50 remaining = 10, so range ~10)
    expect(range).toBeLessThan(30);
  });
});

describe("Recycling Balance Constants", () => {
  test("RECYCLING_RECOVERY_RATES defines rates for different building states", () => {
    expect(RECYCLING_RECOVERY_RATES.standard).toBe(0.4);
    expect(RECYCLING_RECOVERY_RATES.depleted).toBe(0.25);
    expect(RECYCLING_RECOVERY_RATES.active).toBe(0.5);
    expect(RECYCLING_RECOVERY_RATES.damaged).toBe(0.15);
  });

  test("recycling time and rush penalty defined", () => {
    expect(RECYCLING_TIME_MULTIPLIER).toBe(0.25);
    expect(RUSH_RECYCLING_PENALTY).toBe(0.3);
  });

  test("repurpose multipliers defined", () => {
    expect(REPURPOSE_COST_MULTIPLIER).toBe(0.3);
    expect(REPURPOSE_TIME_MULTIPLIER).toBe(0.5);
  });
});

import { RANDOM_EVENTS } from "../src/core/data/events";

describe("Resource Events", () => {
  test("meteor strike event exists with salvage opportunity", () => {
    const meteorEvent = RANDOM_EVENTS.find((e) => e.id === "meteor_strike");
    expect(meteorEvent).toBeDefined();
    expect(meteorEvent?.choices.some((c) => c.id === "salvage")).toBe(true);
  });

  test("abandoned cache event provides resources", () => {
    const cacheEvent = RANDOM_EVENTS.find((e) => e.id === "abandoned_cache");
    expect(cacheEvent).toBeDefined();
    expect(cacheEvent?.choices[0].effects?.resources?.materials).toBe(75);
  });

  test("geological survey event reveals deposits", () => {
    const surveyEvent = RANDOM_EVENTS.find(
      (e) => e.id === "geological_survey"
    );
    expect(surveyEvent).toBeDefined();
  });

  test("equipment windfall event provides supplies", () => {
    const windfallEvent = RANDOM_EVENTS.find(
      (e) => e.id === "equipment_windfall"
    );
    expect(windfallEvent).toBeDefined();
    expect(windfallEvent?.choices[0].effects?.resources?.materials).toBe(30);
  });
});
