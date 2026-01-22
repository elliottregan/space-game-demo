// src/core/facade/GameFacade.ts
// Main façade implementation for type-safe game interactions

import { GameState } from "../GameState";
import { RESOURCE_KEYS } from "../models/Resources";
import type { GameQueries } from "./queries";
import type { GameCommands } from "./commands";
import {
  ok,
  err,
  type Result,
  type ResourceSnapshot,
  type BuildingSnapshot,
  type TechnologySnapshot,
  type ColonySnapshot,
  type PoliticsSnapshot,
  type OperationsSnapshot,
  type NPCInfluenceSnapshot,
  type ActiveEventSnapshot,
  type CanDoResult,
  type ResourceDelta,
  type Building,
  type BuildingDefinition,
  type Technology,
  type Colonist,
  type ColonistRole,
  type Decision,
  type DecisionResult,
  type GameEvent,
  type VictoryState,
  type ProspectingSite,
  type ExpeditionType,
  type BuildingMode,
  type PolicyType,
  type PolicyValue,
  type ActiveExpedition,
  type GameError,
} from "./types";

/**
 * State change listener callback type.
 */
export type StateChangeListener = () => void;

/**
 * GameFacade provides a type-safe public API for all game interactions.
 * It implements both GameQueries (read) and GameCommands (write) interfaces.
 *
 * Key features:
 * - All queries return immutable snapshots
 * - All commands return Result<T> for type-safe error handling
 * - Automatic state change notifications after commands
 * - Centralized validation with detailed error messages
 */
export class GameFacade implements GameQueries, GameCommands {
  private gameState: GameState;
  private stateListeners: Set<StateChangeListener> = new Set();
  private lastEvents: GameEvent[] = [];

  constructor() {
    this.gameState = new GameState();
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
   * Execute a command and notify listeners on success.
   */
  private executeCommand<T>(fn: () => Result<T>): Result<T> {
    const result = fn();
    this.notifyStateChange();
    return result;
  }

  // ==========================================================================
  // Resource Queries
  // ==========================================================================

  resources(): ResourceSnapshot {
    return {
      current: Object.freeze({ ...this.gameState.resources.getResources() }),
      production: Object.freeze({ ...this.gameState.resources.getProduction() }),
      consumption: Object.freeze({ ...this.gameState.resources.getConsumption() }),
      netFlow: Object.freeze({ ...this.gameState.resources.getNetFlow() }),
    };
  }

  canAfford(cost: ResourceDelta): boolean {
    return this.gameState.resources.canAfford(cost);
  }

  checkAffordability(cost: ResourceDelta): CanDoResult {
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
      missingResources: missing,
    };
  }

  // ==========================================================================
  // Building Queries
  // ==========================================================================

  buildings(): BuildingSnapshot {
    return {
      active: Object.freeze([...this.gameState.buildings.getActiveBuildings()]),
      pending: Object.freeze([...this.gameState.buildings.getPendingBuildings()]),
      definitions: Object.freeze([...this.gameState.buildings.getAllDefinitions()]),
    };
  }

  getBuildingById(id: string): Readonly<Building> | undefined {
    return this.gameState.buildings.getBuilding(id);
  }

  getBuildingDefinition(defId: string): Readonly<BuildingDefinition> | undefined {
    return this.gameState.buildings.getDefinition(defId);
  }

  canBuild(defId: string): CanDoResult {
    const def = this.gameState.buildings.getDefinition(defId);
    if (!def) {
      return { allowed: false, reason: `Building type "${defId}" not found` };
    }

    // Check tech requirements
    if (def.requiredTech && !this.gameState.technology.isResearched(def.requiredTech)) {
      const tech = this.gameState.technology.getTech(def.requiredTech);
      return {
        allowed: false,
        reason: `Requires technology: ${tech?.name ?? def.requiredTech}`,
      };
    }

    // Check resource cost
    const affordability = this.checkAffordability(def.cost);
    if (!affordability.allowed) {
      return affordability;
    }

    return { allowed: true };
  }

  canSetBuildingMode(buildingId: string, mode: BuildingMode): CanDoResult {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) {
      return { allowed: false, reason: "Building not found" };
    }

    if (building.status !== "active") {
      return { allowed: false, reason: `Building must be active (current: ${building.status})` };
    }

    if (building.mode === mode) {
      return { allowed: false, reason: `Building is already in ${mode} mode` };
    }

