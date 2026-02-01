import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { BuildingId } from "../src/core/models/Building";

describe("Housing Assignment", () => {
  let colonyManager: ColonyManager;
  let buildingManager: BuildingManager;
  let resources: ResourceManager;

  beforeEach(() => {
    colonyManager = new ColonyManager(0);
    buildingManager = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });
  });

  it("assigns new colonist to available habitat", () => {
    // Build a habitat (manually set to active for test)
    const building = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    if (building) {
      // Force complete construction for test (habitat has constructionTime: 10)
      for (let i = 0; i < 10; i++) {
        buildingManager.tick(resources);
      }
    }

    const colonist = colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    expect(colonist.housingId).toBeDefined();
    expect(colonist.housingId).toBe(building?.id);
  });

  it("returns unhoused colonists when no capacity", () => {
    // Add colonists without any habitats
    colonyManager.addColonist();
    colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(2);
  });

  it("respects habitat capacity limits", () => {
    // Build a habitat with capacity 4
    const building = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    if (building) {
      for (let i = 0; i < 10; i++) {
        buildingManager.tick(resources);
      }
    }

    // Add 6 colonists - only 4 should be housed
    for (let i = 0; i < 6; i++) {
      colonyManager.addColonist();
    }
    colonyManager.assignHousing(buildingManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(2);

    const housed = colonyManager.getColonists().filter((c) => c.housingId);
    expect(housed.length).toBe(4);
  });

  it("getHousingAssignments returns colonists grouped by habitat", () => {
    const building = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    if (building) {
      for (let i = 0; i < 10; i++) {
        buildingManager.tick(resources);
      }
    }

    colonyManager.addColonist();
    colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    const assignments = colonyManager.getHousingAssignments();
    expect(Object.keys(assignments).length).toBeGreaterThan(0);
    expect(assignments[building!.id]?.length).toBe(2);
  });

  it("does not reassign already housed colonists", () => {
    const building = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    if (building) {
      for (let i = 0; i < 10; i++) {
        buildingManager.tick(resources);
      }
    }

    const colonist = colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    const originalHousingId = colonist.housingId;

    // Add another colonist and reassign
    colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    // Original colonist should still have the same housing
    expect(colonist.housingId).toBe(originalHousingId);
  });

  it("clearHousingAssignment removes housing from colonist", () => {
    const building = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    if (building) {
      for (let i = 0; i < 10; i++) {
        buildingManager.tick(resources);
      }
    }

    const colonist = colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);
    expect(colonist.housingId).toBeDefined();

    colonyManager.clearHousingAssignment(colonist.id);
    expect(colonist.housingId).toBeUndefined();
  });

  it("only assigns to active habitats, not pending", () => {
    // Start building but don't complete
    buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);

    colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(1);
  });

  it("assigns across multiple habitats", () => {
    // Build two habitats (capacity 4 each = 8 total)
    const building1 = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    const building2 = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);

    // Complete both
    for (let i = 0; i < 10; i++) {
      buildingManager.tick(resources);
    }

    // Add 6 colonists - should fit across both habitats
    for (let i = 0; i < 6; i++) {
      colonyManager.addColonist();
    }
    colonyManager.assignHousing(buildingManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(0);

    const assignments = colonyManager.getHousingAssignments();
    const totalHoused =
      (assignments[building1!.id]?.length || 0) + (assignments[building2!.id]?.length || 0);
    expect(totalHoused).toBe(6);
  });

  it("clears housing when habitat becomes broken", () => {
    const building = buildingManager.startBuilding(BuildingId.HABITAT, resources, {
      isResearched: () => true,
    } as never);
    // Complete construction
    for (let i = 0; i < 10; i++) {
      buildingManager.tick(resources);
    }

    const colonist = colonyManager.addColonist();
    colonyManager.assignHousing(buildingManager);
    expect(colonist.housingId).toBeDefined();

    // Simulate habitat becoming broken
    if (building) {
      building.broken = true;
      building.status = "disabled";
    }

    colonyManager.assignHousing(buildingManager);
    expect(colonist.housingId).toBeUndefined();
  });
});
