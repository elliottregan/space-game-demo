// src/facade/domains/EventsFacade.ts
// Event queries and commands facade

import type { GameState } from "../../core/GameState";
import type { ActiveEventSnapshot, GameEvent } from "../types";
import { err, ok, type Result } from "../types/common";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

/**
 * Facade for event-related queries and commands.
 */
export class EventsFacade {
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
    private getLastEvents: () => GameEvent[],
    private addEvents: (events: GameEvent[]) => void,
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get the active event requiring player input, if any.
   */
  getActive(): ActiveEventSnapshot | null {
    const active = this.gameState.events.getActiveEvent();
    if (!active) return null;

    return {
      definition: Object.freeze(active.definition),
      active: Object.freeze(active.active),
      choices: Object.freeze([...this.gameState.events.getEventChoices()]),
    };
  }

  /**
   * Check if there's an active event blocking game progress.
   */
  hasActive(): boolean {
    return this.gameState.events.hasActiveEvent();
  }

  /**
   * Get recent game events.
   */
  getRecent(limit: number = 15): readonly Readonly<GameEvent>[] {
    return Object.freeze(this.getLastEvents().slice(-limit));
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Resolve an active event by choosing an option.
   */
  resolve(choiceId: string): Result<GameEvent[]> {
    return this.executeCommand(() => {
      if (!this.hasActive()) {
        return err({
          type: "INVALID_STATE",
          current: "no active event",
          expected: "active event",
          reason: "No active event to resolve",
        });
      }

      const events = this.gameState.events.resolveEvent(
        choiceId,
        this.gameState.resources,
        this.gameState.colony,
        this.gameState.npcInfluence,
      );

      this.addEvents(events);

      return ok(events);
    });
  }
}
