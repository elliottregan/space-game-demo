import { describe, expect, test } from "bun:test";
import { getFactionName } from "../src/core/data/factionNames";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { NPCFaction } from "../src/core/models/NPCInfluence";
import type { AxisPosition } from "../src/core/models/NPCInfluence";
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";

const MODERATE = IdeologyBalance.FACTION_NAME_THRESHOLD_MODERATE;
const EXTREME = IdeologyBalance.FACTION_NAME_THRESHOLD_EXTREME;

function pos(
  solidarity: number,
  sovereignty: number,
  transformation: number,
): AxisPosition {
  return { solidarity, sovereignty, transformation };
}

describe("Dynamic faction naming", () => {
  describe("getFactionName (pure function)", () => {
    test("faction keeps default name at starting position", () => {
      // Earth Loyalists start at (0, -0.7, -0.3)
      // Sovereignty is low but transformation -0.3 = exactly at moderate threshold
      // With the default starting position, solidarity is 0 so no collectivist/individualist match
      // and sovereignty is -0.7 (low) but transformation is -0.3 (at threshold for low).
      // Earth-tied + Preservationist does not match a 2-axis rule in the table.
      // Neutral position should keep default name.
      expect(getFactionName(NPCFaction.EarthLoyalists, pos(0, 0, 0))).toBe("Earth Loyalists");
      expect(getFactionName(NPCFaction.MarsIndependence, pos(0, 0, 0))).toBe("Mars Independence");
      expect(getFactionName(NPCFaction.CorporateInterests, pos(0, 0, 0))).toBe(
        "Corporate Interests",
      );
    });

    test("Earth Loyalists become Terran Heritage Compact when earth-tied + collectivist + preservationist", () => {
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(MODERATE, -MODERATE, -MODERATE),
      );
      expect(name).toBe("Terran Heritage Compact");
    });

    test("Earth Loyalists become New Earth Vanguard when earth-tied + individualist + revolutionary", () => {
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(-MODERATE, -MODERATE, MODERATE),
      );
      expect(name).toBe("New Earth Vanguard");
    });

    test("Earth Loyalists become Founders' Covenant when mars-sovereign + preservationist", () => {
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(0, MODERATE, -MODERATE),
      );
      expect(name).toBe("Founders' Covenant");
    });

    test("Earth Loyalists become Earth Unity Front when collectivist", () => {
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(MODERATE, 0, 0),
      );
      expect(name).toBe("Earth Unity Front");
    });

    test("Earth Loyalists become Colonial Enterprise League when individualist", () => {
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(-MODERATE, 0, 0),
      );
      expect(name).toBe("Colonial Enterprise League");
    });

    test("Mars Independence becomes Ares Ascendancy when mars-sovereign + revolutionary", () => {
      const name = getFactionName(
        NPCFaction.MarsIndependence,
        pos(0, MODERATE, MODERATE),
      );
      expect(name).toBe("Ares Ascendancy");
    });

    test("Mars Independence becomes Mars People's Front when mars-sovereign + collectivist + preservationist", () => {
      const name = getFactionName(
        NPCFaction.MarsIndependence,
        pos(MODERATE, MODERATE, -MODERATE),
      );
      expect(name).toBe("Mars People's Front");
    });

    test("Mars Independence becomes Red Frontier when individualist + revolutionary", () => {
      const name = getFactionName(
        NPCFaction.MarsIndependence,
        pos(-MODERATE, 0, MODERATE),
      );
      expect(name).toBe("Red Frontier");
    });

    test("Mars Independence becomes Mars Solidarity Movement when collectivist", () => {
      const name = getFactionName(
        NPCFaction.MarsIndependence,
        pos(MODERATE, 0, 0),
      );
      expect(name).toBe("Mars Solidarity Movement");
    });

    test("Corporate Interests becomes Frontier Syndicate when individualist + revolutionary", () => {
      const name = getFactionName(
        NPCFaction.CorporateInterests,
        pos(-MODERATE, 0, MODERATE),
      );
      expect(name).toBe("Frontier Syndicate");
    });

    test("Corporate Interests becomes Old Guard Consortium when preservationist + individualist", () => {
      const name = getFactionName(
        NPCFaction.CorporateInterests,
        pos(-MODERATE, 0, -MODERATE),
      );
      expect(name).toBe("Old Guard Consortium");
    });

    test("Corporate Interests becomes Common Futures Initiative when collectivist", () => {
      const name = getFactionName(
        NPCFaction.CorporateInterests,
        pos(MODERATE, 0, 0),
      );
      expect(name).toBe("Common Futures Initiative");
    });

    test("Corporate Interests becomes Martian Trade Alliance when mars-sovereign", () => {
      const name = getFactionName(
        NPCFaction.CorporateInterests,
        pos(0, MODERATE, 0),
      );
      expect(name).toBe("Martian Trade Alliance");
    });

    test("more specific conditions take priority over less specific", () => {
      // Earth Loyalists: earth-tied + collectivist + preservationist (3-axis) should
      // beat collectivist (1-axis) even though collectivist also matches
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(MODERATE, -MODERATE, -MODERATE),
      );
      expect(name).toBe("Terran Heritage Compact");
      expect(name).not.toBe("Earth Unity Front");

      // Mars Independence: mars-sovereign + collectivist + preservationist (3-axis)
      // should beat mars-sovereign + revolutionary (2-axis) when applicable
      // Here sovereignty=high, solidarity=high, transformation=low
      // The 3-axis "Mars People's Front" should win over the 1-axis "Mars Solidarity Movement"
      const marsName = getFactionName(
        NPCFaction.MarsIndependence,
        pos(MODERATE, MODERATE, -MODERATE),
      );
      expect(marsName).toBe("Mars People's Front");
      expect(marsName).not.toBe("Mars Solidarity Movement");

      // Corporate: individualist + revolutionary (2-axis) should beat
      // just mars-sovereign (1-axis) when both conditions are met
      const corpName = getFactionName(
        NPCFaction.CorporateInterests,
        pos(-MODERATE, MODERATE, MODERATE),
      );
      expect(corpName).toBe("Frontier Syndicate");
      expect(corpName).not.toBe("Martian Trade Alliance");
    });

    test("faction reverts to default when drifting back to neutral", () => {
      // First confirm a non-default name at extreme position
      const extremeName = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(EXTREME, -EXTREME, -EXTREME),
      );
      expect(extremeName).toBe("Terran Heritage Compact");

      // Then verify neutral position returns default
      const neutralName = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(0, 0, 0),
      );
      expect(neutralName).toBe("Earth Loyalists");

      // Slightly below threshold should also be default
      const nearNeutral = MODERATE - 0.01;
      const belowThresholdName = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(nearNeutral, 0, 0),
      );
      expect(belowThresholdName).toBe("Earth Loyalists");
    });

    test("values exactly at threshold satisfy the condition", () => {
      const name = getFactionName(
        NPCFaction.EarthLoyalists,
        pos(MODERATE, 0, 0),
      );
      expect(name).toBe("Earth Unity Front");
    });

    test("unknown baseId returns the baseId string", () => {
      const name = getFactionName("unknown_faction" as NPCFaction, pos(0, 0, 0));
      expect(name).toBe("unknown_faction");
    });
  });

  describe("IdeologyManager.updateFactionNames()", () => {
    test("name changes fire FACTION_RENAMED event", () => {
      const manager = new IdeologyManager();
      const json = manager.toJSON();

      // Push Earth Loyalists to collectivist position
      const earthFaction = json.factions.find(
        (f) => f.baseId === NPCFaction.EarthLoyalists,
      )!;
      earthFaction.position.solidarity = MODERATE;
      earthFaction.position.sovereignty = 0;
      earthFaction.position.transformation = 0;

      const modified = IdeologyManager.fromJSON(json);
      const events = modified.updateFactionNames();

      const renameEvent = events.find((e) => e.type === "FACTION_RENAMED");
      expect(renameEvent).toBeDefined();
      expect(renameEvent!.message).toContain("Earth Loyalists");
      expect(renameEvent!.message).toContain("Earth Unity Front");
      expect(renameEvent!.severity).toBe("info");

      // Verify the faction name was actually updated
      const updatedFaction = modified
        .getFactions()
        .find((f) => f.baseId === NPCFaction.EarthLoyalists)!;
      expect(updatedFaction.name).toBe("Earth Unity Front");
    });

    test("no event when name stays the same", () => {
      const manager = new IdeologyManager();

      // Default positions should produce default names, which match the starting names
      // Earth Loyalists starts at (0, -0.7, -0.3) -- sovereignty is low and transformation is at threshold
      // To guarantee no rename, set all factions to neutral positions
      const json = manager.toJSON();
      for (const faction of json.factions) {
        faction.position = { solidarity: 0, sovereignty: 0, transformation: 0 };
        // Also reset the name to the default so there is nothing to change
        if (faction.baseId === NPCFaction.EarthLoyalists) faction.name = "Earth Loyalists";
        if (faction.baseId === NPCFaction.MarsIndependence) faction.name = "Mars Independence";
        if (faction.baseId === NPCFaction.CorporateInterests) faction.name = "Corporate Interests";
      }

      const neutral = IdeologyManager.fromJSON(json);
      const events = neutral.updateFactionNames();

      expect(events.length).toBe(0);
    });

    test("multiple factions can rename in the same call", () => {
      const manager = new IdeologyManager();
      const json = manager.toJSON();

      // Push all factions to collectivist
      for (const faction of json.factions) {
        faction.position.solidarity = MODERATE;
        faction.position.sovereignty = 0;
        faction.position.transformation = 0;
      }

      const modified = IdeologyManager.fromJSON(json);
      const events = modified.updateFactionNames();

      // All three factions should have renamed
      const renameEvents = events.filter((e) => e.type === "FACTION_RENAMED");
      expect(renameEvents.length).toBe(3);
    });

    test("calling updateFactionNames twice without position change produces no events on second call", () => {
      const manager = new IdeologyManager();
      const json = manager.toJSON();

      const earthFaction = json.factions.find(
        (f) => f.baseId === NPCFaction.EarthLoyalists,
      )!;
      earthFaction.position.solidarity = MODERATE;
      earthFaction.position.sovereignty = 0;
      earthFaction.position.transformation = 0;

      const modified = IdeologyManager.fromJSON(json);

      const firstEvents = modified.updateFactionNames();
      expect(firstEvents.length).toBeGreaterThan(0);

      const secondEvents = modified.updateFactionNames();
      expect(secondEvents.length).toBe(0);
    });

    test("faction reverts name when position drifts back to neutral", () => {
      const manager = new IdeologyManager();
      const json = manager.toJSON();

      // First, push to collectivist
      const earthFaction = json.factions.find(
        (f) => f.baseId === NPCFaction.EarthLoyalists,
      )!;
      earthFaction.position = { solidarity: MODERATE, sovereignty: 0, transformation: 0 };

      const modified = IdeologyManager.fromJSON(json);
      modified.updateFactionNames();

      const renamedFaction = modified
        .getFactions()
        .find((f) => f.baseId === NPCFaction.EarthLoyalists)!;
      expect(renamedFaction.name).toBe("Earth Unity Front");

      // Now drift back to neutral via serialization roundtrip
      const json2 = modified.toJSON();
      const earthFaction2 = json2.factions.find(
        (f) => f.baseId === NPCFaction.EarthLoyalists,
      )!;
      earthFaction2.position = { solidarity: 0, sovereignty: 0, transformation: 0 };

      const reverted = IdeologyManager.fromJSON(json2);
      const revertEvents = reverted.updateFactionNames();

      const revertEvent = revertEvents.find((e) => e.type === "FACTION_RENAMED");
      expect(revertEvent).toBeDefined();
      expect(revertEvent!.message).toContain("Earth Unity Front");
      expect(revertEvent!.message).toContain("Earth Loyalists");

      const finalFaction = reverted
        .getFactions()
        .find((f) => f.baseId === NPCFaction.EarthLoyalists)!;
      expect(finalFaction.name).toBe("Earth Loyalists");
    });
  });
});
