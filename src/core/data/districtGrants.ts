import { BuildingId } from "../models/Building";
import {
  DistrictGrantCategory,
  DistrictGrantId,
  type DistrictGrantTemplate,
} from "../models/DistrictGrant";
import { GrantSourceId } from "../models/Grant";

// ============ Identity Grants (from projects.ts) ============

const IDENTITY_GRANTS: DistrictGrantTemplate[] = [
  // --- Collectivist (solidarity >= +0.3) ---
  {
    id: DistrictGrantId.UNIVERSAL_HOUSING,
    category: DistrictGrantCategory.IDENTITY,
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    axisRequirements: { solidarity: { min: 0.3 } },
    cost: { materials: 120 },
    baseDuration: 40,
    effect: {
      unlockBuilding: "housing_complex",
      colonyMoraleBoost: 0.08,
      supporterConvictionBoost: 0.05,
    },
    identityTag: "collectivist",
    minSol: 30,
    weight: 2,
    victoryProgress: 2,
  },
  {
    id: DistrictGrantId.HEALTHCARE_EXPANSION,
    category: DistrictGrantCategory.IDENTITY,
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access for all colonists.",
    axisRequirements: { solidarity: { min: 0.3 } },
    cost: { materials: 100, water: 40 },
    baseDuration: 35,
    effect: {
      unlockBuilding: "medical_center",
      colonyMoraleBoost: 0.05,
      supporterConvictionBoost: 0.05,
    },
    identityTag: "collectivist",
    minSol: 25,
    weight: 2,
    victoryProgress: 2,
  },
  {
    id: DistrictGrantId.DEMOCRATIC_ASSEMBLY,
    category: DistrictGrantCategory.IDENTITY,
    name: "Democratic Assembly",
    description:
      "Establish a formal democratic assembly where all colonists have a voice in governance.",
    axisRequirements: { solidarity: { min: 0.3 } },
    cost: { materials: 110 },
    baseDuration: 45,
    effect: {
      unlockBuilding: "assembly_hall",
      colonyMoraleBoost: 0.1,
      supporterConvictionBoost: 0.1,
    },
    identityTag: "collectivist",
    minSol: 40,
    weight: 2,
    victoryProgress: 2,
  },

  // --- Preservationist (transformation <= -0.3) ---
  {
    id: DistrictGrantId.HERITAGE_ARCHIVE,
    category: DistrictGrantCategory.IDENTITY,
    name: "Heritage Archive",
    description:
      "Preserve Earth's diverse cultures and traditions, helping immigrants feel at home on Mars.",
    axisRequirements: { transformation: { max: -0.3 } },
    cost: { materials: 100 },
    baseDuration: 35,
    effect: {
      unlockBuilding: "archive",
      supporterConvictionBoost: 0.08,
    },
    identityTag: "preservationist",
    minSol: 25,
    weight: 2,
    victoryProgress: 2,
  },
  {
    id: DistrictGrantId.EARTH_MEMORIAL,
    category: DistrictGrantCategory.IDENTITY,
    name: "Earth Memorial",
    description:
      "Build a memorial honoring the courage of those who left everything behind to start anew on Mars.",
    axisRequirements: { transformation: { max: -0.3 } },
    cost: { materials: 80 },
    baseDuration: 30,
    effect: {
      colonyMoraleBoost: 0.05,
      supporterConvictionBoost: 0.1,
    },
    identityTag: "preservationist",
    minSol: 20,
    weight: 3,
    victoryProgress: 1,
  },

  // --- Earth-tied (sovereignty <= -0.3) ---
  {
    id: DistrictGrantId.IMMIGRATION_PROGRAM,
    category: DistrictGrantCategory.IDENTITY,
    name: "Immigration Program",
    description: "Establish formal immigration pathways to bring more settlers from Earth.",
    axisRequirements: { sovereignty: { max: -0.3 } },
    cost: { materials: 120 },
    baseDuration: 40,
    effect: {
      unlockBuilding: "immigration_center",
      populationBonus: 3,
      supporterConvictionBoost: 0.05,
      materialsBonus: 5,
    },
    identityTag: "earthtied",
    minSol: 40,
    weight: 2,
    victoryProgress: 2,
  },

  // --- Individualist (solidarity <= -0.3) ---
  {
    id: DistrictGrantId.VENTURE_CAPITAL_INITIATIVE,
    category: DistrictGrantCategory.IDENTITY,
    name: "Venture Capital Initiative",
    description: "Establish investment channels to attract Earth capital for Martian expansion.",
    axisRequirements: { solidarity: { max: -0.3 } },
    cost: { materials: 80 },
    baseDuration: 30,
    effect: {
      materialsBonus: 2,
      supporterConvictionBoost: 0.1,
    },
    identityTag: "individualist",
    minSol: 20,
    weight: 3,
    victoryProgress: 1,
  },
  {
    id: DistrictGrantId.PRIVATE_MINING_CONTRACTS,
    category: DistrictGrantCategory.IDENTITY,
    name: "Private Mining Contracts",
    description:
      "Grant exclusive mining rights to private enterprises for faster resource extraction.",
    axisRequirements: { solidarity: { max: -0.3 } },
    cost: { materials: 90 },
    baseDuration: 35,
    effect: {
      materialsBonus: 3,
      supporterConvictionBoost: 0.08,
    },
    identityTag: "individualist",
    minSol: 25,
    weight: 2,
    victoryProgress: 1,
  },
  {
    id: DistrictGrantId.ORBITAL_INFRASTRUCTURE,
    category: DistrictGrantCategory.IDENTITY,
    name: "Orbital Infrastructure",
    description: "Build launch facilities and orbital stations to enable space-based operations.",
    axisRequirements: { solidarity: { max: -0.3 } },
    cost: { materials: 120 },
    baseDuration: 45,
    effect: {
      unlockBuilding: "launch_facility",
      supporterConvictionBoost: 0.08,
    },
    identityTag: "individualist",
    minSol: 40,
    weight: 2,
    victoryProgress: 2,
  },
  {
    id: DistrictGrantId.ASTEROID_SURVEY_PROGRAM,
    category: DistrictGrantCategory.IDENTITY,
    name: "Asteroid Survey Program",
    description: "Map and catalog near-Mars asteroids for their mineral wealth.",
    axisRequirements: { solidarity: { max: -0.3 } },
    cost: { materials: 100 },
    baseDuration: 40,
    effect: {
      unlockTech: "asteroid_prospecting",
      supporterConvictionBoost: 0.05,
    },
    identityTag: "individualist",
    minSol: 35,
    weight: 2,
    victoryProgress: 2,
  },

  // --- Revolutionary (transformation >= +0.5) ---
  {
    id: DistrictGrantId.GENETIC_ADAPTATION_PROGRAM,
    category: DistrictGrantCategory.IDENTITY,
    name: "Genetic Adaptation Program",
    description:
      "Fund research into modifying colonists for Mars gravity, radiation, and atmosphere.",
    axisRequirements: { transformation: { min: 0.5 } },
    cost: { materials: 130 },
    baseDuration: 45,
    effect: {
      colonyMoraleBoost: 0.05,
      supporterConvictionBoost: 0.1,
    },
    identityTag: "revolutionary",
    minSol: 40,
    weight: 2,
    victoryProgress: 2,
  },

  // --- Multi-axis ---
  {
    id: DistrictGrantId.MARS_NATIONALISM_CHARTER,
    category: DistrictGrantCategory.IDENTITY,
    name: "Mars Nationalism Charter",
    description:
      "Establish a charter preserving Martian identity while asserting sovereignty from Earth.",
    axisRequirements: { sovereignty: { min: 0.5 }, transformation: { max: -0.3 } },
    cost: { materials: 110 },
    baseDuration: 40,
    effect: {
      colonyMoraleBoost: 0.06,
      supporterConvictionBoost: 0.08,
    },
    identityTag: "sovereign",
    minSol: 50,
    weight: 1,
    victoryProgress: 2,
  },
  {
    id: DistrictGrantId.TRANSHUMAN_RESEARCH_INITIATIVE,
    category: DistrictGrantCategory.IDENTITY,
    name: "Transhuman Research Initiative",
    description:
      "Push the boundaries of human adaptation through radical biotech and cybernetic augmentation.",
    axisRequirements: { sovereignty: { min: 0.3 }, transformation: { min: 0.5 } },
    cost: { materials: 140 },
    baseDuration: 45,
    effect: {
      supporterConvictionBoost: 0.1,
    },
    identityTag: "revolutionary",
    minSol: 50,
    weight: 1,
    victoryProgress: 2,
  },

  // --- Capstone Victory Grants ---
  {
    id: DistrictGrantId.DECLARATION_OF_SOVEREIGNTY,
    category: DistrictGrantCategory.IDENTITY,
    name: "Declaration of Sovereignty",
    description: "Formally declare Mars an independent nation, free from Earth jurisdiction.",
    axisRequirements: { sovereignty: { min: 0.5 } },
    cost: { materials: 150 },
    baseDuration: 60,
    effect: { unlockBuilding: BuildingId.UNITED_MARS_STATION },
    isCapstone: true,
    prerequisites: [DistrictGrantId.UNIVERSAL_HOUSING, DistrictGrantId.DEMOCRATIC_ASSEMBLY],
    identityTag: "sovereign",
    minSol: 100,
    weight: 1,
    victoryProgress: 0,
  },
  {
    id: DistrictGrantId.EARTH_RELIEF_COMPACT,
    category: DistrictGrantCategory.IDENTITY,
    name: "Earth Relief Compact",
    description:
      "Sign a formal treaty committing Mars to relieve Earth's overpopulation crisis through sustained mass immigration.",
    axisRequirements: { sovereignty: { max: -0.6 }, solidarity: { min: 0.5 } },
    cost: {},
    baseDuration: 60,
    effect: { unlockBuilding: BuildingId.SPACE_ELEVATOR },
    isCapstone: true,
    prerequisites: [DistrictGrantId.EARTH_MEMORIAL, DistrictGrantId.HERITAGE_ARCHIVE],
    identityTag: "earthtied",
    minSol: 100,
    weight: 1,
    victoryProgress: 0,
  },
  {
    id: DistrictGrantId.DEEP_SPACE_MINING_CHARTER,
    category: DistrictGrantCategory.IDENTITY,
    name: "Deep Space Mining Charter",
    description:
      "Secure an official charter granting corporations exclusive rights to deep space mining operations.",
    axisRequirements: { solidarity: { max: -0.5 }, transformation: { min: 0.5 } },
    cost: {},
    baseDuration: 60,
    effect: { unlockBuilding: BuildingId.ASTEROID_MINING_PLATFORM },
    isCapstone: true,
    prerequisites: [
      DistrictGrantId.ORBITAL_INFRASTRUCTURE,
      DistrictGrantId.ASTEROID_SURVEY_PROGRAM,
    ],
    identityTag: "individualist",
    minSol: 100,
    weight: 1,
    victoryProgress: 0,
  },
  {
    id: DistrictGrantId.GENESIS_VAULT,
    category: DistrictGrantCategory.IDENTITY,
    name: "Genesis Vault",
    description:
      "Construct a massive biological archive preserving Earth's biodiversity for future generations on Mars.",
    axisRequirements: { transformation: { max: -0.6 }, solidarity: { min: 0.5 } },
    cost: {},
    baseDuration: 60,
    effect: {
      unlockBuilding: BuildingId.GENESIS_ARK,
      colonyMoraleBoost: 0.15,
    },
    isCapstone: true,
    prerequisites: [DistrictGrantId.HERITAGE_ARCHIVE, DistrictGrantId.HEALTHCARE_EXPANSION],
    identityTag: "preservationist",
    minSol: 100,
    weight: 1,
    victoryProgress: 0,
  },
];

