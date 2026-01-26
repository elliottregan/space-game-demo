// src/facade/domains/PoliticsFacade.ts
// Politics facade - now wraps NPCInfluenceManager

import type { GameState } from "../../core/GameState";
import { NPCFaction, ALL_FACTIONS, type FactionDemand } from "../../core/models/NPCInfluence";

export interface FactionStatus {
  id: NPCFaction;
  name: string;
  support: number;
  activeDemand: FactionDemand | null;
}

export interface PoliticsSnapshot {
  factions: readonly FactionStatus[];
  demands: readonly FactionDemand[];
}

const FACTION_NAMES: Record<NPCFaction, string> = {
  [NPCFaction.EarthLoyalists]: "Earth Loyalists",
  [NPCFaction.MarsIndependence]: "Mars Independence",
  [NPCFaction.CorporateInterests]: "Corporate Interests",
};

export class PoliticsFacade {
  constructor(private gameState: GameState) {}

  snapshot(): PoliticsSnapshot {
    const factionSupport = this.gameState.npcInfluence.getFactionSupport();
    const demands = this.gameState.npcInfluence.getActiveDemands();

    const factions: FactionStatus[] = ALL_FACTIONS.map((id) => ({
      id,
      name: FACTION_NAMES[id],
      support: factionSupport[id],
      activeDemand: demands.find((d) => d.factionId === id) ?? null,
    }));

    return {
      factions: Object.freeze(factions),
      demands: Object.freeze([...demands]),
    };
  }
}
