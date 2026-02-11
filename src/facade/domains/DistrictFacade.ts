// src/facade/domains/DistrictFacade.ts
// District queries facade

import { DISTRICT_FOUNDING_COST } from "../../core/balance/DistrictBalance";
import type { GameState } from "../../core/GameState";
import { ColonistRole } from "../../core/models/Colonist";
import { PowerStatus } from "../../core/models/District";
import { RESOURCE_KEYS } from "../../core/models/Resources";
import type { ResourceDelta } from "../../core/models/Resources";
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
    resourceProduction: ResourceDelta;
    resourceConsumption: ResourceDelta;
    power: { production: number; consumption: number; balance: number };
    workforce: {
      employed: number;
      idle: number;
      byRole: Record<string, number>;
    };
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
    const bm = this.gameState.buildings;
    const cm = this.gameState.colony;
    return {
      districts: dm.getDistricts().map((d) => {
        // Aggregate resource production/consumption from district buildings
        const resourceProduction: ResourceDelta = {};
        const resourceConsumption: ResourceDelta = {};
        const employedSet = new Set<string>();
        for (const bid of d.buildingIds) {
          const prod = bm.getEffectiveProduction(bid);
          for (const key of RESOURCE_KEYS) {
            if (prod[key]) resourceProduction[key] = (resourceProduction[key] ?? 0) + prod[key]!;
          }
          const cons = bm.getEffectiveConsumption(bid);
          for (const key of RESOURCE_KEYS) {
            if (cons[key]) resourceConsumption[key] = (resourceConsumption[key] ?? 0) + cons[key]!;
          }
          // Collect assigned workers from this building
          const building = bm.getBuilding(bid);
          if (building) {
            for (const wid of building.assignedWorkers) employedSet.add(wid);
          }
        }

        // Per-district power
        const districtPower = dm.getDistrictPower(d.id);

        // Workforce breakdown
        const colonistIds = dm.getDistrictColonistIds(d.id);
        const byRole: Record<string, number> = {};
        let employed = 0;
        let idle = 0;
        for (const cid of colonistIds) {
          const colonist = cm.getColonist(cid);
          if (colonist) {
            const roleName = colonist.role || ColonistRole.UNASSIGNED;
            byRole[roleName] = (byRole[roleName] ?? 0) + 1;
          }
          if (employedSet.has(cid)) {
            employed++;
          } else {
            idle++;
          }
        }

        return {
          id: d.id,
          name: d.name,
          foundedAt: d.foundedAt,
          capacity: d.capacity,
          population: dm.getDistrictPopulation(d.id),
          growthCap: d.growthCap,
          buildingCount: d.buildingIds.length,
          buildingIds: [...d.buildingIds],
          resourceProduction,
          resourceConsumption,
          power: {
            production: districtPower.production,
            consumption: districtPower.consumption,
            balance: districtPower.production - districtPower.consumption,
          },
          workforce: { employed, idle, byRole },
        };
      }),
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
