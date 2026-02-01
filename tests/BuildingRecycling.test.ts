import { describe, test, expect } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { BUILDINGS } from "../src/core/data/buildings";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";

describe("Building Recycling", () => {
  test("getRecycleValue returns correct materials for standard building", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);
    expect(building).not.toBeNull();

    // Solar panel costs 30 materials, standard recovery is 40%
    const recycleValue = manager.getRecycleValue(building!.id);
    expect(recycleValue?.materials).toBe(12); // 30 * 0.4 = 12
  });

  test("startRecycling begins recycling process", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    const success = manager.startRecycling(building!.id, resources);
    expect(success).toBe(true);

    const updatedBuilding = manager.getBuilding(building!.id);
    expect(updatedBuilding?.status).toBe("recycling");
  });

  test("recycling completes and returns materials", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    const materialsBefore = resources.getResources().materials;
    manager.startRecycling(building!.id, resources);

    // Complete recycling (solar panel takes 5 sols to build, recycling = 25% = ~2 sols)
    for (let i = 0; i < 5; i++) {
      manager.tick(resources);
    }

    const materialsAfter = resources.getResources().materials;
    expect(materialsAfter).toBeGreaterThan(materialsBefore);
    expect(manager.getBuilding(building!.id)).toBeUndefined(); // Building removed
  });

  test("getRecycleValue returns damaged rate for broken buildings", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // Break the building
    manager.breakBuilding(building!.id, resources);

    // Solar panel costs 30 materials, damaged recovery is 15%
    const recycleValue = manager.getRecycleValue(building!.id);
    expect(recycleValue?.materials).toBe(4); // 30 * 0.15 = 4.5 -> floor = 4
  });

  test("getRecycleValue returns depleted rate for idle buildings", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // Manually set to idle (simulating depleted deposit)
    const b = manager.getBuilding(building!.id);
    if (b) b.status = "idle";

    // Solar panel costs 30 materials, depleted recovery is 25%
    const recycleValue = manager.getRecycleValue(building!.id);
    expect(recycleValue?.materials).toBe(7); // 30 * 0.25 = 7.5 -> floor = 7
  });

  test("getRecycleTime returns correct duration", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Solar panel takes 5 sols to build, recycling = 25% = 1.25 -> ceil = 2
    const recycleTime = manager.getRecycleTime(building!.id);
    expect(recycleTime).toBe(2);
  });

  test("startRecycling fails for pending buildings", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Don't complete construction - should fail
    const success = manager.startRecycling(building!.id, resources);
    expect(success).toBe(false);
  });

  test("startRecycling removes production/consumption from active building", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    // Use Automated Factory - truly automated, no workers needed
    tech.completeResearch(TechnologyId.ADVANCED_MATERIALS);
    tech.completeResearch(TechnologyId.ROBOTICS);

    // Build habitat first for positive oxygen (factory has -1 oxygen contribution)
    manager.startBuilding(BuildingId.HABITAT, resources, tech);
    const building = manager.startBuilding(BuildingId.AUTOMATED_FACTORY, resources, tech);

    // Complete construction (30 sols for factory)
    for (let i = 0; i < 35; i++) {
      manager.tick(resources);
    }

    // Verify oxygen is positive to avoid efficiency penalty
    expect(manager.getTotalOxygenContribution()).toBeGreaterThan(0);

    // Automated Factory produces 15 materials
    const prodBefore = resources.getProduction();
    expect(prodBefore.materials).toBe(15);

    manager.startRecycling(building!.id, resources);

    // Production should be removed
    const prodAfter = resources.getProduction();
    expect(prodAfter.materials).toBe(0);
  });

  test("rushRecycling completes immediately with penalty", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // After building solar panel: 1000 - 30 = 970 materials
    const materialsBefore = resources.getResources().materials;
    expect(materialsBefore).toBe(970);

    const success = manager.rushRecycling(building!.id, resources);
    expect(success).toBe(true);

    // Building should be immediately removed
    expect(manager.getBuilding(building!.id)).toBeUndefined();

    // Should receive materials with 30% penalty
    // Standard rate: 30 * 0.4 = 12, with 30% penalty: 12 * 0.7 = 8.4 -> floor = 8
    const materialsAfter = resources.getResources().materials;
    expect(materialsAfter).toBe(978); // 970 + 8
  });

  test("rushRecycling fails for pending buildings", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Don't complete construction - should fail
    const success = manager.rushRecycling(building!.id, resources);
    expect(success).toBe(false);
  });

  test("recycling generates BUILDING_RECYCLED event on completion", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    manager.startRecycling(building!.id, resources);

    // Tick until recycling completes, accumulating all events
    const allEvents: { type: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const events = manager.tick(resources);
      allEvents.push(...events);
    }

    const recycleEvent = allEvents.find((e) => e.type === "BUILDING_RECYCLED");
    expect(recycleEvent).toBeDefined();
  });
});

