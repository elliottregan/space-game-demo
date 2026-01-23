// src/facade/types/common.ts
// Shared types for the facade layer: Result, errors, and capability checks

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
  required: Record<string, number>;
  available: Record<string, number>;
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
  entity:
    | "building"
    | "technology"
    | "colonist"
    | "decision"
    | "expedition"
    | "site"
    | "project"
    | "npc";
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

/**
 * Result of checking if an action can be performed.
 * Provides detailed reason when not allowed.
 */
export interface CanDoResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly missingResources?: Record<string, number>;
}

/**
 * State change listener callback type.
 */
export type StateChangeListener = () => void;
