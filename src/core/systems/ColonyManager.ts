import type { GameEvent } from "../models/GameEvent";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { ResourceManager } from "./ResourceManager";
import type { BuildingManager } from "./BuildingManager";
import {
  COLONIST_NEEDS,
  POPULATION_GROWTH_RATE,
  MIN_POPULATION_FOR_GROWTH,
} from "../balance/EconomyBaseline";
import { SKILLS } from "../data/skills";
import { COLONIST_SKILL_COUNT } from "../balance/WorkforceBalance";

const FIRST_NAMES = [
  "Alex",
  "Jordan",
  "Casey",
  "Riley",
  "Morgan",
  "Taylor",
  "Quinn",
  "Avery",
  "Drew",
  "Blake",
  "Sam",
  "Charlie",
  "Jamie",
  "Jesse",
  "Robin",
  "Dakota",
  "Sage",
  "Reese",
  "Skyler",
  "Hayden",
];
const LAST_NAMES = [
  "Chen",
  "Okafor",
  "Petrov",
  "Garcia",
  "Kim",
  "Williams",
  "Singh",
  "Mueller",
  "Santos",
  "Johnson",
  "Nakamura",
  "Ali",
  "Erikson",
  "Costa",
  "Zhou",
  "Thompson",
  "Patel",
  "Lee",
  "Brown",
  "Martinez",
];

export class ColonyManager {
  private colonists: Map<string, Colonist> = new Map();
  private nextId: number = 1;
  private health: number = 100;
  private morale: number = 80;

  constructor(initialPopulation: number) {
    for (let i = 0; i < initialPopulation; i++) {
      this.addColonist();
    }
  }

  private assignRandomSkills(): string[] {
    const skillCount =
      Math.floor(Math.random() * (COLONIST_SKILL_COUNT.max - COLONIST_SKILL_COUNT.min + 1)) +
      COLONIST_SKILL_COUNT.min;

    const shuffled = [...SKILLS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, skillCount).map((s) => s.id);
  }

  tick(
    resources: ResourceManager,
    buildings?: BuildingManager,
    policyEffects?: { morale: number; health: number },
  ): GameEvent[] {
    const events: GameEvent[] = [];
    const population = this.colonists.size;

    // Update colonist consumption
    this.updateConsumption(resources);

    // Check for population growth
    if (population >= MIN_POPULATION_FOR_GROWTH && this.health > 80 && this.morale > 60) {
      if (Math.random() < POPULATION_GROWTH_RATE) {
        const newColonist = this.addColonist();
        events.push({
          type: "COLONIST_BORN",
          colonistId: newColonist.id,
          colonistName: newColonist.name,
          severity: "info",
          message: `A new colonist has joined: ${newColonist.name}!`,
        });
      }
    }

    // Check for morale/health effects
    const resourceState = resources.getResources();
    const netFlow = resources.getNetFlow();

    // Base morale decay - colonists need entertainment/recreation
    const BASE_MORALE_DECAY = 0.3;
    this.morale = Math.max(0, this.morale - BASE_MORALE_DECAY);

    // Apply operations policy effects (e.g., crunch mode)
    if (policyEffects) {
      this.morale = Math.max(0, this.morale + policyEffects.morale);
      this.health = Math.max(0, Math.min(100, this.health + policyEffects.health));
    }

    // Resource shortages affect morale and health
    if (resourceState.food < population * 2) {
      this.morale = Math.max(0, this.morale - 2);
      this.health = Math.max(0, this.health - 1);
    }
    if (resourceState.oxygen < population * 2) {
      this.health = Math.max(0, this.health - 3);
    }

    // Positive conditions improve morale
    if ((netFlow.food || 0) > 0 && (netFlow.oxygen || 0) > 0 && (netFlow.water || 0) > 0) {
      let moraleRecovery = 0.5;

      // Add morale boost from recreation buildings
      if (buildings) {
        moraleRecovery += buildings.getTotalMoraleBoost() * 0.1;
      }

      this.morale = Math.min(100, this.morale + moraleRecovery);
      this.health = Math.min(100, this.health + 0.2);
    }

    // Low morale warnings
    if (this.morale < 30) {
      events.push({
        type: "MORALE_LOW",
        morale: this.morale,
        severity: "warning",
        message: `Colony morale is critically low: ${Math.floor(this.morale)}%`,
      });
    }

    // Low health warnings
    if (this.health < 50) {
      events.push({
        type: "HEALTH_LOW",
        health: this.health,
        severity: "warning",
        message: `Colony health is declining: ${Math.floor(this.health)}%`,
      });
    }

    // Check for death if health is very low
    if (this.health < 20 && population > 5 && Math.random() < 0.05) {
      const colonistArray = Array.from(this.colonists.values());
      const victim = colonistArray[Math.floor(Math.random() * colonistArray.length)];
      if (victim) {
        this.removeColonist(victim.id);
        events.push({
          type: "COLONIST_DIED",
          colonistId: victim.id,
          colonistName: victim.name,
          severity: "critical",
          message: `${victim.name} has died due to poor colony conditions.`,
        });
      }
    }

    return events;
  }

