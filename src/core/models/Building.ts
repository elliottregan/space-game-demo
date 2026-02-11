import type { ColonistRole } from "./Colonist";
import type { ProjectId } from "./NPCInfluence";
import type { ResourceDelta } from "./Resources";
import type { TechnologyId } from "./Technology";

export enum BuildingId {
  SOLAR_PANEL = "solar_panel",
  WATER_EXTRACTOR = "water_extractor",
  BASIC_FARM = "basic_farm",
  BASIC_MINE = "basic_mine",

  GREENHOUSE = "greenhouse",
  WATER_RECLAIMER = "water_reclaimer",
  RESEARCH_LAB = "research_lab",
  AUTOMATED_FACTORY = "automated_factory",
  FABRICATOR_3D = "fabricator_3d",
  MINING_STATION = "mining_station",
  NUCLEAR_REACTOR = "nuclear_reactor",
  BIOLAB = "biolab",
  MEDICAL_CENTER = "medical_center",
  CRYO_FACILITY = "cryo_facility",
  COMMON_ROOM = "common_room",
  GYMNASIUM = "gymnasium",
  HYDROPONIC_GARDEN = "hydroponic_garden",
  OBSERVATORY_DOME = "observatory_dome",
  ASSEMBLY_HALL = "assembly_hall",
  SCIENCE_STATION = "science_station",
  BROADCASTING_STATION = "broadcasting_station",
  ACADEMY = "academy",
  HERITAGE_MUSEUM = "heritage_museum",
  // Victory megastructures
  ASTEROID_MINING_PLATFORM = "asteroid_mining_platform",
  UNITED_MARS_STATION = "united_mars_station",
  SPACE_ELEVATOR = "space_elevator",
  GENESIS_ARK = "genesis_ark",
}

export enum BuildingPurpose {
  Residential = "residential",
  Industrial = "industrial",
  Social = "social",
}

export type BuildingStatus = "pending" | "active" | "disabled" | "idle" | "recycling" | "upgrading";

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  cost: ResourceDelta;
  constructionTime: number;
  production?: ResourceDelta;
  consumption?: ResourceDelta;
  /** Power produced per sol (for power generation buildings) */
  powerProduction?: number;
  /** Power consumed per sol (for most buildings) */
  powerConsumption?: number;
  workerSlots?: number;
  workerRole?: ColonistRole;
  requiredTech?: TechnologyId;
  requiresDeposit?: boolean; // true for mining buildings
  repurposeTargets?: readonly BuildingId[];
  moraleBoost?: number; // Passive morale boost when active
  capacity?: number; // Housing capacity for habitats
  lifeSupportCapacity?: number; // Life support capacity provided (residential buildings)
  lifeSupportLoad?: number; // Life support load imposed (industrial buildings)
  purpose?: BuildingPurpose;
  bondingStrength?: number; // Multiplier for relationship growth rate (default 1.0)
  requiredProject?: ProjectId; // Project that must be passed to unlock
  isVictoryBuilding?: boolean; // Completing this building wins the game
  /** Research output per sol when active (for research buildings) */
  researchOutput?: number;
  /** Passive pressure on ideology axes when building is active */
  axisPressure?: Partial<Record<"solidarity" | "sovereignty" | "transformation", number>>;
}

export interface Building {
  id: string;
  definitionId: BuildingId;
  status: BuildingStatus;
  constructionProgress: number;
  assignedWorkers: string[];
  mode: "conservation" | "normal" | "overdrive";
  broken: boolean;
  repairProgress: number;
  depositId?: string; // linked deposit for mining buildings
  recyclingProgress?: number;
  repurposeFromDefId?: BuildingId; // Set when repurposing, cleared when complete
  upgradeProgress?: number;
  upgradeTargetDefId?: BuildingId;
}

/**
 * PlacedBuilding is a UI-oriented representation that combines a Building instance
 * with its BuildingDefinition template for convenient display in components.
 */
export interface PlacedBuilding {
  id: string;
  template: BuildingDefinition;
  workers?: number;
  constructionProgress?: {
    current: number;
    required: number;
  };
}
