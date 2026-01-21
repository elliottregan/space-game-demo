import type { Faction, Decision } from "../models/Politics";

export const FACTIONS: Faction[] = [
  {
    id: "earth_loyalists",
    name: "Earth Loyalists",
    description:
      "Believe Mars should maintain close ties with Earth and prioritize helping humanity's homeworld",
    support: 60,
    priorities: [
      { concern: "earth_welfare", weight: 1 },
      { concern: "safety", weight: 2 },
      { concern: "tradition", weight: 3 },
    ],
  },
  {
    id: "mars_independence",
    name: "Mars Independence Movement",
    description: "Advocate for Mars to chart its own course, free from Earth's influence",
    support: 40,
    priorities: [
      { concern: "mars_sovereignty", weight: 1 },
      { concern: "innovation", weight: 2 },
      { concern: "growth", weight: 3 },
    ],
  },
  {
    id: "corporate_interests",
    name: "Corporate Interests",
    description: "Prioritize economic efficiency and profitability of the Mars venture",
    support: 50,
    priorities: [
      { concern: "profit", weight: 1 },
      { concern: "efficiency", weight: 2 },
      { concern: "growth", weight: 3 },
    ],
  },
];

export const DECISIONS: Decision[] = [
  {
    id: "earth_aid_major",
    name: "Send Major Aid to Earth",
    description: "Redirect 40% of surplus resources to Earth relief efforts",
    requiredSupport: 40,
    tags: {
      earth_welfare: 30,
      mars_sovereignty: -20,
      profit: -10,
    },
    effects: {
      resources: { food: -50, materials: -80 },
    },
  },
  {
    id: "earth_aid_token",
    name: "Send Token Aid to Earth",
    description: "Send symbolic support (10% of surplus)",
    requiredSupport: 20,
    tags: {
      earth_welfare: 5,
      mars_sovereignty: 10,
      profit: -5,
    },
    effects: {
      resources: { food: -10, materials: -15 },
    },
  },
  {
    id: "declare_independence",
    name: "Declare Independence from Earth",
    description: "Formally break ties with Earth and establish Mars as sovereign",
    requiredSupport: 60,
    tags: {
      earth_welfare: -40,
      mars_sovereignty: 40,
      tradition: -30,
    },
  },
  {
    id: "corporate_charter",
    name: "Grant Corporate Charter",
    description: "Allow corporations greater autonomy in exchange for investment",
    requiredSupport: 35,
    tags: {
      profit: 25,
      mars_sovereignty: -15,
      innovation: 10,
    },
    effects: {
      resources: { materials: 200 },
    },
  },
  {
    id: "research_initiative",
    name: "Launch Research Initiative",
    description: "Invest heavily in scientific advancement",
    requiredSupport: 30,
    tags: {
      innovation: 20,
      profit: -10,
      growth: 10,
    },
    effects: {
      resources: { materials: -100 },
    },
  },
  {
    id: "expand_colony",
    name: "Expand Colony Infrastructure",
    description: "Focus resources on growing the colony",
    requiredSupport: 25,
    tags: {
      growth: 25,
      safety: -5,
      efficiency: 10,
    },
    effects: {
      resources: { materials: -150 },
    },
  },
];
