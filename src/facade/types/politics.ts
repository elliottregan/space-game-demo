// src/facade/types/politics.ts
import type { FactionDemand, NPCFaction } from "../../core/models/NPCInfluence";

export interface FactionStatus {
  id: NPCFaction;
  name: string;
  support: number;
  activeDemand: FactionDemand | null;
}

export interface PoliticsSnapshot {
  readonly factions: readonly FactionStatus[];
  readonly demands: readonly FactionDemand[];
}

export type { NPCFaction, FactionDemand };
