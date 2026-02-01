export interface Resources {
  food: number;
  water: number;
  materials: number;
}

export interface ResourceDelta {
  food?: number;
  water?: number;
  materials?: number;
}

export const RESOURCE_KEYS: (keyof Resources)[] = ["food", "water", "materials"];

/**
 * Power production/consumption for buildings.
 * Power is not stockpiled - it's calculated as a grid strain metric each tick.
 */
export interface PowerDelta {
  power?: number;
}
