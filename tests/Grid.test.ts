// tests/Grid.test.ts
import { describe, expect, test } from "bun:test";
import type { GridCell, GridPosition } from "../src/core/models/Grid";
import { PowerState, DepositType } from "../src/core/models/Grid";

describe("Grid Model", () => {
  test("GridPosition has x and y coordinates", () => {
    const pos: GridPosition = { x: 5, y: 3 };
    expect(pos.x).toBe(5);
    expect(pos.y).toBe(3);
  });

  test("GridCell can have optional deposit", () => {
    const cellWithDeposit: GridCell = {
      position: { x: 0, y: 0 },
      deposit: DepositType.WATER,
    };
    const cellWithoutDeposit: GridCell = {
      position: { x: 1, y: 1 },
    };
    expect(cellWithDeposit.deposit).toBe(DepositType.WATER);
    expect(cellWithoutDeposit.deposit).toBeUndefined();
  });

  test("PowerState enum has correct values", () => {
    expect(PowerState.POWERED).toBe(PowerState.POWERED);
    expect(PowerState.ON_BATTERY).toBe(PowerState.ON_BATTERY);
    expect(PowerState.LOW_BATTERY).toBe(PowerState.LOW_BATTERY);
    expect(PowerState.UNPOWERED).toBe(PowerState.UNPOWERED);
  });
});
