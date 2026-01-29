// tests/workforce/mastery.test.ts
import { describe, it, expect } from "bun:test";
import {
  calculateMasteryLevel,
  getMasteryEfficiency,
  getMasteryName,
} from "../../src/core/systems/workforce/mastery";
import { MasteryLevel } from "../../src/core/models/Colonist";

describe("mastery", () => {
  describe("calculateMasteryLevel", () => {
    it("should return NOVICE for 0-24 experience", () => {
      expect(calculateMasteryLevel(0)).toBe(MasteryLevel.NOVICE);
      expect(calculateMasteryLevel(24)).toBe(MasteryLevel.NOVICE);
    });

    it("should return SKILLED for 25-49 experience", () => {
      expect(calculateMasteryLevel(25)).toBe(MasteryLevel.SKILLED);
      expect(calculateMasteryLevel(49)).toBe(MasteryLevel.SKILLED);
    });

    it("should return EXPERT for 50-74 experience", () => {
      expect(calculateMasteryLevel(50)).toBe(MasteryLevel.EXPERT);
      expect(calculateMasteryLevel(74)).toBe(MasteryLevel.EXPERT);
    });

    it("should return MASTER for 75+ experience", () => {
      expect(calculateMasteryLevel(75)).toBe(MasteryLevel.MASTER);
      expect(calculateMasteryLevel(100)).toBe(MasteryLevel.MASTER);
    });
  });

  describe("getMasteryEfficiency", () => {
    it("should return correct efficiency for each level", () => {
      expect(getMasteryEfficiency(MasteryLevel.NOVICE)).toBe(0.7);
      expect(getMasteryEfficiency(MasteryLevel.SKILLED)).toBe(1.0);
      expect(getMasteryEfficiency(MasteryLevel.EXPERT)).toBe(1.3);
      expect(getMasteryEfficiency(MasteryLevel.MASTER)).toBe(1.6);
    });
  });

  describe("getMasteryName", () => {
    it("should return display names", () => {
      expect(getMasteryName(MasteryLevel.NOVICE)).toBe("Novice");
      expect(getMasteryName(MasteryLevel.SKILLED)).toBe("Skilled");
      expect(getMasteryName(MasteryLevel.EXPERT)).toBe("Expert");
      expect(getMasteryName(MasteryLevel.MASTER)).toBe("Master");
    });
  });
});
