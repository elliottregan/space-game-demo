// src/core/data/foundingColonists.ts

import type { ColonistIdeology } from "../models/Colonist";
import { ColonistRole } from "../models/Colonist";

/**
 * Data for founding colonists - the original 10 who become the initial council.
 * These replace the static NPC system with actual colonists who have preset ideologies.
 */
export interface FoundingColonistData {
  id: string;
  name: string;
  ideology: ColonistIdeology;
  role?: ColonistRole;
}

/**
 * The 10 founding colonists with preset ideologies.
 * Faction distribution: 3 Earth Loyalists, 4 Mars Independence, 3 Corporate Interests.
 */
export const FOUNDING_COLONISTS: FoundingColonistData[] = [
  // ============ Earth Loyalists (3) ============
  {
    id: "founding_chen_wei",
    name: "Dr. Chen Wei",
    ideology: {
      solidarity: 0.1,
      sovereignty: -0.7,
      transformation: -0.2,
      conviction: 0.8,
    },
    role: ColonistRole.RESEARCH,
  },
  {
    id: "founding_nova_silva",
    name: "Nova Silva",
    ideology: {
      solidarity: 0.2,
      sovereignty: -0.5,
      transformation: -0.3,
      conviction: 0.6,
    },
    role: ColonistRole.CIVIL_SCIENCE,
  },
  {
    id: "founding_alex_okonkwo",
    name: "Alex Okonkwo",
    ideology: {
      solidarity: 0.15,
      sovereignty: -0.6,
      transformation: -0.25,
      conviction: 0.7,
    },
    role: ColonistRole.FARMING,
  },

  // ============ Mars Independence (4) ============
  {
    id: "founding_maria_santos",
    name: "Maria Santos",
    ideology: {
      solidarity: 0.3,
      sovereignty: 0.7,
      transformation: 0.3,
      conviction: 0.85,
    },
    role: ColonistRole.ENGINEERING,
  },
  {
    id: "founding_james_liu",
    name: "James Liu",
    ideology: {
      solidarity: 0.25,
      sovereignty: 0.5,
      transformation: 0.2,
      conviction: 0.6,
    },
    role: ColonistRole.RESEARCH,
  },
  {
    id: "founding_aisha_patel",
    name: "Aisha Patel",
    ideology: {
      solidarity: 0.3,
      sovereignty: 0.6,
      transformation: 0.25,
      conviction: 0.7,
    },
    role: ColonistRole.CIVIL_SCIENCE,
  },
  {
    id: "founding_marcus_reed",
    name: "Marcus Reed",
    ideology: {
      solidarity: 0.15,
      sovereignty: 0.45,
      transformation: 0.15,
      conviction: 0.5,
    },
    role: ColonistRole.FARMING,
  },

  // ============ Corporate Interests (3) ============
  {
    id: "founding_elena_volkov",
    name: "Elena Volkov",
    ideology: {
      solidarity: -0.6,
      sovereignty: 0.0,
      transformation: 0.4,
      conviction: 0.8,
    },
    role: ColonistRole.ENGINEERING,
  },
  {
    id: "founding_david_morrison",
    name: "David Morrison",
    ideology: {
      solidarity: -0.45,
      sovereignty: -0.1,
      transformation: 0.35,
      conviction: 0.6,
    },
    role: ColonistRole.RESEARCH,
  },
  {
    id: "founding_sarah_chen",
    name: "Sarah Chen",
    ideology: {
      solidarity: -0.55,
      sovereignty: 0.0,
      transformation: 0.4,
      conviction: 0.7,
    },
    role: ColonistRole.ENGINEERING,
  },
];

/**
 * Initial relationships between founding colonists.
 * Key format: "colonistId1:colonistId2" -> strength (0-1).
 * Relationships are bidirectional (will be created in both directions).
 */
export const FOUNDING_RELATIONSHIPS: Record<string, number> = {
  // Earth Loyalists internal (strong bonds)
  "founding_chen_wei:founding_nova_silva": 0.7,
  "founding_chen_wei:founding_alex_okonkwo": 0.5,
  "founding_nova_silva:founding_alex_okonkwo": 0.4,

  // Mars Independence internal (strong bonds - balanced with other factions)
  "founding_maria_santos:founding_james_liu": 0.7,
  "founding_maria_santos:founding_aisha_patel": 0.5,
  "founding_james_liu:founding_marcus_reed": 0.5,
  "founding_aisha_patel:founding_marcus_reed": 0.4,

  // Corporate Interests internal (strong bonds)
  "founding_elena_volkov:founding_david_morrison": 0.7,
  "founding_elena_volkov:founding_sarah_chen": 0.5,
  "founding_david_morrison:founding_sarah_chen": 0.4,

  // Cross-faction connections (weak ties)
  "founding_chen_wei:founding_maria_santos": 0.25,
  "founding_nova_silva:founding_aisha_patel": 0.2,
  "founding_marcus_reed:founding_david_morrison": 0.25,
  "founding_james_liu:founding_sarah_chen": 0.2,
  "founding_alex_okonkwo:founding_elena_volkov": 0.15,
};
