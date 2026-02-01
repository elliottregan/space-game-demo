import { getStartingCondition, StartingConditionId } from "./data/startingConditions";
import { INITIAL_COLONIST_RELATIONSHIP } from "./balance/WorkforceBalance";
import { BUILDINGS } from "./data/buildings";
import { RANDOM_EVENTS } from "./data/events";
import { FOUNDING_COLONISTS, FOUNDING_RELATIONSHIPS } from "./data/foundingColonists";
import { TECHNOLOGIES } from "./data/technologies";
import { BuildingId } from "./models/Building";
import type { GameEvent } from "./models/GameEvent";
import { AirQualityManager } from "./systems/AirQualityManager";
import { BuildingManager } from "./systems/BuildingManager";
import { ColonistMoraleManager } from "./systems/ColonistMoraleManager";
import { ColonyManager } from "./systems/ColonyManager";
import { EventManager } from "./systems/EventManager";
import { IdeologyManager } from "./systems/IdeologyManager";
import { OperationsManager } from "./systems/OperationsManager";
import { PowerGridManager } from "./systems/PowerGridManager";
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
  colonistMorale: ColonistMoraleManager;
  events: EventManager;
  victory: VictoryManager;
  operations: OperationsManager;
  airQuality: AirQualityManager;
  powerGrid: PowerGridManager;
  ideology: IdeologyManager;

  private tickRunner: TickRunner;
  private eventLog: GameEvent[] = [];
  private autoAssignNewColonists: boolean = true;

  getAutoAssignNewColonists(): boolean {
    return this.autoAssignNewColonists;
  }

  setAutoAssignNewColonists(value: boolean): void {
    this.autoAssignNewColonists = value;
  }

  getColonistMoraleManager(): ColonistMoraleManager {
    return this.colonistMorale;
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
    this.colonistMorale = new ColonistMoraleManager();
    this.events = new EventManager(RANDOM_EVENTS);
    this.victory = new VictoryManager();
    this.operations = new OperationsManager();
    this.airQuality = new AirQualityManager();
    this.powerGrid = new PowerGridManager();
    this.ideology = new IdeologyManager();
    this.buildings.setIdeologyManager(this.ideology);

    // Initialize tick runner
    this.tickRunner = createStandardTickRunner();

    // Initialize founding colonists with preset ideologies
    this.initializeFoundingColonists();

    // Create initial relationships between starting colonists (they trained together)
    this.initializeColonistRelationships();

    // Create pre-built buildings
    this.createPreBuiltBuildings(condition.preBuiltBuildings);

    // Initialize colonist consumption (without triggering population growth)
    this.colony.updateConsumption(this.resources);
  }

  /**
   * Initialize founding colonists with preset ideologies.
   * Applies preset ideology to existing colonists (matching by index).
   * Creates relationships between founding colonists based on FOUNDING_RELATIONSHIPS.
   */
  private initializeFoundingColonists(): void {
    const colonists = this.colony.getColonists();

    // Apply founding colonist data to existing colonists
    for (let i = 0; i < Math.min(colonists.length, FOUNDING_COLONISTS.length); i++) {
      const colonist = colonists[i];
      const foundingData = FOUNDING_COLONISTS[i];

      if (colonist && foundingData) {
        // Update colonist with founding data
        colonist.name = foundingData.name;
        colonist.ideology = { ...foundingData.ideology };
        if (foundingData.role) {
          colonist.role = foundingData.role;
        }
      }
    }

    // Create relationships between founding colonists
    for (const [key, strength] of Object.entries(FOUNDING_RELATIONSHIPS)) {
      const [id1, id2] = key.split(":");
      if (!id1 || !id2) continue;

      // Map founding IDs to actual colonist IDs
      const foundingIndex1 = FOUNDING_COLONISTS.findIndex((f) => f.id === id1);
      const foundingIndex2 = FOUNDING_COLONISTS.findIndex((f) => f.id === id2);

      if (foundingIndex1 >= 0 && foundingIndex2 >= 0) {
        const colonist1 = colonists[foundingIndex1];
        const colonist2 = colonists[foundingIndex2];

        if (colonist1 && colonist2) {
          this.workforce.createInitialRelationship(colonist1.id, colonist2.id, strength);
        }
      }
    }
  }

  /**
   * Create initial relationships between starting colonists.
   * These colonists trained together before the mission, so they have existing bonds.
   * Creates a sparse network where each colonist knows ~3-4 others.
   */
  private initializeColonistRelationships(): void {
    const colonists = this.colony.getColonists();
    if (colonists.length < 2) return;

    // Create a sparse initial network:
    // - Each colonist gets connected to 2-4 random others
    // - This creates enough edges for some triangles to form
    const targetConnectionsPerColonist = Math.min(3, Math.floor(colonists.length / 3));

    for (const colonist of colonists) {
      const currentConnections = this.workforce.getColonistConnections(colonist.id);
      const neededConnections = targetConnectionsPerColonist - currentConnections.length;

      if (neededConnections <= 0) continue;

      // Find colonists we're not yet connected to
      const candidates = colonists.filter(
        (c) => c.id !== colonist.id && !currentConnections.some((conn) => conn.colonistId === c.id),
      );

      // Connect to random candidates
      for (let i = 0; i < neededConnections && candidates.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const target = candidates.splice(randomIndex, 1)[0];
        if (target) {
          this.workforce.createInitialRelationship(
            colonist.id,
            target.id,
            INITIAL_COLONIST_RELATIONSHIP,
          );
        }
      }
    }
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
        colonistMorale: this.colonistMorale,
        technology: this.technology,
        operations: this.operations,
        events: this.events,
        victory: this.victory,
        ideology: this.ideology,
        airQualityManager: this.airQuality,
        powerGridManager: this.powerGrid,
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
      colonistMorale: this.colonistMorale.toJSON(),
      events: this.events.toJSON(),
      victory: this.victory.toJSON(),
      operations: this.operations.toJSON(),
      airQuality: this.airQuality.toJSON(),
      powerGrid: this.powerGrid.toJSON(),
      ideology: this.ideology.toJSON(),
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

    if (data.colonistMorale) {
      state.colonistMorale = ColonistMoraleManager.fromJSON(data.colonistMorale);
    }

    if (data.operations) {
      state.operations = OperationsManager.fromJSON(data.operations);
    }

    if (data.airQuality) {
      state.airQuality = AirQualityManager.fromJSON(data.airQuality);
    }

    if (data.powerGrid) {
      state.powerGrid = PowerGridManager.fromJSON(data.powerGrid);
    }

    if (data.ideology) {
      state.ideology = IdeologyManager.fromJSON(data.ideology);
      state.buildings.setIdeologyManager(state.ideology);
    }

    if (data.autoAssignNewColonists !== undefined) {
      state.autoAssignNewColonists = data.autoAssignNewColonists;
    }

    return state;
  }
}
