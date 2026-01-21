import type { GameEvent } from "./models/GameEvent";
import { ResourceManager } from "./systems/ResourceManager";
import { TechnologyTree } from "./systems/TechnologyTree";
import { BuildingManager } from "./systems/BuildingManager";
import { ColonyManager } from "./systems/ColonyManager";
import { WorkforceManager } from "./systems/WorkforceManager";
import { PoliticsEngine } from "./systems/PoliticsEngine";
import { EventManager } from "./systems/EventManager";
import { VictoryManager } from "./systems/VictoryManager";
import { OperationsManager } from "./systems/OperationsManager";

import { STARTING_RESOURCES, STARTING_POPULATION } from "./balance/EconomyBaseline";
import { TECHNOLOGIES } from "./data/technologies";
import { BUILDINGS } from "./data/buildings";
import { FACTIONS, DECISIONS } from "./data/factions";
import { RANDOM_EVENTS } from "./data/events";

export class GameState {
  currentSol: number = 0;

  resources: ResourceManager;
  technology: TechnologyTree;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  politics: PoliticsEngine;
  events: EventManager;
  victory: VictoryManager;
  operations: OperationsManager;

  private eventLog: GameEvent[] = [];

  constructor() {
    this.resources = new ResourceManager(STARTING_RESOURCES);
    this.technology = new TechnologyTree(TECHNOLOGIES);
    this.buildings = new BuildingManager(BUILDINGS);
    this.colony = new ColonyManager(STARTING_POPULATION);
    this.workforce = new WorkforceManager();
    this.politics = new PoliticsEngine(FACTIONS, DECISIONS);
    this.events = new EventManager(RANDOM_EVENTS);
    this.victory = new VictoryManager();
    this.operations = new OperationsManager();

    // Initialize colonist consumption
    this.colony.tick(this.resources);
  }

  tick(): GameEvent[] {
    if (this.victory.isGameOver()) {
      return [];
    }

    this.currentSol++;
    const events: GameEvent[] = [];

    // 1. Resources tick (production/consumption)
    events.push(...this.resources.tick());

    // 2. Buildings tick (construction progress)
    events.push(...this.buildings.tick(this.resources));

    // 3. Workforce tick (training, experience)
    events.push(...this.workforce.tick(this.colony));

    // 4. Colony tick (population, health, morale)
    events.push(...this.colony.tick(this.resources));

    // 5. Technology tick (research progress)
    events.push(...this.technology.tick());

    // 6. Politics tick (support decay)
    events.push(...this.politics.tick());

    // 6.5. Operations tick
    events.push(...this.operations.tick(this.currentSol, this.resources, this.colony));

    // 7. Random events tick
    events.push(...this.events.tick(this.currentSol));

    // 8. Victory check
    events.push(...this.victory.tick(this.technology, this.colony, this.resources));

    // Log events
    this.eventLog.push(...events);

    return events;
  }

  advanceTurn(sols: number = 10): GameEvent[] {
    const allEvents: GameEvent[] = [];

    for (let i = 0; i < sols; i++) {
      const events = this.tick();
      allEvents.push(...events);

      // Stop if game is over or there's an active event requiring player input
      if (this.victory.isGameOver() || this.events.hasActiveEvent()) {
        break;
      }
    }

    return allEvents;
  }

  getEventLog(): GameEvent[] {
    return [...this.eventLog];
  }

  clearEventLog(): void {
    this.eventLog = [];
  }

  toJSON() {
    return {
      currentSol: this.currentSol,
      resources: this.resources.toJSON(),
      technology: this.technology.toJSON(),
      buildings: this.buildings.toJSON(),
      colony: this.colony.toJSON(),
      politics: this.politics.toJSON(),
      events: this.events.toJSON(),
      victory: this.victory.toJSON(),
      operations: this.operations.toJSON(),
    };
  }

  static fromJSON(data: ReturnType<GameState["toJSON"]>): GameState {
    const state = new GameState();

    state.currentSol = data.currentSol;
    state.resources = ResourceManager.fromJSON(data.resources);
    state.technology = TechnologyTree.fromJSON(data.technology, TECHNOLOGIES);
    state.buildings = BuildingManager.fromJSON(data.buildings, BUILDINGS);
    state.colony = ColonyManager.fromJSON(data.colony);
    state.politics = PoliticsEngine.fromJSON(data.politics, DECISIONS);
    state.events = EventManager.fromJSON(data.events, RANDOM_EVENTS);
    state.victory = VictoryManager.fromJSON(data.victory);

    if (data.operations) {
      state.operations = OperationsManager.fromJSON(data.operations);
    }

    return state;
  }
}
