// src/core/data/skills.ts
import { ColonistRole } from "../models/Colonist";

export enum SkillId {
  JURY_RIGGER = "jury_rigger",
  GREEN_THUMB = "green_thumb",
  LAB_RAT = "lab_rat",
  PEOPLE_PERSON = "people_person",
  QUICK_LEARNER = "quick_learner",
  NIGHT_OWL = "night_owl",
  CALM_UNDER_PRESSURE = "calm_under_pressure",
  HOMEBODY = "homebody",
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  affinity: ColonistRole[];
  efficiencyBonus: number;
}

export const SKILLS: SkillDefinition[] = [
  {
    id: SkillId.JURY_RIGGER,
    name: "Jury-Rigger",
    description: "Can fix anything with duct tape",
    affinity: [ColonistRole.ENGINEERING],
    efficiencyBonus: 0.15,
  },
  {
    id: SkillId.GREEN_THUMB,
    name: "Green Thumb",
    description: "Innate talent with plants",
    affinity: [ColonistRole.FARMING],
    efficiencyBonus: 0.15,
  },
  {
    id: SkillId.LAB_RAT,
    name: "Lab Rat",
    description: "Obsessive attention to detail",
    affinity: [ColonistRole.RESEARCH],
    efficiencyBonus: 0.15,
  },
  {
    id: SkillId.PEOPLE_PERSON,
    name: "People Person",
    description: "Natural mediator",
    affinity: [ColonistRole.CIVIL_SCIENCE],
    efficiencyBonus: 0.15,
  },
  {
    id: SkillId.QUICK_LEARNER,
    name: "Quick Learner",
    description: "Picks up new skills faster",
    affinity: [
      ColonistRole.RESEARCH,
      ColonistRole.ENGINEERING,
      ColonistRole.CIVIL_SCIENCE,
      ColonistRole.FARMING,
    ],
    efficiencyBonus: 0.05,
  },
  {
    id: SkillId.NIGHT_OWL,
    name: "Night Owl",
    description: "Productive during off-hours",
    affinity: [
      ColonistRole.RESEARCH,
      ColonistRole.ENGINEERING,
      ColonistRole.CIVIL_SCIENCE,
      ColonistRole.FARMING,
    ],
    efficiencyBonus: 0.05,
  },
  {
    id: SkillId.CALM_UNDER_PRESSURE,
    name: "Calm Under Pressure",
    description: "Performs well in crises",
    affinity: [ColonistRole.ENGINEERING, ColonistRole.RESEARCH],
    efficiencyBonus: 0.1,
  },
  {
    id: SkillId.HOMEBODY,
    name: "Homebody",
    description: "Thrives in routine work",
    affinity: [ColonistRole.FARMING, ColonistRole.CIVIL_SCIENCE],
    efficiencyBonus: 0.1,
  },
];

export function getSkillById(id: SkillId): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}
