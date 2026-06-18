// B4: existing rules reads (storage capacity, influence reset, hand draw,
// end-of-turn cycle, dissent add/purge) route through effectiveRules so a
// slotted policy actually changes play.

import { describe, test, expect } from "bun:test";
import { storeCard } from "../src/core/engine/commands.ts";
import { endTurn } from "../src/core/engine/turn.ts";
import { placeLand } from "../src/core/engine/column.ts";
import { getPolicy } from "../src/core/data/policies.ts";
import { getCard, landId, makeDissent } from "../src/core/data/cards.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { createRng } from "../src/core/engine/rng.ts";
import type { Column, Epoch, PolicySlot } from "../src/core/types.ts";
import { createEmptyColumn } from "../src/core/engine/column.ts";
import { emptyPolicyState, emptyCrisisTreeState } from "./fixtures.ts";

const SETTING = getSetting("homeworld"); // storageCapacity: 1
const rng = createRng(13);
const campaign = createCampaign(1);

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

const slot = (id: string, stacks = 1): PolicySlot => ({ card: getPolicy(id), stacks });

function epochWith(tableau: PolicySlot[], columns: Column[] = [createEmptyColumn()]): Epoch {
  return {
    epochNumber: 1,
    settingId: SETTING.id,
    turn: 1,
    phase: "play",
    turnPhase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: SETTING.rules.baseInfluenceBaseline,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
    policy: { ...emptyPolicyState(), tableau },
    crisisTree: emptyCrisisTreeState(),
  };
}

describe("effectiveRules routing — storage capacity", () => {
  test("a slotted Stockpile lets a 2nd card be stored (base cap 1 → 2)", () => {
    const ep = epochWith([slot("stockpile")]);
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const a = land(2, "heritage");
    const b = land(3, "sovereignty");
    ep.hand = [a, b];
    expect(storeCard(ep, SETTING, a.id, 0, rng).ok).toBe(true);
    // Without Stockpile this would be "Storage is full." With cap 2 it succeeds.
    const r = storeCard(ep, SETTING, b.id, 0, rng);
    expect(r.ok).toBe(true);
    expect(col.storage.length).toBe(2);
  });

  test("without Stockpile a 2nd store is rejected (base cap 1)", () => {
    const ep = epochWith([]);
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const a = land(2, "heritage");
    const b = land(3, "sovereignty");
    ep.hand = [a, b];
    expect(storeCard(ep, SETTING, a.id, 0, rng).ok).toBe(true);
    const r = storeCard(ep, SETTING, b.id, 0, rng);
    expect(r.ok).toBe(false);
    expect(col.storage.length).toBe(1);
  });
});

