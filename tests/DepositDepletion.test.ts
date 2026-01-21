// tests/DepositDepletion.test.ts
import { describe, test, expect } from "bun:test";
import type { ProspectingSite } from "../src/core/models/Operation";
import type { Building } from "../src/core/models/Building";
import {
  DEPOSIT_RESERVES,
  EXTRACTION_RATE_MULTIPLIERS,
  ESTIMATE_UNCERTAINTY,
  DEPLETION_THRESHOLDS,
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
