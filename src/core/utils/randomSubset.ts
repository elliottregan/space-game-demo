import { rng } from "./random";

/**
 * Pick k random elements from an array using partial Fisher-Yates shuffle.
 * O(k) time complexity instead of O(n log n) for full shuffle + slice.
 *
 * @param array - Source array to pick from
 * @param k - Number of elements to pick
 * @returns Array of k random elements (or all elements if k >= array.length)
 */
export function pickRandomSubset<T>(array: T[], k: number): T[] {
  const n = array.length;
  if (k >= n) return array;

  // Work on a copy to avoid mutating input
  const copy = [...array];
  const result: T[] = [];

  for (let i = 0; i < k; i++) {
    // Pick random index from remaining elements [i, n-1]
    const randomIndex = rng.int(i, n - 1);
    // Swap with current position
    [copy[i], copy[randomIndex]] = [copy[randomIndex]!, copy[i]!];
    result.push(copy[i]!);
  }

  return result;
}
