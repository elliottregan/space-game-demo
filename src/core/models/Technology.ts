import type { ResourceDelta } from "./Resources";

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
  GENERATION_SHIP = "generation_ship",
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
  unlocks: string[];
  effects?: TechEffect[];
}

export interface TechEffect {
  type: "research_speed" | "construction_speed" | "production_bonus";
  value: number;
}

export interface TechResearch {
  techId: TechnologyId;
  progress: number;
  requiredSols: number;
}
