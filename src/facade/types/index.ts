// src/facade/types/index.ts
// Re-export all facade types

// Common types (includes ok/err helper functions)
export {
  ok,
  err,
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
  type CanDoResult,
  type StateChangeListener,
} from "./common";

// Common interfaces for facade patterns
export type {
  Queryable,
  EntityLookup,
  ActionChecker,
  CommandExecutor,
  CheckedAction,
  QueryOnlyFacade,
  CommandFacade,
} from "./interfaces";

// Resource types
export type { ResourceSnapshot, Resources, ResourceDelta } from "./resources";

// Building types
export type {
  BuildingSnapshot,
  Building,
  BuildingDefinition,
  BuildingStatus,
  BuildingMode,
} from "./buildings";

// Building action discriminated union for ActionChecker
export type BuildingAction =
  | { action: "build"; defId: string }
  | { action: "recycle"; buildingId: string }
  | { action: "repurpose"; buildingId: string; targetDefId: string };

// Technology types
export type { TechnologySnapshot, Technology, TechResearch } from "./technology";

// Colony types
export type { ColonySnapshot, Colonist, ColonistRole } from "./colony";

// Politics types
export type { PoliticsSnapshot, Faction, Decision, DecisionResult } from "./politics";

// Operations types
export type {
  OperationsSnapshot,
  PolicyType,
  PolicyValue,
  ColonyPolicies,
  ActiveExpedition,
  ProspectingSite,
  ExpeditionType,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
} from "./operations";

// NPC types
export type { NPCInfluenceSnapshot, NPC, Project, Council } from "./npc";

// Event types
export type {
  ActiveEventSnapshot,
  GameEvent,
  RandomEventDefinition,
  EventChoice,
  ActiveEvent,
} from "./events";

// Game types
export type { AdvanceSolsResult, VictoryState } from "./game";
