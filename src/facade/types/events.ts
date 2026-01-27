// src/facade/types/events.ts
// Event-related types for the facade

import {
  EventId,
  type ActiveEvent,
  type EventChoice,
  type GameEvent,
  type RandomEventDefinition,
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
export { EventId };
export type { GameEvent, RandomEventDefinition, EventChoice, ActiveEvent };
