import { describe, test, expect } from "bun:test";
import { buildProjectTree } from "../src/renderer/util/projectTree.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
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

describe("buildProjectTree", () => {
  test("returns one node per authored project, in PATTERNS_IN_ORDER", () => {
    const nodes = buildProjectTree(PROJECTS, []);
    expect(nodes.length).toBe(PATTERNS_IN_ORDER.length);
    expect(nodes.map((n) => n.pattern)).toEqual(PATTERNS_IN_ORDER);
  });

  test("unbuilt nodes are dimmed goals: built=false, count=0, no turn", () => {
    const nodes = buildProjectTree(PROJECTS, []);
    for (const n of nodes) {
      expect(n.built).toBe(false);
      expect(n.buildCount).toBe(0);
      expect(n.firstBuiltTurn).toBeNull();
    }
  });

  test("built node carries count and earliest build turn", () => {
    const nodes = buildProjectTree(PROJECTS, [unlock("pair", 5), unlock("pair", 3)]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.built).toBe(true);
    expect(pair?.buildCount).toBe(2);
    expect(pair?.firstBuiltTurn).toBe(3);
    const flush = nodes.find((n) => n.pattern === "flush");
    expect(flush?.built).toBe(false);
  });

  test("carries the project name, value, and a human requirement label", () => {
    const nodes = buildProjectTree(PROJECTS, []);
    const straight = nodes.find((n) => n.pattern === "straight");
    expect(straight?.name).toBe("Project straight");
    expect(straight?.value).toBe(5);
    expect(straight?.requirement).toBe("Straight");
  });

  test("skips patterns with no authored project", () => {
    const partial = PROJECTS.filter((p) => p.pattern !== "royal-flush");
    const nodes = buildProjectTree(partial, []);
    expect(nodes.find((n) => n.pattern === "royal-flush")).toBeUndefined();
    expect(nodes.length).toBe(PATTERNS_IN_ORDER.length - 1);
  });

  test("built nodes carry leveled contributed value", () => {
    // pair is index 1 → base value 2 → levels [2,1,1]
    const nodes = buildProjectTree(PROJECTS, [unlock("pair", 1), unlock("pair", 2)]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.buildCount).toBe(2);
    expect(pair?.contributedValue).toBe(3); // 2 + 1
  });
});
