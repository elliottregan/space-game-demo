import type { ResourceDelta } from "./Resources";
import type { ColonistRole } from "./Colonist";

export type BuildingStatus = "pending" | "active" | "disabled";

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
}
