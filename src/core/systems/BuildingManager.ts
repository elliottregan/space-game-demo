import type { GameEvent } from "../models/GameEvent";
import type { Building, BuildingDefinition } from "../models/Building";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";

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

    for (const building of this.buildings.values()) {
      const def = this.definitions.get(building.definitionId);
      if (!def) continue;

      if (building.status === "pending") {
        const speedMultiplier = 1.0 + this.constructionSpeedBonus;
        building.constructionProgress += speedMultiplier;

        if (building.constructionProgress >= def.constructionTime) {
          building.status = "active";
          building.constructionProgress = def.constructionTime;

          if (def.production) {
            resources.addProduction(def.production);
          }
          if (def.consumption) {
            resources.addConsumption(def.consumption);
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
    }

    return events;
  }

  canBuild(
    defId: string,
    resources: ResourceManager,
    technology: TechnologyTree,
  ): boolean {
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
    };

    this.buildings.set(building.id, building);
    return building;
  }

  getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
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
    return Array.from(this.buildings.values()).filter(
      (b) => b.status === "active",
    );
  }

  getPendingBuildings(): Building[] {
    return Array.from(this.buildings.values()).filter(
      (b) => b.status === "pending",
    );
  }

  getBuildingsByDefinition(defId: string): Building[] {
    return Array.from(this.buildings.values()).filter(
      (b) => b.definitionId === defId,
    );
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
    data.buildings.forEach((b) => manager.buildings.set(b.id, b));
    manager.nextId = data.nextId;
    manager.constructionSpeedBonus = data.constructionSpeedBonus || 0;
    return manager;
  }
}
