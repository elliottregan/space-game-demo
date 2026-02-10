// src/facade/types/index.ts
// Re-export all facade types

import { BuildingId } from "./buildings";

// Life support types
export type { LifeSupportSnapshot } from "./lifeSupport";
// Power grid types
export type { PowerGridSnapshot } from "./powerGrid";
export type {
  Building,
  BuildingDefinition,
  BuildingMode,
  BuildingSnapshot,
  BuildingStatus,
  PlacedBuilding,
} from "./buildings";
// Building types
export { BuildingId } from "./buildings";
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
  | { action: "build"; defId: BuildingId }
  | { action: "recycle"; buildingId: string }
  | { action: "repurpose"; buildingId: string; targetDefId: BuildingId };

export type { Colonist, ColonistRole, ColonySnapshot, SkillDefinition } from "./colony";
// Colony types
export { SkillId } from "./colony";
export type {
  ActiveEvent,
  ActiveEventSnapshot,
  EventChoice,
  GameEvent,
  RandomEventDefinition,
} from "./events";
// Event types
export { EventId } from "./events";
// Game types
export type { AdvanceSolsResult, VictoryState } from "./game";
export type { Council, NPC, NPCInfluenceSnapshot, Project } from "./npc";
// NPC types
export { NPCId, ProjectId } from "./npc";
// Operations types
export type {
  ActiveExpedition,
  ExpeditionType,
  OperationsSnapshot,
  ProspectingSite,
} from "./operations";
// Politics types
export type { FactionStatus, PoliticsSnapshot } from "./politics";
// Ideology types
export type {
  ColonistIdeology,
  CouncilMemberSnapshot,
  FactionSnapshot,
  IdeologySnapshot,
  ProjectEligibility,
} from "./ideology";
export type { Technology, TechnologySnapshot, TechResearch, UnlockId } from "./technology";
// Technology types
export { SpecialUnlockId, TechnologyId } from "./technology";
// Grid types
// Grant types
export type {
  ActiveGrantSnapshot,
  AvailableGrantSnapshot,
  GrantSourceSnapshot,
  GrantsSnapshot,
} from "./grants";
// District types
export type { DistrictEntry, DistrictSnapshot } from "./district";
export type { GridPosition } from "../../core/models/Grid";
export type { DepositInfo, GridSnapshot, PlacementHints, PowerSourceInfo } from "./grid";
export { DepositType } from "../../core/models/Grid";
