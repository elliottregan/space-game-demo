export enum ColonistRole {
  UNASSIGNED = "unassigned",
  RESEARCH = "research",
  ENGINEERING = "engineering",
  CIVIL_SCIENCE = "civil_science",
  FARMING = "farming",
}

export enum MasteryLevel {
  NOVICE = 0,
  SKILLED = 1,
  EXPERT = 2,
  MASTER = 3,
}

export interface Colonist {
  id: string;
  name: string;
  role: ColonistRole;
  experience: number;
  masteryLevel: MasteryLevel;
  trainingTarget?: ColonistRole;
  trainingProgress?: number;
}
