import type { GameEvent } from "./models/GameEvent";
import { ResourceManager } from "./systems/ResourceManager";
import { TechnologyTree } from "./systems/TechnologyTree";
import { BuildingManager } from "./systems/BuildingManager";
import { ColonyManager } from "./systems/ColonyManager";
import { WorkforceManager } from "./systems/WorkforceManager";
import { EventManager } from "./systems/EventManager";
import { VictoryManager } from "./systems/VictoryManager";
import { OperationsManager } from "./systems/OperationsManager";
import { NPCInfluenceManager } from "./systems/NPCInfluenceManager";

import { STARTING_RESOURCES, STARTING_POPULATION } from "./balance/EconomyBaseline";
import { NPCS, INITIAL_RELATIONSHIPS, PROJECTS } from "./data/npcs";
import { TECHNOLOGIES } from "./data/technologies";
import { BUILDINGS } from "./data/buildings";
import { RANDOM_EVENTS } from "./data/events";

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
    events.push(...this.technology.tick());

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

  /**
   * Process extraction from deposits for all active mining buildings.
   * This handles:
   * - Extracting resources based on deposit quality
   * - Firing warning events at 25%/10% remaining
   * - Transitioning buildings to idle when deposits deplete
   */
  private processDepositExtraction(): GameEvent[] {
    const events: GameEvent[] = [];

    for (const building of this.buildings.getActiveBuildings()) {
      const def = this.buildings.getDefinition(building.definitionId);
      if (!def?.requiresDeposit || !building.depositId) continue;
      if (building.broken) continue;

      const site = this.operations.getSites().find((s) => s.id === building.depositId);
      if (!site) continue;

      // Check warning level before extraction
      const warningBefore = this.operations.getDepletionWarningLevel(site.id);

      // Get base production for the resource type this building produces
      const baseProduction =
        def.production?.[site.resourceType as keyof typeof def.production] ?? 0;
      if (baseProduction === 0) continue;

      // Process extraction
      this.operations.processExtraction(building.id, baseProduction);

      // Check warning level after extraction
      const warningAfter = this.operations.getDepletionWarningLevel(site.id);

      // Fire events for threshold crossings
      if (warningBefore === "none" && warningAfter === "warning") {
        events.push({
          type: "DEPOSIT_WARNING",
          depositId: site.id,
          buildingId: building.id,
          severity: "warning",
          message: `${def.name}'s deposit is running low (~${site.estimatedReserves.max} ${site.resourceType} remaining)`,
        });
      } else if (warningBefore !== "critical" && warningAfter === "critical") {
        events.push({
          type: "DEPOSIT_CRITICAL",
          depositId: site.id,
          buildingId: building.id,
          severity: "critical",
          message: `${def.name}'s deposit is nearly exhausted (~${site.estimatedReserves.max} ${site.resourceType} remaining)`,
        });
      } else if (warningAfter === "depleted") {
        // Deposit is fully depleted - transition building to idle
        building.status = "idle";

        // Remove production/consumption from resource flow
        const effectiveProd = this.buildings.getEffectiveProduction(building.id);
        const effectiveCons = this.buildings.getEffectiveConsumption(building.id);
        if (Object.keys(effectiveProd).length > 0) {
          this.resources.removeProduction(effectiveProd);
        }
        if (Object.keys(effectiveCons).length > 0) {
          this.resources.removeConsumption(effectiveCons);
        }

        events.push({
          type: "DEPOSIT_DEPLETED",
          depositId: site.id,
          buildingId: building.id,
          buildingName: def.name,
          severity: "critical",
          message: `${def.name}'s deposit is exhausted. Building is now idle.`,
        });
      }
    }

    return events;
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
