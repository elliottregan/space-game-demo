// src/facade/domains/OperationsFacade.ts
// Operations queries and commands facade

import type { GameState } from "../../core/GameState";
import { ok, err, type Result, type CanDoResult } from "../types/common";
import type {
  OperationsSnapshot,
  ProspectingSite,
  ExpeditionType,
  PolicyType,
  PolicyValue,
  ActiveExpedition,
} from "../types";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

/**
 * Facade for operations-related queries and commands.
 */
export class OperationsFacade {
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get complete operations state snapshot.
   */
  snapshot(): OperationsSnapshot {
    return {
      policies: Object.freeze({ ...this.gameState.operations.getPolicies() }),
      policyCooldownRemaining: this.gameState.operations.getSolsUntilPolicyChange(
        this.gameState.currentSol,
      ),
      expeditions: Object.freeze([...this.gameState.operations.getActiveExpeditions()]),
      sites: Object.freeze([...this.gameState.operations.getSites()]),
    };
  }

  /**
   * Check if a policy can be changed.
   */
  canChangePolicy(): CanDoResult {
    const cooldown = this.gameState.operations.getSolsUntilPolicyChange(this.gameState.currentSol);
    if (cooldown > 0) {
      return {
        allowed: false,
        reason: `Policy change on cooldown (${cooldown} sols remaining)`,
      };
    }
    return { allowed: true };
  }

  /**
   * Check if an expedition can be started.
   */
  canStartExpedition(_type: ExpeditionType, crewIds: string[]): CanDoResult {
    // Validate crew exists
    for (const crewId of crewIds) {
      const colonist = this.gameState.colony.getColonist(crewId);
      if (!colonist) {
        return { allowed: false, reason: `Colonist "${crewId}" not found` };
      }
    }

    return { allowed: true };
  }

  /**
   * Get a prospecting site by ID.
   */
  getSiteById(siteId: string): Readonly<ProspectingSite> | undefined {
    return this.gameState.operations.getSites().find((s) => s.id === siteId);
  }

  /**
   * Check if a site can be revealed.
   */
  canRevealSite(siteId: string): CanDoResult {
    const site = this.getSiteById(siteId);
    if (!site) {
      return { allowed: false, reason: "Site not found" };
    }

    if (site.revealed) {
      return { allowed: false, reason: "Site already revealed" };
    }

    return { allowed: true };
  }

  /**
   * Check if a site can be developed.
   */
  canDevelopSite(siteId: string): CanDoResult {
    const site = this.getSiteById(siteId);
    if (!site) {
      return { allowed: false, reason: "Site not found" };
    }

    if (!site.revealed) {
      return { allowed: false, reason: "Site must be revealed first" };
    }

    if (site.developed) {
      return { allowed: false, reason: "Site already developed" };
    }

    return { allowed: true };
  }

  /**
   * Get deposit depletion warning level.
   */
  getDepositWarningLevel(depositId: string): "none" | "warning" | "critical" | "depleted" {
    return this.gameState.operations.getDepletionWarningLevel(depositId);
  }

  /**
   * Get developed sites that can be linked to buildings.
   */
  getAvailableDeposits(): readonly Readonly<ProspectingSite>[] {
    return this.gameState.operations.getSites().filter((s) => s.developed && !s.linkedBuildingId);
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Set a colony policy.
   */
  setPolicy(type: PolicyType, value: PolicyValue): Result<void> {
    return this.executeCommand(() => {
      const check = this.canChangePolicy();
      if (!check.allowed) {
        return err({
          type: "COOLDOWN_ACTIVE",
          remainingSols: this.gameState.operations.getSolsUntilPolicyChange(
            this.gameState.currentSol,
          ),
        });
      }

      const success = this.gameState.operations.setPolicy(
        type,
        value as never,
        this.gameState.currentSol,
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: `${type}:${value}`,
          reason: "Policy change failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Launch an expedition.
   */
  launchExpedition(type: ExpeditionType, crewIds: string[]): Result<ActiveExpedition> {
    return this.executeCommand(() => {
      const check = this.canStartExpedition(type, crewIds);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: type,
          reason: check.reason ?? "Cannot start expedition",
        });
      }

      const success = this.gameState.operations.startExpedition(
        type,
        crewIds,
        this.gameState.resources,
        this.gameState.colony,
        this.gameState.currentSol,
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: type,
          reason: "Expedition launch failed",
        });
      }

      const expeditions = this.gameState.operations.getActiveExpeditions();
      const newExpedition = expeditions[expeditions.length - 1];

      if (!newExpedition) {
        return err({
          type: "INVALID_STATE",
          current: "no expeditions",
          expected: "expedition created",
          reason: "Expedition was not added to active list",
        });
      }

      return ok(newExpedition);
    });
  }

  /**
   * Reveal a hidden prospecting site.
   */
  revealSite(siteId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canRevealSite(siteId);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: "hidden or revealed",
          expected: "hidden",
          reason: check.reason ?? "Cannot reveal site",
        });
      }

      const success = this.gameState.operations.revealSite(siteId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: siteId,
          reason: "Site reveal failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Develop a revealed site.
   */
  developSite(siteId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canDevelopSite(siteId);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getSiteById(siteId)?.developed ? "developed" : "unrevealed",
          expected: "revealed",
          reason: check.reason ?? "Cannot develop site",
        });
      }

      const success = this.gameState.operations.developSite(siteId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: siteId,
          reason: "Site development failed",
        });
      }

      return ok(undefined);
    });
  }
}
