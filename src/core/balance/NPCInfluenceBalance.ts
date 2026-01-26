// src/core/balance/NPCInfluenceBalance.ts

import { NPCFaction, type ProjectType } from "../models/NPCInfluence";

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
  [NPCFaction.EarthLoyalists]: {
    [NPCFaction.EarthLoyalists]: { [NPCFaction.EarthLoyalists]: 1.0, [NPCFaction.MarsIndependence]: 0.6, [NPCFaction.CorporateInterests]: 0.2 },
    [NPCFaction.MarsIndependence]: { [NPCFaction.EarthLoyalists]: 0.7, [NPCFaction.MarsIndependence]: 1.0, [NPCFaction.CorporateInterests]: 0.4 },
    [NPCFaction.CorporateInterests]: { [NPCFaction.EarthLoyalists]: 0.3, [NPCFaction.MarsIndependence]: 0.5, [NPCFaction.CorporateInterests]: 1.0 },
  },
  [NPCFaction.MarsIndependence]: {
    [NPCFaction.EarthLoyalists]: { [NPCFaction.EarthLoyalists]: 1.0, [NPCFaction.MarsIndependence]: 0.5, [NPCFaction.CorporateInterests]: 0.3 },
    [NPCFaction.MarsIndependence]: { [NPCFaction.EarthLoyalists]: 0.6, [NPCFaction.MarsIndependence]: 1.0, [NPCFaction.CorporateInterests]: 0.6 },
    [NPCFaction.CorporateInterests]: { [NPCFaction.EarthLoyalists]: 0.3, [NPCFaction.MarsIndependence]: 0.5, [NPCFaction.CorporateInterests]: 1.0 },
  },
  [NPCFaction.CorporateInterests]: {
    [NPCFaction.EarthLoyalists]: { [NPCFaction.EarthLoyalists]: 1.0, [NPCFaction.MarsIndependence]: 0.4, [NPCFaction.CorporateInterests]: 0.2 },
    [NPCFaction.MarsIndependence]: { [NPCFaction.EarthLoyalists]: 0.5, [NPCFaction.MarsIndependence]: 1.0, [NPCFaction.CorporateInterests]: 0.6 },
    [NPCFaction.CorporateInterests]: { [NPCFaction.EarthLoyalists]: 0.3, [NPCFaction.MarsIndependence]: 0.7, [NPCFaction.CorporateInterests]: 1.0 },
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
