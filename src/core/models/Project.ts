// src/core/models/Project.ts

import type { AxisPosition, AxisRequirement } from "./NPCInfluence";
import type { ResourceDelta } from "./Resources";

/**
 * Project identifiers for political projects.
 * NOTE: The canonical ProjectId enum is in NPCInfluence.ts.
 * This file is kept for backwards compatibility.
 */
export { ProjectId } from "./NPCInfluence";

/**
 * A political project that can be proposed when axis requirements are met.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  /** Axis position requirements for a faction to champion this project */
  axisRequirements?: Partial<Record<keyof AxisPosition, AxisRequirement>>;
  /** Resource cost to propose the project */
  proposalCost: ResourceDelta;
  /** Optional effects when the project passes */
  effects?: {
    unlockBuilding?: string;
    unlockTech?: string;
  };
  /** True if this is a capstone victory project */
  isCapstone?: boolean;
}

/**
 * Tier of project based on capstone status.
 */
export type ProjectTier = "minor" | "major" | "victory";

/**
 * Get the tier of a project.
 */
export function getProjectTier(project: { isCapstone?: boolean }): ProjectTier {
  if (project.isCapstone) return "victory";
  return "minor";
}
