// src/facade/GameAPI.ts
// Main orchestrator that composes all domain facades

import { GameState } from "../core/GameState";
import { RESOURCE_KEYS } from "../core/models/Resources";
import {
  LifeSupportFacade,
  BuildingsFacade,
  ColonyFacade,
  DistrictFacade,
  EventsFacade,
  GameFlowFacade,
  GrantsFacade,
  IdeologyFacade,
  OperationsFacade,
  PoliticsFacade,
  ResourcesFacade,
  TechnologyFacade,
} from "./domains";
import type { CanDoResult, GameEvent, ResourceDelta, Result } from "./types";

/**
 * State change listener callback type.
 */
export type StateChangeListener = () => void;

/**
 * GameAPI composes all domain facades and provides a unified API surface.
 *
 * Access domains via:
 * - api.resources - Resource queries
 * - api.buildings - Building queries and commands
 * - api.technology - Technology queries and commands
 * - api.colony - Colony queries and workforce commands
 * - api.politics - Politics queries and decision commands
 * - api.operations - Operations queries and commands
 * - api.events - Event queries and resolve command
 * - api.game - Game flow (advanceSol, save, load, newGame)
 * - api.ideology - Ideology, council, and lobbying
 *
 * Key features:
 * - All queries return immutable snapshots
 * - All commands return Result<T> for type-safe error handling
 * - Automatic state change notifications after commands
 * - Centralized validation with detailed error messages
 */
export class GameAPI {
  private gameState: GameState;
  private stateListeners: Set<StateChangeListener> = new Set();
  private lastEvents: GameEvent[] = [];

  // Domain facades (lazily initialized)
  private _resources: ResourcesFacade | null = null;
  private _buildings: BuildingsFacade | null = null;
  private _technology: TechnologyFacade | null = null;
  private _colony: ColonyFacade | null = null;
  private _politics: PoliticsFacade | null = null;
  private _operations: OperationsFacade | null = null;
  private _events: EventsFacade | null = null;
  private _game: GameFlowFacade | null = null;
  private _lifeSupport: LifeSupportFacade | null = null;
  private _districts: DistrictFacade | null = null;
  private _ideology: IdeologyFacade | null = null;
  private _grants: GrantsFacade | null = null;

  constructor() {
    this.gameState = new GameState();
    this.initializeFacades();
  }

  private initializeFacades(): void {
    // Clear cached facades
    this._resources = null;
    this._buildings = null;
    this._technology = null;
    this._colony = null;
    this._politics = null;
    this._operations = null;
    this._events = null;
    this._game = null;
    this._lifeSupport = null;
    this._districts = null;
    this._ideology = null;
    this._grants = null;
  }

  // ==========================================================================
  // State Change Subscription
  // ==========================================================================

  /**
   * Subscribe to state changes.
   * Returns an unsubscribe function.
   */
  onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of a state change.
   */
  private notifyStateChange(): void {
    for (const listener of this.stateListeners) {
      listener();
    }
  }

  /**
   * Execute a command and notify listeners on completion.
   */
  private executeCommand = <T>(fn: () => Result<T>): Result<T> => {
    const result = fn();
    this.notifyStateChange();
    return result;
  };