// ============ Infrastructure Grants (from grants.ts) ============

const INFRASTRUCTURE_GRANTS: DistrictGrantTemplate[] = [
  // --- Helios Mining Corp ---
  {
    id: DistrictGrantId.MINERAL_SHIPMENT,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Mineral Shipment",
    description: "Bulk materials delivered by Helios orbital freighter",
    sourceId: GrantSourceId.HELIOS_MINING,
    cost: {},
    baseDuration: 5,
    effect: { productionBonus: { resource: "materials", amount: 3 } },
    ideologyShift: { solidarity: -0.03, transformation: 0.02 },
    identityTag: "mining",
    minSol: 15,
    weight: 3,
  },
  {
    id: DistrictGrantId.EXTRACTION_TECH,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Extraction Technology Transfer",
    description: "Helios shares proprietary mining techniques boosting local material output",
    sourceId: GrantSourceId.HELIOS_MINING,
    cost: {},
    baseDuration: 25,
    effect: { productionBonus: { resource: "materials", amount: 3 } },
    ideologyShift: { solidarity: -0.04, transformation: 0.02 },
    identityTag: "mining",
    minSol: 40,
    weight: 2,
  },
  {
    id: DistrictGrantId.MINING_SUBSIDY,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Mining Subsidy",
    description: "Corporate subsidy for materials infrastructure in the district",
    sourceId: GrantSourceId.HELIOS_MINING,
    cost: {},
    baseDuration: 25,
    effect: { productionBonus: { resource: "materials", amount: 2 } },
    ideologyShift: { solidarity: -0.03, transformation: 0.01 },
    identityTag: "mining",
    minSol: 25,
    weight: 2,
  },

  // --- Earth Science Council ---
  {
    id: DistrictGrantId.RESEARCH_GRANT,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Research Grant",
    description: "Funding and data from Earth accelerates research in this district",
    sourceId: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    cost: {},
    baseDuration: 25,
    effect: { researchBonus: 5 },
    ideologyShift: { sovereignty: -0.03, transformation: 0.03 },
    identityTag: "research",
    minSol: 20,
    weight: 3,
  },
  {
    id: DistrictGrantId.SCIENCE_EQUIPMENT,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Scientific Equipment Drop",
    description: "Lab equipment from the Council boosts district research capacity",
    sourceId: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    cost: {},
    baseDuration: 15,
    effect: { researchBonus: 3 },
    ideologyShift: { sovereignty: -0.02, transformation: 0.03 },
    identityTag: "research",
    minSol: 15,
    weight: 2,
  },
  {
    id: DistrictGrantId.DATA_SHARING,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Data Sharing Agreement",
    description: "Joint research program boosts colony research output",
    sourceId: GrantSourceId.EARTH_SCIENCE_COUNCIL,
    cost: {},
    baseDuration: 25,
    effect: { researchBonus: 3 },
    ideologyShift: { sovereignty: -0.04, transformation: 0.03 },
    identityTag: "research",
    minSol: 50,
    weight: 2,
  },

  // --- Mars Heritage Foundation ---
  {
    id: DistrictGrantId.CULTURAL_FUND,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Cultural Preservation Fund",
    description: "Heritage fund supports traditional practices and boosts district food production",
    sourceId: GrantSourceId.MARS_HERITAGE,
    cost: {},
    baseDuration: 15,
    effect: { productionBonus: { resource: "food", amount: 2 } },
    ideologyShift: { sovereignty: 0.03, transformation: -0.03 },
    identityTag: "agriculture",
    minSol: 15,
    weight: 3,
  },
  {
    id: DistrictGrantId.PRESERVATION_GRANT,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Preservation Grant",
    description: "Heritage agricultural methods boost steady food supply in the district",
    sourceId: GrantSourceId.MARS_HERITAGE,
    cost: {},
    baseDuration: 25,
    effect: { productionBonus: { resource: "food", amount: 2 } },
    ideologyShift: { sovereignty: 0.04, transformation: -0.04 },
    identityTag: "agriculture",
    minSol: 30,
    weight: 2,
  },
  {
    id: DistrictGrantId.HERITAGE_MATERIALS,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Heritage Building Materials",
    description: "Traditional construction materials from Foundation stores",
    sourceId: GrantSourceId.MARS_HERITAGE,
    cost: {},
    baseDuration: 15,
    effect: { buildingCostReduction: 0.2 },
    ideologyShift: { sovereignty: 0.02, transformation: -0.03 },
    identityTag: "housing",
    minSol: 20,
    weight: 2,
  },

  // --- Immigration Bureau ---
  {
    id: DistrictGrantId.SETTLER_WAVE,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Sponsored Settler Wave",
    description: "Bureau-funded colonists arrive ready to work in this district",
    sourceId: GrantSourceId.IMMIGRATION_BUREAU,
    cost: {},
    baseDuration: 20,
    effect: { capacityBoost: 5 },
    ideologyShift: { solidarity: 0.03, sovereignty: -0.03 },
    identityTag: "housing",
    minSol: 30,
    weight: 2,
  },
  {
    id: DistrictGrantId.HOUSING_AID,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Housing Development Aid",
    description: "Pre-fabricated housing modules increase district capacity",
    sourceId: GrantSourceId.IMMIGRATION_BUREAU,
    cost: {},
    baseDuration: 15,
    effect: { capacityBoost: 8 },
    ideologyShift: { solidarity: 0.03, sovereignty: -0.02 },
    identityTag: "housing",
    minSol: 20,
    weight: 3,
  },
  {
    id: DistrictGrantId.INTEGRATION_FUND,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Integration Support Fund",
    description: "Resources for settling new arrivals into the district community",
    sourceId: GrantSourceId.IMMIGRATION_BUREAU,
    cost: {},
    baseDuration: 15,
    effect: { healthBonus: 0.1 },
    ideologyShift: { solidarity: 0.02, sovereignty: -0.02 },
    identityTag: "housing",
    minSol: 15,
    weight: 2,
  },

  // --- Autonomous Collective ---
  {
    id: DistrictGrantId.COMMUNITY_GRANT,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Community Solidarity Grant",
    description: "Mutual aid network shares food and water with this district",
    sourceId: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    cost: {},
    baseDuration: 15,
    effect: { productionBonus: { resource: "food", amount: 2 } },
    ideologyShift: { solidarity: 0.04, sovereignty: 0.02 },
    identityTag: "agriculture",
    minSol: 15,
    weight: 3,
  },
  {
    id: DistrictGrantId.COOPERATIVE_TECH,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Cooperative Technology Package",
    description: "Shared agricultural tech boosts food production in this district",
    sourceId: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    cost: {},
    baseDuration: 25,
    effect: { productionBonus: { resource: "food", amount: 2 } },
    ideologyShift: { solidarity: 0.04, sovereignty: 0.02 },
    identityTag: "agriculture",
    minSol: 30,
    weight: 2,
  },
  {
    id: DistrictGrantId.FOOD_AID,
    category: DistrictGrantCategory.INFRASTRUCTURE,
    name: "Emergency Food Aid",
    description: "Collective pooled resources sustain this district",
    sourceId: GrantSourceId.AUTONOMOUS_COLLECTIVE,
    cost: {},
    baseDuration: 10,
    effect: { productionBonus: { resource: "food", amount: 3 } },
    ideologyShift: { solidarity: 0.03, sovereignty: 0.01 },
    identityTag: "agriculture",
    minSol: 15,
    weight: 2,
  },
];

