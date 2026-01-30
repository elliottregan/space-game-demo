// src/core/data/projects.ts

import { NPCFaction, type Project, ProjectId } from "../models/NPCInfluence.ts";

export const PROJECTS: Project[] = [
  // Earth Loyalists projects
  {
    id: ProjectId.GENERATION_SHIP,
    name: "Build Generation Ship",
    description: "Begin construction of an interstellar colony ship.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 100 },
    requiredSupport: 0.5,
    effects: { unlockBuilding: "shipyard" },
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    name: "Earth Memorial",
    description: "Build a memorial to honor our home planet.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 40 },
    requiredSupport: 0.2,
  },
  {
    id: ProjectId.HERITAGE_ARCHIVE,
    name: "Heritage Archive",
    description: "Preserve Earth cultures and traditions.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 50 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "archive" },
  },

  // Mars Independence projects
  {
    id: ProjectId.UNIVERSAL_HOUSING,
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 80 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "housing_complex" },
  },
  {
    id: ProjectId.HEALTHCARE_EXPANSION,
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 60, water: 30 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "medical_center" },
  },
  {
    id: ProjectId.DEMOCRATIC_ASSEMBLY,
    name: "Democratic Assembly",
    description:
      "Establish a formal democratic assembly where all colonists have a voice in governance.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 70 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "assembly_hall" },
  },

  // Corporate Interests projects
  {
    id: ProjectId.AI_GOVERNANCE,
    name: "AI-Assisted Governance",
    description: "Implement AI systems to help with colony decision-making.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 50, power: 50 },
    requiredSupport: 0.35,
    effects: { unlockTech: "advanced_ai" },
  },
  {
    id: ProjectId.MINING_CONCESSION,
    name: "Mining Concession",
    description: "Grant exclusive extraction rights to corporate partners.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 60 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "efficient_mine" },
  },
  {
    id: ProjectId.LABOR_EFFICIENCY,
    name: "Labor Efficiency Program",
    description: "Controversial productivity initiative that increases output.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 40 },
    requiredSupport: 0.2,
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
