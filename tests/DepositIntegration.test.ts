import { describe, test, expect } from "bun:test";

import { BuildingId } from "../src/core/models/Building";
import { GameState } from "../src/core/GameState";
import { OperationsManager } from "../src/core/systems/OperationsManager";

describe("Deposit-Building Linking", () => {
  test("linkBuildingToDeposit links a building to a developed deposit", () => {
    const manager = new OperationsManager();

    // Manually create a developed site
    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: null,
    }];

    const success = manager.linkBuildingToDeposit("building_1", "site_1");
    expect(success).toBe(true);

    const sites = manager.getSites();
    expect(sites[0]!.linkedBuildingId).toBe("building_1");
  });

  test("linkBuildingToDeposit fails for undeveloped deposits", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: false,  // Not developed
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: null,
    }];

    const success = manager.linkBuildingToDeposit("building_1", "site_1");
    expect(success).toBe(false);
  });

  test("linkBuildingToDeposit fails if deposit already has a building", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: "building_existing",  // Already linked
    }];

    const success = manager.linkBuildingToDeposit("building_1", "site_1");
    expect(success).toBe(false);
  });

  test("unlinkBuildingFromDeposit removes building link", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: "building_1",
    }];

    const success = manager.unlinkBuildingFromDeposit("site_1");
    expect(success).toBe(true);

    const sites = manager.getSites();
    expect(sites[0]!.linkedBuildingId).toBeNull();
  });

  test("getDepositForBuilding returns linked deposit", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: "building_1",
    }];

    const deposit = manager.getDepositForBuilding("building_1");
    expect(deposit).toBeDefined();
    expect(deposit?.id).toBe("site_1");
  });

  test("getDepositForBuilding returns undefined for unlinked building", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: null,
    }];

    const deposit = manager.getDepositForBuilding("building_1");
    expect(deposit).toBeUndefined();
  });
});

describe("Deposit Extraction Processing", () => {
  test("processExtraction extracts with quality multiplier", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "rich" as const,  // 1.5x multiplier
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 400, max: 600 },
      remainingReserves: 500,
      linkedBuildingId: "building_1",
    }];

    // Base production is 10, with 1.5x multiplier = 15
    const extracted = manager.processExtraction("building_1", 10);
    expect(extracted).toBe(15);

    const sites = manager.getSites();
    expect(sites[0]!.remainingReserves).toBe(485);
  });

  test("processExtraction returns 0 for depleted deposit", () => {
    const manager = new OperationsManager();

    (manager as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 500,
      estimatedReserves: { min: 0, max: 0 },
      remainingReserves: 0,  // Depleted
      linkedBuildingId: "building_1",
    }];

    const extracted = manager.processExtraction("building_1", 10);
    expect(extracted).toBe(0);
  });

  test("processExtraction returns 0 for building without deposit", () => {
    const manager = new OperationsManager();

    const extracted = manager.processExtraction("building_1", 10);
    expect(extracted).toBe(0);
  });
});

describe("GameState Deposit Extraction Integration", () => {
  test("tick extracts from deposit and depletes reserves", () => {
    const state = new GameState();

    // Create a water deposit with small reserves for quick depletion
    (state.operations as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 20,
      estimatedReserves: { min: 16, max: 24 },
      remainingReserves: 20,
      linkedBuildingId: null,
    }];

    // Build a water extractor and complete construction
    const building = state.buildings.startBuilding(BuildingId.WATER_EXTRACTOR, state.resources, state.technology);
    expect(building).not.toBeNull();

    // Complete construction (BuildingId.WATER_EXTRACTOR takes 7 sols)
    for (let i = 0; i < 10; i++) {
      state.buildings.tick(state.resources);
    }

    // Link building to deposit
    building!.depositId = "site_1";
    state.operations.linkBuildingToDeposit(building!.id, "site_1");

    // Tick the game state
    const initialReserves = state.operations.getSites()[0]!.remainingReserves;
    state.tick();

    // Reserves should have decreased (BuildingId.WATER_EXTRACTOR produces 4 water, moderate = 1.0x)
    const newReserves = state.operations.getSites()[0]!.remainingReserves;
    expect(newReserves).toBeLessThan(initialReserves);
    expect(newReserves).toBe(initialReserves - 4);
  });

  test("tick transitions building to idle when deposit depletes", () => {
    const state = new GameState();

    // Create a water deposit with very small reserves
    (state.operations as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 3,
      estimatedReserves: { min: 2, max: 4 },
      remainingReserves: 3,
      linkedBuildingId: null,
    }];

    // Build and complete a water extractor
    const building = state.buildings.startBuilding(BuildingId.WATER_EXTRACTOR, state.resources, state.technology);
    for (let i = 0; i < 10; i++) {
      state.buildings.tick(state.resources);
    }

    // Link building to deposit
    building!.depositId = "site_1";
    state.operations.linkBuildingToDeposit(building!.id, "site_1");

    expect(building!.status).toBe("active");

    // Tick - should deplete the deposit (3 < 4 production)
    const events = state.tick();

    // Building should now be idle
    expect(building!.status).toBe("idle");

    // Should have a depletion event
    const depletedEvent = events.find(e => e.type === "DEPOSIT_DEPLETED");
    expect(depletedEvent).toBeDefined();
  });

  test("tick fires warning events at thresholds", () => {
    const state = new GameState();

    // Create a deposit at exactly 25% (warning threshold)
    // reserves = 100, 25% = remaining 25
    (state.operations as any).sites = [{
      id: "site_1",
      resourceType: "water" as const,
      quality: "moderate" as const,
      revealed: true,
      developed: true,
      developmentProgress: 0,
      reserves: 100,
      estimatedReserves: { min: 22, max: 28 },
      remainingReserves: 28, // Just above 25% threshold
      linkedBuildingId: null,
    }];

    // Build and complete a water extractor
    const building = state.buildings.startBuilding(BuildingId.WATER_EXTRACTOR, state.resources, state.technology);
    for (let i = 0; i < 10; i++) {
      state.buildings.tick(state.resources);
    }

    // Link building to deposit
    building!.depositId = "site_1";
    state.operations.linkBuildingToDeposit(building!.id, "site_1");

    // Tick - extraction of 4 should push below 25% (28 - 4 = 24, 24% < 25%)
    const events = state.tick();

    // Should have a warning event
    const warningEvent = events.find(e => e.type === "DEPOSIT_WARNING");
    expect(warningEvent).toBeDefined();
  });
});
