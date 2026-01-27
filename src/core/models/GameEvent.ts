import type { ResourceDelta } from "./Resources";

export enum EventId {
  FIRST_WAVE_SETTLERS = "first_wave_settlers",
  FAMILY_REUNIFICATION = "family_reunification",
  DUST_STORM = "dust_storm",
  METEOR_STRIKE = "meteor_strike",
  DISEASE_OUTBREAK = "disease_outbreak",
  EARTH_SUPPLY_SHIP = "earth_supply_ship",
  COLONIST_DISPUTE = "colonist_dispute",
  SCIENTIFIC_DISCOVERY = "scientific_discovery",
  NEW_COLONISTS = "new_colonists",
  CORPORATE_WORKFORCE_INITIATIVE = "corporate_workforce_initiative",
  INDEPENDENCE_VOLUNTEERS = "independence_volunteers",
  EQUIPMENT_FAILURE = "equipment_failure",
  ABANDONED_CACHE = "abandoned_cache",
  GEOLOGICAL_SURVEY = "geological_survey",
  EQUIPMENT_WINDFALL = "equipment_windfall",
  WORKER_AUTO_ASSIGNED = "worker_auto_assigned",
}

export type EventSeverity = "info" | "warning" | "critical";

export interface GameEvent {
  type: string;
  severity: EventSeverity;
  message?: string;
  [key: string]: unknown;
}

export interface RandomEventDefinition {
  id: EventId;
  name: string;
  description: string;
  minSol: number;
  maxSol?: number;
  chance: number;
  weight?: number;
  choices: EventChoice[];
}

export interface EventChoice {
  id: string;
  text: string;
  effects: {
    resources?: ResourceDelta;
    support?: Record<string, number>;
    population?: number;
  };
}

export interface ActiveEvent {
  eventId: EventId;
  triggeredAt: number;
  resolved: boolean;
}
