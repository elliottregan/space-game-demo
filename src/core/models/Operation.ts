// src/core/models/Operation.ts

export type BuildingMode = "conservation" | "normal" | "overdrive";

export type WorkIntensity = "relaxed" | "standard" | "crunch";
export type ResourcePriority = "stockpile" | "balanced" | "burn";
export type ExplorationStance = "cautious" | "standard" | "aggressive";

export interface ColonyPolicies {
  workIntensity: WorkIntensity;
  resourcePriority: ResourcePriority;
  explorationStance: ExplorationStance;
  lastChangeAt: number; // sol when last changed
}

export type ExpeditionType = "survey" | "salvage" | "science" | "deep";

export interface ActiveExpedition {
  id: string;
  type: ExpeditionType;
  assignedCrew: string[];
  startedAt: number;
  solsRemaining: number;
}

export type ProspectingResourceType = "water" | "materials" | "research";
export type ProspectingQuality = "poor" | "moderate" | "rich";

export interface ProspectingSite {
  id: string;
  resourceType: ProspectingResourceType;
  quality: ProspectingQuality;
  revealed: boolean;
  developed: boolean;
  developmentProgress: number;
  // New fields for deposit depletion
  reserves: number; // Actual amount (hidden from player)
  estimatedReserves: { min: number; max: number }; // Player-visible estimate
  remainingReserves: number; // Current amount left
  linkedBuildingId: string | null; // Building extracting from this deposit
}

export interface ExpeditionResult {
  success: boolean;
  type: ExpeditionType;
  rewards?: {
    materials?: number;
    site?: ProspectingSite;
    researchBonus?: { multiplier: number; expiresAt: number };
    discovery?: string;
  };
  losses?: {
    crewLost: string[];
    materialsLost?: number;
  };
}
