import { STARTING_POPULATION, STARTING_RESOURCES } from "./balance/EconomyBaseline";
import { LABOR_POOL_BONUS_CAP, LABOR_POOL_BONUS_PER_COLONIST } from "./balance/WorkforceBalance";
import { BUILDINGS } from "./data/buildings";
import { RANDOM_EVENTS } from "./data/events";
import { INITIAL_RELATIONSHIPS, NPCS, PROJECTS } from "./data/npcs";
import { TECHNOLOGIES } from "./data/technologies";
import type { GameEvent } from "./models/GameEvent";
import {
  canExtract,
  getBaseProductionForDeposit,
  getDepletionEvents,
  type WarningLevel,
} from "./utils/depositExtraction";
import { BuildingManager } from "./systems/BuildingManager";
import { ColonyManager } from "./systems/ColonyManager";
import { EventManager } from "./systems/EventManager";
import { NPCInfluenceManager } from "./systems/NPCInfluenceManager";
import { OperationsManager } from "./systems/OperationsManager";
import { ResourceManager } from "./systems/ResourceManager";
import { TechnologyTree } from "./systems/TechnologyTree";
import { VictoryManager } from "./systems/VictoryManager";
import { WorkforceManager } from "./systems/WorkforceManager";

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

  private eventLog: GameEvent[] = [];

  constructor() {
    this.resources = new ResourceManager(STARTING_RESOURCES);
    this.technology = new TechnologyTree(TECHNOLOGIES);
    this.buildings = new BuildingManager(BUILDINGS);
    this.colony = new ColonyManager(STARTING_POPULATION);
    this.buildings.setColonyManager(this.colony);
    this.workforce = new WorkforceManager();
    this.events = new EventManager(RANDOM_EVENTS);
    this.victory = new VictoryManager();
    this.operations = new OperationsManager();
    this.npcInfluence = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

    // Initialize colonist consumption
    this.colony.tick(this.resources, this.buildings, { morale: 0, health: 0 });
  }

  tick(): GameEvent[] {
    if (this.victory.isGameOver()) {
      return [];
    }

    this.currentSol++;
    const events: GameEvent[] = [];

    // Update labor pool bonus before other systems
    this.updateLaborPoolBonus();

    // 1. Resources tick (production/consumption)
    events.push(...this.resources.tick());

    // 2. Buildings tick (construction progress, maintenance decay)
    events.push(...this.buildings.tick(this.resources, this.currentSol));

    // 3. Workforce tick (training, experience)
    events.push(...this.workforce.tick(this.colony));

    // 4. Colony tick (population, health, morale)
    const policyEffects = {
      morale: this.operations.getMoraleEffect(),
      health: this.operations.getHealthEffect(),
    };
    events.push(...this.colony.tick(this.resources, this.buildings, policyEffects));

    // Assign housing after colony tick
    this.colony.assignHousing(this.buildings);

    // 5. Technology tick (research progress)
    events.push(...this.technology.tick(this.resources));

    // 6. NPC Influence tick
    events.push(...this.npcInfluence.tick(this.currentSol));

    // 7. Operations tick
    events.push(...this.operations.tick(this.currentSol, this.resources, this.colony));

    // 8. Deposit extraction tick
    events.push(...this.processDepositExtraction());

    // 9. Random events tick
    events.push(...this.events.tick(this.currentSol));

    // 10. Victory check
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

  getConstructionSpeedBonus(): number {
    return this.buildings.getConstructionSpeedBonus();
  }

  private updateLaborPoolBonus(): void {
    const colonists = this.colony.getColonists();
    const assignedIds = new Set<string>();

    for (const building of this.buildings.getBuildings()) {
      for (const id of building.assignedWorkers) {
        assignedIds.add(id);
      }
    }

    const unassignedCount = colonists.filter((c) => !assignedIds.has(c.id)).length;
    const bonus = Math.min(unassignedCount * LABOR_POOL_BONUS_PER_COLONIST, LABOR_POOL_BONUS_CAP);

    this.buildings.setConstructionSpeedBonus(bonus);
  }

  /**
   * Process extraction from deposits for all active mining buildings.
   * Handles extraction, warning events, and building state transitions.
   */
  private processDepositExtraction(): GameEvent[] {
    const events: GameEvent[] = [];

    for (const building of this.buildings.getActiveBuildings()) {
      const def = this.buildings.getDefinition(building.definitionId);
      if (!canExtract(building, def) || !def) continue;

      const site = this.operations.getSites().find((s) => s.id === building.depositId);
      if (!site) continue;

      const baseProduction = getBaseProductionForDeposit(def, site.resourceType);
      if (baseProduction === 0) continue;

      const warningBefore = this.operations.getDepletionWarningLevel(site.id) as WarningLevel;
      this.operations.processExtraction(building.id, baseProduction);
      const warningAfter = this.operations.getDepletionWarningLevel(site.id) as WarningLevel;

      events.push(...getDepletionEvents(warningBefore, warningAfter, site, building, def.name));

      if (warningAfter === "depleted") {
        this.transitionBuildingToIdle(building.id);
      }
    }

    return events;
  }

  /**
   * Transition a building to idle status and remove its resource flow.
   */
  private transitionBuildingToIdle(buildingId: string): void {
    const building = this.buildings.getBuilding(buildingId);
    if (!building) return;

    building.status = "idle";

    const effectiveProd = this.buildings.getEffectiveProduction(buildingId);
    const effectiveCons = this.buildings.getEffectiveConsumption(buildingId);

    if (Object.keys(effectiveProd).length > 0) {
      this.resources.removeProduction(effectiveProd);
    }
    if (Object.keys(effectiveCons).length > 0) {
      this.resources.removeConsumption(effectiveCons);
    }
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

    return state;
  }
}
