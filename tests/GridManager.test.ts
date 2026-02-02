// tests/GridManager.test.ts
import { describe, expect, it } from "bun:test";
import { GridManager } from "../src/core/systems/GridManager";
import { DepositType, GRID_SIZE } from "../src/core/models/Grid";

describe("GridManager", () => {
  it("initializes 10x10 grid", () => {
    const manager = new GridManager();
    expect(manager.getGridSize()).toBe(GRID_SIZE);
  });

  it("all cells start empty", () => {
    const manager = new GridManager();
    const cell = manager.getCell(5, 5);
    expect(cell).not.toBeNull();
    expect(cell?.buildingId).toBeUndefined();
  });

  it("getCell returns null for out-of-bounds", () => {
    const manager = new GridManager();
    expect(manager.getCell(-1, 0)).toBeNull();
    expect(manager.getCell(10, 0)).toBeNull();
    expect(manager.getCell(0, 10)).toBeNull();
  });

  it("generateDeposits creates water and mineral deposits", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345); // seed for reproducibility

    const deposits = manager.getAllDeposits();
    const waterDeposits = deposits.filter((d) => d.type === DepositType.WATER);
    const mineralDeposits = deposits.filter((d) => d.type === DepositType.MINERAL);

    expect(waterDeposits.length).toBeGreaterThanOrEqual(2);
    expect(waterDeposits.length).toBeLessThanOrEqual(3);
    expect(mineralDeposits.length).toBeGreaterThanOrEqual(2);
    expect(mineralDeposits.length).toBeLessThanOrEqual(3);
  });

  it("deposits avoid center 4x4 area", () => {
    const manager = new GridManager();
    manager.generateDeposits(12345);

    const deposits = manager.getAllDeposits();
    for (const deposit of deposits) {
      const isInCenter =
        deposit.position.x >= 3 &&
        deposit.position.x <= 6 &&
        deposit.position.y >= 3 &&
        deposit.position.y <= 6;
      expect(isInCenter).toBe(false);
    }
  });
});
