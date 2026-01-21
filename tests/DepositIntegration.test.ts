import { describe, test, expect } from "bun:test";
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
    expect(sites[0].linkedBuildingId).toBe("building_1");
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
    expect(sites[0].linkedBuildingId).toBeNull();
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
    expect(sites[0].remainingReserves).toBe(485);
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
