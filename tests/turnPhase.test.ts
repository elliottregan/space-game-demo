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
