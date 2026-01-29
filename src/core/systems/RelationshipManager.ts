// src/core/systems/RelationshipManager.ts
import type {
  CoworkerRelationship,
  SocialNetworkPosition,
  ColonistSocialCohesion,
  SocialCommunity,
  CommunityStats,
} from "./workforce/types";
import {
  getRelationshipKey,
  isWeakTie,
  calculateClusteringCoefficient,
  calculateBridgingScore,
  calculateTeamCohesionMultiplier,
} from "./workforce/socialGraph";
import { detectCommunities } from "./workforce/communityDetection";
import {
  INITIAL_COWORKER_RELATIONSHIP,
  MAX_COWORKER_RELATIONSHIP,
  MIN_COWORKER_RELATIONSHIP,
  COWORKER_RELATIONSHIP_DECAY,
  SOCIAL_COHESION,
} from "../balance/WorkforceBalance";

/**
 * Options for creating a relationship.
 */
export interface CreateRelationshipOptions {
  initialStrength?: number;
  isCohort?: boolean;
  sharedGuildIds?: string[];
}

/**
 * Manages the social relationship graph between colonists.
 * Composes pure functions from workforce/ modules.
 */
export class RelationshipManager {
  private relationships: Map<string, CoworkerRelationship> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();

  /**
   * Create a new relationship between two colonists.
   * Does not overwrite existing relationships.
   */
  createRelationship(
    colonistId1: string,
    colonistId2: string,
    currentSol: number,
    options: CreateRelationshipOptions = {},
  ): void {
    const key = getRelationshipKey(colonistId1, colonistId2);

    // Don't overwrite existing relationships
    if (this.relationships.has(key)) {
      return;
    }

    const relationship: CoworkerRelationship = {
      strength: options.initialStrength ?? INITIAL_COWORKER_RELATIONSHIP,
      formedAt: currentSol,
      lastWorkedTogether: currentSol,
      isCohort: options.isCohort,
      sharedGuildIds: options.sharedGuildIds,
    };

    this.relationships.set(key, relationship);

    // Update adjacency list for both colonists
    this.addToAdjacency(colonistId1, colonistId2);
    this.addToAdjacency(colonistId2, colonistId1);
  }

  /**
   * Increase relationship strength between two colonists.
   */
  strengthenRelationship(
    colonistId1: string,
    colonistId2: string,
    amount: number,
    currentSol: number,
  ): void {
    const key = getRelationshipKey(colonistId1, colonistId2);
    const relationship = this.relationships.get(key);

    if (!relationship) return;

    relationship.strength = Math.min(MAX_COWORKER_RELATIONSHIP, relationship.strength + amount);
    relationship.lastWorkedTogether = currentSol;
  }

  /**
   * Decay relationships that are not active.
   * @param activeKeys Set of relationship keys that were active this tick
   */
  decayRelationships(activeKeys: Set<string>): void {
    for (const [key, relationship] of this.relationships) {
      if (!activeKeys.has(key)) {
        relationship.strength = Math.max(
          MIN_COWORKER_RELATIONSHIP,
          relationship.strength - COWORKER_RELATIONSHIP_DECAY,
        );
      }
    }
  }

  /**
   * Get a relationship between two colonists.
   */
  getRelationship(colonistId1: string, colonistId2: string): CoworkerRelationship | undefined {
    const key = getRelationshipKey(colonistId1, colonistId2);
    return this.relationships.get(key);
  }

  /**
   * Get relationship strength between two colonists (0 if no relationship).
   */
  getRelationshipStrength(colonistId1: string, colonistId2: string): number {
    return this.getRelationship(colonistId1, colonistId2)?.strength ?? 0;
  }

  /**
   * Update shared guild information for a relationship.
   */
  updateSharedGuilds(colonistId1: string, colonistId2: string, guildIds: string[]): void {
    const key = getRelationshipKey(colonistId1, colonistId2);
    const relationship = this.relationships.get(key);

    if (relationship) {
      relationship.sharedGuildIds = guildIds.length > 0 ? guildIds : undefined;
    }
  }

