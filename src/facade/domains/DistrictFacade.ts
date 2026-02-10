// src/facade/domains/DistrictFacade.ts
// District queries facade

import type { GameState } from "../../core/GameState";
import { PowerStatus } from "../../core/models/District";

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

export class DistrictFacade {
  constructor(private gameState: GameState) {}

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
}
