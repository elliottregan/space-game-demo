// src/facade/types/index.ts
// Re-export all facade types

// Building types
export type {
  Building,
  BuildingDefinition,
  BuildingMode,
  BuildingSnapshot,
  BuildingStatus,
} from "./buildings";
// Common types (includes ok/err helper functions)
export {
  type AlreadyInProgressError,
  type CanDoResult,
  type CapacityExceededError,
  type CooldownActiveError,
  err,
  type GameError,
  type InsufficientResourcesError,
  type InvalidStateError,
  type InvalidTargetError,
  type NotFoundError,
  ok,
  type PrerequisiteNotMetError,
  type Result,
  type StateChangeListener,
} from "./common";
// Common interfaces for facade patterns
export type {
  ActionChecker,
  CheckedAction,
  CommandExecutor,
  CommandFacade,
  EntityLookup,
  Queryable,
  QueryOnlyFacade,
} from "./interfaces";
// Resource types
export type { ResourceDelta, ResourceSnapshot, Resources } from "./resources";

// Building action discriminated union for ActionChecker
export type BuildingAction =
  | { action: "build"; defId: string }
  | { action: "recycle"; buildingId: string }
  | { action: "repurpose"; buildingId: string; targetDefId: string };

// Colony types
export type { Colonist, ColonistRole, ColonySnapshot, SkillDefinition } from "./colony";
// Event types
export type {
  ActiveEvent,
  ActiveEventSnapshot,
  EventChoice,
  GameEvent,
  RandomEventDefinition,
} from "./events";
// Game types
export type { AdvanceSolsResult, VictoryState } from "./game";
// NPC types
export type { Council, NPC, NPCInfluenceSnapshot, Project } from "./npc";
// Operations types
export type {
  ActiveExpedition,
  ColonyPolicies,
  ExpeditionType,
  ExplorationStance,
  OperationsSnapshot,
  PolicyType,
  PolicyValue,
  ProspectingSite,
  ResourcePriority,
  WorkIntensity,
} from "./operations";
// Politics types
export type { FactionDemand, FactionStatus, NPCFaction, PoliticsSnapshot } from "./politics";
// Technology types
export type { Technology, TechnologySnapshot, TechResearch } from "./technology";
