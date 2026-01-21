// src/core/systems/NPCInfluenceManager.ts

import type { GameEvent } from '../models/GameEvent';
import type { ResourceDelta } from '../models/Resources';
import type {
  NPC,
  NPCFaction,
  Project,
  ProjectType,
  ActiveProject,
  Council,
} from '../models/NPCInfluence';
import {
  DRIFT_RATE,
  PASS_THRESHOLD,
  PROJECT_VOTE_DELAY,
  TRANSMISSION_FACTORS,
} from '../balance/NPCInfluenceBalance';

// ============ Matrix Utilities ============

/**
 * Multiply two matrices A × B
 * A is m×n, B is n×p, result is m×p
 */
export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;

  const result: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

/**
 * Multiply matrix M by vector v
 * M is m×n, v is n×1, result is m×1
 */
export function matrixVectorMultiply(M: number[][], v: number[]): number[] {
  const result = new Array(M.length).fill(0);

  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < v.length; j++) {
      result[i] += M[i][j] * v[j];
    }
  }

  return result;
}

/**
 * Update support levels using discrete-time linear dynamics:
 * s(t+1) = s(t) + α((W ⊙ T) × s(t) - s(t))
 *
 * Where W ⊙ T is the Hadamard (element-wise) product of the weight and
 * transmission matrices. This means T[i][j] modifies how much of W[i][j]'s
 * influence gets transmitted based on faction compatibility.
 *
 * @param currentSupport - Current support levels per NPC
 * @param W - Relationship weight matrix (who influences whom)
 * @param T - Transmission factor matrix (faction compatibility)
 * @param alpha - Drift rate (0.1-0.5)
 * @returns New support levels, clamped to [-1, 1]
 */
export function updateSupport(
  currentSupport: number[],
  W: number[][],
  T: number[][],
  alpha: number
): number[] {
  const N = currentSupport.length;

  // Compute effective influence matrix: W ⊙ T (Hadamard/element-wise product)
  const WT: number[][] = Array(N)
    .fill(0)
    .map(() => Array(N).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      WT[i][j] = W[i][j] * T[i][j];
    }
  }

  // Compute target support: WT × s(t)
  const target = matrixVectorMultiply(WT, currentSupport);

  // Move toward target by alpha
  const newSupport = new Array(N);
  for (let i = 0; i < N; i++) {
    newSupport[i] = currentSupport[i] + alpha * (target[i] - currentSupport[i]);
    // Clamp to valid range
    newSupport[i] = Math.max(-1.0, Math.min(1.0, newSupport[i]));
  }

  return newSupport;
}

// ============ Manager Class ============

export class NPCInfluenceManager {
  private npcs: NPC[];
  private npcIndex: Map<string, number> = new Map();
  private projects: Map<string, Project> = new Map();
  private relationshipMatrix: number[][];
  private councils: Council[] = [];
  private activeProject: ActiveProject | null = null;

  /** Mutable transmission factors (modified by project outcomes) */
  private transmissionFactors: Record<ProjectType, Record<NPCFaction, Record<NPCFaction, number>>>;

  constructor(
    npcs: NPC[],
    relationships: Record<string, number>,
    projects: Project[]
  ) {
    this.npcs = [...npcs];

    // Build NPC index for fast lookup
    npcs.forEach((npc, i) => this.npcIndex.set(npc.id, i));

    // Store projects
    projects.forEach((p) => this.projects.set(p.id, p));

    // Build relationship matrix
    this.relationshipMatrix = this.buildRelationshipMatrix(relationships);

    // Deep copy transmission factors so we can modify them
    this.transmissionFactors = JSON.parse(JSON.stringify(TRANSMISSION_FACTORS));
  }

  private buildRelationshipMatrix(relationships: Record<string, number>): number[][] {
    const N = this.npcs.length;
    const matrix: number[][] = Array(N)
      .fill(0)
      .map(() => Array(N).fill(0));

    for (const [key, weight] of Object.entries(relationships)) {
      const [fromId, toId] = key.split(':');
      const fromIdx = this.npcIndex.get(fromId);
      const toIdx = this.npcIndex.get(toId);

      if (fromIdx !== undefined && toIdx !== undefined) {
        // W[i][j] = influence from j to i
        // So if "fromId:toId" means fromId influences toId, we set W[toIdx][fromIdx]
        matrix[toIdx][fromIdx] = weight;
      }
    }

    return matrix;
  }

  // ============ Getters ============

  getNPCs(): readonly NPC[] {
    return this.npcs;
  }

  getProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getRelationshipMatrix(): readonly number[][] {
    return this.relationshipMatrix;
  }

  getActiveProject(): ActiveProject | null {
    return this.activeProject;
  }

  getCouncils(): readonly Council[] {
    return this.councils;
  }

  // ============ Serialization ============

  toJSON() {
    return {
      relationshipMatrix: this.relationshipMatrix,
      councils: this.councils,
      activeProject: this.activeProject
        ? {
            projectId: this.activeProject.projectId,
            supportLevels: Object.fromEntries(this.activeProject.supportLevels),
            solsRemaining: this.activeProject.solsRemaining,
          }
        : null,
      transmissionFactors: this.transmissionFactors,
    };
  }

  static fromJSON(
    data: ReturnType<NPCInfluenceManager['toJSON']>,
    npcs: NPC[],
    relationships: Record<string, number>,
    projects: Project[]
  ): NPCInfluenceManager {
    const manager = new NPCInfluenceManager(npcs, relationships, projects);

    manager.relationshipMatrix = data.relationshipMatrix;
    manager.councils = data.councils;
    manager.transmissionFactors = data.transmissionFactors;

    if (data.activeProject) {
      manager.activeProject = {
        projectId: data.activeProject.projectId,
        supportLevels: new Map(Object.entries(data.activeProject.supportLevels).map(([k, v]) => [k, Number(v)])),
        solsRemaining: data.activeProject.solsRemaining,
      };
    }

    return manager;
  }
}
