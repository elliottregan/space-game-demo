export interface Resources {
  food: number;
  water: number;
  power: number;
  materials: number;
}

export interface ResourceDelta {
  food?: number;
  water?: number;
  power?: number;
  materials?: number;
}

export const RESOURCE_KEYS: (keyof Resources)[] = ["food", "water", "power", "materials"];
