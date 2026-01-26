// src/facade/domains/TechnologyFacade.ts
// Technology queries and commands facade

import type { GameState } from "../../core/GameState";
import type {
  EntityLookup,
  Queryable,
  ResourceDelta,
  Technology,
  TechnologySnapshot,
} from "../types";
import { type CanDoResult, err, ok, type Result } from "../types/common";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;
type AffordabilityChecker = (cost: ResourceDelta) => CanDoResult;

/**
 * Facade for technology-related queries and commands.
 *
 * Implements:
 * - Queryable<TechnologySnapshot> - for snapshot()
 * - EntityLookup<Technology> - for getById()
 */
export class TechnologyFacade implements Queryable<TechnologySnapshot>, EntityLookup<Technology> {
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
    private checkAffordability: AffordabilityChecker,
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get complete technology state snapshot.
   */
  snapshot(): TechnologySnapshot {
    return {
      all: Object.freeze([...this.gameState.technology.getAllTechs()]),
      available: Object.freeze([...this.gameState.technology.getAvailableTechs()]),
      researched: Object.freeze([...this.gameState.technology.getResearchedTechs()]),
      currentResearch: this.gameState.technology.getCurrentResearch(),
      researchQueue: Object.freeze([...this.gameState.technology.getResearchQueue()]),
    };
  }

  /**
   * Get the current research queue.
   */
  getResearchQueue(): readonly string[] {
    return Object.freeze([...this.gameState.technology.getResearchQueue()]);
  }

  /**
   * Get progress for a specific technology.
   */
  getResearchProgress(techId: string): number {
    return this.gameState.technology.getResearchProgress(techId);
  }

  /**
   * Get prerequisite chain for a technology.
   */
  getPrerequisiteChain(techId: string): readonly string[] {
    return Object.freeze([...this.gameState.technology.getPrerequisiteChain(techId)]);
  }

  /**
   * Get a specific technology by ID.
   */
  getById(techId: string): Readonly<Technology> | undefined {
    return this.gameState.technology.getTech(techId);
  }

  /**
   * Check if a technology has been researched.
   */
  isResearched(techId: string): boolean {
    return this.gameState.technology.isResearched(techId);
  }

  /**
   * Check if a technology can be researched.
   */
  canResearch(techId: string): CanDoResult {
    const tech = this.gameState.technology.getTech(techId);
    if (!tech) {
      return { allowed: false, reason: `Technology "${techId}" not found` };
    }

    if (this.gameState.technology.isResearched(techId)) {
      return { allowed: false, reason: "Technology already researched" };
    }

    const currentResearch = this.gameState.technology.getCurrentResearch();
    if (currentResearch) {
      return { allowed: false, reason: `Already researching: ${currentResearch.techId}` };
    }

    // Check prerequisites
    for (const prereq of tech.prerequisites) {
      if (!this.gameState.technology.isResearched(prereq)) {
        const prereqTech = this.gameState.technology.getTech(prereq);
        return {
          allowed: false,
          reason: `Requires prerequisite: ${prereqTech?.name ?? prereq}`,
        };
      }
    }

    // Check resource cost
    if (tech.cost.resources) {
      const affordability = this.checkAffordability(tech.cost.resources);
      if (!affordability.allowed) {
        return affordability;
      }
    }

    return { allowed: true };
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Start researching a technology.
   */
  startResearch(techId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canResearch(techId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: techId,
          reason: check.reason ?? "Cannot research",
        });
      }

      const success = this.gameState.technology.startResearch(techId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: techId,
          reason: "Research failed to start",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Cancel current research.
   */
  cancelResearch(): Result<void> {
    return this.executeCommand(() => {
      const current = this.gameState.technology.getCurrentResearch();
      if (!current) {
        return err({
          type: "INVALID_STATE",
          current: "none",
          expected: "researching",
          reason: "No research in progress",
        });
      }

      this.gameState.technology.cancelResearch();
      return ok(undefined);
    });
  }

  /**
   * Queue a technology and all its prerequisites.
   */
  queueResearch(techId: string): Result<void> {
    return this.executeCommand(() => {
      const success = this.gameState.technology.queueResearch(techId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: techId,
          reason: "Cannot queue research",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Clear the research queue (preserves progress).
   */
  clearQueue(): Result<void> {
    return this.executeCommand(() => {
      this.gameState.technology.cancelResearch();
      return ok(undefined);
    });
  }
}
