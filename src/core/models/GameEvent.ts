import type { ResourceDelta } from "./Resources";

export type EventSeverity = "info" | "warning" | "critical";

export interface GameEvent {
  type: string;
  severity: EventSeverity;
  message?: string;
  [key: string]: unknown;
}

export interface RandomEventDefinition {
  id: string;
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
  eventId: string;
  triggeredAt: number;
  resolved: boolean;
}
