import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { WorkforceManager } from "../src/core/systems/WorkforceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { BUILDINGS } from "../src/core/data/buildings";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import { ColonistRole } from "../src/core/models/Colonist";
import { TechnologyId } from "../src/core/models/Technology";

describe("Research Buildings", () => {
  let buildings: BuildingManager;
  let resources: ResourceManager;
  let colony: ColonyManager;
  let workforce: WorkforceManager;
  let mockTech: TechnologyTree;

  beforeEach(() => {
    buildings = new BuildingManager(BUILDINGS);
    resources = new ResourceManager({
      food: 500,
      water: 500,
      materials: 500,
    });
    colony = new ColonyManager(0);
    workforce = new WorkforceManager();
    mockTech = { isResearched: () => true } as unknown as TechnologyTree;

    buildings.setColonistQueries(colony);
    buildings.setWorkforceQueries(workforce);
  });

  describe("getTotalResearchOutput", () => {
    it("should return 0 when no research buildings exist", () => {
      expect(buildings.getTotalResearchOutput()).toBe(0);
    });

    it("should return research output from active Science Station", () => {
      const building = buildings.startBuilding(BuildingId.SCIENCE_STATION, resources, mockTech);
      expect(building).not.toBeNull();

      // Complete construction
      const def = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < def.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Without workers, output is 0 (staffing efficiency = 0)
      expect(buildings.getTotalResearchOutput()).toBe(0);
    });

    it("should return full output when fully staffed", () => {
      const building = buildings.startBuilding(BuildingId.SCIENCE_STATION, resources, mockTech);
      expect(building).not.toBeNull();
      const id = building!.id;

      // Complete construction
      const def = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < def.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Add colonists with RESEARCH role and assign them
      // Note: New colonists are NOVICE (0.7 efficiency), but with matching role no penalty
      // Skills add random bonuses (0-0.2), so expect range 0.7 to 0.9
      const c1 = colony.addColonist();
      const c2 = colony.addColonist();
      const c3 = colony.addColonist();
      const c4 = colony.addColonist();
      c1.role = ColonistRole.RESEARCH;
      c2.role = ColonistRole.RESEARCH;
      c3.role = ColonistRole.RESEARCH;
      c4.role = ColonistRole.RESEARCH;
      buildings.assignWorker(id, c1.id);
      buildings.assignWorker(id, c2.id);
      buildings.assignWorker(id, c3.id);
      buildings.assignWorker(id, c4.id);

      // Fully staffed Science Station with novice RESEARCH workers:
      // Base: researchOutput (1.0) * staffing (1.0) * noviceMastery (0.7)
      // With skill bonuses, expect 0.7 to 0.9 (capped skill bonus is 0.2)
      const output = buildings.getTotalResearchOutput();
      expect(output).toBeGreaterThanOrEqual(0.7);
      expect(output).toBeLessThanOrEqual(0.9);
    });

    it("should sum output from multiple research buildings", () => {
      // Build Science Station
      const ss1 = buildings.startBuilding(BuildingId.SCIENCE_STATION, resources, mockTech);
      const ssId = ss1!.id;
      const ssDef = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < ssDef.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Add RESEARCH workers to Science Station
      const c1 = colony.addColonist();
      const c2 = colony.addColonist();
      c1.role = ColonistRole.RESEARCH;
      c2.role = ColonistRole.RESEARCH;
      buildings.assignWorker(ssId, c1.id);
      buildings.assignWorker(ssId, c2.id);

      const firstStationOutput = buildings.getTotalResearchOutput();

      // Build another Science Station
      const ss2 = buildings.startBuilding(BuildingId.SCIENCE_STATION, resources, mockTech);
      const ss2Id = ss2!.id;
      for (let i = 0; i < ssDef.constructionTime; i++) {
        buildings.tick(resources, i + ssDef.constructionTime);
      }

      // Add RESEARCH workers to second Science Station
      const c3 = colony.addColonist();
      const c4 = colony.addColonist();
      c3.role = ColonistRole.RESEARCH;
      c4.role = ColonistRole.RESEARCH;
      buildings.assignWorker(ss2Id, c3.id);
      buildings.assignWorker(ss2Id, c4.id);

      // Two fully staffed Science Stations should produce more than one
      // (Exact values depend on random skill assignments)
      const totalOutput = buildings.getTotalResearchOutput();
      expect(totalOutput).toBeGreaterThan(firstStationOutput);
      expect(totalOutput).toBeGreaterThan(1.0); // Should be at least 1.0 with two buildings
    });
  });

  describe("Integration: Research Progress", () => {
    it("should require research building for tech progress", () => {
      const tree = new TechnologyTree(TECHNOLOGIES);

      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // No research buildings = 0 output
      const researchRate = buildings.getTotalResearchOutput();
      expect(researchRate).toBe(0);

      // Tick with 0 rate
      tree.tick(resources, researchRate);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBe(0);
    });

    it("should progress research when Science Station is active and staffed", () => {
      const tree = new TechnologyTree(TECHNOLOGIES);

      // Build and staff Science Station
      const ssBuilding = buildings.startBuilding(BuildingId.SCIENCE_STATION, resources, mockTech);
      const ssId = ssBuilding!.id;
      const ssDef = buildings.getDefinition(BuildingId.SCIENCE_STATION)!;
      for (let i = 0; i < ssDef.constructionTime; i++) {
        buildings.tick(resources, i);
      }

      // Add colonists with RESEARCH role and assign them
      const c1 = colony.addColonist();
      c1.role = ColonistRole.RESEARCH;
      const c2 = colony.addColonist();
      c2.role = ColonistRole.RESEARCH;
      buildings.assignWorker(ssId, c1.id);
      buildings.assignWorker(ssId, c2.id);

      // Start research
      tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

      // Get research rate and tick
      const researchRate = buildings.getTotalResearchOutput();
      expect(researchRate).toBeGreaterThan(0);

      tree.tick(resources, researchRate);

      expect(tree.getResearchProgress(TechnologyId.WATER_RECYCLING)).toBeGreaterThan(0);
    });
  });
});
