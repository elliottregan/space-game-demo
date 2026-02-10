import type { SkillId } from "../data/skills";

/**
 * Colonist political ideology - position on three independent axes.
 * Each axis ranges from -1.0 to +1.0.
 */
export interface ColonistIdeology {
  /** Individualist (-1) <-> Collectivist (+1) */
  solidarity: number;
  /** Earth-tied (-1) <-> Mars-sovereign (+1) */
  sovereignty: number;
  /** Preservationist (-1) <-> Revolutionary (+1) */
  transformation: number;
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

export enum MasteryLevel {
  NOVICE = 0,
  SKILLED = 1,
  EXPERT = 2,
  MASTER = 3,
}

/** Display names for mastery levels */
export const MASTERY_DISPLAY_NAMES: readonly string[] = ["Novice", "Skilled", "Expert", "Master"];

export interface Colonist {
  id: string;
  name: string;
  role: ColonistRole;
  experience: number;
  masteryLevel: MasteryLevel;
  trainingTarget?: ColonistRole;
  trainingProgress?: number;
  skills: SkillId[];
  housingId?: string; // Building ID of assigned habitat
  arrivalSol?: number; // Sol when colonist arrived (for cohort bonding)
  guildIds?: string[]; // Guild memberships
  socialBuildingIds?: string[]; // Assigned social buildings (third spaces)
  ideology?: ColonistIdeology; // Political ideology (optional for migration)
}
