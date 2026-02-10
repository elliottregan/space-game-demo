import {
  GrantSourceId,
  GrantTemplateId,
  type GrantSource,
  type GrantTemplate,
} from "../models/Grant";

// ============ Grant Sources ============

export const GRANT_SOURCES: readonly GrantSource[] = [
  {
    id: GrantSourceId.HELIOS_MINING,
    name: "Helios Mining Corp",
    description: "Interplanetary mining conglomerate seeking Martian resource rights",
    ideologyPosition: { solidarity: -0.5, sovereignty: 0.0, transformation: 0.3 },
  },
  {
    id: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    name: "Earth Science Council",
    description: "Academic coalition funding Mars research for Earth's benefit",
    ideologyPosition: { solidarity: 0.0, sovereignty: -0.4, transformation: 0.5 },
  },
  {
    id: GrantSourceId.MARS_HERITAGE,
    name: "Mars Heritage Foundation",
    description: "Cultural preservation group dedicated to Martian identity",
    ideologyPosition: { solidarity: 0.0, sovereignty: 0.4, transformation: -0.5 },
  },
  {
    id: GrantSourceId.IMMIGRATION_BUREAU,
    name: "Immigration Bureau",
    description: "Earth-Mars transit authority managing colonial settlement",
    ideologyPosition: { solidarity: 0.4, sovereignty: -0.4, transformation: 0.0 },
  },
  {
    id: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    name: "Autonomous Collective",
    description: "Decentralized mutual aid network supporting colony self-governance",
    ideologyPosition: { solidarity: 0.5, sovereignty: 0.3, transformation: 0.0 },
  },
];

// ============ Grant Templates ============

