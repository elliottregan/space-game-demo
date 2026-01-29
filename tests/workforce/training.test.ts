// tests/workforce/training.test.ts
import { describe, it, expect } from "bun:test";
import { getTrainingTime, getRoleName } from "../../src/core/systems/workforce/training";
import { ColonistRole } from "../../src/core/models/Colonist";

describe("training", () => {
  describe("getTrainingTime", () => {
    it("should return affinity-based training time", () => {
      expect(getTrainingTime(ColonistRole.RESEARCH, ColonistRole.CIVIL_SCIENCE)).toBe(3);
      expect(getTrainingTime(ColonistRole.UNASSIGNED, ColonistRole.ENGINEERING)).toBe(5);
    });

    it("should return default 10 for undefined affinity", () => {
      expect(getTrainingTime(ColonistRole.RESEARCH, ColonistRole.UNASSIGNED)).toBe(10);
    });
  });

  describe("getRoleName", () => {
    it("should return display names for all roles", () => {
      expect(getRoleName(ColonistRole.UNASSIGNED)).toBe("Unassigned");
      expect(getRoleName(ColonistRole.RESEARCH)).toBe("Researcher");
      expect(getRoleName(ColonistRole.ENGINEERING)).toBe("Engineer");
      expect(getRoleName(ColonistRole.CIVIL_SCIENCE)).toBe("Scientist");
      expect(getRoleName(ColonistRole.FARMING)).toBe("Farmer");
    });
  });
});
