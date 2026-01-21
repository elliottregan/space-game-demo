import type { ResourceDelta } from "./Resources";
import type { ColonistRole } from "./Colonist";

export type BuildingStatus = "pending" | "active" | "disabled" | "idle" | "recycling";

export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  cost: ResourceDelta;
  constructionTime: number;
  production?: ResourceDelta;
  consumption?: ResourceDelta;
  workerSlots?: number;
  workerRole?: ColonistRole;
  requiredTech?: string;
  requiresDeposit?: boolean; // true for mining buildings
  repurposeTargets?: string[]; // building IDs this can convert to
}

export interface Building {
  id: string;
  definitionId: string;
  status: BuildingStatus;
  constructionProgress: number;
  assignedWorkers: string[];
  mode: "conservation" | "normal" | "overdrive";
  broken: boolean;
  repairProgress: number;
  depositId?: string; // linked deposit for mining buildings
  recyclingProgress?: number;
  repurposeFromDefId?: string; // Set when repurposing, cleared when complete
}
