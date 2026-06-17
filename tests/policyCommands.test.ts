// B5 + Task 0.3: policy draw (start-of-turn) + phase-gated board verbs +
// enactPolicies (batch slot/discard that leaves the policy phase).
//
// Draw count scales with each ideology's majority-counter influence (drawPolicies).
// Board verbs reject while turnPhase === "policy". enactPolicies keeps the chosen
// candidate ids (stacking onto matching slots, taking free slots otherwise),
// discards the rest to their ideology piles, clears candidates, and advances to
// the play phase. The 5-slot cap counts DISTINCT new ids. removePolicy returns
// stacked copies to that deck's discard; leftover candidates are flushed on endTurn.

import { describe, test, expect } from "bun:test";
import {
  buildColumn,
  enactPolicies,
  placeCard,
  removePolicy,
} from "../src/core/engine/commands.ts";
import { drawPolicies, endTurn } from "../src/core/engine/turn.ts";
import { getPolicy } from "../src/core/data/policies.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";
import type { Epoch, PolicyCard, PolicySlot, ProjectUnlock } from "../src/core/types.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";
import { emptyPolicyState } from "./fixtures.ts";

const SETTING = getSetting("homeworld");
const campaign = createCampaign(1);

const L = (rank: number, ideo: Ideology) => getCard(landId(rank, ideo));

/** A built unlock whose projectMajority is `ideo` (a same-ideology land pair). */
function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
  return {
    projectId: `u-${ideo}-${rank}`,
    pattern: "pair",
    turn: 1,
    cards: [L(rank, ideo), L(rank, ideo)],
  };
}

const slot = (id: string, stacks = 1): PolicySlot => ({ card: getPolicy(id), stacks });

function makeEpoch(
  opts: {
    tableau?: PolicySlot[];
    candidates?: PolicyCard[];
    unlocks?: ProjectUnlock[];
    decks?: Partial<Record<Ideology, PolicyCard[]>>;
    discards?: Partial<Record<Ideology, PolicyCard[]>>;
    turnPhase?: "policy" | "play";
  } = {},
): Epoch {
  const base = emptyPolicyState();
  if (opts.decks) Object.assign(base.decks, opts.decks);
  if (opts.discards) Object.assign(base.discards, opts.discards);
  return {
    epochNumber: 1,
    settingId: SETTING.id,
    turn: 1,
    phase: "play",
    turnPhase: opts.turnPhase ?? "play",
    hand: [],
    draw: [],
    discard: [],
    columns: [],
    unlockedProjects: opts.unlocks ?? [],
    eventLog: [],
    influence: SETTING.rules.baseInfluenceBaseline,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
    policy: {
      ...base,
      tableau: opts.tableau ?? [],
      candidates: opts.candidates ?? [],
    },
  };
}

describe("drawPolicies — draw scales with influence", () => {
  test("draws ideologyInfluence[I] cards from each ideology's deck", () => {
    const ep = makeEpoch({
      // 2 solidarity unlocks → infl.solidarity = 2; 1 heritage unlock.
      unlocks: [
        influenceUnlock("solidarity", 2),
        influenceUnlock("solidarity", 3),
        influenceUnlock("heritage", 4),
      ],
      decks: {
        solidarity: [getPolicy("mobilize"), getPolicy("mobilize"), getPolicy("mobilize")],
        heritage: [getPolicy("continuity"), getPolicy("archive")],
      },
    });
    drawPolicies(ep, createRng(1));
    const cands = ep.policy.candidates;
    expect(cands.filter((c) => c.ideology === "solidarity")).toHaveLength(2);
    expect(cands.filter((c) => c.ideology === "heritage")).toHaveLength(1);
    expect(cands).toHaveLength(3);
    // 2 of 3 solidarity drawn; 1 of 2 heritage drawn.
    expect(ep.policy.decks.solidarity).toHaveLength(1);
    expect(ep.policy.decks.heritage).toHaveLength(1);
  });

  test("turn-1 cold open: zero influence draws nothing", () => {
    const ep = makeEpoch({
      decks: { solidarity: [getPolicy("mobilize"), getPolicy("mobilize")] },
    });
    drawPolicies(ep, createRng(1));
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.policy.decks.solidarity).toHaveLength(2);
  });

  test("reshuffles discard into deck when the deck empties mid-draw", () => {
    const ep = makeEpoch({
      // Need 2 solidarity draws; deck has 1, discard has 1 → reshuffle to get both.
      unlocks: [influenceUnlock("solidarity", 2), influenceUnlock("solidarity", 3)],
      decks: { solidarity: [getPolicy("mobilize")] },
      discards: { solidarity: [getPolicy("solidarity-forever")] },
    });
    drawPolicies(ep, createRng(7));
    expect(ep.policy.candidates).toHaveLength(2);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
    expect(ep.policy.decks.solidarity).toHaveLength(0);
  });

  test("when deck + discard both run dry, draws fewer than requested", () => {
    const ep = makeEpoch({
      // Need 2 solidarity draws but only 1 card total exists.
      unlocks: [influenceUnlock("solidarity", 2), influenceUnlock("solidarity", 3)],
      decks: { solidarity: [getPolicy("mobilize")] },
    });
    drawPolicies(ep, createRng(3));
    expect(ep.policy.candidates).toHaveLength(1);
    expect(ep.policy.decks.solidarity).toHaveLength(0);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
  });
});

