// src/core/balance/GrantBalance.ts

/** Sols between grant refreshes */
export const GRANT_REFRESH_INTERVAL = 40;

/** Number of grants offered per refresh */
export const GRANTS_PER_REFRESH = 3;

/** Maximum total active grants at once */
export const MAX_ACTIVE_GRANTS = 5;

/** Maximum active grants from a single source */
export const MAX_GRANTS_PER_SOURCE = 2;

/** Earliest sol grants can appear */
export const GRANT_MIN_SOL = 15;

/** Per-axis ideology shift strength when a grant is assigned */
export const GRANT_IDEOLOGY_SHIFT_BASE = 0.12;

/** How much conviction blocks ideology shift (0-1) */
export const GRANT_CONVICTION_RESISTANCE = 0.7;
