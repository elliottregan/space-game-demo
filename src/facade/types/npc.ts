// src/facade/types/npc.ts
// NPC influence types for the facade

import {
  type Council,
  type NPC,
  NPCId,
  type Project,
  ProjectId,
} from "../../core/models/NPCInfluence";

/**
 * Immutable snapshot of NPC influence state.
 */
export interface NPCInfluenceSnapshot {
  readonly npcs: readonly Readonly<NPC>[];
  readonly projects: readonly Readonly<Project>[];
  readonly activeProject: Readonly<{
    projectId: ProjectId;
    supportLevels: Readonly<Record<NPCId, number>>;
    solsRemaining: number;
    averageSupport: number;
  }> | null;
  readonly councils: readonly Readonly<Council>[];
  readonly relationshipMatrix: readonly (readonly number[])[];
}

// Re-export core types
export { NPCId, ProjectId };
export type { NPC, Project, Council };
