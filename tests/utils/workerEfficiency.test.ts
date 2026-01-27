import { describe, it, expect } from "bun:test";
import {
  calculateStaffingEfficiency,
  calculateColonistEfficiency,
  calculateAverageWorkerEfficiency,
} from "../../src/core/utils/workerEfficiency";
import { ColonistRole, MasteryLevel, type Colonist } from "../../src/core/models/Colonist";
import { SkillId } from "../../src/core/data/skills";
import {
  MASTERY_EFFICIENCY,
  ROLE_MISMATCH_PENALTY,
  TRAINING_WORK_PENALTY,
  STAFFING_CURVE_EXPONENT,
  MAX_SKILL_EFFICIENCY_BONUS,
} from "../../src/core/balance/WorkforceBalance";

function createColonist(overrides: Partial<Colonist> = {}): Colonist {
  return {
    id: "test-colonist",
    name: "Test Colonist",
    role: ColonistRole.ENGINEERING,
    experience: 0,
    masteryLevel: MasteryLevel.SKILLED,
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
  it("returns base mastery efficiency for colonist with no skills or penalties", () => {
    const colonist = createColonist({ masteryLevel: MasteryLevel.SKILLED });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]!);
  });

  it("applies different mastery level efficiencies", () => {
    const novice = createColonist({ masteryLevel: MasteryLevel.NOVICE });
    const skilled = createColonist({ masteryLevel: MasteryLevel.SKILLED });
    const expert = createColonist({ masteryLevel: MasteryLevel.EXPERT });
    const master = createColonist({ masteryLevel: MasteryLevel.MASTER });

    expect(calculateColonistEfficiency(novice)).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]!); // 0.7
    expect(calculateColonistEfficiency(skilled)).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]!); // 1.0
    expect(calculateColonistEfficiency(expert)).toBe(MASTERY_EFFICIENCY[MasteryLevel.EXPERT]!); // 1.3
    expect(calculateColonistEfficiency(master)).toBe(MASTERY_EFFICIENCY[MasteryLevel.MASTER]!); // 1.6
  });

  it("applies role mismatch penalty when colonist role does not match required role", () => {
    const colonist = createColonist({ role: ColonistRole.ENGINEERING });
    const efficiency = calculateColonistEfficiency(colonist, ColonistRole.RESEARCH);
    const expected = MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! * (1 - ROLE_MISMATCH_PENALTY);
    expect(efficiency).toBeCloseTo(expected);
  });

  it("does not apply role mismatch penalty when roles match", () => {
    const colonist = createColonist({ role: ColonistRole.ENGINEERING });
    const efficiency = calculateColonistEfficiency(colonist, ColonistRole.ENGINEERING);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]!);
  });

  it("does not apply role mismatch penalty when no role is required", () => {
    const colonist = createColonist({ role: ColonistRole.ENGINEERING });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]!);
  });

  it("applies training penalty when colonist is training", () => {
    const colonist = createColonist({
      trainingTarget: ColonistRole.RESEARCH,
      trainingProgress: 2,
    });
    const efficiency = calculateColonistEfficiency(colonist);
    const expected = MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! * (1 - TRAINING_WORK_PENALTY);
    expect(efficiency).toBeCloseTo(expected);
  });

  it("applies both role mismatch and training penalties when applicable", () => {
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      trainingTarget: ColonistRole.RESEARCH,
    });
    const efficiency = calculateColonistEfficiency(colonist, ColonistRole.FARMING);
    const expected =
      MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! *
      (1 - ROLE_MISMATCH_PENALTY) *
      (1 - TRAINING_WORK_PENALTY);
    expect(efficiency).toBeCloseTo(expected);
  });

  it("adds skill bonus for matching skill affinity", () => {
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      skills: [SkillId.JURY_RIGGER], // +0.15 for engineering
    });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! + 0.15);
  });

  it("does not add skill bonus when skill affinity does not match role", () => {
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      skills: [SkillId.GREEN_THUMB], // only applies to farming
    });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]!);
  });

  it("caps skill bonus at MAX_SKILL_EFFICIENCY_BONUS", () => {
    // Give colonist multiple matching skills that would exceed the cap
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      skills: [SkillId.JURY_RIGGER, SkillId.CALM_UNDER_PRESSURE, SkillId.QUICK_LEARNER, SkillId.NIGHT_OWL],
      // jury_rigger: 0.15, calm_under_pressure: 0.1, quick_learner: 0.05, night_owl: 0.05
      // Total: 0.35, but capped at MAX_SKILL_EFFICIENCY_BONUS (0.2)
    });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! + MAX_SKILL_EFFICIENCY_BONUS);
  });

  it("stacks skill bonuses up to the cap", () => {
    const colonist = createColonist({
      role: ColonistRole.ENGINEERING,
      skills: [SkillId.QUICK_LEARNER, SkillId.NIGHT_OWL], // 0.05 + 0.05 = 0.1
    });
    const efficiency = calculateColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! + 0.1);
  });
});

describe("calculateAverageWorkerEfficiency", () => {
  it("returns 1 when no colonists are provided", () => {
    expect(calculateAverageWorkerEfficiency([])).toBe(1);
  });

  it("returns single colonist efficiency for one worker", () => {
    const colonist = createColonist({ masteryLevel: MasteryLevel.EXPERT });
    const efficiency = calculateAverageWorkerEfficiency([colonist]);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.EXPERT]!);
  });

  it("averages efficiency across multiple workers", () => {
    const novice = createColonist({ id: "1", masteryLevel: MasteryLevel.NOVICE });
    const master = createColonist({ id: "2", masteryLevel: MasteryLevel.MASTER });
    const efficiency = calculateAverageWorkerEfficiency([novice, master]);
    const expected = (MASTERY_EFFICIENCY[MasteryLevel.NOVICE]! + MASTERY_EFFICIENCY[MasteryLevel.MASTER]!) / 2;
    expect(efficiency).toBeCloseTo(expected);
  });

  it("passes required role to individual efficiency calculations", () => {
    const matching = createColonist({ id: "1", role: ColonistRole.RESEARCH });
    const mismatched = createColonist({ id: "2", role: ColonistRole.FARMING });

    const efficiency = calculateAverageWorkerEfficiency([matching, mismatched], ColonistRole.RESEARCH);

    const matchingEff = MASTERY_EFFICIENCY[MasteryLevel.SKILLED]!;
    const mismatchedEff = MASTERY_EFFICIENCY[MasteryLevel.SKILLED]! * (1 - ROLE_MISMATCH_PENALTY);
    const expected = (matchingEff + mismatchedEff) / 2;
    expect(efficiency).toBeCloseTo(expected);
  });

  it("handles mixed mastery levels and skills", () => {
    const workers = [
      createColonist({
        id: "1",
        masteryLevel: MasteryLevel.NOVICE,
        role: ColonistRole.ENGINEERING,
      }),
      createColonist({
        id: "2",
        masteryLevel: MasteryLevel.EXPERT,
        role: ColonistRole.ENGINEERING,
        skills: [SkillId.JURY_RIGGER],
      }),
    ];

    const efficiency = calculateAverageWorkerEfficiency(workers);
    const eff1 = MASTERY_EFFICIENCY[MasteryLevel.NOVICE]!; // 0.7
    const eff2 = MASTERY_EFFICIENCY[MasteryLevel.EXPERT]! + 0.15; // 1.3 + 0.15 = 1.45
    expect(efficiency).toBeCloseTo((eff1 + eff2) / 2);
  });
});
