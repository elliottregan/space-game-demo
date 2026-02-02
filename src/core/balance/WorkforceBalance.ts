/** Number of skills assigned to each colonist (min, max) */
export const COLONIST_SKILL_COUNT = { min: 1, max: 2 };

// Job assignment system constants
export const ROLE_MISMATCH_PENALTY = 0.3; // 30% efficiency penalty
export const LABOR_POOL_BONUS_PER_COLONIST = 0.02; // +2% construction speed
export const LABOR_POOL_BONUS_CAP = 0.2; // +20% max
export const STAFFING_CURVE_EXPONENT = 1.5; // Diminishing returns curve

// ============ Coworker Relationship System ============

/** Amount relationship strength increases per sol when colonists work together */
export const COWORKER_BONDING_RATE = 0.01;

/** Maximum relationship strength between coworkers */
export const MAX_COWORKER_RELATIONSHIP = 1.0;

/** Minimum relationship strength (floor for coworkers who have worked together) */
export const MIN_COWORKER_RELATIONSHIP = 0.05;

/** Decay rate for coworker relationships when not working together */
export const COWORKER_RELATIONSHIP_DECAY = 0.002;

/** Maximum team cohesion bonus to building efficiency */
export const MAX_TEAM_COHESION_BONUS = 0.15; // +15% max

/** Minimum average relationship strength needed for any team bonus */
export const TEAM_COHESION_THRESHOLD = 0.2;

/** Initial relationship strength when colonists first work together */
export const INITIAL_COWORKER_RELATIONSHIP = 0.1;

// ============ Housemate Relationship System ============

/** Amount relationship strength increases per sol when colonists share housing */
export const HOUSEMATE_BONDING_RATE = 0.015;

/** Initial relationship strength when colonists first share housing */
export const INITIAL_HOUSEMATE_RELATIONSHIP = 0.15;

// ============ Cohort Effect System ============

/** Sol window for colonists to be considered part of the same cohort */
export const COHORT_WINDOW_SOLS = 10;

/** Bonding rate multiplier for cohort members (colonists who arrived together) */
export const COHORT_BONDING_MULTIPLIER = 1.5;

/** Initial relationship bonus for cohort members meeting for the first time */
export const COHORT_INITIAL_BONUS = 0.05;

// ============ Preferential Attachment System ============

/** Base probability for forming a new connection with a stranger */
export const BASE_CONNECTION_PROBABILITY = 0.01;

/** How much existing connections increase probability of new connections */
export const PREFERENTIAL_ATTACHMENT_FACTOR = 0.1;

/** Maximum connection probability from preferential attachment */
export const MAX_CONNECTION_PROBABILITY = 0.15;

/** Minimum connections before preferential attachment kicks in */
export const PREFERENTIAL_ATTACHMENT_THRESHOLD = 2;

// ============ Weak Ties (Granovetter) System ============

/** Threshold below which a relationship is considered a "weak tie" */
export const WEAK_TIE_THRESHOLD = 0.3;

/** Information spread bonus through weak ties (multiplier) */
export const WEAK_TIE_INFORMATION_BONUS = 1.5;

/** Morale spread through weak ties when positive events happen */
export const WEAK_TIE_MORALE_SPREAD = 0.02;

/** Bridging value bonus for colonists who connect otherwise disconnected groups */
export const BRIDGE_COLONIST_BONUS = 0.1;

// ============ Guild System ============

/** Bonding rate multiplier for guild members */
export const GUILD_BONDING_MULTIPLIER = 1.25;

/** Maximum number of guilds a colonist can join */
export const MAX_GUILD_MEMBERSHIPS = 3;

/** Minimum colonists required to form a guild */
export const MIN_GUILD_SIZE = 2;

/** Maximum guild size */
export const MAX_GUILD_SIZE = 8;

/** Initial relationship bonus when joining the same guild */
export const GUILD_INITIAL_RELATIONSHIP_BONUS = 0.08;

/** Morale bonus per guild membership */
export const GUILD_MORALE_BONUS = 2;

// ============ Guild Formation System ============

/** Sols between guild formation checks */
export const GUILD_FORMATION_CHECK_INTERVAL = 10;

/** Minimum relationship strength for guild formation eligibility */
export const GUILD_FORMATION_RELATIONSHIP_THRESHOLD = 0.7;

/** Minimum relationship strength to join an existing guild */
export const GUILD_JOIN_RELATIONSHIP_THRESHOLD = 0.5;

/** Base probability of guild forming when eligible colonists found */
export const GUILD_FORMATION_BASE_PROBABILITY = 0.5;

/** Probability multiplier per existing guild membership (compounds) */
export const GUILD_FORMATION_MEMBERSHIP_PENALTY = 0.5;

/** Minimum colony population for guild formation */
export const GUILD_FORMATION_MIN_POPULATION = 4;

/** Maximum number of founders when forming a new guild */
export const GUILD_FORMATION_MAX_FOUNDERS = 4;

// ============ Social Cohesion System ============

/**
 * Morale modifier based on colony social cohesion.
 * Applied per sol based on colony-wide clustering coefficient.
 */
export const SOCIAL_COHESION = {
  /** Cohesion above this provides morale bonus */
  HIGH_THRESHOLD: 0.4,
  /** Cohesion below this triggers morale penalty and warning */
  LOW_THRESHOLD: 0.15,
  /** Cohesion below this triggers critical warning */
  CRITICAL_THRESHOLD: 0.08,
  /** Maximum morale bonus per sol from high cohesion */
  MAX_MORALE_BONUS: 0.3,
  /** Maximum morale penalty per sol from low cohesion */
  MAX_MORALE_PENALTY: 0.5,
  /** Minimum connections before a colonist is considered isolated */
  ISOLATION_CONNECTION_THRESHOLD: 1,
  /** Sols an isolated colonist must remain isolated before event triggers */
  ISOLATION_WARNING_DELAY: 10,
} as const;

/** Initial relationship strength between starting colonists (they trained together) */
export const INITIAL_COLONIST_RELATIONSHIP = 0.15;

// ============ Social Building (Third Space) System ============

/** Initial relationship strength when colonists first meet at a social building */
export const INITIAL_SOCIAL_RELATIONSHIP = 0.12;

/** Base bonding rate per sol at social buildings (before multiplier) */
export const SOCIAL_BONDING_RATE = 0.012;

/** Decay rate for social relationships when no longer sharing a social building */
export const SOCIAL_RELATIONSHIP_DECAY = 0.003;

/** Number of random colonists to bond with per tick at each social building */
export const SOCIAL_BONDS_PER_TICK = 2;
