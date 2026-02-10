// src/core/data/projects.ts

import { BuildingId } from "../models/Building.ts";
import {
  NPCFaction,
  ProjectEffectType,
  ProjectRequirementType,
  type AxisPosition,
  type Project,
  ProjectId,
} from "../models/NPCInfluence.ts";
import { TechnologyId } from "../models/Technology.ts";
import { STARTING_FACTION_POSITIONS } from "../balance/IdeologyBalance.ts";

export const PROJECTS: Project[] = [
  // ============ Collectivist-leaning projects (solidarity >= +0.3) ============
  {
    id: ProjectId.UNIVERSAL_HOUSING,
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    axisRequirements: { solidarity: { min: 0.3 } },
    proposalCost: { materials: 120 },
    effects: {
      unlockBuilding: "housing_complex",
      colonyMoraleBoost: 0.08,
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.05,
    },
  },
  {
    id: ProjectId.HEALTHCARE_EXPANSION,
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access for all colonists.",
    axisRequirements: { solidarity: { min: 0.3 } },
    proposalCost: { materials: 100, water: 40 },
    effects: {
      unlockBuilding: "medical_center",
      colonyMoraleBoost: 0.05,
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.05,
    },
  },
  {
    id: ProjectId.DEMOCRATIC_ASSEMBLY,
    name: "Democratic Assembly",
    description:
      "Establish a formal democratic assembly where all colonists have a voice in governance.",
    axisRequirements: { solidarity: { min: 0.3 } },
    proposalCost: { materials: 110 },
    effects: {
      unlockBuilding: "assembly_hall",
      colonyMoraleBoost: 0.1,
      supporterMoraleBoost: 0.15,
      supporterConvictionBoost: 0.1,
    },
  },

  // ============ Preservationist-leaning projects (transformation <= -0.3) ============
  {
    id: ProjectId.HERITAGE_ARCHIVE,
    name: "Heritage Archive",
    description:
      "Preserve Earth's diverse cultures and traditions, helping immigrants feel at home on Mars.",
    axisRequirements: { transformation: { max: -0.3 } },
    proposalCost: { materials: 100 },
    effects: {
      unlockBuilding: "archive",
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.08,
    },
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    name: "Earth Memorial",
    description:
      "Build a memorial honoring the courage of those who left everything behind to start anew on Mars.",
    axisRequirements: { transformation: { max: -0.3 } },
    proposalCost: { materials: 80 },
    effects: {
      colonyMoraleBoost: 0.05,
      supporterMoraleBoost: 0.15,
      supporterConvictionBoost: 0.1,
    },
  },

  // ============ Earth-tied projects (sovereignty <= -0.3) ============
  {
    id: ProjectId.IMMIGRATION_PROGRAM,
    name: "Immigration Program",
    description: "Establish formal immigration pathways to bring more settlers from Earth.",
    axisRequirements: { sovereignty: { max: -0.3 } },
    proposalCost: { materials: 120 },
    requirements: [
      { type: ProjectRequirementType.TECHNOLOGY, techId: TechnologyId.HABITAT_FABRICATION },
    ],
    effects: {
      unlockBuilding: "immigration_center",
      populationBonus: 3,
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.05,
    },
    onCompletionEffects: [
      {
        type: ProjectEffectType.RECURRING_EVENT,
        name: "Immigration Wave",
        description: "New settlers arrive every 10 sols",
        params: { eventType: "immigration", intervalSols: 10 },
      },
      {
        type: ProjectEffectType.PRODUCTION_MODIFIER,
        name: "Settlement Supplies",
        description: "+5 materials/sol for housing construction",
        params: { resource: "materials", amount: 5 },
      },
      {
        type: ProjectEffectType.CONVICTION_BOOST,
        name: "Renewed Hope",
        description: "Earth Loyalists feel vindicated",
        params: { faction: NPCFaction.EarthLoyalists, amount: 0.1 },
      },
    ],
  },

  // ============ Individualist-leaning projects (solidarity <= -0.3) ============
  {
    id: ProjectId.VENTURE_CAPITAL_INITIATIVE,
    name: "Venture Capital Initiative",
    description: "Establish investment channels to attract Earth capital for Martian expansion.",
    axisRequirements: { solidarity: { max: -0.3 } },
    proposalCost: { materials: 80 },
    effects: {
      materialsBonus: 2,
      supporterConvictionBoost: 0.1,
    },
  },
  {
    id: ProjectId.PRIVATE_MINING_CONTRACTS,
    name: "Private Mining Contracts",
    description:
      "Grant exclusive mining rights to private enterprises for faster resource extraction.",
    axisRequirements: { solidarity: { max: -0.3 } },
    proposalCost: { materials: 90 },
    effects: {
      materialsBonus: 3,
      supporterConvictionBoost: 0.08,
    },
  },
  {
    id: ProjectId.ORBITAL_INFRASTRUCTURE,
    name: "Orbital Infrastructure",
    description: "Build launch facilities and orbital stations to enable space-based operations.",
    axisRequirements: { solidarity: { max: -0.3 } },
    proposalCost: { materials: 120 },
    effects: {
      unlockBuilding: "launch_facility",
      productionBonus: 0.1,
      supporterConvictionBoost: 0.08,
    },
  },
  {
    id: ProjectId.ASTEROID_SURVEY_PROGRAM,
    name: "Asteroid Survey Program",
    description: "Map and catalog near-Mars asteroids for their mineral wealth.",
    axisRequirements: { solidarity: { max: -0.3 } },
    proposalCost: { materials: 100 },
    effects: {
      unlockTech: "asteroid_prospecting",
      supporterConvictionBoost: 0.05,
    },
  },

  // ============ Mars-sovereign projects (sovereignty >= +0.5) ============
  {
    id: ProjectId.DECLARATION_OF_SOVEREIGNTY,
    name: "Declaration of Sovereignty",
    description: "Formally declare Mars an independent nation, free from Earth jurisdiction.",
    axisRequirements: { sovereignty: { min: 0.5 } },
    proposalCost: { materials: 150 },
    isCapstone: true,
    prerequisites: [
      ProjectId.UNIVERSAL_HOUSING,
      ProjectId.HEALTHCARE_EXPANSION,
      ProjectId.DEMOCRATIC_ASSEMBLY,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.UNITED_MARS_STATION },
  },

  // ============ Revolutionary-leaning projects (transformation >= +0.5) ============
  {
    id: ProjectId.GENETIC_ADAPTATION_PROGRAM,
    name: "Genetic Adaptation Program",
    description:
      "Fund research into modifying colonists for Mars gravity, radiation, and atmosphere.",
    axisRequirements: { transformation: { min: 0.5 } },
    proposalCost: { materials: 130 },
    effects: {
      colonyMoraleBoost: 0.05,
      supporterMoraleBoost: 0.12,
      supporterConvictionBoost: 0.1,
    },
  },

  // ============ Multi-axis projects ============
  {
    id: ProjectId.MARS_NATIONALISM_CHARTER,
    name: "Mars Nationalism Charter",
    description:
      "Establish a charter preserving Martian identity while asserting sovereignty from Earth.",
    axisRequirements: { sovereignty: { min: 0.5 }, transformation: { max: -0.3 } },
    proposalCost: { materials: 110 },
    effects: {
      colonyMoraleBoost: 0.06,
      supporterMoraleBoost: 0.12,
      supporterConvictionBoost: 0.08,
    },
  },
  {
    id: ProjectId.TRANSHUMAN_RESEARCH_INITIATIVE,
    name: "Transhuman Research Initiative",
    description:
      "Push the boundaries of human adaptation through radical biotech and cybernetic augmentation.",
    axisRequirements: { sovereignty: { min: 0.3 }, transformation: { min: 0.5 } },
    proposalCost: { materials: 140 },
    effects: {
      productionBonus: 0.08,
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.1,
    },
  },

  // ============ Capstone Victory Projects (axis-gated megastructures) ============
  {
    id: ProjectId.EARTH_RELIEF_COMPACT,
    name: "Earth Relief Compact",
    description:
      "Sign a formal treaty committing Mars to relieve Earth's overpopulation crisis through sustained mass immigration.",
    axisRequirements: { sovereignty: { max: -0.6 }, solidarity: { min: 0.5 } },
    proposalCost: {},
    isCapstone: true,
    prerequisites: [
      ProjectId.EARTH_MEMORIAL,
      ProjectId.HERITAGE_ARCHIVE,
      ProjectId.IMMIGRATION_PROGRAM,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.SPACE_ELEVATOR },
    onCompletionEffects: [
      {
        type: ProjectEffectType.IMMIGRATION_IDEOLOGY_BIAS,
        name: "Preferred Boarding",
        description: "New immigrants arrive with stronger Earth Loyalist ideology.",
        params: {
          faction: NPCFaction.EarthLoyalists,
          strength: 0.3,
        },
      },
    ],
  },
  {
    id: ProjectId.DEEP_SPACE_MINING_CHARTER,
    name: "Deep Space Mining Charter",
    description:
      "Secure an official charter granting corporations exclusive rights to deep space mining operations.",
    axisRequirements: { solidarity: { max: -0.5 }, transformation: { min: 0.5 } },
    proposalCost: {},
    isCapstone: true,
    prerequisites: [
      ProjectId.VENTURE_CAPITAL_INITIATIVE,
      ProjectId.ORBITAL_INFRASTRUCTURE,
      ProjectId.ASTEROID_SURVEY_PROGRAM,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.ASTEROID_MINING_PLATFORM },
  },
  {
    id: ProjectId.GENESIS_VAULT,
    name: "Genesis Vault",
    description:
      "Construct a massive biological archive preserving Earth's biodiversity for future generations on Mars.",
    axisRequirements: { transformation: { max: -0.6 }, solidarity: { min: 0.5 } },
    proposalCost: {},
    isCapstone: true,
    prerequisites: [
      ProjectId.HERITAGE_ARCHIVE,
      ProjectId.EARTH_MEMORIAL,
      ProjectId.HEALTHCARE_EXPANSION,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.GENESIS_ARK, colonyMoraleBoost: 0.15 },
  },
];

/**
 * Get a project by its ID.
 */
export function getProject(id: ProjectId): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

/**
 * Check whether a faction's axis position meets a project's axis requirements.
 */
export function meetsAxisRequirements(position: AxisPosition, project: Project): boolean {
  if (!project.axisRequirements) return true;

  for (const [axis, req] of Object.entries(project.axisRequirements)) {
    const value = position[axis as keyof AxisPosition];
    if (req.min !== undefined && value < req.min) return false;
    if (req.max !== undefined && value > req.max) return false;
  }

  return true;
}

/**
 * Get all projects whose axis requirements are met by the given faction position.
 */
export function getAvailableProjects(factionPosition: AxisPosition): Project[] {
  return PROJECTS.filter((p) => meetsAxisRequirements(factionPosition, p));
}

/**
 * Get projects associated with a faction by checking the faction's starting position
 * against each project's axis requirements.
 */
export function getProjectsByFaction(faction: NPCFaction): Project[] {
  const factionData = STARTING_FACTION_POSITIONS.find((f) => f.baseId === faction);
  if (!factionData) return [];
  return getAvailableProjects(factionData.position);
}
