// src/core/systems/EarthCrisisManager.ts

import type { EarthClimateCrisis, CrisisEffect, CrisisThreshold } from "../models/EarthCrisis.js";
import { EARTH_CRISIS_BALANCE, EARTH_CRISIS_THRESHOLDS } from "../balance/EarthCrisisBalance.js";
import type { GameEvent } from "../models/GameEvent.js";

export interface EarthCrisisEffect extends GameEvent {
  type: "refugee_wave" | "earth_collapse";
  params?: Record<string, unknown>;
}

export class EarthCrisisManager {
  private state: EarthClimateCrisis;
  private triggeredThresholds: Set<number> = new Set();
  private lastRepeatSol: Map<number, number> = new Map();

  constructor() {
    this.state = {
      severity: EARTH_CRISIS_BALANCE.startingSeverity,
      pointOfNoReturn: false,
    };
  }

  tick(currentSol: number): EarthCrisisEffect[] {
    if (this.state.pointOfNoReturn) {
      return [];
    }

    const effects: EarthCrisisEffect[] = [];

    // Increase severity
    this.state.severity = Math.min(100, this.state.severity + EARTH_CRISIS_BALANCE.severityPerSol);

    // Check thresholds and apply effects
    for (const threshold of EARTH_CRISIS_THRESHOLDS) {
      if (this.shouldTrigger(threshold, currentSol)) {
        effects.push(...this.applyEffects(threshold.effects));
        this.markTriggered(threshold, currentSol);
      }
    }

    // Check point of no return
    if (this.state.severity >= 100 && !this.state.pointOfNoReturn) {
      this.state.pointOfNoReturn = true;
      effects.push({
        type: "earth_collapse",
        severity: "critical",
        message: "Earth's climate has collapsed. Victory is no longer possible.",
      });
    }

    return effects;
  }

  private shouldTrigger(threshold: CrisisThreshold, currentSol: number): boolean {
    // Haven't reached this severity yet
    if (this.state.severity < threshold.severity) {
      return false;
    }

    // Non-repeatable and already triggered
    if (!threshold.repeatable && this.triggeredThresholds.has(threshold.severity)) {
      return false;
    }

    // Repeatable - check interval
    if (threshold.repeatable) {
      const lastSol = this.lastRepeatSol.get(threshold.severity);
      if (lastSol !== undefined) {
        const interval = threshold.repeatInterval ?? 100;
        if (currentSol - lastSol < interval) {
          return false;
        }
      }
    }

    return true;
  }

  private markTriggered(threshold: CrisisThreshold, currentSol: number): void {
    this.triggeredThresholds.add(threshold.severity);
    if (threshold.repeatable) {
      this.lastRepeatSol.set(threshold.severity, currentSol);
    }
  }

  private applyEffects(effects: CrisisEffect[]): EarthCrisisEffect[] {
    const result: EarthCrisisEffect[] = [];

    for (const effect of effects) {
      if (effect.type === "refugee_wave") {
        result.push({
          type: "refugee_wave",
          severity: "info",
          message: "Climate refugees arriving from Earth",
          params: effect.params,
        });
      }
      // political_instability scaffolded but not implemented
    }

    return result;
  }

  getState(): EarthClimateCrisis {
    return { ...this.state };
  }

  isPointOfNoReturn(): boolean {
    return this.state.pointOfNoReturn;
  }

  getSeverity(): number {
    return this.state.severity;
  }

  toJSON(): {
    severity: number;
    pointOfNoReturn: boolean;
    triggeredThresholds: number[];
    lastRepeatSol: Record<number, number>;
  } {
    return {
      severity: this.state.severity,
      pointOfNoReturn: this.state.pointOfNoReturn,
      triggeredThresholds: Array.from(this.triggeredThresholds),
      lastRepeatSol: Object.fromEntries(this.lastRepeatSol),
    };
  }

  static fromJSON(data: {
    severity: number;
    pointOfNoReturn: boolean;
    triggeredThresholds: number[];
    lastRepeatSol: Record<number, number>;
  }): EarthCrisisManager {
    const manager = new EarthCrisisManager();
    manager.state.severity = data.severity;
    manager.state.pointOfNoReturn = data.pointOfNoReturn;
    manager.triggeredThresholds = new Set(data.triggeredThresholds);
    manager.lastRepeatSol = new Map(
      Object.entries(data.lastRepeatSol).map(([k, v]) => [Number(k), v]),
    );
    return manager;
  }
}
