import type { BuildingId } from "./Building.js";
import type { ResourceDelta, Resources } from "./Resources.js";
import type { TechnologyId } from "./Technology.js";

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
 * Position on the three ideology axes.
 * Each value ranges from -1.0 to +1.0.
 */
export interface AxisPosition {
  /** Individualist (-1) ↔ Collectivist (+1) */
  solidarity: number;
  /** Earth-tied (-1) ↔ Mars-sovereign (+1) */
  sovereignty: number;
  /** Preservationist (-1) ↔ Revolutionary (+1) */
  transformation: number;
}

/**
 * Runtime state of a political faction.
 * Factions drift along axes based on colony conditions.
 */
export interface FactionState {
  /** Current unique identifier (changes on faction rebirth) */
  id: string;
  /** Starting faction identity (earth_loyalists, mars_independence, corporate_interests) */
  baseId: NPCFaction;
  /** Current display name (changes when crossing axis thresholds) */
  name: string;
  /** Current axis positions (-1 to +1 per axis) */
  position: AxisPosition;
  /** Accumulated pressure from colony conditions (-1 to +1 per axis) */
  pressure: AxisPosition;
}

/** The three axis keys for iteration */
export const AXIS_KEYS: readonly (keyof AxisPosition)[] = [
  "solidarity",
  "sovereignty",
  "transformation",
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
  // Existing projects (kept for backwards compatibility)
  IMMIGRATION_PROGRAM = "immigration_program",
  EARTH_MEMORIAL = "earth_memorial",
  HERITAGE_ARCHIVE = "heritage_archive",
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  DEMOCRATIC_ASSEMBLY = "democratic_assembly",
  VENTURE_CAPITAL_INITIATIVE = "venture_capital_initiative",
  ORBITAL_INFRASTRUCTURE = "orbital_infrastructure",
  ASTEROID_SURVEY_PROGRAM = "asteroid_survey_program",
  // New axis-gated projects
  PRIVATE_MINING_CONTRACTS = "private_mining_contracts",
  GENETIC_ADAPTATION_PROGRAM = "genetic_adaptation_program",
  MARS_NATIONALISM_CHARTER = "mars_nationalism_charter",
  TRANSHUMAN_RESEARCH_INITIATIVE = "transhuman_research_initiative",
  // Capstone projects (axis-gated megastructures)
  EARTH_RELIEF_COMPACT = "earth_relief_compact",
  DECLARATION_OF_SOVEREIGNTY = "declaration_of_sovereignty",
  DEEP_SPACE_MINING_CHARTER = "deep_space_mining_charter",
  GENESIS_VAULT = "genesis_vault",
}

/** All project IDs as an array for iteration */
export const ALL_PROJECT_IDS: readonly ProjectId[] = [
  // Existing projects
  ProjectId.IMMIGRATION_PROGRAM,
  ProjectId.EARTH_MEMORIAL,
  ProjectId.HERITAGE_ARCHIVE,
  ProjectId.UNIVERSAL_HOUSING,
  ProjectId.HEALTHCARE_EXPANSION,
  ProjectId.DEMOCRATIC_ASSEMBLY,
  ProjectId.VENTURE_CAPITAL_INITIATIVE,
  ProjectId.ORBITAL_INFRASTRUCTURE,
  ProjectId.ASTEROID_SURVEY_PROGRAM,
  // New axis-gated projects
  ProjectId.PRIVATE_MINING_CONTRACTS,
  ProjectId.GENETIC_ADAPTATION_PROGRAM,
  ProjectId.MARS_NATIONALISM_CHARTER,
  ProjectId.TRANSHUMAN_RESEARCH_INITIATIVE,
  // Capstones
  ProjectId.EARTH_RELIEF_COMPACT,
  ProjectId.DECLARATION_OF_SOVEREIGNTY,
  ProjectId.DEEP_SPACE_MINING_CHARTER,
  ProjectId.GENESIS_VAULT,
] as const;

/**
 * Types of requirements that must be met before a project can be proposed.
 */
export enum ProjectRequirementType {
  TECHNOLOGY = "technology",
  BUILDING = "building",
  POPULATION = "population",
  RESOURCE = "resource",
}

/**
 * A requirement that must be met before a project can be proposed.
 * Discriminated union based on requirement type.
 */
export type ProjectRequirement =
  | { type: ProjectRequirementType.TECHNOLOGY; techId: TechnologyId }
  | { type: ProjectRequirementType.BUILDING; buildingId: BuildingId; count?: number }
  | { type: ProjectRequirementType.POPULATION; min: number }
  | { type: ProjectRequirementType.RESOURCE; resource: keyof Resources; min: number };

