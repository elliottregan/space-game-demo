import type { GameEvent } from "../models/GameEvent.js";
import type { ProjectId, RecurringEventParams } from "../models/NPCInfluence.js";

/**
 * Represents a scheduled recurring event that fires at regular intervals.
 */
export interface ScheduledEvent {
  projectId: ProjectId;
  eventType: string;
  intervalSols: number;
  nextTriggerSol: number;
  params?: Record<string, unknown>;
}

/**
 * Manages recurring events that are scheduled by project effects.
 * Events fire at regular intervals and generate GameEvents for processing.
 */
export class RecurringEventScheduler {
  private scheduled: ScheduledEvent[] = [];

  /**
   * Register a new recurring event to be scheduled.
   * The first occurrence will fire after intervalSols from the current sol.
   */
  register(projectId: ProjectId, params: RecurringEventParams, currentSol: number): void {
    const event: ScheduledEvent = {
      projectId,
      eventType: params.eventType,
      intervalSols: params.intervalSols,
      nextTriggerSol: currentSol + params.intervalSols,
      params: params.params,
    };
    this.scheduled.push(event);
  }

  /**
   * Called each game tick to check for events that should fire.
   * Returns GameEvents for any scheduled events whose trigger time has arrived.
   */
  tick(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];

    for (const scheduled of this.scheduled) {
      if (currentSol >= scheduled.nextTriggerSol) {
        events.push({
          type: "SCHEDULED_EVENT",
          message: `Scheduled ${scheduled.eventType} event triggered`,
          severity: "info",
          scheduledEventType: scheduled.eventType,
          projectId: scheduled.projectId,
          params: scheduled.params,
        });

        // Schedule the next occurrence
        scheduled.nextTriggerSol = currentSol + scheduled.intervalSols;
      }
    }

    return events;
  }

  /**
   * Get all currently scheduled events.
   */
  getScheduledEvents(): readonly ScheduledEvent[] {
    return this.scheduled;
  }

  /**
   * Remove all scheduled events for a specific project.
   */
  unregisterProject(projectId: ProjectId): void {
    this.scheduled = this.scheduled.filter((e) => e.projectId !== projectId);
  }

  /**
   * Serialize state for saving.
   */
  toJSON(): { scheduled: ScheduledEvent[] } {
    return {
      scheduled: this.scheduled.map((e) => ({ ...e })),
    };
  }

  /**
   * Restore state from saved data.
   */
  static fromJSON(data: { scheduled: ScheduledEvent[] }): RecurringEventScheduler {
    const scheduler = new RecurringEventScheduler();
    scheduler.scheduled = data.scheduled.map((e) => ({ ...e }));
    return scheduler;
  }

  /**
   * Reset all scheduled events for a new game.
   */
  reset(): void {
    this.scheduled = [];
  }
}
