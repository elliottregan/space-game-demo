// Card pool — the static deck content + the types describing it.
// Types: Card, CardKind, Role, Rank, EffectSpec, … (Ideology lives in ./ideologies.ts)

import type { Ideology } from "./ideologies.ts";
import { IDEOLOGIES, IDEOLOGY_DISPLAY } from "./ideologies.ts";

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

export type CardTag = "dissent" | "charter" | "legacy" | "exclusive" | "purge" | "starter";

export type DissentVariant = "quiet" | "backlash" | "unrest";

// -------------------------------------------------------------------------
// Effect DSL — serializable
// -------------------------------------------------------------------------

export type Timing = "immediate" | "end-of-turn";

export type SerializablePredicate =
  | { kind: "suit"; ideology: Ideology }
  | { kind: "role"; role: Role }
  | { kind: "rank"; min?: number; max?: number }
  | { kind: "land" }
  | { kind: "and"; predicates: SerializablePredicate[] }
  | { kind: "or"; predicates: SerializablePredicate[] };

export type EffectSpec =
  | { kind: "gainInfluence"; amount: number; timing: "immediate" }
  | { kind: "gainMaterials"; amount: number; timing: "immediate" }
  | { kind: "draw"; count: number; timing: "immediate" }
  | {
      kind: "addDissent";
      variant: DissentVariant;
      ideology?: Ideology;
      amount: number;
      timing: "end-of-turn";
    }
  | { kind: "removeDissent"; amount: number; timing: "immediate" }
  | { kind: "shiftIdeology"; axis: "axis1" | "axis2"; amount: number; timing: "immediate" }
  | {
      kind: "discount";
      predicate: SerializablePredicate;
      amount: number;
      timing: "end-of-turn";
    }
  | { kind: "peekMarket"; count: number; timing: "immediate" }
  | { kind: "nextAcquireDiscount"; amount: number; timing: "immediate" }
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
  marketCost: number;
  effect: EffectSpec;
  slotPassive?: EffectSpec;
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
// Cost tables
// -------------------------------------------------------------------------

const ROLE_MARKET_COST: Record<Role, number> = {
  agitator: 3,
  scholar: 4,
  preacher: 6,
  engineer: 8,
  architect: 10,
};

function landMarketCost(rank: number): number {
  if (rank <= 3) return 2;
  if (rank <= 5) return 4;
  if (rank <= 7) return 7;
  return 10;
}

export function landMaterialProduction(rank: number): number {
  if (rank <= 3) return 1;
  if (rank <= 5) return 1;
  if (rank <= 7) return 2;
  return 3;
}

// -------------------------------------------------------------------------
// Effect builders
// -------------------------------------------------------------------------

const compound = (...effects: EffectSpec[]): EffectSpec => ({ kind: "compound", effects });

const gainInf = (n: number): EffectSpec => ({
  kind: "gainInfluence",
  amount: n,
  timing: "immediate",
});
const gainMat = (n: number): EffectSpec => ({
  kind: "gainMaterials",
  amount: n,
  timing: "immediate",
});
const draw = (n: number): EffectSpec => ({ kind: "draw", count: n, timing: "immediate" });
const addBacklash = (against: Ideology): EffectSpec => ({
  kind: "addDissent",
  variant: "backlash",
  ideology: against,
  amount: 1,
  timing: "end-of-turn",
});
const addQuiet = (n = 1): EffectSpec => ({
  kind: "addDissent",
  variant: "quiet",
  amount: n,
  timing: "end-of-turn",
});
const addUnrest = (n = 1): EffectSpec => ({
  kind: "addDissent",
  variant: "unrest",
  amount: n,
  timing: "end-of-turn",
});
const removeDissent = (n: number): EffectSpec => ({
  kind: "removeDissent",
  amount: n,
  timing: "immediate",
});
const shift = (axis: "axis1" | "axis2", amount: number): EffectSpec => ({
  kind: "shiftIdeology",
  axis,
  amount,
  timing: "immediate",
});
const nextAcquireDiscount = (n: number): EffectSpec => ({
  kind: "nextAcquireDiscount",
  amount: n,
  timing: "immediate",
});
const noop: EffectSpec = { kind: "noop", timing: "immediate" };

