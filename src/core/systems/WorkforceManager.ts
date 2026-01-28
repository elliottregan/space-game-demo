import {
  COWORKER_BONDING_RATE,
  COWORKER_RELATIONSHIP_DECAY,
  EXPERIENCE_GAIN_RATE,
  HOUSEMATE_BONDING_RATE,
  INITIAL_COWORKER_RELATIONSHIP,
  INITIAL_HOUSEMATE_RELATIONSHIP,
  MASTER_EVENT_CHANCE,
  MASTERY_EFFICIENCY,
  MASTERY_THRESHOLDS,
  MAX_COWORKER_RELATIONSHIP,
  MAX_SKILL_EFFICIENCY_BONUS,
  MAX_TEAM_COHESION_BONUS,
  MIN_COWORKER_RELATIONSHIP,
  ROLE_AFFINITY,
  TEAM_COHESION_THRESHOLD,
} from "../balance/WorkforceBalance";
import { SKILLS } from "../data/skills";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { GameEvent } from "../models/GameEvent";
import type { BuildingManager } from "./BuildingManager";
import type { ColonyManager } from "./ColonyManager";

/**
 * Tracks a relationship between two colonists.
 */
export interface CoworkerRelationship {
  /** Strength of the relationship (0-1) */
  strength: number;
  /** Sol when they first worked together */
  formedAt: number;
  /** Sol when they last worked together */
  lastWorkedTogether: number;
}

export class WorkforceManager {
  /** Tracks relationships between colonists (key: "colonistId1:colonistId2" sorted alphabetically) */
  private coworkerRelationships: Map<string, CoworkerRelationship> = new Map();

  tick(colony: ColonyManager, buildings?: BuildingManager, currentSol: number = 0): GameEvent[] {
    const events: GameEvent[] = [];
    const colonists = colony.getColonists();

    // Process coworker and housemate bonding
    if (buildings) {
      events.push(...this.processCoworkerBonding(buildings, currentSol));
      events.push(...this.processHousemateBonding(colonists, currentSol));
    }

    for (const colonist of colonists) {
      // Handle training
      if (colonist.trainingTarget && colonist.trainingProgress !== undefined) {
        colonist.trainingProgress++;
        const requiredTime = this.getTrainingTime(colonist.role, colonist.trainingTarget);

        if (colonist.trainingProgress >= requiredTime) {
          const oldRole = colonist.role;
          colonist.role = colonist.trainingTarget;
          colonist.trainingTarget = undefined;
          colonist.trainingProgress = undefined;
          colonist.experience = 0;
          colonist.masteryLevel = MasteryLevel.NOVICE;

          events.push({
            type: "TRAINING_COMPLETE",
            colonistId: colonist.id,
            colonistName: colonist.name,
            oldRole,
            newRole: colonist.role,
            severity: "info",
            message: `${colonist.name} is now trained as ${this.getRoleName(colonist.role)}!`,
          });
        }
      }

      // Handle experience gain for working colonists
      if (colonist.role !== ColonistRole.UNASSIGNED && !colonist.trainingTarget) {
        colonist.experience += EXPERIENCE_GAIN_RATE;

        // Check for mastery level up
        const newLevel = this.calculateMasteryLevel(colonist.experience);
        if (newLevel > colonist.masteryLevel) {
          colonist.masteryLevel = newLevel;
          events.push({
            type: "MASTERY_GAINED",
            colonistId: colonist.id,
            colonistName: colonist.name,
            role: colonist.role,
            newLevel: this.getMasteryName(newLevel),
            severity: "info",
            message: `${colonist.name} is now a ${this.getMasteryName(newLevel)} ${this.getRoleName(colonist.role)}!`,
          });
        }

        // Master event chance
        if (colonist.masteryLevel === MasteryLevel.MASTER && Math.random() < MASTER_EVENT_CHANCE) {
          events.push({
            type: "MASTER_BREAKTHROUGH",
            colonistId: colonist.id,
            colonistName: colonist.name,
            role: colonist.role,
            severity: "info",
            message: `${colonist.name} made a breakthrough in ${this.getRoleName(colonist.role)}!`,
          });
        }
      }
    }

    return events;
  }

  startTraining(colonist: Colonist, targetRole: ColonistRole): boolean {
    if (colonist.role === targetRole) return false;
    if (colonist.trainingTarget) return false;
    if (targetRole === ColonistRole.UNASSIGNED) return false;

    colonist.trainingTarget = targetRole;
    colonist.trainingProgress = 0;
    return true;
  }

  cancelTraining(colonist: Colonist): void {
    colonist.trainingTarget = undefined;
    colonist.trainingProgress = undefined;
  }

  getTrainingTime(currentRole: ColonistRole, targetRole: ColonistRole): number {
    const affinities = ROLE_AFFINITY[currentRole];
    return affinities?.[targetRole] || 10;
  }

