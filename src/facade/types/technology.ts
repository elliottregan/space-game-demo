// src/facade/types/technology.ts
// Technology-related types for the facade

import type { Technology, TechResearch } from "../../core/models/Technology";

/**
 * Immutable snapshot of technology state.
 */
export interface TechnologySnapshot {
  readonly all: readonly Readonly<Technology>[];
  readonly available: readonly Readonly<Technology>[];
  readonly researched: readonly Readonly<Technology>[];
  readonly currentResearch: Readonly<TechResearch> | null;
  readonly researchQueue: readonly string[];
}

// Re-export core types
export type { Technology, TechResearch };
