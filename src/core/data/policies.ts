// Policy card data for the M4 Policy Tableau feature.
// Types live here next to their data (same convention as Card in data/cards.ts).
// PolicyModifier and PolicyCard are re-exported from src/core/types.ts.

import type { Ideology } from "./ideologies.ts";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export interface PolicyModifier {
  /** Hand draw-target delta. */
  handSize?: number;
  /** Influence baseline delta. */
  influence?: number;
  /** Per-column storage capacity delta. */
  storage?: number;
  /** Cards kept (not cycled) at end of turn. */
  endTurnKeep?: number;
  /** Dissent removed at start of turn. */
  dissentPurge?: number;
  /** Dissent added at start of turn (a cost). */
  dissentAdd?: number;
}

export interface PolicyCard {
  id: string;
  name: string;
  /** Which ideology deck this card belongs to. */
  ideology: Ideology;
  flavor: string;
  /** Applied × stacks. */
  base: PolicyModifier;
  /** Optional: + mod × floor(ideologyInfluence[scale.ideology] / per) × stacks. */
  scale?: {
    ideology: Ideology;
    per: number;
    mod: PolicyModifier;
  };
}

// -------------------------------------------------------------------------
// The 8 launch cards
// -------------------------------------------------------------------------

const MOBILIZE: PolicyCard = {
  id: "mobilize",
  name: "Mobilize",
  ideology: "solidarity",
  flavor: "Every voice counts when the call goes out.",
  base: { handSize: 1 },
};

const SOLIDARITY_FOREVER: PolicyCard = {
  id: "solidarity-forever",
  name: "Solidarity Forever",
  ideology: "solidarity",
  flavor: "Unity compounds: the more you build together, the more you can hold.",
  base: { handSize: 1 },
  scale: { ideology: "solidarity", per: 4, mod: { handSize: 1 } },
};

const MANDATE: PolicyCard = {
  id: "mandate",
  name: "Mandate",
  ideology: "sovereignty",
  flavor: "Authority properly exercised expands what is possible.",
  base: { influence: 1 },
};

const CONSCRIPTION: PolicyCard = {
  id: "conscription",
  name: "Conscription",
  ideology: "sovereignty",
  flavor: "The state's needs demand a toll from its people.",
  base: { influence: 2, dissentAdd: 1 },
};

const STOCKPILE: PolicyCard = {
  id: "stockpile",
  name: "Stockpile",
  ideology: "transformation",
  flavor: "What is gathered now shapes what can be built tomorrow.",
  base: { storage: 1 },
};

const DEEP_RESERVES: PolicyCard = {
  id: "deep-reserves",
  name: "Deep Reserves",
  ideology: "transformation",
  flavor: "The deeper your investment in change, the more you can hold in reserve.",
  base: { storage: 1 },
  scale: { ideology: "transformation", per: 2, mod: { storage: 1 } },
};

const CONTINUITY: PolicyCard = {
  id: "continuity",
  name: "Continuity",
  ideology: "heritage",
  flavor: "Old ways of clearing the noise make room for what endures.",
  base: { dissentPurge: 1 },
};

const ARCHIVE: PolicyCard = {
  id: "archive",
  name: "Archive",
  ideology: "heritage",
  flavor: "Some knowledge is worth carrying forward, turn after turn.",
  base: { endTurnKeep: 1 },
};

// -------------------------------------------------------------------------
// Exports
// -------------------------------------------------------------------------

export const ALL_POLICIES: PolicyCard[] = [
  MOBILIZE,
  SOLIDARITY_FOREVER,
  MANDATE,
  CONSCRIPTION,
  STOCKPILE,
  DEEP_RESERVES,
  CONTINUITY,
  ARCHIVE,
];

/** 4 copies of each of the ideology's 2 cards = 8-card deck per ideology. */
export const POLICY_DECKS: Record<Ideology, PolicyCard[]> = {
  solidarity: [
    MOBILIZE,
    MOBILIZE,
    MOBILIZE,
    MOBILIZE,
    SOLIDARITY_FOREVER,
    SOLIDARITY_FOREVER,
    SOLIDARITY_FOREVER,
    SOLIDARITY_FOREVER,
  ],
  sovereignty: [
    MANDATE,
    MANDATE,
    MANDATE,
    MANDATE,
    CONSCRIPTION,
    CONSCRIPTION,
    CONSCRIPTION,
    CONSCRIPTION,
  ],
  transformation: [
    STOCKPILE,
    STOCKPILE,
    STOCKPILE,
    STOCKPILE,
    DEEP_RESERVES,
    DEEP_RESERVES,
    DEEP_RESERVES,
    DEEP_RESERVES,
  ],
  heritage: [CONTINUITY, CONTINUITY, CONTINUITY, CONTINUITY, ARCHIVE, ARCHIVE, ARCHIVE, ARCHIVE],
};

/** Lookup a policy card by id. Throws if not found. */
export function getPolicy(id: string): PolicyCard {
  const card = POLICY_BY_ID[id];
  if (!card) throw new Error(`Unknown policy card id: "${id}"`);
  return card;
}

export const POLICY_BY_ID: Record<string, PolicyCard> = Object.fromEntries(
  ALL_POLICIES.map((c) => [c.id, c]),
);
