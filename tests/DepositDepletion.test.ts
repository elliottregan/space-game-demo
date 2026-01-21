// tests/DepositDepletion.test.ts
import { describe, test, expect } from "bun:test";
import type { ProspectingSite } from "../src/core/models/Operation";

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
