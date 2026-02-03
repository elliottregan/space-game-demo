// src/facade/domains/GameFlowFacade.ts
// Game flow queries and commands facade

import { GameState } from "../../core/GameState";
import { STARTING_CONDITIONS } from "../../core/data/startingConditions";
import type { StartingCondition } from "../../core/models/StartingCondition";
import type { GridPosition, DepositType, PowerState } from "../../core/models/Grid";
import type { BuildingPlacement } from "../../core/models/Grid";
import type { AdvanceSolsResult, GameEvent, VictoryState } from "../types";
import { err, ok, type Result } from "../types/common";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;
type ResetGameState = (startingConditionId?: string) => void;
type AddEvents = (events: GameEvent[]) => void;

/**
 * Facade for game flow queries and commands.
 */
export class GameFlowFacade {
  constructor(
    private getGameState: () => GameState,
    private executeCommand: CommandExecutor,
    private resetGameState: ResetGameState,
    private addEvents: AddEvents,
  ) {}

  private get gameState(): GameState {
    return this.getGameState();
  }

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get the current sol (game turn).
   */
  currentSol(): number {
    return this.gameState.currentSol;
  }

  /**
   * Get victory/defeat state.
   */
  victoryState(): Readonly<VictoryState> {
    return Object.freeze(this.gameState.victory.getState());
  }

  /**
   * Check if the game is over.
   */
  isGameOver(): boolean {
    return this.gameState.victory.isGameOver();
  }

  /**
   * Get Earth crisis severity (0-100).
   */
  earthCrisisSeverity(): number {
    return this.gameState.earthCrisis.getSeverity();
  }

  /**
   * Check if Earth has reached point of no return.
   */
  earthCrisisPointOfNoReturn(): boolean {
    return this.gameState.earthCrisis.isPointOfNoReturn();
  }

  /**
   * Get all available starting conditions.
   */
  getStartingConditions(): readonly StartingCondition[] {
    return STARTING_CONDITIONS;
  }

  // ==========================================================================
  // Grid Queries
  // ==========================================================================

  /**
   * Get the position of a building on the grid.
   */
  getGridBuildingPosition(buildingId: string): GridPosition | null {
    return this.gameState.grid.getBuildingPosition(buildingId);
  }

  /**
   * Get the placement data for a building on the grid.
   */
  getGridPlacement(buildingId: string): BuildingPlacement | undefined {
    return this.gameState.grid.getPlacement(buildingId);
  }

  /**
   * Get all deposits on the grid.
   */
  getGridDeposits(): Array<{ position: GridPosition; type: DepositType }> {
    return this.gameState.grid.getAllDeposits();
  }

  /**
   * Get power state for a building.
   */
  getGridPowerState(buildingId: string): PowerState {
    return this.gameState.grid.getPowerState(buildingId);
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Advance the game by one sol (turn).
   */
  advanceSol(): Result<GameEvent[]> {
    return this.executeCommand(() => {
      if (this.isGameOver()) {
        return err({
          type: "INVALID_STATE",
          current: this.victoryState().status,
          expected: "playing",
          reason: "Game is over",
        });
      }

      const events = this.gameState.tick();
      this.addEvents(events);

      return ok(events);
    });
  }

  /**
   * Advance the game by multiple sols.
   */
  advanceSols(count: number): Result<AdvanceSolsResult> {
    return this.executeCommand(() => {
      if (this.isGameOver()) {
        return err({
          type: "INVALID_STATE",
          current: this.victoryState().status,
          expected: "playing",
          reason: "Game is over",
        });
      }

      const allEvents: GameEvent[] = [];
      let solsAdvanced = 0;
      let stoppedEarly = false;
      let reason: "game_over" | "active_event" | undefined;

      for (let i = 0; i < count; i++) {
        const events = this.gameState.tick();
        allEvents.push(...events);
        solsAdvanced++;

        if (this.gameState.victory.isGameOver()) {
          stoppedEarly = true;
          reason = "game_over";
          break;
        }

        if (this.gameState.events.hasActiveEvent()) {
          stoppedEarly = true;
          reason = "active_event";
          break;
        }
      }

      this.addEvents(allEvents);

      return ok({
        events: allEvents,
        solsAdvanced,
        stoppedEarly,
        reason,
      });
    });
  }

  /**
   * Start a new game, resetting all state.
   * @param startingConditionId - Optional starting condition ID
   */
  newGame(startingConditionId?: string): void {
    this.resetGameState(startingConditionId);
  }

  /**
   * Save the current game state to a string.
   */
  save(): string {
    return JSON.stringify(this.gameState.toJSON());
  }

  /**
   * Load game state from a saved string.
   */
  load(saveData: string): Result<void> {
    try {
      const data = JSON.parse(saveData);
      // Validate that the save data can be parsed (actual state is set by GameAPI)
      GameState.fromJSON(data);
      this.resetGameState();
      return ok(undefined);
    } catch (e) {
      return err({
        type: "INVALID_TARGET",
        target: "save data",
        reason: e instanceof Error ? e.message : "Invalid save data",
      });
    }
  }
}
