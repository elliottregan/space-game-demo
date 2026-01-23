// src/facade/types/colony.ts
// Colony and colonist types for the facade

import type { Colonist, ColonistRole } from "../../core/models/Colonist";

/**
 * Immutable snapshot of colony state.
 */
export interface ColonySnapshot {
  readonly population: number;
  readonly health: number;
  readonly morale: number;
  readonly colonists: readonly Readonly<Colonist>[];
}

// Re-export core types
export type { Colonist, ColonistRole };