describe("Building Repurposing", () => {
  test("canRepurpose returns true for valid target", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.WATER_EXTRACTOR, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    const canRepurpose = manager.canRepurpose(
      building!.id,
      BuildingId.STORAGE_DEPOT,
      resources,
      tech,
    );
    expect(canRepurpose).toBe(true);
  });

  test("canRepurpose returns false for invalid target", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.SOLAR_PANEL, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // Solar panel has no repurposeTargets
    const canRepurpose = manager.canRepurpose(
      building!.id,
      BuildingId.STORAGE_DEPOT,
      resources,
      tech,
    );
    expect(canRepurpose).toBe(false);
  });

  test("canRepurpose returns false when workers are assigned", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });

    // Use fromJSON to pre-research required technologies for mining_station
    const tech = TechnologyTree.fromJSON(
      {
        researched: [
          TechnologyId.ADVANCED_MATERIALS,
          TechnologyId.ROBOTICS,
          TechnologyId.ASTEROID_MINING,
        ],
        currentResearch: null,
        researchSpeedBonus: 0,
      },
      TECHNOLOGIES,
    );

    // mining_station has workerSlots and repurposeTargets
    const building = manager.startBuilding(BuildingId.MINING_STATION, resources, tech);

    // Complete construction (mining_station takes 40 sols)
    for (let i = 0; i < 50; i++) {
      manager.tick(resources);
    }

    // Assign a worker
    manager.assignWorker(building!.id, "colonist_1");

    const canRepurpose = manager.canRepurpose(
      building!.id,
      BuildingId.STORAGE_DEPOT,
      resources,
      tech,
    );
    expect(canRepurpose).toBe(false);
  });

  test("startRepurposing begins conversion process", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.WATER_EXTRACTOR, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    const materialsBefore = resources.getResources().materials;
    const success = manager.startRepurposing(
      building!.id,
      BuildingId.STORAGE_DEPOT,
      resources,
      tech,
    );

    expect(success).toBe(true);
    expect(resources.getResources().materials).toBeLessThan(materialsBefore); // Cost deducted

    const updatedBuilding = manager.getBuilding(building!.id);
    expect(updatedBuilding?.status).toBe("pending"); // Back to pending while converting
    expect(updatedBuilding?.definitionId).toBe(BuildingId.STORAGE_DEPOT); // Changed to target
    expect(updatedBuilding?.repurposeFromDefId).toBe(BuildingId.WATER_EXTRACTOR); // Tracks original
  });

  test("repurposing uses correct time multiplier", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.WATER_EXTRACTOR, resources, tech);

    // Complete construction (water_extractor takes 7 sols)
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    manager.startRepurposing(building!.id, BuildingId.STORAGE_DEPOT, resources, tech);

    // storage_depot takes 8 sols, repurpose time = 50% = 4 sols
    // So it should complete after 4 ticks
    for (let i = 0; i < 3; i++) {
      manager.tick(resources);
    }

    let updatedBuilding = manager.getBuilding(building!.id);
    expect(updatedBuilding?.status).toBe("pending"); // Still pending after 3

    manager.tick(resources); // 4th tick

    updatedBuilding = manager.getBuilding(building!.id);
    expect(updatedBuilding?.status).toBe("active"); // Complete after 4
    expect(updatedBuilding?.repurposeFromDefId).toBeUndefined(); // Flag cleared
  });

  test("getRepurposeCost returns 30% of target cost", () => {
    const manager = new BuildingManager(BUILDINGS);

    // storage_depot costs 40 materials, 30% = 12
    const cost = manager.getRepurposeCost(BuildingId.STORAGE_DEPOT);
    expect(cost?.materials).toBe(12);
  });

  test("startRepurposing changes building status to pending", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.WATER_EXTRACTOR, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // Building should be active
    expect(manager.getBuilding(building!.id)?.status).toBe("active");

    manager.startRepurposing(building!.id, BuildingId.STORAGE_DEPOT, resources, tech);

    // Building status should change to pending during conversion
    expect(manager.getBuilding(building!.id)?.status).toBe("pending");
    // Definition should be updated to target
    expect(manager.getBuilding(building!.id)?.definitionId).toBe(BuildingId.STORAGE_DEPOT);
  });

  test("canRepurpose returns false for broken buildings", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.WATER_EXTRACTOR, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // Break the building
    manager.breakBuilding(building!.id, resources);

    // Cannot repurpose broken buildings
    const canRepurpose = manager.canRepurpose(
      building!.id,
      BuildingId.STORAGE_DEPOT,
      resources,
      tech,
    );
    expect(canRepurpose).toBe(false);
  });

  test("startRepurposing clears depositId", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      materials: 1000,

      food: 100,
      water: 100,
    });
    const tech = new TechnologyTree(TECHNOLOGIES);

    const building = manager.startBuilding(BuildingId.WATER_EXTRACTOR, resources, tech);

    // Complete construction
    for (let i = 0; i < 10; i++) {
      manager.tick(resources);
    }

    // Manually set depositId (simulating linked deposit)
    const b = manager.getBuilding(building!.id);
    if (b) b.depositId = "site_123";

    expect(manager.getBuilding(building!.id)?.depositId).toBe("site_123");

    manager.startRepurposing(building!.id, BuildingId.STORAGE_DEPOT, resources, tech);

    // depositId should be cleared during repurposing
    const updatedBuilding = manager.getBuilding(building!.id);
    expect(updatedBuilding?.depositId).toBeUndefined();
  });
});
