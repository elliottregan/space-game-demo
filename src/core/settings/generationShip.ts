// Generation Ship Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, CrisisTree } from "../types.ts";
import { ALL_CARDS } from "../data/cards.ts";
import { DEFAULT_PROJECT_VALUE } from "../data/projects.ts";

// Generation Ship runs on a constrained deck: only Sovereignty + Transformation
// (captaincy + technological progress). The Solidarity and Heritage ideologies
// are Homeworld concerns the migrants left behind. The former charter cards are
// now universal jokers (countsAs: FULL_JOKER, complete any shape); the Ship
// keeps exactly the three whose literal color is sovereignty/transformation —
// Pioneer, Navigator's Compass, Critical Mass — and leaves behind the heritage
// Apostle and the solidarity Founding Charter. ~30 cards total (vs ~56 for
// Homeworld). The joker allowlist is an explicit, drift-proof knob (rather than
// an emergent side effect of the recolor choices).
const SHIP_IDEOLOGIES = new Set<string>(["sovereignty", "transformation"]);
const SHIP_JOKERS = new Set<string>([
  "keystone-pioneer",
  "keystone-navigators-compass",
  "keystone-critical-mass",
]);
const STARTING_DECK = ALL_CARDS.filter(
  (c) => SHIP_IDEOLOGIES.has(c.ideology) || SHIP_JOKERS.has(c.id),
).map((c) => c.id);

// The 2-ideology deck caps any rank at 2 copies per row, so three-of-a-kind,
// four-of-a-kind, and full-house are mathematically impossible here. Straights,
// two-pair, flushes, and the straight/royal flushes remain reachable. Values
// are boosted on the small patterns to fit the Ship's design identity:
// "small builds, many of them, made to count."
const PROJECTS: KeystoneProject[] = [
  {
    id: "ship-bulkhead-patch",
    pattern: "high-card",
    name: "Bulkhead Patch",
    flavor: "Tape and prayer.",
    value: 2,
  },
  {
    id: "ship-twin-screws",
    pattern: "pair",
    name: "Twin Screws",
    flavor: "Redundancy is doctrine.",
    value: 3,
  },
  {
    id: "ship-trinity-array",
    pattern: "three-of-a-kind",
    name: "Trinity Array",
    flavor: "Three antennae, one ear.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"],
  },
  {
    id: "ship-twin-watch",
    pattern: "two-pair",
    name: "Twin Watch",
    flavor: "Two crews, two shifts, one vigil.",
    value: DEFAULT_PROJECT_VALUE["two-pair"],
  },
  {
    id: "ship-transit-corridor",
    pattern: "straight",
    name: "Transit Corridor",
    flavor: "Every deck in sequence. No gaps, no detours.",
    value: DEFAULT_PROJECT_VALUE["straight"],
  },
  {
    id: "ship-unison-engine",
    pattern: "flush",
    name: "Unison Engine",
    flavor: "All ideologies pull the same direction.",
    value: DEFAULT_PROJECT_VALUE["flush"],
  },
  {
    id: "ship-hearth-and-hull",
    pattern: "full-house",
    // Structurally unreachable on Generation Ship (2-ideology deck caps
    // per-rank at 2; full-house needs three of one rank somewhere). Included
    // for data completeness — the voyagers may yet dream of it.
    name: "Hearth and Hull",
    flavor: "Someone drew the plans. No one has counted enough hands.",
    value: DEFAULT_PROJECT_VALUE["full-house"],
  },
  {
    id: "ship-aligned-burn",
    pattern: "straight-flush",
    name: "Aligned Burn",
    flavor: "Sovereignty and Transformation, rank on rank, all the same color in the viewport.",
    value: DEFAULT_PROJECT_VALUE["straight-flush"],
  },
  {
    id: "ship-founding-vector",
    pattern: "royal-flush",
    name: "Founding Vector",
    flavor: "Every role, one ideology, perfect sequence. The destination earns a name.",
    value: DEFAULT_PROJECT_VALUE["royal-flush"],
  },
  {
    id: "ship-fourfold-drive",
    pattern: "four-of-a-kind",
    name: "Fourfold Drive",
    flavor: "Four engines, one heartbeat.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"],
  },
];

const CRISIS: Crisis = {
  id: "ship-deep-cold",
  name: "Deep Cold",
  flavor: "The ship enters a silent corridor between stars.",
};

// Crisis Tree (Generation Ship, 14 turns / 4 columns, 2-ideology deck).
// Trips/quads/full-house are impossible here, so recipes stay on
// high-card/pair/two-pair/straight/flush/any. The constrained deck makes
// monoculture the path of least resistance, so Doctrine (Mission) is the
// cheapest terminal; the tall Expansion branch is harder with only 4 columns.
// Counts are balance-pending strawman.
const CRISIS_TREE: CrisisTree = {
  rootId: "shakedown",
  nodes: {
    shakedown: {
      id: "shakedown",
      name: "Shakedown",
      branch: "establish",
      requirements: [
        { pattern: "pair", count: 3 },
        { pattern: "high-card", count: 3 },
      ],
      unlocks: ["fleet", "mission", "beacon"],
      terminal: false,
    },
    fleet: {
      id: "fleet",
      name: "Fleet Standard",
      branch: "expansion",
      requirements: [{ pattern: "any", count: 6 }],
      unlocks: [],
      terminal: true,
    },
    mission: {
      id: "mission",
      name: "Mission",
      branch: "doctrine",
      requireSameIdeology: true,
      // Doctrine teeth: 3 same-color builds AND 2 slotted policies of that color.
      // Strawman; balance pending.
      requirements: [{ pattern: "any", count: 3 }],
      policyStrength: 2,
      unlocks: [],
      terminal: true,
    },
    beacon: {
      id: "beacon",
      name: "Beacon",
      branch: "wonder",
      requirements: [
        { pattern: "straight", count: 1 },
        { pattern: "flush", count: 1, upgrade: true },
      ],
      unlocks: [],
      terminal: true,
    },
  },
};

export const GENERATION_SHIP: Setting = {
  id: "generation-ship",
  name: "Generation Ship",
  description: "The voyage. Resources tight; ideology drifts.",
  flavorText: "Years stretched thin. The bulkheads remember everyone who passed.",
  rules: {
    baseHandSize: 5,
    columnCount: 4,
    baseInfluenceBaseline: 8,
    maxTurns: 14,
    baseStorageCapacity: 1,
  },
  startingDeck: STARTING_DECK,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  crisisTree: CRISIS_TREE,
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