    return { allowed: true };
  }

  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    return this.gameState.buildings.getRecycleValue(buildingId);
  }

  canRecycle(buildingId: string): CanDoResult {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) {
      return { allowed: false, reason: "Building not found" };
    }

    if (building.status === "recycling") {
      return { allowed: false, reason: "Building is already being recycled" };
    }

    if (building.status === "pending") {
      return { allowed: false, reason: "Cannot recycle a building under construction" };
    }

    return { allowed: true };
  }

  canRepurpose(buildingId: string, targetDefId: string): CanDoResult {
    const canDo = this.gameState.buildings.canRepurpose(
      buildingId,
      targetDefId,
      this.gameState.resources,
      this.gameState.technology
    );

    if (!canDo) {
      const building = this.gameState.buildings.getBuilding(buildingId);
      if (!building) {
        return { allowed: false, reason: "Building not found" };
      }

      const sourceDef = this.gameState.buildings.getDefinition(building.definitionId);
      if (!sourceDef?.repurposeTargets?.includes(targetDefId)) {
        return { allowed: false, reason: "This building cannot be repurposed to that type" };
      }

      const targetDef = this.gameState.buildings.getDefinition(targetDefId);
      if (targetDef?.requiredTech && !this.gameState.technology.isResearched(targetDef.requiredTech)) {
        return { allowed: false, reason: `Requires technology: ${targetDef.requiredTech}` };
      }

      return { allowed: false, reason: "Cannot repurpose (insufficient resources or invalid state)" };
    }

    return { allowed: true };
  }

  getRepurposeCost(targetDefId: string): ResourceDelta | undefined {
    return this.gameState.buildings.getRepurposeCost(targetDefId);
  }

  // ==========================================================================
  // Technology Queries
  // ==========================================================================

  technologies(): TechnologySnapshot {
    return {
      all: Object.freeze([...this.gameState.technology.getAllTechs()]),
      available: Object.freeze([...this.gameState.technology.getAvailableTechs()]),
      researched: Object.freeze([...this.gameState.technology.getResearchedTechs()]),
      currentResearch: this.gameState.technology.getCurrentResearch(),
    };
  }

  getTechnologyById(techId: string): Readonly<Technology> | undefined {
    return this.gameState.technology.getTech(techId);
  }

  isResearched(techId: string): boolean {
    return this.gameState.technology.isResearched(techId);
  }

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
  // Colony Queries
  // ==========================================================================

  colony(): ColonySnapshot {
    return {
      population: this.gameState.colony.getPopulation(),
      health: this.gameState.colony.getHealth(),
      morale: this.gameState.colony.getMorale(),
      colonists: Object.freeze([...this.gameState.colony.getColonists()]),
    };
  }

  getColonistById(id: string): Readonly<Colonist> | undefined {
    return this.gameState.colony.getColonist(id);
  }

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

  getColonistsByRole(role: ColonistRole): readonly Readonly<Colonist>[] {
    return this.gameState.colony.getColonists().filter((c) => c.role === role);
  }

  getColonistsInTraining(): readonly Readonly<Colonist>[] {
    return this.gameState.colony.getColonists().filter((c) => c.trainingTarget !== undefined);
  }

  // ==========================================================================
  // Politics Queries
  // ==========================================================================

  politics(): PoliticsSnapshot {
    return {
      factions: Object.freeze([...this.gameState.politics.getFactions()]),
      averageSupport: this.gameState.politics.getAverageSupport(),
      decisions: Object.freeze([...this.gameState.politics.getAvailableDecisions()]),
    };
  }

  getDecisionById(id: string): Readonly<Decision> | undefined {
    return this.gameState.politics.getDecision(id);
  }

  canMakeDecision(decisionId: string): CanDoResult {
    const decision = this.gameState.politics.getDecision(decisionId);
    if (!decision) {
      return { allowed: false, reason: "Decision not found" };
    }

    const avgSupport = this.gameState.politics.getAverageSupport();
    if (avgSupport < decision.requiredSupport) {
      return {
        allowed: false,
        reason: `Requires ${decision.requiredSupport}% support (current: ${avgSupport.toFixed(0)}%)`,
      };
    }

    return { allowed: true };
  }

  // ==========================================================================
  // Operations Queries
  // ==========================================================================

  operations(): OperationsSnapshot {
    return {
      policies: Object.freeze({ ...this.gameState.operations.getPolicies() }),
      policyCooldownRemaining: this.gameState.operations.getSolsUntilPolicyChange(
        this.gameState.currentSol
      ),
      expeditions: Object.freeze([...this.gameState.operations.getActiveExpeditions()]),
      sites: Object.freeze([...this.gameState.operations.getSites()]),
    };
  }

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

  canStartExpedition(_type: ExpeditionType, crewIds: string[]): CanDoResult {
    // Validate crew exists
    for (const crewId of crewIds) {
      const colonist = this.gameState.colony.getColonist(crewId);
      if (!colonist) {
        return { allowed: false, reason: `Colonist "${crewId}" not found` };
      }
    }

    // Check if we can start (resource costs, etc.)
    // The operations manager handles detailed validation
    return { allowed: true };
  }

  getSiteById(siteId: string): Readonly<ProspectingSite> | undefined {
    return this.gameState.operations.getSites().find((s) => s.id === siteId);
  }

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

  getDepositWarningLevel(depositId: string): "none" | "warning" | "critical" | "depleted" {
    return this.gameState.operations.getDepletionWarningLevel(depositId);
  }

  getAvailableDeposits(): readonly Readonly<ProspectingSite>[] {
    return this.gameState.operations
      .getSites()
      .filter((s) => s.developed && !s.linkedBuildingId);
  }

  // ==========================================================================
  // NPC Influence Queries
  // ==========================================================================

  npcInfluence(): NPCInfluenceSnapshot {
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

  getLobbyCost(npcId: string, supportBoost: number): number {
    return this.gameState.npcInfluence.getLobbyCost(npcId, supportBoost);
  }

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
  // Event Queries
  // ==========================================================================

  activeEvent(): ActiveEventSnapshot | null {
    const active = this.gameState.events.getActiveEvent();
    if (!active) return null;

    return {
      definition: Object.freeze(active.definition),
      active: Object.freeze(active.active),
      choices: Object.freeze([...this.gameState.events.getEventChoices()]),
    };
  }

  hasActiveEvent(): boolean {
    return this.gameState.events.hasActiveEvent();
  }

  recentEvents(limit: number = 15): readonly Readonly<GameEvent>[] {
    return Object.freeze([...this.lastEvents.slice(-limit)]);
  }

  // ==========================================================================
  // Game State Queries
  // ==========================================================================

  currentSol(): number {
    return this.gameState.currentSol;
  }

  victoryState(): Readonly<VictoryState> {
    return Object.freeze(this.gameState.victory.getState());
  }

  isGameOver(): boolean {
    return this.gameState.victory.isGameOver();
  }

  // ==========================================================================
  // Building Commands
  // ==========================================================================

  buildStructure(defId: string): Result<Building> {
    return this.executeCommand(() => {
      const check = this.canBuild(defId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: defId,
          reason: check.reason ?? "Cannot build",
        });
      }

      const building = this.gameState.buildings.startBuilding(
        defId,
        this.gameState.resources,
        this.gameState.technology
      );

      if (!building) {
        return err({
          type: "INVALID_TARGET",
          target: defId,
          reason: "Build operation failed",
        });
      }

      return ok(building);
    });
  }

  setBuildingMode(buildingId: string, mode: BuildingMode): Result<void> {
    return this.executeCommand(() => {
      const check = this.canSetBuildingMode(buildingId, mode);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getBuildingById(buildingId)?.mode ?? "unknown",
          expected: mode,
          reason: check.reason ?? "Cannot change mode",
        });
      }

      const success = this.gameState.buildings.setBuildingMode(
        buildingId,
        mode,
        this.gameState.resources
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Mode change failed",
        });
      }

      return ok(undefined);
    });
  }

  recycleBuilding(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canRecycle(buildingId);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getBuildingById(buildingId)?.status ?? "unknown",
          expected: "active",
          reason: check.reason ?? "Cannot recycle",
        });
      }

      const success = this.gameState.buildings.startRecycling(buildingId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Recycle operation failed",
        });
      }

      return ok(undefined);
    });
  }

  rushRecycling(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const building = this.getBuildingById(buildingId);
      if (!building) {
        return err({
          type: "NOT_FOUND",
          entity: "building",
          id: buildingId,
        });
      }

      if (building.status !== "recycling") {
        return err({
          type: "INVALID_STATE",
          current: building.status,
          expected: "recycling",
          reason: "Building must be in recycling state",
        });
      }

      const success = this.gameState.buildings.rushRecycling(buildingId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INSUFFICIENT_RESOURCES",
          required: { materials: 10 }, // Approximate cost
          available: this.gameState.resources.getResources(),
        });
      }

      return ok(undefined);
    });
  }

  repurposeBuilding(buildingId: string, targetDefId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canRepurpose(buildingId, targetDefId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: targetDefId,
          reason: check.reason ?? "Cannot repurpose",
        });
      }

      const success = this.gameState.buildings.startRepurposing(
        buildingId,
        targetDefId,
        this.gameState.resources,
        this.gameState.technology
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Repurpose operation failed",
        });
      }

      return ok(undefined);
    });
  }

  linkBuildingToDeposit(buildingId: string, depositId: string): Result<void> {
    return this.executeCommand(() => {
      const building = this.getBuildingById(buildingId);
      if (!building) {
        return err({
          type: "NOT_FOUND",
          entity: "building",
          id: buildingId,
        });
      }

      const site = this.getSiteById(depositId);
      if (!site) {
        return err({
          type: "NOT_FOUND",
          entity: "site",
          id: depositId,
        });
      }

      if (!site.developed) {
        return err({
          type: "INVALID_STATE",
          current: "undeveloped",
          expected: "developed",
          reason: "Site must be developed before linking",
        });
      }

      const success = this.gameState.operations.linkBuildingToDeposit(buildingId, depositId);
      if (success) {
        const buildingRef = this.gameState.buildings.getBuilding(buildingId);
        if (buildingRef) {
          buildingRef.depositId = depositId;
        }
      }

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: depositId,
          reason: "Failed to link building to deposit",
        });
      }

      return ok(undefined);
    });
  }

  // ==========================================================================
  // Technology Commands
  // ==========================================================================

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

  // ==========================================================================
  // Colony Commands
  // ==========================================================================

  trainColonist(colonistId: string, targetRole: ColonistRole): Result<void> {
    return this.executeCommand(() => {
      const check = this.canTrain(colonistId, targetRole);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getColonistById(colonistId)?.role ?? "unknown",
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

  // ==========================================================================
  // Politics Commands
  // ==========================================================================

  makeDecision(decisionId: string): Result<DecisionResult> {
    return this.executeCommand(() => {
      const check = this.canMakeDecision(decisionId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: decisionId,
          reason: check.reason ?? "Cannot make decision",
        });
      }

      const decision = this.gameState.politics.getDecision(decisionId);
      if (!decision) {
        return err({
          type: "NOT_FOUND",
          entity: "decision",
          id: decisionId,
        });
      }

      const result = this.gameState.politics.makeDecision(decision, this.gameState.resources);

      if (!result) {
        return err({
          type: "INVALID_TARGET",
          target: decisionId,
          reason: "Decision failed",
        });
      }

      return ok(result);
    });
  }

  // ==========================================================================
  // Operations Commands
  // ==========================================================================

  setPolicy(type: PolicyType, value: PolicyValue): Result<void> {
    return this.executeCommand(() => {
      const check = this.canChangePolicy();
      if (!check.allowed) {
        return err({
          type: "COOLDOWN_ACTIVE",
          remainingSols: this.gameState.operations.getSolsUntilPolicyChange(
            this.gameState.currentSol
          ),
        });
      }

      const success = this.gameState.operations.setPolicy(
        type,
        value as never,
        this.gameState.currentSol
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
        this.gameState.currentSol
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: type,
          reason: "Expedition launch failed",
        });
      }

      // Find the newly created expedition
      const expeditions = this.gameState.operations.getActiveExpeditions();
      const newExpedition = expeditions[expeditions.length - 1];

      return ok(newExpedition);
    });
  }

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

  // ==========================================================================
  // NPC Influence Commands
  // ==========================================================================

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

  // ==========================================================================
  // Event Commands
  // ==========================================================================

  resolveEvent(choiceId: string): Result<GameEvent[]> {
    return this.executeCommand(() => {
      if (!this.hasActiveEvent()) {
        return err({
          type: "INVALID_STATE",
          current: "no active event",
          expected: "active event",
          reason: "No active event to resolve",
        });
      }

      const events = this.gameState.events.resolveEvent(
        choiceId,
        this.gameState.resources,
        this.gameState.colony,
        this.gameState.politics
      );

      this.lastEvents.push(...events);

      return ok(events);
    });
  }

  // ==========================================================================
  // Game Flow Commands
  // ==========================================================================

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
      this.lastEvents.push(...events);

      return ok(events);
    });
  }

  advanceSols(count: number): Result<{
    events: GameEvent[];
    solsAdvanced: number;
    stoppedEarly: boolean;
    reason?: "game_over" | "active_event";
  }> {
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

      this.lastEvents.push(...allEvents);

      return ok({
        events: allEvents,
        solsAdvanced,
        stoppedEarly,
        reason,
      });
    });
  }

  // ==========================================================================
  // Persistence Commands
  // ==========================================================================

  newGame(): void {
    this.gameState = new GameState();
    this.lastEvents = [];
    this.notifyStateChange();
  }

  saveGame(): string {
    return JSON.stringify(this.gameState.toJSON());
  }

  loadGame(saveData: string): Result<void> {
    try {
      const data = JSON.parse(saveData);
      this.gameState = GameState.fromJSON(data);
      this.lastEvents = [];
      this.notifyStateChange();
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
