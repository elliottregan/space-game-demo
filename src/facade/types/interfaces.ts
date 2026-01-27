// src/facade/types/interfaces.ts
// Common interfaces for domain facades

import type { CanDoResult, Result } from "./common";

/**
 * Interface for facades that provide immutable state snapshots.
 * All domain facades implement this to provide read access to their domain state.
 *
 * @example
 * const buildings = api.buildings.snapshot();
 * const resources = api.resources.snapshot();
 */
export interface Queryable<TSnapshot> {
  /**
   * Get an immutable snapshot of the current domain state.
   * Snapshots are frozen objects that won't change after retrieval.
   */
  snapshot(): TSnapshot;
}

/**
 * Interface for facades that support looking up entities by ID.
 * Useful for domains that manage collections of identifiable entities.
 *
 * @example
 * const building = api.buildings.getById("building-123");
 * const colonist = api.colony.getById("colonist-456");
 */
export interface EntityLookup<TEntity> {
  /**
   * Get a specific entity by its unique identifier.
   * Returns undefined if the entity doesn't exist.
   */
  getById(id: string): Readonly<TEntity> | undefined;
}

/**
 * Interface for facades that support checking action feasibility.
 * Returns detailed information about whether an action can be performed.
 *
 * @example
 * const check = api.buildings.canBuild("solar_panel");
 * if (!check.allowed) {
 *   console.log(check.reason); // "Insufficient resources"
 *   console.log(check.missingResources); // { materials: 10 }
 * }
 */
export interface ActionChecker<TParams extends unknown[]> {
  /**
   * Check if an action can be performed with the given parameters.
   * Returns detailed information including reason and missing resources if not allowed.
   */
  canDo(...params: TParams): CanDoResult;
}

/**
 * Interface for facades that support executing commands.
 * Commands modify game state and return typed Result objects.
 *
 * @example
 * const result = api.buildings.build("solar_panel");
 * if (result.success) {
 *   console.log("Built:", result.data.id);
 * } else {
 *   console.log("Failed:", result.error.type);
 * }
 */
export interface CommandExecutor<TParams extends unknown[], TResult> {
  /**
   * Execute a command that modifies game state.
   * Returns a Result type with either success data or typed error.
   */
  execute(...params: TParams): Result<TResult>;
}

/**
 * Combined interface for actions that can be checked before execution.
 * Most game commands follow this pattern: check first, then execute.
 *
 * @example
 * // Pattern used throughout the facade:
 * const check = facade.canBuild("solar_panel");
 * if (check.allowed) {
 *   const result = facade.build("solar_panel");
 * }
 */
export interface CheckedAction<TParams extends unknown[], TResult>
  extends ActionChecker<TParams>, CommandExecutor<TParams, TResult> {}

/**
 * Marker type for query-only facades (no commands).
 * ResourcesFacade is an example - resources are modified through other domains.
 */
export type QueryOnlyFacade<TSnapshot> = Queryable<TSnapshot>;

/**
 * Type for facades that have both queries and commands.
 * Most domain facades fall into this category.
 */
export type CommandFacade<TSnapshot, TEntity = unknown> = Queryable<TSnapshot> &
  (TEntity extends unknown ? unknown : EntityLookup<TEntity>);
