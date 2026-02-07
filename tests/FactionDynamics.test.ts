import { describe, it, expect } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import { NPCFaction } from "../src/core/models/NPCInfluence";
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";

function createColonist(
  id: string,
  name: string,
  ideology: { solidarity: number; sovereignty: number; transformation: number; conviction: number },
): Colonist {
  return {
    id,
    name,
    role: ColonistRole.UNASSIGNED,
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
    skills: [],
    ideology,
  };
}

describe("Faction Dynamics", () => {
  // ============ processDefections ============

  describe("processDefections", () => {
    it("detects defection when another faction is significantly closer", () => {
      const manager = new IdeologyManager();

      // Mars Independence is at (0.3, 0.7, 0.3)
      // Corporate Interests is at (-0.6, 0.0, 0.5)
      // Place colonist at midpoint: roughly (-0.15, 0.35, 0.4)
      // Distance to Mars Ind ~ sqrt(0.45^2 + 0.35^2 + 0.1^2) ~ 0.58
      // Distance to Corp ~ sqrt(0.45^2 + 0.35^2 + 0.1^2) ~ 0.58
      // Gap is ~0, conviction multiplier = 1.1, gap*mult ~ 0 < 0.3 => defection
      const colonist = createColonist("c1", "Boundary Colonist", {
        solidarity: -0.15,
        sovereignty: 0.35,
        transformation: 0.4,
        conviction: 0.1,
      });

      const events = manager.processDefections([colonist]);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("COLONIST_DEFECTION");
    });

    it("does not detect defection for colonist firmly in one faction", () => {
      const manager = new IdeologyManager();

      // Colonist very close to Earth Loyalists (0, -0.7, -0.3), far from others
      // Distance to Earth ~ 0.1, distance to Mars ~ sqrt(0.3^2+1.4^2+0.6^2)~1.58
      // Gap = 1.58 - 0.1 = 1.48, * (1+0.5) = 2.22 >> 0.3 => no defection
      const colonist = createColonist("c2", "Loyal Colonist", {
        solidarity: 0.05,
        sovereignty: -0.65,
        transformation: -0.25,
        conviction: 0.5,
      });

      const events = manager.processDefections([colonist]);
      expect(events.length).toBe(0);
    });

    it("high conviction colonists resist defection", () => {
      const manager = new IdeologyManager();

      // Place colonists at a position where low conviction triggers defection
      // but high conviction does not.
      // Need: gap * (1 + lowConviction) < 0.3 AND gap * (1 + highConviction) >= 0.3
      // If gap = 0.2:
      //   low conviction 0.1: 0.2 * 1.1 = 0.22 < 0.3 => defection
      //   high conviction 0.8: 0.2 * 1.8 = 0.36 >= 0.3 => no defection

      // Mars Ind at (0.3, 0.7, 0.3), Corp at (-0.6, 0.0, 0.5)
      // We need a colonist position where the gap between nearest and 2nd nearest
      // is approximately 0.2. Let's use a known spot: slightly closer to Corp
      // than to Mars. Place at (-0.3, 0.15, 0.45).
      // Dist to Corp: sqrt(0.3^2 + 0.15^2 + 0.05^2) = sqrt(0.09+0.0225+0.0025) = sqrt(0.115) ~ 0.339
      // Dist to Mars: sqrt(0.6^2 + 0.55^2 + 0.15^2) = sqrt(0.36+0.3025+0.0225) = sqrt(0.685) ~ 0.828
      // Gap = 0.828 - 0.339 = 0.489 -- too large.

      // Let me find a better position. Use exact midpoint between Mars and Corp:
      // Mid = ((-0.6+0.3)/2, (0+0.7)/2, (0.5+0.3)/2) = (-0.15, 0.35, 0.4)
      // Dist to Corp: sqrt(0.45^2+0.35^2+0.1^2)=sqrt(0.2025+0.1225+0.01)=sqrt(0.335)~0.579
      // Dist to Mars: sqrt(0.45^2+0.35^2+0.1^2)=sqrt(0.335)~0.579
      // Gap ~ 0. Both defect.

      // Shift slightly toward Corp to get gap ~0.2:
      // At (-0.25, 0.25, 0.43):
      // Dist to Corp(-0.6,0,0.5): sqrt(0.35^2+0.25^2+0.07^2)=sqrt(0.1225+0.0625+0.0049)=sqrt(0.1899)~0.436
      // Dist to Mars(0.3,0.7,0.3): sqrt(0.55^2+0.45^2+0.13^2)=sqrt(0.3025+0.2025+0.0169)=sqrt(0.5219)~0.722
      // Gap = 0.722 - 0.436 = 0.286
      // low conv 0.1: 0.286*1.1 = 0.315 > 0.3 => no defection -- too high
      // Need smaller gap. At (-0.20, 0.30, 0.42):
      // Dist to Corp: sqrt(0.4^2+0.3^2+0.08^2)=sqrt(0.16+0.09+0.0064)=sqrt(0.2564)~0.506
      // Dist to Mars: sqrt(0.5^2+0.4^2+0.12^2)=sqrt(0.25+0.16+0.0144)=sqrt(0.4244)~0.651
      // Gap = 0.651 - 0.506 = 0.145
      // low conv 0.1: 0.145*1.1 = 0.16 < 0.3 => defection
      // high conv 0.8: 0.145*1.8 = 0.261 < 0.3 => still defection

      // Need gap where low triggers but high doesn't:
      // gap * 1.1 < 0.3 => gap < 0.273
      // gap * 1.8 >= 0.3 => gap >= 0.167
      // So gap in [0.167, 0.273).
      // Let me target gap = 0.22

      // I'll use a simpler approach: override faction positions for controlled test
      const factions = manager.getFactions() as any[];
      factions[0].position = { solidarity: 0, sovereignty: 0, transformation: 0 };
      factions[1].position = { solidarity: 0.5, sovereignty: 0, transformation: 0 };
      factions[2].position = { solidarity: -1, sovereignty: -1, transformation: -1 };

      // Place colonist at solidarity: 0.1 (nearest is faction 0 at dist 0.1,
      // faction 1 at dist 0.4). Gap = 0.4 - 0.1 = 0.3
      // low conv 0.1: 0.3 * 1.1 = 0.33 >= 0.3 => no defection (on the edge)
      // Let's place at solidarity: 0.15 to get dist to f0 = 0.15, dist to f1 = 0.35
      // Gap = 0.35 - 0.15 = 0.2
      // low conv 0.1: 0.2 * 1.1 = 0.22 < 0.3 => defection
      // high conv 0.8: 0.2 * 1.8 = 0.36 >= 0.3 => no defection

      const lowConviction = createColonist("c_low", "Low Conviction", {
        solidarity: 0.15,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.1,
      });

      const highConviction = createColonist("c_high", "High Conviction", {
        solidarity: 0.15,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.8,
      });

      const lowEvents = manager.processDefections([lowConviction]);
      const highEvents = manager.processDefections([highConviction]);

      expect(lowEvents.length).toBeGreaterThan(0);
      expect(highEvents.length).toBe(0);
    });

    it("skips colonists without ideology", () => {
      const manager = new IdeologyManager();
      const colonist: Colonist = {
        id: "no_ideology",
        name: "No Ideology",
        role: ColonistRole.UNASSIGNED,
        experience: 0,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [],
      };

      const events = manager.processDefections([colonist]);
      expect(events.length).toBe(0);
    });
  });

  // ============ checkFactionMerger ============

  describe("checkFactionMerger", () => {
    it("triggers merger when two factions are within convergence threshold", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];

      factions[0].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };
      factions[1].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };

      const events = manager.checkFactionMerger();

      const mergerEvent = events.find((e) => e.type === "FACTION_MERGER");
      expect(mergerEvent).toBeDefined();
    });

    it("maintains exactly 3 factions after merger (rebirth happens)", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];

      factions[0].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };
      factions[1].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };

      manager.checkFactionMerger();
      expect(manager.getFactions().length).toBe(3);
    });

    it("does not trigger merger when factions are far apart", () => {
      const manager = new IdeologyManager();
      const events = manager.checkFactionMerger();
      expect(events.length).toBe(0);
    });

    it("produces both FACTION_MERGER and FACTION_REBIRTH events", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];

      factions[0].position = { solidarity: 0, sovereignty: 0, transformation: 0 };
      factions[1].position = { solidarity: 0.05, sovereignty: 0.05, transformation: 0.05 };

      const events = manager.checkFactionMerger();
      const types = events.map((e) => e.type);
      expect(types).toContain("FACTION_MERGER");
      expect(types).toContain("FACTION_REBIRTH");
    });

    it("reborn faction gets a new unique id", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];

      const originalId = factions[1].id;
      factions[0].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };
      factions[1].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };

      manager.checkFactionMerger();

      // The absorbed faction (factions[1]) should have a new id
      expect(factions[1].id).not.toBe(originalId);
      expect(factions[1].id).toContain(factions[1].baseId);
    });
  });

  // ============ checkFactionCollapse ============

  describe("checkFactionCollapse", () => {
    it("triggers collapse when faction has less than 15% of colonists", () => {
      const manager = new IdeologyManager();

      // 20 colonists: 18 near Mars Independence, 2 near Earth Loyalists, 0 near Corporate
      const colonists: Colonist[] = [];

      for (let i = 0; i < 18; i++) {
        colonists.push(
          createColonist(`mars_${i}`, `Mars ${i}`, {
            solidarity: 0.3,
            sovereignty: 0.7,
            transformation: 0.3,
            conviction: 0.5,
          }),
        );
      }

      for (let i = 0; i < 2; i++) {
        colonists.push(
          createColonist(`earth_${i}`, `Earth ${i}`, {
            solidarity: 0.0,
            sovereignty: -0.7,
            transformation: -0.3,
            conviction: 0.5,
          }),
        );
      }

      const events = manager.checkFactionCollapse(colonists);
      const collapseEvents = events.filter((e) => e.type === "FACTION_COLLAPSE");

      // Corporate has 0% and Earth has 10% -- both below 15%
      expect(collapseEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("maintains exactly 3 factions after collapse", () => {
      const manager = new IdeologyManager();

      const colonists: Colonist[] = [];
      for (let i = 0; i < 20; i++) {
        colonists.push(
          createColonist(`mars_${i}`, `Mars ${i}`, {
            solidarity: 0.3,
            sovereignty: 0.7,
            transformation: 0.3,
            conviction: 0.5,
          }),
        );
      }

      manager.checkFactionCollapse(colonists);
      expect(manager.getFactions().length).toBe(3);
    });

    it("does not collapse faction with sufficient support", () => {
      const manager = new IdeologyManager();

      // Distribute colonists roughly equally across all 3 factions
      const colonists: Colonist[] = [];

      for (let i = 0; i < 10; i++) {
        colonists.push(
          createColonist(`mars_${i}`, `Mars ${i}`, {
            solidarity: 0.3,
            sovereignty: 0.7,
            transformation: 0.3,
            conviction: 0.5,
          }),
        );
      }

      for (let i = 0; i < 10; i++) {
        colonists.push(
          createColonist(`earth_${i}`, `Earth ${i}`, {
            solidarity: 0.0,
            sovereignty: -0.7,
            transformation: -0.3,
            conviction: 0.5,
          }),
        );
      }

      for (let i = 0; i < 10; i++) {
        colonists.push(
          createColonist(`corp_${i}`, `Corp ${i}`, {
            solidarity: -0.6,
            sovereignty: 0.0,
            transformation: 0.5,
            conviction: 0.5,
          }),
        );
      }

      const events = manager.checkFactionCollapse(colonists);
      const collapseEvents = events.filter((e) => e.type === "FACTION_COLLAPSE");
      expect(collapseEvents.length).toBe(0);
    });

    it("generates both FACTION_COLLAPSE and FACTION_REBIRTH events", () => {
      const manager = new IdeologyManager();

      const colonists: Colonist[] = [];
      for (let i = 0; i < 20; i++) {
        colonists.push(
          createColonist(`mars_${i}`, `Mars ${i}`, {
            solidarity: 0.3,
            sovereignty: 0.7,
            transformation: 0.3,
            conviction: 0.5,
          }),
        );
      }

      const events = manager.checkFactionCollapse(colonists);
      const types = events.map((e) => e.type);
      expect(types).toContain("FACTION_COLLAPSE");
      expect(types).toContain("FACTION_REBIRTH");
    });
  });

  // ============ Rebirth Position ============

  describe("rebirth position", () => {
    it("places reborn faction far from existing factions", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];

      // Put two factions at the same corner
      factions[0].position = { solidarity: 0.8, sovereignty: 0.8, transformation: 0.8 };
      factions[1].position = { solidarity: 0.8, sovereignty: 0.8, transformation: 0.8 };
      factions[2].position = { solidarity: -0.8, sovereignty: -0.8, transformation: -0.8 };

      // Trigger merger of factions 0 and 1
      const eventsBefore = manager.checkFactionMerger();
      expect(eventsBefore.some((e) => e.type === "FACTION_REBIRTH")).toBe(true);

      // The reborn faction should be far from both remaining faction positions
      const reborn = factions[1];
      const distToF0 = Math.sqrt(
        (reborn.position.solidarity - factions[0].position.solidarity) ** 2 +
          (reborn.position.sovereignty - factions[0].position.sovereignty) ** 2 +
          (reborn.position.transformation - factions[0].position.transformation) ** 2,
      );
      const distToF2 = Math.sqrt(
        (reborn.position.solidarity - factions[2].position.solidarity) ** 2 +
          (reborn.position.sovereignty - factions[2].position.sovereignty) ** 2 +
          (reborn.position.transformation - factions[2].position.transformation) ** 2,
      );

      // Minimum distance to any existing faction should be significant
      expect(Math.min(distToF0, distToF2)).toBeGreaterThan(0.3);
    });
  });

  // ============ Invariant: Always 3 Factions ============

  describe("invariant: always three factions", () => {
    it("starts with exactly 3 factions", () => {
      const manager = new IdeologyManager();
      expect(manager.getFactions().length).toBe(3);
    });

    it("has 3 factions after merger", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];
      factions[0].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };
      factions[1].position = { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 };
      manager.checkFactionMerger();
      expect(manager.getFactions().length).toBe(3);
    });

    it("has 3 factions after collapse", () => {
      const manager = new IdeologyManager();
      const colonists = Array.from({ length: 30 }, (_, i) =>
        createColonist(`m${i}`, `Colonist ${i}`, {
          solidarity: 0.3,
          sovereignty: 0.7,
          transformation: 0.3,
          conviction: 0.5,
        }),
      );
      manager.checkFactionCollapse(colonists);
      expect(manager.getFactions().length).toBe(3);
    });

    it("has 3 factions after multiple mergers and collapses", () => {
      const manager = new IdeologyManager();
      const factions = manager.getFactions() as any[];

      // Force merger
      factions[0].position = { solidarity: 0, sovereignty: 0, transformation: 0 };
      factions[1].position = { solidarity: 0, sovereignty: 0, transformation: 0 };
      manager.checkFactionMerger();
      expect(manager.getFactions().length).toBe(3);

      // Force collapse with skewed population
      const colonists = Array.from({ length: 30 }, (_, i) =>
        createColonist(`c${i}`, `Colonist ${i}`, {
          solidarity: 0.3,
          sovereignty: 0.7,
          transformation: 0.3,
          conviction: 0.5,
        }),
      );
      manager.checkFactionCollapse(colonists);
      expect(manager.getFactions().length).toBe(3);
    });
  });
});
