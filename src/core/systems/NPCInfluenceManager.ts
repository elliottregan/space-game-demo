// src/core/systems/NPCInfluenceManager.ts

import {
  COUNCIL_CREATION_COST,
  COUNCIL_RELATIONSHIP_BOOST,
  DEMAND_DEADLINE,
  DEMAND_THRESHOLD,
  DRIFT_RATE,
  FACTION_SUPPORT_DECAY_RATE,
  FAILURE_TRANSMISSION_PENALTY,
  IGNORED_DEMAND_DECAY_MULTIPLIER,
  LOBBY_BASE_COST,
  LOBBY_SUPPORT_BOOST,
  PASS_THRESHOLD,
  POLITICAL_PRESSURE_START_SOL,
  PROJECT_PASS_SUPPORT_BOOST,
  PROJECT_VOTE_DELAY,
  SUCCESS_TRANSMISSION_BOOST,
  TRANSMISSION_FACTORS,
} from "../balance/NPCInfluenceBalance";
import type { GameEvent } from "../models/GameEvent";
import {
  type ActiveProject,
  ALL_FACTIONS,
  type Council,
  type FactionDemand,
  type NPC,
  NPCFaction,
  type Project,
  type ProjectType,
} from "../models/NPCInfluence";
import type { ResourceDelta } from "../models/Resources";
import { updateSupport } from "../utils/matrix";
import type { ResourceManager } from "./ResourceManager";

// Re-export matrix utilities for backward compatibility
export { matrixMultiply, matrixVectorMultiply, updateSupport } from "../utils/matrix";

export class NPCInfluenceManager {
  private npcs: NPC[];
  private npcIndex: Map<string, number> = new Map();
  private projects: Map<string, Project> = new Map();
  private relationshipMatrix: number[][];
  private councils: Council[] = [];
  private activeProject: ActiveProject | null = null;
  private npcSupport: Map<string, number> = new Map();
  private activeDemands: FactionDemand[] = [];

  /** Mutable transmission factors (modified by project outcomes) */
  private transmissionFactors: Record<ProjectType, Record<NPCFaction, Record<NPCFaction, number>>>;

  constructor(npcs: NPC[], relationships: Record<string, number>, projects: Project[]) {
    this.npcs = [...npcs];

    // Build NPC index for fast lookup
    npcs.forEach((npc, i) => this.npcIndex.set(npc.id, i));

    // Store projects
    projects.forEach((p) => this.projects.set(p.id, p));

    // Build relationship matrix
    this.relationshipMatrix = this.buildRelationshipMatrix(relationships);

    // Deep copy transmission factors so we can modify them
    this.transmissionFactors = JSON.parse(JSON.stringify(TRANSMISSION_FACTORS));

    // Initialize support for each NPC to 0
    for (const npc of this.npcs) {
      this.npcSupport.set(npc.id, 0);
    }
  }

