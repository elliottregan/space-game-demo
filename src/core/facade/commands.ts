// src/core/facade/commands.ts
// Command interface for game state mutations

import type {
  Result,
  GameError,
  Building,
  DecisionResult,
  GameEvent,
  ColonistRole,
  ExpeditionType,
  BuildingMode,
  PolicyType,
  PolicyValue,
  ActiveExpedition,
} from "./types";

/**
 * Command interface for mutating game state.
 * All methods return Result<T> for type-safe error handling.
 * Commands trigger state change notifications after execution.
 */
export interface GameCommands {
  // ==========================================================================
  // Building Commands
  // ==========================================================================

  /**
   * Start construction of a new building.
   * Deducts resources and creates a pending building.
   */
  buildStructure(defId: string): Result<Building>;

  /**
   * Change a building's operating mode.
   * Modes affect production/consumption rates.
   */
  setBuildingMode(buildingId: string, mode: BuildingMode): Result<void>;

  /**
   * Start recycling a building.
   * Building enters recycling state and returns partial resources when complete.
   */
  recycleBuilding(buildingId: string): Result<void>;

  /**
   * Rush recycling completion (costs resources).
   */
  rushRecycling(buildingId: string): Result<void>;

  /**
   * Start repurposing a building to a different type.
   * Converts an existing building to a new building type.
   */
  repurposeBuilding(buildingId: string, targetDefId: string): Result<void>;

  /**
   * Link a building to a deposit for resource extraction.
   */
  linkBuildingToDeposit(buildingId: string, depositId: string): Result<void>;

  // ==========================================================================
  // Technology Commands
  // ==========================================================================

  /**
   * Start researching a technology.
   * Deducts any resource costs and begins research progress.
   */
  startResearch(techId: string): Result<void>;

  /**
   * Cancel current research.
   * Does not refund resources.
   */
  cancelResearch(): Result<void>;

  // ==========================================================================
  // Colony Commands
  // ==========================================================================

  /**
   * Start training a colonist for a new role.
   */
  trainColonist(colonistId: string, targetRole: ColonistRole): Result<void>;

  /**
   * Cancel colonist training.
   */
  cancelTraining(colonistId: string): Result<void>;

  // ==========================================================================
  // Politics Commands
  // ==========================================================================

  /**
   * Make a political decision.
   * Applies effects and impacts faction support.
   */
  makeDecision(decisionId: string): Result<DecisionResult>;

  // ==========================================================================
  // Operations Commands
  // ==========================================================================

  /**
   * Set a colony policy.
   * Subject to cooldown between changes.
   */
  setPolicy(type: PolicyType, value: PolicyValue): Result<void>;

  /**
   * Launch an expedition.
   * Assigns crew and begins expedition countdown.
   */
  launchExpedition(type: ExpeditionType, crewIds: string[]): Result<ActiveExpedition>;

  /**
   * Reveal a hidden prospecting site (pay to see what's there).
   */
  revealSite(siteId: string): Result<void>;

  /**
   * Develop a revealed site (make it usable for mining).
   */
  developSite(siteId: string): Result<void>;

  // ==========================================================================
  // NPC Influence Commands
  // ==========================================================================

  /**
   * Propose a project for NPC voting.
   */
  proposeProject(projectId: string): Result<void>;

  /**
   * Lobby an NPC to increase their support.
   */
  lobbyNPC(npcId: string, supportBoost: number): Result<void>;

  /**
   * Create a council with selected NPCs.
   */
  createCouncil(name: string, memberIds: string[]): Result<void>;

  // ==========================================================================
  // Event Commands
  // ==========================================================================

  /**
   * Resolve an active event by choosing an option.
   */
  resolveEvent(choiceId: string): Result<GameEvent[]>;

  // ==========================================================================
  // Game Flow Commands
  // ==========================================================================

  /**
   * Advance the game by one sol (turn).
   */
  advanceSol(): Result<GameEvent[]>;

  /**
   * Advance the game by multiple sols.
   * Stops early if game over or active event requires input.
   */
  advanceSols(count: number): Result<{
    events: GameEvent[];
    solsAdvanced: number;
    stoppedEarly: boolean;
    reason?: "game_over" | "active_event";
  }>;

  // ==========================================================================
  // Persistence Commands
  // ==========================================================================

  /**
   * Start a new game, resetting all state.
   */
  newGame(): void;

  /**
   * Save the current game state to a string.
   */
  saveGame(): string;

  /**
   * Load game state from a saved string.
   */
  loadGame(saveData: string): Result<void>;
}
