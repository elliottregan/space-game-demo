// src/core/facade/queries.ts
// Query interface for read-only game state access

import type {
  ResourceSnapshot,
  BuildingSnapshot,
  TechnologySnapshot,
  ColonySnapshot,
  PoliticsSnapshot,
  OperationsSnapshot,
  NPCInfluenceSnapshot,
  ActiveEventSnapshot,
  CanDoResult,
  ResourceDelta,
  Building,
  BuildingDefinition,
  Technology,
  Colonist,
  ColonistRole,
  Decision,
  GameEvent,
  VictoryState,
  ProspectingSite,
  ExpeditionType,
  BuildingMode,
} from "./types";

/**
 * Query interface for read-only access to game state.
 * All methods return immutable snapshots - no side effects.
 */
export interface GameQueries {
  // ==========================================================================
  // Resource Queries
  // ==========================================================================

  /**
   * Get complete resource state snapshot.
   */
  resources(): ResourceSnapshot;

  /**
   * Check if the player can afford a given cost.
   */
  canAfford(cost: ResourceDelta): boolean;

  /**
   * Get detailed affordability check with missing resources.
   */
  checkAffordability(cost: ResourceDelta): CanDoResult;

  // ==========================================================================
  // Building Queries
  // ==========================================================================

  /**
   * Get complete building state snapshot.
   */
  buildings(): BuildingSnapshot;

  /**
   * Get a specific building by ID.
   */
  getBuildingById(id: string): Readonly<Building> | undefined;

  /**
   * Get a building definition by ID.
   */
  getBuildingDefinition(defId: string): Readonly<BuildingDefinition> | undefined;

  /**
   * Check if a building can be constructed.
   */
  canBuild(defId: string): CanDoResult;

  /**
   * Check if a building's mode can be changed.
   */
  canSetBuildingMode(buildingId: string, mode: BuildingMode): CanDoResult;

  /**
   * Get the recycle value for a building.
   */
  getRecycleValue(buildingId: string): ResourceDelta | undefined;

  /**
   * Check if a building can be recycled.
   */
  canRecycle(buildingId: string): CanDoResult;

  /**
   * Check if a building can be repurposed to a target type.
   */
  canRepurpose(buildingId: string, targetDefId: string): CanDoResult;

  /**
   * Get the cost to repurpose to a target building type.
   */
  getRepurposeCost(targetDefId: string): ResourceDelta | undefined;

  // ==========================================================================
  // Technology Queries
  // ==========================================================================

  /**
   * Get complete technology state snapshot.
   */
  technologies(): TechnologySnapshot;

  /**
   * Get a specific technology by ID.
   */
  getTechnologyById(techId: string): Readonly<Technology> | undefined;

  /**
   * Check if a technology has been researched.
   */
  isResearched(techId: string): boolean;

  /**
   * Check if a technology can be researched.
   */
  canResearch(techId: string): CanDoResult;

  // ==========================================================================
  // Colony Queries
  // ==========================================================================

  /**
   * Get complete colony state snapshot.
   */
  colony(): ColonySnapshot;

  /**
   * Get a specific colonist by ID.
   */
  getColonistById(id: string): Readonly<Colonist> | undefined;

  /**
   * Check if a colonist can be trained for a role.
   */
  canTrain(colonistId: string, targetRole: ColonistRole): CanDoResult;

  /**
   * Get colonists with a specific role.
   */
  getColonistsByRole(role: ColonistRole): readonly Readonly<Colonist>[];

  /**
   * Get colonists currently in training.
   */
  getColonistsInTraining(): readonly Readonly<Colonist>[];

  // ==========================================================================
  // Politics Queries
  // ==========================================================================

  /**
   * Get complete politics state snapshot.
   */
  politics(): PoliticsSnapshot;

  /**
   * Get a specific decision by ID.
   */
  getDecisionById(id: string): Readonly<Decision> | undefined;

  /**
   * Check if a decision can be made (has enough support).
   */
  canMakeDecision(decisionId: string): CanDoResult;

  // ==========================================================================
  // Operations Queries
  // ==========================================================================

  /**
   * Get complete operations state snapshot.
   */
  operations(): OperationsSnapshot;

  /**
   * Check if a policy can be changed.
   */
  canChangePolicy(): CanDoResult;

  /**
   * Check if an expedition can be started.
   */
  canStartExpedition(type: ExpeditionType, crewIds: string[]): CanDoResult;

  /**
   * Get a prospecting site by ID.
   */
  getSiteById(siteId: string): Readonly<ProspectingSite> | undefined;

  /**
   * Check if a site can be revealed.
   */
  canRevealSite(siteId: string): CanDoResult;

  /**
   * Check if a site can be developed.
   */
  canDevelopSite(siteId: string): CanDoResult;

  /**
   * Get deposit depletion warning level.
   */
  getDepositWarningLevel(depositId: string): "none" | "warning" | "critical" | "depleted";

  /**
   * Get developed sites that can be linked to buildings.
   */
  getAvailableDeposits(): readonly Readonly<ProspectingSite>[];

  // ==========================================================================
  // NPC Influence Queries
  // ==========================================================================

  /**
   * Get complete NPC influence state snapshot.
   */
  npcInfluence(): NPCInfluenceSnapshot;

  /**
   * Get lobby cost for an NPC.
   */
  getLobbyCost(npcId: string, supportBoost: number): number;

  /**
   * Check if a project can be proposed.
   */
  canProposeProject(projectId: string): CanDoResult;

  /**
   * Check if an NPC can be lobbied.
   */
  canLobbyNPC(npcId: string, supportBoost: number): CanDoResult;

  // ==========================================================================
  // Event Queries
  // ==========================================================================

  /**
   * Get the active event requiring player input, if any.
   */
  activeEvent(): ActiveEventSnapshot | null;

  /**
   * Check if there's an active event blocking game progress.
   */
  hasActiveEvent(): boolean;

  /**
   * Get recent game events.
   */
  recentEvents(limit?: number): readonly Readonly<GameEvent>[];

  // ==========================================================================
  // Game State Queries
  // ==========================================================================

  /**
   * Get the current sol (game turn).
   */
  currentSol(): number;

  /**
   * Get victory/defeat state.
   */
  victoryState(): Readonly<VictoryState>;

  /**
   * Check if the game is over.
   */
  isGameOver(): boolean;
}
