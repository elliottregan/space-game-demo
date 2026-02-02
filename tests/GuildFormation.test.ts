// tests/GuildFormation.test.ts
import { describe, it, expect } from "bun:test";
import {
  determineGuildType,
  generateGuildName,
} from "../src/core/systems/workforce/guildFormation";
import { GuildType } from "../src/core/models/Guild";
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

const createColonist = (overrides: Partial<Colonist> = {}): Colonist => ({
  id: "test_1",
  name: "Test Colonist",
  role: ColonistRole.UNASSIGNED,
  experience: 0,
  masteryLevel: MasteryLevel.NOVICE,
  skills: [],
  ...overrides,
});

describe("determineGuildType", () => {
  it("should return PROFESSIONAL when all founders share a role", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
      createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.PROFESSIONAL);
  });

  it("should return RESEARCH when average mastery >= SKILLED", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.SKILLED }),
      createColonist({
        id: "c2",
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.EXPERT,
      }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.RESEARCH);
  });

  it("should return SOCIAL when founders share arrival cohort", () => {
    const founders = [
      createColonist({
        id: "c1",
        role: ColonistRole.RESEARCH,
        masteryLevel: MasteryLevel.NOVICE,
        arrivalSol: 50,
      }),
      createColonist({
        id: "c2",
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.NOVICE,
        arrivalSol: 50,
      }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.SOCIAL);
  });

  it("should return CIVIC as fallback", () => {
    const founders = [
      createColonist({
        id: "c1",
        role: ColonistRole.RESEARCH,
        masteryLevel: MasteryLevel.NOVICE,
        arrivalSol: 10,
      }),
      createColonist({
        id: "c2",
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.NOVICE,
        arrivalSol: 100,
      }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.CIVIC);
  });

  it("should not return PROFESSIONAL for UNASSIGNED role", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.UNASSIGNED }),
      createColonist({ id: "c2", role: ColonistRole.UNASSIGNED }),
    ];

    expect(determineGuildType(founders)).not.toBe(GuildType.PROFESSIONAL);
  });
});

describe("generateGuildName", () => {
  it("should generate a name from suggestions", () => {
    const usedNames = new Set<string>();
    const name = generateGuildName(GuildType.SOCIAL, usedNames);

    expect(name).toBeTruthy();
    expect(typeof name).toBe("string");
  });

  it("should append suffix for duplicate names", () => {
    const usedNames = new Set([
      "Movie Night Club",
      "Board Game Society",
      "Fitness Group",
      "Music Ensemble",
      "Book Club",
      "Cooking Circle",
    ]);
    const name = generateGuildName(GuildType.SOCIAL, usedNames);

    expect(name).toMatch(/ II$/);
  });
});
