// src/facade/domains/PoliticsFacade.ts
// Politics facade - provides faction support from the ideology system

import type { GameState } from "../../core/GameState";
import { ALL_FACTIONS, type FactionDemand, NPCFaction } from "../../core/models/NPCInfluence";

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
    // Get faction support from ideology system
    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();
    const factionSupport = this.gameState.ideology.calculateFactionSupport(
      colonists,
      relationshipManager,
    );

    const factions: FactionStatus[] = ALL_FACTIONS.map((id) => {
      let support = 0;
      switch (id) {
        case NPCFaction.EarthLoyalists:
          support = factionSupport.earthLoyalists;
          break;
        case NPCFaction.MarsIndependence:
          support = factionSupport.marsIndependence;
          break;
        case NPCFaction.CorporateInterests:
          support = factionSupport.corporateInterests;
          break;
      }

      return {
        id,
        name: FACTION_NAMES[id],
        support,
        activeDemand: null, // Demands are no longer supported
      };
    });

    return {
      factions: Object.freeze(factions),
      demands: Object.freeze([]), // No more demands in the new system
    };
  }
}
