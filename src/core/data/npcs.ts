// src/core/data/npcs.ts

import type { NPC, Project } from "../models/NPCInfluence";

export const NPCS: NPC[] = [
  // Earth Loyalists (3) - formerly futurist
  { id: "chen_wei", name: "Dr. Chen Wei", faction: "earth_loyalists", influence: 1.5 },
  { id: "nova_silva", name: "Nova Silva", faction: "earth_loyalists", influence: 1.0 },
  { id: "alex_okonkwo", name: "Alex Okonkwo", faction: "earth_loyalists", influence: 1.2 },

  // Mars Independence (4) - formerly progressive
  { id: "maria_santos", name: "Maria Santos", faction: "mars_independence", influence: 1.3 },
  { id: "james_liu", name: "James Liu", faction: "mars_independence", influence: 1.0 },
  { id: "aisha_patel", name: "Aisha Patel", faction: "mars_independence", influence: 1.1 },
  { id: "marcus_reed", name: "Marcus Reed", faction: "mars_independence", influence: 0.9 },

  // Corporate Interests (3) - formerly traditionalist
  { id: "elena_volkov", name: "Elena Volkov", faction: "corporate_interests", influence: 1.4 },
  { id: "david_morrison", name: "David Morrison", faction: "corporate_interests", influence: 1.0 },
  { id: "sarah_chen", name: "Sarah Chen", faction: "corporate_interests", influence: 1.1 },
];

/** Initial relationship weights (asymmetric). Key format: "fromId:toId" -> weight */
export const INITIAL_RELATIONSHIPS: Record<string, number> = {
  // Earth Loyalists internal connections (strong)
  "chen_wei:nova_silva": 0.7,
  "nova_silva:chen_wei": 0.6,
  "chen_wei:alex_okonkwo": 0.5,
  "alex_okonkwo:chen_wei": 0.6,
  "nova_silva:alex_okonkwo": 0.4,
  "alex_okonkwo:nova_silva": 0.5,

  // Mars Independence internal connections (moderate)
  "maria_santos:james_liu": 0.6,
  "james_liu:maria_santos": 0.5,
  "maria_santos:aisha_patel": 0.5,
  "aisha_patel:maria_santos": 0.6,
  "james_liu:marcus_reed": 0.4,
  "marcus_reed:james_liu": 0.4,
  "aisha_patel:marcus_reed": 0.3,
  "marcus_reed:aisha_patel": 0.3,

  // Corporate Interests internal connections (strong)
  "elena_volkov:david_morrison": 0.7,
  "david_morrison:elena_volkov": 0.6,
  "elena_volkov:sarah_chen": 0.5,
  "sarah_chen:elena_volkov": 0.6,
  "david_morrison:sarah_chen": 0.4,
  "sarah_chen:david_morrison": 0.5,

  // Cross-faction connections (weak)
  "chen_wei:maria_santos": 0.3,
  "maria_santos:chen_wei": 0.2,
  "nova_silva:aisha_patel": 0.2,
  "aisha_patel:nova_silva": 0.3,
  "marcus_reed:david_morrison": 0.3,
  "david_morrison:marcus_reed": 0.2,
  "james_liu:sarah_chen": 0.2,
  "sarah_chen:james_liu": 0.2,
};

export const PROJECTS: Project[] = [
  // Futurist projects
  {
    id: "generation_ship",
    name: "Build Generation Ship",
    description: "Begin construction of an interstellar colony ship.",
    type: "futurist",
    proposalCost: { materials: 100 },
    effects: { unlockBuilding: "shipyard" },
  },
  {
    id: "ai_governance",
    name: "AI-Assisted Governance",
    description: "Implement AI systems to help with colony decision-making.",
    type: "futurist",
    proposalCost: { materials: 50, power: 50 },
    effects: { unlockTech: "advanced_ai" },
  },

  // Progressive projects
  {
    id: "universal_housing",
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    type: "progressive",
    proposalCost: { materials: 80 },
    effects: { unlockBuilding: "housing_complex" },
  },
  {
    id: "healthcare_expansion",
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access.",
    type: "progressive",
    proposalCost: { materials: 60, water: 30 },
    effects: { unlockBuilding: "medical_center" },
  },

  // Traditionalist projects
  {
    id: "earth_memorial",
    name: "Earth Memorial",
    description: "Build a memorial to honor our home planet.",
    type: "traditionalist",
    proposalCost: { materials: 40 },
  },
  {
    id: "heritage_archive",
    name: "Heritage Archive",
    description: "Preserve Earth cultures and traditions.",
    type: "traditionalist",
    proposalCost: { materials: 50 },
    effects: { unlockBuilding: "archive" },
  },
];
