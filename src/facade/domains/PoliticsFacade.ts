// src/facade/domains/PoliticsFacade.ts
// Politics queries and commands facade

import type { GameState } from "../../core/GameState";
import { ok, err, type Result, type CanDoResult } from "../types/common";
import type { PoliticsSnapshot, Decision, DecisionResult, Queryable } from "../types";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

/**
 * Facade for politics-related queries and commands.
 *
 * Implements: Queryable<PoliticsSnapshot>
 *
 * Note: Uses getDecisionById() instead of getById() due to domain semantics.
 */
export class PoliticsFacade implements Queryable<PoliticsSnapshot> {
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get complete politics state snapshot.
   */
  snapshot(): PoliticsSnapshot {
    return {
      factions: Object.freeze([...this.gameState.politics.getFactions()]),
      averageSupport: this.gameState.politics.getAverageSupport(),
      decisions: Object.freeze([...this.gameState.politics.getAvailableDecisions()]),
    };
  }

  /**
   * Get a specific decision by ID.
   */
  getDecisionById(id: string): Readonly<Decision> | undefined {
    return this.gameState.politics.getDecision(id);
  }

  /**
   * Check if a decision can be made (has enough support).
   */
  canMakeDecision(decisionId: string): CanDoResult {
    const decision = this.gameState.politics.getDecision(decisionId);
    if (!decision) {
      return { allowed: false, reason: "Decision not found" };
    }

    const avgSupport = this.gameState.politics.getAverageSupport();
    if (avgSupport < decision.requiredSupport) {
      return {
        allowed: false,
        reason: `Requires ${decision.requiredSupport}% support (current: ${avgSupport.toFixed(0)}%)`,
      };
    }

    return { allowed: true };
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Make a political decision.
   */
  makeDecision(decisionId: string): Result<DecisionResult> {
    return this.executeCommand(() => {
      const check = this.canMakeDecision(decisionId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: decisionId,
          reason: check.reason ?? "Cannot make decision",
        });
      }

      const decision = this.gameState.politics.getDecision(decisionId);
      if (!decision) {
        return err({
          type: "NOT_FOUND",
          entity: "decision",
          id: decisionId,
        });
      }

      const result = this.gameState.politics.makeDecision(decision, this.gameState.resources);

      if (!result) {
        return err({
          type: "INVALID_TARGET",
          target: decisionId,
          reason: "Decision failed",
        });
      }

      return ok(result);
    });
  }
}
