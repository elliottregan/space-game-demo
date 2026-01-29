import { getStartingCondition, StartingConditionId } from "./data/startingConditions";
import { BUILDINGS } from "./data/buildings";
import { RANDOM_EVENTS } from "./data/events";
import { INITIAL_RELATIONSHIPS, NPCS, PROJECTS } from "./data/npcs";
import { TECHNOLOGIES } from "./data/technologies";
import { BuildingId } from "./models/Building";
import type { GameEvent } from "./models/GameEvent";
import { BuildingManager } from "./systems/BuildingManager";
import { ColonyManager } from "./systems/ColonyManager";
import { EventManager } from "./systems/EventManager";
import { NPCInfluenceManager } from "./systems/NPCInfluenceManager";
import { OperationsManager } from "./systems/OperationsManager";
import { ResourceManager } from "./systems/ResourceManager";
import { TechnologyTree } from "./systems/TechnologyTree";
import { VictoryManager } from "./systems/VictoryManager";
import { WorkforceManager } from "./systems/WorkforceManager";
import { TickRunner, createTickContext } from "./tick";
import { createStandardTickRunner } from "./tick/phases";

export class GameState {
  currentSol: number = 0;

  resources: ResourceManager;
  technology: TechnologyTree;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  events: EventManager;
  victory: VictoryManager;
  operations: OperationsManager;
  npcInfluence: NPCInfluenceManager;

  private tickRunner: TickRunner;
  private eventLog: GameEvent[] = [];
  private autoAssignNewColonists: boolean = true;

  getAutoAssignNewColonists(): boolean {
    return this.autoAssignNewColonists;
  }

  setAutoAssignNewColonists(value: boolean): void {
    this.autoAssignNewColonists = value;
  }

  constructor(startingConditionId?: string) {
    const condition = startingConditionId
      ? getStartingCondition(startingConditionId)
      : getStartingCondition(StartingConditionId.DEFAULT);

    if (!condition) {
      throw new Error(`Unknown starting condition: ${startingConditionId}`);
    }

    this.resources = new ResourceManager(condition.resources);
    this.technology = new TechnologyTree(TECHNOLOGIES);
    this.buildings = new BuildingManager(BUILDINGS);
    this.colony = new ColonyManager(condition.population);
    this.buildings.setColonyManager(this.colony);
    this.buildings.setTechnologyTree(this.technology);
    this.workforce = new WorkforceManager();
    this.buildings.setWorkforceManager(this.workforce);
    this.events = new EventManager(RANDOM_EVENTS);
    this.victory = new VictoryManager();
    this.operations = new OperationsManager();
    this.npcInfluence = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

    // Initialize tick runner
    this.tickRunner = createStandardTickRunner();

    // Create pre-built buildings
    this.createPreBuiltBuildings(condition.preBuiltBuildings);

    // Initialize colonist consumption
    this.colony.tick(this.resources, this.buildings, { morale: 0, health: 0 });
  }

  private createPreBuiltBuildings(buildingIds: BuildingId[]): void {
    for (const defId of buildingIds) {
      const def = this.buildings.getDefinition(defId);
      if (!def) continue;

      // Create building directly as active (skip construction)
      const _building = this.buildings.addBuilding({
        definitionId: defId,
        status: "active",
        constructionProgress: def.constructionTime,
        assignedWorkers: [],
        mode: "normal",
        broken: false,
        repairProgress: 0,
        condition: 100,
        age: 0,
        lastMaintenance: 0,
      });

      // Register production/consumption
      if (def.production) {
        this.resources.addProduction(def.production);
      }
      if (def.consumption) {
        this.resources.addConsumption(def.consumption);
      }
    }
  }

  tick(): GameEvent[] {
    if (this.victory.isGameOver()) {
      return [];
    }

    this.currentSol++;

    // Create context for phase execution
    const ctx = createTickContext(
      this.currentSol,
      {
        resources: this.resources,
        buildings: this.buildings,
        colony: this.colony,
        workforce: this.workforce,
        technology: this.technology,
        operations: this.operations,
        npcInfluence: this.npcInfluence,
        events: this.events,
        victory: this.victory,
      },
      { autoAssignNewColonists: this.autoAssignNewColonists },
    );

    // Execute all phases through the runner
    const events = this.tickRunner.tick(ctx);

    // Log events
    this.eventLog.push(...events);

    return events;
  }

  /**
   * Get the list of tick phases in execution order.
   * Useful for debugging and visibility into the tick system.
   */
  getTickPhases(): Array<{ id: string; name: string }> {
    return this.tickRunner.getExecutionOrder();
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

  getConstructionSpeedBonus(): number {
    return this.buildings.getConstructionSpeedBonus();
  }

  toJSON() {
    return {
      currentSol: this.currentSol,
      resources: this.resources.toJSON(),
      technology: this.technology.toJSON(),
      buildings: this.buildings.toJSON(),
      colony: this.colony.toJSON(),
      events: this.events.toJSON(),
      victory: this.victory.toJSON(),
      operations: this.operations.toJSON(),
      npcInfluence: this.npcInfluence.toJSON(),
      autoAssignNewColonists: this.autoAssignNewColonists,
    };
  }

  static fromJSON(data: ReturnType<GameState["toJSON"]>): GameState {
    const state = new GameState();

    state.currentSol = data.currentSol;
    state.resources = ResourceManager.fromJSON(data.resources);
    state.technology = TechnologyTree.fromJSON(data.technology, TECHNOLOGIES);
    state.buildings = BuildingManager.fromJSON(data.buildings, BUILDINGS);
    state.colony = ColonyManager.fromJSON(data.colony);
    state.buildings.setColonyManager(state.colony);
    state.buildings.setTechnologyTree(state.technology);
    state.events = EventManager.fromJSON(data.events, RANDOM_EVENTS);
    state.victory = VictoryManager.fromJSON(data.victory);

    if (data.operations) {
      state.operations = OperationsManager.fromJSON(data.operations);
    }

    if (data.npcInfluence) {
      state.npcInfluence = NPCInfluenceManager.fromJSON(
        data.npcInfluence,
        NPCS,
        INITIAL_RELATIONSHIPS,
        PROJECTS,
      );
    }

    if (data.autoAssignNewColonists !== undefined) {
      state.autoAssignNewColonists = data.autoAssignNewColonists;
    }

    return state;
  }
}
