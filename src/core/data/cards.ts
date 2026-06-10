// Card pool — the static deck content + the types describing it.
// Types: Card, CardKind, Role, Rank, EffectSpec, … (Ideology lives in ./ideologies.ts)

import type { Ideology } from "./ideologies.ts";
import { IDEOLOGIES } from "./ideologies.ts";

// -------------------------------------------------------------------------
// Ideology + Role taxonomy
// -------------------------------------------------------------------------

export { type Ideology, IDEOLOGIES } from "./ideologies.ts";

export type CardIdeology = Ideology | "wild";

export type Role = "agitator" | "scholar" | "preacher" | "engineer" | "architect";

export const ROLE_RANK: Record<Role, 10 | 11 | 12 | 13 | 14> = {
  agitator: 10,
  scholar: 11,
  preacher: 12,
  engineer: 13,
  architect: 14,
};

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

// -------------------------------------------------------------------------
// Card kinds and tags
// -------------------------------------------------------------------------

export type CardKind = "land" | "role" | "charter" | "dissent" | "legacy";

export type CardTag = "dissent" | "charter" | "legacy";

// -------------------------------------------------------------------------
// Effect DSL — serializable
// -------------------------------------------------------------------------

export type Timing = "immediate" | "end-of-turn";

export type EffectSpec =
  | { kind: "gainInfluence"; amount: number; timing: "immediate" }
  | { kind: "draw"; count: number; timing: "immediate" }
  | { kind: "addDissent"; amount: number; timing: "end-of-turn" }
  | { kind: "removeDissent"; amount: number; timing: "immediate" }
  | { kind: "noop"; timing: "immediate" }
  | { kind: "compound"; effects: EffectSpec[] };

// -------------------------------------------------------------------------
// Card
// -------------------------------------------------------------------------

export interface Card {
  id: string;
  name: string;
  kind: CardKind;
  rank: Rank;
  ideology: CardIdeology;
  role?: Role;
  influenceCost: number;
  effect: EffectSpec;
  tags: CardTag[];
  flavor?: string;
}

// -------------------------------------------------------------------------
// Naming tables (spec §6)
// -------------------------------------------------------------------------

const ROLE_NAMES: Record<Role, Record<Ideology, string>> = {
  agitator: {
    solidarity: "The Organizer",
    sovereignty: "The Demagogue",
    transformation: "The Rebel",
    heritage: "The Elder",
  },
  scholar: {
    solidarity: "The Teacher",
    sovereignty: "The Archivist",
    transformation: "The Researcher",
    heritage: "The Historian",
  },
  preacher: {
    solidarity: "The Mediator",
    sovereignty: "The Orator",
    transformation: "The Prophet",
    heritage: "The Chronicler",
  },
  engineer: {
    solidarity: "The Builder",
    sovereignty: "The Industrialist",
    transformation: "The Inventor",
    heritage: "The Restorer",
  },
  architect: {
    solidarity: "The Founder",
    sovereignty: "The Sovereign",
    transformation: "The Visionary",
    heritage: "The Patriarch",
  },
};

const LAND_NAMES: Record<number, Record<Ideology, string>> = {
  2: { solidarity: "Commons", sovereignty: "Outpost", transformation: "Lab", heritage: "Shrine" },
  3: {
    solidarity: "Hearth",
    sovereignty: "Watchtower",
    transformation: "Workshop",
    heritage: "Chapel",
  },
  4: {
    solidarity: "Plaza",
    sovereignty: "Barracks",
    transformation: "Foundry",
    heritage: "Archive",
  },
  5: {
    solidarity: "Assembly",
    sovereignty: "Vault",
    transformation: "Forge",
    heritage: "Reliquary",
  },
  6: {
    solidarity: "Forum",
    sovereignty: "Armory",
    transformation: "Synthesizer",
    heritage: "Sanctum",
  },
  7: {
    solidarity: "Amphitheatre",
    sovereignty: "Fortress",
    transformation: "Spire",
    heritage: "Memorial",
  },
  8: {
    solidarity: "Quarter",
    sovereignty: "Citadel",
    transformation: "Gateway",
    heritage: "Mausoleum",
  },
  9: {
    solidarity: "Capital",
    sovereignty: "Palace",
    transformation: "Nexus",
    heritage: "Monument",
  },
};

// -------------------------------------------------------------------------
// Effect builders
// -------------------------------------------------------------------------

const compound = (...effects: EffectSpec[]): EffectSpec => ({ kind: "compound", effects });

const gainInf = (n: number): EffectSpec => ({
  kind: "gainInfluence",
  amount: n,
  timing: "immediate",
});
const draw = (n: number): EffectSpec => ({ kind: "draw", count: n, timing: "immediate" });
const addDissent = (n = 1): EffectSpec => ({
  kind: "addDissent",
  amount: n,
  timing: "end-of-turn",
});
const removeDissent = (n: number): EffectSpec => ({
  kind: "removeDissent",
  amount: n,
  timing: "immediate",
});
const noop: EffectSpec = { kind: "noop", timing: "immediate" };

// -------------------------------------------------------------------------
// Role card effect tables
// -------------------------------------------------------------------------

type RoleEffect = { influenceCost: number; effect: EffectSpec };

