import type { RandomEventDefinition } from "../models/GameEvent";

export const RANDOM_EVENTS: RandomEventDefinition[] = [
  {
    id: "dust_storm",
    name: "Dust Storm Warning",
    description: "A massive dust storm is approaching the colony. Solar power will be reduced.",
    minSol: 30,
    chance: 0.05,
    choices: [
      {
        id: "hunker_down",
        text: "Hunker down and wait it out",
        effects: {
          resources: { power: -50 },
        },
      },
      {
        id: "emergency_repairs",
        text: "Send engineers for emergency repairs",
        effects: {
          resources: { power: -20, materials: -30 },
        },
      },
    ],
  },
  {
    id: "meteor_strike",
    name: "Meteor Strike",
    description: "A small meteor has damaged colony infrastructure.",
    minSol: 50,
    chance: 0.03,
    choices: [
      {
        id: "repair_immediately",
        text: "Repair immediately",
        effects: {
          resources: { materials: -50 },
        },
      },
      {
        id: "salvage_meteor",
        text: "Salvage the meteor for materials",
        effects: {
          resources: { materials: 30 },
          population: -1,
        },
      },
    ],
  },
  {
    id: "disease_outbreak",
    name: "Disease Outbreak",
    description: "A mysterious illness is spreading among colonists.",
    minSol: 80,
    chance: 0.04,
    choices: [
      {
        id: "quarantine",
        text: "Quarantine affected colonists",
        effects: {
          population: -2,
        },
      },
      {
        id: "research_cure",
        text: "Divert resources to research a cure",
        effects: {
          resources: { materials: -40 },
        },
      },
    ],
  },
  {
    id: "earth_supply_ship",
    name: "Supply Ship from Earth",
    description: "An unexpected supply ship from Earth has arrived with resources.",
    minSol: 60,
    chance: 0.04,
    choices: [
      {
        id: "accept_supplies",
        text: "Accept the supplies gratefully",
        effects: {
          resources: { food: 100, materials: 50 },
          support: { earth_loyalists: 10, mars_independence: -5 },
        },
      },
      {
        id: "refuse_supplies",
        text: "Refuse to maintain independence",
        effects: {
          support: { earth_loyalists: -15, mars_independence: 15 },
        },
      },
    ],
  },
  {
    id: "colonist_dispute",
    name: "Colonist Dispute",
    description: "Factions among the colonists are arguing about resource allocation.",
    minSol: 40,
    chance: 0.06,
    choices: [
      {
        id: "favor_workers",
        text: "Side with the workers",
        effects: {
          support: { corporate_interests: -10 },
        },
      },
      {
        id: "favor_management",
        text: "Side with management",
        effects: {
          support: { corporate_interests: 10 },
        },
      },
      {
        id: "compromise",
        text: "Find a compromise",
        effects: {
          resources: { materials: -20 },
        },
      },
    ],
  },
  {
    id: "scientific_discovery",
    name: "Scientific Discovery",
    description: "Researchers have made an exciting discovery!",
    minSol: 100,
    chance: 0.03,
    choices: [
      {
        id: "publish_findings",
        text: "Publish findings openly",
        effects: {
          support: { mars_independence: 5, earth_loyalists: 5 },
        },
      },
      {
        id: "patent_technology",
        text: "Patent the technology",
        effects: {
          resources: { materials: 100 },
          support: { corporate_interests: 15 },
        },
      },
    ],
  },
  {
    id: "new_colonists",
    name: "New Colonists Arrive",
    description: "A transport ship with new colonists is requesting permission to land.",
    minSol: 70,
    chance: 0.05,
    choices: [
      {
        id: "welcome_all",
        text: "Welcome all new colonists",
        effects: {
          population: 5,
          resources: { food: -30 },
        },
      },
      {
        id: "selective_entry",
        text: "Only accept skilled workers",
        effects: {
          population: 2,
        },
      },
      {
        id: "deny_entry",
        text: "Deny entry (resources too scarce)",
        effects: {
          support: { earth_loyalists: -10 },
        },
      },
    ],
  },
  {
    id: "equipment_failure",
    name: "Critical Equipment Failure",
    description: "The main life support system is showing signs of failure.",
    minSol: 90,
    chance: 0.04,
    choices: [
      {
        id: "full_repair",
        text: "Perform full repairs",
        effects: {
          resources: { materials: -80 },
        },
      },
      {
        id: "patch_job",
        text: "Quick patch (may fail again)",
        effects: {
          resources: { materials: -20, oxygen: -30 },
        },
      },
    ],
  },
];
