import type { ResourceDelta } from "./Resources";

/**
 * Political factions in the Mars colony.
 * Using a string enum for type safety while maintaining string serialization.
 */
export enum NPCFaction {
  EarthLoyalists = "earth_loyalists",
  MarsIndependence = "mars_independence",
  CorporateInterests = "corporate_interests",
}

/** All faction values as an array for iteration */
export const ALL_FACTIONS: readonly NPCFaction[] = [
  NPCFaction.EarthLoyalists,
  NPCFaction.MarsIndependence,
  NPCFaction.CorporateInterests,
] as const;

export interface NPC {
  id: string;
  name: string;
  faction: NPCFaction;
  /** Base cost multiplier for lobbying this NPC (1.0 = normal, 2.0 = expensive) */
  influence: number;
}

/** Project types align with factions */
export type ProjectType = NPCFaction;

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  /** Resource cost to propose this project */
  proposalCost: ResourceDelta;
  /** Effects applied if project passes */
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}

export interface ActiveProject {
  projectId: string;
  /** NPC id -> support level (-1 to +1) */
  supportLevels: Map<string, number>;
  /** Sols remaining before vote */
  solsRemaining: number;
}

export interface Council {
  id: string;
  name: string;
  /** NPC ids that are members */
  memberIds: string[];
  /** Relationship boost applied between members */
  relationshipBoost: number;
}

/**
 * Represents a demand from a faction to propose one of their projects.
 */
export interface FactionDemand {
  /** Which faction is making the demand */
  factionId: NPCFaction;
  /** Sol when the demand was issued */
  demandedAt: number;
  /** Sols remaining until demand expires (accelerated decay begins) */
  deadline: number;
  /** Project IDs that would satisfy this demand */
  projectIds: string[];
}
