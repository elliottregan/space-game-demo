// src/core/utils/random.ts
// Seeded pseudo-random number generator for deterministic simulation

/**
 * Mulberry32 PRNG - A simple, fast 32-bit PRNG with good statistical properties.
 * Period: 2^32, passes BigCrush tests.
 *
 * @param seed - 32-bit integer seed
 * @returns Function that returns random floats in [0, 1)
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0; // Ensure unsigned 32-bit
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Global seeded random number generator.
 * Provides a drop-in replacement for Math.random() that can be seeded
 * for deterministic results.
 */
class SeededRandom {
  private generator: () => number;
  private currentSeed: number;

  constructor(seed: number = Date.now()) {
    this.currentSeed = seed;
    this.generator = mulberry32(seed);
  }

  /**
   * Seed the random number generator.
   * Call this at the start of a simulation run to ensure deterministic results.
   */
  seed(seed: number): void {
    this.currentSeed = seed;
    this.generator = mulberry32(seed);
  }

  /**
   * Get the current seed value.
   */
  getSeed(): number {
    return this.currentSeed;
  }

  /**
   * Generate a random number in [0, 1).
   * Drop-in replacement for Math.random().
   */
  random(): number {
    return this.generator();
  }

  /**
   * Generate a random integer in [min, max] (inclusive).
   */
  int(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1));
  }

  /**
   * Generate a random integer in [0, max) (exclusive).
   */
  below(max: number): number {
    return Math.floor(this.random() * max);
  }

  /**
   * Pick a random element from an array.
   */
  pick<T>(array: readonly T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.below(array.length)];
  }

  /**
   * Return true with the given probability (0-1).
   */
  chance(probability: number): boolean {
    return this.random() < probability;
  }

  /**
   * Shuffle an array in place using Fisher-Yates algorithm.
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.below(i + 1);
      const temp = array[i] as T;
      array[i] = array[j] as T;
      array[j] = temp;
    }
    return array;
  }

  /**
   * Create a shuffled copy of an array.
   */
  shuffled<T>(array: readonly T[]): T[] {
    return this.shuffle([...array]);
  }

  /**
   * Pick a weighted random element.
   * @param items Array of items
   * @param getWeight Function to get weight for each item
   * @returns Selected item or undefined if empty/all zero weights
   */
  weightedPick<T>(items: readonly T[], getWeight: (item: T) => number): T | undefined {
    if (items.length === 0) return undefined;

    let totalWeight = 0;
    for (const item of items) {
      totalWeight += getWeight(item);
    }

    if (totalWeight <= 0) return undefined;

    let target = this.random() * totalWeight;
    for (const item of items) {
      target -= getWeight(item);
      if (target <= 0) return item;
    }

    // Fallback (shouldn't happen with valid weights)
    return items[items.length - 1];
  }
}

/**
 * Global RNG instance used throughout the game.
 * Seed this at the start of each simulation run for deterministic results.
 */
export const rng = new SeededRandom();

// Re-export the class for testing
export { SeededRandom };
