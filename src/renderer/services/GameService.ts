import { reactive, readonly } from "vue";
import {
  GameFacade,
  type Resources,
  type ResourceDelta,
  type Building,
  type BuildingDefinition,
  type Technology,
  type TechResearch,
  type Colonist,
  type ColonistRole,
  type Faction,
  type Decision,
  type DecisionResult,
  type RandomEventDefinition,
  type EventChoice,
  type ActiveEvent,
  type VictoryState,
  type ColonyPolicies,
  type ActiveExpedition,
  type ProspectingSite,
  type GameEvent,
  type BuildingMode,
  type PolicyType,
  type PolicyValue,
  type ExpeditionType,
} from "../../core/facade";
import type { NPC, Project, Council } from "../../core/models/NPCInfluence";

/**
 * Reactive UI state interface.
 * This is the shape of state exposed to Vue components.
 */
interface GameUIState {
  currentSol: number;
  resources: Resources;
  production: ResourceDelta;
  consumption: ResourceDelta;
  netFlow: ResourceDelta;
  population: number;
  health: number;
  morale: number;
  colonists: Colonist[];
  buildings: Building[];
  pendingBuildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  technologies: Technology[];
  availableTechs: Technology[];
  researchedTechs: Technology[];
  currentResearch: TechResearch | null;
  factions: Faction[];
  averageSupport: number;
  decisions: Decision[];
  activeEvent: { definition: RandomEventDefinition; active: ActiveEvent } | null;
  eventChoices: EventChoice[];
  victoryState: VictoryState;
  recentEvents: GameEvent[];
  policies: ColonyPolicies;
  policyCooldownRemaining: number;
  activeExpeditions: ActiveExpedition[];
  prospectingSites: ProspectingSite[];
  npcInfluence: {
    npcs: NPC[];
    projects: Project[];
    activeProject: {
      projectId: string;
      supportLevels: Record<string, number>;
      solsRemaining: number;
      averageSupport: number;
    } | null;
    councils: Council[];
    relationshipMatrix: readonly number[][];
  };
}

/**
 * GameService bridges the core game façade with Vue's reactivity system.
 *
 * It provides two ways to interact with the game:
 * 1. Legacy methods (backward compatible) - Simple methods that return booleans/objects
 * 2. Façade API (recommended) - Type-safe API with Result<T> return types via `api` getter
 *
 * The façade automatically notifies the service when state changes,
 * triggering a sync to the reactive Vue state.
 */
class GameService {
  private facade: GameFacade;
  private state: GameUIState;

  constructor() {
    this.facade = new GameFacade();
    this.state = reactive(this.createInitialState());

    // Subscribe to façade state changes for automatic sync
    this.facade.onStateChange(() => this.syncState());

    this.syncState();
  }

  /**
   * Get the type-safe façade API for direct access.
   * Prefer using this for new code.
   *
   * @example
   * const result = gameService.api.buildStructure("solar_panel");
   * if (result.success) {
   *   console.log("Built:", result.data.id);
   * } else {
   *   console.error("Failed:", result.error.type);
   * }
   */
  get api(): GameFacade {
    return this.facade;
  }

  private createInitialState(): GameUIState {
    return {
      currentSol: 0,
      resources: { food: 0, oxygen: 0, water: 0, power: 0, materials: 0 },
      production: {},
      consumption: {},
      netFlow: {},
      population: 0,
      health: 100,
      morale: 100,
      colonists: [],
      buildings: [],
      pendingBuildings: [],
      buildingDefinitions: [],
      technologies: [],
      availableTechs: [],
      researchedTechs: [],
      currentResearch: null,
      factions: [],
      averageSupport: 50,
      decisions: [],
      activeEvent: null,
      eventChoices: [],
      victoryState: { status: "playing" },
      recentEvents: [],
      policies: {
        workIntensity: "standard",
        resourcePriority: "balanced",
        explorationStance: "standard",
        lastChangeAt: 0,
      },
      policyCooldownRemaining: 0,
      activeExpeditions: [],
      prospectingSites: [],
      npcInfluence: {
        npcs: [],
        projects: [],
        activeProject: null,
        councils: [],
        relationshipMatrix: [],
      },
    };
  }

  /**
   * Sync façade state to reactive Vue state.
   * Called automatically when façade notifies state change.
   */
  private syncState(): void {
    // Game state
    this.state.currentSol = this.facade.currentSol();

    // Resources
    const resources = this.facade.resources();
    this.state.resources = { ...resources.current };
    this.state.production = { ...resources.production };
    this.state.consumption = { ...resources.consumption };
    this.state.netFlow = { ...resources.netFlow };

    // Colony
    const colony = this.facade.colony();
    this.state.population = colony.population;
    this.state.health = colony.health;
    this.state.morale = colony.morale;
    this.state.colonists = [...colony.colonists];

    // Buildings
    const buildings = this.facade.buildings();
    this.state.buildings = [...buildings.active];
    this.state.pendingBuildings = [...buildings.pending];
    this.state.buildingDefinitions = [...buildings.definitions];

    // Technology
    const techs = this.facade.technologies();
    this.state.technologies = [...techs.all];
    this.state.availableTechs = [...techs.available];
    this.state.researchedTechs = [...techs.researched];
    this.state.currentResearch = techs.currentResearch ? { ...techs.currentResearch } : null;

    // Politics
    const politics = this.facade.politics();
    this.state.factions = [...politics.factions];
    this.state.averageSupport = politics.averageSupport;
    this.state.decisions = [...politics.decisions];

    // Events
    const activeEvent = this.facade.activeEvent();
    this.state.activeEvent = activeEvent
      ? { definition: { ...activeEvent.definition }, active: { ...activeEvent.active } }
      : null;
    this.state.eventChoices = activeEvent ? [...activeEvent.choices] : [];

    // Victory
    this.state.victoryState = { ...this.facade.victoryState() };

    // Operations
    const ops = this.facade.operations();
    this.state.policies = { ...ops.policies };
    this.state.policyCooldownRemaining = ops.policyCooldownRemaining;
    this.state.activeExpeditions = [...ops.expeditions];
    this.state.prospectingSites = [...ops.sites];

    // NPC Influence
    const npc = this.facade.npcInfluence();
    this.state.npcInfluence = {
      npcs: [...npc.npcs],
      projects: [...npc.projects],
      activeProject: npc.activeProject ? { ...npc.activeProject } : null,
      councils: [...npc.councils],
      relationshipMatrix: npc.relationshipMatrix,
    };
  }

