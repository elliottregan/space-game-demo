import { describe, it, expect } from "bun:test";
import { applyMultiplier, combineMultipliers } from "../../src/core/utils/resourceFlow";

describe("applyMultiplier", () => {
  it("multiplies all resource values by the multiplier", () => {
    const baseFlow = { food: 10 };
    const result = applyMultiplier(baseFlow, 2);
    expect(result.food).toBe(20);
  });

  it("handles fractional multipliers", () => {
    const baseFlow = { food: 10 };
    const result = applyMultiplier(baseFlow, 0.5);
    expect(result.food).toBe(5);
  });

  it("handles multipliers greater than 1", () => {
    const baseFlow = { materials: 100 };
    const result = applyMultiplier(baseFlow, 1.5);
    expect(result.materials).toBe(150);
  });

  it("does not round values (unlike scaleCost)", () => {
    const baseFlow = { food: 10 };
    const result = applyMultiplier(baseFlow, 0.33);
    expect(result.food).toBeCloseTo(3.3);
  });

  it("skips zero and undefined values", () => {
    const baseFlow = { food: 10, water: undefined };
    const result = applyMultiplier(baseFlow, 2);
    expect(result.food).toBe(20);
    expect(result.water).toBeUndefined();
  });

  it("returns empty object for empty input", () => {
    const result = applyMultiplier({}, 2);
    expect(result).toEqual({});
  });

  it("handles zero multiplier", () => {
    const baseFlow = { food: 10 };
    const result = applyMultiplier(baseFlow, 0);
    expect(result.food).toBe(0);
  });

  it("handles negative multipliers", () => {
    const baseFlow = { food: 10 };
    const result = applyMultiplier(baseFlow, -1);
    expect(result.food).toBe(-10);
  });
});

describe("combineMultipliers", () => {
  it("returns 1 when no factors provided", () => {
    expect(combineMultipliers()).toBe(1);
  });

  it("returns the single factor when one is provided", () => {
    expect(combineMultipliers(0.8)).toBe(0.8);
  });

  it("multiplies two factors together", () => {
    expect(combineMultipliers(0.5, 2)).toBe(1);
  });

  it("multiplies multiple factors together", () => {
    // 0.8 * 0.9 * 1.1 = 0.792
    expect(combineMultipliers(0.8, 0.9, 1.1)).toBeCloseTo(0.792);
  });

  it("handles all 1s (no change)", () => {
    expect(combineMultipliers(1, 1, 1, 1)).toBe(1);
  });

  it("handles zero factor (zeroes everything)", () => {
    expect(combineMultipliers(0.8, 0, 1.2)).toBe(0);
  });

  it("correctly combines typical efficiency factors", () => {
    // Simulating: condition * oxygen * staffing * worker
    const condition = 0.75; // 75% condition penalty
    const oxygen = 0.5; // 50% oxygen deficit penalty
    const staffing = 0.8; // 80% staffed
    const worker = 1.0; // skilled worker

    const combined = combineMultipliers(condition, oxygen, staffing, worker);
    expect(combined).toBeCloseTo(0.75 * 0.5 * 0.8 * 1.0);
  });

  it("handles many small multipliers", () => {
    // Many small penalties compound significantly
    const result = combineMultipliers(0.9, 0.9, 0.9, 0.9, 0.9);
    expect(result).toBeCloseTo(0.9 ** 5);
  });
});
