// src/core/balance/IdeologyBalance.ts

/**
 * Balance constants for the ideology spread system.
 */

// ============ Ideology Spread ============

/** Rate at which ideology drifts toward neighbors per spread tick */
export const IDEOLOGY_SPREAD_RATE = 0.005;

/** Sols between ideology propagation ticks */
export const IDEOLOGY_SPREAD_INTERVAL = 5;

/** How much conviction reduces influence susceptibility (0-1) */
export const CONVICTION_RESISTANCE_FACTOR = 0.8;

/** Affinity threshold below which colonist is considered "neutral" */
export const IDEOLOGY_NEUTRAL_THRESHOLD = 0.3;

// ============ Council Selection ============

/** Minimum council size regardless of population */
export const COUNCIL_SIZE_MIN = 5;

/** Maximum council size regardless of population */
export const COUNCIL_SIZE_MAX = 15;

/** Population per council seat (e.g., 10 = 1 seat per 10 colonists) */
export const COUNCIL_SIZE_PER_POPULATION = 10;

/** Sols between council recalculation */
export const COUNCIL_UPDATE_INTERVAL = 30;

// ============ Project Voting ============

/** Sols between proposal and council vote */
export const PROJECT_VOTING_PERIOD = 10;

// ============ Project Support Requirements ============

/** Support required for minor faction projects */
export const PROJECT_SUPPORT_MINOR = 0.2;

/** Support required for major faction projects */
export const PROJECT_SUPPORT_MAJOR = 0.35;

/** Support required for victory-path projects */
export const PROJECT_SUPPORT_VICTORY = 0.5;

// ============ Project Morale Effects ============

/** Morale boost for colonists with affinity >= 0.7 to project faction */
export const PROJECT_MORALE_STRONG_SUPPORTER = 0.15;

/** Morale boost for colonists with affinity 0.4-0.7 to project faction */
export const PROJECT_MORALE_SUPPORTER = 0.05;

/** Morale penalty for colonists whose primary faction differs */
export const PROJECT_MORALE_OPPOSED = -0.05;

/** Morale penalty for high-conviction colonists of opposing faction */
export const PROJECT_MORALE_STRONGLY_OPPOSED = -0.1;

/** Conviction threshold above which opposition is "strong" */
export const PROJECT_MORALE_CONVICTION_THRESHOLD = 0.6;

// ============ Project Conviction Effects ============

/** Conviction boost for council members who voted for a passed project */
export const PROJECT_CONVICTION_BOOST_VOTER = 0.1;

/** Conviction boost for colonists with strong affinity (>=0.7) to project faction */
export const PROJECT_CONVICTION_BOOST_STRONG_SUPPORTER = 0.08;

/** Conviction boost for colonists with moderate affinity (0.4-0.7) to project faction */
export const PROJECT_CONVICTION_BOOST_SUPPORTER = 0.04;

// ============ New Colonist Defaults ============

/** Default ideology for new colonists (neutral with low conviction) */
export const NEW_COLONIST_IDEOLOGY = {
  earthLoyalist: 0.33,
  marsIndependence: 0.33,
  corporateInterests: 0.33,
  conviction: 0.2,
} as const;

// ============ Lobbying ============

/** Base cost in materials to lobby a council member */
export const LOBBY_BASE_COST = 15;

/** How much lobbying boosts the target faction affinity (0-1 scale) */
export const LOBBY_AFFINITY_BOOST = 0.15;

/** Cost multiplier based on colonist's influence (higher influence = more expensive) */
export const LOBBY_INFLUENCE_COST_MULTIPLIER = 10;

/** Minimum affinity boost option */
export const LOBBY_MIN_BOOST = 0.05;

/** Maximum affinity boost option */
export const LOBBY_MAX_BOOST = 0.25;
