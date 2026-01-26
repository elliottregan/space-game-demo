import { reactive, readonly } from "vue";
import type { Council, NPC, Project } from "../../core/models/NPCInfluence";
import {
  type ActiveEvent,
  type ActiveExpedition,
  type Building,
  type BuildingDefinition,
  type BuildingMode,
  type Colonist,
  type ColonistRole,
  type ColonyPolicies,
  type EventChoice,
  type ExpeditionType,
  type FactionDemand,
  type FactionStatus,
  GameAPI,
  type GameEvent,
  type PolicyType,
  type PolicyValue,
  type ProspectingSite,
  type RandomEventDefinition,
  type ResourceDelta,
  type Resources,
  type SkillDefinition,
  type Technology,
  type TechResearch,
  type VictoryState,
} from "../../facade";

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
  moraleBoost: number;
  totalOxygenContribution: number;
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
  housingAssignments: Record<string, Colonist[]>;
  unhoused: Colonist[];
  buildings: Building[];
  pendingBuildings: Building[];
  buildingDefinitions: BuildingDefinition[];
  technologies: Technology[];
  availableTechs: Technology[];
  researchedTechs: Technology[];
  currentResearch: TechResearch | null;
  researchQueue: string[];
  politics: {
    factions: FactionStatus[];
    demands: FactionDemand[];
  };
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
    relationshipMatrix: readonly (readonly number[])[];
  };
}

/**
 * GameService bridges the core game API with Vue's reactivity system.
 *
 * It provides two ways to interact with the game:
 * 1. Legacy methods (backward compatible) - Simple methods that return booleans/objects
 * 2. Domain API (recommended) - Type-safe API with Result<T> return types via `api` getter
 *
 * The API automatically notifies the service when state changes,
 * triggering a sync to the reactive Vue state.
 *
 * @example
 * // Domain API (recommended)
 * const result = gameService.api.buildings.build("solar_panel");
 * if (result.success) {
 *   console.log("Built:", result.data.id);
 * } else {
 *   console.error("Failed:", result.error.type);
 * }
 *
 * // Check if action is allowed
 * const canBuild = gameService.api.buildings.canBuild("solar_panel");
 * if (canBuild.allowed) { ... }
 *
 * // Get state snapshots
 * const buildings = gameService.api.buildings.snapshot();
 * const resources = gameService.api.resources.snapshot();
 */
class GameService {
  private facade: GameAPI;
  private state: GameUIState;

  constructor() {
    this.facade = new GameAPI();
    this.state = reactive(this.createInitialState());

    // Subscribe to API state changes for automatic sync
    this.facade.onStateChange(() => this.syncState());

    this.syncState();
  }

