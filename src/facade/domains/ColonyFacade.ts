// src/facade/domains/ColonyFacade.ts
// Colony and colonist queries and commands facade

import { SKILLS } from "../../core/data/skills";
import type { GameState } from "../../core/GameState";
import type { Colonist, ColonistRole, ColonySnapshot, EntityLookup, Queryable } from "../types";
import { type CanDoResult, err, ok, type Result } from "../types/common";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

/**
 * Facade for colony-related queries and commands.
 *
 * Implements:
 * - Queryable<ColonySnapshot> - for snapshot()
 * - EntityLookup<Colonist> - for getById()
 */
export class ColonyFacade implements Queryable<ColonySnapshot>, EntityLookup<Colonist> {
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get complete colony state snapshot.
   */
  snapshot(): ColonySnapshot {
    return {
      population: this.gameState.colony.getPopulation(),
      health: this.gameState.colony.getHealth(),
      morale: this.gameState.colony.getMorale(),
      colonists: Object.freeze([...this.gameState.colony.getColonists()]),
      skillDefinitions: Object.freeze([...SKILLS]),
      housingAssignments: Object.freeze(this.gameState.colony.getHousingAssignments()),
      unhoused: Object.freeze([...this.gameState.colony.getUnhousedColonists()]),
    };
  }

  /**
   * Get a specific colonist by ID.
   */
  getById(id: string): Readonly<Colonist> | undefined {
    return this.gameState.colony.getColonist(id);
  }

  /**
   * Check if a colonist can be trained for a role.
   */
  canTrain(colonistId: string, targetRole: ColonistRole): CanDoResult {
    const colonist = this.gameState.colony.getColonist(colonistId);
    if (!colonist) {
      return { allowed: false, reason: "Colonist not found" };
    }

    if (colonist.trainingTarget) {
      return { allowed: false, reason: `Already training for ${colonist.trainingTarget}` };
    }

    if (colonist.role === targetRole) {
      return { allowed: false, reason: `Already has role: ${targetRole}` };
    }

    return { allowed: true };
  }

  /**
   * Get colonists with a specific role.
   */
  getByRole(role: ColonistRole): readonly Readonly<Colonist>[] {
    return this.gameState.colony.getColonists().filter((c) => c.role === role);
  }

  /**
   * Get colonists with a specific role (alias for getByRole).
   */
  getColonistsByRole(role: ColonistRole): readonly Readonly<Colonist>[] {
    return this.getByRole(role);
  }

  /**
   * Get colonists currently in training.
   */
  getInTraining(): readonly Readonly<Colonist>[] {
    return this.gameState.colony.getColonists().filter((c) => c.trainingTarget !== undefined);
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Start training a colonist for a new role.
   */
  trainColonist(colonistId: string, targetRole: ColonistRole): Result<void> {
    return this.executeCommand(() => {
      const check = this.canTrain(colonistId, targetRole);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getById(colonistId)?.role ?? "unknown",
          expected: targetRole,
          reason: check.reason ?? "Cannot train",
        });
      }

      const colonist = this.gameState.colony.getColonist(colonistId);
      if (!colonist) {
        return err({
          type: "NOT_FOUND",
          entity: "colonist",
          id: colonistId,
        });
      }

      const success = this.gameState.workforce.startTraining(colonist, targetRole);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: colonistId,
          reason: "Training failed to start",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Cancel colonist training.
   */
  cancelTraining(colonistId: string): Result<void> {
    return this.executeCommand(() => {
      const colonist = this.gameState.colony.getColonist(colonistId);
      if (!colonist) {
        return err({
          type: "NOT_FOUND",
          entity: "colonist",
          id: colonistId,
        });
      }

      if (!colonist.trainingTarget) {
        return err({
          type: "INVALID_STATE",
          current: "not training",
          expected: "training",
          reason: "Colonist is not in training",
        });
      }

      this.gameState.workforce.cancelTraining(colonist);
      return ok(undefined);
    });
  }

  /**
   * Assign a colonist to work at a building.
   */
  assignToBuilding(colonistId: string, buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const colonist = this.gameState.colony.getColonist(colonistId);
      if (!colonist) {
        return err({
          type: "NOT_FOUND",
          entity: "colonist",
          id: colonistId,
        });
      }

      const success = this.gameState.buildings.assignWorker(buildingId, colonistId);
      if (!success) {
        return err({
          type: "INVALID_STATE",
          current: "cannot assign",
          expected: "assignable",
          reason: "Building full, colonist already assigned, or building not active",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Unassign a colonist from their current building.
   */
  unassignFromBuilding(colonistId: string): Result<void> {
    return this.executeCommand(() => {
      const workplace = this.gameState.workforce.getColonistWorkplace(
        colonistId,
        this.gameState.buildings,
      );

      if (!workplace) {
        return err({
          type: "INVALID_STATE",
          current: "not assigned",
          expected: "assigned",
          reason: "Colonist is not assigned to any building",
        });
      }

      this.gameState.buildings.removeWorker(workplace, colonistId);
      return ok(undefined);
    });
  }

  /**
   * Get the building ID where a colonist works, or undefined if unassigned.
   */
  getWorkplace(colonistId: string): string | undefined {
    return this.gameState.workforce.getColonistWorkplace(colonistId, this.gameState.buildings);
  }
}