export interface NPC {
  id: NPCId;
  name: string;
  faction: NPCFaction;
  /** Base cost multiplier for lobbying this NPC (1.0 = normal, 2.0 = expensive) */
  influence: number;
}

/**
 * Axis requirement for a project: faction must meet min/max thresholds on specific axes.
 */
export interface AxisRequirement {
  min?: number;
  max?: number;
}

export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  /** Axis position requirements for a faction to champion this project */
  axisRequirements?: Partial<Record<keyof AxisPosition, AxisRequirement>>;
  /** Resource cost to propose this project */
  proposalCost: ResourceDelta;
  /** Requirements that must be met before this project can be proposed */
  requirements?: ProjectRequirement[];
  /** Effects applied if project passes */
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
    /** Morale boost for colonists who support this faction (added to base effect) */
    supporterMoraleBoost?: number;
    /** Conviction boost for colonists who support this faction (added to base effect) */
    supporterConvictionBoost?: number;
    /** Colony-wide morale boost (applies to all colonists) */
    colonyMoraleBoost?: number;
    /** Immediate population bonus (new colonists) */
    populationBonus?: number;
    /** Production multiplier bonus (e.g., 0.1 = +10% production) */
    productionBonus?: number;
    /** Food production bonus per sol */
    foodBonus?: number;
    /** Materials production bonus per sol */
    materialsBonus?: number;
  };
  /** Effects activated when this project completes (future implementation) */
  onCompletionEffects?: ProjectEffect[];
  /** True if this is a capstone victory project */
  isCapstone?: boolean;
  /** Projects that must be completed before this can be proposed */
  prerequisites?: ProjectId[];
  /** Required council support to propose capstone (0-1) */
  requiredCouncilSupport?: number;
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

/**
 * Effect types that can be activated when a project completes.
 * Each effect type has specific parameters controlling its behavior.
 */
export enum ProjectEffectType {
  /** Modifies ideology distribution of new colonists from immigration events */
  IMMIGRATION_IDEOLOGY_BIAS = "immigration_ideology_bias",
  /** Schedules a recurring event to fire at regular intervals */
  RECURRING_EVENT = "recurring_event",
  /** Modifies production output for a specific resource */
  PRODUCTION_MODIFIER = "production_modifier",
  /** Boosts conviction gain for a specific faction */
  CONVICTION_BOOST = "conviction_boost",
}

/**
 * An effect that is activated when a project completes.
 * Effects are processed by the game systems but the actual implementation
 * is handled elsewhere - this is just the data definition.
 */
export interface ProjectEffect {
  /** The type of effect to apply */
  type: ProjectEffectType;
  /** Human-readable name for display */
  name: string;
  /** Description of what this effect does */
  description: string;
  /** Effect-specific parameters */
  params: ProjectEffectParams;
}

/**
 * Union type of all possible effect parameter objects.
 */
export type ProjectEffectParams =
  | ImmigrationIdeologyBiasParams
  | RecurringEventParams
  | ProductionModifierParams
  | ConvictionBoostParams;

/**
 * Parameters for IMMIGRATION_IDEOLOGY_BIAS effect.
 * Biases the ideology of new colonists arriving through immigration events.
 */
export interface ImmigrationIdeologyBiasParams {
  /** Which faction's ideology to bias toward */
  faction: NPCFaction;
  /** Strength of the bias (0-1, where 1 is maximum bias) */
  strength: number;
}

/**
 * Parameters for RECURRING_EVENT effect.
 * Schedules an event to fire at regular intervals.
 */
export interface RecurringEventParams {
  /** The type of event to trigger */
  eventType: string;
  /** How often the event fires (in sols) */
  intervalSols: number;
  /** Additional parameters passed to the event */
  params?: Record<string, unknown>;
}

/**
 * Parameters for PRODUCTION_MODIFIER effect.
 * Modifies production output for a specific resource.
 */
export interface ProductionModifierParams {
  /** Which resource production to modify */
  resource: "food" | "water" | "materials" | "power";
  /** Amount to add to production (can be negative) */
  amount: number;
}

/**
 * Parameters for CONVICTION_BOOST effect.
 * Boosts conviction gain for colonists of a specific faction.
 */
export interface ConvictionBoostParams {
  /** Which faction's conviction to boost */
  faction: NPCFaction;
  /** Amount to add to conviction gain rate */
  amount: number;
}
