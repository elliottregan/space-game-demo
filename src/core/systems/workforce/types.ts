// src/core/systems/workforce/types.ts

/**
 * Tracks a relationship between two colonists.
 */
export interface CoworkerRelationship {
  /** Strength of the relationship (0-1) */
  strength: number;
  /** Sol when they first worked together */
  formedAt: number;
  /** Sol when they last worked together */
  lastWorkedTogether: number;
  /** Whether this is a cohort relationship (arrived together) */
  isCohort?: boolean;
  /** Whether they share a guild */
  sharedGuildIds?: string[];
}

/**
 * Information about a colonist's social position in the network.
 */
export interface SocialNetworkPosition {
  /** Number of connections this colonist has */
  connectionCount: number;
  /** Average strength of their connections */
  averageStrength: number;
  /** Number of weak ties (bridges to other groups) */
  weakTieCount: number;
  /** Bridging score - how much they connect otherwise separate groups */
  bridgingScore: number;
}

/**
 * A detected social community (emergent group) in the colonist network.
 */
export interface SocialCommunity {
  /** Unique identifier for this community */
  id: string;
  /** IDs of colonists in this community */
  memberIds: string[];
  /** Average internal relationship strength */
  cohesion: number;
  /** Number of connections to other communities */
  externalConnections: number;
}

/**
 * Detailed social cohesion info for a single colonist.
 */
export interface ColonistSocialCohesion {
  clusteringCoefficient: number;
  connectionCount: number;
  isIsolated: boolean;
  communityStrength: number;
}

/**
 * Statistics about detected communities in the social network.
 */
export interface CommunityStats {
  communityCount: number;
  averageSize: number;
  averageCohesion: number;
  modularity: number;
}
