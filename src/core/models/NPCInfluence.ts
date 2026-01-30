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

/**
 * NPC identifiers for the 10 council members.
 * Using a string enum for type safety while maintaining string serialization.
 */
export enum NPCId {
  CHEN_WEI = "chen_wei",
  NOVA_SILVA = "nova_silva",
  ALEX_OKONKWO = "alex_okonkwo",
  MARIA_SANTOS = "maria_santos",
  JAMES_LIU = "james_liu",
  AISHA_PATEL = "aisha_patel",
  MARCUS_REED = "marcus_reed",
  ELENA_VOLKOV = "elena_volkov",
  DAVID_MORRISON = "david_morrison",
  SARAH_CHEN = "sarah_chen",
}

/** All NPC IDs as an array for iteration */
export const ALL_NPC_IDS: readonly NPCId[] = [
  NPCId.CHEN_WEI,
  NPCId.NOVA_SILVA,
  NPCId.ALEX_OKONKWO,
  NPCId.MARIA_SANTOS,
  NPCId.JAMES_LIU,
  NPCId.AISHA_PATEL,
  NPCId.MARCUS_REED,
  NPCId.ELENA_VOLKOV,
  NPCId.DAVID_MORRISON,
  NPCId.SARAH_CHEN,
] as const;

/**
 * Project identifiers for political proposals.
 * Using a string enum for type safety while maintaining string serialization.
 */
export enum ProjectId {
  GENERATION_SHIP = "generation_ship",
  EARTH_MEMORIAL = "earth_memorial",
  HERITAGE_ARCHIVE = "heritage_archive",
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  AI_GOVERNANCE = "ai_governance",
  MINING_CONCESSION = "mining_concession",
  LABOR_EFFICIENCY = "labor_efficiency",
}

/** All project IDs as an array for iteration */
export const ALL_PROJECT_IDS: readonly ProjectId[] = [
  ProjectId.GENERATION_SHIP,
  ProjectId.EARTH_MEMORIAL,
  ProjectId.HERITAGE_ARCHIVE,
  ProjectId.UNIVERSAL_HOUSING,
  ProjectId.HEALTHCARE_EXPANSION,
  ProjectId.AI_GOVERNANCE,
  ProjectId.MINING_CONCESSION,
  ProjectId.LABOR_EFFICIENCY,
] as const;

export interface NPC {
  id: NPCId;
  name: string;
  faction: NPCFaction;
  /** Base cost multiplier for lobbying this NPC (1.0 = normal, 2.0 = expensive) */
  influence: number;
}

/** Project types align with factions */
export type ProjectType = NPCFaction;

export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  type: ProjectType;
  /** Resource cost to propose this project */
  proposalCost: ResourceDelta;
  /** Required faction support level to propose (0-1) */
  requiredSupport: number;
  /** Effects applied if project passes */
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}

export interface ActiveProject {
  projectId: ProjectId;
  /** NPC id -> support level (-1 to +1) */
  supportLevels: Map<NPCId, number>;
  /** Sols remaining before vote */
  solsRemaining: number;
}

export interface Council {
  id: string;
  name: string;
  /** NPC ids that are members */
  memberIds: NPCId[];
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
  projectIds: ProjectId[];
}

/**
 * Represents a disconnection event between two NPCs in the political network.
 */
export interface NetworkDisconnection {
  /** NPC who lost influence over the other */
  sourceId: NPCId;
  /** NPC who is no longer influenced by the source */
  targetId: NPCId;
  /** Sol when the disconnection occurred */
  occurredAt: number;
  /** The relationship weight before disconnection */
  previousWeight: number;
}

/**
 * Represents a connected component (group) of NPCs in the political network.
 */
export interface NetworkComponent {
  /** NPCs in this connected component */
  memberIds: NPCId[];
  /** Factions represented in this component */
  factions: NPCFaction[];
}

/**
 * Tracks the last interaction between two NPCs for relationship maintenance.
 */
export interface RelationshipInteraction {
  /** Sol when the last meaningful interaction occurred */
  lastInteractionSol: number;
  /** Type of the last interaction */
  interactionType: InteractionType;
}

/**
 * Types of interactions that can refresh relationship maintenance.
 */
export enum InteractionType {
  /** NPCs voted on the same side of a project */
  SHARED_VOTE = "shared_vote",
  /** NPCs joined the same council */
  COUNCIL_MEMBERSHIP = "council_membership",
  /** One NPC lobbied in favor of the other's position */
  LOBBYING = "lobbying",
  /** Connection formed through triadic closure */
  TRIADIC_CLOSURE = "triadic_closure",
  /** Initial relationship from game start */
  INITIAL = "initial",
}

/**
 * Represents a new connection formed through triadic closure.
 */
export interface TriadicClosureEvent {
  /** NPC A who now has a new connection */
  npcA: NPCId;
  /** NPC C who A is now connected to */
  npcC: NPCId;
  /** NPC B who bridged the connection */
  bridgeNpc: NPCId;
  /** Sol when the closure occurred */
  occurredAt: number;
  /** Initial weight of the new connection */
  initialWeight: number;
}
