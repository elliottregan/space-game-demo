// src/facade/types/grid.ts
// Grid facade type definitions

import type { DepositType, GridPosition } from "../../core/models/Grid";

export interface DepositInfo {
  readonly position: GridPosition;
  readonly type: DepositType;
  readonly isOccupied: boolean;
}

export interface PowerSourceInfo {
  readonly buildingId: string;
  readonly position: GridPosition;
  readonly output: number;
  readonly range: number;
}

export interface PlacementHints {
  readonly position: GridPosition;
  readonly isOccupied: boolean;
  readonly deposit?: DepositType;
  readonly hasPower: boolean;
  readonly powerCapacityAvailable: number;
  readonly distanceToNearestPower: number;
}

export interface GridSnapshot {
  readonly size: number;
  readonly deposits: readonly DepositInfo[];
  readonly powerSources: readonly PowerSourceInfo[];
  readonly occupiedCells: readonly GridPosition[];
}
