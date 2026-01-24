// src/facade/domains/PoliticsFacade.ts
// Politics facade - now wraps NPCInfluenceManager

import type { GameState } from "../../core/GameState";
import type { NPCFaction, FactionDemand } from "../../core/models/NPCInfluence";

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

export class PoliticsFacade {
  constructor(private gameState: GameState) {}

  snapshot(): PoliticsSnapshot {
    const factionSupport = this.gameState.npcInfluence.getFactionSupport();
    const demands = this.gameState.npcInfluence.getActiveDemands();

    const factionNames: Record<NPCFaction, string> = {
      earth_loyalists: "Earth Loyalists",
      mars_independence: "Mars Independence",
      corporate_interests: "Corporate Interests",
    };

    const factions: FactionStatus[] = (
      ['earth_loyalists', 'mars_independence', 'corporate_interests'] as NPCFaction[]
    ).map(id => ({
      id,
      name: factionNames[id],
      support: factionSupport[id],
      activeDemand: demands.find(d => d.factionId === id) ?? null,
    }));

    return {
      factions: Object.freeze(factions),
      demands: Object.freeze([...demands]),
    };
  }
}
