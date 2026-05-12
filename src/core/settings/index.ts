// Setting types + the registry of every Setting in the campaign.

import type { ColumnConfig } from "../engine/column.ts";
import type { Crisis, KeystoneProject } from "../data/projects.ts";
import { HOMEWORLD } from "./homeworld.ts";
import { GENERATION_SHIP } from "./generationShip.ts";
import { RUINED_HOMEWORLD } from "./ruinedHomeworld.ts";

// -------------------------------------------------------------------------
// Setting shape — each scenario declares one of these.
// -------------------------------------------------------------------------

export interface SettingRules {
  handSize: number;
  columnCount: number;
  influenceBaseline: number;
  materialsPerLandBase: number;
  deckStartMinSize: number;
  /** Turn budget. Crisis fires once `epoch.turn` exceeds this. */
  maxTurns: number;
  dissentLossThreshold: number;
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  rules: SettingRules;
  startingDeck: string[];
  startingColumns: ColumnConfig[];
  /** Exactly one project per pattern (high-card, pair, three, flush, four). */
  projects: KeystoneProject[];
  crisis: Crisis;
  transitions: {
    onWin: string | "campaign-end";
    onLoss: string | "campaign-end";
  };
}

// -------------------------------------------------------------------------
// Registry
// -------------------------------------------------------------------------

export const SETTINGS: Setting[] = [HOMEWORLD, GENERATION_SHIP, RUINED_HOMEWORLD];

export const SETTING_BY_ID: Record<string, Setting> = Object.fromEntries(
  SETTINGS.map((s) => [s.id, s] as const),
);

export function getSetting(id: string): Setting {
  const s = SETTING_BY_ID[id];
  if (!s) throw new Error(`Unknown setting id: ${id}`);
  return s;
}
