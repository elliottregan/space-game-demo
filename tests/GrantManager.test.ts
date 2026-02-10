import { describe, test, expect, beforeEach } from "bun:test";
import { GrantManager } from "../src/core/systems/GrantManager";
import { SeededRandom } from "../src/core/utils/random";
import { GrantSourceId, GrantTemplateId, type AvailableGrant } from "../src/core/models/Grant";
import { GRANT_TEMPLATES, GRANT_SOURCES } from "../src/core/data/grants";
import {
  GRANT_MIN_SOL,
  GRANT_REFRESH_INTERVAL,
  GRANTS_PER_REFRESH,
  MAX_ACTIVE_GRANTS,
  MAX_GRANTS_PER_SOURCE,
  GRANT_IDEOLOGY_SHIFT_BASE,
  GRANT_CONVICTION_RESISTANCE,
} from "../src/core/balance/GrantBalance";
import type { ColonistIdeology } from "../src/core/models/Colonist";

describe("GrantManager", () => {
  let manager: GrantManager;
  let rng: SeededRandom;

  beforeEach(() => {
    manager = new GrantManager();
    rng = new SeededRandom(42);
  });

  // ============ Refresh / Selection ============

  describe("shouldRefresh", () => {
    test("returns false before GRANT_MIN_SOL", () => {
      expect(manager.shouldRefresh(GRANT_MIN_SOL - 1)).toBe(false);
    });

    test("returns true at GRANT_MIN_SOL when never refreshed", () => {
      expect(manager.shouldRefresh(GRANT_MIN_SOL)).toBe(true);
    });

    test("returns false immediately after refresh", () => {
      manager.refreshGrants(GRANT_MIN_SOL, rng);
      expect(manager.shouldRefresh(GRANT_MIN_SOL + 1)).toBe(false);
    });

    test("returns true after refresh interval elapses", () => {
      manager.refreshGrants(GRANT_MIN_SOL, rng);
      expect(manager.shouldRefresh(GRANT_MIN_SOL + GRANT_REFRESH_INTERVAL)).toBe(true);
    });
  });

  describe("refreshGrants", () => {
    test("produces GRANTS_PER_REFRESH grants", () => {
      manager.refreshGrants(100, rng);
      expect(manager.getAvailableGrants().length).toBe(GRANTS_PER_REFRESH);
    });

    test("replaces previously available grants", () => {
      manager.refreshGrants(100, rng);
      const first = manager.getAvailableGrants().map((g) => g.id);
      manager.refreshGrants(140, rng);
      const second = manager.getAvailableGrants().map((g) => g.id);
      expect(first).not.toEqual(second);
    });

    test("each grant has unique id", () => {
      manager.refreshGrants(100, rng);
      const ids = manager.getAvailableGrants().map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("sets offeredSol to current sol", () => {
      manager.refreshGrants(100, rng);
      for (const grant of manager.getAvailableGrants()) {
        expect(grant.offeredSol).toBe(100);
      }
    });

    test("respects minSol on templates", () => {
      // At sol 15, only templates with minSol <= 15 should appear
      manager.refreshGrants(15, rng);
      for (const grant of manager.getAvailableGrants()) {
        const template = GRANT_TEMPLATES.find((t) => t.id === grant.templateId);
        expect(template).toBeDefined();
        expect(template?.minSol).toBeLessThanOrEqual(15);
      }
    });

    test("source diversity: prefers different sources", () => {
      // Run many times and check that we get source variety
      let multiSourceCount = 0;
      for (let seed = 0; seed < 50; seed++) {
        const testRng = new SeededRandom(seed);
        const testManager = new GrantManager();
        testManager.refreshGrants(100, testRng);
        const sources = new Set(testManager.getAvailableGrants().map((g) => g.sourceId));
        if (sources.size >= 2) multiSourceCount++;
      }
      // With diversity bonus, most refreshes should have 2+ sources
      expect(multiSourceCount).toBeGreaterThan(30);
    });
  });

  // ============ Assignment Validation ============

  describe("canAssignGrant", () => {
    test("allows valid assignment", () => {
      manager.refreshGrants(100, rng);
      const grant = manager.getAvailableGrants()[0]!;
      expect(manager.canAssignGrant(grant.id, "district_1").allowed).toBe(true);
    });

    test("rejects non-existent grant", () => {
      const result = manager.canAssignGrant(999, "district_1");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    test("rejects when MAX_ACTIVE_GRANTS reached", () => {
      // Set up controlled state with MAX_ACTIVE_GRANTS active grants via JSON
      const json = manager.toJSON();
      json.activeGrants = [];
      for (let i = 0; i < MAX_ACTIVE_GRANTS; i++) {
        json.activeGrants.push({
          id: i + 1,
          templateId: GrantTemplateId.MINERAL_SHIPMENT,
          sourceId: [
            GrantSourceId.HELIOS_MINING,
            GrantSourceId.EARTH_SCIENCE_COUNCIL,
            GrantSourceId.MARS_HERITAGE,
            GrantSourceId.IMMIGRATION_BUREAU,
            GrantSourceId.AUTONOMOUS_COLLECTIVE,
          ][i % 5] as GrantSourceId,
          districtId: "district_1",
          assignedSol: 100,
        });
      }
      json.nextGrantId = MAX_ACTIVE_GRANTS + 1;
      const testManager = GrantManager.fromJSON(json);

      testManager.refreshGrants(200, rng);
      const grant = testManager.getAvailableGrants()[0]!;
      const result = testManager.canAssignGrant(grant.id, "district_1");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Maximum active grants");
    });

    test("rejects when MAX_GRANTS_PER_SOURCE reached for same source", () => {
      // Find templates from same source
      const sourceId = GrantSourceId.HELIOS_MINING;
      const templates = GRANT_TEMPLATES.filter((t) => t.sourceId === sourceId);
      expect(templates.length).toBeGreaterThanOrEqual(MAX_GRANTS_PER_SOURCE);

      // Manually add active grants from this source
      for (let i = 0; i < MAX_GRANTS_PER_SOURCE; i++) {
        manager.refreshGrants(100 + i * GRANT_REFRESH_INTERVAL, rng);
        // Find one from desired source or inject one
        const available = manager.getAvailableGrants();
        // Assign the first one - we need to manually set up the scenario
        const grant = available[0]!;
        const result = manager.assignGrant(grant.id, "district_1", 100);
        // Force the source to be what we want for testing
        if (result) {
          (result as any).sourceId = sourceId;
        }
      }

      // Better approach: use a fresh manager with controlled state
      const testManager = new GrantManager();

      // Use fromJSON to set up controlled state
      const json = testManager.toJSON();
      json.activeGrants = [];
      for (let i = 0; i < MAX_GRANTS_PER_SOURCE; i++) {
        json.activeGrants.push({
          id: i + 1,
          templateId: templates[i % templates.length]!.id,
          sourceId: sourceId,
          districtId: "district_1",
          assignedSol: 100,
          remainingSols: 30,
        });
      }
      json.nextGrantId = MAX_GRANTS_PER_SOURCE + 1;
      const restored = GrantManager.fromJSON(json);

      // Now add an available grant from same source
      const rng2 = new SeededRandom(42);
      restored.refreshGrants(200, rng2);
      const newGrant = restored.getAvailableGrants().find((g) => g.sourceId === sourceId);
      if (newGrant) {
        const result = restored.canAssignGrant(newGrant.id, "district_1");
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Maximum grants from this source");
      }
    });
  });

  describe("assignGrant", () => {
    test("moves grant from available to active", () => {
      manager.refreshGrants(100, rng);
      const grant = manager.getAvailableGrants()[0]!;
      const grantId = grant.id;

      const result = manager.assignGrant(grantId, "district_1", 100);

      expect(result).not.toBeNull();
      expect(result?.districtId).toBe("district_1");
      expect(result?.assignedSol).toBe(100);
      expect(manager.getAvailableGrants().find((g) => g.id === grantId)).toBeUndefined();
      expect(manager.getActiveGrants().find((g) => g.id === grantId)).toBeDefined();
    });

    test("sets remainingSols for timed grants", () => {
      // Keep refreshing until we get a timed grant
      let timedGrant: AvailableGrant | undefined;
      for (let sol = 100; sol < 500; sol += GRANT_REFRESH_INTERVAL) {
        manager.refreshGrants(sol, rng);
        timedGrant = manager.getAvailableGrants().find((g) => {
          const template = GRANT_TEMPLATES.find((t) => t.id === g.templateId);
          return template?.effect.type === "timed";
        });
        if (timedGrant) break;
      }

      if (timedGrant) {
        const result = manager.assignGrant(timedGrant.id, "district_1", 200);
        expect(result).not.toBeNull();
        expect(result?.remainingSols).toBeDefined();
        expect(result?.remainingSols).toBeGreaterThan(0);
      }
    });

    test("returns null for invalid grant", () => {
      expect(manager.assignGrant(999, "district_1", 100)).toBeNull();
    });
  });

  // ============ Timed Grant Processing ============

  describe("processTimedGrants", () => {
    test("decrements remaining sols", () => {
      // Set up a timed active grant via JSON
      const json = manager.toJSON();
      json.activeGrants = [
        {
          id: 1,
          templateId: GrantTemplateId.EXTRACTION_TECH,
          sourceId: GrantSourceId.HELIOS_MINING,
          districtId: "district_1",
          assignedSol: 100,
          remainingSols: 5,
        },
      ];
      json.nextGrantId = 2;
      const testManager = GrantManager.fromJSON(json);

      testManager.processTimedGrants();

      const active = testManager.getActiveGrants();
      expect(active.length).toBe(1);
      expect(active[0]?.remainingSols).toBe(4);
    });

    test("removes expired grants and returns their IDs", () => {
      const json = manager.toJSON();
      json.activeGrants = [
        {
          id: 1,
          templateId: GrantTemplateId.EXTRACTION_TECH,
          sourceId: GrantSourceId.HELIOS_MINING,
          districtId: "district_1",
          assignedSol: 100,
          remainingSols: 1,
        },
      ];
      json.nextGrantId = 2;
      const testManager = GrantManager.fromJSON(json);

      const expired = testManager.processTimedGrants();

      expect(expired).toEqual([1]);
      expect(testManager.getActiveGrants().length).toBe(0);
    });

    test("keeps instant grants (no remainingSols)", () => {
      const json = manager.toJSON();
      json.activeGrants = [
        {
          id: 1,
          templateId: GrantTemplateId.MINERAL_SHIPMENT,
          sourceId: GrantSourceId.HELIOS_MINING,
          districtId: "district_1",
          assignedSol: 100,
        },
      ];
      json.nextGrantId = 2;
      const testManager = GrantManager.fromJSON(json);

      const expired = testManager.processTimedGrants();

      expect(expired).toEqual([]);
      expect(testManager.getActiveGrants().length).toBe(1);
    });
  });

  // ============ Ideology Shift ============

  describe("applyIdeologyShift", () => {
    test("shifts ideology toward source position", () => {
      const colonists = [
        {
          ideology: {
            solidarity: 0,
            sovereignty: 0,
            transformation: 0,
            conviction: 0,
          } as ColonistIdeology,
        },
      ];

      // oxlint-disable-next-line no-non-null-assertion
      const source = GRANT_SOURCES.find((s) => s.id === GrantSourceId.HELIOS_MINING)!;
      GrantManager.applyIdeologyShift(colonists, source.ideologyPosition, 1.0);

      // oxlint-disable-next-line no-non-null-assertion
      const ideology = colonists[0]!.ideology!;
      // Helios: solidarity -0.5, sovereignty 0.0, transformation +0.3
      expect(ideology.solidarity).toBeLessThan(0); // Shifted negative
      expect(ideology.sovereignty).toBe(0); // No shift (source is 0)
      expect(ideology.transformation).toBeGreaterThan(0); // Shifted positive
    });

    test("conviction resists ideology shift", () => {
      const lowConviction = {
        ideology: {
          solidarity: 0,
          sovereignty: 0,
          transformation: 0,
          conviction: 0.1,
        } as ColonistIdeology,
      };
      const highConviction = {
        ideology: {
          solidarity: 0,
          sovereignty: 0,
          transformation: 0,
          conviction: 0.9,
        } as ColonistIdeology,
      };

      // oxlint-disable-next-line no-non-null-assertion
      const source = GRANT_SOURCES.find((s) => s.id === GrantSourceId.HELIOS_MINING)!;
      GrantManager.applyIdeologyShift([lowConviction], source.ideologyPosition, 1.0);
      GrantManager.applyIdeologyShift([highConviction], source.ideologyPosition, 1.0);

      // High conviction colonist should shift less
      expect(Math.abs(lowConviction.ideology!.solidarity)).toBeGreaterThan(
        Math.abs(highConviction.ideology!.solidarity),
      );
    });

    test("clamps ideology to [-1, 1]", () => {
      const colonist = {
        ideology: {
          solidarity: 0.95,
          sovereignty: -0.95,
          transformation: 0.0,
          conviction: 0,
        } as ColonistIdeology,
      };

      // Apply a strong shift
      GrantManager.applyIdeologyShift(
        [colonist],
        { solidarity: 1.0, sovereignty: -1.0, transformation: 0.0 },
        5.0, // High magnitude to force clamping
      );

      expect(colonist.ideology!.solidarity).toBeLessThanOrEqual(1);
      expect(colonist.ideology!.sovereignty).toBeGreaterThanOrEqual(-1);
    });

    test("skips colonists without ideology", () => {
      const colonists = [{ ideology: undefined as ColonistIdeology | undefined }];
      const affected = GrantManager.applyIdeologyShift(
        colonists,
        { solidarity: 0.5, sovereignty: 0.5, transformation: 0.5 },
        1.0,
      );
      expect(affected).toBe(0);
    });

    test("returns correct count of affected colonists", () => {
      const colonists = [
        { ideology: { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0 } },
        { ideology: { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0 } },
        { ideology: undefined as ColonistIdeology | undefined },
      ];

      const affected = GrantManager.applyIdeologyShift(
        colonists,
        { solidarity: 0.5, sovereignty: 0, transformation: 0 },
        1.0,
      );
      expect(affected).toBe(2);
    });

    test("magnitude scales the shift", () => {
      const lowMag = {
        ideology: { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0 },
      };
      const highMag = {
        ideology: { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0 },
      };

      const pos = { solidarity: 1.0, sovereignty: 0, transformation: 0 };
      GrantManager.applyIdeologyShift([lowMag], pos, 0.5);
      GrantManager.applyIdeologyShift([highMag], pos, 2.0);

      expect(Math.abs(highMag.ideology.solidarity)).toBeGreaterThan(
        Math.abs(lowMag.ideology.solidarity),
      );
    });

    test("shift formula matches spec", () => {
      const colonist = {
        ideology: { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0.5 },
      };
      const sourcePosition = { solidarity: 1.0, sovereignty: -0.5, transformation: 0 };
      const magnitude = 1.0;

      GrantManager.applyIdeologyShift([colonist], sourcePosition, magnitude);

      // Expected: resistance = 0.5 * 0.7 = 0.35
      // strength = 0.12 * 1.0 * (1 - 0.35) = 0.078
      // solidarity: 0 + 0.078 * 1.0 = 0.078
      // sovereignty: 0 + 0.078 * -0.5 = -0.039
      // transformation: 0 + 0.078 * 0 = 0
      const expectedResistance = 0.5 * GRANT_CONVICTION_RESISTANCE;
      const expectedStrength = GRANT_IDEOLOGY_SHIFT_BASE * magnitude * (1 - expectedResistance);

      expect(colonist.ideology.solidarity).toBeCloseTo(expectedStrength * 1.0, 6);
      expect(colonist.ideology.sovereignty).toBeCloseTo(expectedStrength * -0.5, 6);
      expect(colonist.ideology.transformation).toBeCloseTo(0, 6);
    });
  });

  // ============ Serialization ============

  describe("toJSON / fromJSON", () => {
    test("round-trips empty state", () => {
      const json = manager.toJSON();
      const restored = GrantManager.fromJSON(json);
      expect(restored.getAvailableGrants()).toEqual([]);
      expect(restored.getActiveGrants()).toEqual([]);
      expect(restored.getLastRefreshSol()).toBe(0);
    });

    test("round-trips with available and active grants", () => {
      manager.refreshGrants(100, rng);
      const firstGrant = manager.getAvailableGrants()[0]!;
      manager.assignGrant(firstGrant.id, "district_1", 100);

      const remainingAvailable = manager.getAvailableGrants().length;
      const json = manager.toJSON();
      const restored = GrantManager.fromJSON(json);

      expect(restored.getAvailableGrants().length).toBe(remainingAvailable);
      expect(restored.getActiveGrants().length).toBe(1);
      expect(restored.getActiveGrants()[0]?.districtId).toBe("district_1");
      expect(restored.getLastRefreshSol()).toBe(100);
    });

    test("preserves nextGrantId", () => {
      manager.refreshGrants(100, rng);
      manager.refreshGrants(140, rng);

      const json = manager.toJSON();
      const restored = GrantManager.fromJSON(json);

      // Refresh on restored manager should produce higher IDs
      restored.refreshGrants(180, rng);
      const maxOriginalId = Math.max(...json.availableGrants.map((g) => g.id));
      const newIds = restored.getAvailableGrants().map((g) => g.id);
      for (const id of newIds) {
        expect(id).toBeGreaterThan(maxOriginalId);
      }
    });
  });

  // ============ Integration: getNextRefreshSol ============

  describe("getNextRefreshSol", () => {
    test("returns GRANT_MIN_SOL when never refreshed", () => {
      expect(manager.getNextRefreshSol()).toBe(GRANT_MIN_SOL);
    });

    test("returns lastRefreshSol + interval after refresh", () => {
      manager.refreshGrants(100, rng);
      expect(manager.getNextRefreshSol()).toBe(100 + GRANT_REFRESH_INTERVAL);
    });
  });
});
