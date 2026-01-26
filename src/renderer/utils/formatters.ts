// src/renderer/utils/formatters.ts
// Shared formatting utilities for displaying game data

import type { Technology } from "../../core/models/Technology";
import type { ResourceDelta } from "../../core/models/Resources";
import {
  FACTION_SUPPORT_NORMALIZED_POSITIVE,
  FACTION_SUPPORT_NORMALIZED_WARNING,
} from "../../core/balance/DisplayThresholds";

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
 * Get CSS color variable for normalized faction support (-1 to 1 scale)
 */
export function getSupportColor(support: number): string {
  if (support >= FACTION_SUPPORT_NORMALIZED_POSITIVE) return 'var(--color-positive)';
  if (support >= FACTION_SUPPORT_NORMALIZED_WARNING) return 'var(--color-warning)';
  return 'var(--color-danger)';
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
