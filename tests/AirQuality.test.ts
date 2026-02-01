import { describe, it, expect } from "bun:test";
import {
  BASE_OXYGEN_PER_COLONIST,
  AIR_QUALITY_COMFORTABLE,
  AIR_QUALITY_CRITICAL,
  AIR_QUALITY_DEADLY,
} from "../src/core/balance/AirQualityBalance";
import { AirQualityManager } from "../src/core/systems/AirQualityManager";
import { RESOURCE_KEYS } from "../src/core/models/Resources";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";

describe("AirQualityBalance constants", () => {
  it("should have BASE_OXYGEN_PER_COLONIST defined", () => {
    expect(BASE_OXYGEN_PER_COLONIST).toBeGreaterThan(0);
  });

  it("should have threshold constants in correct order", () => {
    expect(AIR_QUALITY_COMFORTABLE).toBeGreaterThan(AIR_QUALITY_CRITICAL);
    expect(AIR_QUALITY_CRITICAL).toBeGreaterThan(AIR_QUALITY_DEADLY);
  });

  it("should have comfortable threshold at 0.8", () => {
    expect(AIR_QUALITY_COMFORTABLE).toBe(0.8);
  });

  it("should have critical threshold at 0.5", () => {
    expect(AIR_QUALITY_CRITICAL).toBe(0.5);
  });

  it("should have deadly threshold at 0.2", () => {
    expect(AIR_QUALITY_DEADLY).toBe(0.2);
  });
});

describe("AirQualityManager", () => {
  describe("calculate", () => {
    it("should return 1.0 when production exceeds consumption", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(10, 5); // production=10, consumption=5
      expect(airQuality).toBe(1);
    });

    it("should return ratio when production is less than consumption", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(5, 10); // production=5, consumption=10
      expect(airQuality).toBe(0.5);
    });

    it("should return 0 when production is 0", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(0, 10);
      expect(airQuality).toBe(0);
    });

    it("should return 1 when consumption is 0", () => {
      const manager = new AirQualityManager();
      const airQuality = manager.calculate(10, 0);
      expect(airQuality).toBe(1);
    });

    it("should clamp to 0-1 range", () => {
      const manager = new AirQualityManager();
      expect(manager.calculate(100, 10)).toBe(1);
      expect(manager.calculate(-5, 10)).toBe(0);
    });
  });

  describe("getAirQuality", () => {
    it("should return current air quality value", () => {
      const manager = new AirQualityManager();
      manager.calculate(8, 10);
      expect(manager.getAirQuality()).toBe(0.8);
    });
  });
});

describe("AirQualityManager effects", () => {
  describe("getHealthEffect", () => {
    it("should return 0 when comfortable (>=0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(10, 10); // 1.0
      expect(manager.getHealthEffect()).toBe(0);

      manager.calculate(8, 10); // 0.8
      expect(manager.getHealthEffect()).toBe(0);
    });

    it("should return negative value when strained (0.5-0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(6, 10); // 0.6
      expect(manager.getHealthEffect()).toBeLessThan(0);
    });

    it("should return larger negative value when critical (<0.5)", () => {
      const manager = new AirQualityManager();
      manager.calculate(3, 10); // 0.3
      const criticalEffect = manager.getHealthEffect();

      manager.calculate(6, 10); // 0.6
      const strainedEffect = manager.getHealthEffect();

      expect(criticalEffect).toBeLessThan(strainedEffect);
    });
  });

  describe("getMoraleEffect", () => {
    it("should return 0 when comfortable (>=0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(10, 10);
      expect(manager.getMoraleEffect()).toBe(0);
    });

    it("should return negative value when strained", () => {
      const manager = new AirQualityManager();
      manager.calculate(6, 10);
      expect(manager.getMoraleEffect()).toBeLessThan(0);
    });
  });

  describe("getEfficiencyMultiplier", () => {
    it("should return 1 when comfortable (>=0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(10, 10);
      expect(manager.getEfficiencyMultiplier()).toBe(1);
    });

    it("should return 1 when strained (0.5-0.8)", () => {
      const manager = new AirQualityManager();
      manager.calculate(6, 10); // 0.6
      expect(manager.getEfficiencyMultiplier()).toBe(1);
    });

    it("should return <1 when critical (<0.5)", () => {
      const manager = new AirQualityManager();
      manager.calculate(3, 10); // 0.3
      expect(manager.getEfficiencyMultiplier()).toBeLessThan(1);
      expect(manager.getEfficiencyMultiplier()).toBeGreaterThan(0);
    });
  });
});

describe("AirQualityManager serialization", () => {
  it("should serialize to JSON", () => {
    const manager = new AirQualityManager();
    manager.calculate(6, 10);
    const json = manager.toJSON();
    expect(json.airQuality).toBe(0.6);
  });

  it("should deserialize from JSON", () => {
    const manager = AirQualityManager.fromJSON({ airQuality: 0.7 });
    expect(manager.getAirQuality()).toBe(0.7);
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

describe("GameState air quality integration", () => {
  it("should have airQuality manager", () => {
    const gameState = new GameState();
    expect(gameState.airQuality).toBeDefined();
  });

  it("should serialize and deserialize airQuality", () => {
    const gameState = new GameState();
    // Simulate some ticks to change air quality
    for (let i = 0; i < 5; i++) {
      gameState.tick();
    }

    const json = gameState.toJSON();
    expect(json.airQuality).toBeDefined();

    const restored = GameState.fromJSON(json);
    expect(restored.airQuality.getAirQuality()).toBe(gameState.airQuality.getAirQuality());
  });
});

describe("Building efficiency with air quality", () => {
  it("should apply efficiency penalty when air quality is critical", () => {
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

    // Get production with air quality at 1.0 (full efficiency)
    gameState.buildings.setAirQualityEfficiency(1.0);
    const fullProd = gameState.buildings.getEffectiveProduction(farms[0].id);

    // Set air quality efficiency multiplier to 50%
    gameState.buildings.setAirQualityEfficiency(0.5);
    const reducedProd = gameState.buildings.getEffectiveProduction(farms[0].id);

    // Production should be halved when air quality efficiency is 50%
    expect(reducedProd.food).toBe(fullProd.food! * 0.5);
  });
});