// -------------------------------------------------------------------------
// Role card effect tables
// -------------------------------------------------------------------------

type RoleEffect = { influenceCost: number; effect: EffectSpec; slotPassive?: EffectSpec };

const ROLE_EFFECTS: Record<Role, Record<Ideology, RoleEffect>> = {
  agitator: {
    solidarity: { influenceCost: 1, effect: gainInf(1) },
    sovereignty: {
      influenceCost: 1,
      effect: compound(gainInf(2), addBacklash("solidarity")),
    },
    transformation: { influenceCost: 1, effect: compound(gainInf(1), shift("axis2", 1)) },
    heritage: { influenceCost: 1, effect: compound(gainInf(1), addBacklash("transformation")) },
  },
  scholar: {
    solidarity: { influenceCost: 2, effect: compound(draw(1), gainInf(1)) },
    sovereignty: { influenceCost: 2, effect: compound(draw(1), nextAcquireDiscount(1)) },
    transformation: { influenceCost: 2, effect: draw(2) },
    heritage: { influenceCost: 2, effect: compound(draw(1), removeDissent(1)) },
  },
  preacher: {
    solidarity: {
      influenceCost: 2,
      effect: gainInf(1),
      slotPassive: shift("axis1", -1),
    },
    sovereignty: {
      influenceCost: 2,
      effect: compound(gainInf(2), addBacklash("solidarity")),
    },
    transformation: {
      influenceCost: 3,
      effect: compound(draw(2), shift("axis2", 1), addQuiet(1)),
    },
    heritage: {
      influenceCost: 2,
      effect: removeDissent(2),
    },
  },
  engineer: {
    solidarity: { influenceCost: 2, effect: gainMat(3) },
    sovereignty: {
      influenceCost: 2,
      effect: compound(gainMat(4), addBacklash("solidarity")),
    },
    transformation: { influenceCost: 2, effect: compound(gainMat(2), draw(1)) },
    heritage: { influenceCost: 2, effect: compound(gainMat(2), removeDissent(1)) },
  },
  architect: {
    solidarity: { influenceCost: 3, effect: compound(gainInf(2), draw(2)) },
    sovereignty: {
      influenceCost: 3,
      effect: compound(gainInf(3), addBacklash("solidarity")),
    },
    transformation: {
      influenceCost: 3,
      effect: compound(gainInf(2), draw(1), shift("axis2", 2)),
    },
    heritage: {
      influenceCost: 3,
      effect: compound(gainInf(1), draw(1), removeDissent(2)),
    },
  },
};

// -------------------------------------------------------------------------
// Land slot passives (for the top-of-stack)
// -------------------------------------------------------------------------

