// src/facade/domains/PoliticsFacade.ts
// Politics facade - provides faction support from the ideology system

import type { GameState } from "../../core/GameState";

export interface FactionStatus {
  factionId: string;
  name: string;
  support: number;
  position: { solidarity: number; sovereignty: number; transformation: number };
}

export interface PoliticsSnapshot {
  factions: readonly FactionStatus[];
}

export class PoliticsFacade {
  constructor(private gameState: GameState) {}

  snapshot(): PoliticsSnapshot {
    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();
    const factionSupport = this.gameState.ideology.calculateFactionSupport(
      colonists,
      relationshipManager,
    );

    const dynamicFactions = this.gameState.ideology.getFactions();

    const factions: FactionStatus[] = dynamicFactions.map((faction) => ({
      factionId: faction.id,
      name: faction.name,
      support: factionSupport[faction.id] ?? 0,
      position: { ...faction.position },
    }));

    return {
      factions: Object.freeze(factions),
    };
  }
}
