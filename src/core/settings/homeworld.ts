// Homeworld Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, ColumnConfig, CrisisTree } from "../types.ts";
import { ALL_CARDS } from "../data/cards.ts";
import { DEFAULT_PROJECT_VALUE } from "../data/projects.ts";

const ALL_CARD_IDS = ALL_CARDS.map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  {
    id: "homeworld-public-broadcast",
    pattern: "high-card",
    name: "Public Broadcast",
    flavor: "A first sermon at dawn.",
    value: DEFAULT_PROJECT_VALUE["high-card"],
  },
  {
    id: "homeworld-commons",
    pattern: "pair",
    name: "The Commons",
    flavor: "Two stones, one hearth.",
    value: DEFAULT_PROJECT_VALUE["pair"],
  },
  {
    id: "homeworld-public-library",
    pattern: "three-of-a-kind",
    name: "Public Library",
    flavor: "Three columns stand for memory.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"],
  },
  {
    id: "homeworld-founding-stone",
    pattern: "flush",
    name: "Founding Stone",
    flavor: "All of one belief, set in mortar.",
    value: DEFAULT_PROJECT_VALUE["flush"],
  },
  {
    id: "homeworld-twin-gates",
    pattern: "two-pair",
    name: "Twin Gates",
    flavor: "Two ways in, two ways home.",
    value: DEFAULT_PROJECT_VALUE["two-pair"],
  },
  {
    id: "homeworld-long-march",
    pattern: "straight",
    name: "Long March",
    flavor: "From dust to dawn in five strides.",
    value: DEFAULT_PROJECT_VALUE["straight"],
  },
  {
    id: "homeworld-settlement-hall",
    pattern: "full-house",
    name: "Settlement Hall",
    flavor: "Three for the council, two for the door.",
    value: DEFAULT_PROJECT_VALUE["full-house"],
  },
  {
    id: "homeworld-reactor-core",
    pattern: "four-of-a-kind",
    name: "Reactor Core",
    flavor: "Power harnessed, fourfold.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"],
  },
  {
    id: "homeworld-migration-trail",
    pattern: "straight-flush",
    name: "Migration Trail",
    flavor: "One creed, marched in order.",
    value: DEFAULT_PROJECT_VALUE["straight-flush"],
  },
  {
    id: "homeworld-first-compact",
    pattern: "royal-flush",
    name: "First Compact",
    flavor: "Every voice, one banner, one road.",
    value: DEFAULT_PROJECT_VALUE["royal-flush"],
  },
];

const CRISIS: Crisis = {
  id: "homeworld-arrival-storm",
  name: "Arrival Storm",
  flavor: "The first generation faces a dust-storm that will not pass.",
  difficulty: 16,
};

// Crisis Tree (§6 Homeworld strawman, 12 turns / 7 columns). The root
// demands a spread of basic infrastructure (two-pair + high-card), then forks
// into three terminal victory branches. Counts are balance-pending strawman.
const CRISIS_TREE: CrisisTree = {
  rootId: "settlement",
  nodes: {
    settlement: {
      id: "settlement",
      name: "Settlement",
      branch: "establish",
      requirements: [
        { pattern: "two-pair", count: 4 },
        { pattern: "high-card", count: 4 },
      ],
      unlocks: ["industry", "capital", "monument"],
      terminal: false,
    },
    industry: {
      id: "industry",
      name: "Industry",
      branch: "expansion",
      requirements: [{ pattern: "any", count: 8 }],
      unlocks: [],
      terminal: true,
    },
    capital: {
      id: "capital",
      name: "Capital",
      branch: "doctrine",
      requireSameIdeology: true,
      requirements: [{ pattern: "any", count: 5 }],
      unlocks: [],
      terminal: true,
    },
    monument: {
      id: "monument",
      name: "Monument",
      branch: "wonder",
      requirements: [
        { pattern: "straight", count: 1 },
        { pattern: "two-pair", count: 1 },
        { pattern: "flush", count: 1, upgrade: true },
      ],
      unlocks: [],
      terminal: true,
    },
  },
};

const STARTING_COLUMNS: ColumnConfig[] = [];

export const HOMEWORLD: Setting = {
  id: "homeworld",
  name: "Homeworld",
  description: "The first world. Fresh ground, unsettled ideology.",
  flavorText:
    "Mars under a dome. The first generation debates what comes next: to dig in, to lift off, or to build something neither.",
  rules: {
    baseHandSize: 7,
    columnCount: 7,
    baseInfluenceBaseline: 8,
    maxTurns: 12,
    baseStorageCapacity: 1,
  },
  startingDeck: ALL_CARD_IDS,
  startingColumns: STARTING_COLUMNS,
  projects: PROJECTS,
  crisis: CRISIS,
  crisisTree: CRISIS_TREE,
  transitions: {
    onWin: "generation-ship",
    onLoss: "ruined-homeworld",
  },
};