describe("board verbs are gated to the play phase", () => {
  test("placeCard rejects while turnPhase === 'policy'", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = placeCard(ep, campaign, SETTING, "anything", 0, createRng(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Resolve drawn policies first.");
  });

  test("buildColumn rejects while turnPhase === 'policy'", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = buildColumn(ep, SETTING, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Resolve drawn policies first.");
  });

  test("removePolicy rejects while turnPhase === 'policy'", () => {
    const ep = makeEpoch({
      tableau: [slot("mandate")],
      candidates: [getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = removePolicy(ep, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Resolve drawn policies first.");
    expect(ep.policy.tableau).toHaveLength(1); // untouched
  });
});

describe("enactPolicies", () => {
  test("keeps the chosen id, discards the rest, advances to play", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize"), getPolicy("mandate"), getPolicy("archive")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, ["mobilize"]);
    expect(r.ok).toBe(true);
    // mobilize slotted.
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].card.id).toBe("mobilize");
    expect(ep.policy.tableau[0].stacks).toBe(1);
    // mandate + archive discarded to their ideologies.
    expect(ep.policy.discards.sovereignty.map((c) => c.id)).toEqual(["mandate"]);
    expect(ep.policy.discards.heritage.map((c) => c.id)).toEqual(["archive"]);
    // candidates cleared, phase advanced.
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.turnPhase).toBe("play");
  });

  test("enactPolicies([]) discards everything and advances", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize"), getPolicy("mandate")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, []);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(0);
    expect(ep.policy.discards.solidarity.map((c) => c.id)).toEqual(["mobilize"]);
    expect(ep.policy.discards.sovereignty.map((c) => c.id)).toEqual(["mandate"]);
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.turnPhase).toBe("play");
  });

  test("stacks onto a matching tableau slot (no new slot)", () => {
    const ep = makeEpoch({
      tableau: [slot("mobilize", 1)],
      candidates: [getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, ["mobilize"]);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].stacks).toBe(2);
    expect(ep.turnPhase).toBe("play");
  });

  test("two kept copies of one id consume a single slot and stack", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize"), getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, ["mobilize"]);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].card.id).toBe("mobilize");
    expect(ep.policy.tableau[0].stacks).toBe(2);
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.turnPhase).toBe("play");
  });

  test("rejects when a kept id is not among candidates (phase unchanged)", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, ["mandate"]);
    expect(r.ok).toBe(false);
    expect(ep.policy.tableau).toHaveLength(0);
    expect(ep.policy.candidates).toHaveLength(1);
    expect(ep.turnPhase).toBe("policy");
  });

  test("rejects over-cap keepIds counting DISTINCT new slots (phase unchanged)", () => {
    // Tableau already has 4 distinct slots; keeping 2 new distinct ids would be 6.
    const ep = makeEpoch({
      tableau: [slot("mandate"), slot("stockpile"), slot("continuity"), slot("archive")],
      candidates: [getPolicy("mobilize"), getPolicy("deep-reserves")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, ["mobilize", "deep-reserves"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Too many policies for the tableau (5 slots).");
    expect(ep.policy.tableau).toHaveLength(4); // untouched
    expect(ep.policy.candidates).toHaveLength(2);
    expect(ep.turnPhase).toBe("policy");
  });

  test("a kept id already in the tableau is not counted as a new slot for the cap", () => {
    // 5 slots full; keep mandate (already slotted → stacks, no new slot).
    const ep = makeEpoch({
      tableau: [
        slot("mandate"),
        slot("mobilize"),
        slot("stockpile"),
        slot("continuity"),
        slot("archive"),
      ],
      candidates: [getPolicy("mandate")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, ["mandate"]);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(5);
    expect(ep.policy.tableau[0].stacks).toBe(2);
    expect(ep.turnPhase).toBe("play");
  });

  test("rejects when not in the policy phase", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize")],
      turnPhase: "play",
    });
    const r = enactPolicies(ep, ["mobilize"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Not in the policy phase.");
  });
});

describe("removePolicy (play phase)", () => {
  test("frees the slot and returns one copy per stack to the deck's discard", () => {
    const ep = makeEpoch({ tableau: [slot("mandate", 3), slot("mobilize", 1)] });
    const r = removePolicy(ep, 0);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].card.id).toBe("mobilize");
    // 3 stacked copies returned to sovereignty's discard.
    expect(ep.policy.discards.sovereignty).toHaveLength(3);
    expect(ep.policy.discards.sovereignty.every((c) => c.id === "mandate")).toBe(true);
  });

  test("rejects a bad slot index", () => {
    const ep = makeEpoch({ tableau: [slot("mandate")] });
    expect(removePolicy(ep, 5).ok).toBe(false);
    expect(removePolicy(ep, -1).ok).toBe(false);
    expect(ep.policy.tableau).toHaveLength(1);
  });

  test("rejects when the Epoch has ended (gained the status guard)", () => {
    const ep = makeEpoch({ tableau: [slot("mandate")] });
    ep.status = {
      kind: "lost",
      outcome: { totalValue: 0, cleared: false, contributingUnlocks: [], contributions: [] },
    };
    const r = removePolicy(ep, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Epoch ended.");
    expect(ep.policy.tableau).toHaveLength(1); // untouched
  });

  test("rejects when in the crisis lifecycle phase (gained the phase guard)", () => {
    const ep = makeEpoch({ tableau: [slot("mandate")] });
    ep.phase = "crisis";
    const r = removePolicy(ep, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Not in play phase.");
    expect(ep.policy.tableau).toHaveLength(1); // untouched
  });
});

describe("endTurn flushes leftover candidates", () => {
  test("remaining candidates move to their ideology's discard and clear", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mandate"), getPolicy("mobilize"), getPolicy("mandate")],
    });
    endTurn(ep, campaign, SETTING, createRng(5));
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.policy.discards.sovereignty).toHaveLength(2);
    expect(ep.policy.discards.solidarity).toHaveLength(1);
  });
});
