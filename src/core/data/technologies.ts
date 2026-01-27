import { BuildingId } from "../models/Building";
import { SpecialUnlockId, TechnologyId, type Technology } from "../models/Technology";

export const TECHNOLOGIES: Technology[] = [
  // EARLY TIER (Sol 30-90)
  {
    id: TechnologyId.HYDROPONICS,
    name: "Hydroponics",
    description: "Advanced soil-free farming techniques",
    prerequisites: [],
    cost: { sols: 60 },
    unlocks: [BuildingId.GREENHOUSE],
  },
  {
    id: TechnologyId.WATER_RECYCLING,
    name: "Water Recycling",
    description: "Closed-loop water systems",
    prerequisites: [],
    cost: { sols: 45 },
    unlocks: [BuildingId.WATER_RECLAIMER],
    effects: [{ type: "production_bonus", value: 0.5 }],
  },
  {
    id: TechnologyId.ADVANCED_MATERIALS,
    name: "Advanced Materials",
    description: "Stronger, lighter construction materials",
    prerequisites: [],
    cost: { sols: 75 },
    unlocks: [BuildingId.RESEARCH_LAB, BuildingId.ADVANCED_HABITAT],
  },

  // MID TIER (Sol 90-200)
  {
    id: TechnologyId.ROBOTICS,
    name: "Robotics",
    description: "Automated labor and manufacturing",
    prerequisites: [TechnologyId.ADVANCED_MATERIALS],
    cost: { sols: 120 },
    unlocks: [BuildingId.AUTOMATED_FACTORY],
    effects: [{ type: "construction_speed", value: 1.2 }],
  },
  {
    id: TechnologyId.ASTEROID_MINING,
    name: "Asteroid Mining",
    description: "Extract resources from nearby asteroids",
    prerequisites: [TechnologyId.ADVANCED_MATERIALS, TechnologyId.ROBOTICS],
    cost: { sols: 150, resources: { materials: 200 } },
    unlocks: [BuildingId.MINING_STATION],
  },
  {
    id: TechnologyId.NUCLEAR_FISSION,
    name: "Nuclear Fission",
    description: "Safe nuclear power generation",
    prerequisites: [TechnologyId.ADVANCED_MATERIALS],
    cost: { sols: 180 },
    unlocks: [BuildingId.NUCLEAR_REACTOR],
  },

  // LATE TIER (Sol 200-400)
  {
    id: TechnologyId.GENETICS,
    name: "Genetic Engineering",
    description: "Modify organisms for Mars conditions",
    prerequisites: [TechnologyId.HYDROPONICS],
    cost: { sols: 200 },
    unlocks: [BuildingId.BIOLAB],
  },
  {
    id: TechnologyId.ADVANCED_MEDICINE,
    name: "Advanced Medicine",
    description: "Extend human lifespan and health",
    prerequisites: [TechnologyId.GENETICS],
    cost: { sols: 250 },
    unlocks: [BuildingId.MEDICAL_CENTER],
  },
  {
    id: TechnologyId.LIFE_EXTENSION,
    name: "Life Extension",
    description: "Double human lifespan through genetic therapy",
    prerequisites: [TechnologyId.GENETICS, TechnologyId.ADVANCED_MEDICINE],
    cost: { sols: 300 },
    unlocks: [],
  },
  {
    id: TechnologyId.CRYOSLEEP,
    name: "Cryogenic Sleep",
    description: "Suspend humans for long-duration travel",
    prerequisites: [TechnologyId.ADVANCED_MEDICINE],
    cost: { sols: 250 },
    unlocks: [BuildingId.CRYO_FACILITY],
  },

  // ENDGAME TIER (Sol 400+)
  {
    id: TechnologyId.FUSION_DRIVE,
    name: "Fusion Drive",
    description: "Propulsion system for interstellar travel",
    prerequisites: [TechnologyId.NUCLEAR_FISSION, TechnologyId.ADVANCED_MATERIALS],
    cost: { sols: 400 },
    unlocks: [],
  },
  {
    id: TechnologyId.CLOSED_ECOSYSTEM,
    name: "Closed Ecosystem",
    description: "Fully self-sustaining life support",
    prerequisites: [TechnologyId.HYDROPONICS, TechnologyId.WATER_RECYCLING, TechnologyId.GENETICS],
    cost: { sols: 350 },
    unlocks: [],
  },
  {
    id: TechnologyId.GENERATION_SHIP,
    name: "Generation Ship",
    description: "Massive vessel for interstellar colonization - VICTORY!",
    prerequisites: [TechnologyId.FUSION_DRIVE, TechnologyId.CRYOSLEEP, TechnologyId.CLOSED_ECOSYSTEM],
    cost: { sols: 500, resources: { materials: 1000 } },
    unlocks: [SpecialUnlockId.ARC_SHIP],
  },
];
