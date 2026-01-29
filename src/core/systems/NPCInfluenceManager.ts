// src/core/systems/NPCInfluenceManager.ts

import {
  COUNCIL_CREATION_COST,
  COUNCIL_RELATIONSHIP_BOOST,
  CROSS_FACTION_DECAY_MULTIPLIER,
  DEMAND_DEADLINE,
  DEMAND_THRESHOLD,
  DISCONNECTION_THRESHOLD,
  DRIFT_RATE,
  FACTION_SUPPORT_DECAY_RATE,
  FAILURE_TRANSMISSION_PENALTY,
  IGNORED_DEMAND_DECAY_MULTIPLIER,
  INTERACTION_REFRESH_AMOUNT,
  LOBBY_BASE_COST,
  LOBBY_SUPPORT_BOOST,
  OPPOSING_VOTE_RELATIONSHIP_PENALTY,
  PASS_THRESHOLD,
  POLITICAL_PRESSURE_START_SOL,
  PROJECT_PASS_SUPPORT_BOOST,
  PROJECT_VOTE_DELAY,
  RELATIONSHIP_DECAY_RATE,
  RELATIONSHIP_STALE_THRESHOLD,
  SAME_FACTION_CLOSURE_MULTIPLIER,
  SAME_FACTION_RELATIONSHIP_FLOOR,
  SHARED_VOTE_RELATIONSHIP_BOOST,
  SUCCESS_TRANSMISSION_BOOST,
  TRANSMISSION_FACTORS,
  TRIADIC_CLOSURE_INITIAL_WEIGHT,
  TRIADIC_CLOSURE_PROBABILITY,
  TRIADIC_CLOSURE_THRESHOLD,
  UNMAINTAINED_DECAY_MULTIPLIER,
} from "../balance/NPCInfluenceBalance";
import type { GameEvent } from "../models/GameEvent";
import { rng } from "../utils/random";
import {
  type ActiveProject,
  ALL_FACTIONS,
  type Council,
  type FactionDemand,
  InteractionType,
  type NetworkComponent,
  type NetworkDisconnection,
  type NPC,
  NPCFaction,
  NPCId,
  type Project,
  ProjectId,
  type ProjectType,
  type RelationshipInteraction,
  type TriadicClosureEvent,
} from "../models/NPCInfluence";
import type { ResourceDelta } from "../models/Resources";
import { updateSupport } from "../utils/matrix";
import type { ResourceManager } from "./ResourceManager";

// Re-export matrix utilities for backward compatibility
export { matrixMultiply, matrixVectorMultiply, updateSupport } from "../utils/matrix";

export class NPCInfluenceManager {
  private npcs: NPC[];
  private npcIndex: Map<NPCId, number> = new Map();
  private projects: Map<ProjectId, Project> = new Map();
  private relationshipMatrix: number[][];
  private councils: Council[] = [];
  private activeProject: ActiveProject | null = null;
  private npcSupport: Map<NPCId, number> = new Map();
  private activeDemands: FactionDemand[] = [];
  private disconnectionHistory: NetworkDisconnection[] = [];
  /** Tracks last interaction time for each relationship edge (key: "sourceId:targetId") */
  private interactionTracker: Map<string, RelationshipInteraction> = new Map();
  /** History of triadic closure events */
  private triadicClosureHistory: TriadicClosureEvent[] = [];

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
      const fromIdx = this.npcIndex.get(fromId as NPCId);
      const toIdx = this.npcIndex.get(toId as NPCId);

