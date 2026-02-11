import type { District } from "../models/District";
import { PowerStatus } from "../models/District";
import {
  DISTRICT_INITIAL_CAPACITY,
  DISTRICT_GROWTH_TRIGGER,
  DISTRICT_GROWTH_AMOUNT,
  DISTRICT_GROWTH_INTERVAL,
  DISTRICT_GROWTH_MATERIAL_COST,
  POWER_CRITICAL_THRESHOLD,
} from "../balance/DistrictBalance";

export class DistrictManager {
  private districts: Map<string, District> = new Map();
  private nextId = 1;
  private colonistToDistrict: Map<string, string> = new Map();
  private districtColonists: Map<string, string[]> = new Map();
  private buildingToDistrict: Map<string, string> = new Map();
  private powerSources: Map<string, number> = new Map();
  private powerConsumers: Map<string, number> = new Map();
  private lastGrowthSol: Map<string, number> = new Map();

  foundDistrict(name: string, currentSol: number): District {
    const id = `district_${this.nextId++}`;
    const district: District = {
      id,
      name,
      foundedAt: currentSol,
      capacity: DISTRICT_INITIAL_CAPACITY,
      growthCap: null,
      buildingIds: [],
    };
    this.districts.set(id, district);
    this.districtColonists.set(id, []);
    this.lastGrowthSol.set(id, currentSol);
    return district;
  }

  getDistrict(id: string): District | undefined {
    return this.districts.get(id);
  }

  getDistricts(): District[] {
    return Array.from(this.districts.values());
  }

  setGrowthCap(districtId: string, cap: number | null): void {
    const district = this.districts.get(districtId);
    if (district) district.growthCap = cap;
  }

  assignBuilding(districtId: string, buildingId: string): void {
    const district = this.districts.get(districtId);
    if (!district) return;
    district.buildingIds.push(buildingId);
    this.buildingToDistrict.set(buildingId, districtId);
  }

  removeBuilding(buildingId: string): void {
    const districtId = this.buildingToDistrict.get(buildingId);
    if (!districtId) return;
    const district = this.districts.get(districtId);
    if (district) district.buildingIds = district.buildingIds.filter((id) => id !== buildingId);
    this.buildingToDistrict.delete(buildingId);
  }

  getBuildingDistrictId(buildingId: string): string | undefined {
    return this.buildingToDistrict.get(buildingId);
  }

  assignColonist(districtId: string, colonistId: string): boolean {
    const district = this.districts.get(districtId);
    if (!district) return false;
    const population = this.districtColonists.get(districtId)?.length ?? 0;
    if (population >= district.capacity) return false;
    this.removeColonist(colonistId);
    this.colonistToDistrict.set(colonistId, districtId);
    const colonists = this.districtColonists.get(districtId) ?? [];
    colonists.push(colonistId);
    this.districtColonists.set(districtId, colonists);
    return true;
  }

  removeColonist(colonistId: string): void {
    const districtId = this.colonistToDistrict.get(colonistId);
    if (!districtId) return;
    const colonists = this.districtColonists.get(districtId);
    if (colonists) {
      const idx = colonists.indexOf(colonistId);
      if (idx !== -1) colonists.splice(idx, 1);
    }
    this.colonistToDistrict.delete(colonistId);
  }

  transferColonist(colonistId: string, targetDistrictId: string): boolean {
    const district = this.districts.get(targetDistrictId);
    if (!district) return false;
    const population = this.districtColonists.get(targetDistrictId)?.length ?? 0;
    if (population >= district.capacity) return false;
    this.removeColonist(colonistId);
    this.colonistToDistrict.set(colonistId, targetDistrictId);
    const colonists = this.districtColonists.get(targetDistrictId) ?? [];
    colonists.push(colonistId);
    this.districtColonists.set(targetDistrictId, colonists);
    return true;
  }

  getColonistDistrictId(colonistId: string): string | undefined {
    return this.colonistToDistrict.get(colonistId);
  }

  getDistrictPopulation(districtId: string): number {
    return this.districtColonists.get(districtId)?.length ?? 0;
  }

  getDistrictColonistIds(districtId: string): string[] {
    return this.districtColonists.get(districtId) ?? [];
  }