  calculateMasteryLevel(experience: number): MasteryLevel {
    if (experience >= MASTERY_THRESHOLDS.MASTER) return MasteryLevel.MASTER;
    if (experience >= MASTERY_THRESHOLDS.EXPERT) return MasteryLevel.EXPERT;
    if (experience >= MASTERY_THRESHOLDS.SKILLED) return MasteryLevel.SKILLED;
    return MasteryLevel.NOVICE;
  }

  getRoleName(role: ColonistRole): string {
    switch (role) {
      case ColonistRole.UNASSIGNED:
        return "Unassigned";
      case ColonistRole.RESEARCH:
        return "Researcher";
      case ColonistRole.ENGINEERING:
        return "Engineer";
      case ColonistRole.CIVIL_SCIENCE:
        return "Civil Scientist";
      case ColonistRole.FARMING:
        return "Farmer";
    }
  }

  getMasteryName(level: MasteryLevel): string {
    switch (level) {
      case MasteryLevel.NOVICE:
        return "Novice";
      case MasteryLevel.SKILLED:
        return "Skilled";
      case MasteryLevel.EXPERT:
        return "Expert";
      case MasteryLevel.MASTER:
        return "Master";
    }
  }

  getWorkforceStats(colony: ColonyManager): Record<ColonistRole, number> {
    const stats: Record<ColonistRole, number> = {
      [ColonistRole.UNASSIGNED]: 0,
      [ColonistRole.RESEARCH]: 0,
      [ColonistRole.ENGINEERING]: 0,
      [ColonistRole.CIVIL_SCIENCE]: 0,
      [ColonistRole.FARMING]: 0,
    };

    for (const colonist of colony.getColonists()) {
      stats[colonist.role]++;
    }

    return stats;
  }

  /**
   * Calculate the total efficiency multiplier for a colonist.
   * Combines mastery level bonus with skill bonuses (capped).
   */
  getColonistEfficiency(colonist: Colonist): number {
    const masteryEfficiency = MASTERY_EFFICIENCY[colonist.masteryLevel];

    let skillBonus = 0;
    for (const skillId of colonist.skills) {
      const skill = SKILLS.find((s) => s.id === skillId);
      if (skill?.affinity.includes(colonist.role)) {
        skillBonus += skill.efficiencyBonus;
      }
    }

    // Cap skill bonus
    skillBonus = Math.min(skillBonus, MAX_SKILL_EFFICIENCY_BONUS);

    return (masteryEfficiency ?? 1.0) + skillBonus;
  }

  /**
   * Find the building where a colonist is assigned to work.
   * Returns undefined if colonist is not assigned to any building.
   */
  getColonistWorkplace(colonistId: string, buildings: BuildingManager): string | undefined {
    for (const building of buildings.getBuildings()) {
      if (building.assignedWorkers.includes(colonistId)) {
        return building.id;
      }
    }
    return undefined;
  }

  // ============ Coworker Relationship System ============

  /**
   * Generate a canonical key for a pair of colonists (alphabetically sorted).
   */
  private getRelationshipKey(colonistId1: string, colonistId2: string): string {
    return colonistId1 < colonistId2
      ? `${colonistId1}:${colonistId2}`
      : `${colonistId2}:${colonistId1}`;
  }

  /**
   * Get the relationship between two colonists.
   * Returns undefined if they have never worked together.
   */
  getCoworkerRelationship(colonistId1: string, colonistId2: string): CoworkerRelationship | undefined {
    const key = this.getRelationshipKey(colonistId1, colonistId2);
    return this.coworkerRelationships.get(key);
  }

  /**
   * Get the relationship strength between two colonists (0 if no relationship).
   */
  getCoworkerRelationshipStrength(colonistId1: string, colonistId2: string): number {
    const relationship = this.getCoworkerRelationship(colonistId1, colonistId2);
    return relationship?.strength ?? 0;
  }

  /**
   * Process coworker bonding for all buildings.
   * Colonists working together in the same building develop stronger relationships.
   */
  private processCoworkerBonding(buildings: BuildingManager, currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const currentCoworkerPairs = new Set<string>();

    // For each building, bond colonists who work together
    for (const building of buildings.getBuildings()) {
      if (building.status !== "active" || building.assignedWorkers.length < 2) continue;

      // Create/strengthen bonds between all pairs of coworkers
      for (let i = 0; i < building.assignedWorkers.length; i++) {
        const colonistA = building.assignedWorkers[i];
        if (!colonistA) continue;

        for (let j = i + 1; j < building.assignedWorkers.length; j++) {
          const colonistB = building.assignedWorkers[j];
          if (!colonistB) continue;

          const key = this.getRelationshipKey(colonistA, colonistB);
          currentCoworkerPairs.add(key);

          let relationship = this.coworkerRelationships.get(key);

          if (!relationship) {
            // First time working together
            relationship = {
              strength: INITIAL_COWORKER_RELATIONSHIP,
              formedAt: currentSol,
              lastWorkedTogether: currentSol,
            };
            this.coworkerRelationships.set(key, relationship);

            events.push({
              type: "COWORKER_BOND_FORMED",
              severity: "info",
              colonistA,
              colonistB,
              buildingId: building.id,
              message: `New coworker bond formed at ${building.id}`,
            });
          } else {
            // Strengthen existing relationship
            relationship.strength = Math.min(
              MAX_COWORKER_RELATIONSHIP,
              relationship.strength + COWORKER_BONDING_RATE,
            );
            relationship.lastWorkedTogether = currentSol;
          }
        }
      }
    }

    // Decay relationships for colonists not currently working together
    for (const [key, relationship] of this.coworkerRelationships.entries()) {
      if (!currentCoworkerPairs.has(key)) {
        relationship.strength = Math.max(
          MIN_COWORKER_RELATIONSHIP,
          relationship.strength - COWORKER_RELATIONSHIP_DECAY,
        );

        // Remove very weak relationships
        if (relationship.strength <= MIN_COWORKER_RELATIONSHIP) {
          // Keep the relationship but at minimum strength
        }
      }
    }

    return events;
  }

