import type { BuildingId } from "./Building";
import type { Resources } from "./Resources";

export interface StartingCondition {
  id: string;
  name: string;
  description: string;
  population: number;
  resources: Resources;
  preBuiltBuildings: BuildingId[];
}
