import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingId } from "../src/core/models/Building";
import { TechnologyId } from "../src/core/models/Technology";
import { GameAPI } from "../src/facade";

describe("GameAPI", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
  });

  describe("Resource Queries", () => {
    it("should return resource snapshot", () => {
      const resources = api.resources.snapshot();
      expect(resources.current).toBeDefined();
      expect(resources.production).toBeDefined();
      expect(resources.consumption).toBeDefined();
      expect(resources.netFlow).toBeDefined();
    });

    it("should check affordability correctly", () => {
      expect(api.resources.canAfford({ materials: 10 })).toBe(true);
      expect(api.resources.canAfford({ materials: 10000 })).toBe(false);
    });

    it("should return detailed affordability check", () => {
      const affordable = api.resources.checkAffordability({ materials: 10 });
      expect(affordable.allowed).toBe(true);

      const notAffordable = api.resources.checkAffordability({ materials: 10000 });
      expect(notAffordable.allowed).toBe(false);
      expect(notAffordable.missingResources).toBeDefined();
      expect(notAffordable.missingResources?.materials).toBeGreaterThan(0);
    });
  });

  describe("Building Queries", () => {
    it("should return building snapshot", () => {
      const buildings = api.buildings.snapshot();
      expect(buildings.active).toBeDefined();
      expect(buildings.pending).toBeDefined();
      expect(buildings.definitions).toBeDefined();
      expect(buildings.definitions.length).toBeGreaterThan(0);
    });

    it("should get building definition by ID", () => {
      const def = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      expect(def).toBeDefined();
      expect(def?.name).toBe("Solar Panel Array");
    });

    it("should check if can build", () => {
      const check = api.buildings.canBuild(BuildingId.SOLAR_PANEL);
      // Should be able to build solar panel with starting resources
      expect(check.allowed).toBe(true);
    });

    it("should return reason when cannot build", () => {
      const check = api.buildings.canBuild("nonexistent_building" as BuildingId);
      expect(check.allowed).toBe(false);
      expect(check.reason).toBeDefined();
    });
  });

  describe("Building Commands", () => {
    it("should build structure successfully", () => {
      const result = api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.definitionId).toBe(BuildingId.SOLAR_PANEL);
        expect(result.data.status).toBe("pending");
      }
    });

    it("should fail to build with insufficient resources", () => {
      // Build many structures to deplete resources
      for (let i = 0; i < 20; i++) {
        api.buildings.build(BuildingId.SOLAR_PANEL);
      }

      const result = api.buildings.build(BuildingId.BASIC_FARM);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBeDefined();
      }
    });

    it("should fail to build nonexistent building type", () => {
      const result = api.buildings.build("nonexistent" as BuildingId);
      expect(result.success).toBe(false);
    });
  });

  describe("Technology Queries", () => {
    it("should return technology snapshot", () => {
      const techs = api.technology.snapshot();
      expect(techs.all).toBeDefined();
      expect(techs.available).toBeDefined();
      expect(techs.researched).toBeDefined();
      expect(techs.all.length).toBeGreaterThan(0);
    });

    it("should check research prerequisites", () => {
      // robotics requires habitat_fabrication
      const check = api.technology.canResearch(TechnologyId.ROBOTICS);
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain("prerequisite");
    });
  });

  describe("Technology Commands", () => {
    it("should start research on available tech", () => {
      const techs = api.technology.snapshot();
      const availableTech = techs.available[0];
      if (availableTech) {
        const result = api.technology.startResearch(availableTech.id);
        expect(result.success).toBe(true);

        const current = api.technology.snapshot().currentResearch;
        expect(current).toBeDefined();
        expect(current?.techId).toBe(availableTech.id);
      }
    });

    it("should fail to research when already researching", () => {
      const techs = api.technology.snapshot();
      if (techs.available.length >= 2) {
        api.technology.startResearch(techs.available[0]!.id);
        const result = api.technology.startResearch(techs.available[1]!.id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("PREREQUISITE_NOT_MET");
        }
      }
    });

    it("should cancel research", () => {
      const techs = api.technology.snapshot();
      if (techs.available.length > 0) {
        api.technology.startResearch(techs.available[0]!.id);
        const result = api.technology.cancelResearch();
        expect(result.success).toBe(true);
        expect(api.technology.snapshot().currentResearch).toBeNull();
      }
    });
  });

  describe("Colony Queries", () => {
    it("should return colony snapshot", () => {
      const colony = api.colony.snapshot();
      expect(colony.population).toBeGreaterThan(0);
      expect(colony.health).toBeDefined();
      expect(colony.morale).toBeDefined();
      expect(colony.colonists).toBeDefined();
    });

    it("should get colonists by role", () => {
      const colony = api.colony.snapshot();
      const unassigned = api.colony.getColonistsByRole("unassigned" as any);
      expect(unassigned.length).toBeLessThanOrEqual(colony.colonists.length);
    });
  });

  describe("Politics Queries", () => {
    it("should return politics snapshot", () => {
      const politics = api.politics.snapshot();
      expect(politics.factions).toBeDefined();
      expect(politics.factions.length).toBeGreaterThan(0);
      // Each faction should have factionId, name, support, and position
      const faction = politics.factions[0]!;
      expect(faction.factionId).toBeDefined();
      expect(faction.name).toBeDefined();
      expect(typeof faction.support).toBe("number");
      expect(faction.position).toBeDefined();
    });
  });

  describe("Operations Queries", () => {
    it("should return operations snapshot", () => {
      const ops = api.operations.snapshot();
      expect(ops.expeditions).toBeDefined();
      expect(ops.sites).toBeDefined();
    });
  });

  describe("Game Flow Commands", () => {
    it("should advance one sol", () => {
      const initialSol = api.game.currentSol();
      const result = api.game.advanceSol();
      expect(result.success).toBe(true);
      expect(api.game.currentSol()).toBe(initialSol + 1);
    });

    it("should advance multiple sols", () => {
      const initialSol = api.game.currentSol();
      const result = api.game.advanceSols(5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.solsAdvanced).toBeLessThanOrEqual(5);
        expect(api.game.currentSol()).toBe(initialSol + result.data.solsAdvanced);
      }
    });

    it("should track victory state", () => {
      const victory = api.game.victoryState();
      expect(victory.status).toBe("playing");
      expect(api.game.isGameOver()).toBe(false);
    });
  });

  describe("State Change Notifications", () => {
    it("should notify listeners on state change", () => {
      let notified = false;
      api.onStateChange(() => {
        notified = true;
      });

      api.game.advanceSol();
      expect(notified).toBe(true);
    });

    it("should allow unsubscribing from notifications", () => {
      let count = 0;
      const unsubscribe = api.onStateChange(() => {
        count++;
      });

      api.game.advanceSol();
      expect(count).toBe(1);

      unsubscribe();
      api.game.advanceSol();
      expect(count).toBe(1); // Should not have incremented
    });
  });

  describe("Persistence", () => {
    it("should save and load game state", () => {
      // Advance some sols and build something
      api.game.advanceSols(5);
      api.buildings.build(BuildingId.SOLAR_PANEL);

      const savedSol = api.game.currentSol();
      const savedBuildings =
        api.buildings.snapshot().pending.length + api.buildings.snapshot().active.length;

      const saveData = api.save();
      expect(saveData).toBeDefined();

      // Start new game
      api.newGame();
      expect(api.game.currentSol()).toBe(0);

      // Load saved game
      const result = api.load(saveData);
      expect(result.success).toBe(true);
      expect(api.game.currentSol()).toBe(savedSol);
    });

    it("should fail to load invalid save data", () => {
      const result = api.load("invalid json");
      expect(result.success).toBe(false);
    });
  });

  describe("Result Type Safety", () => {
    it("should return typed errors", () => {
      const result = api.buildings.build("nonexistent" as BuildingId);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Type narrowing works
        expect(result.error.type).toBeDefined();
        expect(typeof result.error.type).toBe("string");
      }
    });

    it("should return typed success data", () => {
      const result = api.buildings.build(BuildingId.SOLAR_PANEL);
      if (result.success) {
        // Type narrowing works - data is Building type
        expect(result.data.id).toBeDefined();
        expect(result.data.definitionId).toBe(BuildingId.SOLAR_PANEL);
        expect(result.data.status).toBeDefined();
      }
    });
  });

  describe("Immutability", () => {
    it("should return frozen snapshots", () => {
      const resources = api.resources.snapshot();
      expect(Object.isFrozen(resources.current)).toBe(true);

      const buildings = api.buildings.snapshot();
      expect(Object.isFrozen(buildings.active)).toBe(true);
      expect(Object.isFrozen(buildings.definitions)).toBe(true);
    });
  });

  describe("State Reactivity", () => {
    it("should reflect new pending building immediately after build command", () => {
      const initialPending = api.buildings.snapshot().pending.length;

      const result = api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(result.success).toBe(true);

      // The next snapshot call should immediately show the new building
      const newPending = api.buildings.snapshot().pending.length;
      expect(newPending).toBe(initialPending + 1);
    });

    it("should notify state change listener when building is built", () => {
      let notificationCount = 0;
      api.onStateChange(() => {
        notificationCount++;
      });

      api.buildings.build(BuildingId.SOLAR_PANEL);

      expect(notificationCount).toBe(1);
    });

    it("should accumulate multiple buildings in snapshot", () => {
      const initialPending = api.buildings.snapshot().pending.length;

      api.buildings.build(BuildingId.SOLAR_PANEL);
      api.buildings.build(BuildingId.SOLAR_PANEL);
      api.buildings.build(BuildingId.SOLAR_PANEL);

      const finalPending = api.buildings.snapshot().pending.length;
      expect(finalPending).toBe(initialPending + 3);
    });

    it("should update building counts correctly after each build", () => {
      // Track pending count after each build
      const counts: number[] = [];

      api.onStateChange(() => {
        counts.push(api.buildings.snapshot().pending.length);
      });

      api.buildings.build(BuildingId.SOLAR_PANEL);
      api.buildings.build(BuildingId.SOLAR_PANEL);

      // Each notification should see the updated count
      expect(counts).toEqual([1, 2]);
    });

    it("should reflect resource changes after building", () => {
      const initialMaterials = api.resources.snapshot().current.materials ?? 0;
      const solarPanelDef = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      const cost = solarPanelDef?.cost.materials ?? 0;

      api.buildings.build(BuildingId.SOLAR_PANEL);

      const newMaterials = api.resources.snapshot().current.materials ?? 0;
      expect(newMaterials).toBe(initialMaterials - cost);
    });

    it("should show building in active list after construction completes", () => {
      api.buildings.build(BuildingId.SOLAR_PANEL);
      const solarPanelDef = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      const buildTime = solarPanelDef?.constructionTime ?? 1;

      // Advance time to complete construction
      for (let i = 0; i < buildTime; i++) {
        api.game.advanceSol();
      }

      const snapshot = api.buildings.snapshot();
      const activeSolarPanels = snapshot.active.filter(
        (b) => b.definitionId === BuildingId.SOLAR_PANEL,
      );
      expect(activeSolarPanels.length).toBeGreaterThan(0);
    });

    it("should move building from pending to active after completion", () => {
      const initialActive = api.buildings.snapshot().active.length;
      const initialPending = api.buildings.snapshot().pending.length;

      api.buildings.build(BuildingId.SOLAR_PANEL);

      // Verify it's in pending
      expect(api.buildings.snapshot().pending.length).toBe(initialPending + 1);
      expect(api.buildings.snapshot().active.length).toBe(initialActive);

      // Complete construction
      const solarPanelDef = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      const buildTime = solarPanelDef?.constructionTime ?? 1;
      for (let i = 0; i < buildTime; i++) {
        api.game.advanceSol();
      }

      // Verify it moved to active
      expect(api.buildings.snapshot().active.length).toBe(initialActive + 1);
      // Pending should be back to initial (the built one moved to active)
      expect(api.buildings.snapshot().pending.length).toBe(initialPending);
    });
  });
});