  /**
   * Process housemate bonding for all colonists sharing housing.
   * Colonists living together develop stronger relationships.
   */
  private processHousemateBonding(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const currentHousematePairs = new Set<string>();

    // Group colonists by housing
    const housingGroups = new Map<string, Colonist[]>();
    for (const colonist of colonists) {
      if (colonist.housingId) {
        const group = housingGroups.get(colonist.housingId) || [];
        group.push(colonist);
        housingGroups.set(colonist.housingId, group);
      }
    }

    // Bond colonists who share housing
    for (const [housingId, housemates] of housingGroups) {
      if (housemates.length < 2) continue;

      for (let i = 0; i < housemates.length; i++) {
        const colonistA = housemates[i];
        if (!colonistA) continue;

        for (let j = i + 1; j < housemates.length; j++) {
          const colonistB = housemates[j];
          if (!colonistB) continue;

          const key = this.getRelationshipKey(colonistA.id, colonistB.id);
          currentHousematePairs.add(key);

          let relationship = this.coworkerRelationships.get(key);

          if (!relationship) {
            // First time living together
            relationship = {
              strength: INITIAL_HOUSEMATE_RELATIONSHIP,
              formedAt: currentSol,
              lastWorkedTogether: currentSol,
            };
            this.coworkerRelationships.set(key, relationship);

            events.push({
              type: "HOUSEMATE_BOND_FORMED",
              severity: "info",
              colonistA: colonistA.id,
              colonistB: colonistB.id,
              housingId,
              message: `${colonistA.name} and ${colonistB.name} are now housemates`,
            });
          } else {
            // Strengthen existing relationship (housemates bond faster)
            relationship.strength = Math.min(
              MAX_COWORKER_RELATIONSHIP,
              relationship.strength + HOUSEMATE_BONDING_RATE,
            );
            relationship.lastWorkedTogether = currentSol;
          }
        }
      }
    }

    return events;
  }

  /**
   * Calculate the team cohesion bonus for a building based on worker relationships.
   * Returns a multiplier (1.0 = no bonus, up to 1.0 + MAX_TEAM_COHESION_BONUS).
   */
  getTeamCohesionMultiplier(workerIds: string[]): number {
    if (workerIds.length < 2) {
      return 1.0; // No team bonus for solo workers
    }

    // Calculate average relationship strength between all pairs
    let totalStrength = 0;
    let pairCount = 0;

    for (let i = 0; i < workerIds.length; i++) {
      const workerA = workerIds[i];
      if (!workerA) continue;

      for (let j = i + 1; j < workerIds.length; j++) {
        const workerB = workerIds[j];
        if (!workerB) continue;

        totalStrength += this.getCoworkerRelationshipStrength(workerA, workerB);
        pairCount++;
      }
    }

    if (pairCount === 0) {
      return 1.0;
    }

    const averageStrength = totalStrength / pairCount;

    // No bonus if average strength is below threshold
    if (averageStrength < TEAM_COHESION_THRESHOLD) {
      return 1.0;
    }

    // Scale bonus from 0 to MAX_TEAM_COHESION_BONUS based on strength above threshold
    const strengthAboveThreshold = averageStrength - TEAM_COHESION_THRESHOLD;
    const maxStrengthAboveThreshold = MAX_COWORKER_RELATIONSHIP - TEAM_COHESION_THRESHOLD;
    const bonusRatio = strengthAboveThreshold / maxStrengthAboveThreshold;

    return 1.0 + bonusRatio * MAX_TEAM_COHESION_BONUS;
  }

  /**
   * Get all coworker relationships.
   */
  getAllCoworkerRelationships(): ReadonlyMap<string, CoworkerRelationship> {
    return this.coworkerRelationships;
  }

  // ============ Serialization ============

  toJSON() {
    return {
      coworkerRelationships: Object.fromEntries(this.coworkerRelationships),
    };
  }

  static fromJSON(data: ReturnType<WorkforceManager["toJSON"]>): WorkforceManager {
    const manager = new WorkforceManager();

    if (data.coworkerRelationships) {
      manager.coworkerRelationships = new Map(
        Object.entries(data.coworkerRelationships).map(([k, v]) => [k, v as CoworkerRelationship]),
      );
    }

    return manager;
  }
}
