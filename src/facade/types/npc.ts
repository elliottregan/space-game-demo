// src/facade/types/npc.ts
// NPC influence types for the facade

import type { NPC, Project, Council } from "../../core/models/NPCInfluence";

/**
 * Immutable snapshot of NPC influence state.
 */
export interface NPCInfluenceSnapshot {
  readonly npcs: readonly Readonly<NPC>[];
  readonly projects: readonly Readonly<Project>[];
  readonly activeProject: Readonly<{
    projectId: string;
    supportLevels: Readonly<Record<string, number>>;
    solsRemaining: number;
    averageSupport: number;
  }> | null;
  readonly councils: readonly Readonly<Council>[];
  readonly relationshipMatrix: readonly (readonly number[])[];
}

// Re-export core types
export type { NPC, Project, Council };
