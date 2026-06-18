import { describe, test, expect, it } from "bun:test";
import {
  availableNodes,
  applyBuild,
  isWon,
  policyStrengthFor,
  recheckActiveClear,
  type CrisisTree,
  type CrisisTreeState,
  type PolicyStrengthView,
} from "../src/core/engine/crisisTree.ts";
import { SETTINGS } from "../src/core/settings/index.ts";
import { getPolicy } from "../src/core/data/policies.ts";
import type { PolicySlot, ProjectUnlock } from "../src/core/types.ts";
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
      policyStrength: 2,
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

// -------------------------------------------------------------------------
// Doctrine policyStrength teeth: a requireSameIdeology node with policyStrength
// clears ONLY once its build requirements are met AND the bound ideology has
// that many slotted policy cards (stacks counted).
// -------------------------------------------------------------------------

const policySlot = (id: string, stacks = 1): PolicySlot => ({ card: getPolicy(id), stacks });
const policyView = (...slots: PolicySlot[]): PolicyStrengthView => ({ tableau: slots });

describe("policyStrengthFor", () => {
  test("counts slotted same-ideology cards including stacks; 0 for absent/undefined", () => {
    // mobilize + solidarity-forever are solidarity; mandate is sovereignty.
    const view = policyView(policySlot("mobilize", 2), policySlot("mandate", 1));
    expect(policyStrengthFor(view, "solidarity")).toBe(2); // 2 stacks of one solidarity card
    expect(policyStrengthFor(view, "sovereignty")).toBe(1);
    expect(policyStrengthFor(view, "heritage")).toBe(0); // none slotted
    expect(policyStrengthFor(undefined, "solidarity")).toBe(0);
  });

  test("sums distinct same-color slots", () => {
    const view = policyView(policySlot("mobilize", 1), policySlot("solidarity-forever", 2));
    expect(policyStrengthFor(view, "solidarity")).toBe(3);
  });
});

describe("applyBuild — Doctrine policyStrength gate", () => {
  // capital: requireSameIdeology, requirements [{any,5}], policyStrength 2.
  function boundFiveBuilds(view?: PolicyStrengthView): CrisisTreeState {
    let state: CrisisTreeState = {
      ...seed("capital"),
      cleared: ["settlement"],
      boundIdeology: { capital: "solidarity" },
    };
    for (let i = 0; i < 5; i++) {
      state = applyBuild(TREE, state, mkUnlock("pair", "solidarity"), 1, view);
    }
    return state;
  }

  test("does NOT clear on builds alone — 5 on-color builds, no policies", () => {
    const state = boundFiveBuilds(); // no policy view → strength 0
    expect(state.progress.capital).toEqual([5]); // build requirement satisfied
    expect(state.cleared).not.toContain("capital"); // but policy gate blocks the clear
  });

  test("does NOT clear when slotted policy strength is below the threshold", () => {
    const state = boundFiveBuilds(policyView(policySlot("mobilize", 1))); // strength 1 < 2
    expect(state.progress.capital).toEqual([5]);
    expect(state.cleared).not.toContain("capital");
  });

  test("does NOT clear when the slotted policies are the WRONG color", () => {
    // 2 sovereignty policies do nothing for a solidarity-bound node.
    const state = boundFiveBuilds(policyView(policySlot("mandate", 2)));
    expect(state.cleared).not.toContain("capital");
  });

  test("clears on the build that completes builds when policy strength is already met", () => {
    const view = policyView(policySlot("mobilize", 2)); // solidarity strength 2 == threshold
    const state = boundFiveBuilds(view);
    expect(state.progress.capital).toEqual([5]);
    expect(state.cleared).toContain("capital");
    expect(isWon(TREE, state)).toBe(true);
  });
});

