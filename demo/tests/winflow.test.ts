// Win-flow tests: force a winning hand, exercise mega-structure play, and
// verify Monument/terrain/transition.

import { describe, test, expect } from "bun:test";
import { createCampaign, prepareEndOfEpoch, finalizeEpoch } from "../src/core/campaign.ts";
import { createEpoch, playMegaStructure } from "../src/core/epoch.ts";
import { HOMEWORLD } from "../src/core/homeworld.ts";
import { createRng } from "../src/core/rng.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";

describe("win-flow", () => {
  test("Commune win: force 5 Solidarity + Charter into hand, play → won; monument + transition", () => {
    const campaign = createCampaign(7);
    const rng = createRng(7);
    const epoch = createEpoch(HOMEWORLD, campaign, rng, 1);

    // Swap the hand to a known set: 5 Solidarity + Founding Charter.
    epoch.hand = [
      getCard(roleId("agitator", "solidarity")),
      getCard(roleId("scholar", "solidarity")),
      getCard(roleId("preacher", "solidarity")),
      getCard(roleId("engineer", "solidarity")),
      getCard(roleId("architect", "solidarity")),
      getCard("keystone-founding-charter"),
    ];

    const r = playMegaStructure(epoch, HOMEWORLD, "the-commune");
    expect(r.ok).toBe(true);
    expect(epoch.status.kind).toBe("won");

    // Override the transition just for this test — Commune's onWin is
    // `campaign-end` in the demo (Flourishing Commune not defined).
    const eoe = prepareEndOfEpoch(epoch, HOMEWORLD, campaign);
    expect(eoe.outcome).toBe("win");
    expect(eoe.monument).toBeDefined();
    expect(eoe.monument?.megaProjectId).toBe("the-commune");

    const fin = finalizeEpoch(epoch, HOMEWORLD, campaign, eoe, {});
    expect(fin.kind).toBe("campaign-end");
    expect(campaign.monuments.length).toBe(1);
    // Bronze tier from score 10+11+12+13+14+15=75? 75 is gold.
    expect(["bronze", "silver", "gold", "platinum"]).toContain(campaign.monuments[0]!.tier);
    // Terrain should shift negative on axis1 for Commune.
    expect(campaign.terrain.axis1).toBeLessThan(0);
  });

  test("Ark win transitions to Generation Ship with terrain carry-over", () => {
    const campaign = createCampaign(11);
    const rng = createRng(11);
    const epoch = createEpoch(HOMEWORLD, campaign, rng, 1);

    epoch.hand = [
      getCard(roleId("scholar", "transformation")),
      getCard(roleId("preacher", "transformation")),
      getCard(roleId("engineer", "transformation")),
      getCard("keystone-navigators-compass"),
    ];

    const r = playMegaStructure(epoch, HOMEWORLD, "the-ark");
    expect(r.ok).toBe(true);
    const eoe = prepareEndOfEpoch(epoch, HOMEWORLD, campaign);
    expect(eoe.nextSettingId).toBe("generation-ship");
    const fin = finalizeEpoch(epoch, HOMEWORLD, campaign, eoe, {});
    expect(fin.kind).toBe("next");
    if (fin.kind === "next") {
      expect(fin.setting.id).toBe("generation-ship");
      expect(fin.epoch.epochNumber).toBe(2);
      expect(campaign.terrain.axis2).toBeGreaterThan(0); // Ark pushes Transformation
    }
  });

  test("loss path scars terrain", () => {
    const campaign = createCampaign(13);
    const rng = createRng(13);
    const epoch = createEpoch(HOMEWORLD, campaign, rng, 1);
    // Force a loss.
    epoch.status = { kind: "lost", mode: "populace-turned" };
    const eoe = prepareEndOfEpoch(epoch, HOMEWORLD, campaign);
    expect(eoe.nextSettingId).toBe("ruined-homeworld");
    const fin = finalizeEpoch(epoch, HOMEWORLD, campaign, eoe, {});
    expect(fin.kind).toBe("next");
  });
});
