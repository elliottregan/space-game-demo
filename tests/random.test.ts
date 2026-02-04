import { describe, test, expect, beforeEach } from "bun:test";
import { SeededRandom, rng } from "../src/core/utils/random";

describe("SeededRandom", () => {
  let random: SeededRandom;

  beforeEach(() => {
    random = new SeededRandom(12345);
  });

  describe("determinism", () => {
    test("same seed produces same sequence", () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(42);

      const seq1 = Array.from({ length: 10 }, () => rng1.random());
      const seq2 = Array.from({ length: 10 }, () => rng2.random());

      expect(seq1).toEqual(seq2);
    });

    test("different seeds produce different sequences", () => {
      const rng1 = new SeededRandom(42);
      const rng2 = new SeededRandom(43);

      const seq1 = Array.from({ length: 10 }, () => rng1.random());
      const seq2 = Array.from({ length: 10 }, () => rng2.random());

      expect(seq1).not.toEqual(seq2);
    });

    test("re-seeding resets the sequence", () => {
      random.seed(999);
      const first = random.random();
      random.random();
      random.random();

      random.seed(999);
      const reset = random.random();

      expect(reset).toBe(first);
    });
  });

  describe("random()", () => {
    test("returns values in [0, 1)", () => {
      for (let i = 0; i < 1000; i++) {
        const value = random.random();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    test("produces varied distribution", () => {
      const buckets = new Array(10).fill(0);
      for (let i = 0; i < 10000; i++) {
        const bucket = Math.floor(random.random() * 10);
        buckets[bucket]++;
      }

      // Each bucket should have roughly 1000 values (allow 20% variance)
      for (const count of buckets) {
        expect(count).toBeGreaterThan(800);
        expect(count).toBeLessThan(1200);
      }
    });
  });

  describe("int()", () => {
    test("returns integers in [min, max] inclusive", () => {
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const value = random.int(1, 5);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
        seen.add(value);
      }
      // Should see all values 1-5
      expect(seen.size).toBe(5);
    });

    test("works with negative ranges", () => {
      for (let i = 0; i < 100; i++) {
        const value = random.int(-5, -1);
        expect(value).toBeGreaterThanOrEqual(-5);
        expect(value).toBeLessThanOrEqual(-1);
      }
    });
  });

  describe("below()", () => {
    test("returns integers in [0, max)", () => {
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const value = random.below(5);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(5);
        seen.add(value);
      }
      // Should see all values 0-4
      expect(seen.size).toBe(5);
    });
  });

  describe("pick()", () => {
    test("returns element from array", () => {
      const items = ["a", "b", "c"];
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const value = random.pick(items);
        expect(value).toBeDefined();
        expect(items).toContain(value!);
        seen.add(value!);
      }
      // Should see all items
      expect(seen.size).toBe(3);
    });

    test("returns undefined for empty array", () => {
      expect(random.pick([])).toBeUndefined();
    });
  });

  describe("chance()", () => {
    test("returns true approximately at given probability", () => {
      let trueCount = 0;
      const trials = 10000;
      for (let i = 0; i < trials; i++) {
        if (random.chance(0.3)) trueCount++;
      }
      // Should be roughly 30% (allow 5% variance)
      const ratio = trueCount / trials;
      expect(ratio).toBeGreaterThan(0.25);
      expect(ratio).toBeLessThan(0.35);
    });

    test("probability 0 always returns false", () => {
      for (let i = 0; i < 100; i++) {
        expect(random.chance(0)).toBe(false);
      }
    });

    test("probability 1 always returns true", () => {
      for (let i = 0; i < 100; i++) {
        expect(random.chance(1)).toBe(true);
      }
    });
  });

  describe("shuffle()", () => {
    test("shuffles array in place", () => {
      const original = [1, 2, 3, 4, 5];
      const array = [...original];
      const result = random.shuffle(array);

      expect(result).toBe(array); // Same reference
      expect(array.sort()).toEqual(original); // Same elements
    });

    test("produces different orderings with different seeds", () => {
      const rng1 = new SeededRandom(1);
      const rng2 = new SeededRandom(2);

      const arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const arr2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      rng1.shuffle(arr1);
      rng2.shuffle(arr2);

      expect(arr1).not.toEqual(arr2);
    });
  });

  describe("shuffled()", () => {
    test("returns new shuffled array", () => {
      const original = [1, 2, 3, 4, 5];
      const result = random.shuffled(original);

      expect(result).not.toBe(original); // Different reference
      expect(result.sort()).toEqual(original); // Same elements
    });
  });

  describe("weightedPick()", () => {
    test("picks items according to weights", () => {
      const items = ["rare", "common", "very_common"];
      const weights: Record<string, number> = {
        rare: 1,
        common: 10,
        very_common: 100,
      };

      const counts: Record<string, number> = { rare: 0, common: 0, very_common: 0 };
      for (let i = 0; i < 10000; i++) {
        const item = random.weightedPick(items, (idx) => weights[idx] ?? 0);
        if (item) counts[item]!++;
      }

      // very_common should be picked most (~90%), common ~9%, rare ~1%
      expect(counts.very_common!).toBeGreaterThan(counts.common!);
      expect(counts.common!).toBeGreaterThan(counts.rare!);
      expect(counts.very_common!).toBeGreaterThan(8000);
    });

    test("returns undefined for empty array", () => {
      expect(random.weightedPick([], () => 1)).toBeUndefined();
    });

    test("returns undefined when all weights are zero", () => {
      expect(random.weightedPick([1, 2, 3], () => 0)).toBeUndefined();
    });
  });

  describe("global rng", () => {
    test("can be seeded globally", () => {
      rng.seed(777);
      const first = rng.random();

      rng.seed(777);
      const second = rng.random();

      expect(first).toBe(second);
    });
  });
});
