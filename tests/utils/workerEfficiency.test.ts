import { describe, it, expect } from "bun:test";
import {
  calculateStaffingEfficiency,
  calculateColonistEfficiency,
  calculateAverageWorkerEfficiency,
} from "../../src/core/utils/workerEfficiency";
import { ColonistRole, type Colonist } from "../../src/core/models/Colonist";
import { SkillId } from "../../src/core/data/skills";
import {
  ROLE_MISMATCH_PENALTY,
  STAFFING_CURVE_EXPONENT,
} from "../../src/core/balance/WorkforceBalance";

function createColonist(overrides: Partial<Colonist> = {}): Colonist {
  return {
    id: "test-colonist",
    name: "Test Colonist",
    role: ColonistRole.ENGINEERING,
    skills: [],
    ...overrides,
  };
}

describe("calculateStaffingEfficiency", () => {
  it("returns 1 when building has no worker slots", () => {
    expect(calculateStaffingEfficiency(0, undefined)).toBe(1);
    expect(calculateStaffingEfficiency(0, 0)).toBe(1);
    expect(calculateStaffingEfficiency(5, undefined)).toBe(1);
  });

  it("returns 0 when no workers are assigned to a building with slots", () => {
    expect(calculateStaffingEfficiency(0, 4)).toBe(0);
  });

  it("returns 1 when fully staffed", () => {
    const efficiency = calculateStaffingEfficiency(4, 4);
    expect(efficiency).toBe(1);
  });

  it("applies diminishing returns curve for partial staffing", () => {
    // Formula: 1 - (1 - staffingRatio)^STAFFING_CURVE_EXPONENT
    const efficiency = calculateStaffingEfficiency(2, 4);
    const expected = 1 - (1 - 0.5) ** STAFFING_CURVE_EXPONENT;
    expect(efficiency).toBeCloseTo(expected);
  });

  it("has higher efficiency at 75% staffing than linear would suggest", () => {
    const efficiency = calculateStaffingEfficiency(3, 4);
    // With diminishing returns, 75% staffing gives more than 75% efficiency
    expect(efficiency).toBeGreaterThan(0.75);
  });

  it("handles single worker in multi-slot building", () => {
    const efficiency = calculateStaffingEfficiency(1, 4);
    const expected = 1 - (1 - 0.25) ** STAFFING_CURVE_EXPONENT;
    expect(efficiency).toBeCloseTo(expected);
  });
});

describe("calculateColonistEfficiency", () => {
  it("returns base efficiency for colonist with no skills or penalties", () => {
    const colonist = createColonist();
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(1.0);
  });

  it("applies role mismatch penalty when colonist role does not match required role", () => {
    const colonist = createColonist({ role: ColonistRole.ENGINEERING });
    const efficiency = calculateColonistEfficiency(colonist, ColonistRole.RESEARCH);
    const expected = 1.0 * (1 - ROLE_MISMATCH_PENALTY);
    expect(efficiency).toBeCloseTo(expected);
  });

  it("does not apply role mismatch penalty when roles match", () => {
    const colonist = createColonist({ role: ColonistRole.ENGINEERING });
    const efficiency = calculateColonistEfficiency(colonist, ColonistRole.ENGINEERING);
    expect(efficiency).toBe(1.0);
  });

  it("does not apply role mismatch penalty when no role is required", () => {
    const colonist = createColonist({ role: ColonistRole.ENGINEERING });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(1.0);
  });

  it("adds skill bonus for matching skill affinity", () => {
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      skills: [SkillId.JURY_RIGGER], // +0.15 for engineering
    });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(1.0 + 0.15);
  });

  it("does not add skill bonus when skill affinity does not match role", () => {
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      skills: [SkillId.GREEN_THUMB], // only applies to farming
    });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(1.0);
  });
});

describe("calculateAverageWorkerEfficiency", () => {
  it("returns 1 when no colonists are provided", () => {
    expect(calculateAverageWorkerEfficiency([])).toBe(1);
  });

  it("returns single colonist efficiency for one worker", () => {
    const colonist = createColonist();
    const efficiency = calculateAverageWorkerEfficiency([colonist]);
    expect(efficiency).toBe(1.0);
  });

  it("averages efficiency across multiple workers", () => {
    const worker1 = createColonist({ id: "1" });
    const worker2 = createColonist({ id: "2" });
    const efficiency = calculateAverageWorkerEfficiency([worker1, worker2]);
    expect(efficiency).toBeCloseTo(1.0);
  });

  it("passes required role to individual efficiency calculations", () => {
    const matching = createColonist({ id: "1", role: ColonistRole.RESEARCH });
    const mismatched = createColonist({ id: "2", role: ColonistRole.FARMING });

    const efficiency = calculateAverageWorkerEfficiency(
      [matching, mismatched],
      ColonistRole.RESEARCH,
    );

    const matchingEff = 1.0;
    const mismatchedEff = 1.0 * (1 - ROLE_MISMATCH_PENALTY);
    const expected = (matchingEff + mismatchedEff) / 2;
    expect(efficiency).toBeCloseTo(expected);
  });

  it("handles mixed skills", () => {
    const workers = [
      createColonist({
        id: "1",
        role: ColonistRole.ENGINEERING,
      }),
      createColonist({
        id: "2",
        role: ColonistRole.ENGINEERING,
        skills: [SkillId.JURY_RIGGER],
      }),
    ];

    const efficiency = calculateAverageWorkerEfficiency(workers);
    const eff1 = 1.0;
    const eff2 = 1.0 + 0.15; // skill bonus
    expect(efficiency).toBeCloseTo((eff1 + eff2) / 2);
  });
});
