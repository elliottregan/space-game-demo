// src/core/data/npcs.ts

import { type NPC, NPCFaction, NPCId, type Project, ProjectId } from "../models/NPCInfluence";

export const NPCS: NPC[] = [
  // Earth Loyalists (3)
  {
    id: NPCId.CHEN_WEI,
    name: "Dr. Chen Wei",
    faction: NPCFaction.EarthLoyalists,
    influence: 1.5,
  },
  {
    id: NPCId.NOVA_SILVA,
    name: "Nova Silva",
    faction: NPCFaction.EarthLoyalists,
    influence: 1.0,
  },
  {
    id: NPCId.ALEX_OKONKWO,
    name: "Alex Okonkwo",
    faction: NPCFaction.EarthLoyalists,
    influence: 1.2,
  },

  // Mars Independence (4)
  {
    id: NPCId.MARIA_SANTOS,
    name: "Maria Santos",
    faction: NPCFaction.MarsIndependence,
    influence: 1.3,
  },
  {
    id: NPCId.JAMES_LIU,
    name: "James Liu",
    faction: NPCFaction.MarsIndependence,
    influence: 1.0,
  },
  {
    id: NPCId.AISHA_PATEL,
    name: "Aisha Patel",
    faction: NPCFaction.MarsIndependence,
    influence: 1.1,
  },
  {
    id: NPCId.MARCUS_REED,
    name: "Marcus Reed",
    faction: NPCFaction.MarsIndependence,
    influence: 0.9,
  },

  // Corporate Interests (3)
  {
    id: NPCId.ELENA_VOLKOV,
    name: "Elena Volkov",
    faction: NPCFaction.CorporateInterests,
    influence: 1.4,
  },
  {
    id: NPCId.DAVID_MORRISON,
    name: "David Morrison",
    faction: NPCFaction.CorporateInterests,
    influence: 1.0,
  },
  {
    id: NPCId.SARAH_CHEN,
    name: "Sarah Chen",
    faction: NPCFaction.CorporateInterests,
    influence: 1.1,
  },
];

/** Initial relationship weights (asymmetric). Key format: "fromId:toId" -> weight */
export const INITIAL_RELATIONSHIPS: Record<string, number> = {
  // Earth Loyalists internal connections (strong)
  [`${NPCId.CHEN_WEI}:${NPCId.NOVA_SILVA}`]: 0.7,
  [`${NPCId.NOVA_SILVA}:${NPCId.CHEN_WEI}`]: 0.6,
  [`${NPCId.CHEN_WEI}:${NPCId.ALEX_OKONKWO}`]: 0.5,
  [`${NPCId.ALEX_OKONKWO}:${NPCId.CHEN_WEI}`]: 0.6,
  [`${NPCId.NOVA_SILVA}:${NPCId.ALEX_OKONKWO}`]: 0.4,
  [`${NPCId.ALEX_OKONKWO}:${NPCId.NOVA_SILVA}`]: 0.5,

  // Mars Independence internal connections (moderate)
  [`${NPCId.MARIA_SANTOS}:${NPCId.JAMES_LIU}`]: 0.6,
  [`${NPCId.JAMES_LIU}:${NPCId.MARIA_SANTOS}`]: 0.5,
  [`${NPCId.MARIA_SANTOS}:${NPCId.AISHA_PATEL}`]: 0.5,
  [`${NPCId.AISHA_PATEL}:${NPCId.MARIA_SANTOS}`]: 0.6,
  [`${NPCId.JAMES_LIU}:${NPCId.MARCUS_REED}`]: 0.4,
  [`${NPCId.MARCUS_REED}:${NPCId.JAMES_LIU}`]: 0.4,
  [`${NPCId.AISHA_PATEL}:${NPCId.MARCUS_REED}`]: 0.3,
  [`${NPCId.MARCUS_REED}:${NPCId.AISHA_PATEL}`]: 0.3,

  // Corporate Interests internal connections (strong)
  [`${NPCId.ELENA_VOLKOV}:${NPCId.DAVID_MORRISON}`]: 0.7,
  [`${NPCId.DAVID_MORRISON}:${NPCId.ELENA_VOLKOV}`]: 0.6,
  [`${NPCId.ELENA_VOLKOV}:${NPCId.SARAH_CHEN}`]: 0.5,
  [`${NPCId.SARAH_CHEN}:${NPCId.ELENA_VOLKOV}`]: 0.6,
  [`${NPCId.DAVID_MORRISON}:${NPCId.SARAH_CHEN}`]: 0.4,
  [`${NPCId.SARAH_CHEN}:${NPCId.DAVID_MORRISON}`]: 0.5,

  // Cross-faction connections (weak)
  [`${NPCId.CHEN_WEI}:${NPCId.MARIA_SANTOS}`]: 0.3,
  [`${NPCId.MARIA_SANTOS}:${NPCId.CHEN_WEI}`]: 0.2,
  [`${NPCId.NOVA_SILVA}:${NPCId.AISHA_PATEL}`]: 0.2,
  [`${NPCId.AISHA_PATEL}:${NPCId.NOVA_SILVA}`]: 0.3,
  [`${NPCId.MARCUS_REED}:${NPCId.DAVID_MORRISON}`]: 0.3,
  [`${NPCId.DAVID_MORRISON}:${NPCId.MARCUS_REED}`]: 0.2,
  [`${NPCId.JAMES_LIU}:${NPCId.SARAH_CHEN}`]: 0.2,
  [`${NPCId.SARAH_CHEN}:${NPCId.JAMES_LIU}`]: 0.2,
};

export const PROJECTS: Project[] = [
  // Earth Loyalists projects
  {
    id: ProjectId.GENERATION_SHIP,
    name: "Build Generation Ship",
    description: "Begin construction of an interstellar colony ship.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 100 },
    requiredSupport: 0.5, // Victory path - high requirement
    effects: { unlockBuilding: "shipyard" },
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    name: "Earth Memorial",
    description: "Build a memorial to honor our home planet.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 40 },
    requiredSupport: 0.2, // Minor project
  },
  {
    id: ProjectId.HERITAGE_ARCHIVE,
    name: "Heritage Archive",
    description: "Preserve Earth cultures and traditions.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 50 },
    requiredSupport: 0.35, // Major project
    effects: { unlockBuilding: "archive" },
  },

  // Mars Independence projects
  {
    id: ProjectId.UNIVERSAL_HOUSING,
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 80 },
    requiredSupport: 0.35, // Major project
    effects: { unlockBuilding: "housing_complex" },
  },
  {
    id: ProjectId.HEALTHCARE_EXPANSION,
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 60, water: 30 },
    requiredSupport: 0.35, // Major project
    effects: { unlockBuilding: "medical_center" },
  },

  // Corporate Interests projects
  {
    id: ProjectId.AI_GOVERNANCE,
    name: "AI-Assisted Governance",
    description: "Implement AI systems to help with colony decision-making.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 50, power: 50 },
    requiredSupport: 0.35, // Major project
    effects: { unlockTech: "advanced_ai" },
  },
  {
    id: ProjectId.MINING_CONCESSION,
    name: "Mining Concession",
    description: "Grant exclusive extraction rights to corporate partners.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 60 },
    requiredSupport: 0.35, // Major project
    effects: { unlockBuilding: "efficient_mine" },
  },
  {
    id: ProjectId.LABOR_EFFICIENCY,
    name: "Labor Efficiency Program",
    description: "Controversial productivity initiative that increases output.",
    type: NPCFaction.CorporateInterests,
    proposalCost: { materials: 40 },
    requiredSupport: 0.2, // Minor project
  },
];
