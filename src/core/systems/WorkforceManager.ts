import type { GameEvent } from "../models/GameEvent";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { ColonyManager } from "./ColonyManager";
import {
  ROLE_AFFINITY,
  EXPERIENCE_GAIN_RATE,
  MASTERY_THRESHOLDS,
  MASTER_EVENT_CHANCE,
} from "../balance/WorkforceBalance";

export class WorkforceManager {
  tick(colony: ColonyManager): GameEvent[] {
    const events: GameEvent[] = [];
    const colonists = colony.getColonists();

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
}