  /**
   * Get the type-safe domain API for direct access.
   * Prefer using this for new code.
   *
   * Available domains:
   * - api.resources - Resource queries
   * - api.buildings - Building queries and commands
   * - api.technology - Technology queries and commands
   * - api.colony - Colony queries and workforce commands
   * - api.politics - Politics queries and decision commands
   * - api.operations - Operations queries and commands
   * - api.npc - NPC influence queries and commands
   * - api.events - Event queries and resolve command
   * - api.game - Game flow (advanceSol, save, load, newGame)
   */
  get api(): GameAPI {
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
      moraleBoost: 0,
      totalOxygenContribution: 0,
      colonists: [],
      skillDefinitions: [],
      housingAssignments: {},
      unhoused: [],
      buildings: [],
      pendingBuildings: [],
      buildingDefinitions: [],
      technologies: [],
      availableTechs: [],
      researchedTechs: [],
      currentResearch: null,
      researchQueue: [],
      politics: {
        factions: [],
        demands: [],
      },
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
   * Sync API state to reactive Vue state.
   * Called automatically when API notifies state change.
   */
  private syncState(): void {
    // Game state
    this.state.currentSol = this.facade.game.currentSol();

    // Resources
    const resources = this.facade.resources.snapshot();
    this.state.resources = { ...resources.current };
    this.state.production = { ...resources.production };
    this.state.consumption = { ...resources.consumption };
    this.state.netFlow = { ...resources.netFlow };

    // Colony
    const colony = this.facade.colony.snapshot();
    this.state.population = colony.population;
    this.state.health = colony.health;
    this.state.morale = colony.morale;
    this.state.colonists = [...colony.colonists];
    this.state.skillDefinitions = [...colony.skillDefinitions];

    // Housing data
    this.state.housingAssignments = { ...colony.housingAssignments };
    this.state.unhoused = [...colony.unhoused];

    // Buildings
    const buildings = this.facade.buildings.snapshot();
    this.state.buildings = [...buildings.active];
    this.state.pendingBuildings = [...buildings.pending];
    this.state.buildingDefinitions = [...buildings.definitions];
    this.state.moraleBoost = buildings.moraleBoost;
    this.state.totalOxygenContribution = buildings.totalOxygenContribution;

    // Technology
    const techs = this.facade.technology.snapshot();
    this.state.technologies = [...techs.all];
    this.state.availableTechs = [...techs.available];
    this.state.researchedTechs = [...techs.researched];
    this.state.currentResearch = techs.currentResearch ? { ...techs.currentResearch } : null;
    this.state.researchQueue = [...techs.researchQueue];

    // Politics
    const politicsSnapshot = this.facade.politics.snapshot();
    this.state.politics = {
      factions: [...politicsSnapshot.factions],
      demands: [...politicsSnapshot.demands],
    };

    // Events
    const activeEvent = this.facade.events.getActive();
    this.state.activeEvent = activeEvent
      ? { definition: { ...activeEvent.definition }, active: { ...activeEvent.active } }
      : null;
    this.state.eventChoices = activeEvent ? [...activeEvent.choices] : [];

    // Victory
    this.state.victoryState = { ...this.facade.game.victoryState() };

    // Operations
    const ops = this.facade.operations.snapshot();
    this.state.policies = { ...ops.policies };
    this.state.policyCooldownRemaining = ops.policyCooldownRemaining;
    this.state.activeExpeditions = [...ops.expeditions];
    this.state.prospectingSites = [...ops.sites];

    // NPC Influence
    const npc = this.facade.npc.snapshot();
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
  // These methods wrap the domain API and return simple types.
  // New code should prefer using gameService.api.* methods directly.
  // ==========================================================================

  // Game actions
  tick(): GameEvent[] {
    const result = this.facade.game.advanceSol();
    if (result.success) {
      this.state.recentEvents = result.data;
      return result.data;
    }
    return [];
  }

  advanceTurn(sols: number = 10): GameEvent[] {
    const result = this.facade.game.advanceSols(sols);
    if (result.success) {
      this.state.recentEvents = result.data.events;
      return result.data.events;
    }
    return [];
  }

  // Building actions
  canBuild(defId: string): boolean {
    return this.facade.buildings.canBuild(defId).allowed;
  }

  startBuilding(defId: string): Building | null {
    const result = this.facade.buildings.build(defId);
    return result.success ? result.data : null;
  }

  getBuildingDefinition(defId: string): BuildingDefinition | undefined {
    return this.facade.buildings.getDefinition(defId);
  }

  // Technology actions
  canResearch(techId: string): boolean {
    return this.facade.technology.canResearch(techId).allowed;
  }

  startResearch(techId: string): boolean {
    return this.facade.technology.startResearch(techId).success;
  }

  cancelResearch(): void {
    this.facade.technology.cancelResearch();
  }

  // Workforce actions
  startTraining(colonistId: string, targetRole: ColonistRole): boolean {
    return this.facade.colony.trainColonist(colonistId, targetRole).success;
  }

  cancelTraining(colonistId: string): void {
    this.facade.colony.cancelTraining(colonistId);
  }

  // Event actions
  resolveEvent(choiceId: string): GameEvent[] {
    const result = this.facade.events.resolve(choiceId);
    return result.success ? result.data : [];
  }

  // Operations actions
  setPolicy(type: PolicyType, value: string): boolean {
    return this.facade.operations.setPolicy(type, value as PolicyValue).success;
  }

  startExpedition(type: string, crewIds: string[]): boolean {
    return this.facade.operations.launchExpedition(type as ExpeditionType, crewIds).success;
  }

  revealSite(siteId: string): boolean {
    return this.facade.operations.revealSite(siteId).success;
  }

  developSite(siteId: string): boolean {
    return this.facade.operations.developSite(siteId).success;
  }

  setBuildingMode(buildingId: string, mode: BuildingMode): boolean {
    return this.facade.buildings.setMode(buildingId, mode).success;
  }

  // NPC Influence actions
  proposeProject(projectId: string): boolean {
    return this.facade.npc.proposeProject(projectId).success;
  }

  lobbyNPC(npcId: string, supportBoost: number): boolean {
    return this.facade.npc.lobbyNPC(npcId, supportBoost).success;
  }

  createCouncil(name: string, memberIds: string[]): boolean {
    return this.facade.npc.createCouncil(name, memberIds).success;
  }

  getLobbyCost(npcId: string, supportBoost: number): number {
    return this.facade.npc.getLobbyCost(npcId, supportBoost);
  }

  // Deposit methods
  getDeposits(): ProspectingSite[] {
    return [...this.facade.operations.snapshot().sites];
  }

  linkBuildingToDeposit(buildingId: string, depositId: string): boolean {
    return this.facade.buildings.linkToDeposit(buildingId, depositId).success;
  }

  getDepositWarningLevel(depositId: string): "none" | "warning" | "critical" | "depleted" {
    return this.facade.operations.getDepositWarningLevel(depositId);
  }

  // Recycling methods
  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    return this.facade.buildings.getRecycleValue(buildingId);
  }

  startRecycling(buildingId: string): boolean {
    return this.facade.buildings.recycle(buildingId).success;
  }

  rushRecycling(buildingId: string): boolean {
    return this.facade.buildings.rushRecycling(buildingId).success;
  }

  // Repurposing methods
  canRepurpose(buildingId: string, targetDefId: string): boolean {
    return this.facade.buildings.canRepurpose(buildingId, targetDefId).allowed;
  }

  getRepurposeCost(targetDefId: string): ResourceDelta | undefined {
    return this.facade.buildings.getRepurposeCost(targetDefId);
  }

  startRepurposing(buildingId: string, targetDefId: string): boolean {
    return this.facade.buildings.repurpose(buildingId, targetDefId).success;
  }

  // Game management
  newGame(): void {
    this.facade.newGame();
    this.state.recentEvents = [];
  }

  saveGame(): string {
    return this.facade.save();
  }

  loadGame(saveData: string): void {
    const result = this.facade.load(saveData);
    if (!result.success) {
      console.error("Failed to load game:", result.error);
    }
  }
}

export const gameService = new GameService();
