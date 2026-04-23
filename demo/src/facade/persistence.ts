// Save/load game state to localStorage.

import type { Campaign, Epoch } from "../core/types.ts";
import type { EndOfEpochState } from "../core/campaign.ts";

const STORAGE_KEY = "deck-demo-save-v1";

export interface SavedState {
  version: 1;
  campaign: Campaign;
  settingId: string; // the last *active* setting id (never "campaign-end")
  epoch: Epoch;
  endOfEpoch: EndOfEpochState | null;
  seed: number;
}

export function loadSavedState(): SavedState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSavedState(state: SavedState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota exceeded or blocked — fail silently.
  }
}

export function clearSavedState(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
