import {
  COLONIST_NEEDS,
  COLONY_HEALTH,
  COLONY_MORALE,
  MIN_POPULATION_FOR_GROWTH,
  POPULATION_GROWTH_RATE,
  SHORTAGE_THRESHOLDS,
} from "../balance/EconomyBaseline";
import { COLONIST_SKILL_COUNT } from "../balance/WorkforceBalance";
import { SKILLS } from "../data/skills";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { GameEvent } from "../models/GameEvent";
import type { BuildingManager } from "./BuildingManager";
import type { ResourceManager } from "./ResourceManager";

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
  "Cameron",
  "Parker",
  "Finley",
  "Rowan",
  "Emery",
  "Phoenix",
  "River",
  "Kai",
  "Micah",
  "Eden",
  "Harper",
  "Kendall",
  "Logan",
  "Peyton",
  "Remy",
  "Shiloh",
  "Tatum",
  "Wren",
  "Ash",
  "Bay",
  "Ellis",
  "Gray",
  "Jules",
  "Kit",
  "Lane",
  "Mars",
  "Nico",
  "Onyx",
  "Paz",
  "Sol",
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
  "Andersen",
  "Volkov",
  "Tanaka",
  "Okonkwo",
  "Johansson",
  "Reyes",
  "Novak",
  "Ibrahim",
  "Kowalski",
  "Fernandez",
  "Yamamoto",
  "Gupta",
  "Larsson",
  "Moreau",
  "Takahashi",
  "Mbeki",
  "Hoffman",
  "Delgado",
  "Suzuki",
  "Kumar",
  "Fischer",
  "Ortiz",
  "Watanabe",
  "Sharma",
  "Berg",
  "Cruz",
  "Ito",
  "Nair",
  "Holm",
  "Vega",
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

    this.updateConsumption(resources);
    this.tryPopulationGrowth(events);
    this.applyMoraleDecay();
    this.applyPolicyEffects(policyEffects);
    this.applyResourceShortageEffects(resources);
    this.applyPositiveConditionEffects(resources, buildings);
    this.checkLowMoraleWarning(events);
    this.checkLowHealthWarning(events);
    this.checkColonistDeath(buildings, events);

    return events;
  }

  private tryPopulationGrowth(events: GameEvent[]): void {
    const population = this.colonists.size;

    const canGrow =
      population >= MIN_POPULATION_FOR_GROWTH &&
      this.health > COLONY_HEALTH.GROWTH_REQUIREMENT &&
      this.morale > COLONY_MORALE.GROWTH_REQUIREMENT;

    if (canGrow && Math.random() < POPULATION_GROWTH_RATE) {
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

  private applyMoraleDecay(): void {
    this.morale = Math.max(0, this.morale - COLONY_MORALE.BASE_DECAY);
  }

  private applyPolicyEffects(policyEffects?: { morale: number; health: number }): void {
    if (!policyEffects) return;

    this.morale = Math.max(0, this.morale + policyEffects.morale);
    this.health = Math.max(0, Math.min(100, this.health + policyEffects.health));
  }

  private applyResourceShortageEffects(resources: ResourceManager): void {
    const resourceState = resources.getResources();
    const population = this.colonists.size;

    if (resourceState.food < population * SHORTAGE_THRESHOLDS.FOOD_MULTIPLIER) {
      this.morale = Math.max(0, this.morale - SHORTAGE_THRESHOLDS.FOOD_MORALE_PENALTY);
      this.health = Math.max(0, this.health - SHORTAGE_THRESHOLDS.FOOD_HEALTH_PENALTY);
    }

    if (resourceState.oxygen < population * SHORTAGE_THRESHOLDS.OXYGEN_MULTIPLIER) {
      this.health = Math.max(0, this.health - SHORTAGE_THRESHOLDS.OXYGEN_HEALTH_PENALTY);
    }
  }

  private applyPositiveConditionEffects(
    resources: ResourceManager,
    buildings?: BuildingManager,
  ): void {
    const netFlow = resources.getNetFlow();
    const hasPositiveFlow =
      (netFlow.food || 0) > 0 && (netFlow.oxygen || 0) > 0 && (netFlow.water || 0) > 0;

    if (!hasPositiveFlow) return;

    let moraleRecovery = COLONY_MORALE.BASE_RECOVERY;
    if (buildings) {
      moraleRecovery += buildings.getTotalMoraleBoost() * 0.1;
    }

    this.morale = Math.min(100, this.morale + moraleRecovery);
    this.health = Math.min(100, this.health + COLONY_MORALE.HEALTH_RECOVERY);
  }

  private checkLowMoraleWarning(events: GameEvent[]): void {
    if (this.morale < COLONY_MORALE.LOW_WARNING_THRESHOLD) {
      events.push({
        type: "MORALE_LOW",
        morale: this.morale,
        severity: "warning",
        message: `Colony morale is critically low: ${Math.floor(this.morale)}%`,
      });
    }
  }

  private checkLowHealthWarning(events: GameEvent[]): void {
    if (this.health < COLONY_HEALTH.LOW_WARNING_THRESHOLD) {
      events.push({
        type: "HEALTH_LOW",
        health: this.health,
        severity: "warning",
        message: `Colony health is declining: ${Math.floor(this.health)}%`,
      });
    }
  }

  private checkColonistDeath(buildings: BuildingManager | undefined, events: GameEvent[]): void {
    const population = this.colonists.size;

    const deathConditionsMet =
      this.health < COLONY_HEALTH.DEATH_RISK_THRESHOLD &&
      population > COLONY_HEALTH.MIN_POPULATION_FOR_DEATH &&
      Math.random() < COLONY_HEALTH.DEATH_CHANCE;

    if (!deathConditionsMet) return;

    const colonistArray = Array.from(this.colonists.values());
    const victim = colonistArray[Math.floor(Math.random() * colonistArray.length)];

    if (victim) {
      this.removeColonist(victim.id, buildings);
      events.push({
        type: "COLONIST_DIED",
        colonistId: victim.id,
        colonistName: victim.name,
        severity: "critical",
        message: `${victim.name} has died due to poor colony conditions.`,
      });
    }
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

  removeColonist(id: string, buildings?: BuildingManager): boolean {
    const colonist = this.colonists.get(id);
    if (!colonist) return false;

    // Remove from any building assignments
    if (buildings) {
      for (const building of buildings.getBuildings()) {
        buildings.removeWorker(building.id, id);
      }
    }

    // Clear housing assignment
    if (colonist.housingId) {
      colonist.housingId = undefined;
    }

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

  /**
   * Assigns unhoused colonists to available habitats with capacity.
   * Already-housed colonists are not reassigned.
   * Clears housing for colonists in non-existent or inactive habitats.
   */
  assignHousing(buildingManager: BuildingManager): void {
    const habitats = buildingManager.getBuildings().filter((b) => {
      const def = buildingManager.getDefinition(b.definitionId);
      return def?.capacity && def.capacity > 0 && b.status === "active";
    });

    // Clear housing for colonists in non-existent or inactive habitats
    const validHabitatIds = new Set(habitats.map((h) => h.id));
    for (const colonist of this.colonists.values()) {
      if (colonist.housingId && !validHabitatIds.has(colonist.housingId)) {
        colonist.housingId = undefined;
      }
    }

    // Get current housing counts per habitat
    const housingCounts = new Map<string, number>();
    for (const habitat of habitats) {
      housingCounts.set(habitat.id, 0);
    }

    // Count currently housed colonists
    for (const colonist of this.colonists.values()) {
      if (colonist.housingId && housingCounts.has(colonist.housingId)) {
        housingCounts.set(colonist.housingId, (housingCounts.get(colonist.housingId) || 0) + 1);
      }
    }

    // Assign unhoused colonists to available habitats
    for (const colonist of this.colonists.values()) {
      if (colonist.housingId) continue; // Already housed

      for (const habitat of habitats) {
        const def = buildingManager.getDefinition(habitat.definitionId);
        const currentCount = housingCounts.get(habitat.id) || 0;
        if (def?.capacity && currentCount < def.capacity) {
          colonist.housingId = habitat.id;
          housingCounts.set(habitat.id, currentCount + 1);
          break;
        }
      }
    }
  }

  /**
   * Returns all colonists without housing assignments.
   */
  getUnhousedColonists(): Colonist[] {
    return Array.from(this.colonists.values()).filter((c) => !c.housingId);
  }

  /**
   * Returns colonists grouped by their housing assignment (habitat ID).
   */
  getHousingAssignments(): Record<string, Colonist[]> {
    const assignments: Record<string, Colonist[]> = {};
    for (const colonist of this.colonists.values()) {
      if (colonist.housingId) {
        if (!assignments[colonist.housingId]) {
          assignments[colonist.housingId] = [];
        }
        assignments[colonist.housingId].push(colonist);
      }
    }
    return assignments;
  }

  /**
   * Clears the housing assignment for a specific colonist.
   */
  clearHousingAssignment(colonistId: string): void {
    const colonist = this.colonists.get(colonistId);
    if (colonist) {
      colonist.housingId = undefined;
    }
  }

  static fromJSON(data: {
    colonists: Colonist[];
    nextId: number;
    health: number;
    morale: number;
  }): ColonyManager {
    const manager = new ColonyManager(0);
    data.colonists.forEach((c) => {
      // Handle backwards compatibility for saves without skills
      if (!c.skills) {
        c.skills = [];
      }
      manager.colonists.set(c.id, c);
    });
    manager.nextId = data.nextId;
    manager.health = data.health;
    manager.morale = data.morale;
    return manager;
  }
}
