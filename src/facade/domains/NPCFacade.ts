// src/facade/domains/NPCFacade.ts
// NPC influence queries and commands facade

import type { GameState } from "../../core/GameState";
import { ok, err, type Result, type CanDoResult } from "../types/common";
import type { NPCInfluenceSnapshot, ResourceDelta } from "../types";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;
type AffordabilityChecker = (cost: ResourceDelta) => CanDoResult;

/**
 * Facade for NPC influence queries and commands.
 */
export class NPCFacade {
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
    private checkAffordability: AffordabilityChecker
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get complete NPC influence state snapshot.
   */
  snapshot(): NPCInfluenceSnapshot {
    const activeProject = this.gameState.npcInfluence.getActiveProject();
    return {
      npcs: Object.freeze([...this.gameState.npcInfluence.getNPCs()]),
      projects: Object.freeze([...this.gameState.npcInfluence.getProjects()]),
      activeProject: activeProject
        ? Object.freeze({
            projectId: activeProject.projectId,
            supportLevels: Object.freeze(Object.fromEntries(activeProject.supportLevels)),
            solsRemaining: activeProject.solsRemaining,
            averageSupport: this.gameState.npcInfluence.getAverageSupport(),
          })
        : null,
      councils: Object.freeze([...this.gameState.npcInfluence.getCouncils()]),
      relationshipMatrix: Object.freeze(
        this.gameState.npcInfluence.getRelationshipMatrix().map((row) => Object.freeze([...row]))
      ),
    };
  }

  /**
   * Get lobby cost for an NPC.
   */
  getLobbyCost(npcId: string, supportBoost: number): number {
    return this.gameState.npcInfluence.getLobbyCost(npcId, supportBoost);
  }

  /**
   * Check if a project can be proposed.
   */
  canProposeProject(projectId: string): CanDoResult {
    const project = this.gameState.npcInfluence.getProjects().find((p) => p.id === projectId);
    if (!project) {
      return { allowed: false, reason: "Project not found" };
    }

    const activeProject = this.gameState.npcInfluence.getActiveProject();
    if (activeProject) {
      return { allowed: false, reason: "A project is already being voted on" };
    }

    const affordability = this.checkAffordability(project.proposalCost);
    if (!affordability.allowed) {
      return affordability;
    }

    return { allowed: true };
  }

  /**
   * Check if an NPC can be lobbied.
   */
  canLobbyNPC(npcId: string, supportBoost: number): CanDoResult {
    const npc = this.gameState.npcInfluence.getNPCs().find((n) => n.id === npcId);
    if (!npc) {
      return { allowed: false, reason: "NPC not found" };
    }

    const cost = this.getLobbyCost(npcId, supportBoost);
    const affordability = this.checkAffordability({ materials: cost });
    if (!affordability.allowed) {
      return affordability;
    }

    return { allowed: true };
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Propose a project for NPC voting.
   */
  proposeProject(projectId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canProposeProject(projectId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: projectId,
          reason: check.reason ?? "Cannot propose project",
        });
      }

      const success = this.gameState.npcInfluence.proposeProject(
        projectId,
        this.gameState.resources
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: projectId,
          reason: "Project proposal failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Lobby an NPC to increase their support.
   */
  lobbyNPC(npcId: string, supportBoost: number): Result<void> {
    return this.executeCommand(() => {
      const check = this.canLobbyNPC(npcId, supportBoost);
      if (!check.allowed) {
        return err({
          type: "INSUFFICIENT_RESOURCES",
          required: { materials: this.getLobbyCost(npcId, supportBoost) },
          available: this.gameState.resources.getResources(),
        });
      }

      const success = this.gameState.npcInfluence.lobbyNPC(
        npcId,
        supportBoost,
        this.gameState.resources
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: npcId,
          reason: "Lobbying failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Create a council with selected NPCs.
   */
  createCouncil(name: string, memberIds: string[]): Result<void> {
    return this.executeCommand(() => {
      // Validate members exist
      for (const memberId of memberIds) {
        const npc = this.gameState.npcInfluence.getNPCs().find((n) => n.id === memberId);
        if (!npc) {
          return err({
            type: "NOT_FOUND",
            entity: "npc",
            id: memberId,
          });
        }
      }

      const success = this.gameState.npcInfluence.createCouncil(
        name,
        memberIds,
        this.gameState.resources
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: name,
          reason: "Council creation failed",
        });
      }

      return ok(undefined);
    });
  }
}