describe("recheckActiveClear — Doctrine clears when policies are slotted post-build", () => {
  function buildsMetNoPolicies(): CrisisTreeState {
    const state = (() => {
      let s: CrisisTreeState = {
        ...seed("capital"),
        cleared: ["settlement"],
        boundIdeology: { capital: "solidarity" },
      };
      for (let i = 0; i < 5; i++) s = applyBuild(TREE, s, mkUnlock("pair", "solidarity"), 1);
      return s;
    })();
    expect(state.cleared).not.toContain("capital"); // builds met, policy gate open
    return state;
  }

  test("a no-op until policy strength reaches the threshold, then clears", () => {
    const state = buildsMetNoPolicies();
    // Below threshold: unchanged (same reference, nothing cleared).
    const still = recheckActiveClear(TREE, state, policyView(policySlot("mobilize", 1)));
    expect(still.cleared).not.toContain("capital");
    // At threshold: clears without any new build.
    const won = recheckActiveClear(TREE, state, policyView(policySlot("mobilize", 2)));
    expect(won.cleared).toContain("capital");
    expect(isWon(TREE, won)).toBe(true);
  });

  test("wrong-color policies never clear the node", () => {
    const state = buildsMetNoPolicies();
    const after = recheckActiveClear(TREE, state, policyView(policySlot("mandate", 2)));
    expect(after.cleared).not.toContain("capital");
  });

  test("is a no-op for a node whose build requirements are NOT yet met", () => {
    let state: CrisisTreeState = {
      ...seed("capital"),
      cleared: ["settlement"],
      boundIdeology: { capital: "solidarity" },
    };
    state = applyBuild(TREE, state, mkUnlock("pair", "solidarity"), 1); // only 1/5 builds
    const after = recheckActiveClear(TREE, state, policyView(policySlot("mobilize", 2)));
    expect(after.cleared).not.toContain("capital");
  });

  test("does not touch a non-Doctrine active node", () => {
    // industry has no policyStrength; recheck is a pure no-op for it.
    let state: CrisisTreeState = { ...seed("industry"), cleared: ["settlement"] };
    for (let i = 0; i < 8; i++) state = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(state.cleared).toContain("industry"); // cleared on builds alone (no policy gate)
    // recheck against any tableau leaves it exactly as-is.
    const after = recheckActiveClear(TREE, state, policyView(policySlot("mandate", 5)));
    expect(after).toBe(state); // already cleared → untouched reference
  });
});

describe("applyBuild — non-Doctrine nodes are unaffected by policy", () => {
  test("a node without policyStrength still clears on builds alone, no tableau needed", () => {
    let state: CrisisTreeState = { ...seed("industry"), cleared: ["settlement"] };
    for (let i = 0; i < 8; i++) state = applyBuild(TREE, state, mkUnlock("high-card"), 1);
    expect(state.cleared).toContain("industry");
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

// -------------------------------------------------------------------------
// P3 integration: Epoch seeding, setActiveObjective, buildColumn hook
// -------------------------------------------------------------------------

import { GameAPI } from "../src/facade/GameAPI.ts";
import { createEpoch } from "../src/core/engine/epoch.ts";
import { setActiveObjective, buildColumn, enactPolicies } from "../src/core/engine/commands.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { getCard, landId } from "../src/core/data/cards.ts";

describe("crisisTree — Epoch seeding (P3)", () => {
  test("createEpoch seeds activeNodeId=rootId, empty cleared, zeroed progress per req", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(1), 1);
    const tree = setting.crisisTree;
    expect(ep.crisisTree.activeNodeId).toBe(tree.rootId);
    expect(ep.crisisTree.cleared).toEqual([]);
    expect(ep.crisisTree.boundIdeology).toEqual({});
    // progress has one zero-filled array per node, sized to its requirements.
    for (const [id, node] of Object.entries(tree.nodes)) {
      expect(ep.crisisTree.progress[id]).toEqual(node.requirements.map(() => 0));
    }
  });
});

describe("setActiveObjective (P3)", () => {
  test("rejects a node that is not currently available", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(1), 1);
    const tree = setting.crisisTree;
    // A child of the (uncleared) root is locked: not in availableNodes yet.
    const lockedChild = tree.nodes[tree.rootId].unlocks[0];
    const r = setActiveObjective(ep, setting, lockedChild);
    expect(r.ok).toBe(false);
    // The root itself is available.
    const ok = setActiveObjective(ep, setting, tree.rootId);
    expect(ok.ok).toBe(true);
    expect(ep.crisisTree.activeNodeId).toBe(tree.rootId);
  });

  test("a requireSameIdeology (Doctrine) node binds its ideology on activation", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(1), 1);
    const tree = setting.crisisTree;
    // Force the doctrine child into the available set by marking the root cleared.
    ep.crisisTree.cleared = [tree.rootId];
    // availableNodes returns ObjectiveNode[]; find the doctrine node by its flag.
    const doctrine = availableNodes(tree, ep.crisisTree).find((n) => n.requireSameIdeology);
    if (!doctrine) throw new Error("expected a requireSameIdeology node");
    // Missing ideology is rejected; supplying one binds it.
    const bad = setActiveObjective(ep, setting, doctrine.id);
    expect(bad.ok).toBe(false);
    const good = setActiveObjective(ep, setting, doctrine.id, "solidarity");
    expect(good.ok).toBe(true);
    expect(ep.crisisTree.activeNodeId).toBe(doctrine.id);
    expect(ep.crisisTree.boundIdeology[doctrine.id]).toBe("solidarity");
  });
});

