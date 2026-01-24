import type { ResourceDelta } from "./Resources";

export type NPCFaction = "earth_loyalists" | "mars_independence" | "corporate_interests";

export interface NPC {
  id: string;
  name: string;
  faction: NPCFaction;
  /** Base cost multiplier for lobbying this NPC (1.0 = normal, 2.0 = expensive) */
  influence: number;
}

export type ProjectType = "earth_loyalists" | "mars_independence" | "corporate_interests";

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  /** Resource cost to propose this project */
  proposalCost: ResourceDelta;
  /** Effects applied if project passes */
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}

export interface ActiveProject {
  projectId: string;
  /** NPC id -> support level (-1 to +1) */
  supportLevels: Map<string, number>;
  /** Sols remaining before vote */
  solsRemaining: number;
}

export interface Council {
  id: string;
  name: string;
  /** NPC ids that are members */
  memberIds: string[];
  /** Relationship boost applied between members */
  relationshipBoost: number;
}
