// src/core/facade/types.ts
// Type definitions for the game façade pattern

import type { Resources, ResourceDelta } from "../models/Resources";
import type { Building, BuildingDefinition, BuildingStatus } from "../models/Building";
import type { Technology, TechResearch } from "../models/Technology";
import type { Colonist, ColonistRole } from "../models/Colonist";
import type { Faction, Decision, DecisionResult } from "../models/Politics";
import type { GameEvent, RandomEventDefinition, EventChoice, ActiveEvent } from "../models/GameEvent";
import type { VictoryState } from "../systems/VictoryManager";
import type {
  ColonyPolicies,
  ActiveExpedition,
  ProspectingSite,
  ExpeditionType,
  BuildingMode,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
} from "../models/Operation";
import type { NPC, Project, Council } from "../models/NPCInfluence";

// ============================================================================
// Result Types
// ============================================================================

/**
 * Discriminated union for operation results.
 * All commands return Result<T> for type-safe error handling.
 */
export type Result<T, E extends GameError = GameError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper to create success result
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function err<E extends GameError>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Union type of all possible game errors.
 * Each error has a discriminant 'type' field for type narrowing.
 */
export type GameError =
  | InsufficientResourcesError
  | PrerequisiteNotMetError
  | InvalidTargetError
  | AlreadyInProgressError
  | NotFoundError
  | CooldownActiveError
  | InvalidStateError
  | CapacityExceededError;

export interface InsufficientResourcesError {
  type: "INSUFFICIENT_RESOURCES";
  required: ResourceDelta;
  available: Resources;
}

export interface PrerequisiteNotMetError {
  type: "PREREQUISITE_NOT_MET";
  required: string;
  reason: string;
}

export interface InvalidTargetError {
  type: "INVALID_TARGET";
  target: string;
  reason: string;
}

export interface AlreadyInProgressError {
  type: "ALREADY_IN_PROGRESS";
  current: string;
  description: string;
}

export interface NotFoundError {
  type: "NOT_FOUND";
  entity: "building" | "technology" | "colonist" | "decision" | "expedition" | "site" | "project" | "npc";
  id: string;
}

export interface CooldownActiveError {
  type: "COOLDOWN_ACTIVE";
  remainingSols: number;
}

export interface InvalidStateError {
  type: "INVALID_STATE";
  current: string;
  expected: string;
  reason: string;
}

export interface CapacityExceededError {
  type: "CAPACITY_EXCEEDED";
  current: number;
  max: number;
  resource: string;
}

// ============================================================================
// Query Result Snapshots (Immutable)
// ============================================================================

/**
 * Immutable snapshot of resource state.
 */
export interface ResourceSnapshot {
  readonly current: Readonly<Resources>;
  readonly production: Readonly<ResourceDelta>;
  readonly consumption: Readonly<ResourceDelta>;
  readonly netFlow: Readonly<ResourceDelta>;
}

/**
 * Immutable snapshot of building state.
 */
export interface BuildingSnapshot {
  readonly active: readonly Readonly<Building>[];
  readonly pending: readonly Readonly<Building>[];
  readonly definitions: readonly Readonly<BuildingDefinition>[];
}

/**
 * Immutable snapshot of technology state.
 */
export interface TechnologySnapshot {
  readonly all: readonly Readonly<Technology>[];
  readonly available: readonly Readonly<Technology>[];
  readonly researched: readonly Readonly<Technology>[];
  readonly currentResearch: Readonly<TechResearch> | null;
}

/**
 * Immutable snapshot of colony state.
 */
export interface ColonySnapshot {
  readonly population: number;
  readonly health: number;
  readonly morale: number;
  readonly colonists: readonly Readonly<Colonist>[];
}

/**
 * Immutable snapshot of politics state.
 */
export interface PoliticsSnapshot {
  readonly factions: readonly Readonly<Faction>[];
  readonly averageSupport: number;
  readonly decisions: readonly Readonly<Decision>[];
}

/**
 * Immutable snapshot of operations state.
 */
export interface OperationsSnapshot {
  readonly policies: Readonly<ColonyPolicies>;
  readonly policyCooldownRemaining: number;
  readonly expeditions: readonly Readonly<ActiveExpedition>[];
  readonly sites: readonly Readonly<ProspectingSite>[];
}

/**
 * Immutable snapshot of NPC influence state.
 */
export interface NPCInfluenceSnapshot {
  readonly npcs: readonly Readonly<NPC>[];
  readonly projects: readonly Readonly<Project>[];
  readonly activeProject: Readonly<{
    projectId: string;
    supportLevels: Readonly<Record<string, number>>;
    solsRemaining: number;
    averageSupport: number;
  }> | null;
  readonly councils: readonly Readonly<Council>[];
  readonly relationshipMatrix: readonly (readonly number[])[];
}

/**
 * Immutable snapshot of active event state.
 */
export interface ActiveEventSnapshot {
  readonly definition: Readonly<RandomEventDefinition>;
  readonly active: Readonly<ActiveEvent>;
  readonly choices: readonly Readonly<EventChoice>[];
}

// ============================================================================
// Capability Check Results
// ============================================================================

/**
 * Result of checking if an action can be performed.
 * Provides detailed reason when not allowed.
 */
export interface CanDoResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly missingResources?: ResourceDelta;
}

// ============================================================================
// Command Parameter Types
// ============================================================================

export type PolicyType = "workIntensity" | "resourcePriority" | "explorationStance";
export type PolicyValue = WorkIntensity | ResourcePriority | ExplorationStance;

export interface PolicyUpdate {
  type: PolicyType;
  value: PolicyValue;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  Resources,
  ResourceDelta,
  Building,
  BuildingDefinition,
  BuildingStatus,
  BuildingMode,
  Technology,
  TechResearch,
  Colonist,
  ColonistRole,
  Faction,
  Decision,
  DecisionResult,
  GameEvent,
  RandomEventDefinition,
  EventChoice,
  ActiveEvent,
  VictoryState,
  ColonyPolicies,
  ActiveExpedition,
  ProspectingSite,
  ExpeditionType,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
  NPC,
  Project,
  Council,
};
