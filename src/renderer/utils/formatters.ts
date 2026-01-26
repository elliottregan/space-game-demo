// src/renderer/utils/formatters.ts
// Shared formatting utilities for displaying game data

import type { Technology } from "../../core/models/Technology";
import type { ResourceDelta } from "../../core/models/Resources";

/**
 * Format technology cost for display
 * Example: "10 sols, 50 metal, 25 electronics"
 */
export function formatTechCost(tech: Technology): string {
  const parts = [`${tech.cost.sols} sols`];
  if (tech.cost.resources) {
    for (const [key, value] of Object.entries(tech.cost.resources)) {
      if (value) parts.push(`${value} ${key}`);
    }
  }
  return parts.join(", ");
}

/**
 * Format a resource delta for display
 * Returns array of formatted strings with +/- prefixes
 */
export function formatResourceDelta(delta: ResourceDelta): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(delta)) {
    if (value && value !== 0) {
      const prefix = value > 0 ? "+" : "";
      parts.push(`${prefix}${value} ${key}`);
    }
  }
  return parts;
}

/**
 * Format a resource cost (always positive values)
 */
export function formatResourceCost(delta: ResourceDelta): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(delta)) {
    if (value && value !== 0) {
      parts.push(`${Math.abs(value)} ${key}`);
    }
  }
  return parts;
}

export interface HighlightInfo {
  requiredResources: string[];
  insufficientResources: string[];
  deltas: Record<string, number>;
}

/**
 * Calculate resource highlight info from a cost delta
 * Used for hovering over buildings and technologies
 */
export function calculateHighlightInfo(
  cost: ResourceDelta,
  currentResources: Record<string, number>
): HighlightInfo {
  const requiredResources: string[] = [];
  const deltas: Record<string, number> = {};

  for (const [key, value] of Object.entries(cost)) {
    if (value && value > 0) {
      requiredResources.push(key);
      deltas[key] = -value;
    }
  }

  const insufficientResources = requiredResources.filter((key) => {
    const required = (cost as Record<string, number>)[key] || 0;
    const available = currentResources[key] || 0;
    return available < required;
  });

  return { requiredResources, insufficientResources, deltas };
}
