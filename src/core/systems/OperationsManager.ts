// src/core/systems/OperationsManager.ts
import type { GameEvent } from "../models/GameEvent";
import type {
  ColonyPolicies,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
  ActiveExpedition,
  ProspectingSite,
} from "../models/Operation";
import {
  POLICY_CHANGE_COOLDOWN_SOLS,
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
} from "../balance/OperationsBalance";

export class OperationsManager {
  private policies: ColonyPolicies = {
    workIntensity: "standard",
    resourcePriority: "balanced",
    explorationStance: "standard",
    lastChangeAt: -POLICY_CHANGE_COOLDOWN_SOLS, // Allow immediate first change
  };

  private expeditions: ActiveExpedition[] = [];
  private sites: ProspectingSite[] = [];
  private expeditionExperience: number = 0;

  getPolicies(): Readonly<ColonyPolicies> {
    return { ...this.policies };
  }

  canChangePolicy(currentSol: number): boolean {
    return currentSol - this.policies.lastChangeAt >= POLICY_CHANGE_COOLDOWN_SOLS;
  }

  getSolsUntilPolicyChange(currentSol: number): number {
    const elapsed = currentSol - this.policies.lastChangeAt;
    return Math.max(0, POLICY_CHANGE_COOLDOWN_SOLS - elapsed);
  }

  setPolicy(
    type: "workIntensity" | "resourcePriority" | "explorationStance",
    value: WorkIntensity | ResourcePriority | ExplorationStance,
    currentSol: number
  ): boolean {
    if (!this.canChangePolicy(currentSol)) return false;

    switch (type) {
      case "workIntensity":
        this.policies.workIntensity = value as WorkIntensity;
        break;
      case "resourcePriority":
        this.policies.resourcePriority = value as ResourcePriority;
        break;
      case "explorationStance":
        this.policies.explorationStance = value as ExplorationStance;
        break;
    }

    this.policies.lastChangeAt = currentSol;
    return true;
  }

  getProductionMultiplier(): number {
    const workMult = WORK_INTENSITY[this.policies.workIntensity].productionMult;
    const resourceMult = RESOURCE_PRIORITY[this.policies.resourcePriority].productionMult;
    return workMult * resourceMult;
  }

  getMoraleEffect(): number {
    return WORK_INTENSITY[this.policies.workIntensity].moralePerSol;
  }

  getHealthEffect(): number {
    const effect = WORK_INTENSITY[this.policies.workIntensity];
    return "healthPerSol" in effect ? effect.healthPerSol : 0;
  }

  getExpeditionCostMultiplier(): number {
    return EXPLORATION_STANCE[this.policies.explorationStance].costMult;
  }

  getExpeditionSuccessModifier(): number {
    return EXPLORATION_STANCE[this.policies.explorationStance].successMod;
  }

  tick(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    // Expedition and prospecting tick logic will be added later
    return events;
  }

  toJSON() {
    return {
      policies: this.policies,
      expeditions: this.expeditions,
      sites: this.sites,
      expeditionExperience: this.expeditionExperience,
    };
  }

  static fromJSON(data: ReturnType<OperationsManager["toJSON"]>): OperationsManager {
    const manager = new OperationsManager();
    manager.policies = data.policies;
    manager.expeditions = data.expeditions || [];
    manager.sites = data.sites || [];
    manager.expeditionExperience = data.expeditionExperience || 0;
    return manager;
  }
}
