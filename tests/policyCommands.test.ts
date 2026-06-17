// B5: policy draw (start-of-turn) + slot / stack / discard / remove commands.
// Draw count scales with each ideology's majority-counter influence; slotting a
// matching id stacks (no new slot); a 6th distinct card with the tableau full
// rejects; removePolicy returns stacked copies to that deck's discard; leftover
// candidates are flushed to discards on endTurn.

import { describe, test, expect } from "bun:test";
import { slotPolicy, discardPolicyCandidate, removePolicy } from "../src/core/engine/commands.ts";
import { drawPolicies, endTurn } from "../src/core/engine/turn.ts";
import { effectiveRules } from "../src/core/engine/effectiveRules.ts";
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
    turnPhase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns: [],
    unlockedProjects: opts.unlocks ?? [],
    eventLog: [],
    influence: SETTING.rules.influenceBaseline,
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

describe("slotPolicy", () => {
  test("slots a candidate into a free tableau slot", () => {
    const ep = makeEpoch({ candidates: [getPolicy("mandate")] });
    const r = slotPolicy(ep, "mandate");
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1);
    expect(ep.policy.tableau[0].card.id).toBe("mandate");
    expect(ep.policy.tableau[0].stacks).toBe(1);
    expect(ep.policy.candidates).toHaveLength(0);
  });

  test("slotting onto a matching id stacks (no new slot)", () => {
    const ep = makeEpoch({
      tableau: [slot("mandate", 1)],
      candidates: [getPolicy("mandate")],
    });
    const r = slotPolicy(ep, "mandate");
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(1); // unchanged length
    expect(ep.policy.tableau[0].stacks).toBe(2); // incremented
    expect(ep.policy.candidates).toHaveLength(0);
  });

  test("after stacking, effectiveRules reflects the stack", () => {
    const ep = makeEpoch({
      tableau: [slot("mandate", 1)],
      candidates: [getPolicy("mandate")],
    });
    slotPolicy(ep, "mandate");
    const r = effectiveRules(ep, SETTING);
    expect(r.influenceBaseline).toBe(SETTING.rules.influenceBaseline + 2);
  });

  test("rejects a 6th distinct card when 5 slots are full and no id matches", () => {
    const ep = makeEpoch({
      tableau: [
        slot("mandate"),
        slot("mobilize"),
        slot("stockpile"),
        slot("continuity"),
        slot("archive"),
      ],
      candidates: [getPolicy("conscription")],
    });
    const r = slotPolicy(ep, "conscription");
    expect(r.ok).toBe(false);
    expect(ep.policy.tableau).toHaveLength(5);
    expect(ep.policy.candidates).toHaveLength(1); // candidate untouched on reject
  });

  test("stacks onto a match even when 5 slots are full", () => {
    const ep = makeEpoch({
      tableau: [
        slot("mandate"),
        slot("mobilize"),
        slot("stockpile"),
        slot("continuity"),
        slot("archive"),
      ],
      candidates: [getPolicy("mandate")],
    });
    const r = slotPolicy(ep, "mandate");
    expect(r.ok).toBe(true);
    expect(ep.policy.tableau).toHaveLength(5);
    expect(ep.policy.tableau[0].stacks).toBe(2);
  });

  test("rejects when the card is not among candidates", () => {
    const ep = makeEpoch({ candidates: [getPolicy("mandate")] });
    const r = slotPolicy(ep, "mobilize");
    expect(r.ok).toBe(false);
    expect(ep.policy.tableau).toHaveLength(0);
  });
});

describe("discardPolicyCandidate", () => {
  test("removes the candidate and pushes it to its ideology's discard", () => {
    const ep = makeEpoch({ candidates: [getPolicy("mandate")] });
    const r = discardPolicyCandidate(ep, "mandate");
    expect(r.ok).toBe(true);
    expect(ep.policy.candidates).toHaveLength(0);
    expect(ep.policy.discards.sovereignty).toHaveLength(1);
    expect(ep.policy.discards.sovereignty[0].id).toBe("mandate");
  });

  test("rejects when the card is not a candidate", () => {
    const ep = makeEpoch({ candidates: [] });
    const r = discardPolicyCandidate(ep, "mandate");
    expect(r.ok).toBe(false);
  });
});

describe("removePolicy", () => {
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
