import type { AirQualityManager } from "../systems/AirQualityManager";
import type { BuildingManager } from "../systems/BuildingManager";
import type { ColonistMoraleManager } from "../systems/ColonistMoraleManager";
import type { ColonyManager } from "../systems/ColonyManager";
import type { EarthCrisisManager } from "../systems/EarthCrisisManager";
import type { EventManager } from "../systems/EventManager";
import type { GridManager } from "../systems/GridManager";
import type { IdeologyManager } from "../systems/IdeologyManager";
import type { OperationsManager } from "../systems/OperationsManager";
import type { RecurringEventScheduler } from "../systems/RecurringEventScheduler";
import type { ResourceManager } from "../systems/ResourceManager";
import type { TechnologyTree } from "../systems/TechnologyTree";
import type { VictoryManager } from "../systems/VictoryManager";
import type { WorkforceManager } from "../systems/WorkforceManager";

/**
 * Social cohesion data computed during the tick.
 */
export interface SocialCohesionData {
  averageClusteringCoefficient: number;
  averageConnectionCount: number;
  isolatedCount: number;
  isolatedColonists: string[];
}

/**
 * Derived values computed by early phases, read by later phases.
 */
export interface DerivedValues {
  socialCohesion: SocialCohesionData | null;
  laborPoolBonus: number;
  airQuality: number;
  airQualityEffects: { health: number; morale: number; efficiency: number } | null;
}

/**
 * Settings that affect tick behavior.
 */
export interface TickSettings {
  autoAssignNewColonists: boolean;
}

/**
 * Context passed to each phase during tick execution.
 * Provides access to all game state and derived values.
 */
export interface TickContext {
  /** Current game sol */
  currentSol: number;

  /** Core managers */
  resources: ResourceManager;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  colonistMorale: ColonistMoraleManager;
  technology: TechnologyTree;
  operations: OperationsManager;
  events: EventManager;
  victory: VictoryManager;
  ideology: IdeologyManager;
  airQualityManager: AirQualityManager;
  earthCrisis: EarthCrisisManager;
  grid: GridManager;
  scheduler: RecurringEventScheduler;

  /** Derived values computed during tick */
  derived: DerivedValues;

  /** Settings */
  settings: TickSettings;
}

/**
 * Create a fresh TickContext for a tick.
 * Derived values start as null/0, computed by phases.
 */
export function createTickContext(
  currentSol: number,
  managers: {
    resources: ResourceManager;
    buildings: BuildingManager;
    colony: ColonyManager;
    workforce: WorkforceManager;
    colonistMorale: ColonistMoraleManager;
    technology: TechnologyTree;
    operations: OperationsManager;
    events: EventManager;
    victory: VictoryManager;
    ideology: IdeologyManager;
    airQualityManager: AirQualityManager;
    earthCrisis: EarthCrisisManager;
    grid: GridManager;
    scheduler: RecurringEventScheduler;
  },
  settings: TickSettings,
): TickContext {
  return {
    currentSol,
    ...managers,
    derived: {
      socialCohesion: null,
      laborPoolBonus: 0,
      airQuality: 1,
      airQualityEffects: null,
    },
    settings,
  };
}