  private updateConsumption(resources: ResourceManager): void {
    const population = this.colonists.size;

    // Clear previous consumption and set new based on population
    resources.removeConsumption({
      food: resources.getConsumption().food || 0,
      oxygen: resources.getConsumption().oxygen || 0,
      water: resources.getConsumption().water || 0,
      power: resources.getConsumption().power || 0,
    });

    resources.addConsumption({
      food: population * COLONIST_NEEDS.food,
      oxygen: population * COLONIST_NEEDS.oxygen,
      water: population * COLONIST_NEEDS.water,
      power: population * COLONIST_NEEDS.power,
    });
  }

  addColonist(name?: string): Colonist {
    const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

    const colonist: Colonist = {
      id: `colonist_${this.nextId++}`,
      name: name || `${firstName} ${lastName}`,
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: this.assignRandomSkills(),
    };

    this.colonists.set(colonist.id, colonist);
    return colonist;
  }

  removeColonist(id: string): boolean {
    return this.colonists.delete(id);
  }

  getColonist(id: string): Colonist | undefined {
    return this.colonists.get(id);
  }

  getColonists(): Colonist[] {
    return Array.from(this.colonists.values());
  }

  getColonistsByRole(role: ColonistRole): Colonist[] {
    return Array.from(this.colonists.values()).filter((c) => c.role === role);
  }

  getPopulation(): number {
    return this.colonists.size;
  }

  getHealth(): number {
    return this.health;
  }

  getMorale(): number {
    return this.morale;
  }

  setHealth(value: number): void {
    this.health = Math.max(0, Math.min(100, value));
  }

  setMorale(value: number): void {
    this.morale = Math.max(0, Math.min(100, value));
  }

  adjustPopulation(delta: number): void {
    if (delta > 0) {
      for (let i = 0; i < delta; i++) {
        this.addColonist();
      }
    } else if (delta < 0) {
      const toRemove = Math.min(Math.abs(delta), this.colonists.size - 1);
      const colonistArray = Array.from(this.colonists.values());
      for (let i = 0; i < toRemove && colonistArray.length > 0; i++) {
        const index = Math.floor(Math.random() * colonistArray.length);
        const colonist = colonistArray[index];
        if (colonist) {
          this.removeColonist(colonist.id);
          colonistArray.splice(index, 1);
        }
      }
    }
  }

  toJSON() {
    return {
      colonists: Array.from(this.colonists.values()),
      nextId: this.nextId,
      health: this.health,
      morale: this.morale,
    };
  }

  static fromJSON(data: {
    colonists: Colonist[];
    nextId: number;
    health: number;
    morale: number;
  }): ColonyManager {
    const manager = new ColonyManager(0);
    data.colonists.forEach((c) => manager.colonists.set(c.id, c));
    manager.nextId = data.nextId;
    manager.health = data.health;
    manager.morale = data.morale;
    return manager;
  }
}
