import type { ResourceDelta } from "./Resources";

export interface Technology {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];
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
  techId: string;
  progress: number;
  requiredSols: number;
}
