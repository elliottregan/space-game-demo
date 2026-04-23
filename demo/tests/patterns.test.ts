import { describe, test, expect } from "bun:test";
import {
  completionTier,
  describeRequirement,
  evaluateMegaStructure,
  scoreMegaStructure,
} from "../src/core/patterns.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";
import { HOMEWORLD } from "../src/core/homeworld.ts";
import type { Card } from "../src/core/types.ts";

const c = (id: string): Card => getCard(id);

describe("evaluateMegaStructure — The Commune (flush)", () => {
  const commune = HOMEWORLD.megaProjects.find((p) => p.id === "the-commune")!;

  test("empty hand cannot play", () => {
    const e = evaluateMegaStructure(commune, []);
    expect(e.canPlay).toBe(false);
  });

  test("5 Solidarity + charter: playable", () => {
    const hand: Card[] = [
      c(roleId("agitator", "solidarity")),
      c(roleId("scholar", "solidarity")),
      c(roleId("engineer", "solidarity")),
      c(landId(3, "solidarity")),
      c(landId(4, "solidarity")),
      c("keystone-founding-charter"),
    ];
    const e = evaluateMegaStructure(commune, hand);
    expect(e.canPlay).toBe(true);
    expect(e.consumableCards.length).toBe(6);
  });

  test("5 Solidarity but no charter: not playable, progress mentions keystone", () => {
    const hand: Card[] = [
      c(roleId("agitator", "solidarity")),
      c(roleId("scholar", "solidarity")),
      c(roleId("engineer", "solidarity")),
      c(landId(3, "solidarity")),
      c(landId(4, "solidarity")),
    ];
    const e = evaluateMegaStructure(commune, hand);
    expect(e.canPlay).toBe(false);
    expect(e.progress).toMatch(/charter/i);
  });

  test("4 Solidarity + charter: still short", () => {
    const hand: Card[] = [
      c(roleId("agitator", "solidarity")),
      c(roleId("scholar", "solidarity")),
      c(roleId("engineer", "solidarity")),
      c(landId(3, "solidarity")),
      c("keystone-founding-charter"),
    ];
    const e = evaluateMegaStructure(commune, hand);
    expect(e.canPlay).toBe(false);
  });
});

describe("evaluateMegaStructure — The Reactor (four-of-a-kind engineers)", () => {
  const reactor = HOMEWORLD.megaProjects.find((p) => p.id === "the-reactor")!;

  test("all 4 engineers + critical mass: playable", () => {
    const hand: Card[] = [
      c(roleId("engineer", "solidarity")),
      c(roleId("engineer", "sovereignty")),
      c(roleId("engineer", "transformation")),
      c(roleId("engineer", "heritage")),
      c("keystone-critical-mass"),
    ];
    const e = evaluateMegaStructure(reactor, hand);
    expect(e.canPlay).toBe(true);
    expect(e.consumableCards.length).toBe(5);
  });

  test("3 engineers + critical mass: not playable", () => {
    const hand: Card[] = [
      c(roleId("engineer", "solidarity")),
      c(roleId("engineer", "sovereignty")),
      c(roleId("engineer", "transformation")),
      c("keystone-critical-mass"),
    ];
    const e = evaluateMegaStructure(reactor, hand);
    expect(e.canPlay).toBe(false);
  });
});

describe("evaluateMegaStructure — The Ark (straight 11-13)", () => {
  const ark = HOMEWORLD.megaProjects.find((p) => p.id === "the-ark")!;

  test("Scholar + Preacher + Engineer (any suits) + compass: playable", () => {
    const hand: Card[] = [
      c(roleId("scholar", "transformation")),
      c(roleId("preacher", "heritage")),
      c(roleId("engineer", "sovereignty")),
      c("keystone-navigators-compass"),
    ];
    const e = evaluateMegaStructure(ark, hand);
    expect(e.canPlay).toBe(true);
  });

  test("missing Preacher: not playable", () => {
    const hand: Card[] = [
      c(roleId("scholar", "transformation")),
      c(roleId("engineer", "sovereignty")),
      c("keystone-navigators-compass"),
    ];
    const e = evaluateMegaStructure(ark, hand);
    expect(e.canPlay).toBe(false);
  });
});

describe("scoring + tier", () => {
  test("rank sum and tier derivation", () => {
    const cards = [c(roleId("scholar", "solidarity")), c("keystone-founding-charter")];
    expect(scoreMegaStructure(cards)).toBe(11 + 15);
  });
  test("completion tier", () => {
    expect(completionTier(40)).toBe("bronze");
    expect(completionTier(50)).toBe("silver");
    expect(completionTier(80)).toBe("gold");
    expect(completionTier(105)).toBe("platinum");
  });
});

describe("describeRequirement", () => {
  test("renders a short human description", () => {
    const commune = HOMEWORLD.megaProjects.find((p) => p.id === "the-commune")!;
    expect(describeRequirement(commune)).toMatch(/flush/i);
  });
});