// Pattern: Sovereignty gets bigger numbers at the cost of a Dissent;
// Heritage cleans Dissent; Transformation draws; Solidarity is steady.
// Engineer effects are placeholders since the materials system was removed.
const ROLE_EFFECTS: Record<Role, Record<Ideology, RoleEffect>> = {
  agitator: {
    solidarity: { influenceCost: 1, effect: gainInf(1) },
    sovereignty: { influenceCost: 1, effect: compound(gainInf(2), addDissent(1)) },
    transformation: { influenceCost: 1, effect: gainInf(1) },
    heritage: { influenceCost: 1, effect: compound(gainInf(1), addDissent(1)) },
  },
  scholar: {
    solidarity: { influenceCost: 2, effect: compound(draw(1), gainInf(1)) },
    sovereignty: { influenceCost: 2, effect: compound(draw(2), addDissent(1)) },
    transformation: { influenceCost: 2, effect: draw(2) },
    heritage: { influenceCost: 2, effect: compound(draw(1), removeDissent(1)) },
  },
  preacher: {
    solidarity: { influenceCost: 2, effect: gainInf(1) },
    sovereignty: { influenceCost: 2, effect: compound(gainInf(2), addDissent(1)) },
    transformation: { influenceCost: 3, effect: compound(draw(2), addDissent(1)) },
    heritage: { influenceCost: 2, effect: removeDissent(2) },
  },
  engineer: {
    solidarity: { influenceCost: 2, effect: gainInf(2) },
    sovereignty: { influenceCost: 2, effect: compound(gainInf(3), addDissent(1)) },
    transformation: { influenceCost: 2, effect: compound(draw(1), gainInf(1)) },
    heritage: { influenceCost: 2, effect: compound(gainInf(1), removeDissent(1)) },
  },
  architect: {
    solidarity: { influenceCost: 3, effect: compound(gainInf(2), draw(2)) },
    sovereignty: { influenceCost: 3, effect: compound(gainInf(3), addDissent(1)) },
    transformation: { influenceCost: 3, effect: compound(gainInf(2), draw(1)) },
    heritage: { influenceCost: 3, effect: compound(gainInf(1), draw(1), removeDissent(2)) },
  },
};

// -------------------------------------------------------------------------
// Card id helpers (stable)
// -------------------------------------------------------------------------

export function roleId(role: Role, ideology: Ideology): string {
  return `role-${role}-${ideology}`;
}

export function landId(rank: number, ideology: Ideology): string {
  return `land-${rank}-${ideology}`;
}

// -------------------------------------------------------------------------
// Builders
// -------------------------------------------------------------------------

const ROLES: Role[] = ["agitator", "scholar", "preacher", "engineer", "architect"];

function buildRoles(): Card[] {
  const cards: Card[] = [];
  for (const role of ROLES) {
    for (const ideology of IDEOLOGIES) {
      const { influenceCost, effect } = ROLE_EFFECTS[role][ideology];
      cards.push({
        id: roleId(role, ideology),
        name: ROLE_NAMES[role][ideology],
        kind: "role",
        rank: ROLE_RANK[role],
        ideology,
        role,
        influenceCost,
        effect,
        tags: [],
      });
    }
  }
  return cards;
}

function buildLands(): Card[] {
  const cards: Card[] = [];
  for (let rank = 2; rank <= 9; rank++) {
    for (const ideology of IDEOLOGIES) {
      cards.push({
        id: landId(rank, ideology),
        name: LAND_NAMES[rank][ideology],
        kind: "land",
        rank: rank as Card["rank"],
        ideology,
        influenceCost: 0,
        effect: noop,
        tags: [],
      });
    }
  }
  return cards;
}

function buildCharters(): Card[] {
  const tags: CardTag[] = ["charter"];
  return [
    {
      id: "keystone-pioneer",
      name: "The Pioneer",
      kind: "charter",
      rank: 15,
      ideology: "wild",
      influenceCost: 3,
      effect: draw(2),
      tags,
      flavor: "Wild role, wild suit. No Dissent.",
    },
    {
      id: "keystone-apostle",
      name: "The Apostle",
      kind: "charter",
      rank: 15,
      ideology: "wild",
      influenceCost: 2,
      effect: compound(gainInf(2), addDissent(1)),
      tags,
      flavor: "Wild role, wild suit. Stirs Dissent.",
    },
    {
      id: "keystone-navigators-compass",
      name: "The Navigator's Compass",
      kind: "charter",
      rank: 15,
      ideology: "transformation",
      influenceCost: 2,
      effect: draw(2),
      tags,
      flavor: "Keystone — The Ark.",
    },
    {
      id: "keystone-founding-charter",
      name: "The Founding Charter",
      kind: "charter",
      rank: 15,
      ideology: "solidarity",
      influenceCost: 2,
      effect: gainInf(2),
      tags,
      flavor: "Keystone — The Commune.",
    },
    {
      id: "keystone-critical-mass",
      name: "Critical Mass",
      kind: "charter",
      rank: 15,
      ideology: "sovereignty",
      influenceCost: 3,
      effect: compound(gainInf(2), draw(1)),
      tags,
      flavor: "Keystone — The Reactor.",
    },
  ];
}

// -------------------------------------------------------------------------
// Export: the full card registry
// -------------------------------------------------------------------------

export const ALL_CARDS: Card[] = [...buildRoles(), ...buildLands(), ...buildCharters()];

export const CARD_BY_ID: Record<string, Card> = Object.fromEntries(
  ALL_CARDS.map((c) => [c.id, c] as const),
);

export function getCard(id: string): Card {
  const c = CARD_BY_ID[id];
  if (!c) throw new Error(`Unknown card id: ${id}`);
  return c;
}

export function cloneCard(card: Card, suffix: string): Card {
  return { ...card, id: `${card.id}#${suffix}` };
}

// Dissent cards (generated in-game). Pure deck clog: unplayable, no effect.
export function makeDissent(): Card {
  return {
    id: `dissent-${Math.random().toString(36).slice(2, 8)}`,
    name: "Dissent",
    kind: "dissent",
    rank: 2, // unplayable; rank irrelevant but keep >= 2 for type
    ideology: "wild",
    influenceCost: 99,
    effect: noop,
    tags: ["dissent"],
    flavor: "Unplayable. Clogs the deck.",
  };
}
