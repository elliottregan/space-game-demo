// src/core/systems/OperationsManager.ts

import {
  DEPLETION_THRESHOLDS,
  DEPOSIT_RESERVES,
  ESTIMATE_UNCERTAINTY,
  EXPEDITION_EXPERIENCE_BONUS,
  EXPEDITION_EXPERIENCE_CAP,
  EXPEDITIONS,
  EXTRACTION_RATE_MULTIPLIERS,
  MAX_CONCURRENT_EXPEDITIONS,
  MAX_REVEALED_SITES,
  PROSPECTING_QUALITY,
  PROSPECTING_REVEAL_COST,
} from "../balance/OperationsBalance";
import type { GameEvent } from "../models/GameEvent";
import type {
  ActiveExpedition,
  ExpeditionResult,
  ExpeditionType,
  ProspectingSite,
} from "../models/Operation";
import type { WarningLevel } from "../utils/depositExtraction";
import { rng } from "../utils/random";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";

export class OperationsManager {
  private expeditions: ActiveExpedition[] = [];
  private sites: ProspectingSite[] = [];
  private expeditionExperience: number = 0;
  private nextExpeditionId: number = 1;
  private nextSiteId: number = 1;

  constructor() {
    // Add initial water deposits to enable early-game water production
    // This allows heuristic strategy to build water extractors without expeditions
    this.addInitialWaterSite("moderate");
    this.addInitialWaterSite("poor");
    // Add initial mineral deposit for early-game materials production
    this.addInitialMineralSite("moderate");
  }

  /**
   * Calculate reserves and estimated reserves for a deposit.
   */
  private calculateReserves(
    resourceType: "water" | "materials" | "research",
    quality: "poor" | "moderate" | "rich",
  ): { reserves: number; estimatedReserves: { min: number; max: number } } {
    const reserveRange = DEPOSIT_RESERVES[resourceType][quality];
    const reserves = rng.int(reserveRange.min, reserveRange.max - 1);

    const uncertainty = ESTIMATE_UNCERTAINTY.initial;
    const estimatedMin = Math.floor(reserves * (1 - uncertainty));
    const estimatedMax = Math.ceil(reserves * (1 + uncertainty));

    return { reserves, estimatedReserves: { min: estimatedMin, max: estimatedMax } };
  }

  /**
   * Add an initial water site with specified quality.
   * Used during game initialization to provide starting water deposits.
   */
  private addInitialWaterSite(quality: "poor" | "moderate" | "rich"): void {
    const { reserves, estimatedReserves } = this.calculateReserves("water", quality);

    this.sites.push({
      id: `site_initial_water_${this.nextSiteId++}`,
      resourceType: "water",
      quality,
      revealed: false,
      developed: false,
      developmentProgress: 0,
      reserves,
      estimatedReserves,
      remainingReserves: reserves,
      linkedBuildingId: null,
    });
  }

  /**
   * Add an initial mineral site with specified quality.
   * Used during game initialization to provide starting mineral deposits.
   */
  private addInitialMineralSite(quality: "poor" | "moderate" | "rich"): void {
    const { reserves, estimatedReserves } = this.calculateReserves("materials", quality);

    this.sites.push({
      id: `site_initial_minerals_${this.nextSiteId++}`,
      resourceType: "minerals",
      quality,
      revealed: false,
      developed: false,
      developmentProgress: 0,
      reserves,
      estimatedReserves,
      remainingReserves: reserves,
      linkedBuildingId: null,
    });
  }

  getActiveExpeditions(): readonly ActiveExpedition[] {
    return [...this.expeditions];
  }

  canStartExpedition(
    type: ExpeditionType,
    resources: ResourceManager,
    colony: ColonyManager,
  ): boolean {
    if (this.expeditions.length >= MAX_CONCURRENT_EXPEDITIONS) return false;

    const config = EXPEDITIONS[type];
    const materialCost = config.materials;

    if (!resources.canAfford({ materials: materialCost })) return false;

    const availableCrew = this.getAvailableCrewCount(colony);
    if (availableCrew < config.crew) return false;

    return true;
  }

  private getAvailableCrewCount(colony: ColonyManager): number {
    const assignedCrew = new Set(this.expeditions.flatMap((e) => e.assignedCrew));
    return colony.getColonists().filter((c) => !assignedCrew.has(c.id)).length;
  }

  startExpedition(
    type: ExpeditionType,
    crewIds: string[],
    resources: ResourceManager,
    colony: ColonyManager,
    currentSol: number,
  ): boolean {
    if (!this.canStartExpedition(type, resources, colony)) return false;

    const config = EXPEDITIONS[type];
    if (crewIds.length !== config.crew) return false;

    // Verify crew exists and is available
    const assignedCrew = new Set(this.expeditions.flatMap((e) => e.assignedCrew));
    for (const id of crewIds) {
      if (!colony.getColonist(id) || assignedCrew.has(id)) return false;
    }

    resources.deduct({ materials: config.materials });

    this.expeditions.push({
      id: `expedition_${this.nextExpeditionId++}`,
      type,
      assignedCrew: crewIds,
      startedAt: currentSol,
      solsRemaining: config.duration,
    });

    return true;
  }

