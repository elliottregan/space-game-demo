// src/core/data/skills.ts
import { ColonistRole } from "../models/Colonist";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  affinity: ColonistRole[];
  efficiencyBonus: number;
}

export const SKILLS: SkillDefinition[] = [
  {
    id: "jury_rigger",
    name: "Jury-Rigger",
    description: "Can fix anything with duct tape",
    affinity: [ColonistRole.ENGINEERING],
    efficiencyBonus: 0.15,
  },
  {
    id: "green_thumb",
    name: "Green Thumb",
    description: "Innate talent with plants",
    affinity: [ColonistRole.FARMING],
    efficiencyBonus: 0.15,
  },
  {
    id: "lab_rat",
    name: "Lab Rat",
    description: "Obsessive attention to detail",
    affinity: [ColonistRole.RESEARCH],
    efficiencyBonus: 0.15,
  },
  {
    id: "people_person",
    name: "People Person",
    description: "Natural mediator",
    affinity: [ColonistRole.CIVIL_SCIENCE],
    efficiencyBonus: 0.15,
  },
  {
    id: "quick_learner",
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
    id: "night_owl",
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
    id: "calm_under_pressure",
    name: "Calm Under Pressure",
    description: "Performs well in crises",
    affinity: [ColonistRole.ENGINEERING, ColonistRole.RESEARCH],
    efficiencyBonus: 0.1,
  },
  {
    id: "homebody",
    name: "Homebody",
    description: "Thrives in routine work",
    affinity: [ColonistRole.FARMING, ColonistRole.CIVIL_SCIENCE],
    efficiencyBonus: 0.1,
  },
];

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}
