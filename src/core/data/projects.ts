// src/core/data/projects.ts

import { BuildingId } from "../models/Building.ts";
import { NPCFaction, ProjectEffectType, type Project, ProjectId } from "../models/NPCInfluence.ts";

export const PROJECTS: Project[] = [
  // Earth Loyalists projects
  {
    id: ProjectId.IMMIGRATION_PROGRAM,
    name: "Immigration Program",
    description: "Establish formal immigration pathways to bring more settlers from Earth.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 120 },
    requiredSupport: 0.35,
    effects: {
      unlockBuilding: "immigration_center",
      populationBonus: 3,
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.05,
    },
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    name: "Earth Memorial",
    description:
      "Build a memorial honoring the courage of those who left everything behind to start anew on Mars.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 80 },
    requiredSupport: 0.2,
    effects: {
      colonyMoraleBoost: 0.05,
      supporterMoraleBoost: 0.15,
      supporterConvictionBoost: 0.1,
    },
  },
  {
    id: ProjectId.HERITAGE_ARCHIVE,
    name: "Heritage Archive",
    description:
      "Preserve Earth's diverse cultures and traditions, helping immigrants feel at home on Mars.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 100 },
    requiredSupport: 0.35,
    effects: {
      unlockBuilding: "archive",
      supporterMoraleBoost: 0.1,
      supporterConvictionBoost: 0.08,
    },
  },

  // Mars Independence projects
  {
    id: ProjectId.UNIVERSAL_HOUSING,
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 120 },
    requiredSupport: 0.35,
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
    description: "Expand medical facilities and access.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 100, water: 40 },
    requiredSupport: 0.35,
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
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 110 },
    requiredSupport: 0.35,
    effects: {
      unlockBuilding: "assembly_hall",
      colonyMoraleBoost: 0.1,
      supporterMoraleBoost: 0.15,
      supporterConvictionBoost: 0.1,
    },
  },

  // Corporate Interests projects
  {
    id: ProjectId.VENTURE_CAPITAL_INITIATIVE,
    name: "Venture Capital Initiative",
    description: "Establish investment channels to attract Earth capital for Martian expansion.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 80 },
    requiredSupport: 0.2,
    effects: {
      materialsBonus: 2,
      supporterConvictionBoost: 0.1,
    },
  },
  {
    id: ProjectId.ORBITAL_INFRASTRUCTURE,
    name: "Orbital Infrastructure",
    description: "Build launch facilities and orbital stations to enable space-based operations.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 120 },
    requiredSupport: 0.35,
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
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 100 },
    requiredSupport: 0.35,
    effects: {
      unlockTech: "asteroid_prospecting",
      supporterConvictionBoost: 0.05,
    },
  },

  // Capstone Victory Projects
  {
    id: ProjectId.EARTH_RELIEF_COMPACT,
    name: "Earth Relief Compact",
    description:
      "Sign a formal treaty committing Mars to relieve Earth's overpopulation crisis through sustained mass immigration.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: {},
    requiredSupport: 0,
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
    id: ProjectId.DECLARATION_OF_SOVEREIGNTY,
    name: "Declaration of Sovereignty",
    description: "Formally declare Mars an independent nation, free from Earth jurisdiction.",
    type: NPCFaction.MarsIndependence,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [
      ProjectId.UNIVERSAL_HOUSING,
      ProjectId.HEALTHCARE_EXPANSION,
      ProjectId.DEMOCRATIC_ASSEMBLY,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.UNITED_MARS_STATION },
  },
  {
    id: ProjectId.DEEP_SPACE_MINING_CHARTER,
    name: "Deep Space Mining Charter",
    description:
      "Secure an official charter granting corporations exclusive rights to deep space mining operations.",
    type: NPCFaction.CorporateInterests,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [
      ProjectId.VENTURE_CAPITAL_INITIATIVE,
      ProjectId.ORBITAL_INFRASTRUCTURE,
      ProjectId.ASTEROID_SURVEY_PROGRAM,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.ASTEROID_MINING_PLATFORM },
  },
];

/**
 * Get a project by its ID.
 */
export function getProject(id: ProjectId): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

/**
 * Get all projects for a specific faction.
 */
export function getProjectsByFaction(faction: NPCFaction): Project[] {
  return PROJECTS.filter((p) => p.type === faction);
}
