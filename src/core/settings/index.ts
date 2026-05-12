// Registry of all Settings available in the demo's campaign.

import type { Setting } from "../types.ts";
import { HOMEWORLD } from "./homeworld.ts";
import { GENERATION_SHIP } from "./generationShip.ts";
import { RUINED_HOMEWORLD } from "./ruinedHomeworld.ts";

export const SETTINGS: Setting[] = [HOMEWORLD, GENERATION_SHIP, RUINED_HOMEWORLD];

export const SETTING_BY_ID: Record<string, Setting> = Object.fromEntries(
  SETTINGS.map((s) => [s.id, s] as const),
);

export function getSetting(id: string): Setting {
  const s = SETTING_BY_ID[id];
  if (!s) throw new Error(`Unknown setting id: ${id}`);
  return s;
}