  /**
   * Check if resources can afford a cost.
   */
  private checkAffordability = (cost: ResourceDelta): CanDoResult => {
    const current = this.gameState.resources.getResources();
    const missing: ResourceDelta = {};
    let canAfford = true;

    for (const key of RESOURCE_KEYS) {
      const required = cost[key] ?? 0;
      const available = current[key];
      if (required > available) {
        canAfford = false;
        missing[key] = required - available;
      }
    }

    if (canAfford) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Insufficient resources",
      missingResources: missing as Record<string, number>,
    };
  };

  /**
   * Add events to the history.
   */
  private addEvents = (events: GameEvent[]): void => {
    this.lastEvents.push(...events);
  };

  /**
   * Get last events.
   */
  private getLastEvents = (): GameEvent[] => {
    return this.lastEvents;
  };

  /**
   * Get the current game state (for facades).
   */
  private getGameState = (): GameState => {
    return this.gameState;
  };

  /**
   * Reset game state for new game.
   * @param startingConditionId - Optional starting condition ID
   */
  private resetGameState = (startingConditionId?: string): void => {
    this.gameState = new GameState(startingConditionId);
    this.lastEvents = [];
    this.initializeFacades();
    this.notifyStateChange();
  };

  // ==========================================================================
  // Domain Accessors
  // ==========================================================================

  /**
   * Resource queries (read-only - resources are modified through other domains).
   */
  get resources(): ResourcesFacade {
    if (!this._resources) {
      this._resources = new ResourcesFacade(this.gameState);
    }
    return this._resources;
  }

  /**
   * Building queries and commands.
   */
  get buildings(): BuildingsFacade {
    if (!this._buildings) {
      this._buildings = new BuildingsFacade(
        this.gameState,
        this.executeCommand,
        this.checkAffordability,
      );
    }
    return this._buildings;
  }

  /**
   * Technology queries and commands.
   */
  get technology(): TechnologyFacade {
    if (!this._technology) {
      this._technology = new TechnologyFacade(
        this.gameState,
        this.executeCommand,
        this.checkAffordability,
      );
    }
    return this._technology;
  }

  /**
   * Colony and workforce queries and commands.
   */
  get colony(): ColonyFacade {
    if (!this._colony) {
      this._colony = new ColonyFacade(this.gameState, this.executeCommand);
    }
    return this._colony;
  }

  /**
   * Politics queries and decision commands.
   */
  get politics(): PoliticsFacade {
    if (!this._politics) {
      this._politics = new PoliticsFacade(this.gameState);
    }
    return this._politics;
  }

  /**
   * Operations queries and commands (policies, expeditions, sites).
   */
  get operations(): OperationsFacade {
    if (!this._operations) {
      this._operations = new OperationsFacade(this.gameState, this.executeCommand);
    }
    return this._operations;
  }

  /**
   * Event queries and resolve command.
   */
  get events(): EventsFacade {
    if (!this._events) {
      this._events = new EventsFacade(
        this.gameState,
        this.executeCommand,
        this.getLastEvents,
        this.addEvents,
      );
    }
    return this._events;
  }

  /**
   * Game flow commands (advanceSol, save, load, newGame).
   */
  get game(): GameFlowFacade {
    if (!this._game) {
      this._game = new GameFlowFacade(
        this.getGameState,
        this.executeCommand,
        this.resetGameState,
        this.addEvents,
      );
    }
    return this._game;
  }

  /**
   * Life support queries (read-only).
   */
  get lifeSupport(): LifeSupportFacade {
    if (!this._lifeSupport) {
      this._lifeSupport = new LifeSupportFacade(this.gameState);
    }
    return this._lifeSupport;
  }

  /**
   * District queries (population, buildings, power).
   */
  get districts(): DistrictFacade {
    if (!this._districts) {
      this._districts = new DistrictFacade(this.gameState);
    }
    return this._districts;
  }

  /**
   * Ideology queries (council, faction support, project eligibility).
   */
  get ideology(): IdeologyFacade {
    if (!this._ideology) {
      this._ideology = new IdeologyFacade(this.gameState);
    }
    return this._ideology;
  }

  /**
   * Grants queries and commands (available grants, assign to districts).
   */
  get grants(): GrantsFacade {
    if (!this._grants) {
      this._grants = new GrantsFacade(this.gameState, this.executeCommand);
    }
    return this._grants;
  }

  // ==========================================================================
  // Persistence (direct methods for convenience)
  // ==========================================================================

  /**
   * Save the current game state to a string.
   */
  save(): string {
    return this.game.save();
  }

  /**
   * Load game state from a saved string.
   */
  load(saveData: string): Result<void> {
    try {
      const data = JSON.parse(saveData);
      this.gameState = GameState.fromJSON(data);
      this.lastEvents = [];
      this.initializeFacades();
      this.notifyStateChange();
      return { success: true, data: undefined };
    } catch (e) {
      return {
        success: false,
        error: {
          type: "INVALID_TARGET",
          target: "save data",
          reason: e instanceof Error ? e.message : "Invalid save data",
        },
      };
    }
  }

  /**
   * Start a new game.
   * @param startingConditionId - Optional starting condition ID
   */
  newGame(startingConditionId?: string): void {
    this.resetGameState(startingConditionId);
  }
}
