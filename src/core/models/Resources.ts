export interface Resources {
  food: number;
  oxygen: number;
  water: number;
  power: number;
  materials: number;
}

export interface ResourceDelta {
  food?: number;
  oxygen?: number;
  water?: number;
  power?: number;
  materials?: number;
}

export const RESOURCE_KEYS: (keyof Resources)[] = ["food", "oxygen", "water", "power", "materials"];
