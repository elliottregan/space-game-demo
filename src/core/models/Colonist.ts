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
  skills: string[];
}