describe("effectiveRules routing — endTurn", () => {
  test("a slotted Mandate raises next turn's influence by 1", () => {
    const ep = epochWith([slot("mandate")]);
    endTurn(ep, campaign, SETTING, rng);
    expect(ep.influence).toBe(SETTING.rules.baseInfluenceBaseline + 1);
  });

  test("baseline path (no policies) resets influence to setting baseline", () => {
    const ep = epochWith([]);
    ep.influence = 0;
    endTurn(ep, campaign, SETTING, rng);
    expect(ep.influence).toBe(SETTING.rules.baseInfluenceBaseline);
  });

  // Seed a full draw pile so drawToHandSize is satisfied without reshuffling
  // the discard back into hand — keeps cycle assertions deterministic.
  const filler = () =>
    Array.from({ length: SETTING.rules.baseHandSize }, (_, i) =>
      land((i % 8) + 2, "transformation"),
    );

  test("a slotted Archive keeps 1 card in hand across endTurn", () => {
    const ep = epochWith([slot("archive")]);
    const keeper = land(2, "solidarity");
    const dropped = land(3, "heritage");
    ep.hand = [keeper, dropped];
    ep.draw = filler();
    endTurn(ep, campaign, SETTING, rng);
    // The first endTurnKeep (=1) card is retained; the rest is cycled to discard.
    expect(ep.hand).toContain(keeper);
    expect(ep.discard).toContain(dropped);
  });

  test("Archive keeps the first NON-Dissent card when Dissent sits at the front", () => {
    // endTurnKeep keeps the first N cards by position, but an inert Dissent must
    // never burn a keep slot. With a Dissent at hand[0] and Archive (keep 1), the
    // kept card is the non-Dissent keeper; the Dissent cycles to discard.
    const ep = epochWith([slot("archive")]);
    const dissent = makeDissent();
    const keeper = land(2, "solidarity");
    ep.hand = [dissent, keeper];
    ep.draw = filler();
    endTurn(ep, campaign, SETTING, createRng(13));
    // The keeper survived the cycle into the new hand…
    expect(ep.hand).toContain(keeper);
    // …the Dissent was cycled out (to discard) rather than carried…
    expect(ep.discard).toContain(dissent);
    // …and no Dissent ended up in the new hand.
    expect(ep.hand.some((c) => c.tags.includes("dissent"))).toBe(false);
  });

  test("no Archive cycles the whole hand (endTurnKeep 0)", () => {
    const ep = epochWith([]);
    const a = land(2, "solidarity");
    const b = land(3, "heritage");
    ep.hand = [a, b];
    ep.draw = filler();
    endTurn(ep, campaign, SETTING, rng);
    expect(ep.discard).toContain(a);
    expect(ep.discard).toContain(b);
  });

  test("end-of-turn cycle does not add Dissent", () => {
    const ep = epochWith([]);
    ep.hand = [land(2, "solidarity"), land(3, "heritage")];
    ep.draw = filler();
    endTurn(ep, campaign, SETTING, rng);
    const dissent = [...ep.draw, ...ep.hand, ...ep.discard].filter((c) =>
      c.tags.includes("dissent"),
    );
    expect(dissent.length).toBe(0);
  });

  test("a slotted Continuity purges 1 Dissent at start of turn", () => {
    const ep = epochWith([slot("continuity")]);
    ep.draw = [makeDissent(), land(5, "solidarity")];
    endTurn(ep, campaign, SETTING, rng);
    const remaining = [...ep.draw, ...ep.hand, ...ep.discard].filter((c) =>
      c.tags.includes("dissent"),
    );
    expect(remaining.length).toBe(0);
  });

  test("a slotted Conscription adds 1 Dissent at start of turn", () => {
    const ep = epochWith([slot("conscription")]);
    endTurn(ep, campaign, SETTING, rng);
    const added = [...ep.draw, ...ep.hand, ...ep.discard].filter((c) => c.tags.includes("dissent"));
    expect(added.length).toBe(1);
  });

  test("Conscription's added Dissent shuffles into the draw pile, not the opening hand", () => {
    // Conscription adds +1 Dissent at start of turn. The fix shuffles it into a
    // RANDOM position in the draw pile (seedable rng) instead of unshifting it to
    // draw[0], where drawToHandSize would deal it straight into the new hand.
    // Seed 1 deterministically places it past the hand-draw cutoff.
    const ep = epochWith([slot("conscription")]);
    ep.hand = [];
    ep.draw = Array.from({ length: 12 }, (_, i) => land((i % 8) + 2, "transformation"));
    endTurn(ep, campaign, SETTING, createRng(1));

    // The opening hand contains no Dissent — it was not dealt off the front.
    expect(ep.hand.some((c) => c.tags.includes("dissent"))).toBe(false);
    // Exactly one Dissent exists, and it sits in the draw pile at a non-front
    // index (shuffled in, not stacked on top).
    const dissentInDraw = ep.draw
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.tags.includes("dissent"));
    expect(dissentInDraw.length).toBe(1);
    expect(dissentInDraw[0].i).toBeGreaterThan(0);
    expect(ep.draw[0].tags.includes("dissent")).toBe(false);
  });

  test("Conscription + Continuity together: add 1 then purge 1 → net 0 Dissent", () => {
    const ep = epochWith([slot("conscription"), slot("continuity")]);
    endTurn(ep, campaign, SETTING, rng);
    const net = [...ep.draw, ...ep.hand, ...ep.discard].filter((c) => c.tags.includes("dissent"));
    expect(net.length).toBe(0);
  });

  test("policy dissent does not fire when the Epoch tips into Crisis", () => {
    const ep = epochWith([slot("conscription")]);
    ep.turn = SETTING.rules.maxTurns; // endTurn pushes turn past the cap
    endTurn(ep, campaign, SETTING, rng);
    expect(ep.phase).toBe("crisis");
    const added = [...ep.draw, ...ep.hand, ...ep.discard].filter((c) => c.tags.includes("dissent"));
    expect(added.length).toBe(0);
  });
});
