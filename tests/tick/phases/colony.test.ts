import { describe, test, expect } from "bun:test";
import {
  calculateSocialCohesion,
  calculatePolicyEffects,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "../../../src/core/tick/phases/colony";
import { createTickContext } from "../../../src/core/tick/TickContext";
import { GameState } from "../../../src/core/GameState";

describe("colony phases", () => {
  function createTestContext() {
    const state = new GameState();
    return createTickContext(
      state.currentSol,
      {
        resources: state.resources,
        buildings: state.buildings,
        colony: state.colony,
        workforce: state.workforce,
        technology: state.technology,
        operations: state.operations,
        npcInfluence: state.npcInfluence,
        events: state.events,
        victory: state.victory,
      },
      { autoAssignNewColonists: true },
    );
  }

  describe("calculateSocialCohesion", () => {
    test("has correct phase metadata", () => {
      expect(calculateSocialCohesion.id).toBe("colony:calculateSocialCohesion");
      expect(calculateSocialCohesion.name).toBe("Calculate Social Cohesion");
      expect(calculateSocialCohesion.reads).toContain("colony");
      expect(calculateSocialCohesion.reads).toContain("workforce");
      expect(calculateSocialCohesion.writes).toContain("derived.socialCohesion");
    });

    test("populates derived.socialCohesion", () => {
      const ctx = createTestContext();
      expect(ctx.derived.socialCohesion).toBeNull();
      calculateSocialCohesion.execute(ctx);
      expect(ctx.derived.socialCohesion).not.toBeNull();
      expect(ctx.derived.socialCohesion).toHaveProperty("averageClusteringCoefficient");
      expect(ctx.derived.socialCohesion).toHaveProperty("isolatedColonists");
    });

    test("returns empty events array", () => {
      const ctx = createTestContext();
      const events = calculateSocialCohesion.execute(ctx);
      expect(events).toEqual([]);
    });
  });

  describe("calculatePolicyEffects", () => {
    test("has correct phase metadata", () => {
      expect(calculatePolicyEffects.id).toBe("colony:calculatePolicyEffects");
      expect(calculatePolicyEffects.name).toBe("Calculate Policy Effects");
      expect(calculatePolicyEffects.reads).toContain("operations");
      expect(calculatePolicyEffects.writes).toContain("derived.policyEffects");
    });

    test("populates derived.policyEffects", () => {
      const ctx = createTestContext();
      expect(ctx.derived.policyEffects).toBeNull();
      calculatePolicyEffects.execute(ctx);
      expect(ctx.derived.policyEffects).not.toBeNull();
      expect(ctx.derived.policyEffects).toHaveProperty("morale");
      expect(ctx.derived.policyEffects).toHaveProperty("health");
    });

    test("returns empty events array", () => {
      const ctx = createTestContext();
      const events = calculatePolicyEffects.execute(ctx);
      expect(events).toEqual([]);
    });
  });

  describe("processColonyTick", () => {
    test("has correct phase metadata", () => {
      expect(processColonyTick.id).toBe("colony:processColonyTick");
      expect(processColonyTick.name).toBe("Process Colony Tick");
      expect(processColonyTick.reads).toContain("colony");
      expect(processColonyTick.reads).toContain("resources");
      expect(processColonyTick.reads).toContain("buildings");
      expect(processColonyTick.reads).toContain("derived.socialCohesion");
      expect(processColonyTick.reads).toContain("derived.policyEffects");
      expect(processColonyTick.writes).toContain("colony");
      expect(processColonyTick.writes).toContain("resources");
      expect(processColonyTick.writes).toContain("events");
    });

    test("executes without error when derived values populated", () => {
      const ctx = createTestContext();
      // Setup derived values that processColonyTick expects
      calculateSocialCohesion.execute(ctx);
      calculatePolicyEffects.execute(ctx);
      const events = processColonyTick.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    test("executes with default values when derived values are null", () => {
      const ctx = createTestContext();
      // Don't populate derived values - should use defaults
      const events = processColonyTick.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("autoAssignWorkers", () => {
    test("has correct phase metadata", () => {
      expect(autoAssignWorkers.id).toBe("colony:autoAssignWorkers");
      expect(autoAssignWorkers.name).toBe("Auto-Assign Workers");
      expect(autoAssignWorkers.reads).toContain("colony");
      expect(autoAssignWorkers.reads).toContain("buildings");
      expect(autoAssignWorkers.reads).toContain("settings.autoAssignNewColonists");
      expect(autoAssignWorkers.writes).toContain("buildings");
      expect(autoAssignWorkers.writes).toContain("events");
    });

    test("returns empty events array when auto-assign disabled", () => {
      const state = new GameState();
      const ctx = createTickContext(
        state.currentSol,
        {
          resources: state.resources,
          buildings: state.buildings,
          colony: state.colony,
          workforce: state.workforce,
          technology: state.technology,
          operations: state.operations,
          npcInfluence: state.npcInfluence,
          events: state.events,
          victory: state.victory,
        },
        { autoAssignNewColonists: false },
      );
      const events = autoAssignWorkers.execute(ctx);
      expect(events).toEqual([]);
    });

    test("executes when auto-assign enabled", () => {
      const ctx = createTestContext();
      const events = autoAssignWorkers.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe("assignHousing", () => {
    test("has correct phase metadata", () => {
      expect(assignHousing.id).toBe("colony:assignHousing");
      expect(assignHousing.name).toBe("Assign Housing");
      expect(assignHousing.reads).toContain("colony");
      expect(assignHousing.reads).toContain("buildings");
      expect(assignHousing.writes).toContain("colony");
    });

    test("executes without error", () => {
      const ctx = createTestContext();
      const events = assignHousing.execute(ctx);
      expect(Array.isArray(events)).toBe(true);
    });

    test("returns empty events array", () => {
      const ctx = createTestContext();
      const events = assignHousing.execute(ctx);
      expect(events).toEqual([]);
    });
  });
});
