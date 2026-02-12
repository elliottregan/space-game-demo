// src/core/balance/IdeologyBalance.ts

import type { NPCFaction } from "../models/NPCInfluence.js";

/**
 * Balance constants for the ideology spread system.
 * Axis-based ideology: each colonist and faction has a position on three axes
 * (solidarity, sovereignty, transformation) ranging from -1 to +1.
 */

// ============ Ideology Spread ============

/** Rate at which ideology drifts toward neighbors per spread tick */
export const IDEOLOGY_SPREAD_RATE = 0.015;

/** Sols between ideology propagation ticks */
export const IDEOLOGY_SPREAD_INTERVAL = 1;

/** How much conviction reduces influence susceptibility (0-1) */
export const CONVICTION_RESISTANCE_FACTOR = 0.75;

/**
 * Minimum relationship strength for ideology to spread.
 * Connections below this threshold do not transmit ideology.
 * This creates ideological "pockets" in the social network where
 * closely-bonded groups maintain distinct beliefs.
 * Set to 0 to disable threshold (all connections spread ideology).
 */
export const IDEOLOGY_SPREAD_CONNECTION_THRESHOLD = 0.4;

/**
 * How strongly ideological distance attenuates influence (0-1).
 * At 0.7: distance 0 → full influence, distance 1.0 → 30% influence, distance 1.43+ → zero.
 * Creates "echo chambers" where like-minded colonists reinforce each other
 * while ideologically distant colonists barely interact.
 */
export const IDEOLOGY_DISTANCE_ATTENUATION = 0.7;

/**
 * Distance attenuation for rally/propaganda effects (0-1).
 * Lower than IDEOLOGY_DISTANCE_ATTENUATION because propaganda campaigns
 * can reach across ideological lines more than casual conversation.
 * At 0.35: distance 1.0 → 42% influence, distance 1.5 → 12% influence.
 */
export const RALLY_DISTANCE_ATTENUATION = 0.5;

// ============ Council Selection ============

/** Minimum council size regardless of population */
export const COUNCIL_SIZE_MIN = 5;

/** Maximum council size regardless of population */
export const COUNCIL_SIZE_MAX = 15;

/** Population per council seat (e.g., 10 = 1 seat per 10 colonists) */
export const COUNCIL_SIZE_PER_POPULATION = 10;

/** Sols between council recalculation */
export const COUNCIL_UPDATE_INTERVAL = 10;

// ============ Project Voting ============

/** Sols between proposal and council vote */
export const PROJECT_VOTING_PERIOD = 5;

// ============ New Colonist Defaults ============

/** Default ideology for new colonists (center of all axes) */
export const NEW_COLONIST_IDEOLOGY = {
  solidarity: 0,
  sovereignty: 0,
  transformation: 0,
  conviction: 0.2,
} as const;

/**
 * Random ideology variation for new colonists (per axis).
 * Each axis gets a random lean in [-range/2, +range/2].
 * This breaks symmetry so new colonists don't all bridge between clusters.
 */
export const NEW_COLONIST_IDEOLOGY_SPREAD = 0.5;

// ============ Ideology Imprinting ============

/**
 * How strongly new colonists adopt their neighbor's ideology (0-1).
 * At 0.7, a neutral colonist near a sovereignty-positive neighbor would
 * shift their sovereignty axis toward that neighbor's position.
 */
export const IDEOLOGY_IMPRINTING_STRENGTH = 0.7;

/**
 * Minimum relationship strength required for imprinting.
 * New colonists only adopt ideology from strong connections (e.g., housemates).
 */
export const IDEOLOGY_IMPRINTING_THRESHOLD = 0.3;

// ============ Conviction Evolution ============

/** Rate at which conviction grows when surrounded by like-minded colonists (per propagation tick) */
export const CONVICTION_GROWTH_RATE = 0.035;

/** Rate at which conviction decays when isolated from faction (per propagation tick) */
export const CONVICTION_DECAY_RATE = 0.03;

/** Natural conviction decay applied to all colonists each tick (represents doubt/questioning) */
export const CONVICTION_NATURAL_DECAY = 0.005;

/** Minimum conviction floor - some baseline conviction always remains */
export const CONVICTION_MIN = 0.1;

/** Maximum conviction ceiling - never fully certain */
export const CONVICTION_MAX = 0.9;

/** Rate at which neutral colonists drift toward neighborhood ideology */
export const NEUTRAL_IDEOLOGY_DRIFT_RATE = 0.06;

// ============ Faction Drift ============

/** Rate at which faction positions drift toward pressure */
export const FACTION_DRIFT_RATE = 0.02;

/** How much average faction conviction dampens drift (0-1) */
export const FACTION_CONVICTION_DAMPENING = 0.6;

/** Rate at which pressure decays toward 0 per sol without reinforcement */
export const FACTION_PRESSURE_DECAY = 0.005;

// ============ Faction Dynamics ============

/** Distance difference before colonist defection pressure builds */
export const DEFECTION_DISTANCE_THRESHOLD = 0.3;

/** Axis distance at which two factions trigger merger */
export const FACTION_CONVERGENCE_THRESHOLD = 0.2;

/** Population ratio below which faction collapses */
export const FACTION_COLLAPSE_POPULATION_RATIO = 0.15;

// ============ Faction Naming ============

/** Axis value threshold for moderate faction name change */
export const FACTION_NAME_THRESHOLD_MODERATE = 0.3;

/** Axis value threshold for extreme faction name change */
export const FACTION_NAME_THRESHOLD_EXTREME = 0.6;

// ============ Starting Faction Positions ============

export const STARTING_FACTION_POSITIONS: readonly {
  baseId: NPCFaction;
  name: string;
  position: { solidarity: number; sovereignty: number; transformation: number };
}[] = [
  {
    baseId: "earth_loyalists" as NPCFaction,
    name: "Earth Loyalists",
    position: { solidarity: 0.0, sovereignty: -0.7, transformation: -0.3 },
  },
  {
    baseId: "mars_independence" as NPCFaction,
    name: "Mars Independence",
    position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 },
  },
  {
    baseId: "corporate_interests" as NPCFaction,
    name: "Corporate Interests",
    position: { solidarity: -0.6, sovereignty: 0.0, transformation: 0.5 },
  },
] as const;

// ============ Neutral Colonist Detection ============

/** How close to origin (0,0,0) to be considered neutral (per axis) */
export const NEUTRAL_AXIS_THRESHOLD = 0.3;

// ============ Conviction Support Detection ============

// ============ Sponsorship ============

/** Score bonus for ideology-aligned colonists during auto-assign */
export const SPONSORSHIP_AFFINITY_WEIGHT = 2;

/** Per-sol ideology nudge toward sponsor faction position */
export const SPONSORSHIP_NUDGE_RATE = 0.008;

/** How much conviction resists nudge (0-1) */
export const SPONSORSHIP_NUDGE_CONVICTION_RESISTANCE = 0.6;

// ============ Conviction Support Detection ============

/** Max axis-space distance for neighbors to be considered "supporting" (conviction growth) */
export const CONVICTION_SUPPORT_DISTANCE = 0.5;

/**
 * Minimum ratio of supporting neighbors (by weight) for conviction to grow.
 * Below this threshold, conviction decays instead.
 * Lower values make it easier to maintain conviction in small groups.
 */
export const CONVICTION_SUPPORT_THRESHOLD = 0.25;
