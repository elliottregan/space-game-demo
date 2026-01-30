// src/core/models/Project.ts

import type { ResourceDelta } from "./Resources";
import { NPCFaction } from "./NPCInfluence";

/**
 * Project identifiers for political projects.
 */
export enum ProjectId {
  // Earth Loyalists
  GENERATION_SHIP = "generation_ship",
  EARTH_MEMORIAL = "earth_memorial",
  HERITAGE_ARCHIVE = "heritage_archive",
  // Mars Independence
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  // Corporate Interests
  AI_GOVERNANCE = "ai_governance",
  MINING_CONCESSION = "mining_concession",
  LABOR_EFFICIENCY = "labor_efficiency",
}

/**
 * A political project that can be proposed when faction support is sufficient.
 */
export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  /** Which faction this project belongs to */
  faction: NPCFaction;
  /** Resource cost to propose the project */
  proposalCost: ResourceDelta;
  /** Minimum faction support required (0-1) */
  requiredSupport: number;
  /** Optional effects when the project passes */
  effects?: {
    unlockBuilding?: string;
    unlockTech?: string;
  };
}

/**
 * Tier of project based on required support level.
 */
export type ProjectTier = "minor" | "major" | "victory";

/**
 * Get the tier of a project based on its required support.
 */
export function getProjectTier(requiredSupport: number): ProjectTier {
  if (requiredSupport >= 0.5) return "victory";
  if (requiredSupport >= 0.35) return "major";
  return "minor";
}
