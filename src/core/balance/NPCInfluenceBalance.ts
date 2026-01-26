// src/core/balance/NPCInfluenceBalance.ts

import type { NPCFaction, ProjectType } from "../models/NPCInfluence";

/** Drift rate - how quickly NPCs respond to network influence (0.1-0.5) */
export const DRIFT_RATE = 0.2;

/** Support threshold for project to pass */
export const PASS_THRESHOLD = 0.4;

/** Sols before a proposed project is voted on */
export const PROJECT_VOTE_DELAY = 10;

/** Transmission factors: how receptive target faction is to source faction for each project type */
export const TRANSMISSION_FACTORS: Record<
  ProjectType,
  Record<NPCFaction, Record<NPCFaction, number>>
> = {
  earth_loyalists: {
    earth_loyalists: { earth_loyalists: 1.0, mars_independence: 0.6, corporate_interests: 0.2 },
    mars_independence: { earth_loyalists: 0.7, mars_independence: 1.0, corporate_interests: 0.4 },
    corporate_interests: { earth_loyalists: 0.3, mars_independence: 0.5, corporate_interests: 1.0 },
  },
  mars_independence: {
    earth_loyalists: { earth_loyalists: 1.0, mars_independence: 0.5, corporate_interests: 0.3 },
    mars_independence: { earth_loyalists: 0.6, mars_independence: 1.0, corporate_interests: 0.6 },
    corporate_interests: { earth_loyalists: 0.3, mars_independence: 0.5, corporate_interests: 1.0 },
  },
  corporate_interests: {
    earth_loyalists: { earth_loyalists: 1.0, mars_independence: 0.4, corporate_interests: 0.2 },
    mars_independence: { earth_loyalists: 0.5, mars_independence: 1.0, corporate_interests: 0.6 },
    corporate_interests: { earth_loyalists: 0.3, mars_independence: 0.7, corporate_interests: 1.0 },
  },
} as const;

/** Base lobbying cost per 0.1 support boost (in materials) */
export const LOBBY_BASE_COST = 10;

/** Cost to create a council (in materials) */
export const COUNCIL_CREATION_COST = 50;

/** Relationship boost when NPCs are in same council */
export const COUNCIL_RELATIONSHIP_BOOST = 0.2;

/** Transmission factor change on project success */
export const SUCCESS_TRANSMISSION_BOOST = 0.1;

/** Transmission factor change on project failure */
export const FAILURE_TRANSMISSION_PENALTY = -0.15;

// ============ Faction Demand System ============

/** Rate at which faction support decays per sol (before demands) */
export const FACTION_SUPPORT_DECAY_RATE = 0.01;

/** Support threshold below which a faction issues a demand */
export const DEMAND_THRESHOLD = 0.5;

/** Sols given to respond to a faction demand */
export const DEMAND_DEADLINE = 60;

/** Decay rate multiplier when demand is ignored past deadline */
export const IGNORED_DEMAND_DECAY_MULTIPLIER = 3;

/** Support boost to all faction NPCs when their project passes */
export const PROJECT_PASS_SUPPORT_BOOST = 0.3;

/** Minimum sols before political pressure begins */
export const POLITICAL_PRESSURE_START_SOL = 100;
