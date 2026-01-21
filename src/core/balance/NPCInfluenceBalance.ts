// src/core/balance/NPCInfluenceBalance.ts

import type { NPCFaction, ProjectType } from "../models/NPCInfluence";

/** Drift rate - how quickly NPCs respond to network influence (0.1-0.5) */
export const DRIFT_RATE = 0.2;

/** Support threshold for project to pass */
export const PASS_THRESHOLD = 0.4;

/** Sols before a proposed project is voted on */
export const PROJECT_VOTE_DELAY = 10;

/** Transmission factors: how receptive target faction is to source faction for each project type */
export const TRANSMISSION_FACTORS: Record<
  ProjectType,
  Record<NPCFaction, Record<NPCFaction, number>>
> = {
  futurist: {
    futurist: { futurist: 1.0, progressive: 0.6, traditionalist: 0.2 },
    progressive: { futurist: 0.7, progressive: 1.0, traditionalist: 0.4 },
    traditionalist: { futurist: 0.3, progressive: 0.5, traditionalist: 1.0 },
  },
  progressive: {
    futurist: { futurist: 1.0, progressive: 0.5, traditionalist: 0.3 },
    progressive: { futurist: 0.6, progressive: 1.0, traditionalist: 0.6 },
    traditionalist: { futurist: 0.3, progressive: 0.5, traditionalist: 1.0 },
  },
  traditionalist: {
    futurist: { futurist: 1.0, progressive: 0.4, traditionalist: 0.2 },
    progressive: { futurist: 0.5, progressive: 1.0, traditionalist: 0.6 },
    traditionalist: { futurist: 0.3, progressive: 0.7, traditionalist: 1.0 },
  },
} as const;

/** Base lobbying cost per 0.1 support boost (in materials) */
export const LOBBY_BASE_COST = 10;

/** Cost to create a council (in materials) */
export const COUNCIL_CREATION_COST = 50;

/** Relationship boost when NPCs are in same council */
export const COUNCIL_RELATIONSHIP_BOOST = 0.2;

/** Transmission factor change on project success */
export const SUCCESS_TRANSMISSION_BOOST = 0.1;

/** Transmission factor change on project failure */
export const FAILURE_TRANSMISSION_PENALTY = -0.15;
