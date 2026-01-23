// tests/SkillSpecialization.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { SKILLS } from "../src/core/data/skills";

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
});
