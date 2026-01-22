// src/core/facade/index.ts
// Public exports for the game façade

export { GameFacade, type StateChangeListener } from "./GameFacade";
export type { GameQueries } from "./queries";
export type { GameCommands } from "./commands";

// Export all types
export {
  // Result helpers
  ok,
  err,
  // Result types
  type Result,
  type GameError,
  type InsufficientResourcesError,
  type PrerequisiteNotMetError,
  type InvalidTargetError,
  type AlreadyInProgressError,
  type NotFoundError,
  type CooldownActiveError,
  type InvalidStateError,
  type CapacityExceededError,
  // Snapshot types
  type ResourceSnapshot,
  type BuildingSnapshot,
  type TechnologySnapshot,
  type ColonySnapshot,
  type PoliticsSnapshot,
  type OperationsSnapshot,
  type NPCInfluenceSnapshot,
  type ActiveEventSnapshot,
  // Capability check
  type CanDoResult,
  // Command parameter types
  type PolicyType,
  type PolicyValue,
  type PolicyUpdate,
  // Re-exported model types
  type Resources,
  type ResourceDelta,
  type Building,
  type BuildingDefinition,
  type BuildingStatus,
  type BuildingMode,
  type Technology,
  type TechResearch,
  type Colonist,
  type ColonistRole,
  type Faction,
  type Decision,
  type DecisionResult,
  type GameEvent,
  type RandomEventDefinition,
  type EventChoice,
  type ActiveEvent,
  type VictoryState,
  type ColonyPolicies,
  type ActiveExpedition,
  type ProspectingSite,
  type ExpeditionType,
  type WorkIntensity,
  type ResourcePriority,
  type ExplorationStance,
  type NPC,
  type Project,
  type Council,
} from "./types";
