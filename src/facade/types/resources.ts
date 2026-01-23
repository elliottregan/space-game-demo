// src/facade/types/resources.ts
// Resource-related types for the facade

import type { Resources, ResourceDelta } from "../../core/models/Resources";

/**
 * Immutable snapshot of resource state.
 */
export interface ResourceSnapshot {
  readonly current: Readonly<Resources>;
  readonly production: Readonly<ResourceDelta>;
  readonly consumption: Readonly<ResourceDelta>;
  readonly netFlow: Readonly<ResourceDelta>;
}

// Re-export core types
export type { Resources, ResourceDelta };
