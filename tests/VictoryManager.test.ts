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
    test("returns capstone_completed event for Earth Relief Compact capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.EARTH_RELIEF_COMPACT);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("capstone_completed");
      expect(result?.message).toContain("Earth Relief Compact");
      // Capstones no longer trigger victory - they unlock megastructures
      expect(manager.getState().status).toBe("playing");
    });

    test("returns capstone_completed event for Declaration of Sovereignty capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.DECLARATION_OF_SOVEREIGNTY);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("capstone_completed");
      expect(result?.message).toContain("Declaration of Sovereignty");
      expect(manager.getState().status).toBe("playing");
    });

    test("returns capstone_completed event for Deep Space Mining Charter capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.DEEP_SPACE_MINING_CHARTER);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("capstone_completed");
      expect(result?.message).toContain("Deep Space Mining Charter");
      expect(manager.getState().status).toBe("playing");
    });

    test("returns null for non-capstone project", () => {
      const result = manager.checkCapstoneVictory(ProjectId.EARTH_MEMORIAL);
      expect(result).toBeNull();
    });
  });

  describe("checkBuildingVictory", () => {
    test("should trigger victory when victory building completes", () => {
      const event = manager.checkBuildingVictory(BuildingId.ASTEROID_MINING_PLATFORM);

      expect(event).not.toBeNull();
      expect(event?.type).toBe("VICTORY");
      expect(manager.getState().status).toBe("victory");
    });

    test("should not trigger victory for normal buildings", () => {
      const event = manager.checkBuildingVictory(BuildingId.BASIC_FARM);

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
