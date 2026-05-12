// Generation Ship Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, ColumnConfig } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";
import { DEFAULT_PROJECT_VALUE } from "./projects.ts";

// Generation Ship gates out the founding charter — see spec.
const EXCLUDED_IDS = new Set<string>(["keystone-founding-charter"]);
const STARTING_DECK = ALL_CARDS.filter((c) => !EXCLUDED_IDS.has(c.id)).map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  { id: "ship-bulkhead-patch", pattern: "high-card",
    name: "Bulkhead Patch", flavor: "Tape and prayer.",
    value: DEFAULT_PROJECT_VALUE["high-card"] },
  { id: "ship-twin-screws", pattern: "pair",
    name: "Twin Screws", flavor: "Redundancy is doctrine.",
    value: DEFAULT_PROJECT_VALUE["pair"] },
  { id: "ship-trinity-array", pattern: "three-of-a-kind",
    name: "Trinity Array", flavor: "Three antennae, one ear.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"] },
  { id: "ship-unison-engine", pattern: "flush",
    name: "Unison Engine", flavor: "All ideologies pull the same direction.",
    value: DEFAULT_PROJECT_VALUE["flush"] },
  { id: "ship-fourfold-drive", pattern: "four-of-a-kind",
    name: "Fourfold Drive", flavor: "Four engines, one heartbeat.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"] },
];

const CRISIS: Crisis = {
  id: "ship-deep-cold",
  name: "Deep Cold",
  flavor: "The ship enters a silent corridor between stars.",
  difficulty: 14,
};

export const GENERATION_SHIP: Setting = {
  id: "generation-ship",
  name: "Generation Ship",
  description: "The voyage. Resources tight; ideology drifts.",
  flavorText: "Years stretched thin. The bulkheads remember everyone who passed.",
  rules: {
    handSize: 6,
    columnCount: 6,
    influenceBaseline: 3,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 14,
    dissentLossThreshold: 0.5,
  },
  startingDeck: STARTING_DECK,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  shortTermTasks: [],
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
