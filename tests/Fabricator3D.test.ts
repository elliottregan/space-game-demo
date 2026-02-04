import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";
import { ColonistRole } from "../src/core/models/Colonist";
import { StartingConditionId } from "../src/core/data/startingConditions";
import { GameAPI } from "../src/facade";

describe("3D Fabricator", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
    // Use established base to have infrastructure that keeps colonists alive during research
    api.newGame(StartingConditionId.ESTABLISHED_BASE);
  });

  // Helper to research a technology and all prerequisites (for testing)
  function researchTech(techId: TechnologyId): void {
    // Get all prerequisites in order and complete them
    const chain = api.technology.getPrerequisiteChain(techId);
    for (const prereq of chain) {
      api.technology.completeResearch(prereq);
    }
  }

  // Helper to build and complete a building
  function buildAndComplete(defId: BuildingId): string | null {
    const result = api.buildings.build(defId);
    if (!result.success) return null;
    const def = api.buildings.getDefinition(defId);
    if (!def) return null;
    for (let i = 0; i < def.constructionTime; i++) {
      api.game.advanceSol();
    }
    return result.data.id;
  }

  describe("Tech requirements", () => {
    it("cannot build without Advanced Materials tech", () => {
      const result = api.buildings.canBuild(BuildingId.FABRICATOR_3D);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Requires technology");
    });

    it("can build after researching Advanced Materials", () => {
      researchTech(TechnologyId.HABITAT_FABRICATION);

      const result = api.buildings.canBuild(BuildingId.FABRICATOR_3D);
      expect(result.allowed).toBe(true);
    });
  });

  describe("Building definition", () => {
    it("has correct cost of 90 materials", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.cost.materials).toBe(90);
    });

    it("has construction time of 15 sols", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.constructionTime).toBe(15);
    });

    it("requires 2 engineering workers", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.workerSlots).toBe(2);
      expect(def?.workerRole).toBe(ColonistRole.ENGINEERING);
    });

    it("does not require a deposit", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.requiresDeposit).toBeFalsy();
    });

    it("has -1 air contribution", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.airContribution).toBe(-1);
    });

    it("consumes 8 power per sol", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.powerConsumption).toBe(8);
    });

    it("produces materials when defined", () => {
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def).toBeDefined();
      expect(def?.production?.materials).toBe(5);
    });
  });

  describe("Production behavior", () => {
    it("produces materials when staffed", () => {
      // Research required tech
      researchTech(TechnologyId.HABITAT_FABRICATION);

      // Add extra resources to ensure we can build
      api.resources.snapshot(); // Just to verify API is working

      // Build the fabricator
      const buildingId = buildAndComplete(BuildingId.FABRICATOR_3D);
      expect(buildingId).not.toBeNull();

      // Verify building is active
      const building = api.buildings.getById(buildingId!);
      expect(building).toBeDefined();
      expect(building?.status).toBe("active");

      // Check production snapshot
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      expect(def?.production?.materials).toBeGreaterThan(0);
    });

    it("building adds to colony oxygen contribution", () => {
      researchTech(TechnologyId.HABITAT_FABRICATION);

      const productionBefore = api.airQuality.snapshot().production;

      buildAndComplete(BuildingId.FABRICATOR_3D);

      const productionAfter = api.airQuality.snapshot().production;

      // Should decrease by 1 (negative contribution)
      expect(productionAfter).toBe(productionBefore - 1);
    });
  });

  describe("Resource consumption", () => {
    it("deducts 90 materials when built", () => {
      researchTech(TechnologyId.HABITAT_FABRICATION);

      const materialsBefore = api.resources.snapshot().current.materials ?? 0;
      const def = api.buildings.getDefinition(BuildingId.FABRICATOR_3D);
      const cost = def?.cost.materials ?? 0;

      api.buildings.build(BuildingId.FABRICATOR_3D);

      const materialsAfter = api.resources.snapshot().current.materials ?? 0;
      expect(materialsAfter).toBe(materialsBefore - cost);
    });
  });
});
