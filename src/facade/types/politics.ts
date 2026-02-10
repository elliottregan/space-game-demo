// src/facade/types/politics.ts

export interface FactionStatus {
  factionId: string;
  name: string;
  support: number;
  position: { solidarity: number; sovereignty: number; transformation: number };
}

export interface PoliticsSnapshot {
  readonly factions: readonly FactionStatus[];
}
