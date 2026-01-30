// src/facade/types/operations.ts
// Operations-related types for the facade

import type {
  ActiveExpedition,
  ExpeditionType,
  ProspectingSite,
} from "../../core/models/Operation";

/**
 * Immutable snapshot of operations state.
 */
export interface OperationsSnapshot {
  readonly expeditions: readonly Readonly<ActiveExpedition>[];
  readonly sites: readonly Readonly<ProspectingSite>[];
}

// Re-export core types
export type { ActiveExpedition, ProspectingSite, ExpeditionType };
