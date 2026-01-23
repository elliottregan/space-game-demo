// src/facade/types/game.ts
// Game flow types for the facade

import type { VictoryState } from "../../core/systems/VictoryManager";

/**
 * Result of advancing multiple sols.
 */
export interface AdvanceSolsResult {
  events: import("./events").GameEvent[];
  solsAdvanced: number;
  stoppedEarly: boolean;
  reason?: "game_over" | "active_event";
}

// Re-export core types
export type { VictoryState };
