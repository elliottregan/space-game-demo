// src/facade/types/events.ts
// Event-related types for the facade

import type {
  ActiveEvent,
  EventChoice,
  GameEvent,
  RandomEventDefinition,
} from "../../core/models/GameEvent";

/**
 * Immutable snapshot of active event state.
 */
export interface ActiveEventSnapshot {
  readonly definition: Readonly<RandomEventDefinition>;
  readonly active: Readonly<ActiveEvent>;
  readonly choices: readonly Readonly<EventChoice>[];
}

// Re-export core types
export type { GameEvent, RandomEventDefinition, EventChoice, ActiveEvent };
