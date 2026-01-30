import type { ColonistRole } from "./Colonist";
import type { ResourceDelta } from "./Resources";
import type { TechnologyId } from "./Technology";

export enum BuildingId {
  HABITAT = "habitat",
  SOLAR_PANEL = "solar_panel",
  WATER_EXTRACTOR = "water_extractor",
  STORAGE_DEPOT = "storage_depot",
  BASIC_FARM = "basic_farm",
  BASIC_MINE = "basic_mine",
  OXYGEN_GENERATOR = "oxygen_generator",
  GREENHOUSE = "greenhouse",
  WATER_RECLAIMER = "water_reclaimer",
  RESEARCH_LAB = "research_lab",
  ADVANCED_HABITAT = "advanced_habitat",
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
}

export enum BuildingPurpose {
  Residential = "residential",
  Industrial = "industrial",
  Social = "social",
}

export type BuildingStatus = "pending" | "active" | "disabled" | "idle" | "recycling";

export interface BuildingDefinition {
  id: BuildingId;
  name: string;
  description: string;
  cost: ResourceDelta;
  constructionTime: number;
  production?: ResourceDelta;
  consumption?: ResourceDelta;
  workerSlots?: number;
  workerRole?: ColonistRole;
  requiredTech?: TechnologyId;
  requiresDeposit?: boolean; // true for mining buildings
  repurposeTargets?: readonly BuildingId[];
  moraleBoost?: number; // Passive morale boost when active
  capacity?: number; // Housing capacity for habitats
  oxygenContribution?: number; // Oxygen units contributed per sol when active
  purpose?: BuildingPurpose;
  bondingStrength?: number; // Multiplier for relationship growth rate (default 1.0)
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