// ============ Combined Template Array ============

export const DISTRICT_GRANT_TEMPLATES: readonly DistrictGrantTemplate[] = [
  ...IDENTITY_GRANTS,
  ...INFRASTRUCTURE_GRANTS,
];

// ============ Helper Lookups ============

export function getDistrictGrantTemplate(id: DistrictGrantId): DistrictGrantTemplate | undefined {
  return DISTRICT_GRANT_TEMPLATES.find((t) => t.id === id);
}

export function getIdentityGrants(): readonly DistrictGrantTemplate[] {
  return IDENTITY_GRANTS;
}

export function getInfrastructureGrants(): readonly DistrictGrantTemplate[] {
  return INFRASTRUCTURE_GRANTS;
}

export function getCapstoneGrants(): readonly DistrictGrantTemplate[] {
  return IDENTITY_GRANTS.filter((g) => g.isCapstone);
}

export function getNonCapstoneIdentityGrants(): readonly DistrictGrantTemplate[] {
  return IDENTITY_GRANTS.filter((g) => !g.isCapstone);
}

/**
 * Check whether an axis position meets a grant's axis requirements.
 */
export function meetsGrantAxisRequirements(
  position: { solidarity: number; sovereignty: number; transformation: number },
  grant: DistrictGrantTemplate,
): boolean {
  if (!grant.axisRequirements) return true;

  for (const [axis, req] of Object.entries(grant.axisRequirements)) {
    const value = position[axis as keyof typeof position];
    if (req.min !== undefined && value < req.min) return false;
    if (req.max !== undefined && value > req.max) return false;
  }

  return true;
}
