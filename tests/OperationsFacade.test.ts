// tests/OperationsFacade.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { BuildingId } from "../src/core/models/Building";
import { GameAPI } from "../src/facade";

describe("OperationsFacade", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
  });

  // ==========================================================================
  // Site Revelation tests
  // ==========================================================================
  describe("Site Revelation", () => {
    it("canRevealSite returns true for unrevealed site", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        const result = api.operations.canRevealSite(unrevealed.id);
        expect(result.allowed).toBe(true);
      }
    });

    it("canRevealSite returns false when not found", () => {
      const result = api.operations.canRevealSite("nonexistent_site");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("canRevealSite returns false when already revealed", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        // Reveal it first
        api.operations.revealSite(unrevealed.id);

        // Try to reveal again
        const result = api.operations.canRevealSite(unrevealed.id);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("already revealed");
      }
    });

    it("revealSite reveals successfully", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        const result = api.operations.revealSite(unrevealed.id);
        expect(result.success).toBe(true);

        const updatedSite = api.operations.getSiteById(unrevealed.id);
        expect(updatedSite?.revealed).toBe(true);
      }
    });

    it("revealSite fails when canRevealSite fails", () => {
      const result = api.operations.revealSite("nonexistent_site");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("INVALID_STATE");
      }
    });
  });

  // ==========================================================================
  // Site Development tests
  // ==========================================================================
  describe("Site Development", () => {
    it("canDevelopSite returns true for revealed undeveloped site", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        // Reveal it first
        api.operations.revealSite(unrevealed.id);

        const result = api.operations.canDevelopSite(unrevealed.id);
        expect(result.allowed).toBe(true);
      }
    });

    it("canDevelopSite returns false when not found", () => {
      const result = api.operations.canDevelopSite("nonexistent_site");
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("canDevelopSite returns false when not revealed", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        const result = api.operations.canDevelopSite(unrevealed.id);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("revealed first");
      }
    });

    it("canDevelopSite returns false when already developed", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        // Reveal and develop
        api.operations.revealSite(unrevealed.id);
        api.operations.developSite(unrevealed.id);

        const result = api.operations.canDevelopSite(unrevealed.id);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("already developed");
      }
    });

    it("developSite develops successfully", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        api.operations.revealSite(unrevealed.id);

        const result = api.operations.developSite(unrevealed.id);
        expect(result.success).toBe(true);

        const updatedSite = api.operations.getSiteById(unrevealed.id);
        expect(updatedSite?.developed).toBe(true);
      }
    });

    it("developSite fails when canDevelopSite fails", () => {
      const result = api.operations.developSite("nonexistent_site");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("INVALID_STATE");
      }
    });
  });

  // ==========================================================================
  // launchExpedition() tests
  // ==========================================================================
  describe("launchExpedition()", () => {
    it("returns success with valid crew", () => {
      const colonists = api.colony.snapshot().colonists;
      const crewIds = colonists.slice(0, 2).map((c) => c.id);

      if (crewIds.length >= 2) {
        const result = api.operations.launchExpedition("survey", crewIds);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBeDefined();
        }
      }
    });

    it("returns PREREQUISITE_NOT_MET for invalid crew", () => {
      const result = api.operations.launchExpedition("survey", ["nonexistent_colonist"]);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("PREREQUISITE_NOT_MET");
        if (result.error.type === "PREREQUISITE_NOT_MET") {
          expect(result.error.reason).toContain("not found");
        }
      }
    });

    it("returns expedition data on success", () => {
      const colonists = api.colony.snapshot().colonists;
      const crewIds = colonists.slice(0, 2).map((c) => c.id);

      if (crewIds.length >= 2) {
        const result = api.operations.launchExpedition("survey", crewIds);
        if (result.success) {
          expect(result.data.id).toBeDefined();
          expect(result.data.type).toBe("survey");
        }
      }
    });

    it("canStartExpedition returns true for valid crew", () => {
      const colonists = api.colony.snapshot().colonists;
      const crewIds = colonists.slice(0, 2).map((c) => c.id);

      if (crewIds.length >= 2) {
        const result = api.operations.canStartExpedition("survey", crewIds);
        expect(result.allowed).toBe(true);
      }
    });

    it("canStartExpedition returns false for invalid crew", () => {
      const result = api.operations.canStartExpedition("survey", ["invalid_colonist"]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });
  });

  // ==========================================================================
  // getAvailableDeposits() tests
  // ==========================================================================
  describe("getAvailableDeposits()", () => {
    it("returns empty when no developed sites", () => {
      const freshApi = new GameAPI();
      const deposits = freshApi.operations.getAvailableDeposits();
      // Initial state has unrevealed sites
      expect(deposits.length).toBe(0);
    });

    it("returns only developed + unlinked sites", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        // Reveal and develop
        api.operations.revealSite(unrevealed.id);
        api.operations.developSite(unrevealed.id);

        const deposits = api.operations.getAvailableDeposits();
        expect(deposits.length).toBeGreaterThanOrEqual(1);
        expect(deposits.every((d) => d.developed)).toBe(true);
        expect(deposits.every((d) => !d.linkedBuildingId)).toBe(true);
      }
    });

    it("excludes undeveloped sites", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        // Reveal but don't develop
        api.operations.revealSite(unrevealed.id);

        const deposits = api.operations.getAvailableDeposits();
        // Should not include the revealed-but-not-developed site
        expect(deposits.find((d) => d.id === unrevealed.id)).toBeUndefined();
      }
    });

    it("excludes sites with linkedBuildingId", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        // Reveal and develop
        api.operations.revealSite(unrevealed.id);
        api.operations.developSite(unrevealed.id);

        // Check available before linking
        let deposits = api.operations.getAvailableDeposits();
        const availableBefore = deposits.find((d) => d.id === unrevealed.id);
        expect(availableBefore).toBeDefined();

        // Build a water extractor and link it
        const buildResult = api.buildings.build(BuildingId.WATER_EXTRACTOR);
        if (buildResult.success) {
          // Complete construction
          const def = api.buildings.getDefinition(BuildingId.WATER_EXTRACTOR);
          for (let i = 0; i < def!.constructionTime; i++) {
            api.game.advanceSol();
          }

          api.buildings.linkToDeposit(buildResult.data.id, unrevealed.id);

          // Check available after linking
          deposits = api.operations.getAvailableDeposits();
          const availableAfter = deposits.find((d) => d.id === unrevealed.id);
          expect(availableAfter).toBeUndefined();
        }
      }
    });
  });

  // ==========================================================================
  // snapshot() tests
  // ==========================================================================
  describe("snapshot()", () => {
    it("returns snapshot with all fields", () => {
      const snapshot = api.operations.snapshot();

      expect(snapshot.policies).toBeDefined();
      expect(typeof snapshot.policyCooldownRemaining).toBe("number");
      expect(Array.isArray(snapshot.expeditions)).toBe(true);
      expect(Array.isArray(snapshot.sites)).toBe(true);
    });

    it("returns frozen arrays", () => {
      const snapshot = api.operations.snapshot();

      expect(Object.isFrozen(snapshot.policies)).toBe(true);
      expect(Object.isFrozen(snapshot.expeditions)).toBe(true);
      expect(Object.isFrozen(snapshot.sites)).toBe(true);
    });
  });

  // ==========================================================================
  // Policy tests
  // ==========================================================================
  describe("Policy Operations", () => {
    it("canChangePolicy returns true initially", () => {
      const result = api.operations.canChangePolicy();
      expect(result.allowed).toBe(true);
    });

    it("canChangePolicy returns false during cooldown", () => {
      // Set a policy to trigger cooldown
      api.operations.setPolicy("resourcePriority", "balanced");

      // Advance one sol
      api.game.advanceSol();

      const result = api.operations.canChangePolicy();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("cooldown");
    });

    it("setPolicy succeeds when no cooldown", () => {
      const result = api.operations.setPolicy("resourcePriority", "burn");
      expect(result.success).toBe(true);
    });

    it("setPolicy fails during cooldown", () => {
      api.operations.setPolicy("resourcePriority", "balanced");
      api.game.advanceSol();

      const result = api.operations.setPolicy("resourcePriority", "burn");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("COOLDOWN_ACTIVE");
      }
    });
  });

  // ==========================================================================
  // getSiteById() tests
  // ==========================================================================
  describe("getSiteById()", () => {
    it("returns site when found", () => {
      const sites = api.operations.snapshot().sites;
      if (sites.length > 0) {
        const found = api.operations.getSiteById(sites[0]!.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(sites[0]!.id);
      }
    });

    it("returns undefined when not found", () => {
      const found = api.operations.getSiteById("nonexistent_site");
      expect(found).toBeUndefined();
    });
  });

  // ==========================================================================
  // getDepositWarningLevel() tests
  // ==========================================================================
  describe("getDepositWarningLevel()", () => {
    it("returns warning level for deposit", () => {
      const sites = api.operations.snapshot().sites;
      const unrevealed = sites.find((s) => !s.revealed);

      if (unrevealed) {
        api.operations.revealSite(unrevealed.id);
        api.operations.developSite(unrevealed.id);

        const level = api.operations.getDepositWarningLevel(unrevealed.id);
        expect(["none", "warning", "critical", "depleted"]).toContain(level);
      }
    });

    it("returns depleted for non-existent deposit", () => {
      const level = api.operations.getDepositWarningLevel("nonexistent");
      expect(level).toBe("depleted");
    });
  });
});
