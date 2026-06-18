import { describe, test, expect } from "bun:test";
import {
  openingTurnPhase,
  isPlayPhase,
  isPolicyPhase,
  TURN_PHASE_ORDER,
} from "../src/core/engine/turnPhase.ts";
import { createEpoch } from "../src/core/engine/epoch.ts";
import { createCampaign } from "../src/core/engine/campaign.ts";
import { getSetting } from "../src/core/settings/index.ts";
import { createRng } from "../src/core/engine/rng.ts";
import { endTurn } from "../src/core/engine/turn.ts";
import { getCard, landId } from "../src/core/data/cards.ts";
import type { Ideology } from "../src/core/data/ideologies.ts";
import type { ProjectUnlock } from "../src/core/types.ts";

const L = (rank: number, ideo: Ideology) => getCard(landId(rank, ideo));

/** A built unlock whose projectMajority is `ideo` (a same-ideology land pair),
 *  so ideologyInfluence[ideo] > 0 and endTurn draws ≥1 candidate. */
function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
  return {
    projectId: `u-${ideo}-${rank}`,
    pattern: "pair",
    turn: 1,
    cards: [L(rank, ideo), L(rank, ideo)],
  };
}

describe("turnPhase", () => {
  test("createEpoch starts in the play phase", () => {
    const setting = getSetting("homeworld");
    const campaign = createCampaign(1);
    const epoch = createEpoch(setting, campaign, createRng(1), 1);
    expect(epoch.turnPhase).toBe("play");
  });

  test("openingTurnPhase is policy when candidates exist, else play", () => {
    expect(openingTurnPhase(true)).toBe("policy");
    expect(openingTurnPhase(false)).toBe("play");
  });

  test("isPlayPhase / isPolicyPhase reflect epoch.turnPhase", () => {
    const setting = getSetting("homeworld");
    const campaign = createCampaign(1);
    const epoch = createEpoch(setting, campaign, createRng(1), 1);
    expect(isPlayPhase(epoch)).toBe(true);
    expect(isPolicyPhase(epoch)).toBe(false);
    epoch.turnPhase = "policy";
    expect(isPlayPhase(epoch)).toBe(false);
    expect(isPolicyPhase(epoch)).toBe(true);
  });

  test("TURN_PHASE_ORDER is policy then play", () => {
    expect(TURN_PHASE_ORDER).toEqual(["policy", "play"]);
  });
});

describe("endTurn turn-phase transition", () => {
  const setting = getSetting("homeworld");
  const campaign = createCampaign(1);

  test("opens the next turn in the policy phase when candidates are drawn", () => {
    const epoch = createEpoch(setting, campaign, createRng(1), 1);
    // A non-tie majority → ideologyInfluence > 0 → drawPolicies adds candidates.
    epoch.unlockedProjects = [influenceUnlock("solidarity", 3)];
    expect(epoch.turn).toBe(1);

    endTurn(epoch, campaign, setting, createRng(1));

    expect(epoch.turn).toBe(2);
    expect(epoch.policy.candidates.length).toBeGreaterThan(0);
    expect(epoch.turnPhase).toBe("policy");
  });

  test("opens the next turn in the play phase when no candidates are drawn", () => {
    const epoch = createEpoch(setting, campaign, createRng(2), 1);
    // No unlocks → all ideologyInfluence is 0 → nothing drawn.
    epoch.unlockedProjects = [];

    endTurn(epoch, campaign, setting, createRng(2));

    expect(epoch.turn).toBe(2);
    expect(epoch.policy.candidates.length).toBe(0);
    expect(epoch.turnPhase).toBe("play");
  });

  test("is a no-op when called while in the policy phase (turn unchanged)", () => {
    const epoch = createEpoch(setting, campaign, createRng(3), 1);
    epoch.turnPhase = "policy";

    endTurn(epoch, campaign, setting, createRng(3));

    expect(epoch.turn).toBe(1);
    expect(epoch.turnPhase).toBe("policy");
  });
});
