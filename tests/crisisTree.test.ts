import { describe, test, expect, it } from "bun:test";
import {
  availableNodes,
  applyBuild,
  isWon,
  type CrisisTree,
  type CrisisTreeState,
} from "../src/core/engine/crisisTree.ts";
import { SETTINGS } from "../src/core/settings/index.ts";
import type { ProjectUnlock } from "../src/core/types.ts";
import type { PatternKind } from "../src/core/types.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";

// A small §6-Homeworld-shaped tree: root "settlement" gates three terminals.
const TREE: CrisisTree = {
  rootId: "settlement",
  nodes: {
    settlement: {
      id: "settlement",
      name: "Settlement",
      branch: "establish",
      requirements: [
        { pattern: "two-pair", count: 4 },
        { pattern: "high-card", count: 4 },
      ],
      unlocks: ["industry", "capital", "monument"],
      terminal: false,
    },
    industry: {
      id: "industry",
      name: "Industry",
      branch: "expansion",
      requirements: [{ pattern: "any", count: 8 }],
      unlocks: [],
      terminal: true,
    },
    capital: {
      id: "capital",
      name: "Capital",
      branch: "doctrine",
      requirements: [{ pattern: "any", count: 5 }],
      requireSameIdeology: true,
      unlocks: [],
      terminal: true,
    },
    monument: {
      id: "monument",
      name: "Monument",
      branch: "wonder",
      requirements: [
        { pattern: "straight", count: 1 },
        { pattern: "two-pair", count: 1 },
        { pattern: "flush", count: 1, upgrade: true },
      ],
      unlocks: [],
      terminal: true,
    },
  },
};

// Seed a fresh CrisisTreeState for TREE (zeroed progress sized per node).
function seed(activeNodeId: string | null = TREE.rootId): CrisisTreeState {
  const progress: Record<string, number[]> = {};
  for (const id of Object.keys(TREE.nodes)) {
    progress[id] = TREE.nodes[id].requirements.map(() => 0);
  }
  return { activeNodeId, cleared: [], progress, boundIdeology: {} };
}

// Minimal ProjectUnlock literal — applyBuild reads only pattern + promotedIdeology.
function mkUnlock(pattern: PatternKind, promotedIdeology: Ideology | null = null): ProjectUnlock {
  return { projectId: `p-${pattern}`, pattern, turn: 1, cards: [], promotedIdeology };
}

describe("availableNodes", () => {
  test("returns only the root initially", () => {
    const state = seed();
    expect(availableNodes(TREE, state).map((n) => n.id)).toEqual(["settlement"]);
  });

  test("exposes children once their parent is cleared, never a cleared node", () => {
    const state: CrisisTreeState = { ...seed(), cleared: ["settlement"] };
    const ids = availableNodes(TREE, state)
      .map((n) => n.id)
      .sort();
    expect(ids).toEqual(["capital", "industry", "monument"]);
    expect(ids).not.toContain("settlement");
  });

  test("a node whose parent is not cleared is not available", () => {
    const state = seed();
    expect(availableNodes(TREE, state).map((n) => n.id)).not.toContain("industry");
  });
});

describe("applyBuild — matching + advancement", () => {
  test("advances only the active node's matching requirements", () => {
    const state = seed("settlement");
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    // two-pair is requirement index 0; high-card index 1 untouched.
    expect(next.progress.settlement).toEqual([1, 0]);
  });

  test("a build matching no requirement of the active node is a no-op", () => {
    const state = seed("settlement");
    const next = applyBuild(TREE, state, mkUnlock("flush"), 1);
    expect(next.progress.settlement).toEqual([0, 0]);
    expect(next.cleared).toEqual([]);
  });

  test("pattern 'any' matches any pattern", () => {
    const state: CrisisTreeState = { ...seed("industry"), cleared: ["settlement"] };
    const next = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(next.progress.industry).toEqual([1]);
  });

  test("an active node only advances itself, not other available nodes", () => {
    const state: CrisisTreeState = { ...seed("industry"), cleared: ["settlement"] };
    // two-pair would match settlement's recipe, but settlement is cleared and
    // industry is active; industry's {any} matches, settlement is untouched.
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(next.progress.industry).toEqual([1]);
    expect(next.progress.settlement).toEqual([0, 0]);
  });

  test("activeNodeId === null is a no-op", () => {
    const state = seed(null);
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(next.progress.settlement).toEqual([0, 0]);
    expect(next.cleared).toEqual([]);
  });
});

describe("applyBuild — upgrade requirement", () => {
  test("upgrade:true requires projectBuildCount >= 2", () => {
    const state: CrisisTreeState = { ...seed("monument"), cleared: ["settlement"] };
    // monument req index 2 is { flush, count 1, upgrade }. First flush build
    // (count 1) does NOT advance it.
    const first = applyBuild(TREE, state, mkUnlock("flush"), 1);
    expect(first.progress.monument).toEqual([0, 0, 0]);
    // Second flush build of the same project id (count 2) DOES advance it.
    const second = applyBuild(TREE, first, mkUnlock("flush"), 2);
    expect(second.progress.monument).toEqual([0, 0, 1]);
  });
});

