import type { SkillId } from "../data/skills";

/**
 * Colonist political ideology - affinity to each faction.
 * Values are 0-1 and independent (don't need to sum to 1).
 */
export interface ColonistIdeology {
  /** Affinity toward Earth Loyalists (0-1) */
  earthLoyalist: number;
  /** Affinity toward Mars Independence (0-1) */
  marsIndependence: number;
  /** Affinity toward Corporate Interests (0-1) */
  corporateInterests: number;
  /** How strongly held beliefs are - resistance to influence (0-1) */
  conviction: number;
}

export enum ColonistRole {
  UNASSIGNED = "unassigned",
  RESEARCH = "research",
  ENGINEERING = "engineering",
  CIVIL_SCIENCE = "civil_science",
  FARMING = "farming",
}

/** Display names for colonist roles */
export const ROLE_DISPLAY_NAMES: Record<ColonistRole, string> = {
  [ColonistRole.UNASSIGNED]: "Unassigned",
  [ColonistRole.RESEARCH]: "Researcher",
  [ColonistRole.ENGINEERING]: "Engineer",
  [ColonistRole.CIVIL_SCIENCE]: "Scientist",
  [ColonistRole.FARMING]: "Farmer",
};

export interface Colonist {
  id: string;
  name: string;
  role: ColonistRole;
  skills: SkillId[];
  housingId?: string; // Building ID of assigned habitat
  arrivalSol?: number; // Sol when colonist arrived (for cohort bonding)
  guildIds?: string[]; // Guild memberships
  socialBuildingIds?: string[]; // Assigned social buildings (third spaces)
  ideology?: ColonistIdeology; // Political ideology (optional for migration)
}
