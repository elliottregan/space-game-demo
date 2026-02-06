import { describe, it, expect } from "bun:test";
import {
  LS_QUALITY_COMFORTABLE,
  LS_QUALITY_CRISIS,
  LS_QUALITY_PRESSURE,
} from "../src/core/balance/LifeSupportBalance";
import { LifeSupportManager } from "../src/core/systems/LifeSupportManager";
import { RESOURCE_KEYS } from "../src/core/models/Resources";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";

describe("LifeSupportBalance constants", () => {
  it("should have threshold constants in correct order", () => {
    expect(LS_QUALITY_COMFORTABLE).toBeGreaterThan(LS_QUALITY_PRESSURE);
    expect(LS_QUALITY_PRESSURE).toBeGreaterThan(LS_QUALITY_CRISIS);
  });

  it("should have comfortable threshold at 0.8", () => {
    expect(LS_QUALITY_COMFORTABLE).toBe(0.8);
  });

  it("should have pressure threshold at 0.55", () => {
    expect(LS_QUALITY_PRESSURE).toBe(0.55);
  });

  it("should have crisis threshold at 0.35", () => {
    expect(LS_QUALITY_CRISIS).toBe(0.35);
  });
});

describe("LifeSupportManager", () => {
  describe("calculate", () => {
    it("should return high quality when capacity far exceeds demand", () => {
      const manager = new LifeSupportManager();
      const quality = manager.calculate(5, 0, 20); // utilization = 5/20 = 0.25
      expect(quality).toBeGreaterThan(0.95);
    });

    it("should return lower quality when demand approaches capacity", () => {
      const manager = new LifeSupportManager();
      const quality = manager.calculate(8, 2, 12); // utilization = 10/12 = 0.83
      expect(quality).toBeLessThan(0.8);
      expect(quality).toBeGreaterThan(0.5);
    });

    it("should return 0 when capacity is 0 and population exists", () => {
      const manager = new LifeSupportManager();
      const quality = manager.calculate(10, 0, 0);
      expect(quality).toBe(0);
    });

    it("should return 1 when capacity is 0 and population is 0", () => {
      const manager = new LifeSupportManager();
      const quality = manager.calculate(0, 0, 0);
      expect(quality).toBe(1);
    });

    it("should clamp to 0-1 range", () => {
      const manager = new LifeSupportManager();
      expect(manager.calculate(5, 0, 100)).toBeLessThanOrEqual(1);
      expect(manager.calculate(5, 0, 100)).toBeGreaterThanOrEqual(0);
      expect(manager.calculate(100, 50, 10)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getQuality", () => {
    it("should return current quality value", () => {
      const manager = new LifeSupportManager();
      manager.calculate(10, 2, 15); // utilization = 12/15 = 0.8
      expect(manager.getQuality()).toBeGreaterThan(0);
      expect(manager.getQuality()).toBeLessThanOrEqual(1);
    });
  });
});

describe("LifeSupportManager effects", () => {
  describe("getHealthEffect", () => {
    it("should return 0 when quality is comfortable (>=0.8)", () => {
      const manager = new LifeSupportManager();
      manager.calculate(5, 0, 20); // low utilization = high quality
      expect(manager.getHealthEffect()).toBe(0);
    });

    it("should return negative value when quality is below comfortable", () => {
      const manager = new LifeSupportManager();
      manager.calculate(10, 5, 16); // utilization = 15/16 = 0.9375 -> quality ~0.55-0.8
      expect(manager.getHealthEffect()).toBeLessThan(0);
    });
  });

  describe("getMoraleEffect", () => {
    it("should return 0 when quality is comfortable (>=0.8)", () => {
      const manager = new LifeSupportManager();
      manager.calculate(5, 0, 20); // low utilization
      expect(manager.getMoraleEffect()).toBe(0);
    });

    it("should return negative value when quality is strained", () => {
      const manager = new LifeSupportManager();
      manager.calculate(10, 5, 16); // high utilization
      expect(manager.getMoraleEffect()).toBeLessThan(0);
    });
  });

  describe("getEfficiencyMultiplier", () => {
    it("should return 1 when quality is above crisis threshold", () => {
      const manager = new LifeSupportManager();
      manager.calculate(5, 0, 20); // low utilization = high quality
      expect(manager.getEfficiencyMultiplier()).toBe(1);
    });

    it("should return <1 when quality is below crisis threshold", () => {
      const manager = new LifeSupportManager();
      manager.calculate(20, 5, 15); // utilization > 1.0 -> very low quality
      expect(manager.getEfficiencyMultiplier()).toBeLessThan(1);
      expect(manager.getEfficiencyMultiplier()).toBeGreaterThan(0);
    });
  });
});

describe("LifeSupportManager serialization", () => {
  it("should serialize to JSON", () => {
    const manager = new LifeSupportManager();
    manager.calculate(8, 2, 12);
    const json = manager.toJSON();
    expect(json.quality).toBeDefined();
    expect(json.quality).toBeGreaterThan(0);
  });

  it("should deserialize from JSON", () => {
    const manager = LifeSupportManager.fromJSON({ quality: 0.7 });
    expect(manager.getQuality()).toBe(0.7);
  });

  it("should deserialize from legacy airQuality field", () => {
    const manager = LifeSupportManager.fromJSON({ airQuality: 0.6 });
    expect(manager.getQuality()).toBe(0.6);
  });
});

describe("Resources without oxygen", () => {
  it("should not include oxygen in RESOURCE_KEYS", () => {
    expect(RESOURCE_KEYS).not.toContain("oxygen");
  });

  it("should have exactly 3 resource keys (power is now a grid metric)", () => {
    expect(RESOURCE_KEYS).toEqual(["food", "water", "materials"]);
  });
});

describe("GameState life support integration", () => {
  it("should have lifeSupport manager", () => {
    const gameState = new GameState();
    expect(gameState.lifeSupport).toBeDefined();
  });

  it("should serialize and deserialize lifeSupport", () => {
    const gameState = new GameState();
    // Simulate some ticks to change life support quality
    for (let i = 0; i < 5; i++) {
      gameState.tick();
    }

    const json = gameState.toJSON();
    expect(json.lifeSupport).toBeDefined();

    const restored = GameState.fromJSON(json);
    expect(restored.lifeSupport.getQuality()).toBe(gameState.lifeSupport.getQuality());
  });
});

describe("Building efficiency with life support", () => {
  it("should apply efficiency penalty when life support efficiency is low", () => {
    const gameState = new GameState();
    gameState.resources.add({ materials: 1000 });

    // Build a basic farm (produces food)
    gameState.buildings.startBuilding(
      BuildingId.BASIC_FARM,
      gameState.resources,
      gameState.technology,
    );

    // Complete construction
    for (let i = 0; i < 15; i++) {
      gameState.tick();
    }

    const farms = gameState.buildings
      .getActiveBuildings()
      .filter((b) => b.definitionId === BuildingId.BASIC_FARM);

    expect(farms.length).toBeGreaterThan(0);
    const farm = farms[0]!;

    // Get production with life support at 1.0 (full efficiency)
    gameState.buildings.setLifeSupportEfficiency(1.0);
    const fullProd = gameState.buildings.getEffectiveProduction(farm.id);

    // Set life support efficiency multiplier to 50%
    gameState.buildings.setLifeSupportEfficiency(0.5);
    const reducedProd = gameState.buildings.getEffectiveProduction(farm.id);

    // Production should be halved when life support efficiency is 50%
    expect(reducedProd.food).toBe(fullProd.food! * 0.5);
  });
});
