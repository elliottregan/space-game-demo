// tests/GridBalance.test.ts
import { describe, expect, test } from "bun:test";
import {
  POWER_RANGE_BASE,
  POWER_RANGE_PER_OUTPUT,
  TECH_RANGE_BONUS,
  calculatePowerRange,
} from "../src/core/balance/GridBalance";

describe("Grid Balance", () => {
  test("solar panel has range 2", () => {
    const range = calculatePowerRange(10, false); // 10 power output, no tech
    expect(range).toBe(2);
  });

  test("nuclear reactor has range 4", () => {
    const range = calculatePowerRange(50, false); // 50 power output
    expect(range).toBe(4);
  });

  test("improved power grid tech adds 1 range", () => {
    const rangeWithoutTech = calculatePowerRange(10, false);
    const rangeWithTech = calculatePowerRange(10, true);
    expect(rangeWithTech - rangeWithoutTech).toBe(1);
  });
});
