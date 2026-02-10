import type { AxisPosition } from "./NPCInfluence";

// ============ Grant Source IDs ============

export enum GrantSourceId {
  HELIOS_MINING = "helios_mining",
  EARTH_SCIENCE_COUNCIL = "earth_science_council",
  MARS_HERITAGE = "mars_heritage",
  IMMIGRATION_BUREAU = "immigration_bureau",
  AUTONOMOUS_COLLECTIVE = "autonomous_collective",
}

// ============ Grant Template IDs ============

export enum GrantTemplateId {
  // Helios Mining Corp
  MINERAL_SHIPMENT = "mineral_shipment",
  EXTRACTION_TECH = "extraction_tech",
  MINING_SUBSIDY = "mining_subsidy",
  // Earth Science Council
  RESEARCH_GRANT = "research_grant",
  SCIENCE_EQUIPMENT = "science_equipment",
  DATA_SHARING = "data_sharing",
  // Mars Heritage Foundation
  CULTURAL_FUND = "cultural_fund",
  PRESERVATION_GRANT = "preservation_grant",
  HERITAGE_MATERIALS = "heritage_materials",
  // Immigration Bureau
  SETTLER_WAVE = "settler_wave",
  HOUSING_AID = "housing_aid",
  INTEGRATION_FUND = "integration_fund",
  // Autonomous Collective
  COMMUNITY_GRANT = "community_grant",
  COOPERATIVE_TECH = "cooperative_tech",
  FOOD_AID = "food_aid",
}

// ============ Interfaces ============

export interface GrantSource {
  id: GrantSourceId;
  name: string;
  description: string;
  ideologyPosition: AxisPosition;
}

export interface GrantEffect {
  type: "instant" | "timed";
  resources?: { food?: number; water?: number; materials?: number };
  population?: number;
  capacityBoost?: number;
  productionBonus?: { resource: "food" | "water" | "materials"; multiplier: number };
  researchBonus?: number;
  duration?: number;
}

export interface GrantTemplate {
  id: GrantTemplateId;
  sourceId: GrantSourceId;
  name: string;
  description: string;
  effect: GrantEffect;
  ideologyMagnitude: number;
  minSol: number;
  weight: number;
}

export interface AvailableGrant {
  id: number;
  templateId: GrantTemplateId;
  sourceId: GrantSourceId;
  offeredSol: number;
}

export interface ActiveGrant {
  id: number;
  templateId: GrantTemplateId;
  sourceId: GrantSourceId;
  districtId: string;
  assignedSol: number;
  remainingSols?: number;
}
