import { getStartingCondition, StartingConditionId } from "./data/startingConditions";
import { INITIAL_COLONIST_RELATIONSHIP } from "./balance/WorkforceBalance";
import { BUILDINGS } from "./data/buildings";
import { RANDOM_EVENTS } from "./data/events";
import { FOUNDING_COLONISTS, FOUNDING_RELATIONSHIPS } from "./data/foundingColonists";
import { TECHNOLOGIES } from "./data/technologies";
import { BuildingId } from "./models/Building";
import type { GameEvent } from "./models/GameEvent";
import {
  ProjectEffectType,
  type ConvictionBoostParams,
  type ProductionModifierParams,
  type Project,
  type RecurringEventParams,
} from "./models/NPCInfluence";
import { AirQualityManager } from "./systems/AirQualityManager";
import { BuildingManager } from "./systems/BuildingManager";
import { ColonistMoraleManager } from "./systems/ColonistMoraleManager";
import { ColonyManager } from "./systems/ColonyManager";
import { EarthCrisisManager } from "./systems/EarthCrisisManager";
import { GridManager } from "./systems/GridManager";
import { EventManager } from "./systems/EventManager";
import { IdeologyManager } from "./systems/IdeologyManager";
import { OperationsManager } from "./systems/OperationsManager";
import { RecurringEventScheduler } from "./systems/RecurringEventScheduler";
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
  ideology: IdeologyManager;
  earthCrisis: EarthCrisisManager;
  grid: GridManager;
  scheduler: RecurringEventScheduler;

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
    this.buildings.setColonistQueries(this.colony);
    this.buildings.setTechnologyTree(this.technology);
    this.workforce = new WorkforceManager();
    this.buildings.setWorkforceQueries(this.workforce);
    this.colonistMorale = new ColonistMoraleManager();
    this.events = new EventManager(RANDOM_EVENTS);
    this.victory = new VictoryManager();
    this.operations = new OperationsManager();
    this.airQuality = new AirQualityManager();
    this.ideology = new IdeologyManager();
    this.earthCrisis = new EarthCrisisManager();
    this.grid = new GridManager();
    this.grid.generateDeposits(Date.now()); // Use timestamp as seed for variety
    this.scheduler = new RecurringEventScheduler();
    this.buildings.setGridManager(this.grid);
    this.buildings.setGridQueries(this.grid);
    this.buildings.setProjectQueries(this.ideology);
    this.buildings.setVictoryManager(this.victory);

    // Initialize tick runner
    this.tickRunner = createStandardTickRunner();

    // Initialize founding colonists with preset ideologies
    this.initializeFoundingColonists();

    // Create initial relationships between starting colonists (they trained together)
    this.initializeColonistRelationships();

    // Create pre-built buildings
    this.createPreBuiltBuildings(condition.preBuiltBuildings);

    // Place starting buildings on the grid
    this.placeStartingBuildingsOnGrid();

    // Initialize transit clusters for starting buildings
    this.buildings.triggerClusterUpdate();

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

  /**
   * Process the onCompletionEffects of a project when it passes.
   * This handles scheduling recurring events, production modifiers, and conviction boosts.
   */
  processProjectEffects(project: Project): void {
    if (!project.onCompletionEffects) return;

    for (const effect of project.onCompletionEffects) {
      switch (effect.type) {
        case ProjectEffectType.RECURRING_EVENT: {
          const params = effect.params as RecurringEventParams;
          this.scheduler.register(project.id, params, this.currentSol);
          break;
        }
        case ProjectEffectType.PRODUCTION_MODIFIER: {
          const params = effect.params as ProductionModifierParams;
          // Power is handled by the grid system, not resource production
          if (params.resource !== "power") {
            this.resources.addProductionBonus(project.id, params.resource, params.amount);
          }
          break;
        }
        case ProjectEffectType.CONVICTION_BOOST: {
          const params = effect.params as ConvictionBoostParams;
          this.ideology.boostFactionConviction(
            params.faction,
            params.amount,
            this.colony.getColonists(),
          );
          break;
        }
        case ProjectEffectType.IMMIGRATION_IDEOLOGY_BIAS: {
          // Handled elsewhere during immigration events
          break;
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

  private placeStartingBuildingsOnGrid(): void {
    const activeBuildings = this.buildings.getActiveBuildings();

    // Track positions we've used
    const usedPositions = new Set<string>();
    const posKey = (x: number, y: number) => `${x},${y}`;

    // Place solar panels at center
    const solarPanels = activeBuildings.filter((b) => b.definitionId === BuildingId.SOLAR_PANEL);
    const solarPositions = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ];
    for (let i = 0; i < solarPanels.length; i++) {
      const panel = solarPanels[i];
      if (!panel) continue;
      const pos = solarPositions[i] ?? { x: 5 + i, y: 5 };
      this.grid.placeBuilding(panel.id, pos);
      usedPositions.add(posKey(pos.x, pos.y));
      const def = this.buildings.getDefinition(panel.definitionId);
      if (def?.powerProduction) {
        this.grid.registerPowerSource(panel.id, def.powerProduction);
      }
    }

    // Place habitat adjacent (5,6)
    const habitat = activeBuildings.find((b) => b.definitionId === BuildingId.HABITAT);
    if (habitat) {
      this.grid.placeBuilding(habitat.id, { x: 5, y: 6 });
      usedPositions.add(posKey(5, 6));
      const def = this.buildings.getDefinition(habitat.definitionId);
      if (def?.powerConsumption) {
        this.grid.setBuildingPowerConsumption(habitat.id, def.powerConsumption);
      }
    }

    // Place farm (4,5)
    const farm = activeBuildings.find((b) => b.definitionId === BuildingId.BASIC_FARM);
    if (farm) {
      this.grid.placeBuilding(farm.id, { x: 4, y: 5 });
      usedPositions.add(posKey(4, 5));
      const def = this.buildings.getDefinition(farm.definitionId);
      if (def?.powerConsumption) {
        this.grid.setBuildingPowerConsumption(farm.id, def.powerConsumption);
      }
    }

    // Place oxygen generator (6,6)
    const oxygenGen = activeBuildings.find((b) => b.definitionId === BuildingId.OXYGEN_GENERATOR);
    if (oxygenGen) {
      this.grid.placeBuilding(oxygenGen.id, { x: 6, y: 6 });
      usedPositions.add(posKey(6, 6));
      const def = this.buildings.getDefinition(oxygenGen.definitionId);
      if (def?.powerConsumption) {
        this.grid.setBuildingPowerConsumption(oxygenGen.id, def.powerConsumption);
      }
    }

    // Place water extractor on nearest water deposit
    const waterExtractor = activeBuildings.find(
      (b) => b.definitionId === BuildingId.WATER_EXTRACTOR,
    );
    if (waterExtractor) {
      const deposits = this.grid.getAllDeposits();
      const waterDeposit = deposits.find((d) => d.type === "water");
      if (waterDeposit) {
        this.grid.placeBuilding(waterExtractor.id, waterDeposit.position);
        const def = this.buildings.getDefinition(waterExtractor.definitionId);
        if (def?.powerConsumption) {
          this.grid.setBuildingPowerConsumption(waterExtractor.id, def.powerConsumption);
        }
      }
    }

    // Update power connections (only active buildings can provide power)
    const activeBuildingIds = new Set(this.buildings.getActiveBuildings().map((b) => b.id));
    this.grid.updatePowerConnections(false, activeBuildingIds);
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
        earthCrisis: this.earthCrisis,
        grid: this.grid,
        scheduler: this.scheduler,
      },
      { autoAssignNewColonists: this.autoAssignNewColonists },
    );

    // Execute all phases through the runner
    const events = this.tickRunner.tick(ctx);

    // Process scheduled recurring events
    const scheduledEvents = this.scheduler.tick(this.currentSol);
    events.push(...scheduledEvents);

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
      ideology: this.ideology.toJSON(),
      earthCrisis: this.earthCrisis.toJSON(),
      grid: this.grid.toJSON(),
      scheduler: this.scheduler.toJSON(),
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
    state.buildings.setColonistQueries(state.colony);
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

    if (data.ideology) {
      state.ideology = IdeologyManager.fromJSON(data.ideology);
      state.buildings.setProjectQueries(state.ideology);
    }

    if (data.earthCrisis) {
      state.earthCrisis = EarthCrisisManager.fromJSON(data.earthCrisis);
    }

    if (data.grid) {
      state.grid.fromJSON(data.grid);
    }

    if (data.scheduler) {
      state.scheduler = RecurringEventScheduler.fromJSON(data.scheduler);
    }

    // Re-establish grid manager reference and update clusters after grid is restored
    state.buildings.setGridManager(state.grid);
    state.buildings.setGridQueries(state.grid);
    state.buildings.setWorkforceQueries(state.workforce);
    state.buildings.triggerClusterUpdate();

    state.buildings.setVictoryManager(state.victory);

    if (data.autoAssignNewColonists !== undefined) {
      state.autoAssignNewColonists = data.autoAssignNewColonists;
    }

    return state;
  }
}