  /**
   * Get all relationships.
   */
  getAllRelationships(): ReadonlyMap<string, CoworkerRelationship> {
    return this.relationships;
  }

  /**
   * Get all neighbor IDs for a colonist.
   */
  getNeighbors(colonistId: string): Set<string> {
    return this.adjacencyList.get(colonistId) ?? new Set();
  }

  /**
   * Get the number of connections a colonist has.
   */
  getConnectionCount(colonistId: string): number {
    return this.getNeighbors(colonistId).size;
  }

  /**
   * Check if a relationship qualifies as a weak tie.
   */
  isWeakTie(colonistId1: string, colonistId2: string): boolean {
    const strength = this.getRelationshipStrength(colonistId1, colonistId2);
    return isWeakTie(strength);
  }

  /**
   * Get all weak ties for a colonist.
   */
  getWeakTies(colonistId: string): string[] {
    const neighbors = this.getNeighbors(colonistId);
    const weakTies: string[] = [];

    for (const neighborId of neighbors) {
      if (this.isWeakTie(colonistId, neighborId)) {
        weakTies.push(neighborId);
      }
    }

    return weakTies;
  }

  /**
   * Get clustering coefficient for a colonist.
   * Delegates to pure function.
   */
  getClusteringCoefficient(colonistId: string): number {
    return calculateClusteringCoefficient(colonistId, this.adjacencyList, this.relationships);
  }

  /**
   * Calculate bridging score for a colonist.
   * Delegates to pure function.
   */
  calculateBridgingScore(colonistId: string): number {
    return calculateBridgingScore(colonistId, this.adjacencyList, (id1, id2) =>
      this.getRelationshipStrength(id1, id2),
    );
  }

  /**
   * Get team cohesion multiplier for a group of workers.
   * Delegates to pure function.
   */
  getTeamCohesionMultiplier(workerIds: string[]): number {
    return calculateTeamCohesionMultiplier(workerIds, (id1, id2) =>
      this.getRelationshipStrength(id1, id2),
    );
  }

  /**
   * Get social network position info for a colonist.
   */
  getSocialNetworkPosition(colonistId: string): SocialNetworkPosition {
    const neighbors = this.getNeighbors(colonistId);
    const connectionCount = neighbors.size;

    let totalStrength = 0;
    let weakTieCount = 0;

    for (const neighborId of neighbors) {
      const strength = this.getRelationshipStrength(colonistId, neighborId);
      totalStrength += strength;
      if (isWeakTie(strength)) {
        weakTieCount++;
      }
    }

    return {
      connectionCount,
      averageStrength: connectionCount > 0 ? totalStrength / connectionCount : 0,
      weakTieCount,
      bridgingScore: this.calculateBridgingScore(colonistId),
    };
  }

  /**
   * Get social cohesion info for a single colonist.
   */
  getColonistSocialCohesion(colonistId: string): ColonistSocialCohesion {
    const connectionCount = this.getConnectionCount(colonistId);
    const clusteringCoefficient = this.getClusteringCoefficient(colonistId);

    // Get average strength of neighbor relationships
    const neighbors = this.getNeighbors(colonistId);
    let totalStrength = 0;
    for (const neighborId of neighbors) {
      totalStrength += this.getRelationshipStrength(colonistId, neighborId);
    }

    return {
      clusteringCoefficient,
      connectionCount,
      isIsolated: connectionCount <= SOCIAL_COHESION.ISOLATION_CONNECTION_THRESHOLD,
      communityStrength: connectionCount > 0 ? totalStrength / connectionCount : 0,
    };
  }

