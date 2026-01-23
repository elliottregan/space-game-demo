import type { GameEvent } from "../models/GameEvent";
import type { Building, BuildingDefinition } from "../models/Building";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";
import {
  BUILDING_MODES,
  REPAIR_COST_MULTIPLIER,
  REPAIR_DURATION_SOLS,
  RECYCLING_RECOVERY_RATES,
  RECYCLING_TIME_MULTIPLIER,
  RUSH_RECYCLING_PENALTY,
  REPURPOSE_COST_MULTIPLIER,
  REPURPOSE_TIME_MULTIPLIER,
} from "../balance/OperationsBalance";
import type { ResourceDelta } from "../models/Resources";

export class BuildingManager {
  private definitions: Map<string, BuildingDefinition> = new Map();
  private buildings: Map<string, Building> = new Map();
  private nextId: number = 1;
  private constructionSpeedBonus: number = 0;

  constructor(defs: BuildingDefinition[]) {
    defs.forEach((d) => {
      this.definitions.set(d.id, d);
    });
  }

  tick(resources: ResourceManager): GameEvent[] {
    const events: GameEvent[] = [];
    const buildingsToDelete: string[] = [];

    for (const building of this.buildings.values()) {
      const def = this.definitions.get(building.definitionId);
      if (!def) continue;

      if (building.status === "pending") {
        const speedMultiplier = 1.0 + this.constructionSpeedBonus;
        building.constructionProgress += speedMultiplier;

        // Use repurpose time if repurposing
        const constructionTime = building.repurposeFromDefId
          ? this.getRepurposeTime(building.definitionId)
          : def.constructionTime;

        if (building.constructionProgress >= constructionTime) {
          building.status = "active";
          building.constructionProgress = constructionTime;
          building.repurposeFromDefId = undefined; // Clear repurpose flag

          // Add mode-adjusted production/consumption
          const effectiveProd = this.getEffectiveProduction(building.id);
          const effectiveCons = this.getEffectiveConsumption(building.id);
          if (Object.keys(effectiveProd).length > 0) {
            resources.addProduction(effectiveProd);
          }
          if (Object.keys(effectiveCons).length > 0) {
            resources.addConsumption(effectiveCons);
          }

          events.push({
            type: "BUILDING_COMPLETE",
            buildingId: building.id,
            buildingName: def.name,
            severity: "info",
            message: `${def.name} construction complete!`,
          });
        }
      }

      // Handle repairs
      if (building.broken && building.repairProgress > 0) {
        building.repairProgress += 1;
        if (building.repairProgress >= REPAIR_DURATION_SOLS) {
          building.broken = false;
          building.repairProgress = 0;

          // Re-add production/consumption after repair
          const effectiveProd = this.getEffectiveProduction(building.id);
          const effectiveCons = this.getEffectiveConsumption(building.id);
          if (Object.keys(effectiveProd).length > 0) {
            resources.addProduction(effectiveProd);
          }
          if (Object.keys(effectiveCons).length > 0) {
            resources.addConsumption(effectiveCons);
          }

          events.push({
            type: "BUILDING_REPAIRED",
            buildingId: building.id,
            buildingName: def.name,
            severity: "info",
            message: `${def.name} repaired!`,
          });
        }
      }

      // Handle recycling progress
      if (building.status === "recycling") {
        building.recyclingProgress = (building.recyclingProgress || 0) + 1;
        const recycleTime = this.getRecycleTime(building.id);

        if (building.recyclingProgress >= recycleTime) {
          const recycleValue = this.getRecycleValue(building.id);
          if (recycleValue) {
            resources.add(recycleValue);
          }

          events.push({
            type: "BUILDING_RECYCLED",
            buildingId: building.id,
            buildingName: def.name,
            severity: "info",
            message: `${def.name} recycled for materials.`,
          });

          buildingsToDelete.push(building.id);
        }
      }
    }

    // Delete buildings that were recycled (outside of iteration loop)
    for (const id of buildingsToDelete) {
      this.buildings.delete(id);
    }

    return events;
  }

