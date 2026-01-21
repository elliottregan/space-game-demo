import type {
  GameEvent,
  RandomEventDefinition,
  ActiveEvent,
  EventChoice,
} from "../models/GameEvent";
import type { ResourceManager } from "./ResourceManager";
import type { ColonyManager } from "./ColonyManager";
import type { PoliticsEngine } from "./PoliticsEngine";
import { EVENT_TIMING } from "../balance/EventBalance";

export class EventManager {
  private eventDefinitions: Map<string, RandomEventDefinition> = new Map();
  private activeEvent: ActiveEvent | null = null;
  private lastEventSol: number = 0;
  private resolvedEvents: string[] = [];

  constructor(events: RandomEventDefinition[]) {
    events.forEach((e) => this.eventDefinitions.set(e.id, e));
  }

  tick(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];

    // Don't trigger new events if one is active
    if (this.activeEvent) return events;

    // Check timing constraints
    const solsSinceLastEvent = currentSol - this.lastEventSol;
    if (solsSinceLastEvent < EVENT_TIMING.minSolsBetween) return events;

    // Check for random event
    const eventChance = EVENT_TIMING.getEventChance(currentSol);
    if (Math.random() < eventChance) {
      const eligibleEvents = this.getEligibleEvents(currentSol);
      const selected = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
      if (selected) {
        this.activeEvent = {
          eventId: selected.id,
          triggeredAt: currentSol,
          resolved: false,
        };

        events.push({
          type: "RANDOM_EVENT_TRIGGERED",
          eventId: selected.id,
          eventName: selected.name,
          severity: "warning",
          message: selected.description,
        });
      }
    }

    return events;
  }

  private getEligibleEvents(currentSol: number): RandomEventDefinition[] {
    return Array.from(this.eventDefinitions.values()).filter((event) => {
      if (currentSol < event.minSol) return false;
      if (event.maxSol && currentSol > event.maxSol) return false;
      return true;
    });
  }

  resolveEvent(
    choiceId: string,
    resources: ResourceManager,
    colony: ColonyManager,
    politics: PoliticsEngine,
  ): GameEvent[] {
    const events: GameEvent[] = [];

    if (!this.activeEvent) return events;

    const eventDef = this.eventDefinitions.get(this.activeEvent.eventId);
    if (!eventDef) return events;

    const choice = eventDef.choices.find((c) => c.id === choiceId);
    if (!choice) return events;

    // Apply choice effects
    if (choice.effects.resources) {
      for (const [resource, amount] of Object.entries(choice.effects.resources)) {
        if (amount && amount < 0) {
          resources.deduct({ [resource]: Math.abs(amount) });
        } else if (amount && amount > 0) {
          resources.add({ [resource]: amount });
        }
      }
    }

    if (choice.effects.population) {
      colony.adjustPopulation(choice.effects.population);
    }

    if (choice.effects.support) {
      for (const [factionId, amount] of Object.entries(choice.effects.support)) {
        politics.adjustSupport(factionId, amount);
      }
    }

    events.push({
      type: "EVENT_RESOLVED",
      eventId: this.activeEvent.eventId,
      eventName: eventDef.name,
      choiceId,
      choiceText: choice.text,
      severity: "info",
      message: `Resolved: ${eventDef.name} - ${choice.text}`,
    });

    this.resolvedEvents.push(this.activeEvent.eventId);
    this.lastEventSol = this.activeEvent.triggeredAt;
    this.activeEvent = null;

    return events;
  }

  getActiveEvent(): { definition: RandomEventDefinition; active: ActiveEvent } | null {
    if (!this.activeEvent) return null;

    const definition = this.eventDefinitions.get(this.activeEvent.eventId);
    if (!definition) return null;

    return {
      definition,
      active: { ...this.activeEvent },
    };
  }

  hasActiveEvent(): boolean {
    return this.activeEvent !== null;
  }

  getEventChoices(): EventChoice[] {
    if (!this.activeEvent) return [];

    const definition = this.eventDefinitions.get(this.activeEvent.eventId);
    return definition?.choices || [];
  }

  toJSON() {
    return {
      activeEvent: this.activeEvent,
      lastEventSol: this.lastEventSol,
      resolvedEvents: this.resolvedEvents,
    };
  }

  static fromJSON(
    data: { activeEvent: ActiveEvent | null; lastEventSol: number; resolvedEvents: string[] },
    events: RandomEventDefinition[],
  ): EventManager {
    const manager = new EventManager(events);
    manager.activeEvent = data.activeEvent;
    manager.lastEventSol = data.lastEventSol;
    manager.resolvedEvents = data.resolvedEvents;
    return manager;
  }
}
