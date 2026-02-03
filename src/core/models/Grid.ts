// src/core/models/Grid.ts
export interface GridPosition {
  x: number;
  y: number;
}

export enum DepositType {
  WATER = "water",
  MINERAL = "mineral",
}

export enum PowerState {
  POWERED = "powered",
  ON_BATTERY = "on_battery",
  LOW_BATTERY = "low_battery",
  UNPOWERED = "unpowered",
}

export interface GridCell {
  position: GridPosition;
  deposit?: DepositType;
  buildingId?: string;
}

export interface BuildingPlacement {
  buildingId: string;
  position: GridPosition;
  powerSourceId?: string;
  distanceToPower: number;
  batteryLevel: number; // 0-1, where 1 = full (3 sols)
  powerState: PowerState;
  clusterId?: string;
}

export interface Cluster {
  id: string;
  rootHabitatId: string;
  buildingIds: Set<string>;
}

export const GRID_SIZE = 10;
export const BATTERY_BACKUP_SOLS = 3;
