import type { GameEvent } from "../models/GameEvent";
import type { Faction, Decision, DecisionResult, FactionImpact } from "../models/Politics";
import type { ResourceManager } from "./ResourceManager";
import { SUPPORT_DECAY_RATE, SUPPORT_THRESHOLDS } from "../balance/PoliticsBalance";

export class PoliticsEngine {
  private factions: Map<string, Faction> = new Map();
  private decisions: Map<string, Decision> = new Map();

  constructor(factions: Faction[], decisions: Decision[] = []) {
    factions.forEach((f) => this.factions.set(f.id, { ...f }));
    decisions.forEach((d) => this.decisions.set(d.id, d));
  }

  tick(): GameEvent[] {
    const events: GameEvent[] = [];

    for (const faction of this.factions.values()) {
      // Natural support decay
      faction.support = Math.max(0, faction.support - SUPPORT_DECAY_RATE);

      if (
        faction.support < SUPPORT_THRESHOLDS.UNREST &&
        faction.support >= SUPPORT_THRESHOLDS.HOSTILE
      ) {
        events.push({
          type: "FACTION_UNREST",
          factionId: faction.id,
          factionName: faction.name,
          severity: "warning",
          support: faction.support,
          message: `${faction.name} support is dangerously low: ${Math.floor(faction.support)}%`,
        });
      }

      if (faction.support < SUPPORT_THRESHOLDS.HOSTILE) {
        events.push({
          type: "FACTION_HOSTILE",
          factionId: faction.id,
          factionName: faction.name,
          severity: "critical",
          support: faction.support,
          message: `${faction.name} has become hostile!`,
        });
      }
    }

    return events;
  }

  makeDecision(decision: Decision, resources: ResourceManager): DecisionResult {
    const impacts: FactionImpact[] = [];

    // Calculate impact on each faction
    for (const faction of this.factions.values()) {
      const impact = this.calculateImpact(decision, faction);

      faction.support = Math.max(0, Math.min(100, faction.support + impact));

      impacts.push({
        factionId: faction.id,
        change: impact,
        newSupport: faction.support,
      });
    }

    // Apply resource effects
    if (decision.effects?.resources) {
      for (const [resource, amount] of Object.entries(decision.effects.resources)) {
        if (amount && amount < 0) {
          resources.deduct({ [resource]: Math.abs(amount) });
        } else if (amount && amount > 0) {
          resources.add({ [resource]: amount });
        }
      }
    }

    return {
      success: this.hasMinimumSupport(decision.requiredSupport),
      impacts,
    };
  }

  private calculateImpact(decision: Decision, faction: Faction): number {
    let impact = 0;

    for (const priority of faction.priorities) {
      const alignment = decision.tags[priority.concern] || 0;
      const multiplier = 1 / priority.weight;
      impact += alignment * multiplier * 0.1;
    }

    return Math.round(impact);
  }

  adjustSupport(factionId: string, amount: number): void {
    const faction = this.factions.get(factionId);
    if (faction) {
      faction.support = Math.max(0, Math.min(100, faction.support + amount));
    }
  }

  hasMinimumSupport(threshold: number): boolean {
    return this.getAverageSupport() >= threshold;
  }

  getAverageSupport(): number {
    const factions = Array.from(this.factions.values());
    if (factions.length === 0) return 0;

    return factions.reduce((sum, f) => sum + f.support, 0) / factions.length;
  }

  getFaction(id: string): Faction | undefined {
    const faction = this.factions.get(id);
    return faction ? { ...faction } : undefined;
  }

  getFactions(): Faction[] {
    return Array.from(this.factions.values()).map((f) => ({ ...f }));
  }

  getDecision(id: string): Decision | undefined {
    return this.decisions.get(id);
  }

  getAvailableDecisions(): Decision[] {
    return Array.from(this.decisions.values());
  }

  toJSON() {
    return {
      factions: Array.from(this.factions.values()),
    };
  }

  static fromJSON(data: { factions: Faction[] }, decisions: Decision[]): PoliticsEngine {
    const engine = new PoliticsEngine(data.factions, decisions);
    return engine;
  }
}
