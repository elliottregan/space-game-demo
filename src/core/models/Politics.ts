import type { ResourceDelta } from "./Resources";

export interface Faction {
  id: string;
  name: string;
  description: string;
  support: number;
  priorities: FactionPriority[];
}

export interface FactionPriority {
  concern: string;
  weight: number;
}

export interface Decision {
  id: string;
  name: string;
  description: string;
  requiredSupport: number;
  tags: Record<string, number>;
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}

export interface DecisionResult {
  success: boolean;
  impacts: FactionImpact[];
}

export interface FactionImpact {
  factionId: string;
  change: number;
  newSupport: number;
}
