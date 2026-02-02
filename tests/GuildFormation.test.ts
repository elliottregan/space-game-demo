// tests/GuildFormation.test.ts
import { describe, it, expect } from "bun:test";
import {
  determineGuildType,
  generateGuildName,
  findEligibleFounderGroups,
  calculateFormationProbability,
} from "../src/core/systems/workforce/guildFormation";
import { GuildType } from "../src/core/models/Guild";
import type { CoworkerRelationship } from "../src/core/systems/workforce/types";
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

describe("findEligibleFounderGroups", () => {
  const createRelationship = (strength: number): CoworkerRelationship => ({
    strength,
    formedAt: 0,
    lastWorkedTogether: 0,
  });

  it("should find a group of connected colonists above threshold", () => {
    const colonists = [
      createColonist({ id: "c1" }),
      createColonist({ id: "c2" }),
      createColonist({ id: "c3" }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
      ["c1:c3", createRelationship(0.75)],
      ["c2:c3", createRelationship(0.9)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].length).toBe(3);
  });

  it("should exclude colonists at max guild memberships", () => {
    const colonists = [
      createColonist({ id: "c1", guildIds: ["g1", "g2", "g3"] }), // at max
      createColonist({ id: "c2" }),
      createColonist({ id: "c3" }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
      ["c2:c3", createRelationship(0.9)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    // c1 excluded, so only c2-c3 pair possible
    expect(groups.length).toBe(1);
    expect(groups[0]).not.toContain("c1");
  });

  it("should exclude pairs that already share a guild", () => {
    const colonists = [
      createColonist({ id: "c1", guildIds: ["shared_guild"] }),
      createColonist({ id: "c2", guildIds: ["shared_guild"] }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups.length).toBe(0);
  });

  it("should return empty when no relationships above threshold", () => {
    const colonists = [createColonist({ id: "c1" }), createColonist({ id: "c2" })];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.5)], // below 0.7
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups.length).toBe(0);
  });

  it("should cap group size at 4", () => {
    const colonists = [
      createColonist({ id: "c1" }),
      createColonist({ id: "c2" }),
      createColonist({ id: "c3" }),
      createColonist({ id: "c4" }),
      createColonist({ id: "c5" }),
    ];
    // All strongly connected
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
      ["c1:c3", createRelationship(0.8)],
      ["c1:c4", createRelationship(0.8)],
      ["c1:c5", createRelationship(0.8)],
      ["c2:c3", createRelationship(0.8)],
      ["c2:c4", createRelationship(0.8)],
      ["c2:c5", createRelationship(0.8)],
      ["c3:c4", createRelationship(0.8)],
      ["c3:c5", createRelationship(0.8)],
      ["c4:c5", createRelationship(0.8)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups[0].length).toBeLessThanOrEqual(4);
  });
});

describe("calculateFormationProbability", () => {
  it("should return base probability for founders with no guilds", () => {
    const founders = [createColonist({ id: "c1" }), createColonist({ id: "c2" })];

    const prob = calculateFormationProbability(founders, 0.5, 0.5);

    expect(prob).toBe(0.5);
  });

  it("should apply penalty for each existing membership", () => {
    const founders = [
      createColonist({ id: "c1", guildIds: ["g1"] }), // 1 guild
      createColonist({ id: "c2" }), // 0 guilds
    ];

    const prob = calculateFormationProbability(founders, 0.5, 0.5);

    // 0.5 * 0.5 (c1's penalty) * 1.0 (c2 no penalty) = 0.25
    expect(prob).toBe(0.25);
  });

  it("should compound penalties for multiple memberships", () => {
    const founders = [
      createColonist({ id: "c1", guildIds: ["g1", "g2"] }), // 2 guilds
      createColonist({ id: "c2", guildIds: ["g3"] }), // 1 guild
    ];

    const prob = calculateFormationProbability(founders, 0.5, 0.5);

    // 0.5 * (0.5^2) * (0.5^1) = 0.5 * 0.25 * 0.5 = 0.0625
    expect(prob).toBeCloseTo(0.0625);
  });
});