  canBuild(defId: string, resources: ResourceManager, technology: TechnologyTree): boolean {
    const def = this.definitions.get(defId);
    if (!def) return false;

    if (def.requiredTech && !technology.isResearched(def.requiredTech)) {
      return false;
    }

    return resources.canAfford(def.cost);
  }

  startBuilding(
    defId: string,
    resources: ResourceManager,
    technology: TechnologyTree,
  ): Building | null {
    if (!this.canBuild(defId, resources, technology)) return null;

    const def = this.definitions.get(defId);
    if (!def) return null;
    resources.deduct(def.cost);

    const building: Building = {
      id: `building_${this.nextId++}`,
      definitionId: defId,
      status: "pending",
      constructionProgress: 0,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    };

    this.buildings.set(building.id, building);
    return building;
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  setBuildingMode(
    buildingId: string,
    mode: "conservation" | "normal" | "overdrive",
    resources: ResourceManager,
  ): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return false;
    if (building.mode === mode) return true; // No change needed

    // Remove old production/consumption
    const oldProd = this.getEffectiveProduction(buildingId);
    const oldCons = this.getEffectiveConsumption(buildingId);
    if (Object.keys(oldProd).length > 0) {
      resources.removeProduction(oldProd);
    }
    if (Object.keys(oldCons).length > 0) {
      resources.removeConsumption(oldCons);
    }

    // Update mode
    building.mode = mode;

    // Add new production/consumption
    const newProd = this.getEffectiveProduction(buildingId);
    const newCons = this.getEffectiveConsumption(buildingId);
    if (Object.keys(newProd).length > 0) {
      resources.addProduction(newProd);
    }
    if (Object.keys(newCons).length > 0) {
      resources.addConsumption(newCons);
    }

    return true;
  }

  breakBuilding(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active") return false;

    // Remove production/consumption before breaking
    const oldProd = this.getEffectiveProduction(buildingId);
    const oldCons = this.getEffectiveConsumption(buildingId);
    if (Object.keys(oldProd).length > 0) {
      resources.removeProduction(oldProd);
    }
    if (Object.keys(oldCons).length > 0) {
      resources.removeConsumption(oldCons);
    }

    building.broken = true;
    building.mode = "normal";
    return true;
  }

  getRepairCost(buildingId: string): ResourceDelta | undefined {
    const building = this.buildings.get(buildingId);
    if (!building || !building.broken) return undefined;

    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;

    const cost: ResourceDelta = {};
    for (const [key, value] of Object.entries(def.cost)) {
      if (value) cost[key as keyof ResourceDelta] = Math.ceil(value * REPAIR_COST_MULTIPLIER);
    }
    return cost;
  }

  startRepair(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || !building.broken) return false;

    const cost = this.getRepairCost(buildingId);
    if (!cost || !resources.canAfford(cost)) return false;

