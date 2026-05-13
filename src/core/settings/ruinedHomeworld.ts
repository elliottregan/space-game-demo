// Ruined Homeworld Setting — column-based redesign.

import type { Setting, KeystoneProject, Crisis } from "../types.ts";
import { ALL_CARDS } from "../data/cards.ts";
import { DEFAULT_PROJECT_VALUE } from "../data/projects.ts";

const ALL_CARD_IDS = ALL_CARDS.map((c) => c.id);

const PROJECTS: KeystoneProject[] = [
  {
    id: "ruin-candle",
    pattern: "high-card",
    name: "Candle in the Dust",
    flavor: "Something burns again.",
    value: DEFAULT_PROJECT_VALUE["high-card"],
  },
  {
    id: "ruin-two-stones",
    pattern: "pair",
    name: "Two Stones Reset",
    flavor: "The first wall returns.",
    value: DEFAULT_PROJECT_VALUE["pair"],
  },
  {
    id: "ruin-third-pillar",
    pattern: "three-of-a-kind",
    name: "Third Pillar",
    flavor: "Memory is laid in threes.",
    value: DEFAULT_PROJECT_VALUE["three-of-a-kind"],
  },
  {
    id: "ruin-monoculture",
    pattern: "flush",
    name: "Monoculture",
    flavor: "One belief survives, for now.",
    value: DEFAULT_PROJECT_VALUE["flush"],
  },
  {
    id: "ruin-cornerstones",
    pattern: "four-of-a-kind",
    name: "The Cornerstones",
    flavor: "Four corners hold what is left.",
    value: DEFAULT_PROJECT_VALUE["four-of-a-kind"],
  },
  {
    id: "ruin-salvage-pair",
    pattern: "two-pair",
    name: "Salvage Pact",
    flavor: "Two debts, two promises. Enough to trade on.",
    value: DEFAULT_PROJECT_VALUE["two-pair"],
  },
  {
    id: "ruin-broken-road",
    pattern: "straight",
    name: "The Broken Road",
    flavor: "Five waypoints cleared. The route holds, mostly.",
    value: DEFAULT_PROJECT_VALUE["straight"],
  },
  {
    id: "ruin-hearth-and-wall",
    pattern: "full-house",
    name: "Hearth and Wall",
    flavor: "Three kept the fire. Two kept the gate. It was enough.",
    value: DEFAULT_PROJECT_VALUE["full-house"],
  },
  {
    id: "ruin-clean-line",
    pattern: "straight-flush",
    name: "Clean Line",
    flavor: "One creed, one road. The scar runs straight.",
    value: DEFAULT_PROJECT_VALUE["straight-flush"],
  },
  {
    id: "ruin-first-accord",
    pattern: "royal-flush",
    name: "The First Accord",
    flavor: "Every voice, one tongue. The ruins sign the founding charter.",
    value: DEFAULT_PROJECT_VALUE["royal-flush"],
  },
];

const CRISIS: Crisis = {
  id: "ruin-collapse",
  name: "The Long Collapse",
  flavor: "What was once a city must be coaxed back into shape.",
  difficulty: 8,
};

export const RUINED_HOMEWORLD: Setting = {
  id: "ruined-homeworld",
  name: "Ruined Homeworld",
  description: "Return to a scarred world. Salvage and re-found.",
  flavorText: "The dome cracked. The fields turned. Begin again.",
  rules: {
    handSize: 7,
    columnCount: 5,
    influenceBaseline: 8,
    materialsPerLandBase: 1,
    deckStartMinSize: 10,
    maxTurns: 16,
    dissentLossThreshold: 0.5,
  },
  startingDeck: ALL_CARD_IDS,
  startingColumns: [],
  projects: PROJECTS,
  crisis: CRISIS,
  transitions: {
    onWin: "campaign-end",
    onLoss: "campaign-end",
  },
};