  /**
   * Get readonly reactive state for Vue components.
   */
  getState() {
    return readonly(this.state);
  }

  // ==========================================================================
  // Legacy API (backward compatible)
  // These methods wrap the façade and return simple types.
  // New code should prefer using gameService.api.* methods directly.
  // ==========================================================================

  // Game actions
  tick(): GameEvent[] {
    const result = this.facade.advanceSol();
    if (result.success) {
      this.state.recentEvents = result.data;
      return result.data;
    }
    return [];
  }

  advanceTurn(sols: number = 10): GameEvent[] {
    const result = this.facade.advanceSols(sols);
    if (result.success) {
      this.state.recentEvents = result.data.events;
      return result.data.events;
    }
    return [];
  }

  // Building actions
  canBuild(defId: string): boolean {
    return this.facade.canBuild(defId).allowed;
  }

  startBuilding(defId: string): Building | null {
    const result = this.facade.buildStructure(defId);
    return result.success ? result.data : null;
  }

  getBuildingDefinition(defId: string): BuildingDefinition | undefined {
    return this.facade.getBuildingDefinition(defId);
  }

  // Technology actions
  canResearch(techId: string): boolean {
    return this.facade.canResearch(techId).allowed;
  }

  startResearch(techId: string): boolean {
    return this.facade.startResearch(techId).success;
  }

  cancelResearch(): void {
    this.facade.cancelResearch();
  }

  // Workforce actions
  startTraining(colonistId: string, targetRole: ColonistRole): boolean {
    return this.facade.trainColonist(colonistId, targetRole).success;
  }

  cancelTraining(colonistId: string): void {
    this.facade.cancelTraining(colonistId);
  }

  // Politics actions
  makeDecision(decisionId: string): DecisionResult | null {
    const result = this.facade.makeDecision(decisionId);
    return result.success ? result.data : null;
  }

  // Event actions
  resolveEvent(choiceId: string): GameEvent[] {
    const result = this.facade.resolveEvent(choiceId);
    return result.success ? result.data : [];
  }

  // Operations actions
  setPolicy(type: PolicyType, value: string): boolean {
    return this.facade.setPolicy(type, value as PolicyValue).success;
  }

  startExpedition(type: string, crewIds: string[]): boolean {
    return this.facade.launchExpedition(type as ExpeditionType, crewIds).success;
  }

  revealSite(siteId: string): boolean {
    return this.facade.revealSite(siteId).success;
  }

  developSite(siteId: string): boolean {
    return this.facade.developSite(siteId).success;
  }

  setBuildingMode(buildingId: string, mode: BuildingMode): boolean {
    return this.facade.setBuildingMode(buildingId, mode).success;
  }

  // NPC Influence actions
  proposeProject(projectId: string): boolean {
    return this.facade.proposeProject(projectId).success;
  }

  lobbyNPC(npcId: string, supportBoost: number): boolean {
    return this.facade.lobbyNPC(npcId, supportBoost).success;
  }

  createCouncil(name: string, memberIds: string[]): boolean {
    return this.facade.createCouncil(name, memberIds).success;
  }

  getLobbyCost(npcId: string, supportBoost: number): number {
    return this.facade.getLobbyCost(npcId, supportBoost);
  }

  // Deposit methods
  getDeposits(): ProspectingSite[] {
    return [...this.facade.operations().sites];
  }

  linkBuildingToDeposit(buildingId: string, depositId: string): boolean {
    return this.facade.linkBuildingToDeposit(buildingId, depositId).success;
  }

  getDepositWarningLevel(depositId: string): "none" | "warning" | "critical" | "depleted" {
    return this.facade.getDepositWarningLevel(depositId);
  }

  // Recycling methods
  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    return this.facade.getRecycleValue(buildingId);
  }

  startRecycling(buildingId: string): boolean {
    return this.facade.recycleBuilding(buildingId).success;
  }

  rushRecycling(buildingId: string): boolean {
    return this.facade.rushRecycling(buildingId).success;
  }

  // Repurposing methods
  canRepurpose(buildingId: string, targetDefId: string): boolean {
    return this.facade.canRepurpose(buildingId, targetDefId).allowed;
  }

  getRepurposeCost(targetDefId: string): ResourceDelta | undefined {
    return this.facade.getRepurposeCost(targetDefId);
  }

  startRepurposing(buildingId: string, targetDefId: string): boolean {
    return this.facade.repurposeBuilding(buildingId, targetDefId).success;
  }

  // Game management
  newGame(): void {
    this.facade.newGame();
    this.state.recentEvents = [];
  }

  saveGame(): string {
    return this.facade.saveGame();
  }

  loadGame(saveData: string): void {
    const result = this.facade.loadGame(saveData);
    if (!result.success) {
      console.error("Failed to load game:", result.error);
    }
  }
}

export const gameService = new GameService();