    resources.deduct(cost);
    building.repairProgress = 0.01; // Mark as repairing
    return true;
  }

  isRepairing(buildingId: string): boolean {
    const building = this.buildings.get(buildingId);
    return building?.broken === true && building.repairProgress > 0;
  }

  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    const building = this.buildings.get(buildingId);
    if (!building) return undefined;

    const def = this.definitions.get(building.definitionId);
    if (!def) return undefined;

    let rate: number = RECYCLING_RECOVERY_RATES.standard;

    if (building.broken) {
      rate = RECYCLING_RECOVERY_RATES.damaged;
    } else if (building.status === "idle") {
      rate = RECYCLING_RECOVERY_RATES.depleted;
    } else if (building.status === "active" && building.depositId) {
      rate = RECYCLING_RECOVERY_RATES.active;
    }

    const result: ResourceDelta = {};
    for (const [key, value] of Object.entries(def.cost)) {
      if (value) result[key as keyof ResourceDelta] = Math.floor(value * rate);
    }
    return result;
  }

  getRecycleTime(buildingId: string): number {
    const building = this.buildings.get(buildingId);
    if (!building) return 0;

    const def = this.definitions.get(building.definitionId);
    if (!def) return 0;

    return Math.ceil(def.constructionTime * RECYCLING_TIME_MULTIPLIER);
  }

  startRecycling(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status === "pending" || building.status === "recycling") return false;

    // Remove production/consumption if active
    if (building.status === "active" && !building.broken) {
      const oldProd = this.getEffectiveProduction(buildingId);
      const oldCons = this.getEffectiveConsumption(buildingId);
      if (Object.keys(oldProd).length > 0) {
        resources.removeProduction(oldProd);
      }
      if (Object.keys(oldCons).length > 0) {
        resources.removeConsumption(oldCons);
      }
    }

    building.status = "recycling";
    building.recyclingProgress = 0;
    return true;
  }

  rushRecycling(buildingId: string, resources: ResourceManager): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status !== "active" && building.status !== "idle") return false;

    // Remove production/consumption if active
    if (building.status === "active" && !building.broken) {
      const oldProd = this.getEffectiveProduction(buildingId);
      const oldCons = this.getEffectiveConsumption(buildingId);
      if (Object.keys(oldProd).length > 0) {
        resources.removeProduction(oldProd);
      }
      if (Object.keys(oldCons).length > 0) {
        resources.removeConsumption(oldCons);
      }
    }

    // Immediate completion with penalty
    const recycleValue = this.getRecycleValue(buildingId);
    if (recycleValue) {
      const penalizedValue: ResourceDelta = {};
      for (const [key, value] of Object.entries(recycleValue)) {
        if (value) {
          penalizedValue[key as keyof ResourceDelta] = Math.floor(value * (1 - RUSH_RECYCLING_PENALTY));
        }
      }
      resources.add(penalizedValue);
    }

    this.buildings.delete(buildingId);
    return true;
  }

  canRepurpose(
    buildingId: string,
    targetDefId: string,
    resources: ResourceManager,
    technology: TechnologyTree
  ): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;
    if (building.status !== "active" && building.status !== "idle") return false;
    if (building.broken) return false; // Must repair before repurposing
    if (building.assignedWorkers.length > 0) return false; // Must unassign workers first

    const currentDef = this.definitions.get(building.definitionId);
    if (!currentDef?.repurposeTargets?.includes(targetDefId)) return false;

    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return false;

    // Check tech requirements for target
    if (targetDef.requiredTech && !technology.isResearched(targetDef.requiredTech)) {
      return false;
    }

    // Check cost (30% of target building materials)
    const cost = this.getRepurposeCost(targetDefId);
    return cost ? resources.canAfford(cost) : false;
  }

  getRepurposeCost(targetDefId: string): ResourceDelta | undefined {
    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return undefined;

    const cost: ResourceDelta = {};
    for (const [key, value] of Object.entries(targetDef.cost)) {
      if (value) cost[key as keyof ResourceDelta] = Math.ceil(value * REPURPOSE_COST_MULTIPLIER);
    }
    return cost;
  }

  getRepurposeTime(targetDefId: string): number {
    const targetDef = this.definitions.get(targetDefId);
    if (!targetDef) return 0;
    return Math.ceil(targetDef.constructionTime * REPURPOSE_TIME_MULTIPLIER);
  }

  startRepurposing(
    buildingId: string,
    targetDefId: string,
    resources: ResourceManager,
    technology: TechnologyTree
  ): boolean {
    if (!this.canRepurpose(buildingId, targetDefId, resources, technology)) return false;

    const building = this.buildings.get(buildingId);
    if (!building) return false;

    // Remove production/consumption if active
    if (building.status === "active" && !building.broken) {
      const oldProd = this.getEffectiveProduction(buildingId);
      const oldCons = this.getEffectiveConsumption(buildingId);
      if (Object.keys(oldProd).length > 0) {
        resources.removeProduction(oldProd);
      }
      if (Object.keys(oldCons).length > 0) {
        resources.removeConsumption(oldCons);
      }
    }

    // Deduct cost
    const cost = this.getRepurposeCost(targetDefId);
    if (cost) resources.deduct(cost);

    // Update building
    const originalDefId = building.definitionId;
    building.definitionId = targetDefId;
    building.repurposeFromDefId = originalDefId;
    building.status = "pending";
    building.constructionProgress = 0;
    building.mode = "normal";
    building.repairProgress = 0;

    // Clear depositId during repurposing - player must re-link to appropriate deposit
    // (deposit types may not be compatible between building types)
    building.depositId = undefined;

    return true;
  }

  getBuildingMode(buildingId: string): "conservation" | "normal" | "overdrive" | undefined {
    return this.buildings.get(buildingId)?.mode;
  }

  getEffectiveProduction(buildingId: string): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.production) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].production;
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.production)) {
      if (value) result[key as keyof ResourceDelta] = value * modeMultiplier;
    }

    return result;
  }

  getEffectiveConsumption(buildingId: string): ResourceDelta {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active" || building.broken) return {};

    const def = this.definitions.get(building.definitionId);
    if (!def?.consumption) return {};

    const modeMultiplier = BUILDING_MODES[building.mode].consumption;
    const result: ResourceDelta = {};

    for (const [key, value] of Object.entries(def.consumption)) {
      if (value) result[key as keyof ResourceDelta] = value * modeMultiplier;
    }

    return result;
  }

  getDefinition(defId: string): BuildingDefinition | undefined {
    return this.definitions.get(defId);
  }

  getAllDefinitions(): BuildingDefinition[] {
    return Array.from(this.definitions.values());
  }

  getBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  getActiveBuildings(): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.status === "active");
  }

  getPendingBuildings(): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.status === "pending");
  }

  getBuildingsByDefinition(defId: string): Building[] {
    return Array.from(this.buildings.values()).filter((b) => b.definitionId === defId);
  }

  getBuildingCount(): number {
    return this.buildings.size;
  }

  getActiveBuildingCount(): number {
    return this.getActiveBuildings().length;
  }

  setConstructionSpeedBonus(bonus: number): void {
    this.constructionSpeedBonus = bonus;
  }

  assignWorker(buildingId: string, colonistId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building || building.status !== "active") return false;

    const def = this.definitions.get(building.definitionId);
    if (!def || !def.workerSlots || building.assignedWorkers.length >= def.workerSlots)
      return false;

    if (building.assignedWorkers.includes(colonistId)) return false;

    building.assignedWorkers.push(colonistId);
    return true;
  }

  removeWorker(buildingId: string, colonistId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;

    const index = building.assignedWorkers.indexOf(colonistId);
    if (index === -1) return false;

    building.assignedWorkers.splice(index, 1);
    return true;
  }

  toJSON() {
    return {
      buildings: Array.from(this.buildings.values()),
      nextId: this.nextId,
      constructionSpeedBonus: this.constructionSpeedBonus,
    };
  }

  static fromJSON(
    data: {
      buildings: Building[];
      nextId: number;
      constructionSpeedBonus: number;
    },
    defs: BuildingDefinition[],
  ): BuildingManager {
    const manager = new BuildingManager(defs);
    data.buildings.forEach((b) => {
      // Add defaults for new fields (backward compatibility)
      const building: Building = {
        ...b,
        mode: b.mode ?? "normal",
        broken: b.broken ?? false,
        repairProgress: b.repairProgress ?? 0,
        recyclingProgress: b.recyclingProgress,
        repurposeFromDefId: b.repurposeFromDefId,
      };
      manager.buildings.set(building.id, building);
    });
    manager.nextId = data.nextId;
    manager.constructionSpeedBonus = data.constructionSpeedBonus || 0;
    return manager;
  }
}
