// src/facade/types/powerGrid.ts

export interface PowerGridSnapshot {
  readonly gridStrain: number;
  readonly production: number;
  readonly consumption: number;
  readonly efficiencyMultiplier: number;
  readonly isComfortable: boolean;
  readonly isCritical: boolean;
}
