// src/core/systems/NPCInfluenceManager.ts

import type { GameEvent } from '../models/GameEvent';
import type { ResourceManager } from './ResourceManager';
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
  COUNCIL_CREATION_COST,
  COUNCIL_RELATIONSHIP_BOOST,
  DRIFT_RATE,
  FAILURE_TRANSMISSION_PENALTY,
  LOBBY_BASE_COST,
  PASS_THRESHOLD,
  PROJECT_VOTE_DELAY,
  SUCCESS_TRANSMISSION_BOOST,
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

  // ============ Project Proposal ============

  /**
   * Propose a project for NPC consideration.
   * @returns true if proposal succeeded, false if cannot afford or project already active
   */
  proposeProject(projectId: string, resources: ResourceManager): boolean {
    // Cannot propose if project already active
    if (this.activeProject) {
      return false;
    }

    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }

    // Check if can afford proposal cost
    if (!resources.canAfford(project.proposalCost)) {
      return false;
    }

    // Deduct cost
    resources.deduct(project.proposalCost);

    // Initialize project with all NPCs at neutral support
    const supportLevels = new Map<string, number>();
    for (const npc of this.npcs) {
      supportLevels.set(npc.id, 0.0);
    }

    this.activeProject = {
      projectId,
      supportLevels,
      solsRemaining: PROJECT_VOTE_DELAY,
    };

    return true;
  }

  // ============ Lobbying ============

  /**
   * Calculate the cost to lobby an NPC for a given support boost.
   */
  getLobbyCost(npcId: string, supportBoost: number): number {
    const npcIdx = this.npcIndex.get(npcId);
    if (npcIdx === undefined) return Infinity;

    const npc = this.npcs[npcIdx];
    // Cost scales with NPC influence and boost amount
    return Math.ceil(LOBBY_BASE_COST * npc.influence * (supportBoost / 0.1));
  }

  /**
   * Lobby an NPC to increase their support for the active project.
   * @returns true if lobbying succeeded
   */
  lobbyNPC(npcId: string, supportBoost: number, resources: ResourceManager): boolean {
    if (!this.activeProject) {
      return false;
    }

    const npcIdx = this.npcIndex.get(npcId);
    if (npcIdx === undefined) {
      return false;
    }

    const cost: ResourceDelta = { materials: this.getLobbyCost(npcId, supportBoost) };

    if (!resources.canAfford(cost)) {
      return false;
    }

    resources.deduct(cost);

    const currentSupport = this.activeProject.supportLevels.get(npcId) || 0;
    const newSupport = Math.max(-1.0, Math.min(1.0, currentSupport + supportBoost));
    this.activeProject.supportLevels.set(npcId, newSupport);

    return true;
  }

  // ============ Council Creation ============

  /**
   * Create a council that permanently boosts relationships between members.
   * @returns true if council created successfully
   */
  createCouncil(name: string, memberIds: string[], resources: ResourceManager): boolean {
    const cost: ResourceDelta = { materials: COUNCIL_CREATION_COST };

    if (!resources.canAfford(cost)) {
      return false;
    }

    // Verify all members exist
    for (const id of memberIds) {
      if (!this.npcIndex.has(id)) {
        return false;
      }
    }

    resources.deduct(cost);

    // Boost relationships between all members (both directions)
    for (const id1 of memberIds) {
      for (const id2 of memberIds) {
        if (id1 !== id2) {
          const idx1 = this.npcIndex.get(id1)!;
          const idx2 = this.npcIndex.get(id2)!;

          // W[i][j] = influence from j to i
          this.relationshipMatrix[idx1][idx2] = Math.min(
            1.0,
            this.relationshipMatrix[idx1][idx2] + COUNCIL_RELATIONSHIP_BOOST
          );
        }
      }
    }

    const council: Council = {
      id: `council_${this.councils.length + 1}`,
      name,
      memberIds,
      relationshipBoost: COUNCIL_RELATIONSHIP_BOOST,
    };

    this.councils.push(council);

    return true;
  }

  // ============ Tick / Game Loop ============

  /**
   * Build the transmission matrix T for a given project type.
   * T[i][j] = how receptive NPC i is to influence from NPC j
   */
  private buildTransmissionMatrix(projectType: ProjectType): number[][] {
    const N = this.npcs.length;
    const T: number[][] = Array(N)
      .fill(0)
      .map(() => Array(N).fill(0));

    const factors = this.transmissionFactors[projectType];

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const targetFaction = this.npcs[i].faction;
        const sourceFaction = this.npcs[j].faction;
        T[i][j] = factors[targetFaction][sourceFaction];
      }
    }

    return T;
  }

  /**
   * Calculate average support across all NPCs for the active project.
   */
  getAverageSupport(): number {
    if (!this.activeProject) return 0;

    let sum = 0;
    for (const support of this.activeProject.supportLevels.values()) {
      sum += support;
    }
    return sum / this.npcs.length;
  }

  /**
   * Modify transmission factors after project success/failure.
   */
  private modifyTransmissionFactors(projectType: ProjectType, delta: number): void {
    for (const pType of Object.keys(this.transmissionFactors) as ProjectType[]) {
      for (const targetFaction of Object.keys(this.transmissionFactors[pType]) as NPCFaction[]) {
        // Modify how receptive everyone is to the project's faction
        const current = this.transmissionFactors[pType][targetFaction][projectType];
        this.transmissionFactors[pType][targetFaction][projectType] = Math.max(
          0,
          Math.min(1, current + delta)
        );
      }
    }
  }

  /**
   * Process one game tick. Propagates influence and resolves projects.
   */
  tick(): GameEvent[] {
    const events: GameEvent[] = [];

    if (!this.activeProject) {
      return events;
    }

    const project = this.projects.get(this.activeProject.projectId);
    if (!project) {
      return events;
    }

    // Build current support vector
    const currentSupport: number[] = this.npcs.map(
      (npc) => this.activeProject!.supportLevels.get(npc.id) || 0
    );

    // Build transmission matrix for this project type
    const T = this.buildTransmissionMatrix(project.type);

    // Update support levels
    const newSupport = updateSupport(
      currentSupport,
      this.relationshipMatrix,
      T,
      DRIFT_RATE
    );

    // Store updated support
    for (let i = 0; i < this.npcs.length; i++) {
      this.activeProject.supportLevels.set(this.npcs[i].id, newSupport[i]);
    }

    // Decrement sols remaining
    this.activeProject.solsRemaining--;

    // Check for resolution
    if (this.activeProject.solsRemaining <= 0) {
      const averageSupport = this.getAverageSupport();
      const passed = averageSupport >= PASS_THRESHOLD;

      if (passed) {
        events.push({
          type: 'PROJECT_PASSED',
          severity: 'info',
          projectId: project.id,
          projectName: project.name,
          averageSupport,
          message: `Project "${project.name}" passed with ${(averageSupport * 100).toFixed(0)}% average support`,
        });

        // Boost transmission factors for this project type
        this.modifyTransmissionFactors(project.type, SUCCESS_TRANSMISSION_BOOST);
      } else {
        events.push({
          type: 'PROJECT_FAILED',
          severity: 'warning',
          projectId: project.id,
          projectName: project.name,
          averageSupport,
          message: `Project "${project.name}" failed with only ${(averageSupport * 100).toFixed(0)}% average support`,
        });

        // Penalize transmission factors for this project type
        this.modifyTransmissionFactors(project.type, FAILURE_TRANSMISSION_PENALTY);
      }

      // Clear active project
      this.activeProject = null;
    }

    return events;
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