  tick(currentSol: number, resources: ResourceManager, colony: ColonyManager): GameEvent[] {
    const events: GameEvent[] = [];

    // Update expedition timers
    for (const expedition of this.expeditions) {
      expedition.solsRemaining--;
    }

    // Resolve completed expeditions
    const completed = this.expeditions.filter((e) => e.solsRemaining <= 0);
    this.expeditions = this.expeditions.filter((e) => e.solsRemaining > 0);

    for (const expedition of completed) {
      const result = this.resolveExpedition(expedition, colony);

      // Apply results
      if (result.success && result.rewards) {
        if (result.rewards.materials) {
          resources.add({ materials: result.rewards.materials });
        }
        if (result.rewards.site) {
          this.sites.push(result.rewards.site);
        }
        if (result.rewards.researchBonus) {
          result.rewards.researchBonus.expiresAt = currentSol + 50;
        }

        events.push({
          type: "EXPEDITION_SUCCESS",
          expeditionId: expedition.id,
          expeditionType: expedition.type,
          severity: "info",
          message: `${expedition.type} expedition succeeded!${result.rewards.materials ? ` Gained ${result.rewards.materials} materials.` : ""}${result.rewards.site ? " Discovered a prospecting site!" : ""}`,
        });
      } else {
        // Handle failures
        if (result.losses?.crewLost && result.losses.crewLost.length > 0) {
          for (const crewId of result.losses.crewLost) {
            colony.removeColonist(crewId);
          }
          events.push({
            type: "EXPEDITION_FAILURE",
            expeditionId: expedition.id,
            expeditionType: expedition.type,
            severity: "critical",
            message: `${expedition.type} expedition failed! Lost ${result.losses.crewLost.length} crew member(s).`,
          });
        } else {
          events.push({
            type: "EXPEDITION_FAILURE",
            expeditionId: expedition.id,
            expeditionType: expedition.type,
            severity: "warning",
            message: `${expedition.type} expedition failed. Crew returned safely.`,
          });
        }
      }
    }

    return events;
  }

  private resolveExpedition(expedition: ActiveExpedition, colony: ColonyManager): ExpeditionResult {
    const config = EXPEDITIONS[expedition.type];
    const successChance =
      config.baseSuccess + Math.min(this.expeditionExperience, EXPEDITION_EXPERIENCE_CAP);

    const success = rng.chance(successChance);
    this.expeditionExperience = Math.min(
      this.expeditionExperience + EXPEDITION_EXPERIENCE_BONUS,
      EXPEDITION_EXPERIENCE_CAP,
    );

    if (success) {
      return this.getSuccessResult(expedition.type);
    } else {
      return this.getFailureResult(expedition, colony);
    }
  }

  private getSuccessResult(type: ExpeditionType): ExpeditionResult {
    switch (type) {
      case "survey":
        return {
          success: true,
          type,
          rewards: {
            site: this.generateProspectingSite(),
          },
        };
      case "salvage":
        return {
          success: true,
          type,
          rewards: { materials: rng.int(50, 149) },
        };
      case "science":
        return {
          success: true,
          type,
          rewards: { researchBonus: { multiplier: 1.2, expiresAt: 0 } },
        };
      case "deep":
        return {
          success: true,
          type,
          rewards: { discovery: "rare_minerals", materials: rng.int(100, 249) },
        };
    }
  }

  private getFailureResult(expedition: ActiveExpedition, _colony: ColonyManager): ExpeditionResult {
    const type = expedition.type;
    const crewLost: string[] = [];

    if (type === "salvage" || type === "deep") {
      // Lose 1-2 crew on dangerous expeditions
      const lossCount = type === "deep" ? rng.int(1, 2) : 1;
      for (let i = 0; i < lossCount && i < expedition.assignedCrew.length; i++) {
        const crewId = expedition.assignedCrew[i];
        if (crewId) crewLost.push(crewId);
      }
    }

    return {
      success: false,
      type,
      losses: { crewLost },
    };
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

    const resourceType = rng.pick(types) ?? "water";
    const quality = rng.pick(qualities) ?? "moderate";
    const { reserves, estimatedReserves } = this.calculateReserves(resourceType, quality);

    return {
      id: `site_${this.nextSiteId++}`,
      resourceType,
      quality,
      revealed: false,
      developed: false,
      developmentProgress: 0,
      reserves,
      estimatedReserves,
      remainingReserves: reserves,
      linkedBuildingId: null,
    };
  }

  getRevealedSiteCount(): number {
    return this.sites.filter((s) => s.revealed && !s.developed).length;
  }

