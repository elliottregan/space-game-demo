// Generation Ship Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis } from "../types.ts";
import { ALL_CARDS } from "../data/cards.ts";
import { DEFAULT_PROJECT_VALUE } from "../data/projects.ts";

// Generation Ship runs on a constrained deck: only Sovereignty + Transformation
// (captaincy + technological progress) plus wild base charters. The Solidarity
// and Heritage ideologies, and their Founding Charter, are Homeworld concerns
// the migrants left behind. ~30 cards total (vs ~56 for Homeworld).
const SHIP_IDEOLOGIES = new Set<string>(["sovereignty", "transformation", "wild"]);
const STARTING_DECK = ALL_CARDS.filter((c) => SHIP_IDEOLOGIES.has(c.ideology)).map((c) => c.id);

// Ship project values are boosted on the achievable patterns (high-card,
// pair, flush) because the 2-ideology deck makes Three-of-a-Kind and
// Four-of-a-Kind mathematically impossible (only 2 Lands per rank exist).
// The Ship's design identity: "small builds, many of them, made to count."
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
    id: "ship-unison-engine",
    pattern: "flush",
    name: "Unison Engine",
    flavor: "All ideologies pull the same direction.",
    value: DEFAULT_PROJECT_VALUE["flush"],
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
  difficulty: 12,
};

export const GENERATION_SHIP: Setting = {
  id: "generation-ship",
  name: "Generation Ship",
  description: "The voyage. Resources tight; ideology drifts.",
  flavorText: "Years stretched thin. The bulkheads remember everyone who passed.",
  rules: {
    handSize: 5,
    columnCount: 4,
    influenceBaseline: 8,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 14,
    dissentLossThreshold: 0.5,
  },
  startingDeck: STARTING_DECK,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
