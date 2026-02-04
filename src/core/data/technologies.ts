import { BuildingId } from "../models/Building";
import { type Technology, TechnologyId } from "../models/Technology";

export const TECHNOLOGIES: Technology[] = [
  // EARLY TIER (Sol 30-90)
  {
    id: TechnologyId.HYDROPONICS,
    name: "Hydroponics",
    description: "Advanced soil-free farming techniques",
    prerequisites: [],
    cost: { sols: 45 },
    unlocks: [BuildingId.GREENHOUSE],
  },
  {
    id: TechnologyId.WATER_RECYCLING,
    name: "Water Recycling",
    description: "Closed-loop water systems",
    prerequisites: [],
    cost: { sols: 35 },
    unlocks: [BuildingId.WATER_RECLAIMER],
    effects: [{ type: "production_bonus", value: 0.5 }],
  },
  {
    id: TechnologyId.HABITAT_FABRICATION,
    name: "Habitat Fabrication",
    description: "Prefabricated modular habitat construction techniques",
    prerequisites: [],
    cost: { sols: 55 },
    unlocks: [BuildingId.RESEARCH_LAB, BuildingId.ADVANCED_HABITAT],
  },

  // MID TIER (Sol 90-200)
  {
    id: TechnologyId.ROBOTICS,
    name: "Robotics",
    description: "Automated labor and manufacturing",
    prerequisites: [TechnologyId.HABITAT_FABRICATION],
    cost: { sols: 85 },
    unlocks: [BuildingId.AUTOMATED_FACTORY],
    effects: [
      { type: "construction_speed", value: 1.2 },
      { type: "mining_efficiency", value: 1 },
    ],
  },
  {
    id: TechnologyId.ASTEROID_MINING,
    name: "Asteroid Mining",
    description: "Extract resources from nearby asteroids",
    prerequisites: [TechnologyId.HABITAT_FABRICATION, TechnologyId.ROBOTICS],
    cost: { sols: 150, resources: { materials: 200 } },
    unlocks: [BuildingId.MINING_STATION],
  },
  {
    id: TechnologyId.NUCLEAR_FISSION,
    name: "Nuclear Fission",
    description: "Safe nuclear power generation",
    prerequisites: [TechnologyId.HABITAT_FABRICATION],
    cost: { sols: 115 },
    unlocks: [BuildingId.NUCLEAR_REACTOR],
  },

  // LATE TIER (Sol 200-400)
  {
    id: TechnologyId.GENETICS,
    name: "Genetic Engineering",
    description: "Modify organisms for Mars conditions",
    prerequisites: [TechnologyId.HYDROPONICS],
    cost: { sols: 130 },
    unlocks: [BuildingId.BIOLAB],
  },
  {
    id: TechnologyId.ADVANCED_MEDICINE,
    name: "Advanced Medicine",
    description: "Extend human lifespan and health",
    prerequisites: [TechnologyId.GENETICS],
    cost: { sols: 160 },
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
    cost: { sols: 160 },
    unlocks: [BuildingId.CRYO_FACILITY],
  },

  // ENDGAME TIER (Sol 400+)
  {
    id: TechnologyId.FUSION_DRIVE,
    name: "Fusion Drive",
    description: "Propulsion system for interstellar travel",
    prerequisites: [TechnologyId.NUCLEAR_FISSION, TechnologyId.HABITAT_FABRICATION],
    cost: { sols: 255 },
    unlocks: [],
  },
  {
    id: TechnologyId.CLOSED_ECOSYSTEM,
    name: "Closed Ecosystem",
    description: "Fully self-sustaining life support",
    prerequisites: [TechnologyId.HYDROPONICS, TechnologyId.WATER_RECYCLING, TechnologyId.GENETICS],
    cost: { sols: 225 },
    unlocks: [],
  },
  {
    id: TechnologyId.ASTEROID_MINING_PLATFORM,
    name: "Asteroid Mining Platform",
    description:
      "Orbital station for capturing and processing asteroids - enables resource dominance",
    prerequisites: [TechnologyId.ASTEROID_MINING, TechnologyId.ROBOTICS],
    cost: { sols: 280, resources: { materials: 400 } },
    unlocks: [],
  },
];
