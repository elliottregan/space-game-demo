/**
 * Read-only query interfaces for cross-manager dependencies.
 * These interfaces allow managers to query data from other managers
 * without holding references to concrete classes.
 */

import type { Colonist } from "../models/Colonist";
import type { DistrictGrantId } from "../models/DistrictGrant";

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
 * Query interface for grant completion status.
 * Implemented by DistrictGrantManager.
 */
export interface GrantCompletionQueries {
  isGrantCompleted(grantId: DistrictGrantId): boolean;
}

/**
 * Query interface for district/placement data.
 * Implemented by DistrictManager.
 */
export interface DistrictQueries {
  getBuildingDistrictId(buildingId: string): string | undefined;
  getColonistDistrictId(colonistId: string): string | undefined;
}
