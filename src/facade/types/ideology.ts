// src/facade/types/ideology.ts

import type { NPCFaction } from "../../core/models/NPCInfluence";
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
  faction: NPCFaction | null;
}

/**
 * Faction support levels across the colony.
 */
export interface FactionSupportSnapshot {
  earthLoyalists: number;
  marsIndependence: number;
  corporateInterests: number;
}

/**
 * Complete ideology state snapshot for UI.
 */
export interface IdeologySnapshot {
  /** Current council members (high-influence colonists) */
  council: CouncilMemberSnapshot[];
  /** Council seat counts by faction */
  councilFactionCounts: Record<NPCFaction | "neutral", number>;
  /** Colony-wide faction support levels (0-1) */
  factionSupport: FactionSupportSnapshot;
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

/**
 * Lobby action eligibility check result.
 */
export interface LobbyEligibility {
  canLobby: boolean;
  cost: number;
  reason?: string;
}

// Re-export ColonistIdeology for convenience
export type { ColonistIdeology };