      if (fromIdx !== undefined && toIdx !== undefined) {
        // W[i][j] = influence from j to i
        // So if "fromId:toId" means fromId influences toId, we set W[toIdx][fromIdx]
        const row = matrix[toIdx] as number[];
        row[fromIdx] = weight;

        // Initialize interaction tracker for this relationship
        this.interactionTracker.set(key, {
          lastInteractionSol: 0, // Initial relationships start fresh
          interactionType: InteractionType.INITIAL,
        });
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

  getProject(id: ProjectId): Project | undefined {
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

  adjustNPCSupport(npcId: NPCId, amount: number): void {
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
  proposeProject(projectId: ProjectId, resources: ResourceManager): boolean {
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
    const supportLevels = new Map<NPCId, number>();
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
  getLobbyCost(npcId: NPCId, supportBoost: number): number {
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
  lobbyNPC(npcId: NPCId, supportBoost: number, resources: ResourceManager): boolean {
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
  createCouncil(
    name: string,
    memberIds: NPCId[],
    resources: ResourceManager,
    currentSol: number = 0,
  ): boolean {
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
          const row = this.relationshipMatrix[idx1];
          if (row) {
            row[idx2] = Math.min(1.0, (row[idx2] ?? 0) + COUNCIL_RELATIONSHIP_BOOST);
          }

          // Record the interaction for relationship maintenance
          this.recordInteraction(id2, id1, currentSol, InteractionType.COUNCIL_MEMBERSHIP);
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

  // ============ Dynamic Network Management ============

  /**
   * Add a new NPC to the political network.
   * The new NPC starts with no connections unless initialRelationships are provided.
   * @param npc The NPC to add
   * @param initialRelationships Optional relationships in format "fromId:toId" -> weight
   * @returns true if NPC was added, false if NPC ID already exists
   */
  addNPC(npc: NPC, initialRelationships?: Record<string, number>): boolean {
    // Check if NPC ID already exists
    if (this.npcIndex.has(npc.id)) {
      return false;
    }

    const newIndex = this.npcs.length;

    // Add to NPC list and index
    this.npcs.push(npc);
    this.npcIndex.set(npc.id, newIndex);

    // Initialize support for the new NPC
    this.npcSupport.set(npc.id, 0);

    // Expand relationship matrix: add a new row and extend all existing rows
    const N = this.npcs.length;

    // Add new column to all existing rows
    for (let i = 0; i < N - 1; i++) {
      const row = this.relationshipMatrix[i];
      if (row) {
        row.push(0);
      }
    }

    // Add new row for the new NPC
    this.relationshipMatrix.push(new Array(N).fill(0));

    // Apply initial relationships if provided
    if (initialRelationships) {
      for (const [key, weight] of Object.entries(initialRelationships)) {
        const [fromId, toId] = key.split(":");
        if (!fromId || !toId) continue;

        const fromIdx = this.npcIndex.get(fromId as NPCId);
        const toIdx = this.npcIndex.get(toId as NPCId);

        if (fromIdx !== undefined && toIdx !== undefined) {
          // W[i][j] = influence from j to i
          const row = this.relationshipMatrix[toIdx];
          if (row) {
            row[fromIdx] = weight;
          }
        }
      }
    }

    return true;
  }

  /**
   * Remove an NPC from the political network.
   * This will also remove all their relationships and update the matrix.
   * @param npcId The ID of the NPC to remove
   * @returns true if NPC was removed, false if NPC not found
   */
  removeNPC(npcId: NPCId): boolean {
    const idx = this.npcIndex.get(npcId);
    if (idx === undefined) {
      return false;
    }

    // Remove from NPC list
    this.npcs.splice(idx, 1);

    // Remove from support tracking
    this.npcSupport.delete(npcId);

    // Remove row from relationship matrix
    this.relationshipMatrix.splice(idx, 1);

    // Remove column from all remaining rows
    for (const row of this.relationshipMatrix) {
      row.splice(idx, 1);
    }

    // Rebuild the index map
    this.npcIndex.clear();
    this.npcs.forEach((npc, i) => this.npcIndex.set(npc.id, i));

    // Update any active project support levels
    if (this.activeProject) {
      this.activeProject.supportLevels.delete(npcId);
    }

    // Remove from councils
    for (const council of this.councils) {
      const memberIdx = council.memberIds.indexOf(npcId);
      if (memberIdx !== -1) {
        council.memberIds.splice(memberIdx, 1);
      }
    }

    return true;
  }

  /**
   * Establish or strengthen a connection between two NPCs.
   * @param sourceId The NPC providing influence
   * @param targetId The NPC receiving influence
   * @param weight The connection weight (0-1)
   * @returns true if connection was established, false if either NPC not found
   */
  setRelationship(sourceId: NPCId, targetId: NPCId, weight: number): boolean {
    const sourceIdx = this.npcIndex.get(sourceId);
    const targetIdx = this.npcIndex.get(targetId);

    if (sourceIdx === undefined || targetIdx === undefined) {
      return false;
    }

    // W[i][j] = influence from j to i
    const row = this.relationshipMatrix[targetIdx];
    if (!row) return false;

    row[sourceIdx] = Math.max(0, Math.min(1, weight));
    return true;
  }

  /**
   * Strengthen an existing relationship between two NPCs.
   * @param sourceId The NPC providing influence
   * @param targetId The NPC receiving influence
   * @param amount The amount to increase the weight by
   * @returns true if relationship was strengthened, false if either NPC not found
   */
  strengthenRelationship(sourceId: NPCId, targetId: NPCId, amount: number): boolean {
    const sourceIdx = this.npcIndex.get(sourceId);
    const targetIdx = this.npcIndex.get(targetId);

    if (sourceIdx === undefined || targetIdx === undefined) {
      return false;
    }

    const row = this.relationshipMatrix[targetIdx];
    if (!row) return false;

    const currentWeight = row[sourceIdx] ?? 0;
    row[sourceIdx] = Math.min(1, currentWeight + amount);
    return true;
  }

  /**
   * Get all NPCs that have a connection to or from the specified NPC.
   * @param npcId The NPC to find neighbors for
   * @returns Array of NPC IDs that are connected to the specified NPC
   */
  getNeighbors(npcId: NPCId): NPCId[] {
    const idx = this.npcIndex.get(npcId);
    if (idx === undefined) return [];

    const neighbors = new Set<NPCId>();
    const N = this.npcs.length;

    for (let i = 0; i < N; i++) {
      if (i === idx) continue;

      const npc = this.npcs[i];
      if (!npc) continue;

      // Check if idx influences i (row i, column idx)
      const rowI = this.relationshipMatrix[i];
      if (rowI && (rowI[idx] ?? 0) > 0) {
        neighbors.add(npc.id);
      }

      // Check if i influences idx (row idx, column i)
      const rowIdx = this.relationshipMatrix[idx];
      if (rowIdx && (rowIdx[i] ?? 0) > 0) {
        neighbors.add(npc.id);
      }
    }

    return Array.from(neighbors);
  }

  /**
   * Get all relationships for a specific NPC.
   * @param npcId The NPC to get relationships for
   * @returns Object with incoming and outgoing relationship maps
   */
  getRelationships(npcId: NPCId): {
    incoming: Map<NPCId, number>;
    outgoing: Map<NPCId, number>;
  } {
    const idx = this.npcIndex.get(npcId);
    const incoming = new Map<NPCId, number>();
    const outgoing = new Map<NPCId, number>();

    if (idx === undefined) {
      return { incoming, outgoing };
    }

    const N = this.npcs.length;

    for (let i = 0; i < N; i++) {
      if (i === idx) continue;

      const npc = this.npcs[i];
      if (!npc) continue;

      // Incoming: influence from npc to npcId (row idx, column i)
      const rowIdx = this.relationshipMatrix[idx];
      const inWeight = rowIdx?.[i] ?? 0;
      if (inWeight > 0) {
        incoming.set(npc.id, inWeight);
      }

      // Outgoing: influence from npcId to npc (row i, column idx)
      const rowI = this.relationshipMatrix[i];
      const outWeight = rowI?.[idx] ?? 0;
      if (outWeight > 0) {
        outgoing.set(npc.id, outWeight);
      }
    }

    return { incoming, outgoing };
  }

  // ============ Network Disconnection System ============

  /**
   * Get the relationship weight between two NPCs.
   * @returns The weight of influence from sourceId to targetId, or 0 if no connection
   */
  getRelationshipWeight(sourceId: NPCId, targetId: NPCId): number {
    const sourceIdx = this.npcIndex.get(sourceId);
    const targetIdx = this.npcIndex.get(targetId);
    if (sourceIdx === undefined || targetIdx === undefined) return 0;

    // W[i][j] = influence from j to i, so W[targetIdx][sourceIdx]
    const row = this.relationshipMatrix[targetIdx];
    return row?.[sourceIdx] ?? 0;
  }

  /**
   * Get all disconnection events that have occurred.
   */
  getDisconnectionHistory(): readonly NetworkDisconnection[] {
    return this.disconnectionHistory;
  }

  /**
   * Weaken a specific relationship between two NPCs.
   * @returns true if the relationship was weakened, false if no connection exists
   */
  weakenRelationship(sourceId: NPCId, targetId: NPCId, amount: number): boolean {
    const sourceIdx = this.npcIndex.get(sourceId);
    const targetIdx = this.npcIndex.get(targetId);
    if (sourceIdx === undefined || targetIdx === undefined) return false;

    const row = this.relationshipMatrix[targetIdx];
    if (!row) return false;

    const currentWeight = row[sourceIdx] ?? 0;
    if (currentWeight <= 0) return false;

    // Check faction floor for same-faction members
    const sourceNpc = this.npcs[sourceIdx];
    const targetNpc = this.npcs[targetIdx];
    const isSameFaction = sourceNpc && targetNpc && sourceNpc.faction === targetNpc.faction;
    const floor = isSameFaction ? SAME_FACTION_RELATIONSHIP_FLOOR : 0;

    row[sourceIdx] = Math.max(floor, currentWeight - amount);
    return true;
  }

  /**
   * Apply natural relationship decay to all connections.
   * Cross-faction connections decay faster than same-faction connections.
   * Unmaintained relationships (no recent interaction) decay even faster.
   * @returns Events generated from any disconnections that occurred
   */
  private applyRelationshipDecay(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const N = this.npcs.length;

    for (let targetIdx = 0; targetIdx < N; targetIdx++) {
      const targetNpc = this.npcs[targetIdx];
      const row = this.relationshipMatrix[targetIdx];
      if (!targetNpc || !row) continue;

      for (let sourceIdx = 0; sourceIdx < N; sourceIdx++) {
        if (targetIdx === sourceIdx) continue;

        const currentWeight = row[sourceIdx] ?? 0;
        if (currentWeight <= 0) continue;

        const sourceNpc = this.npcs[sourceIdx];
        if (!sourceNpc) continue;

        // Calculate base decay rate based on faction alignment
        const isSameFaction = sourceNpc.faction === targetNpc.faction;
        let decayRate = isSameFaction
          ? RELATIONSHIP_DECAY_RATE
          : RELATIONSHIP_DECAY_RATE * CROSS_FACTION_DECAY_MULTIPLIER;

        // Apply unmaintained relationship multiplier
        const interactionKey = `${sourceNpc.id}:${targetNpc.id}`;
        const interaction = this.interactionTracker.get(interactionKey);
        if (interaction) {
          const solsSinceInteraction = currentSol - interaction.lastInteractionSol;
          if (solsSinceInteraction > RELATIONSHIP_STALE_THRESHOLD) {
            decayRate *= UNMAINTAINED_DECAY_MULTIPLIER;
          }
        } else {
          // No interaction record means it's unmaintained
          decayRate *= UNMAINTAINED_DECAY_MULTIPLIER;
        }

        // Apply floor for same-faction members
        const floor = isSameFaction ? SAME_FACTION_RELATIONSHIP_FLOOR : 0;
        const newWeight = Math.max(floor, currentWeight - decayRate);

        row[sourceIdx] = newWeight;
      }
    }

    return events;
  }

  /**
   * Check all relationships and disconnect any that fall below the threshold.
   * @returns Events generated from disconnections
   */
  private checkAndApplyDisconnections(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const N = this.npcs.length;

    for (let targetIdx = 0; targetIdx < N; targetIdx++) {
      const targetNpc = this.npcs[targetIdx];
      const row = this.relationshipMatrix[targetIdx];
      if (!targetNpc || !row) continue;

      for (let sourceIdx = 0; sourceIdx < N; sourceIdx++) {
        if (targetIdx === sourceIdx) continue;

        const sourceNpc = this.npcs[sourceIdx];
        if (!sourceNpc) continue;

        const currentWeight = row[sourceIdx] ?? 0;

        // Skip if already disconnected or above threshold
        if (currentWeight <= 0 || currentWeight >= DISCONNECTION_THRESHOLD) continue;

        // Same-faction members have a floor, so they won't disconnect
        if (sourceNpc.faction === targetNpc.faction) continue;

        // Record the disconnection
        const disconnection: NetworkDisconnection = {
          sourceId: sourceNpc.id,
          targetId: targetNpc.id,
          occurredAt: currentSol,
          previousWeight: currentWeight,
        };
        this.disconnectionHistory.push(disconnection);

        // Sever the connection
        row[sourceIdx] = 0;

        // Generate event
        events.push({
          type: "NETWORK_DISCONNECTION",
          severity: "warning",
          sourceNpcId: sourceNpc.id,
          sourceNpcName: sourceNpc.name,
          targetNpcId: targetNpc.id,
          targetNpcName: targetNpc.name,
          message: `${sourceNpc.name} has lost influence over ${targetNpc.name}`,
        });
      }
    }

    return events;
  }

  /**
   * Apply relationship penalties to NPCs who voted on opposing sides of a resolved project.
   * NPCs with support > 0 are considered supporters, those with support < 0 are opposers.
   */
  private applyOpposingVotePenalties(): void {
    if (!this.activeProject) return;

    const supporters: number[] = [];
    const opposers: number[] = [];

    // Categorize NPCs by their vote
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (!npc) continue;
      const support = this.activeProject.supportLevels.get(npc.id) ?? 0;
      if (support > 0.1) {
        supporters.push(i);
      } else if (support < -0.1) {
        opposers.push(i);
      }
    }

    // Weaken relationships between opposing sides (both directions)
    for (const supporterIdx of supporters) {
      const supporterRow = this.relationshipMatrix[supporterIdx];
      if (!supporterRow) continue;

      for (const opposerIdx of opposers) {
        const opposerRow = this.relationshipMatrix[opposerIdx];
        if (!opposerRow) continue;

        // Weaken supporter's influence on opposer
        if ((supporterRow[opposerIdx] ?? 0) > 0) {
          const supporterNpc = this.npcs[supporterIdx];
          const opposerNpc = this.npcs[opposerIdx];
          const isSameFaction =
            supporterNpc && opposerNpc && supporterNpc.faction === opposerNpc.faction;
          const floor = isSameFaction ? SAME_FACTION_RELATIONSHIP_FLOOR : 0;
          supporterRow[opposerIdx] = Math.max(
            floor,
            (supporterRow[opposerIdx] ?? 0) - OPPOSING_VOTE_RELATIONSHIP_PENALTY,
          );
        }

        // Weaken opposer's influence on supporter
        if ((opposerRow[supporterIdx] ?? 0) > 0) {
          const supporterNpc = this.npcs[supporterIdx];
          const opposerNpc = this.npcs[opposerIdx];
          const isSameFaction =
            supporterNpc && opposerNpc && supporterNpc.faction === opposerNpc.faction;
          const floor = isSameFaction ? SAME_FACTION_RELATIONSHIP_FLOOR : 0;
          opposerRow[supporterIdx] = Math.max(
            floor,
            (opposerRow[supporterIdx] ?? 0) - OPPOSING_VOTE_RELATIONSHIP_PENALTY,
          );
        }
      }
    }
  }

  /**
   * Find all connected components in the political network.
   * Uses bidirectional connections (A connects to B if A influences B OR B influences A).
   * @returns Array of NetworkComponent objects representing disconnected groups
   */
  getConnectedComponents(): NetworkComponent[] {
    const N = this.npcs.length;
    const visited = new Array(N).fill(false);
    const components: NetworkComponent[] = [];

    // Build undirected adjacency from directed relationship matrix
    const hasConnection = (i: number, j: number): boolean => {
      const rowI = this.relationshipMatrix[i];
      const rowJ = this.relationshipMatrix[j];
      const iToJ = rowJ?.[i] ?? 0;
      const jToI = rowI?.[j] ?? 0;
      return iToJ > 0 || jToI > 0;
    };

    // BFS to find all nodes in a component
    const bfs = (startIdx: number): number[] => {
      const component: number[] = [];
      const queue: number[] = [startIdx];
      visited[startIdx] = true;

      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);

        for (let neighbor = 0; neighbor < N; neighbor++) {
          if (!visited[neighbor] && hasConnection(current, neighbor)) {
            visited[neighbor] = true;
            queue.push(neighbor);
          }
        }
      }

      return component;
    };

    // Find all components
    for (let i = 0; i < N; i++) {
      if (!visited[i]) {
        const componentIndices = bfs(i);
        const memberIds: NPCId[] = [];
        const factions = new Set<NPCFaction>();

        for (const idx of componentIndices) {
          const npc = this.npcs[idx];
          if (npc) {
            memberIds.push(npc.id);
            factions.add(npc.faction);
          }
        }

        components.push({
          memberIds,
          factions: Array.from(factions),
        });
      }
    }

    return components;
  }

  // ============ Triadic Closure System ============

  /**
   * Get the history of triadic closure events.
   */
  getTriadicClosureHistory(): readonly TriadicClosureEvent[] {
    return this.triadicClosureHistory;
  }

  /**
   * Process triadic closure: when A→B and B→C both exist, there's a chance to form A→C.
   * This models the "friend of a friend becomes a friend" phenomenon.
   * @returns Events generated from new connections formed
   */
  private processTriadicClosure(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const N = this.npcs.length;

    // Find all open triads (A→B, B→C where A→C doesn't exist)
    for (let aIdx = 0; aIdx < N; aIdx++) {
      const npcA = this.npcs[aIdx];
      if (!npcA) continue;

      for (let bIdx = 0; bIdx < N; bIdx++) {
        if (aIdx === bIdx) continue;
        const npcB = this.npcs[bIdx];
        if (!npcB) continue;

        // Check if A→B exists
        const rowB = this.relationshipMatrix[bIdx];
        const weightAB = rowB?.[aIdx] ?? 0;
        if (weightAB <= 0) continue;

        for (let cIdx = 0; cIdx < N; cIdx++) {
          if (cIdx === aIdx || cIdx === bIdx) continue;
          const npcC = this.npcs[cIdx];
          if (!npcC) continue;

          // Check if B→C exists
          const rowC = this.relationshipMatrix[cIdx];
          const weightBC = rowC?.[bIdx] ?? 0;
          if (weightBC <= 0) continue;

          // Check if A→C doesn't exist yet
          const weightAC = rowC?.[aIdx] ?? 0;
          if (weightAC > 0) continue;

          // Check if combined strength meets threshold
          const combinedStrength = weightAB + weightBC;
          if (combinedStrength < TRIADIC_CLOSURE_THRESHOLD) continue;

          // Calculate closure probability
          let closureProbability = TRIADIC_CLOSURE_PROBABILITY;

          // Boost probability if A and C are in the same faction
          if (npcA.faction === npcC.faction) {
            closureProbability *= SAME_FACTION_CLOSURE_MULTIPLIER;
          }

          // Random chance to form the connection
          if (rng.chance(closureProbability)) {
            // Form the new connection A→C
            rowC[aIdx] = TRIADIC_CLOSURE_INITIAL_WEIGHT;

            // Record the interaction
            const interactionKey = `${npcA.id}:${npcC.id}`;
            this.interactionTracker.set(interactionKey, {
              lastInteractionSol: currentSol,
              interactionType: InteractionType.TRIADIC_CLOSURE,
            });

            // Record the closure event
            const closureEvent: TriadicClosureEvent = {
              npcA: npcA.id,
              npcC: npcC.id,
              bridgeNpc: npcB.id,
              occurredAt: currentSol,
              initialWeight: TRIADIC_CLOSURE_INITIAL_WEIGHT,
            };
            this.triadicClosureHistory.push(closureEvent);

            // Generate game event
            events.push({
              type: "TRIADIC_CLOSURE",
              severity: "info",
              npcA: npcA.id,
              npcAName: npcA.name,
              npcC: npcC.id,
              npcCName: npcC.name,
              bridgeNpc: npcB.id,
              bridgeNpcName: npcB.name,
              message: `${npcA.name} formed a connection with ${npcC.name} through ${npcB.name}`,
            });
          }
        }
      }
    }

    return events;
  }

  // ============ Relationship Maintenance System ============

  /**
   * Record an interaction between two NPCs, refreshing their relationship maintenance timer.
   */
  recordInteraction(
    sourceId: NPCId,
    targetId: NPCId,
    currentSol: number,
    interactionType: InteractionType,
  ): void {
    const interactionKey = `${sourceId}:${targetId}`;
    this.interactionTracker.set(interactionKey, {
      lastInteractionSol: currentSol,
      interactionType,
    });
  }

  /**
   * Get the last interaction info for a relationship.
   */
  getInteractionInfo(sourceId: NPCId, targetId: NPCId): RelationshipInteraction | undefined {
    const interactionKey = `${sourceId}:${targetId}`;
    return this.interactionTracker.get(interactionKey);
  }

  /**
   * Check if a relationship is considered "stale" (no recent interaction).
   */
  isRelationshipStale(sourceId: NPCId, targetId: NPCId, currentSol: number): boolean {
    const interaction = this.getInteractionInfo(sourceId, targetId);
    if (!interaction) return true;
    return currentSol - interaction.lastInteractionSol > RELATIONSHIP_STALE_THRESHOLD;
  }

  /**
   * Process shared votes: when two NPCs vote on the same side, strengthen their relationship.
   * Called when a project resolves.
   */
  private applySharedVoteBonuses(currentSol: number): void {
    if (!this.activeProject) return;

    const supporters: number[] = [];
    const opposers: number[] = [];

    // Categorize NPCs by their vote
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      if (!npc) continue;
      const support = this.activeProject.supportLevels.get(npc.id) ?? 0;
      if (support > 0.1) {
        supporters.push(i);
      } else if (support < -0.1) {
        opposers.push(i);
      }
    }

    // Strengthen relationships within supporter group
    this.strengthenGroupRelationships(supporters, currentSol);

    // Strengthen relationships within opposer group
    this.strengthenGroupRelationships(opposers, currentSol);
  }

  /**
   * Strengthen relationships between all members of a group who voted together.
   */
  private strengthenGroupRelationships(groupIndices: number[], currentSol: number): void {
    for (let i = 0; i < groupIndices.length; i++) {
      const idxA = groupIndices[i];
      if (idxA === undefined) continue;
      const npcA = this.npcs[idxA];
      if (!npcA) continue;

      for (let j = i + 1; j < groupIndices.length; j++) {
        const idxB = groupIndices[j];
        if (idxB === undefined) continue;
        const npcB = this.npcs[idxB];
        if (!npcB) continue;

        // Strengthen A→B
        const rowB = this.relationshipMatrix[idxB];
        if (rowB) {
          const currentAB = rowB[idxA] ?? 0;
          rowB[idxA] = Math.min(1, currentAB + SHARED_VOTE_RELATIONSHIP_BOOST);
          this.recordInteraction(npcA.id, npcB.id, currentSol, InteractionType.SHARED_VOTE);
        }

        // Strengthen B→A
        const rowA = this.relationshipMatrix[idxA];
        if (rowA) {
          const currentBA = rowA[idxB] ?? 0;
          rowA[idxB] = Math.min(1, currentBA + SHARED_VOTE_RELATIONSHIP_BOOST);
          this.recordInteraction(npcB.id, npcA.id, currentSol, InteractionType.SHARED_VOTE);
        }
      }
    }
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
            severity: "warning",
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

      // Apply relationship decay and check for disconnections
      this.applyRelationshipDecay(currentSol);
      events.push(...this.checkAndApplyDisconnections(currentSol));

      // Process triadic closure (friend of a friend becomes friend)
      events.push(...this.processTriadicClosure(currentSol));
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
      events.push(...this.resolveProject(project, currentSol));
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

  private resolveProject(project: Project, currentSol: number = 0): GameEvent[] {
    const events: GameEvent[] = [];
    const averageSupport = this.getAverageSupport();
    const passed = averageSupport >= PASS_THRESHOLD;

    // Apply relationship effects based on voting patterns
    if (currentSol >= POLITICAL_PRESSURE_START_SOL) {
      // Penalize opposing voters
      this.applyOpposingVotePenalties();
      // Strengthen bonds between those who voted together
      this.applySharedVoteBonuses(currentSol);
    }

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
      npcs: this.npcs,
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
      disconnectionHistory: this.disconnectionHistory,
      interactionTracker: Object.fromEntries(this.interactionTracker),
      triadicClosureHistory: this.triadicClosureHistory,
    };
  }

  static fromJSON(
    data: ReturnType<NPCInfluenceManager["toJSON"]>,
    npcs: NPC[],
    relationships: Record<string, number>,
    projects: Project[],
  ): NPCInfluenceManager {
    // Use saved NPCs if available, otherwise use provided defaults
    const npcList = data.npcs ?? npcs;
    const manager = new NPCInfluenceManager(npcList, relationships, projects);

    manager.relationshipMatrix = data.relationshipMatrix;
    manager.councils = data.councils;
    manager.transmissionFactors = data.transmissionFactors;

    // Rebuild NPC index from saved NPCs
    if (data.npcs) {
      manager.npcIndex.clear();
      data.npcs.forEach((npc, i) => manager.npcIndex.set(npc.id, i));
    }

    if (data.activeProject) {
      manager.activeProject = {
        projectId: data.activeProject.projectId,
        supportLevels: new Map(
          Object.entries(data.activeProject.supportLevels).map(([k, v]) => [k as NPCId, Number(v)]),
        ),
        solsRemaining: data.activeProject.solsRemaining,
      };
    }

    // Restore new state
    if (data.npcSupport) {
      manager.npcSupport = new Map(
        Object.entries(data.npcSupport).map(([k, v]) => [k as NPCId, Number(v)]),
      );
    }

    if (data.activeDemands) {
      manager.activeDemands = data.activeDemands;
    }

    if (data.disconnectionHistory) {
      manager.disconnectionHistory = data.disconnectionHistory;
    }

    if (data.interactionTracker) {
      manager.interactionTracker = new Map(
        Object.entries(data.interactionTracker).map(([k, v]) => [k, v as RelationshipInteraction]),
      );
    }

    if (data.triadicClosureHistory) {
      manager.triadicClosureHistory = data.triadicClosureHistory;
    }

    return manager;
  }
}
