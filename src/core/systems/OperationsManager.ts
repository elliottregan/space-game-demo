// src/core/systems/OperationsManager.ts
import type { GameEvent } from "../models/GameEvent";
import type {
  ColonyPolicies,
  WorkIntensity,
  ResourcePriority,
  ExplorationStance,
  ActiveExpedition,
  ProspectingSite,
  ExpeditionType,
  ExpeditionResult,
} from "../models/Operation";
import {
  POLICY_CHANGE_COOLDOWN_SOLS,
  WORK_INTENSITY,
  RESOURCE_PRIORITY,
  EXPLORATION_STANCE,
  EXPEDITIONS,
  MAX_CONCURRENT_EXPEDITIONS,
  EXPEDITION_EXPERIENCE_BONUS,
  EXPEDITION_EXPERIENCE_CAP,
  PROSPECTING_REVEAL_COST,
  PROSPECTING_QUALITY,
  MAX_REVEALED_SITES,
  MAX_DEVELOPED_SITES,
} from "../balance/OperationsBalance";
import type { ResourceManager } from "./ResourceManager";
import type { ColonyManager } from "./ColonyManager";

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
  private nextExpeditionId: number = 1;

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

  getActiveExpeditions(): readonly ActiveExpedition[] {
    return [...this.expeditions];
  }

  canStartExpedition(
    type: ExpeditionType,
    resources: ResourceManager,
    colony: ColonyManager
  ): boolean {
    if (this.expeditions.length >= MAX_CONCURRENT_EXPEDITIONS) return false;

    const config = EXPEDITIONS[type];
    const costMult = this.getExpeditionCostMultiplier();
    const materialCost = Math.ceil(config.materials * costMult);

    if (!resources.canAfford({ materials: materialCost })) return false;

    const availableCrew = this.getAvailableCrewCount(colony);
    if (availableCrew < config.crew) return false;

    return true;
  }

  private getAvailableCrewCount(colony: ColonyManager): number {
    const assignedCrew = new Set(this.expeditions.flatMap(e => e.assignedCrew));
    return colony.getColonists().filter(c => !assignedCrew.has(c.id)).length;
  }

  startExpedition(
    type: ExpeditionType,
    crewIds: string[],
    resources: ResourceManager,
    colony: ColonyManager,
    currentSol: number
  ): boolean {
    if (!this.canStartExpedition(type, resources, colony)) return false;

    const config = EXPEDITIONS[type];
    if (crewIds.length !== config.crew) return false;

    // Verify crew exists and is available
    const assignedCrew = new Set(this.expeditions.flatMap(e => e.assignedCrew));
    for (const id of crewIds) {
      if (!colony.getColonist(id) || assignedCrew.has(id)) return false;
    }

    const costMult = this.getExpeditionCostMultiplier();
    resources.deduct({ materials: Math.ceil(config.materials * costMult) });

    this.expeditions.push({
      id: `expedition_${this.nextExpeditionId++}`,
      type,
      assignedCrew: crewIds,
      startedAt: currentSol,
      solsRemaining: config.duration,
    });

    return true;
  }

  tick(currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];

    // Update expedition timers
    for (const expedition of this.expeditions) {
      expedition.solsRemaining--;
    }

    // Remove completed expeditions
    const completed = this.expeditions.filter(e => e.solsRemaining <= 0);
    this.expeditions = this.expeditions.filter(e => e.solsRemaining > 0);

    for (const expedition of completed) {
      events.push({
        type: "EXPEDITION_COMPLETE",
        expeditionId: expedition.id,
        expeditionType: expedition.type,
        severity: "info",
        message: `${expedition.type} expedition has returned!`,
      });
    }

    return events;
  }

  getSites(): readonly ProspectingSite[] {
    return [...this.sites];
  }

  addUnrevealedSite(): void {
    this.sites.push(this.generateProspectingSite());
  }

  private generateProspectingSite(): ProspectingSite {
    const types: Array<"water" | "materials" | "research"> = ["water", "materials", "research"];
    const qualities: Array<"poor" | "moderate" | "rich"> = ["poor", "moderate", "rich"];

    return {
      id: `site_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      resourceType: types[Math.floor(Math.random() * types.length)],
      quality: qualities[Math.floor(Math.random() * qualities.length)],
      revealed: false,
      developed: false,
      developmentProgress: 0,
    };
  }

  getRevealedSiteCount(): number {
    return this.sites.filter(s => s.revealed && !s.developed).length;
  }

  revealSite(siteId: string, resources: ResourceManager): boolean {
    if (this.getRevealedSiteCount() >= MAX_REVEALED_SITES) return false;

    const site = this.sites.find(s => s.id === siteId);
    if (!site || site.revealed) return false;

    if (!resources.canAfford({ materials: PROSPECTING_REVEAL_COST.materials })) return false;

    resources.deduct({ materials: PROSPECTING_REVEAL_COST.materials });
    site.revealed = true;
    return true;
  }

  developSite(siteId: string, resources: ResourceManager): boolean {
    const site = this.sites.find(s => s.id === siteId);
    if (!site || !site.revealed || site.developed) return false;

    const cost = PROSPECTING_QUALITY[site.quality].developCost;
    if (!resources.canAfford({ materials: cost })) return false;

    resources.deduct({ materials: cost });
    site.developed = true;
    return true;
  }

  getDevelopedSiteBonus(resourceType: "water" | "materials" | "research"): number {
    return this.sites
      .filter(s => s.developed && s.resourceType === resourceType)
      .reduce((sum, s) => sum + PROSPECTING_QUALITY[s.quality].bonus, 0);
  }

  abandonSite(siteId: string): boolean {
    const index = this.sites.findIndex(s => s.id === siteId);
    if (index === -1) return false;

    const site = this.sites[index];
    if (site.developed) return false; // Can't abandon developed sites

    this.sites.splice(index, 1);
    return true;
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
