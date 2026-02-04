/**
 * Read-only query interfaces for cross-manager dependencies.
 * These interfaces allow managers to query data from other managers
 * without holding references to concrete classes.
 */

import type { Colonist } from "../models/Colonist";
import type { BuildingPlacement } from "../models/Grid";
import type { ProjectId } from "../models/NPCInfluence";

/**
 * Query interface for colonist data.
 * Implemented by ColonyManager.
 */
export interface ColonistQueries {
  getColonist(id: string): Colonist | undefined;
  getColonists(): Colonist[];
}

/**
 * Query interface for workforce calculations.
 * Implemented by WorkforceManager.
 */
export interface WorkforceQueries {
  getTeamCohesionMultiplier(workerIds: string[]): number;
}

/**
 * Query interface for project completion status.
 * Implemented by IdeologyManager.
 */
export interface ProjectQueries {
  isProjectCompleted(projectId: ProjectId): boolean;
}

/**
 * Query interface for grid/placement data.
 * Implemented by GridManager.
 */
export interface GridQueries {
  getPlacement(buildingId: string): BuildingPlacement | undefined;
  getBuildingClusterId(buildingId: string): string | undefined;
}
