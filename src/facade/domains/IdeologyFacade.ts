// src/facade/domains/IdeologyFacade.ts

import type { GameState } from "../../core/GameState";
import type { Queryable } from "../types/interfaces";
import type { IdeologySnapshot, FactionSnapshot, CouncilMemberSnapshot } from "../types/ideology";

/**
 * Facade for ideology system queries.
 * Provides access to council, faction support, and policy declarations.
 *
 * Implements: Queryable<IdeologySnapshot>
 */
export class IdeologyFacade implements Queryable<IdeologySnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete ideology state snapshot.
   */
  snapshot(): IdeologySnapshot {
    const council = this.getCouncil();
    const councilFactionCounts = this.gameState.ideology.getCouncilFactionCounts();
    const factionSupport = this.getFactionSupport();
    const factions = this.getFactions();

    return {
      council,
      councilFactionCounts,
      factionSupport,
      factions,
    };
  }

  /**
   * Get current council members.
   */
  getCouncil(): CouncilMemberSnapshot[] {
    return [...this.gameState.ideology.getCouncil()];
  }

  /**
   * Get colony-wide faction support levels keyed by faction id.
   */
  getFactionSupport(): Record<string, number> {
    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    return this.gameState.ideology.calculateFactionSupport(colonists, relationshipManager);
  }

  /**
   * Get current faction states.
   */
  getFactions(): FactionSnapshot[] {
    return this.gameState.ideology.getFactions().map((f) => ({
      id: f.id,
      name: f.name,
      baseId: f.baseId,
      position: { ...f.position },
      pressure: { ...f.pressure },
    }));
  }

  /**
   * Get the currently active policy, or null.
   */
  getActivePolicy(): {
    policy: {
      id: string;
      name: string;
      axis: string;
      direction: number;
      strength: number;
      duration: number;
    };
    startSol: number;
  } | null {
    return this.gameState.ideology.getActivePolicy();
  }

  /**
   * Declare a policy, replacing any existing one.
   * Returns true if the policy was successfully declared.
   */
  declarePolicy(policyId: string): boolean {
    return this.gameState.ideology.declarePolicy(policyId, this.gameState.currentSol);
  }

  /**
   * Rally a faction to boost conviction of aligned colonists.
   * This improves council representation (council = centrality × conviction).
   * Returns the number of colonists affected, or 0 if on cooldown.
   */
  rallyFaction(factionId: string): number {
    const colonists = this.gameState.colony.getColonists();
    return this.gameState.ideology.rallyFaction(factionId, colonists, this.gameState.currentSol);
  }

  /**
   * Check if rally is available (not on cooldown).
   */
  canRally(): boolean {
    return this.gameState.ideology.canRally(this.gameState.currentSol);
  }

  /**
   * Get the ideological pressure a colonist experiences from their neighbors.
   * Returns the weighted average ideology neighbors are pushing toward,
   * along with pressure strength and conviction growth/decay rate.
   */
  getIdeologicalPressure(colonistId: string): {
    pressure: { solidarity: number; sovereignty: number; transformation: number };
    totalWeight: number;
    neighborCount: number;
    convictionPressure: { growth: boolean; rate: number };
  } | null {
    const colonist = this.gameState.colony.getColonists().find((c) => c.id === colonistId);
    if (!colonist) return null;

    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    return this.gameState.ideology.calculateIdeologicalPressure(
      colonist,
      colonists,
      relationshipManager,
    );
  }
}
