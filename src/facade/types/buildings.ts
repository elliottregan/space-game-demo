// src/facade/types/buildings.ts
// Building-related types for the facade

import {
  type Building,
  type BuildingDefinition,
  BuildingId,
  type BuildingStatus,
  type PlacedBuilding,
} from "../../core/models/Building";
import type { BuildingMode } from "../../core/models/Operation";

/**
 * Immutable snapshot of building state.
 */
export interface BuildingSnapshot {
  readonly active: readonly Readonly<Building>[];
  readonly pending: readonly Readonly<Building>[];
  readonly definitions: readonly Readonly<BuildingDefinition>[];
  readonly moraleBoost: number;
  readonly totalAirContribution: number;
}

// Re-export core types
export { BuildingId };
export type { Building, BuildingDefinition, BuildingStatus, BuildingMode, PlacedBuilding };
