import { reactive, readonly } from "vue";
import { GameState } from "../../core/GameState";
import type { GameEvent } from "../../core/models/GameEvent";
import type { Resources, ResourceDelta } from "../../core/models/Resources";
import type { Building, BuildingDefinition } from "../../core/models/Building";
import type { Technology, TechResearch } from "../../core/models/Technology";
import type { Colonist, ColonistRole } from "../../core/models/Colonist";
import type { Faction, Decision, DecisionResult } from "../../core/models/Politics";
import type { RandomEventDefinition, EventChoice, ActiveEvent } from "../../core/models/GameEvent";
import type { VictoryState } from "../../core/systems/VictoryManager";
import type {
  ColonyPolicies,
  ActiveExpedition,
  ProspectingSite,
} from "../../core/models/Operation";
import type { NPC, Project, Council } from "../../core/models/NPCInfluence";

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
  };
}

class GameService {
  private gameState: GameState;
  private state: GameUIState;

  constructor() {
    this.gameState = new GameState();
    this.state = reactive(this.createInitialState());
    this.syncState();
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
      },
    };
  }

  private syncState(): void {
    this.state.currentSol = this.gameState.currentSol;

    // Resources
    this.state.resources = this.gameState.resources.getResources();
    this.state.production = this.gameState.resources.getProduction();
    this.state.consumption = this.gameState.resources.getConsumption();
    this.state.netFlow = this.gameState.resources.getNetFlow();

    // Colony
    this.state.population = this.gameState.colony.getPopulation();
    this.state.health = this.gameState.colony.getHealth();
    this.state.morale = this.gameState.colony.getMorale();
    this.state.colonists = this.gameState.colony.getColonists();

    // Buildings
    this.state.buildings = this.gameState.buildings.getActiveBuildings();
    this.state.pendingBuildings = this.gameState.buildings.getPendingBuildings();
    this.state.buildingDefinitions = this.gameState.buildings.getAllDefinitions();

    // Technology
    this.state.technologies = this.gameState.technology.getAllTechs();
    this.state.availableTechs = this.gameState.technology.getAvailableTechs();
    this.state.researchedTechs = this.gameState.technology.getResearchedTechs();
    this.state.currentResearch = this.gameState.technology.getCurrentResearch();

    // Politics
    this.state.factions = this.gameState.politics.getFactions();
    this.state.averageSupport = this.gameState.politics.getAverageSupport();
    this.state.decisions = this.gameState.politics.getAvailableDecisions();

    // Events
    this.state.activeEvent = this.gameState.events.getActiveEvent();
    this.state.eventChoices = this.gameState.events.getEventChoices();

    // Victory
    this.state.victoryState = this.gameState.victory.getState();

    // Operations
    this.state.policies = this.gameState.operations.getPolicies();
    this.state.policyCooldownRemaining = this.gameState.operations.getSolsUntilPolicyChange(
      this.gameState.currentSol,
    );
    this.state.activeExpeditions = [...this.gameState.operations.getActiveExpeditions()];
    this.state.prospectingSites = [...this.gameState.operations.getSites()];

    // NPC Influence
    const activeProject = this.gameState.npcInfluence.getActiveProject();
    this.state.npcInfluence = {
      npcs: [...this.gameState.npcInfluence.getNPCs()],
      projects: this.gameState.npcInfluence.getProjects(),
      activeProject: activeProject
        ? {
            projectId: activeProject.projectId,
            supportLevels: Object.fromEntries(activeProject.supportLevels),
            solsRemaining: activeProject.solsRemaining,
            averageSupport: this.gameState.npcInfluence.getAverageSupport(),
          }
        : null,
      councils: [...this.gameState.npcInfluence.getCouncils()],
    };
  }

  getState() {
    return readonly(this.state);
  }

  // Game actions
  tick(): GameEvent[] {
    const events = this.gameState.tick();
    this.syncState();
    this.state.recentEvents = events;
    return events;
  }

  advanceTurn(sols: number = 10): GameEvent[] {
    const events = this.gameState.advanceTurn(sols);
    this.syncState();
    this.state.recentEvents = events;
    return events;
  }

  // Building actions
  canBuild(defId: string): boolean {
    return this.gameState.buildings.canBuild(
      defId,
      this.gameState.resources,
      this.gameState.technology,
    );
  }

  startBuilding(defId: string): Building | null {
    const building = this.gameState.buildings.startBuilding(
      defId,
      this.gameState.resources,
      this.gameState.technology,
    );
    this.syncState();
    return building;
  }

  getBuildingDefinition(defId: string): BuildingDefinition | undefined {
    return this.gameState.buildings.getDefinition(defId);
  }

  // Technology actions
  canResearch(techId: string): boolean {
    return this.gameState.technology.canResearch(techId);
  }

  startResearch(techId: string): boolean {
    const result = this.gameState.technology.startResearch(techId, this.gameState.resources);
    this.syncState();
    return result;
  }

  cancelResearch(): void {
    this.gameState.technology.cancelResearch();
    this.syncState();
  }

  // Workforce actions
  startTraining(colonistId: string, targetRole: ColonistRole): boolean {
    const colonist = this.gameState.colony.getColonist(colonistId);
    if (!colonist) return false;

    const result = this.gameState.workforce.startTraining(colonist, targetRole);
    this.syncState();
    return result;
  }

  cancelTraining(colonistId: string): void {
    const colonist = this.gameState.colony.getColonist(colonistId);
    if (colonist) {
      this.gameState.workforce.cancelTraining(colonist);
      this.syncState();
    }
  }

  // Politics actions
  makeDecision(decisionId: string): DecisionResult | null {
    const decision = this.gameState.politics.getDecision(decisionId);
    if (!decision) return null;

    const result = this.gameState.politics.makeDecision(decision, this.gameState.resources);
    this.syncState();
    return result;
  }

  // Event actions
  resolveEvent(choiceId: string): GameEvent[] {
    const events = this.gameState.events.resolveEvent(
      choiceId,
      this.gameState.resources,
      this.gameState.colony,
      this.gameState.politics,
    );
    this.syncState();
    return events;
  }

  // Operations actions
  setPolicy(
    type: "workIntensity" | "resourcePriority" | "explorationStance",
    value: string,
  ): boolean {
    const result = this.gameState.operations.setPolicy(
      type,
      value as never,
      this.gameState.currentSol,
    );
    this.syncState();
    return result;
  }

  startExpedition(type: string, crewIds: string[]): boolean {
    const result = this.gameState.operations.startExpedition(
      type as never,
      crewIds,
      this.gameState.resources,
      this.gameState.colony,
      this.gameState.currentSol,
    );
    this.syncState();
    return result;
  }

  revealSite(siteId: string): boolean {
    const result = this.gameState.operations.revealSite(siteId, this.gameState.resources);
    this.syncState();
    return result;
  }

  developSite(siteId: string): boolean {
    const result = this.gameState.operations.developSite(siteId, this.gameState.resources);
    this.syncState();
    return result;
  }

  setBuildingMode(buildingId: string, mode: "conservation" | "normal" | "overdrive"): boolean {
    const result = this.gameState.buildings.setBuildingMode(
      buildingId,
      mode,
      this.gameState.resources,
    );
    this.syncState();
    return result;
  }

  // NPC Influence actions
  proposeProject(projectId: string): boolean {
    const result = this.gameState.npcInfluence.proposeProject(projectId, this.gameState.resources);
    this.syncState();
    return result;
  }

  lobbyNPC(npcId: string, supportBoost: number): boolean {
    const result = this.gameState.npcInfluence.lobbyNPC(
      npcId,
      supportBoost,
      this.gameState.resources,
    );
    this.syncState();
    return result;
  }

  createCouncil(name: string, memberIds: string[]): boolean {
    const result = this.gameState.npcInfluence.createCouncil(
      name,
      memberIds,
      this.gameState.resources,
    );
    this.syncState();
    return result;
  }

  getLobbyCost(npcId: string, supportBoost: number): number {
    return this.gameState.npcInfluence.getLobbyCost(npcId, supportBoost);
  }

  // Deposit methods
  getDeposits(): ProspectingSite[] {
    return [...this.gameState.operations.getSites()];
  }

  linkBuildingToDeposit(buildingId: string, depositId: string): boolean {
    const success = this.gameState.operations.linkBuildingToDeposit(buildingId, depositId);
    if (success) {
      const building = this.gameState.buildings.getBuilding(buildingId);
      if (building) {
        building.depositId = depositId;
      }
    }
    this.syncState();
    return success;
  }

  getDepositWarningLevel(depositId: string): "none" | "warning" | "critical" | "depleted" {
    return this.gameState.operations.getDepletionWarningLevel(depositId);
  }

  // Recycling methods
  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    return this.gameState.buildings.getRecycleValue(buildingId);
  }

  startRecycling(buildingId: string): boolean {
    const success = this.gameState.buildings.startRecycling(buildingId, this.gameState.resources);
    this.syncState();
    return success;
  }

  rushRecycling(buildingId: string): boolean {
    const success = this.gameState.buildings.rushRecycling(buildingId, this.gameState.resources);
    this.syncState();
    return success;
  }

  // Repurposing methods
  canRepurpose(buildingId: string, targetDefId: string): boolean {
    return this.gameState.buildings.canRepurpose(
      buildingId,
      targetDefId,
      this.gameState.resources,
      this.gameState.technology
    );
  }

  getRepurposeCost(targetDefId: string): ResourceDelta | undefined {
    return this.gameState.buildings.getRepurposeCost(targetDefId);
  }

  startRepurposing(buildingId: string, targetDefId: string): boolean {
    const success = this.gameState.buildings.startRepurposing(
      buildingId,
      targetDefId,
      this.gameState.resources,
      this.gameState.technology
    );
    this.syncState();
    return success;
  }

  // Game management
  newGame(): void {
    this.gameState = new GameState();
    this.syncState();
    this.state.recentEvents = [];
  }

  saveGame(): string {
    return JSON.stringify(this.gameState.toJSON());
  }

  loadGame(saveData: string): void {
    const data = JSON.parse(saveData);
    this.gameState = GameState.fromJSON(data);
    this.syncState();
  }
}

export const gameService = new GameService();
