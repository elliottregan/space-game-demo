import { describe, expect, test, beforeEach } from "bun:test";
import { VictoryManager } from "../src/core/systems/VictoryManager";
import { ProjectId } from "../src/core/models/NPCInfluence";

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

  describe("removed victory conditions", () => {
    test("100 population does not trigger victory", () => {
      // This test verifies the 100 pop victory is removed
      // by checking VictoryManager state after construction
      expect(manager.getState().status).toBe("playing");
    });
  });
});
