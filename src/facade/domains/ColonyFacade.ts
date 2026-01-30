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
   * @param options.lightweight - Skip expensive calculations (communities, skills) for simulation mode
   */
  snapshot(options?: { lightweight?: boolean }): ColonySnapshot {
    const colonistIds = this.gameState.colony.getColonists().map((c) => c.id);
    const lightweight = options?.lightweight ?? false;

    return {
      population: this.gameState.colony.getPopulation(),
      health: this.gameState.colony.getHealth(),
      morale: this.gameState.colony.getMorale(),
      socialCohesion: this.gameState.colony.getSocialCohesion(),
      colonists: Object.freeze([...this.gameState.colony.getColonists()]),
      skillDefinitions: lightweight ? Object.freeze([]) : Object.freeze([...SKILLS]),
      housingAssignments: lightweight
        ? Object.freeze({})
        : Object.freeze(this.gameState.colony.getHousingAssignments()),
      unhoused: lightweight
        ? Object.freeze([])
        : Object.freeze([...this.gameState.colony.getUnhousedColonists()]),
      coworkerRelationships: this.gameState.workforce.getAllCoworkerRelationships(),
      guilds: lightweight
        ? Object.freeze([])
        : Object.freeze([...this.gameState.workforce.getGuilds()]),
      // Community detection is O(iterations * edges) - skip in lightweight mode
      communities: lightweight
        ? Object.freeze([])
        : Object.freeze(this.gameState.workforce.detectCommunities(colonistIds)),
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

  /**
   * Get individual morale and centrality data for all colonists.
   */
  getColonistMoraleData(): Record<string, { morale: number; centrality: number }> {
    const colonists = this.gameState.colony.getColonists();
    const moraleManager = this.gameState.getColonistMoraleManager();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    const result: Record<string, { morale: number; centrality: number }> = {};

    for (const colonist of colonists) {
      result[colonist.id] = {
        morale: moraleManager.getMorale(colonist.id),
        centrality: relationshipManager.getCentrality(colonist.id),
      };
    }

    return result;
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

      // Get current production before assignment
      const oldProd = this.gameState.buildings.getEffectiveProduction(buildingId);
      const oldCons = this.gameState.buildings.getEffectiveConsumption(buildingId);

      const success = this.gameState.buildings.assignWorker(buildingId, colonistId);
      if (!success) {
        return err({
          type: "INVALID_STATE",
          current: "cannot assign",
          expected: "assignable",
          reason: "Building full, colonist already assigned, or building not active",
        });
      }

      // Recalculate production after assignment (staffing changed)
      const newProd = this.gameState.buildings.getEffectiveProduction(buildingId);
      const newCons = this.gameState.buildings.getEffectiveConsumption(buildingId);

      // Update resource flows: remove old, add new
      if (Object.keys(oldProd).length > 0) {
        this.gameState.resources.removeProduction(oldProd);
      }
      if (Object.keys(oldCons).length > 0) {
        this.gameState.resources.removeConsumption(oldCons);
      }
      if (Object.keys(newProd).length > 0) {
        this.gameState.resources.addProduction(newProd);
      }
      if (Object.keys(newCons).length > 0) {
        this.gameState.resources.addConsumption(newCons);
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

      // Get current production before unassignment
      const oldProd = this.gameState.buildings.getEffectiveProduction(workplace);
      const oldCons = this.gameState.buildings.getEffectiveConsumption(workplace);

      this.gameState.buildings.removeWorker(workplace, colonistId);

      // Recalculate production after unassignment (staffing changed)
      const newProd = this.gameState.buildings.getEffectiveProduction(workplace);
      const newCons = this.gameState.buildings.getEffectiveConsumption(workplace);

      // Update resource flows: remove old, add new
      if (Object.keys(oldProd).length > 0) {
        this.gameState.resources.removeProduction(oldProd);
      }
      if (Object.keys(oldCons).length > 0) {
        this.gameState.resources.removeConsumption(oldCons);
      }
      if (Object.keys(newProd).length > 0) {
        this.gameState.resources.addProduction(newProd);
      }
      if (Object.keys(newCons).length > 0) {
        this.gameState.resources.addConsumption(newCons);
      }

      return ok(undefined);
    });
  }

  /**
   * Get the building ID where a colonist works, or undefined if unassigned.
   */
  getWorkplace(colonistId: string): string | undefined {
    return this.gameState.workforce.getColonistWorkplace(colonistId, this.gameState.buildings);
  }

  /**
   * Get all colonists not currently assigned to any building.
   */
  getUnassignedColonists(): readonly Readonly<Colonist>[] {
    const assignedIds = new Set<string>();
    for (const building of this.gameState.buildings.getBuildings()) {
      for (const id of building.assignedWorkers) assignedIds.add(id);
    }
    return this.gameState.colony.getColonists().filter((c) => !assignedIds.has(c.id));
  }

  /**
   * Optimize workforce by auto-assigning unassigned colonists to understaffed buildings.
   * Prioritizes food buildings, then buildings with more empty slots.
   * Never steals workers from other buildings.
   */
  optimizeWorkforce(): Result<{ assignmentsChanged: number }> {
    return this.executeCommand(() => {
      // Get old production state for all understaffed buildings
      const understaffed = this.gameState.buildings.getUnderstaffedBuildings();
      type ResourceFlow = {
        prod: Record<string, number | undefined>;
        cons: Record<string, number | undefined>;
      };
      const oldFlows = new Map<string, ResourceFlow>();

      for (const building of understaffed) {
        oldFlows.set(building.id, {
          prod: { ...this.gameState.buildings.getEffectiveProduction(building.id) },
          cons: { ...this.gameState.buildings.getEffectiveConsumption(building.id) },
        });
      }

      // Perform auto-assignment
      const events = this.gameState.buildings.autoAssignAllWorkers(this.gameState.colony);

      // Update resource flows for changed buildings
      for (const building of understaffed) {
        const old = oldFlows.get(building.id)!;
        const newProd = this.gameState.buildings.getEffectiveProduction(building.id);
        const newCons = this.gameState.buildings.getEffectiveConsumption(building.id);

        this.gameState.resources.removeProduction(old.prod);
        this.gameState.resources.removeConsumption(old.cons);
        this.gameState.resources.addProduction(newProd);
        this.gameState.resources.addConsumption(newCons);
      }

      return ok({ assignmentsChanged: events.length });
    });
  }

  /**
   * Get whether new colonists are automatically assigned to buildings.
   */
  getAutoAssignNewColonists(): boolean {
    return this.gameState.getAutoAssignNewColonists();
  }

  /**
   * Set whether new colonists should be automatically assigned to buildings.
   */
  setAutoAssignNewColonists(value: boolean): void {
    this.gameState.setAutoAssignNewColonists(value);
  }

  /**
   * Auto-assign all unhoused colonists to available housing.
   */
  optimizeHousing(): Result<{ assignmentsChanged: number }> {
    return this.executeCommand(() => {
      const unhousedBefore = this.gameState.colony.getUnhousedColonists().length;
      this.gameState.colony.assignHousing(this.gameState.buildings);
      const unhousedAfter = this.gameState.colony.getUnhousedColonists().length;
      return ok({ assignmentsChanged: unhousedBefore - unhousedAfter });
    });
  }

  /**
   * Assign a colonist to housing in a building.
   */
  assignToHousing(colonistId: string, buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const colonist = this.gameState.colony.getColonist(colonistId);
      if (!colonist) {
        return err({
          type: "NOT_FOUND",
          entity: "colonist",
          id: colonistId,
        });
      }

      const success = this.gameState.colony.assignColonistToHousing(
        colonistId,
        buildingId,
        this.gameState.buildings,
      );

      if (!success) {
        return err({
          type: "INVALID_STATE",
          current: "cannot assign",
          expected: "assignable",
          reason: "Building full, not a housing building, or not active",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Unassign a colonist from their current housing.
   */
  unassignFromHousing(colonistId: string): Result<void> {
    return this.executeCommand(() => {
      const colonist = this.gameState.colony.getColonist(colonistId);
      if (!colonist) {
        return err({
          type: "NOT_FOUND",
          entity: "colonist",
          id: colonistId,
        });
      }

      if (!colonist.housingId) {
        return err({
          type: "INVALID_STATE",
          current: "not housed",
          expected: "housed",
          reason: "Colonist is not assigned to any housing",
        });
      }

      this.gameState.colony.clearHousingAssignment(colonistId);
      return ok(undefined);
    });
  }
}
