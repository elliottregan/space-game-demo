// src/facade/types/colony.ts
// Colony and colonist types for the facade

import type { Colonist, ColonistRole } from "../../core/models/Colonist";
import type { SkillDefinition } from "../../core/data/skills";

/**
 * Immutable snapshot of colony state.
 */
export interface ColonySnapshot {
  readonly population: number;
  readonly health: number;
  readonly morale: number;
  readonly colonists: readonly Readonly<Colonist>[];
  readonly skillDefinitions: readonly Readonly<SkillDefinition>[];
}

// Re-export core types
export type { Colonist, ColonistRole, SkillDefinition };
