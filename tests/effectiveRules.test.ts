import { describe, test, expect } from "bun:test";
import { effectiveRules } from "../src/core/engine/effectiveRules.ts";
import { getPolicy } from "../src/core/data/policies.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Epoch, PolicySlot, ProjectUnlock } from "../src/core/types.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";
import { emptyPolicyState } from "./fixtures.ts";

const setting = getSetting("homeworld");

const L = (rank: number, ideo: Ideology) => getCard(landId(rank, ideo));

/** An unlock whose projectMajority is `ideo` (a same-ideology land pair). */
function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
  return {
    projectId: `u-${ideo}-${rank}`,
    pattern: "pair",
    turn: 1,
    cards: [L(rank, ideo), L(rank, ideo)],
  };
}

/** A bare epoch with a hand-set policy tableau and unlocks. */
function makeEpoch(tableau: PolicySlot[], unlocks: ProjectUnlock[] = []): Epoch {
  return {
    epochNumber: 1,
    settingId: setting.id,
    turn: 1,
    phase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns: [],
    unlockedProjects: unlocks,
    eventLog: [],
    influence: 0,
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
    policy: { ...emptyPolicyState(), tableau },
  };
}

const slot = (id: string, stacks = 1): PolicySlot => ({ card: getPolicy(id), stacks });

describe("effectiveRules", () => {
  test("empty tableau equals setting.rules with zeroed extras", () => {
    const r = effectiveRules(makeEpoch([]), setting);
    expect(r).toEqual({
      handSize: setting.rules.handSize,
      influenceBaseline: setting.rules.influenceBaseline,
      storageCapacity: setting.rules.storageCapacity,
      endTurnKeep: 0,
      dissentPurge: 0,
      dissentAdd: 0,
    });
  });

  test("one Mandate raises influenceBaseline by 1", () => {
    const r = effectiveRules(makeEpoch([slot("mandate")]), setting);
    expect(r.influenceBaseline).toBe(setting.rules.influenceBaseline + 1);
  });

  test("Mandate x3 stacks raises influenceBaseline by 3", () => {
    const r = effectiveRules(makeEpoch([slot("mandate", 3)]), setting);
    expect(r.influenceBaseline).toBe(setting.rules.influenceBaseline + 3);
  });

  test("Stockpile raises storageCapacity by 1", () => {
    const r = effectiveRules(makeEpoch([slot("stockpile")]), setting);
    expect(r.storageCapacity).toBe(setting.rules.storageCapacity + 1);
  });

  test("Deep Reserves with 4 transformation influence: +1 base +2 scaled = +3 storage", () => {
    const unlocks = [
      influenceUnlock("transformation", 2),
      influenceUnlock("transformation", 3),
      influenceUnlock("transformation", 4),
      influenceUnlock("transformation", 5),
    ];
    const r = effectiveRules(makeEpoch([slot("deep-reserves")], unlocks), setting);
    expect(r.storageCapacity).toBe(setting.rules.storageCapacity + 3);
  });

  test("Conscription adds influence +2 and dissentAdd 1", () => {
    const r = effectiveRules(makeEpoch([slot("conscription")]), setting);
    expect(r.influenceBaseline).toBe(setting.rules.influenceBaseline + 2);
    expect(r.dissentAdd).toBe(1);
  });

  test("Solidarity Forever with 8 solidarity influence: handSize +1 base +2 scaled", () => {
    const unlocks = Array.from({ length: 8 }, (_, i) => influenceUnlock("solidarity", i + 2));
    const r = effectiveRules(makeEpoch([slot("solidarity-forever")], unlocks), setting);
    expect(r.handSize).toBe(setting.rules.handSize + 3);
  });

  test("Deep Reserves with influence below per: floor(1/2)=0, base only (+1 storage)", () => {
    const unlocks = [influenceUnlock("transformation", 2)];
    const r = effectiveRules(makeEpoch([slot("deep-reserves")], unlocks), setting);
    expect(r.storageCapacity).toBe(setting.rules.storageCapacity + 1);
  });

  test("Solidarity Forever with influence below per: floor(3/4)=0, base only (+1 handSize)", () => {
    const unlocks = Array.from({ length: 3 }, (_, i) => influenceUnlock("solidarity", i + 2));
    const r = effectiveRules(makeEpoch([slot("solidarity-forever")], unlocks), setting);
    expect(r.handSize).toBe(setting.rules.handSize + 1);
  });

  test("Deep Reserves x2 at 4 influence: (+1 base +2 scaled) x2 stacks = +6 storage", () => {
    const unlocks = Array.from({ length: 4 }, (_, i) => influenceUnlock("transformation", i + 2));
    const r = effectiveRules(makeEpoch([slot("deep-reserves", 2)], unlocks), setting);
    expect(r.storageCapacity).toBe(setting.rules.storageCapacity + 6);
  });

  test("Mandate + Conscription accumulate across slots: influenceBaseline +3", () => {
    const r = effectiveRules(makeEpoch([slot("mandate"), slot("conscription")]), setting);
    expect(r.influenceBaseline).toBe(setting.rules.influenceBaseline + 3);
    expect(r.dissentAdd).toBe(1);
  });

  test("Archive raises endTurnKeep by 1", () => {
    const r = effectiveRules(makeEpoch([slot("archive")]), setting);
    expect(r.endTurnKeep).toBe(1);
  });

  test("Archive x2 stacks raises endTurnKeep by 2", () => {
    const r = effectiveRules(makeEpoch([slot("archive", 2)]), setting);
    expect(r.endTurnKeep).toBe(2);
  });

  test("Continuity raises dissentPurge by 1", () => {
    const r = effectiveRules(makeEpoch([slot("continuity")]), setting);
    expect(r.dissentPurge).toBe(1);
  });

  test("Continuity x3 stacks raises dissentPurge by 3", () => {
    const r = effectiveRules(makeEpoch([slot("continuity", 3)]), setting);
    expect(r.dissentPurge).toBe(3);
  });
});