  private buildRelationshipMatrix(relationships: Record<string, number>): number[][] {
    const N = this.npcs.length;
    const matrix: number[][] = Array(N)
      .fill(0)
      .map(() => Array(N).fill(0));

    for (const [key, weight] of Object.entries(relationships)) {
      const [fromId, toId] = key.split(":");
      if (!fromId || !toId) continue;
      const fromIdx = this.npcIndex.get(fromId);
      const toIdx = this.npcIndex.get(toId);

      if (fromIdx !== undefined && toIdx !== undefined) {
        // W[i][j] = influence from j to i
        // So if "fromId:toId" means fromId influences toId, we set W[toIdx][fromIdx]
        const row = matrix[toIdx] as number[];
        row[fromIdx] = weight;
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

  getFactionSupport(): Record<NPCFaction, number> {
    const result: Record<NPCFaction, number> = {
      [NPCFaction.EarthLoyalists]: 0,
      [NPCFaction.MarsIndependence]: 0,
      [NPCFaction.CorporateInterests]: 0,
    };

    for (const faction of ALL_FACTIONS) {
      const factionNpcs = this.npcs.filter((n) => n.faction === faction);
      if (factionNpcs.length === 0) continue;

      const totalSupport = factionNpcs.reduce(
        (sum, npc) => sum + (this.npcSupport.get(npc.id) ?? 0),
        0,
      );
      result[faction] = totalSupport / factionNpcs.length;
    }

    return result;
  }

  adjustNPCSupport(npcId: string, amount: number): void {
    const current = this.npcSupport.get(npcId) ?? 0;
    this.npcSupport.set(npcId, Math.max(-1, Math.min(1, current + amount)));
  }

  getActiveDemands(): readonly FactionDemand[] {
    return this.activeDemands;
  }

  private getFactionDisplayName(faction: NPCFaction): string {
    const names: Record<NPCFaction, string> = {
      [NPCFaction.EarthLoyalists]: "Earth Loyalists",
      [NPCFaction.MarsIndependence]: "Mars Independence",
      [NPCFaction.CorporateInterests]: "Corporate Interests",
    };
    return names[faction];
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

    // Initialize project: faction-aligned NPCs start at full support, others at neutral
    const supportLevels = new Map<string, number>();
    for (const npc of this.npcs) {
      supportLevels.set(npc.id, npc.faction === project.type ? 1.0 : 0.0);
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
    if (!npc) return Infinity;
    // Cost scales with NPC influence and boost amount
    return Math.ceil(LOBBY_BASE_COST * npc.influence * (supportBoost / LOBBY_SUPPORT_BOOST));
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
          const idx1 = this.npcIndex.get(id1);
          const idx2 = this.npcIndex.get(id2);
          if (idx1 === undefined || idx2 === undefined) continue;

          // W[i][j] = influence from j to i
          const row = this.relationshipMatrix[idx1] as number[];
          row[idx2] = Math.min(1.0, row[idx2] + COUNCIL_RELATIONSHIP_BOOST);
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

  // ============ Demand Generation ============

  private checkAndGenerateDemands(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const factionSupport = this.getFactionSupport();

    for (const faction of ALL_FACTIONS) {
      // Skip if already has active demand
      if (this.activeDemands.some((d) => d.factionId === faction)) {
        continue;
      }

      // Check if support below threshold
      if (factionSupport[faction] < DEMAND_THRESHOLD) {
        const factionProjects = Array.from(this.projects.values())
          .filter((p) => p.type === faction)
          .map((p) => p.id);

        if (factionProjects.length > 0) {
          const demand: FactionDemand = {
            factionId: faction,
            demandedAt: currentSol,
            deadline: DEMAND_DEADLINE,
            projectIds: factionProjects,
          };

          this.activeDemands.push(demand);

          events.push({
            type: "FACTION_DEMAND",
            message: `${this.getFactionDisplayName(faction)} demands you propose one of their projects!`,
          });
        }
      }
    }

    return events;
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
      const targetNpc = this.npcs[i];
      const rowT = T[i] as number[];
      if (!targetNpc) continue;
      for (let j = 0; j < N; j++) {
        const sourceNpc = this.npcs[j];
        if (!sourceNpc) continue;
        rowT[j] = factors[targetNpc.faction][sourceNpc.faction];
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
          Math.min(1, current + delta),
        );
      }
    }
  }

  /**
   * Process one game tick. Propagates influence and resolves projects.
   */
  tick(currentSol: number = 0): GameEvent[] {
    const events: GameEvent[] = [];

    if (currentSol >= POLITICAL_PRESSURE_START_SOL) {
      this.decrementDemandDeadlines();
      this.applySupportDecay();
      events.push(...this.checkAndGenerateDemands(currentSol));
    }

    if (!this.activeProject) {
      return events;
    }

    const project = this.projects.get(this.activeProject.projectId);
    if (!project) {
      return events;
    }

    this.propagateProjectSupport(project);
    this.activeProject.solsRemaining--;

    if (this.activeProject.solsRemaining <= 0) {
      events.push(...this.resolveProject(project));
    }

    return events;
  }

  private decrementDemandDeadlines(): void {
    for (const demand of this.activeDemands) {
      demand.deadline--;
    }
  }

  private applySupportDecay(): void {
    for (const npc of this.npcs) {
      const current = this.npcSupport.get(npc.id) ?? 0;
      const factionDemand = this.activeDemands.find((d) => d.factionId === npc.faction);
      const multiplier =
        factionDemand && factionDemand.deadline <= 0 ? IGNORED_DEMAND_DECAY_MULTIPLIER : 1;

      const decayed = current - FACTION_SUPPORT_DECAY_RATE * multiplier;
      this.npcSupport.set(npc.id, Math.max(-1, decayed));
    }
  }

  private propagateProjectSupport(project: Project): void {
    if (!this.activeProject) return;

    const currentSupport: number[] = this.npcs.map(
      (npc) => this.activeProject?.supportLevels.get(npc.id) || 0,
    );

    const T = this.buildTransmissionMatrix(project.type);
    const newSupport = updateSupport(currentSupport, this.relationshipMatrix, T, DRIFT_RATE);

    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (npc) {
        this.activeProject.supportLevels.set(npc.id, newSupport[i] ?? 0);
      }
    }
  }

  private resolveProject(project: Project): GameEvent[] {
    const events: GameEvent[] = [];
    const averageSupport = this.getAverageSupport();
    const passed = averageSupport >= PASS_THRESHOLD;

    if (passed) {
      events.push(this.createProjectPassedEvent(project, averageSupport));
      this.applyProjectPassEffects(project);
    } else {
      events.push(this.createProjectFailedEvent(project, averageSupport));
      this.modifyTransmissionFactors(project.type, FAILURE_TRANSMISSION_PENALTY);
    }

    this.activeProject = null;
    return events;
  }

  private createProjectPassedEvent(project: Project, averageSupport: number): GameEvent {
    return {
      type: "PROJECT_PASSED",
      severity: "info",
      projectId: project.id,
      projectName: project.name,
      averageSupport,
      message: `Project "${project.name}" passed with ${(averageSupport * 100).toFixed(0)}% average support`,
    };
  }

  private createProjectFailedEvent(project: Project, averageSupport: number): GameEvent {
    return {
      type: "PROJECT_FAILED",
      severity: "warning",
      projectId: project.id,
      projectName: project.name,
      averageSupport,
      message: `Project "${project.name}" failed with only ${(averageSupport * 100).toFixed(0)}% average support`,
    };
  }

  private applyProjectPassEffects(project: Project): void {
    const projectFaction = project.type;

    this.modifyTransmissionFactors(projectFaction, SUCCESS_TRANSMISSION_BOOST);
    this.activeDemands = this.activeDemands.filter((d) => d.factionId !== projectFaction);

    for (const npc of this.npcs) {
      if (npc.faction === projectFaction) {
        const current = this.npcSupport.get(npc.id) ?? 0;
        this.npcSupport.set(npc.id, Math.min(1, current + PROJECT_PASS_SUPPORT_BOOST));
      }
    }
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
      npcSupport: Object.fromEntries(this.npcSupport),
      activeDemands: this.activeDemands,
    };
  }

  static fromJSON(
    data: ReturnType<NPCInfluenceManager["toJSON"]>,
    npcs: NPC[],
    relationships: Record<string, number>,
    projects: Project[],
  ): NPCInfluenceManager {
    const manager = new NPCInfluenceManager(npcs, relationships, projects);

    manager.relationshipMatrix = data.relationshipMatrix;
    manager.councils = data.councils;
    manager.transmissionFactors = data.transmissionFactors;

    if (data.activeProject) {
      manager.activeProject = {
        projectId: data.activeProject.projectId,
        supportLevels: new Map(
          Object.entries(data.activeProject.supportLevels).map(([k, v]) => [k, Number(v)]),
        ),
        solsRemaining: data.activeProject.solsRemaining,
      };
    }

    // Restore new state
    if (data.npcSupport) {
      manager.npcSupport = new Map(Object.entries(data.npcSupport).map(([k, v]) => [k, Number(v)]));
    }

    if (data.activeDemands) {
      manager.activeDemands = data.activeDemands;
    }

    return manager;
  }
}
