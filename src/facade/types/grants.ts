import type { GrantSourceId, GrantTemplateId } from "../../core/models/Grant";

export interface GrantSourceSnapshot {
  id: GrantSourceId;
  name: string;
  description: string;
  ideologyPosition: { solidarity: number; sovereignty: number; transformation: number };
}

export interface AvailableGrantSnapshot {
  id: number;
  templateId: GrantTemplateId;
  sourceId: GrantSourceId;
  sourceName: string;
  name: string;
  description: string;
  effectType: "instant" | "timed";
  ideologyMagnitude: number;
  offeredSol: number;
}

export interface ActiveGrantSnapshot {
  id: number;
  templateId: GrantTemplateId;
  sourceId: GrantSourceId;
  sourceName: string;
  name: string;
  districtId: string;
  assignedSol: number;
  remainingSols?: number;
}

export interface GrantsSnapshot {
  available: AvailableGrantSnapshot[];
  active: ActiveGrantSnapshot[];
  nextRefreshSol: number;
}
