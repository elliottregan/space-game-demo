// src/facade/types/powerGrid.ts

export interface PowerGridSnapshot {
  /** Total power being produced by all active power sources */
  readonly totalProduction: number;
  /** Total power being consumed by all powered buildings */
  readonly totalConsumption: number;
  /** Count of buildings in each power state */
  readonly buildingCounts: {
    readonly powered: number;
    readonly onBattery: number;
    readonly lowBattery: number;
    readonly unpowered: number;
  };
}