  /**
   * Get colony-wide social cohesion metrics.
   */
  getColonySocialCohesion(colonistIds: string[]): {
    averageClusteringCoefficient: number;
    averageConnectionCount: number;
    isolatedCount: number;
  } {
    if (colonistIds.length === 0) {
      return {
        averageClusteringCoefficient: 0,
        averageConnectionCount: 0,
        isolatedCount: 0,
      };
    }

    let totalClustering = 0;
    let totalConnections = 0;
    let isolatedCount = 0;

    for (const colonistId of colonistIds) {
      totalClustering += this.getClusteringCoefficient(colonistId);
      const connections = this.getConnectionCount(colonistId);
      totalConnections += connections;
      if (connections <= SOCIAL_COHESION.ISOLATION_CONNECTION_THRESHOLD) {
        isolatedCount++;
      }
    }

    return {
      averageClusteringCoefficient: totalClustering / colonistIds.length,
      averageConnectionCount: totalConnections / colonistIds.length,
      isolatedCount,
    };
  }

  /**
   * Get list of isolated colonists (those with few connections).
   */
  getIsolatedColonists(
    colonistIds: string[],
    minConnections: number = SOCIAL_COHESION.ISOLATION_CONNECTION_THRESHOLD + 1,
  ): string[] {
    return colonistIds.filter((id) => this.getConnectionCount(id) < minConnections);
  }

  /**
   * Detect communities in the social network.
   * Delegates to pure function.
   */
  detectCommunities(
    colonistIds: string[],
    maxIterations: number = 20,
    minCommunitySize: number = 2,
  ): SocialCommunity[] {
    return detectCommunities(
      colonistIds,
      this.adjacencyList,
      this.relationships,
      maxIterations,
      minCommunitySize,
    );
  }

  /**
   * Get community statistics for the colony.
   */
  getCommunityStats(colonistIds: string[]): CommunityStats {
    const communities = this.detectCommunities(colonistIds);

    if (communities.length === 0) {
      return {
        communityCount: 0,
        averageSize: 0,
        averageCohesion: 0,
        modularity: 0,
      };
    }

    const totalSize = communities.reduce((sum, c) => sum + c.memberIds.length, 0);
    const totalCohesion = communities.reduce((sum, c) => sum + c.cohesion, 0);

    // Simple modularity calculation
    const totalEdges = this.relationships.size;
    let intraEdges = 0;

    for (const community of communities) {
      for (let i = 0; i < community.memberIds.length; i++) {
        for (let j = i + 1; j < community.memberIds.length; j++) {
          const id1 = community.memberIds[i];
          const id2 = community.memberIds[j];
          if (id1 && id2) {
            const key = getRelationshipKey(id1, id2);
            if (this.relationships.has(key)) {
              intraEdges++;
            }
          }
        }
      }
    }

    const modularity = totalEdges > 0 ? intraEdges / totalEdges : 0;

    return {
      communityCount: communities.length,
      averageSize: totalSize / communities.length,
      averageCohesion: totalCohesion / communities.length,
      modularity,
    };
  }

  // ============ Private Helpers ============

  private addToAdjacency(colonistId: string, neighborId: string): void {
    let neighbors = this.adjacencyList.get(colonistId);
    if (!neighbors) {
      neighbors = new Set();
      this.adjacencyList.set(colonistId, neighbors);
    }
    neighbors.add(neighborId);
  }

  // ============ Serialization ============

  toJSON(): {
    relationships: Record<string, CoworkerRelationship>;
    adjacencyList: Record<string, string[]>;
  } {
    return {
      relationships: Object.fromEntries(this.relationships),
      adjacencyList: Object.fromEntries(
        [...this.adjacencyList.entries()].map(([k, v]) => [k, [...v]]),
      ),
    };
  }

  static fromJSON(data: ReturnType<RelationshipManager["toJSON"]>): RelationshipManager {
    const manager = new RelationshipManager();

    if (data.relationships) {
      manager.relationships = new Map(
        Object.entries(data.relationships).map(([k, v]) => [k, v as CoworkerRelationship]),
      );
    }

    if (data.adjacencyList) {
      manager.adjacencyList = new Map(
        Object.entries(data.adjacencyList).map(([k, v]) => [k, new Set(v as string[])]),
      );
    }

    return manager;
  }
}
