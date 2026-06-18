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
import {
  getPolicy,
  POLICY_SLOT_CAP,
  projectedNewSlots,
  wouldFitInTableau,
} from "../src/core/data/policies.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import { createEmptyColumn, placeLand, placeInfluence } from "../src/core/engine/column.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";
import type { Epoch, PolicyCard, PolicySlot, ProjectUnlock } from "../src/core/types.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";
import { emptyPolicyState, emptyCrisisTreeState } from "./fixtures.ts";

const SETTING = getSetting("homeworld");
const campaign = createCampaign(1);

const L = (rank: number, ideo: Ideology) => getCard(landId(rank, ideo));

/** A built unlock that fuels `ideo` by `count` (default 2): a same-ideology
 *  land pair promoted to `ideo` contributes 2 under count-scaling. */
function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
  return {
    projectId: `u-${ideo}-${rank}`,
    pattern: "pair",
    turn: 1,
    cards: [L(rank, ideo), L(rank, ideo)],
    promotedIdeology: ideo,
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
    crisisTree: emptyCrisisTreeState(),
  };
}

describe("drawPolicies — draw scales with influence", () => {
  test("draws ideologyInfluence[I] cards from each ideology's deck", () => {
    const ep = makeEpoch({
      // 2 solidarity pair-unlocks → infl.solidarity = 4; 1 heritage pair → infl.heritage = 2.
      unlocks: [
        influenceUnlock("solidarity", 2),
        influenceUnlock("solidarity", 3),
        influenceUnlock("heritage", 4),
      ],
      decks: {
        solidarity: [
          getPolicy("mobilize"),
          getPolicy("mobilize"),
          getPolicy("mobilize"),
          getPolicy("mobilize"),
          getPolicy("mobilize"),
        ],
        heritage: [getPolicy("continuity"), getPolicy("archive"), getPolicy("continuity")],
      },
    });
    drawPolicies(ep, createRng(1));
    const cands = ep.policy.candidates;
    expect(cands.filter((c) => c.ideology === "solidarity")).toHaveLength(4);
    expect(cands.filter((c) => c.ideology === "heritage")).toHaveLength(2);
    expect(cands).toHaveLength(6);
    // 4 of 5 solidarity drawn; 2 of 3 heritage drawn.
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
      // Need 4 solidarity draws; deck has 2, discard has 2 → reshuffle to get all four.
      unlocks: [influenceUnlock("solidarity", 2), influenceUnlock("solidarity", 3)],
      decks: { solidarity: [getPolicy("mobilize"), getPolicy("mobilize")] },
      discards: {
        solidarity: [getPolicy("solidarity-forever"), getPolicy("solidarity-forever")],
      },
    });
    drawPolicies(ep, createRng(7));
    expect(ep.policy.candidates).toHaveLength(4);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
    expect(ep.policy.decks.solidarity).toHaveLength(0);
  });

  test("when deck + discard both run dry, draws fewer than requested", () => {
    const ep = makeEpoch({
      // Need 4 solidarity draws but only 1 card total exists.
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
    const r = buildColumn(ep, SETTING, 0, createRng(1));
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
    const r = enactPolicies(ep, SETTING, ["mobilize"]);
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
    const r = enactPolicies(ep, SETTING, []);
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
    const r = enactPolicies(ep, SETTING, ["mobilize"]);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].stacks).toBe(2);
    expect(ep.turnPhase).toBe("play");
  });

  test("per-copy keep: one of two drawn copies is kept, the other discarded", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize"), getPolicy("mobilize")],
      turnPhase: "policy",
    });
    // keepIds names mobilize ONCE → keep one copy (stacks 1), discard the other.
    const r = enactPolicies(ep, SETTING, ["mobilize"]);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].card.id).toBe("mobilize");
    expect(ep.policy.tableau[0].stacks).toBe(1);
    // The other drawn copy went to solidarity's discard.
    expect(ep.policy.discards.solidarity.map((c) => c.id)).toEqual(["mobilize"]);
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.turnPhase).toBe("play");
  });

  test("per-copy keep: naming an id twice keeps both drawn copies as a x2 stack", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize"), getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, SETTING, ["mobilize", "mobilize"]);
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].card.id).toBe("mobilize");
    expect(ep.policy.tableau[0].stacks).toBe(2);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.turnPhase).toBe("play");
  });

  test("over-keep: naming more copies than were drawn is rejected (no mutation)", () => {
    const ep = makeEpoch({
      // Only 2 Mobilize drawn; keepIds names 3.
      candidates: [getPolicy("mobilize"), getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, SETTING, ["mobilize", "mobilize", "mobilize"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Policy not among this turn's candidates.");
    expect(ep.policy.tableau).toHaveLength(0);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
    expect(ep.policy.candidates).toHaveLength(2);
    expect(ep.turnPhase).toBe("policy");
  });

  test("rejects when a kept id is not among candidates (phase unchanged)", () => {
    const ep = makeEpoch({
      candidates: [getPolicy("mobilize")],
      turnPhase: "policy",
    });
    const r = enactPolicies(ep, SETTING, ["mandate"]);
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
    const r = enactPolicies(ep, SETTING, ["mobilize", "deep-reserves"]);
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
    const r = enactPolicies(ep, SETTING, ["mandate"]);
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
    const r = enactPolicies(ep, SETTING, ["mobilize"]);
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
      outcome: {
        totalValue: 0,
        cleared: false,
        clearedNodeIds: [],
        contributingUnlocks: [],
        contributions: [],
      },
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

describe("shared slot projection (single source for cap math)", () => {
  test("projectedNewSlots: distinct new ids vs stacking onto existing slots", () => {
    const tableau = [slot("mandate"), slot("stockpile")];
    // mandate stacks (no new slot); mobilize + continuity are two new distinct.
    expect(projectedNewSlots(tableau, ["mandate", "mobilize", "continuity"])).toBe(2);
    // duplicate keep-ids collapse to one new slot.
    expect(projectedNewSlots(tableau, ["mobilize", "mobilize"])).toBe(1);
    // all keeps already slotted → zero new slots.
    expect(projectedNewSlots(tableau, ["mandate", "stockpile"])).toBe(0);
  });

  test("wouldFitInTableau agrees with enactPolicies cap at the boundary", () => {
    const tableau = [slot("mandate"), slot("stockpile"), slot("continuity"), slot("archive")];
    // 4 slots + 1 new distinct = 5 = cap → fits.
    expect(wouldFitInTableau(tableau, ["mobilize"])).toBe(true);
    // 4 slots + 2 new distinct = 6 > cap → rejects (matches the enact test above).
    expect(wouldFitInTableau(tableau, ["mobilize", "deep-reserves"])).toBe(false);
    expect(POLICY_SLOT_CAP).toBe(5);
  });
});

describe("buildColumn promotion", () => {
  /** A live (play-phase, in-progress) epoch whose single column is `col`. */
  function epochWithColumn(col: ReturnType<typeof createEmptyColumn>): Epoch {
    const ep = makeEpoch();
    ep.columns = [col];
    return ep;
  }

  test("all-wild column ⇒ promotedIdeology: null (auto)", () => {
    const col = createEmptyColumn();
    placeLand(col, getCard("keystone-founding-charter")); // a full joker (land-home)
    placeInfluence(col, getCard("keystone-pioneer")); // a full joker (role-home)
    const ep = epochWithColumn(col);
    const r = buildColumn(ep, SETTING, 0, createRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.promotedIdeology).toBeNull();
  });

  test("exactly one present ideology ⇒ auto-promotes without a promote arg", () => {
    const col = createEmptyColumn();
    placeLand(col, getCard(landId(2, "solidarity")));
    placeLand(col, getCard(landId(2, "solidarity")));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const ep = epochWithColumn(col);
    const r = buildColumn(ep, SETTING, 0, createRng(1));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.promotedIdeology).toBe("solidarity");
  });

  test("≥2 present ideologies + no promote ⇒ rejects", () => {
    const col = createEmptyColumn();
    placeLand(col, getCard(landId(2, "solidarity")));
    placeLand(col, getCard(landId(2, "heritage")));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const ep = epochWithColumn(col);
    const r = buildColumn(ep, SETTING, 0, createRng(1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Choose an ideology to promote.");
  });

  test("promote not present in the column ⇒ rejects", () => {
    const col = createEmptyColumn();
    placeLand(col, getCard(landId(2, "solidarity")));
    placeLand(col, getCard(landId(2, "heritage")));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const ep = epochWithColumn(col);
    const r = buildColumn(ep, SETTING, 0, createRng(1), "sovereignty");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("Cannot promote an ideology not present in the column.");
  });

  test("valid promote among present ⇒ set on the unlock", () => {
    const col = createEmptyColumn();
    placeLand(col, getCard(landId(2, "solidarity")));
    placeLand(col, getCard(landId(2, "heritage")));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const ep = epochWithColumn(col);
    const r = buildColumn(ep, SETTING, 0, createRng(1), "heritage");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.promotedIdeology).toBe("heritage");
  });
});
