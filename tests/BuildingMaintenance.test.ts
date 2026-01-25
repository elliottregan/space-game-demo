import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import type { BuildingDefinition } from "../src/core/models/Building";
import {
  MAINTENANCE_START_SOL,
  CONDITION_DECAY_INTERVAL,
  CONDITION_DECAY_AMOUNT,
  CONDITION_EFFICIENCY_THRESHOLD,
  CONDITION_EFFICIENCY_PENALTY,
  MAINTENANCE_COST_MULTIPLIER,
} from "../src/core/balance/BuildingBalance";

const TEST_BUILDING: BuildingDefinition = {
  id: "test_building",
  name: "Test Building",
  description: "A building for testing",
  cost: { materials: 100, power: 0 },
  constructionTime: 1,
  production: { materials: 10 },
  consumption: { power: 5 },
};

const TEST_TECH = {
  id: "test_tech",
  name: "Test Tech",
  description: "Test",
  cost: 100,
  effects: [],
  prerequisites: [],
};

describe("Building Maintenance System", () => {
  let buildingManager: BuildingManager;
  let resources: ResourceManager;
  let technology: TechnologyTree;

  beforeEach(() => {
    buildingManager = new BuildingManager([TEST_BUILDING]);
    resources = new ResourceManager({ materials: 1000, power: 100, food: 100, water: 100, oxygen: 100 });
    technology = new TechnologyTree([TEST_TECH]);
  });

  describe("Building initialization", () => {
    it("should initialize new buildings with full condition", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();
      expect(building!.condition).toBe(100);
      expect(building!.age).toBe(0);
      expect(building!.lastMaintenance).toBe(0);
    });
  });

  describe("Condition decay", () => {
    it("should not decay condition before MAINTENANCE_START_SOL", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);
      expect(building!.status).toBe("active");

      // Tick many times before maintenance start sol
      for (let sol = 2; sol < MAINTENANCE_START_SOL; sol++) {
        buildingManager.tick(resources, sol);
      }

      // Condition should still be 100
      expect(building!.condition).toBe(100);
    });

    it("should decay condition after MAINTENANCE_START_SOL", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction at sol 1
      buildingManager.tick(resources, 1);

      // Advance to maintenance start sol
      for (let sol = 2; sol <= MAINTENANCE_START_SOL; sol++) {
        buildingManager.tick(resources, sol);
      }

      // Now tick enough times for condition to decay
      const ticksNeededForDecay = CONDITION_DECAY_INTERVAL;
      for (let i = 0; i < ticksNeededForDecay; i++) {
        buildingManager.tick(resources, MAINTENANCE_START_SOL + i + 1);
      }

      // Condition should have decayed
      expect(building!.condition).toBeLessThan(100);
    });

    it("should decay by CONDITION_DECAY_AMOUNT every CONDITION_DECAY_INTERVAL sols", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // Fast-forward age to just before decay point
      building!.age = CONDITION_DECAY_INTERVAL - 1;
      buildingManager.tick(resources, MAINTENANCE_START_SOL + 1);

      // One more tick should trigger decay
      expect(building!.age).toBe(CONDITION_DECAY_INTERVAL);
      expect(building!.condition).toBe(100 - CONDITION_DECAY_AMOUNT);
    });
  });

  describe("Efficiency penalty", () => {
    it("should apply efficiency penalty when condition falls below threshold", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // At full condition, production should be full
      const fullProduction = buildingManager.getEffectiveProduction(building!.id);
      expect(fullProduction.materials).toBe(10);

      // Set condition below threshold
      building!.condition = CONDITION_EFFICIENCY_THRESHOLD - 1;

      // Production should be reduced
      const reducedProduction = buildingManager.getEffectiveProduction(building!.id);
      expect(reducedProduction.materials).toBe(10 * (1 - CONDITION_EFFICIENCY_PENALTY));
    });

    it("should not apply penalty when condition is at or above threshold", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // At exactly threshold
      building!.condition = CONDITION_EFFICIENCY_THRESHOLD;
      const production = buildingManager.getEffectiveProduction(building!.id);
      expect(production.materials).toBe(10);
    });

    it("should also affect consumption when condition is low", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // At full condition
      const fullConsumption = buildingManager.getEffectiveConsumption(building!.id);
      expect(fullConsumption.power).toBe(5);

      // Set condition below threshold
      building!.condition = CONDITION_EFFICIENCY_THRESHOLD - 1;
      const reducedConsumption = buildingManager.getEffectiveConsumption(building!.id);
      expect(reducedConsumption.power).toBe(5 * (1 - CONDITION_EFFICIENCY_PENALTY));
    });
  });

  describe("Maintenance cost", () => {
    it("should calculate maintenance cost as percentage of building cost", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      const cost = buildingManager.getMaintenanceCost(building!.id);
      expect(cost).not.toBeUndefined();
      expect(cost!.materials).toBe(Math.ceil(100 * MAINTENANCE_COST_MULTIPLIER));
    });

    it("should return undefined for non-active buildings", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Building is still pending
      const cost = buildingManager.getMaintenanceCost(building!.id);
      expect(cost).toBeUndefined();
    });

    it("should return undefined for broken buildings", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // Break the building
      buildingManager.breakBuilding(building!.id, resources);

      const cost = buildingManager.getMaintenanceCost(building!.id);
      expect(cost).toBeUndefined();
    });
  });

  describe("Perform maintenance", () => {
    it("should restore condition to 100%", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // Degrade condition
      building!.condition = 50;

      // Perform maintenance
      const success = buildingManager.performMaintenance(building!.id, resources);
      expect(success).toBe(true);
      expect(building!.condition).toBe(100);
    });

    it("should deduct maintenance cost from resources", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      const materialsBefore = resources.getResources().materials;
      const cost = buildingManager.getMaintenanceCost(building!.id);

      buildingManager.performMaintenance(building!.id, resources);

      const materialsAfter = resources.getResources().materials;
      expect(materialsBefore - materialsAfter).toBe(cost!.materials);
    });

    it("should fail if cannot afford maintenance", () => {
      // Start with minimal resources
      const poorResources = new ResourceManager({ materials: 5, power: 100, food: 100, water: 100, oxygen: 100 });

      // Manually create a building without paying cost (for testing purposes)
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // Now check if we can afford with poor resources (maintenance cost is 10 materials)
      building!.condition = 50;
      const success = buildingManager.performMaintenance(building!.id, poorResources);
      expect(success).toBe(false);
      expect(building!.condition).toBe(50); // Unchanged
    });

    it("should update lastMaintenance timestamp", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction at sol 1
      buildingManager.tick(resources, 1);

      // Advance to sol 200
      buildingManager.tick(resources, 200);

      building!.condition = 50;
      buildingManager.performMaintenance(building!.id, resources);

      expect(building!.lastMaintenance).toBe(200);
    });
  });

  describe("Serialization", () => {
    it("should serialize and deserialize maintenance fields", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // Modify maintenance fields
      building!.condition = 75;
      building!.age = 50;
      building!.lastMaintenance = 25;

      // Serialize
      const json = buildingManager.toJSON();

      // Deserialize
      const restored = BuildingManager.fromJSON(json, [TEST_BUILDING]);
      const restoredBuilding = restored.getBuilding(building!.id);

      expect(restoredBuilding).not.toBeUndefined();
      expect(restoredBuilding!.condition).toBe(75);
      expect(restoredBuilding!.age).toBe(50);
      expect(restoredBuilding!.lastMaintenance).toBe(25);
    });

    it("should provide defaults for legacy saves without maintenance fields", () => {
      // Simulate legacy save data without maintenance fields
      const legacyData = {
        buildings: [
          {
            id: "building_1",
            definitionId: "test_building",
            status: "active" as const,
            constructionProgress: 1,
            assignedWorkers: [],
            mode: "normal" as const,
            broken: false,
            repairProgress: 0,
            // No condition, age, or lastMaintenance
          },
        ],
        nextId: 2,
        constructionSpeedBonus: 0,
      };

      const restored = BuildingManager.fromJSON(legacyData as any, [TEST_BUILDING]);
      const building = restored.getBuilding("building_1");

      expect(building).not.toBeUndefined();
      expect(building!.condition).toBe(100); // Default
      expect(building!.age).toBe(0); // Default
      expect(building!.lastMaintenance).toBe(0); // Default
    });
  });

  describe("Building degradation event", () => {
    it("should emit BUILDING_DEGRADED event when crossing efficiency threshold", () => {
      const building = buildingManager.startBuilding("test_building", resources, technology);
      expect(building).not.toBeNull();

      // Complete construction
      buildingManager.tick(resources, 1);

      // Set condition just above threshold
      building!.condition = CONDITION_EFFICIENCY_THRESHOLD;
      building!.age = CONDITION_DECAY_INTERVAL - 1;

      // This tick should trigger decay and cross threshold
      const events = buildingManager.tick(resources, MAINTENANCE_START_SOL + 1);

      // Should have a degradation event
      const degradedEvent = events.find((e) => e.type === "BUILDING_DEGRADED");
      expect(degradedEvent).not.toBeUndefined();
      expect(degradedEvent!.severity).toBe("warning");
    });
  });
});
