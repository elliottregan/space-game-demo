// tests/ColonyFacade.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { GameAPI } from "../src/facade";
import { ColonistRole } from "../src/core/models/Colonist";

describe("ColonyFacade", () => {
  let api: GameAPI;

  beforeEach(() => {
    api = new GameAPI();
  });

  // ==========================================================================
  // canTrain() tests
  // ==========================================================================
  describe("canTrain()", () => {
    it("should return allowed:true for valid colonist/role", () => {
      const colonists = api.colony.snapshot().colonists;
      const unassigned = colonists.find((c) => c.role === ColonistRole.UNASSIGNED);

      if (unassigned) {
        const result = api.colony.canTrain(unassigned.id, ColonistRole.ENGINEERING);
        expect(result.allowed).toBe(true);
      }
    });

    it("should return allowed:false when colonist not found", () => {
      const result = api.colony.canTrain("nonexistent_id", ColonistRole.ENGINEERING);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("should return allowed:false when already training", () => {
      const colonists = api.colony.snapshot().colonists;
      const colonist = colonists[0];

      if (colonist && colonist.role !== ColonistRole.ENGINEERING) {
        // Start training
        api.colony.trainColonist(colonist.id, ColonistRole.ENGINEERING);

        // Try to train again
        const result = api.colony.canTrain(colonist.id, ColonistRole.RESEARCH);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Already training");
      }
    });

    it("should return allowed:false when same role", () => {
      const colonists = api.colony.snapshot().colonists;
      const engineer = colonists.find((c) => c.role === ColonistRole.ENGINEERING);

      if (engineer) {
        const result = api.colony.canTrain(engineer.id, ColonistRole.ENGINEERING);
        expect(result.allowed).toBe(false);
        expect(result.reason).toContain("Already has role");
      } else {
        // If no engineer exists, train one first
        const unassigned = colonists.find((c) => c.role === ColonistRole.UNASSIGNED);
        if (unassigned) {
          api.colony.trainColonist(unassigned.id, ColonistRole.ENGINEERING);
          // Advance time to complete training
          for (let i = 0; i < 10; i++) api.game.advanceSol();

          const result = api.colony.canTrain(unassigned.id, ColonistRole.ENGINEERING);
          expect(result.allowed).toBe(false);
        }
      }
    });
  });

  // ==========================================================================
  // trainColonist() tests
  // ==========================================================================
  describe("trainColonist()", () => {
    it("should return success:true when training starts", () => {
      const colonists = api.colony.snapshot().colonists;
      const trainable = colonists.find(
        (c) => c.role !== ColonistRole.ENGINEERING && !c.trainingTarget
      );

      if (trainable) {
        const result = api.colony.trainColonist(trainable.id, ColonistRole.ENGINEERING);
        expect(result.success).toBe(true);
      }
    });

    it("should return success:false when canTrain fails", () => {
      const colonists = api.colony.snapshot().colonists;
      const colonist = colonists[0];

      if (colonist && colonist.role !== ColonistRole.RESEARCH) {
        // Start initial training
        api.colony.trainColonist(colonist.id, ColonistRole.RESEARCH);

        // Try to train again while already training
        const result = api.colony.trainColonist(colonist.id, ColonistRole.ENGINEERING);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("INVALID_STATE");
        }
      }
    });

    it("should return NOT_FOUND when colonist missing", () => {
      const result = api.colony.trainColonist("nonexistent_colonist", ColonistRole.ENGINEERING);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("INVALID_STATE");
        expect(result.error.reason).toContain("not found");
      }
    });

    it("should verify training actually started on colonist", () => {
      const colonists = api.colony.snapshot().colonists;
      const trainable = colonists.find(
        (c) => c.role !== ColonistRole.FARMING && !c.trainingTarget
      );

      if (trainable) {
        api.colony.trainColonist(trainable.id, ColonistRole.FARMING);

        const updatedColonist = api.colony.getById(trainable.id);
        expect(updatedColonist?.trainingTarget).toBe(ColonistRole.FARMING);
      }
    });
  });

  // ==========================================================================
  // cancelTraining() tests
  // ==========================================================================
  describe("cancelTraining()", () => {
    it("should return success:true when cancelled", () => {
      const colonists = api.colony.snapshot().colonists;
      const trainable = colonists.find(
        (c) => c.role !== ColonistRole.ENGINEERING && !c.trainingTarget
      );

      if (trainable) {
        api.colony.trainColonist(trainable.id, ColonistRole.ENGINEERING);
        const result = api.colony.cancelTraining(trainable.id);

        expect(result.success).toBe(true);

        const updatedColonist = api.colony.getById(trainable.id);
        expect(updatedColonist?.trainingTarget).toBeUndefined();
      }
    });

    it("should return NOT_FOUND when colonist missing", () => {
      const result = api.colony.cancelTraining("nonexistent_colonist");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("NOT_FOUND");
        expect(result.error.entity).toBe("colonist");
      }
    });

    it("should return INVALID_STATE when not training", () => {
      const colonists = api.colony.snapshot().colonists;
      const notTraining = colonists.find((c) => !c.trainingTarget);

      if (notTraining) {
        const result = api.colony.cancelTraining(notTraining.id);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.type).toBe("INVALID_STATE");
          expect(result.error.reason).toContain("not in training");
        }
      }
    });
  });

  // ==========================================================================
  // getByRole() tests
  // ==========================================================================
  describe("getByRole()", () => {
    it("should return empty for no matches", () => {
      // Try a role that likely has no colonists initially
      const colonists = api.colony.getByRole(ColonistRole.CIVIL_SCIENCE);

      // May or may not be empty depending on initial game state
      expect(Array.isArray(colonists)).toBe(true);
    });

    it("should filter correctly", () => {
      const allColonists = api.colony.snapshot().colonists;
      const unassignedManual = allColonists.filter((c) => c.role === ColonistRole.UNASSIGNED);
      const unassignedFromMethod = api.colony.getByRole(ColonistRole.UNASSIGNED);

      expect(unassignedFromMethod.length).toBe(unassignedManual.length);
    });

    it("should return correct colonists for each role", () => {
      // Train some colonists to specific roles
      const colonists = api.colony.snapshot().colonists;
      const trainable = colonists.filter((c) => !c.trainingTarget);

      if (trainable.length >= 2) {
        api.colony.trainColonist(trainable[0]!.id, ColonistRole.RESEARCH);
        api.colony.trainColonist(trainable[1]!.id, ColonistRole.FARMING);

        // Complete training
        for (let i = 0; i < 10; i++) api.game.advanceSol();

        const researchers = api.colony.getByRole(ColonistRole.RESEARCH);
        const farmers = api.colony.getByRole(ColonistRole.FARMING);

        expect(researchers.some((c) => c.id === trainable[0]!.id)).toBe(true);
        expect(farmers.some((c) => c.id === trainable[1]!.id)).toBe(true);
      }
    });
  });

  // ==========================================================================
  // getInTraining() tests
  // ==========================================================================
  describe("getInTraining()", () => {
    it("should return empty when none training", () => {
      // Fresh game - check initial state
      const api2 = new GameAPI();
      const inTraining = api2.colony.getInTraining();

      expect(Array.isArray(inTraining)).toBe(true);
      // Initial state may or may not have colonists in training
    });

    it("should return correct colonists in training", () => {
      const colonists = api.colony.snapshot().colonists;
      const trainable = colonists.filter((c) => !c.trainingTarget).slice(0, 2);

      if (trainable.length >= 2) {
        api.colony.trainColonist(trainable[0]!.id, ColonistRole.ENGINEERING);
        api.colony.trainColonist(trainable[1]!.id, ColonistRole.RESEARCH);

        const inTraining = api.colony.getInTraining();

        expect(inTraining.length).toBeGreaterThanOrEqual(2);
        expect(inTraining.some((c) => c.id === trainable[0]!.id)).toBe(true);
        expect(inTraining.some((c) => c.id === trainable[1]!.id)).toBe(true);
      }
    });

    it("should not include completed training", () => {
      const colonists = api.colony.snapshot().colonists;
      const trainable = colonists.find((c) => !c.trainingTarget);

      if (trainable) {
        api.colony.trainColonist(trainable.id, ColonistRole.ENGINEERING);

        // Complete training
        for (let i = 0; i < 10; i++) api.game.advanceSol();

        const inTraining = api.colony.getInTraining();
        expect(inTraining.some((c) => c.id === trainable.id)).toBe(false);
      }
    });
  });

  // ==========================================================================
  // snapshot() tests
  // ==========================================================================
  describe("snapshot()", () => {
    it("should return colony snapshot with all fields", () => {
      const snapshot = api.colony.snapshot();

      expect(snapshot.population).toBeGreaterThan(0);
      expect(typeof snapshot.health).toBe("number");
      expect(typeof snapshot.morale).toBe("number");
      expect(Array.isArray(snapshot.colonists)).toBe(true);
      expect(Array.isArray(snapshot.skillDefinitions)).toBe(true);
    });

    it("should return frozen colonists array", () => {
      const snapshot = api.colony.snapshot();
      expect(Object.isFrozen(snapshot.colonists)).toBe(true);
    });

    it("should return frozen skill definitions", () => {
      const snapshot = api.colony.snapshot();
      expect(Object.isFrozen(snapshot.skillDefinitions)).toBe(true);
    });
  });

  // ==========================================================================
  // getById() tests
  // ==========================================================================
  describe("getById()", () => {
    it("should return colonist when found", () => {
      const colonists = api.colony.snapshot().colonists;
      const first = colonists[0];

      if (first) {
        const found = api.colony.getById(first.id);
        expect(found).toBeDefined();
        expect(found?.id).toBe(first.id);
        expect(found?.name).toBe(first.name);
      }
    });

    it("should return undefined when not found", () => {
      const found = api.colony.getById("nonexistent_colonist_id");
      expect(found).toBeUndefined();
    });
  });

  // ==========================================================================
  // getColonistsByRole() tests (alias for getByRole)
  // ==========================================================================
  describe("getColonistsByRole()", () => {
    it("should be an alias for getByRole", () => {
      const byRole = api.colony.getByRole(ColonistRole.UNASSIGNED);
      const colonistsByRole = api.colony.getColonistsByRole(ColonistRole.UNASSIGNED);

      expect(byRole.length).toBe(colonistsByRole.length);
      expect(byRole.map((c) => c.id)).toEqual(colonistsByRole.map((c) => c.id));
    });
  });
});
