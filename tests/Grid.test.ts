// tests/Grid.test.ts
import { describe, expect, test } from "bun:test";
import { GridCell, GridPosition, PowerState, DepositType } from "../src/core/models/Grid";

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
    expect(PowerState.POWERED).toBe("powered");
    expect(PowerState.ON_BATTERY).toBe("on_battery");
    expect(PowerState.LOW_BATTERY).toBe("low_battery");
    expect(PowerState.UNPOWERED).toBe("unpowered");
  });
});
