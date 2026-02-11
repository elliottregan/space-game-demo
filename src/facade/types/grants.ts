import type { DistrictGrantId, DistrictGrantCategory } from "../../core/models/DistrictGrant";
import type { GrantSourceId } from "../../core/models/Grant";

export interface AvailableGrantSnapshot {
  id: number;
  templateId: DistrictGrantId;
  name: string;
  description: string;
  category: DistrictGrantCategory;
  cost: { food?: number; water?: number; materials?: number };
  baseDuration: number;
  identityTag: string;
  sourceId?: GrantSourceId;
  sourceName?: string;
  isCapstone?: boolean;
}

export interface ActiveGrantSnapshot {
  id: number;
  templateId: DistrictGrantId;
  districtId: string;
  name: string;
  assignedSol: number;
  remainingSols: number;
  totalDuration: number;
}

export interface DistrictGrantsSnapshot {
  available: AvailableGrantSnapshot[];
  active: ActiveGrantSnapshot[];
  axisProgress: Record<string, number>;
  completedGrantIds: DistrictGrantId[];
}

// Keep old name for backwards compatibility with GameAPI imports
export type GrantsSnapshot = DistrictGrantsSnapshot;
