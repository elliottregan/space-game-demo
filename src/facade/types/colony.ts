// src/facade/types/colony.ts
// Colony and colonist types for the facade

import { type SkillDefinition, SkillId } from "../../core/data/skills";
import type { Colonist, ColonistRole } from "../../core/models/Colonist";

/**
 * Immutable snapshot of colony state.
 */
export interface ColonySnapshot {
  readonly population: number;
  readonly health: number;
  readonly morale: number;
  readonly colonists: readonly Readonly<Colonist>[];
  readonly skillDefinitions: readonly Readonly<SkillDefinition>[];
  readonly housingAssignments: Readonly<Record<string, readonly Readonly<Colonist>[]>>;
  readonly unhoused: readonly Readonly<Colonist>[];
}

// Re-export core types
export { SkillId };
export type { Colonist, ColonistRole, SkillDefinition };
