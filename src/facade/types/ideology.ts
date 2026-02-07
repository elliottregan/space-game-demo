// src/facade/types/ideology.ts

import type { ColonistIdeology } from "../../core/models/Colonist";

/**
 * Council member data for UI display.
 */
export interface CouncilMemberSnapshot {
  colonistId: string;
  name: string;
  centrality: number;
  conviction: number;
  influence: number;
  factionId: string | null;
}

/**
 * Snapshot of a faction's current state for UI display.
 */
export interface FactionSnapshot {
  id: string;
  name: string;
  baseId: string;
  position: { solidarity: number; sovereignty: number; transformation: number };
  pressure: { solidarity: number; sovereignty: number; transformation: number };
}

/**
 * Complete ideology state snapshot for UI.
 */
export interface IdeologySnapshot {
  /** Current council members (high-influence colonists) */
  council: CouncilMemberSnapshot[];
  /** Council seat counts by faction id (includes "neutral" key) */
  councilFactionCounts: Record<string, number>;
  /** Colony-wide faction support levels keyed by faction id (0-1, sums to 1) */
  factionSupport: Record<string, number>;
  /** Current faction states */
  factions: FactionSnapshot[];
}

/**
 * Project proposal eligibility check result.
 */
export interface ProjectEligibility {
  canPropose: boolean;
  currentSupport: number;
  requiredSupport: number;
  reason?: string;
  isCompleted?: boolean;
  isPending?: boolean;
  isFailed?: boolean;
}

// Re-export ColonistIdeology for convenience
export type { ColonistIdeology };
