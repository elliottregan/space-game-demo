import type { AxisPosition, AxisRequirement } from "./NPCInfluence";
import type { ResourceDelta } from "./Resources";
import type { GrantSourceId } from "./Grant";

// ============ Grant Category ============

export enum DistrictGrantCategory {
  IDENTITY = "identity",
  INFRASTRUCTURE = "infrastructure",
}

// ============ Grant Template ID ============

export enum DistrictGrantId {
  // --- Identity Grants: Collectivist (solidarity >= +0.3) ---
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  DEMOCRATIC_ASSEMBLY = "democratic_assembly",

  // --- Identity Grants: Preservationist (transformation <= -0.3) ---
  HERITAGE_ARCHIVE = "heritage_archive",
  EARTH_MEMORIAL = "earth_memorial",

  // --- Identity Grants: Earth-tied (sovereignty <= -0.3) ---
  IMMIGRATION_PROGRAM = "immigration_program",

  // --- Identity Grants: Individualist (solidarity <= -0.3) ---
  VENTURE_CAPITAL_INITIATIVE = "venture_capital_initiative",
  PRIVATE_MINING_CONTRACTS = "private_mining_contracts",
  ORBITAL_INFRASTRUCTURE = "orbital_infrastructure",
  ASTEROID_SURVEY_PROGRAM = "asteroid_survey_program",

  // --- Identity Grants: Mars-sovereign (sovereignty >= +0.5) ---
  GENETIC_ADAPTATION_PROGRAM = "genetic_adaptation_program",

  // --- Identity Grants: Multi-axis ---
  MARS_NATIONALISM_CHARTER = "mars_nationalism_charter",
  TRANSHUMAN_RESEARCH_INITIATIVE = "transhuman_research_initiative",

  // --- Capstone Identity Grants ---
  DECLARATION_OF_SOVEREIGNTY = "declaration_of_sovereignty",
  EARTH_RELIEF_COMPACT = "earth_relief_compact",
  DEEP_SPACE_MINING_CHARTER = "deep_space_mining_charter",
  GENESIS_VAULT = "genesis_vault",

  // --- Infrastructure Grants: Helios Mining Corp ---
  MINERAL_SHIPMENT = "mineral_shipment",
  EXTRACTION_TECH = "extraction_tech",
  MINING_SUBSIDY = "mining_subsidy",

  // --- Infrastructure Grants: Earth Science Council ---
  RESEARCH_GRANT = "research_grant",
  SCIENCE_EQUIPMENT = "science_equipment",
  DATA_SHARING = "data_sharing",

  // --- Infrastructure Grants: Mars Heritage Foundation ---
  CULTURAL_FUND = "cultural_fund",
  PRESERVATION_GRANT = "preservation_grant",
  HERITAGE_MATERIALS = "heritage_materials",

  // --- Infrastructure Grants: Immigration Bureau ---
  SETTLER_WAVE = "settler_wave",
  HOUSING_AID = "housing_aid",
  INTEGRATION_FUND = "integration_fund",

  // --- Infrastructure Grants: Autonomous Collective ---
  COMMUNITY_GRANT = "community_grant",
  COOPERATIVE_TECH = "cooperative_tech",
  FOOD_AID = "food_aid",
}

// ============ Grant Effect ============

export interface DistrictGrantEffect {
  // District-scoped effects
  capacityBoost?: number;
  productionBonus?: { resource: "food" | "water" | "materials"; amount: number };
  researchBonus?: number;
  buildingCostReduction?: number;
  healthBonus?: number;
  xpBonus?: number;
  powerEfficiency?: number;

  // Colony-wide effects (identity grants)
  unlockBuilding?: string;
  unlockTech?: string;
  colonyMoraleBoost?: number;
  populationBonus?: number;
  supporterConvictionBoost?: number;
  materialsBonus?: number;
  foodBonus?: number;
}

// ============ Grant Template ============

export interface DistrictGrantTemplate {
  id: DistrictGrantId;
  category: DistrictGrantCategory;
  name: string;
  description: string;

  // Identity grants only: faction axis requirements
  axisRequirements?: Partial<Record<keyof AxisPosition, AxisRequirement>>;

  // Infrastructure grants only: external source
  sourceId?: GrantSourceId;

  // Shared
  cost: ResourceDelta;
  baseDuration: number;
  effect: DistrictGrantEffect;
  ideologyShift?: Partial<AxisPosition>;
  identityTag: string;
  minSol: number;
  weight: number;

  // Victory path (identity grants only)
  isCapstone?: boolean;
  prerequisites?: DistrictGrantId[];
  victoryProgress?: number;
}

// ============ Active Grant ============

export interface ActiveDistrictGrant {
  id: number;
  templateId: DistrictGrantId;
  districtId: string;
  assignedSol: number;
  remainingSols: number;
  totalDuration: number;
}

// ============ Available Grant (Panel Card) ============

export interface AvailableDistrictGrant {
  id: number;
  templateId: DistrictGrantId;
  drawnSol: number;
}

// ============ District Identity ============

export interface DistrictIdentity {
  completedGrantIds: DistrictGrantId[];
  tags: string[];
  title: string | null;
}

// ============ Grant Eligibility ============

export interface GrantEligibility {
  canAssign: boolean;
  reason?: string;
  estimatedDuration?: number;
}

// ============ Identity Title Mapping ============

export const IDENTITY_TITLES: Record<string, string> = {
  collectivist: "Workers' Quarter",
  individualist: "Free Enterprise District",
  sovereign: "Independence Quarter",
  earthtied: "Embassy District",
  preservationist: "Heritage Precinct",
  revolutionary: "Innovation Quarter",
  mining: "Mining Hub",
  research: "Research Campus",
  agriculture: "Agri-District",
  housing: "Residential Quarter",
};

export const GRAND_IDENTITY_TITLES: Record<string, string> = {
  collectivist: "Grand Workers' Quarter",
  individualist: "Grand Enterprise District",
  sovereign: "Grand Independence Quarter",
  earthtied: "Grand Embassy District",
  preservationist: "Grand Heritage Precinct",
  revolutionary: "Grand Innovation Quarter",
  mining: "Grand Mining Hub",
  research: "Grand Research Campus",
  agriculture: "Grand Agri-District",
  housing: "Grand Residential Quarter",
};
