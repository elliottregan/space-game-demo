import {
  COLONIST_NEEDS,
  COLONY_HEALTH,
  COLONY_MORALE,
  MIN_POPULATION_FOR_GROWTH,
  POPULATION_GROWTH_RATE,
  SHORTAGE_THRESHOLDS,
} from "../balance/EconomyBaseline";
import { REFUGEE_IDEOLOGY } from "../balance/EarthCrisisBalance";
import { COLONIST_SKILL_COUNT, SOCIAL_COHESION } from "../balance/WorkforceBalance";
import { type SkillId, SKILLS } from "../data/skills";
import type { Colonist, ColonistIdeology } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import { IdeologyManager } from "./IdeologyManager";
import type { GameEvent } from "../models/GameEvent";
import { BuildingPurpose } from "../models/Building";
import type { BuildingManager } from "./BuildingManager";
import type { ResourceManager } from "./ResourceManager";
import { rng } from "../utils/random";
import type { ColonistQueries } from "../interfaces/Queries";

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

export class ColonyManager implements ColonistQueries {
  private colonists: Map<string, Colonist> = new Map();
  private nextId: number = 1;
  private health: number = 100;
  private morale: number = 80;
  private socialCohesion: number = 0;
  private isolatedColonistSols: Map<string, number> = new Map(); // colonistId -> sols isolated

  constructor(initialPopulation: number) {
    for (let i = 0; i < initialPopulation; i++) {
      this.addColonist();
    }
  }

  private assignRandomSkills(): SkillId[] {
    const skillCount = rng.int(COLONIST_SKILL_COUNT.min, COLONIST_SKILL_COUNT.max);
    const shuffled = rng.shuffled(SKILLS);
    return shuffled.slice(0, skillCount).map((s) => s.id);
  }

