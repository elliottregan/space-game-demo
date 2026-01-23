// src/facade/types/politics.ts
// Politics-related types for the facade

import type { Faction, Decision, DecisionResult } from "../../core/models/Politics";

/**
 * Immutable snapshot of politics state.
 */
export interface PoliticsSnapshot {
  readonly factions: readonly Readonly<Faction>[];
  readonly averageSupport: number;
  readonly decisions: readonly Readonly<Decision>[];
}

// Re-export core types
export type { Faction, Decision, DecisionResult };
