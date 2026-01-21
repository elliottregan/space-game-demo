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