const LAND_SLOT_PASSIVE: Record<number, Record<Ideology, EffectSpec | undefined>> = {
  2: {
    solidarity: undefined,
    sovereignty: undefined,
    transformation: undefined,
    heritage: undefined,
  },
  3: {
    solidarity: undefined,
    sovereignty: undefined,
    transformation: undefined,
    heritage: removeDissent(1), // Chapel: remove 1 Dissent per turn
  },
  4: {
    solidarity: gainInf(1), // Plaza: +1 Influence
    sovereignty: undefined,
    transformation: undefined,
    heritage: removeDissent(1),
  },
  5: {
    solidarity: undefined,
    sovereignty: undefined,
    transformation: draw(1), // Forge: draw +1
    heritage: removeDissent(1),
  },
  6: {
    solidarity: gainInf(1),
    sovereignty: gainMat(1),
    transformation: draw(1),
    heritage: removeDissent(1),
  },
  7: {
    solidarity: gainInf(1),
    sovereignty: gainMat(1),
    transformation: draw(1),
    heritage: removeDissent(1),
  },
  8: {
    solidarity: compound(gainInf(2)),
    sovereignty: compound(gainMat(2)),
    transformation: compound(draw(1), gainInf(1)),
    heritage: compound(removeDissent(1), gainInf(1)),
  },
  9: {
    solidarity: compound(gainInf(2), draw(1)),
    sovereignty: compound(gainMat(2), gainInf(1)),
    transformation: compound(draw(2), gainInf(1)),
    heritage: compound(removeDissent(2), gainInf(1)),
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
      const { influenceCost, effect, slotPassive } = ROLE_EFFECTS[role][ideology];
      cards.push({
        id: roleId(role, ideology),
        name: ROLE_NAMES[role][ideology],
        kind: "role",
        rank: ROLE_RANK[role],
        ideology,
        role,
        influenceCost,
        marketCost: ROLE_MARKET_COST[role],
        effect,
        slotPassive,
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
      const slotPassive = LAND_SLOT_PASSIVE[rank]?.[ideology];
      cards.push({
        id: landId(rank, ideology),
        name: LAND_NAMES[rank][ideology],
        kind: "land",
        rank: rank as Card["rank"],
        ideology,
        influenceCost: 0,
        marketCost: landMarketCost(rank),
        effect: noop,
        slotPassive,
        tags: [],
      });
    }
  }
  return cards;
}

function buildBaseCharters(): Card[] {
  const starterTags: CardTag[] = ["charter"];
  return [
    {
      id: "keystone-pioneer",
      name: "The Pioneer",
      kind: "charter",
      rank: 15,
      ideology: "wild",
      influenceCost: 3,
      marketCost: 12,
      effect: draw(2),
      slotPassive: undefined,
      tags: starterTags,
      flavor: "Wild role, wild suit. No Dissent.",
    },
    {
      id: "keystone-apostle",
      name: "The Apostle",
      kind: "charter",
      rank: 15,
      ideology: "wild",
      influenceCost: 2,
      marketCost: 12,
      effect: compound(gainInf(2), addUnrest(1)),
      slotPassive: undefined,
      tags: starterTags,
      flavor: "Wild role, wild suit. Adds Unrest.",
    },
  ];
}

// Homeworld's mega-project-specific Charters. Not in the general market;
// they unlock per project via axis threshold + Materials.
function buildHomeworldProjectCharters(): Card[] {
  const tags: CardTag[] = ["charter"];
  return [
    {
      id: "keystone-navigators-compass",
      name: "The Navigator's Compass",
      kind: "charter",
      rank: 15,
      ideology: "transformation",
      influenceCost: 2,
      marketCost: 12,
      effect: compound(draw(2), shift("axis2", 2)),
      slotPassive: draw(1),
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
      marketCost: 12,
      effect: compound(gainInf(2), shift("axis1", -2)),
      slotPassive: gainInf(1),
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
      marketCost: 12,
      effect: compound(gainMat(3), shift("axis1", 2)),
      slotPassive: gainMat(1),
      tags,
      flavor: "Keystone — The Reactor.",
    },
  ];
}

// -------------------------------------------------------------------------
// Export: the full card registry
// -------------------------------------------------------------------------

export const ALL_CARDS: Card[] = [
  ...buildRoles(),
  ...buildLands(),
  ...buildBaseCharters(),
  ...buildHomeworldProjectCharters(),
];

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

// Dissent cards (generated in-game, not purchased)
export function makeDissent(variant: "quiet" | "backlash" | "unrest", against?: Ideology): Card {
  const suffix = against ? `-${against}` : "";
  const id = `dissent-${variant}${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const name =
    variant === "quiet"
      ? "Quiet Dissent"
      : variant === "unrest"
        ? "Unrest"
        : against
          ? `Ideological Backlash · ${againstName(against)}`
          : "Ideological Backlash";
  return {
    id,
    name,
    kind: "dissent",
    rank: 2, // unplayable; rank irrelevant but keep >= 2 for type
    ideology: against ?? "wild",
    influenceCost: 99,
    marketCost: 0,
    effect: noop,
    tags: ["dissent"],
    flavor:
      variant === "quiet"
        ? "Unplayable. Clogs the deck."
        : variant === "unrest"
          ? "On draw, shuffle 1 Quiet Dissent into deck."
          : "While in hand at end of turn, adds +1 rank to the opposing suit's axis count.",
  };
}

function againstName(ideology: Ideology): string {
  return IDEOLOGY_DISPLAY[ideology].name;
}
