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

/** The ranks a live card may hold: lands 2–9, roles 10–14. EXCLUDES 15
 *  (the deleted charter rank — charters are gone). This — NOT the `Rank` type
 *  union (which still contains 15) — is the domain a `countsAs.rank: "any"`
 *  expands to and the straight window scans. */
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

// -------------------------------------------------------------------------
// Card kinds and tags
// -------------------------------------------------------------------------

export type CardKind = "land" | "role" | "dissent" | "legacy";

export type CardTag = "dissent" | "legacy";

export type RowKind = "land" | "role"; // the two playable rows (charter is gone)

/** One substitution descriptor: the dimensions this card MAY count as for
 *  EVALUATION only (pattern, flush, promotion-detection). Each field is
 *  optional; absent ⇒ "no override on this dimension — use the literal".
 *  `"any"` is the full-wild marker; an array enumerates a finite OR-set
 *  (future partial wilds, e.g. rank [5, 10]). The ideology array element type
 *  is `Ideology` (the 4 real colors), NOT `CardIdeology` — a countsAs ideology
 *  override can never re-introduce the "wild" sentinel. */
export interface CountsAs {
  rank?: Rank[] | "any";
  ideology?: Ideology[] | "any";
  kind?: RowKind[] | "any";
}

/** A full joker: counts as any rank, any ideology, either row. */
export const FULL_JOKER: CountsAs = { rank: "any", ideology: "any", kind: "any" };

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
  /** Optional evaluation modifiers (rank/ideology/row). Absent ⇒ counts as
   *  exactly its literal rank/ideology/kind. A full joker carries FULL_JOKER.
   *  Wildness is keyed on `countsAs !== undefined`, NEVER on ideology === "wild". */
  countsAs?: CountsAs;
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

function buildJokers(): Card[] {
  // Former charter cards. They lose kind:"charter" (that row is gone) and
  // become full-joker wilds via countsAs: FULL_JOKER — any rank, any ideology,
  // either row, for EVALUATION only. Their literal kind/rank/ideology survive
  // for display, cost, effect, and deck-filter identity (the resolver ignores
  // all three). Literal ranks are pinned inside RANKS [2..14], never 15.
  return [
    {
      id: "keystone-pioneer",
      name: "The Pioneer",
      kind: "role",
      rank: 14,
      ideology: "transformation",
      influenceCost: 3,
      effect: draw(2),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Wild role, wild suit. No Dissent.",
    },
    {
      id: "keystone-apostle",
      name: "The Apostle",
      kind: "role",
      rank: 14,
      ideology: "heritage",
      influenceCost: 2,
      effect: compound(gainInf(2), addDissent(1)),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Wild role, wild suit. Stirs Dissent.",
    },
    {
      id: "keystone-navigators-compass",
      name: "The Navigator's Compass",
      kind: "role",
      rank: 14,
      ideology: "transformation",
      influenceCost: 2,
      effect: draw(2),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Keystone — The Ark.",
    },
    {
      id: "keystone-founding-charter",
      name: "The Founding Charter",
      kind: "land",
      rank: 9,
      ideology: "solidarity",
      influenceCost: 2,
      effect: gainInf(2),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Keystone — The Commune.",
    },
    {
      id: "keystone-critical-mass",
      name: "Critical Mass",
      kind: "role",
      rank: 14,
      ideology: "sovereignty",
      influenceCost: 3,
      effect: compound(gainInf(2), draw(1)),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Keystone — The Reactor.",
    },
  ];
}

// -------------------------------------------------------------------------
// Export: the full card registry
// -------------------------------------------------------------------------

export const ALL_CARDS: Card[] = [...buildRoles(), ...buildLands(), ...buildJokers()];

// -------------------------------------------------------------------------
// Boot-time data asserts (run once at module load over ALL_CARDS).
// -------------------------------------------------------------------------

// RANKS must equal the distinct rank set across live evaluable cards. We
// exclude dissent + legacy (never evaluated). The charter kind has been removed
// (its ex-cards are now land/role jokers carrying real ranks 9/14), so it no
// longer appears here — the assert stays correct.
{
  const NON_EVALUABLE: ReadonlySet<CardKind> = new Set(["dissent", "legacy"]);
  const live = new Set<Rank>(
    ALL_CARDS.filter((c) => !NON_EVALUABLE.has(c.kind)).map((c) => c.rank),
  );
  const expected = new Set<Rank>(RANKS);
  const missing = [...expected].filter((r) => !live.has(r));
  const extra = [...live].filter((r) => !expected.has(r));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `RANKS mismatch with live card ranks: missing ${JSON.stringify(missing)}, ` +
        `extra ${JSON.stringify(extra)}.`,
    );
  }
}

// A bare `ideology: "wild"` on a PLAYABLE card with no `countsAs` is a data
// error (it would block every flush and is not a joker). The only legal
// bare-"wild" shape is a dissent-kind card (the unplayable deck clog). The
// ex-charter jokers now carry concrete colors + countsAs, so they pass this
// trivially.
for (const c of ALL_CARDS) {
  if (c.ideology === "wild" && c.countsAs === undefined && c.kind !== "dissent") {
    throw new Error(
      `Data error: playable card "${c.id}" has ideology:"wild" without countsAs. ` +
        `Wildness must be expressed via countsAs (e.g. FULL_JOKER), never a bare "wild".`,
    );
  }
}

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