export const GRANT_TEMPLATES: readonly GrantTemplate[] = [
  // --- Helios Mining Corp ---
  {
    id: GrantTemplateId.MINERAL_SHIPMENT,
    sourceId: GrantSourceId.HELIOS_MINING,
    name: "Mineral Shipment",
    description: "Bulk materials delivered by Helios orbital freighter",
    effect: { type: "instant", resources: { materials: 120 } },
    ideologyMagnitude: 1.0,
    minSol: 15,
    weight: 3,
  },
  {
    id: GrantTemplateId.EXTRACTION_TECH,
    sourceId: GrantSourceId.HELIOS_MINING,
    name: "Extraction Technology Transfer",
    description: "Helios shares proprietary mining techniques (+3 materials/sol for 30 sols)",
    effect: {
      type: "timed",
      productionBonus: { resource: "materials", multiplier: 3 },
      duration: 30,
    },
    ideologyMagnitude: 1.2,
    minSol: 40,
    weight: 2,
  },
  {
    id: GrantTemplateId.MINING_SUBSIDY,
    sourceId: GrantSourceId.HELIOS_MINING,
    name: "Mining Subsidy",
    description: "Corporate subsidy for materials infrastructure (+2 materials/sol for 50 sols)",
    effect: {
      type: "timed",
      productionBonus: { resource: "materials", multiplier: 2 },
      duration: 50,
    },
    ideologyMagnitude: 0.8,
    minSol: 25,
    weight: 2,
  },

  // --- Earth Science Council ---
  {
    id: GrantTemplateId.RESEARCH_GRANT,
    sourceId: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    name: "Research Grant",
    description:
      "Funding and data from Earth accelerates current research (+5 research/sol for 25 sols)",
    effect: { type: "timed", researchBonus: 5, duration: 25 },
    ideologyMagnitude: 1.0,
    minSol: 20,
    weight: 3,
  },
  {
    id: GrantTemplateId.SCIENCE_EQUIPMENT,
    sourceId: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    name: "Scientific Equipment Drop",
    description: "Lab equipment and materials from the Council",
    effect: { type: "instant", resources: { materials: 80 } },
    ideologyMagnitude: 0.8,
    minSol: 15,
    weight: 2,
  },
  {
    id: GrantTemplateId.DATA_SHARING,
    sourceId: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    name: "Data Sharing Agreement",
    description:
      "Joint research program boosts colony research output (+3 research/sol for 40 sols)",
    effect: { type: "timed", researchBonus: 3, duration: 40 },
    ideologyMagnitude: 1.2,
    minSol: 50,
    weight: 2,
  },

  // --- Mars Heritage Foundation ---
  {
    id: GrantTemplateId.CULTURAL_FUND,
    sourceId: GrantSourceId.MARS_HERITAGE,
    name: "Cultural Preservation Fund",
    description: "Heritage fund provides food and water for traditional practices",
    effect: { type: "instant", resources: { food: 60, water: 40 } },
    ideologyMagnitude: 1.0,
    minSol: 15,
    weight: 3,
  },
  {
    id: GrantTemplateId.PRESERVATION_GRANT,
    sourceId: GrantSourceId.MARS_HERITAGE,
    name: "Preservation Grant",
    description: "Steady food supply from heritage agricultural methods (+2 food/sol for 40 sols)",
    effect: {
      type: "timed",
      productionBonus: { resource: "food", multiplier: 2 },
      duration: 40,
    },
    ideologyMagnitude: 1.2,
    minSol: 30,
    weight: 2,
  },
  {
    id: GrantTemplateId.HERITAGE_MATERIALS,
    sourceId: GrantSourceId.MARS_HERITAGE,
    name: "Heritage Building Materials",
    description: "Traditional construction materials from Foundation stores",
    effect: { type: "instant", resources: { materials: 80 } },
    ideologyMagnitude: 0.8,
    minSol: 20,
    weight: 2,
  },

  // --- Immigration Bureau ---
  {
    id: GrantTemplateId.SETTLER_WAVE,
    sourceId: GrantSourceId.IMMIGRATION_BUREAU,
    name: "Sponsored Settler Wave",
    description: "Bureau-funded colonists arrive ready to work",
    effect: { type: "instant", population: 3 },
    ideologyMagnitude: 1.2,
    minSol: 30,
    weight: 2,
  },
  {
    id: GrantTemplateId.HOUSING_AID,
    sourceId: GrantSourceId.IMMIGRATION_BUREAU,
    name: "Housing Development Aid",
    description: "Pre-fabricated housing modules increase district capacity",
    effect: { type: "instant", capacityBoost: 8 },
    ideologyMagnitude: 1.0,
    minSol: 20,
    weight: 3,
  },
  {
    id: GrantTemplateId.INTEGRATION_FUND,
    sourceId: GrantSourceId.IMMIGRATION_BUREAU,
    name: "Integration Support Fund",
    description: "Resources for settling new arrivals into the community",
    effect: { type: "instant", resources: { food: 40, water: 30, materials: 30 } },
    ideologyMagnitude: 0.8,
    minSol: 15,
    weight: 2,
  },

  // --- Autonomous Collective ---
  {
    id: GrantTemplateId.COMMUNITY_GRANT,
    sourceId: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    name: "Community Solidarity Grant",
    description: "Mutual aid network shares food and water with your colony",
    effect: { type: "instant", resources: { food: 50, water: 50 } },
    ideologyMagnitude: 1.0,
    minSol: 15,
    weight: 3,
  },
  {
    id: GrantTemplateId.COOPERATIVE_TECH,
    sourceId: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    name: "Cooperative Technology Package",
    description: "Shared agricultural tech boosts food production (+2 food/sol for 35 sols)",
    effect: {
      type: "timed",
      productionBonus: { resource: "food", multiplier: 2 },
      duration: 35,
    },
    ideologyMagnitude: 1.2,
    minSol: 30,
    weight: 2,
  },
  {
    id: GrantTemplateId.FOOD_AID,
    sourceId: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    name: "Emergency Food Aid",
    description: "Collective pooled resources for colony sustenance",
    effect: { type: "instant", resources: { food: 80 } },
    ideologyMagnitude: 0.8,
    minSol: 15,
    weight: 2,
  },
];

// Helper lookups
export function getGrantSource(id: GrantSourceId): GrantSource | undefined {
  return GRANT_SOURCES.find((s) => s.id === id);
}

export function getGrantTemplate(id: GrantTemplateId): GrantTemplate | undefined {
  return GRANT_TEMPLATES.find((t) => t.id === id);
}
