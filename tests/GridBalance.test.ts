// tests/GridBalance.test.ts
import { describe, expect, test } from "bun:test";
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../src/core/balance/GridBalance";

describe("Grid Balance", () => {
  test("battery backup duration is defined", () => {
    expect(BATTERY_BACKUP_SOLS).toBeGreaterThan(0);
  });

  test("low battery threshold is between 0 and 1", () => {
    expect(LOW_BATTERY_THRESHOLD).toBeGreaterThan(0);
    expect(LOW_BATTERY_THRESHOLD).toBeLessThan(1);
  });
});
