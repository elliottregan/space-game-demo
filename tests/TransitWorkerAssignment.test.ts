import { describe, expect, it, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { GridManager } from "../src/core/systems/GridManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { BuildingId } from "../src/core/models/Building";
import type { GridPosition } from "../src/core/models/Grid";

describe("Transit Worker Assignment", () => {
  let buildingManager: BuildingManager;
  let gridManager: GridManager;
  let colonyManager: ColonyManager;

  beforeEach(() => {
    gridManager = new GridManager();
    buildingManager = new BuildingManager(BUILDINGS);
    colonyManager = new ColonyManager(0); // Start with 0 colonists
    buildingManager.setGridManager(gridManager);
    buildingManager.setColonyManager(colonyManager);
  });

  function createActiveBuilding(defId: BuildingId, position: GridPosition): string {
    // Add building to BuildingManager and get its ID
    const building = buildingManager.addBuilding({
      definitionId: defId,
      status: "active",
      constructionProgress: 10,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    // Place in grid with the same ID
    gridManager.placeBuilding(building.id, position);

    return building.id;
  }

  function createColonistWithHousing(housingId: string): string {
    const colonist = colonyManager.addColonist("Test Worker");
    colonist.housingId = housingId;
    return colonist.id;
  }

  it("allows assignment when colonist housing and workplace are in same cluster", () => {
    // Setup: habitat and farm adjacent
    const habId = createActiveBuilding(BuildingId.HABITAT, { x: 5, y: 5 });
    const farmId = createActiveBuilding(BuildingId.BASIC_FARM, { x: 5, y: 6 });

    // Trigger cluster update
    buildingManager.triggerClusterUpdate();

    const colonistId = createColonistWithHousing(habId);

    const result = buildingManager.assignWorker(farmId, colonistId);
    expect(result).toBe(true);
  });

  it("rejects assignment when colonist housing and workplace are in different clusters", () => {
    // Setup: habitat and farm not connected (far apart)
    const habId = createActiveBuilding(BuildingId.HABITAT, { x: 2, y: 2 });
    const farmId = createActiveBuilding(BuildingId.BASIC_FARM, { x: 8, y: 8 });

    // Trigger cluster update
    buildingManager.triggerClusterUpdate();

    const colonistId = createColonistWithHousing(habId);

    const result = buildingManager.assignWorker(farmId, colonistId);
    expect(result).toBe(false);
  });

  it("allows assignment when depot bridges the gap", () => {
    // Setup: habitat, depot adjacent, farm within depot range
    const habId = createActiveBuilding(BuildingId.HABITAT, { x: 2, y: 2 });
    createActiveBuilding(BuildingId.ROVER_DEPOT, { x: 2, y: 3 });
    const farmId = createActiveBuilding(BuildingId.BASIC_FARM, { x: 2, y: 6 });

    // Trigger cluster update
    buildingManager.triggerClusterUpdate();

    const colonistId = createColonistWithHousing(habId);

    const result = buildingManager.assignWorker(farmId, colonistId);
    expect(result).toBe(true);
  });
});
