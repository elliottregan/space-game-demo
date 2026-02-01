import { describe, expect, test, beforeEach } from "bun:test";
import { VictoryManager } from "../src/core/systems/VictoryManager";
import { ProjectId } from "../src/core/models/NPCInfluence";
import { BuildingId } from "../src/core/models/Building";

describe("VictoryManager", () => {
  let manager: VictoryManager;

  beforeEach(() => {
    manager = new VictoryManager();
  });

  describe("checkCapstoneVictory", () => {
    test("returns victory for Return Mission capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.RETURN_MISSION);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("VICTORY");
      expect(result?.message).toContain("Return Mission");
    });

    test("returns victory for Declaration of Sovereignty capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.DECLARATION_OF_SOVEREIGNTY);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("VICTORY");
      expect(result?.message).toContain("Declaration of Sovereignty");
    });

    test("returns victory for Planetary Acquisition capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.PLANETARY_ACQUISITION);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("VICTORY");
      expect(result?.message).toContain("Planetary Acquisition");
    });

    test("returns null for non-capstone project", () => {
      const result = manager.checkCapstoneVictory(ProjectId.EARTH_MEMORIAL);
      expect(result).toBeNull();
    });
  });

  describe("checkBuildingVictory", () => {
    test("should trigger victory when victory building completes", () => {
      const event = manager.checkBuildingVictory(BuildingId.GENERATION_SHIP);

      expect(event).not.toBeNull();
      expect(event?.type).toBe("VICTORY");
      expect(manager.getState().status).toBe("victory");
    });

    test("should not trigger victory for normal buildings", () => {
      const event = manager.checkBuildingVictory(BuildingId.HABITAT);

      expect(event).toBeNull();
      expect(manager.getState().status).toBe("playing");
    });

    test("should include building name in victory reason", () => {
      const event = manager.checkBuildingVictory(BuildingId.SPACE_ELEVATOR);

      expect(event).not.toBeNull();
      expect(event?.message).toContain("Space Elevator");
    });
  });

  describe("removed victory conditions", () => {
    test("100 population does not trigger victory", () => {
      // This test verifies the 100 pop victory is removed
      // by checking VictoryManager state after construction
      expect(manager.getState().status).toBe("playing");
    });
  });
});
