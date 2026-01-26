// src/facade/types/operations.ts
// Operations-related types for the facade

import type {
  ActiveExpedition,
  ColonyPolicies,
  ExpeditionType,
  ExplorationStance,
  ProspectingSite,
  ResourcePriority,
  WorkIntensity,
} from "../../core/models/Operation";

/**
 * Immutable snapshot of operations state.
 */
export interface OperationsSnapshot {
  readonly policies: Readonly<ColonyPolicies>;
  readonly policyCooldownRemaining: number;
  readonly expeditions: readonly Readonly<ActiveExpedition>[];
  readonly sites: readonly Readonly<ProspectingSite>[];
}

export type PolicyType = "workIntensity" | "resourcePriority" | "explorationStance";
export type PolicyValue = WorkIntensity | ResourcePriority | ExplorationStance;

// Re-export core types
export type {
  ColonyPolicies,
  ActiveExpedition,
  ProspectingSite,
  ExpeditionType,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
};
