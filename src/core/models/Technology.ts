import type { BuildingId } from "./Building";
import type { ResourceDelta } from "./Resources";

/** Special unlocks that aren't buildings (e.g., victory items) */
export enum SpecialUnlockId {
  ARC_SHIP = "arc_ship",
}

/** Union type for all unlockable items */
export type UnlockId = BuildingId | SpecialUnlockId;

export enum TechnologyId {
  HYDROPONICS = "hydroponics",
  WATER_RECYCLING = "water_recycling",
  ADVANCED_MATERIALS = "advanced_materials",
  ROBOTICS = "robotics",
  ASTEROID_MINING = "asteroid_mining",
  NUCLEAR_FISSION = "nuclear_fission",
  GENETICS = "genetics",
  ADVANCED_MEDICINE = "advanced_medicine",
  LIFE_EXTENSION = "life_extension",
  CRYOSLEEP = "cryosleep",
  FUSION_DRIVE = "fusion_drive",
  CLOSED_ECOSYSTEM = "closed_ecosystem",
  ASTEROID_MINING_PLATFORM = "asteroid_mining_platform",
}

export interface Technology {
  id: TechnologyId;
  name: string;
  description: string;
  prerequisites: TechnologyId[];
  cost: {
    sols: number;
    resources?: ResourceDelta;
  };
  unlocks: UnlockId[];
  effects?: TechEffect[];
}

export interface TechEffect {
  type: "research_speed" | "construction_speed" | "production_bonus" | "mining_efficiency";
  value: number;
}

export interface TechResearch {
  techId: TechnologyId;
  progress: number;
  requiredSols: number;
}
