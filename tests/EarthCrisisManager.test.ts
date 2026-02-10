import { describe, it, expect, beforeEach } from "bun:test";
import { EarthCrisisManager } from "../src/core/systems/EarthCrisisManager.js";
import { EARTH_CRISIS_BALANCE } from "../src/core/balance/EarthCrisisBalance.js";

describe("EarthCrisisManager", () => {
  let manager: EarthCrisisManager;

  beforeEach(() => {
    manager = new EarthCrisisManager();
  });

  describe("initialization", () => {
    it("should start at 0% severity", () => {
      const state = manager.getState();
      expect(state.severity).toBe(0);
    });

    it("should not be at point of no return initially", () => {
      const state = manager.getState();
      expect(state.pointOfNoReturn).toBe(false);
    });
  });

  describe("severity progression", () => {
    it("should increase severity each tick", () => {
      manager.tick(1);
      const state = manager.getState();
      expect(state.severity).toBe(EARTH_CRISIS_BALANCE.severityPerSol);
    });

    it("should cap severity at 100%", () => {
      for (let i = 0; i < 1500; i++) {
        manager.tick(i);
      }
      const state = manager.getState();
      expect(state.severity).toBe(100);
    });

    it("should set pointOfNoReturn at 100%", () => {
      for (let i = 0; i < 1500; i++) {
        manager.tick(i);
      }
      const state = manager.getState();
      expect(state.pointOfNoReturn).toBe(true);
    });

    it("should stop increasing severity after pointOfNoReturn", () => {
      for (let i = 0; i < 1500; i++) {
        manager.tick(i);
      }
      const stateBefore = manager.getState();
      manager.tick(1001);
      const stateAfter = manager.getState();
      expect(stateAfter.severity).toBe(stateBefore.severity);
    });
  });

  describe("threshold triggers", () => {
    it("should trigger refugee wave at 25% severity", () => {
      let effects: ReturnType<typeof manager.tick> = [];
      // 25% severity at ceil(25 / severityPerSol) sols
      const maxSol = Math.ceil(25 / EARTH_CRISIS_BALANCE.severityPerSol) + 10;
      for (let sol = 1; sol <= maxSol; sol++) {
        effects = manager.tick(sol);
        if (effects.some((e) => e.type === "refugee_wave")) break;
      }
      expect(effects.some((e) => e.type === "refugee_wave")).toBe(true);
    });

    it("should include refugee count in effect params", () => {
      let effects: ReturnType<typeof manager.tick> = [];
      const maxSol = Math.ceil(25 / EARTH_CRISIS_BALANCE.severityPerSol) + 10;
      for (let sol = 1; sol <= maxSol; sol++) {
        effects = manager.tick(sol);
        if (effects.some((e) => e.type === "refugee_wave")) break;
      }
      const refugeeEffect = effects.find((e) => e.type === "refugee_wave");
      expect(refugeeEffect?.params?.count).toBe(2);
    });

    it("should repeat refugee waves at intervals", () => {
      let refugeeWaveCount = 0;
      for (let sol = 1; sol <= 400; sol++) {
        const effects = manager.tick(sol);
        if (effects.some((e) => e.type === "refugee_wave")) {
          refugeeWaveCount++;
        }
      }
      expect(refugeeWaveCount).toBeGreaterThan(1);
    });

    it("should emit earth_collapse event at 100%", () => {
      let collapseEvent = null;
      for (let sol = 1; sol <= 1500; sol++) {
        const effects = manager.tick(sol);
        const collapse = effects.find((e) => e.type === "earth_collapse");
        if (collapse) {
          collapseEvent = collapse;
          break;
        }
      }
      expect(collapseEvent).not.toBeNull();
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize state", () => {
      for (let i = 0; i < 100; i++) {
        manager.tick(i);
      }
      const json = manager.toJSON();
      const restored = EarthCrisisManager.fromJSON(json);
      expect(restored.getState()).toEqual(manager.getState());
    });
  });
});
