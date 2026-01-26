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
  moraleBoost?: number; // Passive morale boost when active
  capacity?: number; // Housing capacity for habitats
  oxygenContribution?: number; // Oxygen units contributed per sol when active
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
  /** Building condition 0-100%, affects efficiency when low */
  condition: number;
  /** Sols since construction */
  age: number;
  /** Sol when last maintenance was performed */
  lastMaintenance: number;
}

/**
 * PlacedBuilding is a UI-oriented representation that combines a Building instance
 * with its BuildingDefinition template for convenient display in components.
 */
export interface PlacedBuilding {
  id: string;
  template: BuildingDefinition;
  workers?: number;
  constructionProgress?: {
    current: number;
    required: number;
  };
}
