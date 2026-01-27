import { EventId, type RandomEventDefinition } from "../models/GameEvent";

export const RANDOM_EVENTS: RandomEventDefinition[] = [
  // Early immigration events to help colony reach growth threshold
  {
    id: EventId.FIRST_WAVE_SETTLERS,
    name: "First Wave Settlers",
    description:
      "A group of eager settlers who've been training for years are ready to join your colony. They've heard about your progress and want to be part of Mars history.",
    minSol: 15,
    chance: 0.12,
    weight: 10,
    choices: [
      {
        id: "welcome_settlers",
        text: "Welcome them all (8 settlers)",
        effects: {
          population: 8,
          resources: { food: -40 },
        },
      },
      {
        id: "select_skilled",
        text: "Accept only skilled workers (5 settlers)",
        effects: {
          population: 5,
        },
      },
    ],
  },
  {
    id: EventId.FAMILY_REUNIFICATION,
    name: "Family Reunification Program",
    description:
      "Earth has approved a family reunification program. Relatives of your colonists are eager to join them on Mars.",
    minSol: 30,
    chance: 0.1,
    weight: 8,
    choices: [
      {
        id: "approve_all",
        text: "Approve all applications (5 colonists)",
        effects: {
          population: 5,
          resources: { food: -25 },
        },
      },
      {
        id: "limited_approval",
        text: "Limited approval (3 colonists, they bring supplies)",
        effects: {
          population: 3,
          resources: { materials: 30 },
        },
      },
    ],
  },
  {
    id: EventId.DUST_STORM,
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
    id: EventId.METEOR_STRIKE,
    name: "Meteor Strike",
    description:
      "A meteor has impacted near the colony! Scans show it contains valuable minerals, but salvage operations carry risk.",
    minSol: 50,
    weight: 5,
    chance: 0.03,
    choices: [
      {
        id: "salvage",
        text: "Send a salvage team (risky but rewarding)",
        effects: {
          resources: { materials: 250 },
        },
      },
      {
        id: "ignore",
        text: "Too dangerous, leave it alone",
        effects: {},
      },
    ],
  },
  {
    id: EventId.DISEASE_OUTBREAK,
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
    id: EventId.EARTH_SUPPLY_SHIP,
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
    id: EventId.COLONIST_DISPUTE,
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
    id: EventId.SCIENTIFIC_DISCOVERY,
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
    id: EventId.NEW_COLONISTS,
    name: "New Colonists Arrive",
    description: "A transport ship with new colonists is requesting permission to land.",
    minSol: 40,
    chance: 0.06,
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
  // Corporate immigration events - population growth with political tradeoffs
  {
    id: EventId.CORPORATE_WORKFORCE_INITIATIVE,
    name: "Corporate Workforce Initiative",
    description:
      "Helios Corp wants to establish a presence on Mars. They're offering to send 8 skilled workers if you agree to favorable trade terms.",
    minSol: 50,
    chance: 0.04,
    weight: 6,
    choices: [
      {
        id: "accept_terms",
        text: "Accept their terms (8 workers, corporate influence)",
        effects: {
          population: 8,
          resources: { food: -40 },
          support: { corporate_interests: 15, mars_independence: -10 },
        },
      },
      {
        id: "negotiate",
        text: "Negotiate better terms (fewer workers, materials bonus)",
        effects: {
          population: 4,
          resources: { materials: 60 },
          support: { corporate_interests: 5 },
        },
      },
      {
        id: "decline",
        text: "Decline corporate involvement",
        effects: {
          support: { mars_independence: 10, corporate_interests: -5 },
        },
      },
    ],
  },
  {
    id: EventId.INDEPENDENCE_VOLUNTEERS,
    name: "Mars Independence Volunteers",
    description:
      "A group of pro-independence activists from Earth want to join your colony. They bring enthusiasm but limited supplies.",
    minSol: 80,
    chance: 0.04,
    weight: 5,
    choices: [
      {
        id: "welcome_volunteers",
        text: "Welcome them with open arms",
        effects: {
          population: 5,
          support: { mars_independence: 15, earth_loyalists: -5 },
        },
      },
      {
        id: "conditional_entry",
        text: "Accept if they contribute materials",
        effects: {
          population: 3,
          resources: { materials: 40 },
          support: { mars_independence: 5 },
        },
      },
      {
        id: "reject",
        text: "Too politically risky right now",
        effects: {
          support: { earth_loyalists: 5, mars_independence: -10 },
        },
      },
    ],
  },
  {
    id: EventId.EQUIPMENT_FAILURE,
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
  // Resource windfall events
  {
    id: EventId.ABANDONED_CACHE,
    name: "Abandoned Supply Cache",
    description:
      "Survey teams discovered a supply cache from a previous mission! The containers are intact.",
    weight: 8,
    minSol: 30,
    chance: 0.05,
    choices: [
      {
        id: "retrieve",
        text: "Retrieve the supplies",
        effects: {
          resources: { materials: 75, food: 50, water: 40 },
        },
      },
    ],
  },
  {
    id: EventId.GEOLOGICAL_SURVEY,
    name: "Earth Survey Data",
    description:
      "Mission control has transmitted new geological survey data revealing promising deposit locations.",
    weight: 6,
    minSol: 40,
    chance: 0.04,
    choices: [
      {
        id: "accept",
        text: "Update our maps with the new data",
        effects: {
          // Placeholder for future deposit reveal functionality
          resources: { materials: 50 },
        },
      },
    ],
  },
  {
    id: EventId.EQUIPMENT_WINDFALL,
    name: "Supply Ship Bonus",
    description:
      "The latest colonist transport brought extra equipment. The crew pooled their personal supplies for the colony.",
    weight: 7,
    minSol: 20,
    chance: 0.05,
    choices: [
      {
        id: "accept",
        text: "Gratefully accept the supplies",
        effects: {
          resources: { materials: 30, power: 20 },
        },
      },
    ],
  },
];
