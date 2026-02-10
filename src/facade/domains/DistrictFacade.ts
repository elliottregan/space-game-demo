// src/facade/domains/DistrictFacade.ts
// District queries facade

import { DISTRICT_FOUNDING_COST } from "../../core/balance/DistrictBalance";
import type { GameState } from "../../core/GameState";
import { PowerStatus } from "../../core/models/District";
import type { CanDoResult, Result } from "../types/common";
import { err, ok } from "../types/common";

export interface DistrictSnapshot {
  districts: Array<{
    id: string;
    name: string;
    foundedAt: number;
    capacity: number;
    population: number;
    growthCap: number | null;
    buildingCount: number;
    buildingIds: string[];
  }>;
  power: {
    production: number;
    consumption: number;
    balance: number;
    status: PowerStatus;
  };
}

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

export class DistrictFacade {
  constructor(
    private gameState: GameState,
    private executeCommand?: CommandExecutor,
  ) {}

  snapshot(): DistrictSnapshot {
    const dm = this.gameState.districts;
    return {
      districts: dm.getDistricts().map((d) => ({
        id: d.id,
        name: d.name,
        foundedAt: d.foundedAt,
        capacity: d.capacity,
        population: dm.getDistrictPopulation(d.id),
        growthCap: d.growthCap,
        buildingCount: d.buildingIds.length,
        buildingIds: [...d.buildingIds],
      })),
      power: {
        production: dm.getTotalPowerProduction(),
        consumption: dm.getTotalPowerConsumption(),
        balance: dm.getPowerBalance(),
        status: dm.getPowerStatus(),
      },
    };
  }

  getDistrictColonists(districtId: string): string[] {
    return this.gameState.districts.getDistrictColonistIds(districtId);
  }

  setGrowthCap(districtId: string, cap: number | null): void {
    this.gameState.districts.setGrowthCap(districtId, cap);
  }

  canFoundDistrict(): CanDoResult {
    const resources = this.gameState.resources.getResources();
    if (resources.materials < DISTRICT_FOUNDING_COST) {
      return { allowed: false, reason: `Need ${DISTRICT_FOUNDING_COST} materials` };
    }
    return { allowed: true };
  }

  foundDistrict(name: string): Result<{ districtId: string }> {
    const exec = this.executeCommand ?? ((fn: () => Result<{ districtId: string }>) => fn());
    return exec(() => {
      const check = this.canFoundDistrict();
      if (!check.allowed) {
        const resources = this.gameState.resources.getResources();
        return err({
          type: "INSUFFICIENT_RESOURCES",
          required: { materials: DISTRICT_FOUNDING_COST },
          available: { materials: resources.materials },
        });
      }
      this.gameState.resources.deduct({ materials: DISTRICT_FOUNDING_COST });
      const district = this.gameState.districts.foundDistrict(name, this.gameState.currentSol);
      return ok({ districtId: district.id });
    });
  }
}