  tick(
    resources: ResourceManager,
    buildings?: BuildingManager,
    policyEffects?: { morale: number; health: number },
    socialCohesionData?: { cohesion: number; isolatedColonists: string[] },
  ): GameEvent[] {
    const events: GameEvent[] = [];

    this.updateConsumption(resources);
    this.tryPopulationGrowth(events);
    this.applyMoraleDecay();
    this.applyPolicyEffects(policyEffects);
    this.applyResourceShortageEffects(resources);
    this.applyPositiveConditionEffects(resources, buildings);
    this.applySocialCohesionEffects(socialCohesionData, events);
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

    if (canGrow) {
      // Scale growth rate based on health (0 bonus at 80, max bonus at 100)
      const healthBonus =
        ((this.health - COLONY_HEALTH.GROWTH_REQUIREMENT) /
          (100 - COLONY_HEALTH.GROWTH_REQUIREMENT)) *
        COLONY_HEALTH.GROWTH_BONUS_MAX;
      const adjustedGrowthRate = POPULATION_GROWTH_RATE * (1 + healthBonus);

      if (rng.chance(adjustedGrowthRate)) {
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
  }

  private applyPositiveConditionEffects(
    resources: ResourceManager,
    buildings?: BuildingManager,
  ): void {
    const netFlow = resources.getNetFlow();
    const hasPositiveFlow = (netFlow.food || 0) > 0 && (netFlow.water || 0) > 0;

    if (!hasPositiveFlow) return;

    let moraleRecovery = COLONY_MORALE.BASE_RECOVERY;
    if (buildings) {
      moraleRecovery += buildings.getTotalMoraleBoost() * 0.1;
    }

    this.morale = Math.min(100, this.morale + moraleRecovery);
    this.health = Math.min(100, this.health + COLONY_MORALE.HEALTH_RECOVERY);
  }

  private applySocialCohesionEffects(
    data?: { cohesion: number; isolatedColonists: string[] },
    events?: GameEvent[],
  ): void {
    if (!data || !events) return;

    const { cohesion, isolatedColonists } = data;
    this.socialCohesion = cohesion;

    // Apply morale effects based on cohesion level
    if (cohesion >= SOCIAL_COHESION.HIGH_THRESHOLD) {
      // High cohesion provides morale bonus
      const bonusRatio =
        (cohesion - SOCIAL_COHESION.HIGH_THRESHOLD) / (1 - SOCIAL_COHESION.HIGH_THRESHOLD);
      const moraleBonus = bonusRatio * SOCIAL_COHESION.MAX_MORALE_BONUS;
      this.morale = Math.min(100, this.morale + moraleBonus);
    } else if (cohesion < SOCIAL_COHESION.LOW_THRESHOLD) {
      // Low cohesion causes morale penalty
      const penaltyRatio =
        (SOCIAL_COHESION.LOW_THRESHOLD - cohesion) / SOCIAL_COHESION.LOW_THRESHOLD;
      const moralePenalty = penaltyRatio * SOCIAL_COHESION.MAX_MORALE_PENALTY;
      this.morale = Math.max(0, this.morale - moralePenalty);
    }

    // Check for low cohesion warning (only if we have colonists)
    if (this.colonists.size >= 5) {
      if (cohesion < SOCIAL_COHESION.CRITICAL_THRESHOLD) {
        events.push({
          type: "SOCIAL_COHESION_CRITICAL",
          cohesion,
          severity: "critical",
          message: `Colony social bonds are fracturing! Cohesion: ${Math.round(cohesion * 100)}%`,
        });
      } else if (cohesion < SOCIAL_COHESION.LOW_THRESHOLD) {
        events.push({
          type: "SOCIAL_COHESION_LOW",
          cohesion,
          severity: "warning",
          message: `Colony social cohesion is weakening: ${Math.round(cohesion * 100)}%`,
        });
      }
    }

    // Track isolated colonists and generate warnings
    const currentColonists = new Set(this.colonists.keys());

    // Clean up tracking for colonists that no longer exist
    for (const colonistId of this.isolatedColonistSols.keys()) {
      if (!currentColonists.has(colonistId)) {
        this.isolatedColonistSols.delete(colonistId);
      }
    }

    // Update isolation tracking
    for (const colonistId of currentColonists) {
      if (isolatedColonists.includes(colonistId)) {
        const solsIsolated = (this.isolatedColonistSols.get(colonistId) ?? 0) + 1;
        this.isolatedColonistSols.set(colonistId, solsIsolated);

        // Generate warning if isolated for too long
        if (solsIsolated === SOCIAL_COHESION.ISOLATION_WARNING_DELAY) {
          const colonist = this.colonists.get(colonistId);
          if (colonist) {
            events.push({
              type: "COLONIST_ISOLATED",
              colonistId,
              colonistName: colonist.name,
              solsIsolated,
              severity: "warning",
              message: `${colonist.name} has no social connections and may be struggling.`,
            });
          }
        }
      } else {
        // No longer isolated - reset counter
        this.isolatedColonistSols.delete(colonistId);
      }
    }
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
      rng.chance(COLONY_HEALTH.DEATH_CHANCE);

    if (!deathConditionsMet) return;

    const colonistArray = Array.from(this.colonists.values());
    const victim = rng.pick(colonistArray);

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

  updateConsumption(resources: ResourceManager): void {
    const population = this.colonists.size;

    // Clear previous consumption and set new based on population
    resources.removeConsumption({
      food: resources.getConsumption().food || 0,
      water: resources.getConsumption().water || 0,
      power: resources.getConsumption().power || 0,
    });

    resources.addConsumption({
      food: population * COLONIST_NEEDS.food,
      water: population * COLONIST_NEEDS.water,
      power: population * COLONIST_NEEDS.power,
    });
  }

  addColonist(name?: string, ideology?: ColonistIdeology): Colonist {
    const firstName = rng.pick(FIRST_NAMES) ?? "Unknown";
    const lastName = rng.pick(LAST_NAMES) ?? "Colonist";

    const colonist: Colonist = {
      id: `colonist_${this.nextId++}`,
      name: name || `${firstName} ${lastName}`,
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: this.assignRandomSkills(),
      ideology: ideology ?? IdeologyManager.createNeutralIdeology(),
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

  getSocialCohesion(): number {
    return this.socialCohesion;
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
        const index = rng.below(colonistArray.length);
        const colonist = colonistArray[index];
        if (colonist) {
          this.removeColonist(colonist.id);
          colonistArray.splice(index, 1);
        }
      }
    }
  }

  /**
   * Add climate refugees from Earth.
   * Refugees have Earth-leaning ideology (biased toward Earth Loyalist).
   */
  addRefugees(count: number): GameEvent[] {
    const events: GameEvent[] = [];

    for (let i = 0; i < count; i++) {
      const ideology = this.generateRefugeeIdeology();
      const colonist = this.addColonist(undefined, ideology);

      events.push({
        type: "COLONIST_ARRIVED",
        severity: "info",
        message: `Climate refugee ${colonist.name} arrived from Earth`,
        colonistId: colonist.id,
      });
    }

    return events;
  }

  private generateRefugeeIdeology(): ColonistIdeology {
    const roll = rng.random();

    if (roll < REFUGEE_IDEOLOGY.earthLoyalistWeight) {
      // Earth Loyalist leaning (60% chance)
      return {
        earthLoyalist: 0.6 + rng.random() * 0.3,
        marsIndependence: rng.random() * 0.3,
        corporateInterests: rng.random() * 0.3,
        conviction: 0.4 + rng.random() * 0.3,
      };
    } else if (roll < REFUGEE_IDEOLOGY.earthLoyalistWeight + REFUGEE_IDEOLOGY.neutralWeight) {
      // Neutral (25% chance)
      return IdeologyManager.createNeutralIdeology();
    } else {
      // Other - Mars Independence or Corporate (15% chance)
      const isMars = rng.random() > 0.5;
      return {
        earthLoyalist: rng.random() * 0.3,
        marsIndependence: isMars ? 0.5 + rng.random() * 0.3 : rng.random() * 0.3,
        corporateInterests: isMars ? rng.random() * 0.3 : 0.5 + rng.random() * 0.3,
        conviction: 0.3 + rng.random() * 0.3,
      };
    }
  }

  toJSON() {
    return {
      colonists: Array.from(this.colonists.values()),
      nextId: this.nextId,
      health: this.health,
      morale: this.morale,
      socialCohesion: this.socialCohesion,
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
      return (
        def?.capacity &&
        def.capacity > 0 &&
        def.purpose === BuildingPurpose.Residential &&
        b.status === "active"
      );
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
        const housingId = colonist.housingId;
        (assignments[housingId] ??= []).push(colonist);
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

  /**
   * Assign a colonist to a specific habitat.
   * Returns false if colonist not found, building not a habitat, or at capacity.
   */
  assignColonistToHousing(
    colonistId: string,
    buildingId: string,
    buildings: BuildingManager,
  ): boolean {
    const colonist = this.colonists.get(colonistId);
    if (!colonist) return false;

    const building = buildings.getBuilding(buildingId);
    if (!building || building.status !== "active") return false;

    const def = buildings.getDefinition(building.definitionId);
    if (!def?.capacity) return false;

    // Count current residents
    let currentCount = 0;
    for (const c of this.colonists.values()) {
      if (c.housingId === buildingId) currentCount++;
    }

    if (currentCount >= def.capacity) return false;

    colonist.housingId = buildingId;
    return true;
  }

  /**
   * Assign a colonist to a social building.
   * Returns false if building is at capacity or colonist already assigned.
   */
  assignToSocialBuilding(
    colonistId: string,
    buildingId: string,
    buildings: BuildingManager,
  ): boolean {
    const colonist = this.colonists.get(colonistId);
    if (!colonist) return false;

    // Check if already assigned to this building
    if (colonist.socialBuildingIds?.includes(buildingId)) return false;

    // Verify building exists and is a social building
    const building = buildings.getBuildings().find((b) => b.id === buildingId);
    if (!building) return false;

    const def = buildings.getDefinition(building.definitionId);
    if (!def || def.purpose !== BuildingPurpose.Social) return false;

    // Check capacity
    if (def.capacity) {
      const currentCount = this.getSocialBuildingCount(buildingId);
      if (currentCount >= def.capacity) return false;
    }

    // Add assignment
    if (!colonist.socialBuildingIds) {
      colonist.socialBuildingIds = [];
    }
    colonist.socialBuildingIds.push(buildingId);
    return true;
  }

  /**
   * Remove a colonist from a social building.
   */
  removeFromSocialBuilding(colonistId: string, buildingId: string): void {
    const colonist = this.colonists.get(colonistId);
    if (!colonist?.socialBuildingIds) return;

    const index = colonist.socialBuildingIds.indexOf(buildingId);
    if (index !== -1) {
      colonist.socialBuildingIds.splice(index, 1);
    }
  }

  /**
   * Get count of colonists assigned to a social building.
   */
  getSocialBuildingCount(buildingId: string): number {
    let count = 0;
    for (const colonist of this.colonists.values()) {
      if (colonist.socialBuildingIds?.includes(buildingId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns colonists grouped by their social building assignments.
   */
  getSocialBuildingAssignments(): Record<string, Colonist[]> {
    const assignments: Record<string, Colonist[]> = {};
    for (const colonist of this.colonists.values()) {
      if (colonist.socialBuildingIds) {
        for (const buildingId of colonist.socialBuildingIds) {
          (assignments[buildingId] ??= []).push(colonist);
        }
      }
    }
    return assignments;
  }

  /**
   * Get total housing capacity from active residential buildings.
   */
  getHousingCapacity(buildingManager: BuildingManager): number {
    let totalCapacity = 0;
    for (const building of buildingManager.getBuildings()) {
      if (building.status !== "active") continue;
      const def = buildingManager.getDefinition(building.definitionId);
      if (def?.capacity && def.capacity > 0 && def.purpose === BuildingPurpose.Residential) {
        totalCapacity += def.capacity;
      }
    }
    return totalCapacity;
  }

  static fromJSON(data: {
    colonists: Colonist[];
    nextId: number;
    health: number;
    morale: number;
    socialCohesion?: number;
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
    manager.socialCohesion = data.socialCohesion ?? 0;
    return manager;
  }
}
