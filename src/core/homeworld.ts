// Homeworld Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis, ColumnConfig } from "./types.ts";
import { ALL_CARDS } from "./cards.ts";
import { DEFAULT_PROJECT_VALUE } from "./projects.ts";

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
    id: "homeworld-reactor-core",
    pattern: "four-of-a-kind",
    name: "Reactor Core",
    flavor: "Power harnessed, fourfold.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"],
  },
];

const CRISIS: Crisis = {
  id: "homeworld-arrival-storm",
  name: "Arrival Storm",
  flavor: "The first generation faces a dust-storm that will not pass.",
  difficulty: 10,
};

const STARTING_COLUMNS: ColumnConfig[] = [];

export const HOMEWORLD: Setting = {
  id: "homeworld",
  name: "Homeworld",
  description: "The first world. Fresh ground, unsettled ideology.",
  flavorText:
    "Mars under a dome. The first generation debates what comes next: to dig in, to lift off, or to build something neither.",
  rules: {
    handSize: 7,
    columnCount: 7,
    influenceBaseline: 3,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 12,
    dissentLossThreshold: 0.5,
  },
  startingDeck: ALL_CARD_IDS,
  startingColumns: STARTING_COLUMNS,
  projects: PROJECTS,
  crisis: CRISIS,
  shortTermTasks: [],
  transitions: {
    onWin: "generation-ship",
    onLoss: "ruined-homeworld",
  },
};
