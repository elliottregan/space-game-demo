import { describe, expect, test } from "bun:test";
import { pickRandomSubset } from "../src/core/utils/randomSubset";

describe("pickRandomSubset", () => {
  test("returns k elements from array", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = pickRandomSubset(array, 3);
    expect(result).toHaveLength(3);
  });

  test("returns all elements if k >= array length", () => {
    const array = [1, 2, 3];
    const result = pickRandomSubset(array, 5);
    expect(result).toEqual(array);
  });

  test("returns all elements if k equals array length", () => {
    const array = [1, 2, 3];
    const result = pickRandomSubset(array, 3);
    expect(result).toEqual(array);
  });

  test("returns empty array for empty input", () => {
    const result = pickRandomSubset([], 3);
    expect(result).toEqual([]);
  });

  test("returns empty array when k is 0", () => {
    const array = [1, 2, 3];
    const result = pickRandomSubset(array, 0);
    expect(result).toHaveLength(0);
  });

  test("does not mutate original array", () => {
    const array = [1, 2, 3, 4, 5];
    const original = [...array];
    pickRandomSubset(array, 3);
    expect(array).toEqual(original);
  });

  test("all returned elements come from original array", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = pickRandomSubset(array, 5);
    for (const item of result) {
      expect(array).toContain(item);
    }
  });

  test("returned elements are unique (no duplicates)", () => {
    const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = pickRandomSubset(array, 5);
    const uniqueResult = new Set(result);
    expect(uniqueResult.size).toBe(result.length);
  });

  test("works with objects", () => {
    const array = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    const result = pickRandomSubset(array, 2);
    expect(result).toHaveLength(2);
    for (const item of result) {
      expect(array).toContain(item);
    }
  });

  test("distribution is roughly uniform over many runs", () => {
    const array = [0, 1, 2, 3, 4];
    const counts = new Map<number, number>();
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      const result = pickRandomSubset(array, 1);
      const value = result[0]!;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    // Each element should appear roughly 20% of the time (iterations / 5)
    // Allow 5% tolerance
    const expected = iterations / array.length;
    const tolerance = expected * 0.15;

    for (const [value, count] of counts) {
      expect(count).toBeGreaterThan(expected - tolerance);
      expect(count).toBeLessThan(expected + tolerance);
    }
  });
});