  getDistrictPower(districtId: string): { production: number; consumption: number } {
    const district = this.districts.get(districtId);
    if (!district) return { production: 0, consumption: 0 };
    const buildingIdSet = new Set(district.buildingIds);
    let production = 0;
    let consumption = 0;
    for (const [bid, output] of this.powerSources) {
      if (buildingIdSet.has(bid)) production += output;
    }
    for (const [bid, cons] of this.powerConsumers) {
      if (buildingIdSet.has(bid)) consumption += cons;
    }
    return { production, consumption };
  }

  getTotalCapacity(): number {
    let total = 0;
    for (const district of this.districts.values()) {
      total += district.capacity;
    }
    return total;
  }

  processGrowth(currentSol: number): number {
    let totalMaterialsCost = 0;
    for (const [districtId, district] of this.districts) {
      const lastSol = this.lastGrowthSol.get(districtId) ?? 0;
      if (currentSol - lastSol < DISTRICT_GROWTH_INTERVAL) continue;
      const population = this.getDistrictPopulation(districtId);
      const occupancy = district.capacity > 0 ? population / district.capacity : 0;
      if (occupancy < DISTRICT_GROWTH_TRIGGER) continue;
      if (district.growthCap !== null && district.capacity >= district.growthCap) continue;
      district.capacity += DISTRICT_GROWTH_AMOUNT;
      this.lastGrowthSol.set(districtId, currentSol);
      totalMaterialsCost += DISTRICT_GROWTH_INTERVAL * DISTRICT_GROWTH_MATERIAL_COST;
    }
    return totalMaterialsCost;
  }

  registerPowerSource(buildingId: string, output: number): void {
    this.powerSources.set(buildingId, output);
  }

  unregisterPowerSource(buildingId: string): void {
    this.powerSources.delete(buildingId);
  }

  registerPowerConsumer(buildingId: string, consumption: number): void {
    this.powerConsumers.set(buildingId, consumption);
  }

  unregisterPowerConsumer(buildingId: string): void {
    this.powerConsumers.delete(buildingId);
  }

  getTotalPowerProduction(): number {
    let total = 0;
    for (const output of this.powerSources.values()) total += output;
    return total;
  }

  getTotalPowerConsumption(): number {
    let total = 0;
    for (const consumption of this.powerConsumers.values()) total += consumption;
    return total;
  }

  getPowerBalance(): number {
    return this.getTotalPowerProduction() - this.getTotalPowerConsumption();
  }

  getPowerStatus(): PowerStatus {
    const production = this.getTotalPowerProduction();
    const consumption = this.getTotalPowerConsumption();
    if (production >= consumption) return PowerStatus.SURPLUS;
    const deficit = consumption - production;
    if (consumption > 0 && deficit / consumption > POWER_CRITICAL_THRESHOLD)
      return PowerStatus.CRITICAL;
    return PowerStatus.DEFICIT;
  }

  toJSON() {
    const districts = this.getDistricts().map((d) => ({
      ...d,
      colonistIds: this.getDistrictColonistIds(d.id),
    }));
    return {
      districts,
      nextId: this.nextId,
      powerSources: Array.from(this.powerSources.entries()).map(([buildingId, output]) => ({
        buildingId,
        output,
      })),
      powerConsumers: Array.from(this.powerConsumers.entries()).map(
        ([buildingId, consumption]) => ({ buildingId, consumption }),
      ),
      lastGrowthSol: Array.from(this.lastGrowthSol.entries()),
    };
  }

  static fromJSON(data: ReturnType<DistrictManager["toJSON"]>): DistrictManager {
    const dm = new DistrictManager();
    dm.nextId = data.nextId;
    for (const d of data.districts) {
      const district: District = {
        id: d.id,
        name: d.name,
        foundedAt: d.foundedAt,
        capacity: d.capacity,
        growthCap: d.growthCap,
        buildingIds: d.buildingIds,
      };
      dm.districts.set(d.id, district);
      dm.districtColonists.set(d.id, []);
      for (const bid of d.buildingIds) dm.buildingToDistrict.set(bid, d.id);
      for (const cid of d.colonistIds) {
        dm.colonistToDistrict.set(cid, d.id);
        dm.districtColonists.get(d.id)!.push(cid);
      }
    }
    for (const { buildingId, output } of data.powerSources) dm.powerSources.set(buildingId, output);
    for (const { buildingId, consumption } of data.powerConsumers)
      dm.powerConsumers.set(buildingId, consumption);
    for (const [id, sol] of data.lastGrowthSol) dm.lastGrowthSol.set(id, sol);
    return dm;
  }
}