  revealSite(siteId: string, resources: ResourceManager): boolean {
    if (this.getRevealedSiteCount() >= MAX_REVEALED_SITES) return false;

    const site = this.sites.find((s) => s.id === siteId);
    if (!site || site.revealed) return false;

    if (!resources.canAfford({ materials: PROSPECTING_REVEAL_COST.materials })) return false;

    resources.deduct({ materials: PROSPECTING_REVEAL_COST.materials });
    site.revealed = true;
    return true;
  }

  developSite(siteId: string, resources: ResourceManager): boolean {
    const site = this.sites.find((s) => s.id === siteId);
    if (!site || !site.revealed || site.developed) return false;

    const cost = PROSPECTING_QUALITY[site.quality].developCost;
    if (!resources.canAfford({ materials: cost })) return false;

    resources.deduct({ materials: cost });
    site.developed = true;
    return true;
  }

  getDevelopedSiteBonus(resourceType: "water" | "materials" | "research"): number {
    return this.sites
      .filter((s) => s.developed && s.resourceType === resourceType)
      .reduce((sum, s) => sum + PROSPECTING_QUALITY[s.quality].bonus, 0);
  }

  abandonSite(siteId: string): boolean {
    const index = this.sites.findIndex((s) => s.id === siteId);
    if (index === -1) return false;

    const site = this.sites[index];
    if (!site || site.developed) return false; // Can't abandon developed sites

    this.sites.splice(index, 1);
    return true;
  }

  linkBuildingToDeposit(buildingId: string, siteId: string): boolean {
    const site = this.sites.find((s) => s.id === siteId);
    if (!site || !site.developed || site.linkedBuildingId) return false;

    site.linkedBuildingId = buildingId;
    return true;
  }

  unlinkBuildingFromDeposit(siteId: string): boolean {
    const site = this.sites.find((s) => s.id === siteId);
    if (!site) return false;

    site.linkedBuildingId = null;
    return true;
  }

  getDepositForBuilding(buildingId: string): ProspectingSite | undefined {
    return this.sites.find((s) => s.linkedBuildingId === buildingId);
  }

  processExtraction(buildingId: string, baseProduction: number): number {
    const site = this.sites.find((s) => s.linkedBuildingId === buildingId);
    if (!site || site.remainingReserves <= 0) return 0;

    const qualityMult = EXTRACTION_RATE_MULTIPLIERS[site.quality];
    const extractionRate = baseProduction * qualityMult;

    return this.extractFromDeposit(site.id, extractionRate);
  }

  extractFromDeposit(siteId: string, amount: number): number {
    const site = this.sites.find((s) => s.id === siteId);
    if (!site || !site.developed || site.remainingReserves <= 0) return 0;

    const actualExtracted = Math.min(amount, site.remainingReserves);
    site.remainingReserves -= actualExtracted;

    // Update estimate accuracy based on extraction progress
    this.updateEstimateAccuracy(site);

    return actualExtracted;
  }

  private updateEstimateAccuracy(site: ProspectingSite): void {
    const extractedPercent = 1 - site.remainingReserves / site.reserves;

    let uncertainty: number;
    if (extractedPercent >= 0.75) {
      uncertainty = ESTIMATE_UNCERTAINTY.at75Percent;
    } else if (extractedPercent >= 0.5) {
      uncertainty = ESTIMATE_UNCERTAINTY.at50Percent;
    } else if (extractedPercent >= 0.25) {
      uncertainty = ESTIMATE_UNCERTAINTY.at25Percent;
    } else {
      uncertainty = ESTIMATE_UNCERTAINTY.initial;
    }

    site.estimatedReserves = {
      min: Math.floor(site.remainingReserves * (1 - uncertainty)),
      max: Math.ceil(site.remainingReserves * (1 + uncertainty)),
    };
  }

  isDepositDepleted(siteId: string): boolean {
    const site = this.sites.find((s) => s.id === siteId);
    return site ? site.remainingReserves <= 0 : true;
  }

  getDepletionWarningLevel(siteId: string): WarningLevel {
    const site = this.sites.find((s) => s.id === siteId);
    if (!site) return "depleted";

    const percentRemaining = site.remainingReserves / site.reserves;

    if (percentRemaining <= 0) return "depleted";
    if (percentRemaining <= DEPLETION_THRESHOLDS.critical) return "critical";
    if (percentRemaining <= DEPLETION_THRESHOLDS.warning) return "warning";
    return "none";
  }

  toJSON() {
    return {
      expeditions: this.expeditions,
      sites: this.sites,
      expeditionExperience: this.expeditionExperience,
    };
  }

  static fromJSON(data: ReturnType<OperationsManager["toJSON"]>): OperationsManager {
    const manager = new OperationsManager();
    manager.expeditions = data.expeditions || [];
    manager.sites = data.sites || [];
    manager.expeditionExperience = data.expeditionExperience || 0;
    return manager;
  }
}
