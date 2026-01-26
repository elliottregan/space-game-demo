import type { ResourceDelta } from "../models/Resources";

/**
 * Apply a combined multiplier to a resource delta.
 *
 * @param baseFlow - The base production or consumption values
 * @param multiplier - Combined multiplier to apply
 * @returns Scaled resource delta
 */
export function applyMultiplier(baseFlow: ResourceDelta, multiplier: number): ResourceDelta {
  const result: ResourceDelta = {};

  for (const [key, value] of Object.entries(baseFlow)) {
    if (value) {
      result[key as keyof ResourceDelta] = value * multiplier;
    }
  }

  return result;
}

/**
 * Calculate the combined efficiency multiplier from multiple factors.
 * Simply multiplies all provided factors together.
 *
 * @param factors - Array of multiplier values
 * @returns Combined multiplier
 */
export function combineMultipliers(...factors: number[]): number {
  return factors.reduce((acc, factor) => acc * factor, 1);
}
