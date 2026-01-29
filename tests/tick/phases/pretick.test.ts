import { describe, expect, test } from "bun:test";
import {
  updateLaborPoolBonus,
  applyOxygenContribution,
} from "../../../src/core/tick/phases/pretick";

describe("pretick phases", () => {
  describe("pretick:updateLaborPoolBonus", () => {
    test("phase has correct id and dependencies", () => {
      expect(updateLaborPoolBonus.id).toBe("pretick:updateLaborPoolBonus");
      expect(updateLaborPoolBonus.reads).toContain("colony");
      expect(updateLaborPoolBonus.reads).toContain("buildings");
      expect(updateLaborPoolBonus.writes).toContain("buildings");
    });
  });

  describe("pretick:applyOxygenContribution", () => {
    test("phase has correct id and dependencies", () => {
      expect(applyOxygenContribution.id).toBe("pretick:applyOxygenContribution");
      expect(applyOxygenContribution.reads).toContain("buildings");
      expect(applyOxygenContribution.writes).toContain("resources");
    });
  });
});
