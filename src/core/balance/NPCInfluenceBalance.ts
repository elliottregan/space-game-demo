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
    [NPCFaction.EarthLoyalists]: {
      [NPCFaction.EarthLoyalists]: 1.0,
      [NPCFaction.MarsIndependence]: 0.6,
      [NPCFaction.CorporateInterests]: 0.2,
    },
    [NPCFaction.MarsIndependence]: {
      [NPCFaction.EarthLoyalists]: 0.7,
      [NPCFaction.MarsIndependence]: 1.0,
      [NPCFaction.CorporateInterests]: 0.4,
    },
    [NPCFaction.CorporateInterests]: {
      [NPCFaction.EarthLoyalists]: 0.3,
      [NPCFaction.MarsIndependence]: 0.5,
      [NPCFaction.CorporateInterests]: 1.0,
    },
  },
  [NPCFaction.MarsIndependence]: {
    [NPCFaction.EarthLoyalists]: {
      [NPCFaction.EarthLoyalists]: 1.0,
      [NPCFaction.MarsIndependence]: 0.5,
      [NPCFaction.CorporateInterests]: 0.3,
    },
    [NPCFaction.MarsIndependence]: {
      [NPCFaction.EarthLoyalists]: 0.6,
      [NPCFaction.MarsIndependence]: 1.0,
      [NPCFaction.CorporateInterests]: 0.6,
    },
    [NPCFaction.CorporateInterests]: {
      [NPCFaction.EarthLoyalists]: 0.3,
      [NPCFaction.MarsIndependence]: 0.5,
      [NPCFaction.CorporateInterests]: 1.0,
    },
  },
  [NPCFaction.CorporateInterests]: {
    [NPCFaction.EarthLoyalists]: {
      [NPCFaction.EarthLoyalists]: 1.0,
      [NPCFaction.MarsIndependence]: 0.4,
      [NPCFaction.CorporateInterests]: 0.2,
    },
    [NPCFaction.MarsIndependence]: {
      [NPCFaction.EarthLoyalists]: 0.5,
      [NPCFaction.MarsIndependence]: 1.0,
      [NPCFaction.CorporateInterests]: 0.6,
    },
    [NPCFaction.CorporateInterests]: {
      [NPCFaction.EarthLoyalists]: 0.3,
      [NPCFaction.MarsIndependence]: 0.7,
      [NPCFaction.CorporateInterests]: 1.0,
    },
  },
} as const;

/** Base lobbying cost per lobby action (in materials) */
export const LOBBY_BASE_COST = 10;

/** Support boost per lobby action */
export const LOBBY_SUPPORT_BOOST = 0.3;

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

// ============ Network Disconnection System ============

/** Rate at which relationship weights decay per sol (applied after POLITICAL_PRESSURE_START_SOL) */
export const RELATIONSHIP_DECAY_RATE = 0.002;

/** Multiplier for cross-faction relationship decay (cross-faction connections decay faster) */
export const CROSS_FACTION_DECAY_MULTIPLIER = 1.5;

/** Threshold below which connections are severed (set to 0) */
export const DISCONNECTION_THRESHOLD = 0.05;

/** Relationship penalty applied to NPCs who voted on opposing sides of a project */
export const OPPOSING_VOTE_RELATIONSHIP_PENALTY = 0.05;

/** Minimum relationship strength to prevent further decay (floor for same-faction members) */
export const SAME_FACTION_RELATIONSHIP_FLOOR = 0.1;

// ============ Triadic Closure System ============

/** Probability per tick that an open triad will close (A→B, B→C creates A→C) */
export const TRIADIC_CLOSURE_PROBABILITY = 0.02;

/** Initial weight for newly formed triadic connections */
export const TRIADIC_CLOSURE_INITIAL_WEIGHT = 0.15;

/** Minimum combined weight of A→B and B→C for triadic closure to occur */
export const TRIADIC_CLOSURE_THRESHOLD = 0.4;

/** Multiplier for triadic closure probability when NPCs share a faction */
export const SAME_FACTION_CLOSURE_MULTIPLIER = 2.0;

// ============ Relationship Maintenance System ============

/** Sols after which a relationship is considered "unmaintained" */
export const RELATIONSHIP_STALE_THRESHOLD = 30;

/** Multiplier for decay rate on unmaintained relationships */
export const UNMAINTAINED_DECAY_MULTIPLIER = 2.0;

/** Relationship boost when NPCs vote on the same side of a project */
export const SHARED_VOTE_RELATIONSHIP_BOOST = 0.03;

/** How much interaction refreshes the maintenance timer (in sols) */
export const INTERACTION_REFRESH_AMOUNT = 30;
