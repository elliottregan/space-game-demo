// tests/BuildingsFacade.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingId } from "../src/core/models/Building";
import { GameAPI } from "../src/facade";

describe("BuildingsFacade", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
  });

  // Helper to build and complete a building
  const buildAndComplete = (defId: BuildingId) => {
    const result = api.buildings.build(defId);
    if (!result.success) return null;
    const def = api.buildings.getDefinition(defId);
    if (!def) return null;
    for (let i = 0; i < def.constructionTime; i++) api.game.advanceSol();
    return result.data.id;
  };

  // Helper to unassign all workers from a building
  const unassignAllWorkers = (buildingId: string) => {
    const building = api.buildings.getById(buildingId);
    if (!building) return;
    for (const colonistId of [...building.assignedWorkers]) {
      api.colony.unassignFromBuilding(colonistId);
    }
  };

  // ==========================================================================
  // Mode Operations tests
  // ==========================================================================
  describe("Mode Operations", () => {
    it("canSetMode returns true for valid mode change", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.canSetMode(buildingId!, "overdrive");
      expect(result.allowed).toBe(true);
    });

    it("canSetMode returns false when building not found", () => {
      const result = api.buildings.canSetMode("nonexistent_building", "overdrive");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("canSetMode returns false when not active", () => {
      // Build without completing
      const buildResult = api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(buildResult.success).toBe(true);

      if (buildResult.success) {
        const result = api.buildings.canSetMode(buildResult.data.id, "overdrive");
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("active");
      }
    });

    it("canSetMode returns false when same mode", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      // Default mode is normal
      const result = api.buildings.canSetMode(buildingId!, "normal");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already in");
    });

    it("setMode changes mode successfully", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.setMode(buildingId!, "overdrive");
      expect(result.success).toBe(true);

      const building = api.buildings.getById(buildingId!);
      expect(building?.mode).toBe("overdrive");
    });

    it("setMode returns error when canSetMode fails", () => {
      const result = api.buildings.setMode("nonexistent_building", "overdrive");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("INVALID_STATE");
      }
    });
  });

  // ==========================================================================
  // Recycling Operations tests
  // ==========================================================================
  describe("Recycling Operations", () => {
    it("canRecycle returns true for active building", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.canRecycle(buildingId!);
      expect(result.allowed).toBe(true);
    });

    it("canRecycle returns false when not found", () => {
      const result = api.buildings.canRecycle("nonexistent_building");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("canRecycle returns false when already recycling", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      // Start recycling
      api.buildings.recycle(buildingId!);

      const result = api.buildings.canRecycle(buildingId!);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already being recycled");
    });

    it("canRecycle returns false when pending", () => {
      const buildResult = api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(buildResult.success).toBe(true);

      if (buildResult.success) {
        const result = api.buildings.canRecycle(buildResult.data.id);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("under construction");
      }
    });

    it("recycle starts recycling", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.recycle(buildingId!);
      expect(result.success).toBe(true);

      const building = api.buildings.getById(buildingId!);
      expect(building?.status).toBe("recycling");
    });

    it("rushRecycling returns NOT_FOUND for non-existent building", () => {
      const result = api.buildings.rushRecycling("nonexistent_building");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("NOT_FOUND");
      }
    });

    it("rushRecycling returns INVALID_STATE for active building", () => {
      // Note: The facade requires status to be "recycling" before calling rushRecycling
      // but the underlying BuildingManager.rushRecycling requires "active" or "idle".
      // This tests the current facade behavior.
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      // Try to rush without starting recycle
      const result = api.buildings.rushRecycling(buildingId!);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("INVALID_STATE");
        if (result.error.type === "INVALID_STATE") {
          expect(result.error.expected).toBe("recycling");
        }
      }
    });
  });

  // ==========================================================================
  // Repurpose Operations tests
  // ==========================================================================
  describe("Repurpose Operations", () => {
    it("canRepurpose returns true for valid target", () => {
      const buildingId = buildAndComplete(BuildingId.WATER_EXTRACTOR);
      expect(buildingId).not.toBeNull();

      // Must unassign workers before repurposing
      unassignAllWorkers(buildingId!);

      const result = api.buildings.canRepurpose(buildingId!, BuildingId.STORAGE_DEPOT);
      expect(result.allowed).toBe(true);
    });

    it("canRepurpose returns false when not found", () => {
      const result = api.buildings.canRepurpose("nonexistent_building", BuildingId.STORAGE_DEPOT);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("canRepurpose returns false for invalid target", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      // Solar panel cannot be repurposed
      const result = api.buildings.canRepurpose(buildingId!, BuildingId.WATER_EXTRACTOR);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("cannot be repurposed");
    });

    it("canRepurpose returns false when tech not researched", () => {
      const buildingId = buildAndComplete(BuildingId.WATER_EXTRACTOR);
      expect(buildingId).not.toBeNull();

      // Try to repurpose to something requiring tech
      // mining_station requires asteroid_mining tech
      const result = api.buildings.canRepurpose(buildingId!, BuildingId.MINING_STATION);
      expect(result.allowed).toBe(false);
    });

    it("repurpose starts repurposing", () => {
      const buildingId = buildAndComplete(BuildingId.WATER_EXTRACTOR);
      expect(buildingId).not.toBeNull();

      // Must unassign workers before repurposing
      unassignAllWorkers(buildingId!);

      const result = api.buildings.repurpose(buildingId!, BuildingId.STORAGE_DEPOT);
      expect(result.success).toBe(true);

      const building = api.buildings.getById(buildingId!);
      expect(building?.definitionId).toBe(BuildingId.STORAGE_DEPOT);
      expect(building?.status).toBe("pending");
    });

    it("repurpose fails when canRepurpose fails", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.repurpose(buildingId!, BuildingId.WATER_EXTRACTOR);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("PREREQUISITE_NOT_MET");
      }
    });
  });

  // ==========================================================================
  // linkToDeposit() tests
  // ==========================================================================
  describe("linkToDeposit()", () => {
    it("returns NOT_FOUND when building missing", () => {
      const result = api.buildings.linkToDeposit("nonexistent_building", "site_1");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("NOT_FOUND");
        if (result.error.type === "NOT_FOUND") {
          expect(result.error.entity).toBe("building");
        }
      }
    });

    it("returns NOT_FOUND when site missing", () => {
      const buildingId = buildAndComplete(BuildingId.WATER_EXTRACTOR);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.linkToDeposit(buildingId!, "nonexistent_site");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("NOT_FOUND");
        if (result.error.type === "NOT_FOUND") {
          expect(result.error.entity).toBe("site");
        }
      }
    });

    it("returns INVALID_STATE when site not developed", () => {
      const buildingId = buildAndComplete(BuildingId.WATER_EXTRACTOR);
      expect(buildingId).not.toBeNull();

      // Get a site that is revealed but not developed
      const sites = api.operations.snapshot().sites;
      const revealedSite = sites.find((s) => s.revealed && !s.developed);

      if (revealedSite) {
        const result = api.buildings.linkToDeposit(buildingId!, revealedSite.id);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("INVALID_STATE");
          if (result.error.type === "INVALID_STATE") {
            expect(result.error.reason).toContain("developed");
          }
        }
      }
    });
  });

  // ==========================================================================
  // canDo() tests (ActionChecker interface)
  // ==========================================================================
  describe("canDo() ActionChecker", () => {
    it("routes build action to canBuild", () => {
      const result = api.buildings.canDo({ action: "build", defId: BuildingId.SOLAR_PANEL });
      expect(result.allowed).toBe(true);
    });

    it("routes recycle action to canRecycle", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const result = api.buildings.canDo({ action: "recycle", buildingId: buildingId! });
      expect(result.allowed).toBe(true);
    });

    it("routes repurpose action to canRepurpose", () => {
      const buildingId = buildAndComplete(BuildingId.WATER_EXTRACTOR);
      expect(buildingId).not.toBeNull();

      // Must unassign workers before repurposing
      unassignAllWorkers(buildingId!);

      const result = api.buildings.canDo({
        action: "repurpose",
        buildingId: buildingId!,
        targetDefId: BuildingId.STORAGE_DEPOT,
      });
      expect(result.allowed).toBe(true);
    });
  });

  // ==========================================================================
  // getRecycleValue() tests
  // ==========================================================================
  describe("getRecycleValue()", () => {
    it("returns value for active building", () => {
      const buildingId = buildAndComplete(BuildingId.SOLAR_PANEL);
      expect(buildingId).not.toBeNull();

      const value = api.buildings.getRecycleValue(buildingId!);
      expect(value).toBeDefined();
      expect(value?.materials).toBeGreaterThan(0);
    });

    it("returns undefined for non-existent building", () => {
      const value = api.buildings.getRecycleValue("nonexistent_building");
      expect(value).toBeUndefined();
    });
  });

  // ==========================================================================
  // getRepurposeCost() tests
  // ==========================================================================
  describe("getRepurposeCost()", () => {
    it("returns cost for valid target", () => {
      const cost = api.buildings.getRepurposeCost(BuildingId.STORAGE_DEPOT);
      expect(cost).toBeDefined();
      expect(cost?.materials).toBeGreaterThan(0);
    });

    it("returns undefined for non-existent target", () => {
      const cost = api.buildings.getRepurposeCost("nonexistent_building_type" as BuildingId);
      expect(cost).toBeUndefined();
    });
  });

  // ==========================================================================
  // snapshot() tests
  // ==========================================================================
  describe("snapshot()", () => {
    it("returns snapshot with all fields", () => {
      const snapshot = api.buildings.snapshot();

      expect(snapshot.active).toBeDefined();
      expect(snapshot.pending).toBeDefined();
      expect(snapshot.definitions).toBeDefined();
      expect(typeof snapshot.moraleBoost).toBe("number");
    });

    it("returns frozen arrays", () => {
      const snapshot = api.buildings.snapshot();

      expect(Object.isFrozen(snapshot.active)).toBe(true);
      expect(Object.isFrozen(snapshot.pending)).toBe(true);
      expect(Object.isFrozen(snapshot.definitions)).toBe(true);
    });

    it("includes built buildings in appropriate arrays", () => {
      const initialPending = api.buildings.snapshot().pending.length;

      api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(api.buildings.snapshot().pending.length).toBe(initialPending + 1);

      // Complete construction
      const def = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      for (let i = 0; i < def!.constructionTime; i++) {
        api.game.advanceSol();
      }

      // Should move to active
      const snapshot = api.buildings.snapshot();
      expect(snapshot.active.some((b) => b.definitionId === BuildingId.SOLAR_PANEL)).toBe(true);
    });
  });

  // ==========================================================================
  // getById() tests
  // ==========================================================================
  describe("getById()", () => {
    it("returns building when found", () => {
      const buildResult = api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(buildResult.success).toBe(true);

      if (buildResult.success) {
        const building = api.buildings.getById(buildResult.data.id);
        expect(building).toBeDefined();
        expect(building?.id).toBe(buildResult.data.id);
      }
    });

    it("returns undefined when not found", () => {
      const building = api.buildings.getById("nonexistent_building");
      expect(building).toBeUndefined();
    });
  });

  // ==========================================================================
  // getDefinition() tests
  // ==========================================================================
  describe("getDefinition()", () => {
    it("returns definition when found", () => {
      const def = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      expect(def).toBeDefined();
      expect(def?.id).toBe(BuildingId.SOLAR_PANEL);
      expect(def?.name).toBeDefined();
    });

    it("returns undefined when not found", () => {
      const def = api.buildings.getDefinition("nonexistent_type" as BuildingId);
      expect(def).toBeUndefined();
    });
  });

  // ==========================================================================
  // canBuild() tests
  // ==========================================================================
  describe("canBuild()", () => {
    it("returns allowed:true for valid building", () => {
      const result = api.buildings.canBuild(BuildingId.SOLAR_PANEL);
      expect(result.allowed).toBe(true);
    });

    it("returns allowed:false for non-existent building type", () => {
      const result = api.buildings.canBuild("nonexistent_type" as BuildingId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("returns allowed:false when tech not researched", () => {
      // mining_station requires asteroid_mining tech
      const result = api.buildings.canBuild(BuildingId.MINING_STATION);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Requires technology");
    });

    it("returns allowed:false when cannot afford", () => {
      // Deplete resources
      for (let i = 0; i < 30; i++) {
        api.buildings.build(BuildingId.SOLAR_PANEL);
      }

      const result = api.buildings.canBuild(BuildingId.HABITAT);
      expect(result.allowed).toBe(false);
    });
  });

  // ==========================================================================
  // build() tests
  // ==========================================================================
  describe("build()", () => {
    it("returns success and building data", () => {
      const result = api.buildings.build(BuildingId.SOLAR_PANEL);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.definitionId).toBe(BuildingId.SOLAR_PANEL);
        expect(result.data.status).toBe("pending");
      }
    });

    it("fails for non-existent type", () => {
      const result = api.buildings.build("nonexistent_type" as BuildingId);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.type).toBe("PREREQUISITE_NOT_MET");
      }
    });

    it("deducts resources on success", () => {
      const resourcesBefore = api.resources.snapshot().current.materials ?? 0;
      const def = api.buildings.getDefinition(BuildingId.SOLAR_PANEL);
      const cost = def?.cost.materials ?? 0;

      api.buildings.build(BuildingId.SOLAR_PANEL);

      const resourcesAfter = api.resources.snapshot().current.materials ?? 0;
      expect(resourcesAfter).toBe(resourcesBefore - cost);
    });
  });
});
