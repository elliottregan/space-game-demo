// tests/SkillSpecialization.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { WorkforceManager } from "../src/core/systems/WorkforceManager";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import { SKILLS, SkillId } from "../src/core/data/skills";
import { MASTERY_EFFICIENCY, MAX_SKILL_EFFICIENCY_BONUS } from "../src/core/balance/WorkforceBalance";

describe("SkillSpecialization", () => {
  describe("Skill Assignment", () => {
    let colony: ColonyManager;

    beforeEach(() => {
      colony = new ColonyManager(0);
    });

    it("should assign 1-2 skills to new colonists", () => {
      const colonist = colony.addColonist();
      expect(colonist.skills).toBeDefined();
      expect(colonist.skills.length).toBeGreaterThanOrEqual(1);
      expect(colonist.skills.length).toBeLessThanOrEqual(2);
    });

    it("should assign valid skill IDs", () => {
      const colonist = colony.addColonist();
      const validSkillIds = SKILLS.map((s) => s.id);
      for (const skillId of colonist.skills) {
        expect(validSkillIds).toContain(skillId);
      }
    });

    it("should not assign duplicate skills", () => {
      // Create many colonists to test randomness
      for (let i = 0; i < 20; i++) {
        const colonist = colony.addColonist();
        const uniqueSkills = new Set(colonist.skills);
        expect(uniqueSkills.size).toBe(colonist.skills.length);
      }
    });
  });

  describe("Skill Efficiency", () => {
    let workforce: WorkforceManager;

    beforeEach(() => {
      workforce = new WorkforceManager();
    });

    it("should return base mastery efficiency for colonist with no matching skills", () => {
      const colonist = {
        id: "test_1",
        name: "Test",
        role: ColonistRole.ENGINEERING,
        experience: 0,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [SkillId.GREEN_THUMB], // Farming skill, not Engineering
      };

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]!);
    });

    it("should add skill bonus for matching skill", () => {
      const colonist = {
        id: "test_1",
        name: "Test",
        role: ColonistRole.ENGINEERING,
        experience: 0,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [SkillId.JURY_RIGGER], // +15% for Engineering
      };

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]! + 0.15);
    });

    it("should stack multiple matching skill bonuses", () => {
      const colonist = {
        id: "test_1",
        name: "Test",
        role: ColonistRole.ENGINEERING,
        experience: 0,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [SkillId.JURY_RIGGER, SkillId.CALM_UNDER_PRESSURE], // +15% + +10%
      };

      const efficiency = workforce.getColonistEfficiency(colonist);
      // Should be capped at MAX_SKILL_EFFICIENCY_BONUS (0.2)
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]! + MAX_SKILL_EFFICIENCY_BONUS);
    });

    it("should cap skill bonus at MAX_SKILL_EFFICIENCY_BONUS", () => {
      const colonist = {
        id: "test_1",
        name: "Test",
        role: ColonistRole.RESEARCH,
        experience: 0,
        masteryLevel: MasteryLevel.MASTER,
        skills: [SkillId.LAB_RAT, SkillId.CALM_UNDER_PRESSURE], // +15% + +10% = +25%, but capped at +20%
      };

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.MASTER]! + MAX_SKILL_EFFICIENCY_BONUS);
    });
  });
});
