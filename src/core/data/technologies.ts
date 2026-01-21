import type { Technology } from "../models/Technology";

export const TECHNOLOGIES: Technology[] = [
  // EARLY TIER (Sol 30-90)
  {
    id: "hydroponics",
    name: "Hydroponics",
    description: "Advanced soil-free farming techniques",
    prerequisites: [],
    cost: { sols: 60 },
    unlocks: ["greenhouse"],
  },
  {
    id: "water_recycling",
    name: "Water Recycling",
    description: "Closed-loop water systems",
    prerequisites: [],
    cost: { sols: 45 },
    unlocks: ["water_reclaimer"],
    effects: [{ type: "production_bonus", value: 0.5 }],
  },
  {
    id: "advanced_materials",
    name: "Advanced Materials",
    description: "Stronger, lighter construction materials",
    prerequisites: [],
    cost: { sols: 75 },
    unlocks: ["research_lab", "advanced_habitat"],
  },

  // MID TIER (Sol 90-200)
  {
    id: "robotics",
    name: "Robotics",
    description: "Automated labor and manufacturing",
    prerequisites: ["advanced_materials"],
    cost: { sols: 120 },
    unlocks: ["automated_factory"],
    effects: [{ type: "construction_speed", value: 1.2 }],
  },
  {
    id: "asteroid_mining",
    name: "Asteroid Mining",
    description: "Extract resources from nearby asteroids",
    prerequisites: ["advanced_materials", "robotics"],
    cost: { sols: 150, resources: { materials: 200 } },
    unlocks: ["mining_station"],
  },
  {
    id: "nuclear_fission",
    name: "Nuclear Fission",
    description: "Safe nuclear power generation",
    prerequisites: ["advanced_materials"],
    cost: { sols: 180 },
    unlocks: ["nuclear_reactor"],
  },

  // LATE TIER (Sol 200-400)
  {
    id: "genetics",
    name: "Genetic Engineering",
    description: "Modify organisms for Mars conditions",
    prerequisites: ["hydroponics"],
    cost: { sols: 200 },
    unlocks: ["biolab"],
  },
  {
    id: "advanced_medicine",
    name: "Advanced Medicine",
    description: "Extend human lifespan and health",
    prerequisites: ["genetics"],
    cost: { sols: 250 },
    unlocks: ["medical_center"],
  },
  {
    id: "life_extension",
    name: "Life Extension",
    description: "Double human lifespan through genetic therapy",
    prerequisites: ["genetics", "advanced_medicine"],
    cost: { sols: 300 },
    unlocks: [],
  },
  {
    id: "cryosleep",
    name: "Cryogenic Sleep",
    description: "Suspend humans for long-duration travel",
    prerequisites: ["advanced_medicine"],
    cost: { sols: 250 },
    unlocks: ["cryo_facility"],
  },

  // ENDGAME TIER (Sol 400+)
  {
    id: "fusion_drive",
    name: "Fusion Drive",
    description: "Propulsion system for interstellar travel",
    prerequisites: ["nuclear_fission", "advanced_materials"],
    cost: { sols: 400 },
    unlocks: [],
  },
  {
    id: "closed_ecosystem",
    name: "Closed Ecosystem",
    description: "Fully self-sustaining life support",
    prerequisites: ["hydroponics", "water_recycling", "genetics"],
    cost: { sols: 350 },
    unlocks: [],
  },
  {
    id: "generation_ship",
    name: "Generation Ship",
    description: "Massive vessel for interstellar colonization - VICTORY!",
    prerequisites: ["fusion_drive", "cryosleep", "closed_ecosystem"],
    cost: { sols: 500, resources: { materials: 1000 } },
    unlocks: ["arc_ship"],
  },
];
