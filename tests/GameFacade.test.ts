import { describe, it, expect, beforeEach } from "bun:test";
import { GameFacade } from "../src/core/facade";

describe("GameFacade", () => {
  let facade: GameFacade;

  beforeEach(() => {
    facade = new GameFacade();
  });

  describe("Resource Queries", () => {
    it("should return resource snapshot", () => {
      const resources = facade.resources();
      expect(resources.current).toBeDefined();
      expect(resources.production).toBeDefined();
      expect(resources.consumption).toBeDefined();
      expect(resources.netFlow).toBeDefined();
    });

    it("should check affordability correctly", () => {
      expect(facade.canAfford({ materials: 10 })).toBe(true);
      expect(facade.canAfford({ materials: 10000 })).toBe(false);
    });

    it("should return detailed affordability check", () => {
      const affordable = facade.checkAffordability({ materials: 10 });
      expect(affordable.allowed).toBe(true);

      const notAffordable = facade.checkAffordability({ materials: 10000 });
      expect(notAffordable.allowed).toBe(false);
      expect(notAffordable.missingResources).toBeDefined();
      expect(notAffordable.missingResources?.materials).toBeGreaterThan(0);
    });
  });

  describe("Building Queries", () => {
    it("should return building snapshot", () => {
      const buildings = facade.buildings();
      expect(buildings.active).toBeDefined();
      expect(buildings.pending).toBeDefined();
      expect(buildings.definitions).toBeDefined();
      expect(buildings.definitions.length).toBeGreaterThan(0);
    });

    it("should get building definition by ID", () => {
      const def = facade.getBuildingDefinition("solar_panel");
      expect(def).toBeDefined();
      expect(def?.name).toBe("Solar Panel Array");
    });

    it("should check if can build", () => {
      const check = facade.canBuild("solar_panel");
      // Should be able to build solar panel with starting resources
      expect(check.allowed).toBe(true);
    });

    it("should return reason when cannot build", () => {
      const check = facade.canBuild("nonexistent_building");
      expect(check.allowed).toBe(false);
      expect(check.reason).toBeDefined();
    });
  });

  describe("Building Commands", () => {
    it("should build structure successfully", () => {
      const result = facade.buildStructure("solar_panel");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.definitionId).toBe("solar_panel");
        expect(result.data.status).toBe("pending");
      }
    });

    it("should fail to build with insufficient resources", () => {
      // Build many structures to deplete resources
      for (let i = 0; i < 20; i++) {
        facade.buildStructure("solar_panel");
      }

      const result = facade.buildStructure("habitat");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBeDefined();
      }
    });

    it("should fail to build nonexistent building type", () => {
      const result = facade.buildStructure("nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("Technology Queries", () => {
    it("should return technology snapshot", () => {
      const techs = facade.technologies();
      expect(techs.all).toBeDefined();
      expect(techs.available).toBeDefined();
      expect(techs.researched).toBeDefined();
      expect(techs.all.length).toBeGreaterThan(0);
    });

    it("should check research prerequisites", () => {
      // robotics requires advanced_materials
      const check = facade.canResearch("robotics");
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("prerequisite");
    });
  });

  describe("Technology Commands", () => {
    it("should start research on available tech", () => {
      const techs = facade.technologies();
      const availableTech = techs.available[0];
      if (availableTech) {
        const result = facade.startResearch(availableTech.id);
        expect(result.success).toBe(true);

        const current = facade.technologies().currentResearch;
        expect(current).toBeDefined();
        expect(current?.techId).toBe(availableTech.id);
      }
    });

    it("should fail to research when already researching", () => {
      const techs = facade.technologies();
      if (techs.available.length >= 2) {
        facade.startResearch(techs.available[0].id);
        const result = facade.startResearch(techs.available[1].id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("PREREQUISITE_NOT_MET");
        }
      }
    });

    it("should cancel research", () => {
      const techs = facade.technologies();
      if (techs.available.length > 0) {
        facade.startResearch(techs.available[0].id);
        const result = facade.cancelResearch();
        expect(result.success).toBe(true);
        expect(facade.technologies().currentResearch).toBeNull();
      }
    });
  });

  describe("Colony Queries", () => {
    it("should return colony snapshot", () => {
      const colony = facade.colony();
      expect(colony.population).toBeGreaterThan(0);
      expect(colony.health).toBeDefined();
      expect(colony.morale).toBeDefined();
      expect(colony.colonists).toBeDefined();
    });

    it("should get colonists by role", () => {
      const colony = facade.colony();
      const unassigned = facade.getColonistsByRole("unassigned" as any);
      expect(unassigned.length).toBeLessThanOrEqual(colony.colonists.length);
    });
  });

  describe("Politics Queries", () => {
    it("should return politics snapshot", () => {
      const politics = facade.politics();
      expect(politics.factions).toBeDefined();
      expect(politics.averageSupport).toBeDefined();
      expect(politics.decisions).toBeDefined();
    });
  });

  describe("Operations Queries", () => {
    it("should return operations snapshot", () => {
      const ops = facade.operations();
      expect(ops.policies).toBeDefined();
      expect(ops.policyCooldownRemaining).toBeDefined();
      expect(ops.expeditions).toBeDefined();
      expect(ops.sites).toBeDefined();
    });

    it("should check policy cooldown", () => {
      const check = facade.canChangePolicy();
      // At sol 0, should be able to change policy
      expect(check.allowed).toBe(true);
    });
  });

  describe("Game Flow Commands", () => {
    it("should advance one sol", () => {
      const initialSol = facade.currentSol();
      const result = facade.advanceSol();
      expect(result.success).toBe(true);
      expect(facade.currentSol()).toBe(initialSol + 1);
    });

    it("should advance multiple sols", () => {
      const initialSol = facade.currentSol();
      const result = facade.advanceSols(5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.solsAdvanced).toBeLessThanOrEqual(5);
        expect(facade.currentSol()).toBe(initialSol + result.data.solsAdvanced);
      }
    });

    it("should track victory state", () => {
      const victory = facade.victoryState();
      expect(victory.status).toBe("playing");
      expect(facade.isGameOver()).toBe(false);
    });
  });

  describe("State Change Notifications", () => {
    it("should notify listeners on state change", () => {
      let notified = false;
      facade.onStateChange(() => {
        notified = true;
      });

      facade.advanceSol();
      expect(notified).toBe(true);
    });

    it("should allow unsubscribing from notifications", () => {
      let count = 0;
      const unsubscribe = facade.onStateChange(() => {
        count++;
      });

      facade.advanceSol();
      expect(count).toBe(1);

      unsubscribe();
      facade.advanceSol();
      expect(count).toBe(1); // Should not have incremented
    });
  });

  describe("Persistence", () => {
    it("should save and load game state", () => {
      // Advance some sols and build something
      facade.advanceSols(5);
      facade.buildStructure("solar_panel");

      const savedSol = facade.currentSol();
      const savedBuildings = facade.buildings().pending.length + facade.buildings().active.length;

      const saveData = facade.saveGame();
      expect(saveData).toBeDefined();

      // Start new game
      facade.newGame();
      expect(facade.currentSol()).toBe(0);

      // Load saved game
      const result = facade.loadGame(saveData);
      expect(result.success).toBe(true);
      expect(facade.currentSol()).toBe(savedSol);
    });

    it("should fail to load invalid save data", () => {
      const result = facade.loadGame("invalid json");
      expect(result.success).toBe(false);
    });
  });

  describe("Result Type Safety", () => {
    it("should return typed errors", () => {
      const result = facade.buildStructure("nonexistent");
      expect(result.success).toBe(false);
      if (!result.success) {
        // Type narrowing works
        expect(result.error.type).toBeDefined();
        expect(typeof result.error.type).toBe("string");
      }
    });

    it("should return typed success data", () => {
      const result = facade.buildStructure("solar_panel");
      if (result.success) {
        // Type narrowing works - data is Building type
        expect(result.data.id).toBeDefined();
        expect(result.data.definitionId).toBe("solar_panel");
        expect(result.data.status).toBeDefined();
      }
    });
  });

  describe("Immutability", () => {
    it("should return frozen snapshots", () => {
      const resources = facade.resources();
      expect(Object.isFrozen(resources.current)).toBe(true);

      const buildings = facade.buildings();
      expect(Object.isFrozen(buildings.active)).toBe(true);
      expect(Object.isFrozen(buildings.definitions)).toBe(true);
    });
  });
});
