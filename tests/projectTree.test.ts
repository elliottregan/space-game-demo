import { describe, test, expect } from "bun:test";
import { buildProjectTree } from "../src/renderer/util/projectTree.ts";
import type { Ideology } from "../src/core/types.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import { zeroIdeologyBreakdown } from "../src/core/data/ideologies.ts";
import { PATTERNS_IN_ORDER } from "../src/core/data/projects.ts";
import type { KeystoneProject, ProjectUnlock } from "../src/core/types.ts";

const PROJECTS: KeystoneProject[] = PATTERNS_IN_ORDER.map((pattern, i) => ({
  id: `test-${pattern}`,
  pattern,
  name: `Project ${pattern}`,
  flavor: "",
  value: i + 1,
}));

function unlock(pattern: ProjectUnlock["pattern"], turn: number): ProjectUnlock {
  return {
    projectId: `test-${pattern}`,
    pattern,
    turn,
    cards: [getCard(landId(7, "solidarity"))],
  };
}

function unlockWith(
  pattern: ProjectUnlock["pattern"],
  turn: number,
  cards: ProjectUnlock["cards"],
): ProjectUnlock {
  return { projectId: `test-${pattern}`, pattern, turn, cards };
}

describe("buildProjectTree", () => {
  test("returns one node per authored project, in PATTERNS_IN_ORDER", () => {
    const { nodes } = buildProjectTree(PROJECTS, []);
    expect(nodes.length).toBe(PATTERNS_IN_ORDER.length);
    expect(nodes.map((n) => n.pattern)).toEqual(PATTERNS_IN_ORDER);
  });

  test("unbuilt nodes are dimmed goals: built=false, count=0, no turn", () => {
    const { nodes } = buildProjectTree(PROJECTS, []);
    for (const n of nodes) {
      expect(n.built).toBe(false);
      expect(n.buildCount).toBe(0);
      expect(n.firstBuiltTurn).toBeNull();
    }
  });

  test("built node carries count and earliest build turn", () => {
    const { nodes } = buildProjectTree(PROJECTS, [unlock("pair", 5), unlock("pair", 3)]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.built).toBe(true);
    expect(pair?.buildCount).toBe(2);
    expect(pair?.firstBuiltTurn).toBe(3);
    const flush = nodes.find((n) => n.pattern === "flush");
    expect(flush?.built).toBe(false);
  });

  test("carries the project name, value, and a human requirement label", () => {
    const { nodes } = buildProjectTree(PROJECTS, []);
    const straight = nodes.find((n) => n.pattern === "straight");
    expect(straight?.name).toBe("Project straight");
    expect(straight?.value).toBe(5);
    expect(straight?.requirement).toBe("Straight");
  });

  test("skips patterns with no authored project", () => {
    const partial = PROJECTS.filter((p) => p.pattern !== "royal-flush");
    const { nodes } = buildProjectTree(partial, []);
    expect(nodes.find((n) => n.pattern === "royal-flush")).toBeUndefined();
    expect(nodes.length).toBe(PATTERNS_IN_ORDER.length - 1);
  });

  test("built nodes carry leveled contributed value", () => {
    // pair is index 1 → base value 2 → levels [2,1,1]
    const { nodes } = buildProjectTree(PROJECTS, [unlock("pair", 1), unlock("pair", 2)]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.buildCount).toBe(2);
    expect(pair?.contributedValue).toBe(3); // 2 + 1
  });
});

describe("buildProjectTree ideology view-model", () => {
  const L = (rank: number, ideo: Ideology) => getCard(landId(rank, ideo));

  test("built node carries per-build majority + non-wild cardIdeologies", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")]),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.majorities).toEqual(["solidarity"]);
    expect(pair?.cardIdeologies).toEqual(["solidarity", "solidarity"]);
  });

  test("wild cards are excluded from cardIdeologies", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "heritage"), getCard("keystone-pioneer")]),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.majorities).toEqual(["heritage"]);
    expect(pair?.cardIdeologies).toEqual(["heritage"]);
  });

  test("a tie yields a null majority entry but keeps both card ideologies", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(3, "heritage")]),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.majorities).toEqual([null]);
    expect(pair?.cardIdeologies).toEqual(["solidarity", "heritage"]);
  });

  test("unbuilt nodes carry no majorities and no card ideologies", () => {
    const { nodes } = buildProjectTree(PROJECTS, []);
    for (const n of nodes) {
      expect(n.majorities).toEqual([]);
      expect(n.cardIdeologies).toEqual([]);
    }
  });

  test("repeat builds carry one majority entry per build, never pooled", () => {
    // Same pattern built twice with different majorities: two distinct large counters,
    // not a pooled tie. cardIdeologies is the flat per-card list across both builds.
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")]),
      unlockWith("pair", 2, [L(3, "heritage"), L(3, "heritage")]),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.buildCount).toBe(2);
    expect(pair?.majorities).toEqual(["solidarity", "heritage"]);
    expect(pair?.cardIdeologies).toEqual(["solidarity", "solidarity", "heritage", "heritage"]);
  });

  test("the big-counter tally equals the influence readout under repeat builds", () => {
    // Spec invariant: big-counter tally per color = that ideology's influence.
    // Build the SAME pattern multiple times (mix of majorities + a tie) so the
    // per-unlock-vs-pooled boundary is crossed — this would fail under the old pooled model.
    const tree = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")]),
      unlockWith("pair", 2, [L(3, "solidarity"), L(3, "solidarity")]),
      unlockWith("pair", 3, [L(4, "heritage"), L(4, "heritage")]),
      unlockWith("pair", 4, [L(5, "solidarity"), L(6, "heritage")]), // tie → no counter
    ]);

    // Tally the rendered large counters across every node, exactly as the template does.
    const counterTally = zeroIdeologyBreakdown();
    for (const n of tree.nodes) {
      for (const maj of n.majorities) {
        if (maj) counterTally[maj] += 1;
      }
    }

    expect(counterTally).toEqual(tree.influence);
    expect(tree.influence.solidarity).toBe(2);
    expect(tree.influence.heritage).toBe(1);
  });

  test("panel influence summary counts the majority per unlock", () => {
    const { influence } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")]),
      unlockWith("two-pair", 2, [L(3, "solidarity"), L(3, "solidarity")]),
      unlockWith("three-of-a-kind", 3, [L(4, "heritage"), L(4, "heritage")]),
      unlockWith("straight", 4, [L(5, "solidarity"), L(6, "heritage")]), // tie → skipped
    ]);
    expect(influence.solidarity).toBe(2);
    expect(influence.heritage).toBe(1);
    expect(influence.sovereignty).toBe(0);
    expect(influence.transformation).toBe(0);
  });
});