describe("applyBuild — requireSameIdeology binding", () => {
  test("only counts builds whose promotedIdeology === boundIdeology[node]", () => {
    const bound: Record<string, Ideology> = { capital: "solidarity" };
    const state: CrisisTreeState = {
      ...seed("capital"),
      cleared: ["settlement"],
      boundIdeology: bound,
    };
    // off-color build: does not count.
    const off = applyBuild(TREE, state, mkUnlock("pair", "heritage"), 1);
    expect(off.progress.capital).toEqual([0]);
    // on-color build: counts.
    const on = applyBuild(TREE, state, mkUnlock("pair", "solidarity"), 1);
    expect(on.progress.capital).toEqual([1]);
    // null promotion never counts toward a bound node.
    const none = applyBuild(TREE, state, mkUnlock("pair", null), 1);
    expect(none.progress.capital).toEqual([0]);
  });
});

describe("applyBuild — clearing + unlocks", () => {
  test("clears the node and appends its unlocks when all requirements hit count", () => {
    let state: CrisisTreeState = seed("settlement");
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(state.cleared).toEqual([]); // high-card req not yet met
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(state.cleared).toContain("settlement");
    // children are now available
    const ids = availableNodes(TREE, state)
      .map((n) => n.id)
      .sort();
    expect(ids).toEqual(["capital", "industry", "monument"]);
  });

  test("does not double-clear an already-cleared node", () => {
    let state: CrisisTreeState = seed("settlement");
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    for (let i = 0; i < 4; i++) state = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(state.cleared.filter((id) => id === "settlement")).toHaveLength(1);
    // a further matching build (active node still settlement) is a no-op on cleared
    const after = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(after.cleared.filter((id) => id === "settlement")).toHaveLength(1);
  });
});

describe("applyBuild — purity", () => {
  test("returns a new state and does not mutate the input", () => {
    const state = seed("settlement");
    const snapshotProgress = [...state.progress.settlement];
    const next = applyBuild(TREE, state, mkUnlock("two-pair"), 1);
    expect(next).not.toBe(state);
    expect(next.progress).not.toBe(state.progress);
    expect(next.progress.settlement).not.toBe(state.progress.settlement);
    expect(next.cleared).not.toBe(state.cleared);
    // input untouched
    expect(state.progress.settlement).toEqual(snapshotProgress);
  });
});

describe("isWon", () => {
  test("false until a terminal node is cleared", () => {
    const state = seed();
    expect(isWon(TREE, state)).toBe(false);
    const rootCleared: CrisisTreeState = { ...state, cleared: ["settlement"] };
    expect(isWon(TREE, rootCleared)).toBe(false); // settlement is not terminal
  });

  test("true iff any cleared node is terminal", () => {
    const state: CrisisTreeState = { ...seed(), cleared: ["settlement", "industry"] };
    expect(isWon(TREE, state)).toBe(true);
  });
});

/** Walk the DAG from the root, collecting every reachable node id. */
function reachableFrom(tree: CrisisTree): Set<string> {
  const seen = new Set<string>();
  const stack = [tree.rootId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = tree.nodes[id];
    if (node) stack.push(...node.unlocks);
  }
  return seen;
}

describe("authored Setting crisisTrees", () => {
  for (const setting of SETTINGS) {
    const tree = setting.crisisTree;

    describe(setting.id, () => {
      it("has a rootId that resolves to a node", () => {
        expect(tree.nodes[tree.rootId]).toBeDefined();
      });

      it("has exactly one establish-branch root and it is the rootId", () => {
        const establishNodes = Object.values(tree.nodes).filter((n) => n.branch === "establish");
        expect(establishNodes).toHaveLength(1);
        expect(establishNodes[0]!.id).toBe(tree.rootId);
      });

      it("has every unlocks id resolve to a node in nodes", () => {
        for (const node of Object.values(tree.nodes)) {
          for (const childId of node.unlocks) {
            expect(tree.nodes[childId]).toBeDefined();
          }
        }
      });

      it("declares each node's own id consistently with its key", () => {
        for (const [key, node] of Object.entries(tree.nodes)) {
          expect(node.id).toBe(key);
        }
      });

      it("has at least one terminal node reachable from the root", () => {
        const reachable = reachableFrom(tree);
        const reachableTerminals = [...reachable].filter((id) => tree.nodes[id]?.terminal);
        expect(reachableTerminals.length).toBeGreaterThan(0);
      });

      it("gives every node at least one count-bearing requirement", () => {
        for (const node of Object.values(tree.nodes)) {
          expect(node.requirements.length).toBeGreaterThan(0);
          for (const req of node.requirements) {
            expect(req.count).toBeGreaterThan(0);
          }
        }
      });

      it("uses only count-bearing (non-upgrade-only) reqs on requireSameIdeology nodes", () => {
        for (const node of Object.values(tree.nodes)) {
          if (!node.requireSameIdeology) continue;
          // A Doctrine node binds a single ideology and counts builds of that
          // color; an upgrade-only requirement can't be expressed as a simple
          // per-ideology count, so forbid `upgrade` on these nodes.
          for (const req of node.requirements) {
            expect(req.upgrade ?? false).toBe(false);
          }
        }
      });
    });
  }
});
