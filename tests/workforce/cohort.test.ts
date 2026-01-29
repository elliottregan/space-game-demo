// tests/workforce/cohort.test.ts
import { describe, it, expect } from "bun:test";
import {
  areInSameCohort,
  getCohortBondingMultiplier,
} from "../../src/core/systems/workforce/cohort";
import {
  COHORT_WINDOW_SOLS,
  COHORT_BONDING_MULTIPLIER,
} from "../../src/core/balance/WorkforceBalance";

describe("cohort", () => {
  describe("areInSameCohort", () => {
    it("should return true for colonists arriving within window", () => {
      expect(areInSameCohort(10, 15)).toBe(true);
      expect(areInSameCohort(10, 20)).toBe(true); // exactly at window edge
    });

    it("should return false for colonists arriving outside window", () => {
      expect(areInSameCohort(10, 50)).toBe(false);
      expect(areInSameCohort(10, 21)).toBe(false); // just outside
    });

    it("should return false when either arrival is undefined", () => {
      expect(areInSameCohort(10, undefined)).toBe(false);
      expect(areInSameCohort(undefined, 10)).toBe(false);
      expect(areInSameCohort(undefined, undefined)).toBe(false);
    });
  });

  describe("getCohortBondingMultiplier", () => {
    it("should return cohort multiplier for same cohort", () => {
      expect(getCohortBondingMultiplier(10, 15)).toBe(COHORT_BONDING_MULTIPLIER);
    });

    it("should return 1.0 for different cohorts", () => {
      expect(getCohortBondingMultiplier(10, 50)).toBe(1.0);
    });
  });
});