describe("buildColumn advances the active node (P3)", () => {
  // Build a two-pair (the root recipe's first requirement) directly in column 0,
  // set the root active, build, and assert the matching requirement advanced.
  test("a build matching the active root recipe advances its progress", () => {
    const api = new GameAPI(99, { skipLoad: true, forceSettingId: "homeworld" });
    // Reach into core state directly because this test targets the tree hook,
    // not the placement UX.
    const ep = (api as unknown as { epoch: ReturnType<typeof createEpoch> }).epoch;
    const setting = (api as unknown as { setting: ReturnType<typeof getSetting> }).setting;
    const rng = (api as unknown as { rng: ReturnType<typeof createRng> }).rng;
    ep.crisisTree.activeNodeId = setting.crisisTree.rootId;
    // A land-row pair (rank 7 solidarity) + an influence-row pair (rank 9
    // heritage) is the canonical two-pair (pair in each row). Two distinct
    // ideologies keep it off a flush; pass a promote arg (C2 — never argless on
    // a >=2-ideology column).
    const col = ep.columns[0];
    col.lands.cards.push(getCard(landId(7, "solidarity")), getCard(landId(7, "solidarity")));
    col.influence.cards.push(getCard(landId(9, "heritage")), getCard(landId(9, "heritage")));
    const before = [...ep.crisisTree.progress[setting.crisisTree.rootId]];
    const r = buildColumn(ep, setting, 0, rng, "solidarity");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pattern).toBe("two-pair");
    const after = ep.crisisTree.progress[setting.crisisTree.rootId];
    // The two-pair requirement index advanced by exactly 1; total progress rose.
    const advanced = after.reduce((s, n) => s + n, 0) - before.reduce((s, n) => s + n, 0);
    expect(advanced).toBe(1);
  });
});

describe("enactPolicies clears a Doctrine policyStrength node post-build (P3)", () => {
  // The homeworld Capital node: requireSameIdeology, requirements [{any,5}],
  // policyStrength 2. Drive it through core commands: bind solidarity, satisfy
  // the 5 on-color builds (the build path passes the empty tableau, so it does
  // NOT clear), then slot 2 solidarity policies via enactPolicies and assert the
  // node clears with no further build.
  test("builds alone leave it open; slotting 2 same-color policies clears it", () => {
    const setting = getSetting("homeworld");
    const ep = createEpoch(setting, createCampaign(1), createRng(7), 1);
    // Activate Capital directly (it is gated behind the root in normal play).
    ep.crisisTree.activeNodeId = "capital";
    ep.crisisTree.boundIdeology = { capital: "solidarity" };
    ep.crisisTree.cleared = [setting.crisisTree.rootId];

    // Five solidarity-promoted builds (any pattern; use a same-rank pair).
    for (let i = 0; i < 5; i++) {
      const unlock = {
        projectId: `p-${i}`,
        pattern: "pair" as const,
        turn: 1,
        cards: [getCard(landId(5, "solidarity")), getCard(landId(5, "solidarity"))],
        promotedIdeology: "solidarity" as const,
      };
      ep.crisisTree = applyBuildViaCommand(ep, setting, unlock);
    }
    // Build requirement met, but the empty tableau keeps the node OPEN.
    expect(ep.crisisTree.progress.capital).toEqual([5]);
    expect(ep.crisisTree.cleared).not.toContain("capital");

    // Now stage two solidarity policy candidates and enact them.
    ep.turnPhase = "policy";
    ep.policy.candidates = [getPolicy("mobilize"), getPolicy("mobilize")];
    const r = enactPolicies(ep, setting, ["mobilize", "mobilize"]);
    expect(r.ok).toBe(true);
    // Two slotted solidarity stacks → strength 2 == threshold → node clears.
    expect(policyStrengthFor(ep.policy, "solidarity")).toBe(2);
    expect(ep.crisisTree.cleared).toContain("capital");
    expect(isWon(setting.crisisTree, ep.crisisTree)).toBe(true);
  });
});

// Helper: run the buildColumn tree hook in isolation (no column placement) by
// driving applyBuild exactly as buildColumn does — passing the live tableau.
function applyBuildViaCommand(
  ep: ReturnType<typeof createEpoch>,
  setting: ReturnType<typeof getSetting>,
  unlock: ProjectUnlock,
): CrisisTreeState {
  ep.unlockedProjects.push(unlock);
  const count = ep.unlockedProjects.filter((u) => u.projectId === unlock.projectId).length;
  return applyBuild(setting.crisisTree, ep.crisisTree, unlock, count, ep.policy);
}
