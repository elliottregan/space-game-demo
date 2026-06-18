// Setting types + the registry of every Setting in the campaign.

import type { ColumnConfig } from "../engine/column.ts";
import type { Crisis, KeystoneProject } from "../data/projects.ts";
import type { CrisisTree } from "../engine/crisisTree.ts";
import { HOMEWORLD } from "./homeworld.ts";
import { GENERATION_SHIP } from "./generationShip.ts";
import { RUINED_HOMEWORLD } from "./ruinedHomeworld.ts";

// -------------------------------------------------------------------------
// Setting shape — each scenario declares one of these.
// -------------------------------------------------------------------------

export interface SettingRules {
  /** Base hand size before policy deltas. Operative value: effectiveRules().handSize. */
  baseHandSize: number;
  columnCount: number;
  /** Base influence baseline before policy deltas. Operative value: effectiveRules().influenceBaseline. */
  baseInfluenceBaseline: number;
  /** Turn budget. Crisis fires once `epoch.turn` exceeds this. */
  maxTurns: number;
  /** Base per-column storage slots before policy deltas. Operative value: effectiveRules().storageCapacity. */
  baseStorageCapacity: number;
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  rules: SettingRules;
  startingDeck: string[];
  startingColumns: ColumnConfig[];
  /** Exactly one project per pattern (see PATTERNS_IN_ORDER in data/projects.ts). */
  projects: KeystoneProject[];
  /** Legacy scalar Crisis (id/name/flavor/difficulty). Win condition reads
   *  difficulty until P4; the scalar is retired in P5. */
  crisis: Crisis;
  /** The branching win-condition DAG. Authored per Setting (§6). */
  crisisTree: CrisisTree;
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
