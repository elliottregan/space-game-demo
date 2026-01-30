// tests/ColonistSimulationManager.test.ts
import { describe, expect, it } from "bun:test";
import { ColonistSimulationManager } from "../src/renderer/utils/ColonistSimulationManager";
import { ColonistRole, MasteryLevel, type Colonist } from "../src/core/models/Colonist";

function makeColonist(id: string, name: string, role = ColonistRole.UNASSIGNED): Colonist {
  return {
    id,
    name,
    role,
    skills: [],
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
  };
}

describe("ColonistSimulationManager", () => {
  it("initializes with empty state", () => {
    const manager = new ColonistSimulationManager(600, 400);
    expect(manager.getPositions()).toEqual([]);
    manager.destroy();
  });

  it("updates with colonists and returns positions", () => {
    const manager = new ColonistSimulationManager(600, 400);
    const colonists = [
      makeColonist("c1", "Alice Smith", ColonistRole.RESEARCH),
      makeColonist("c2", "Bob Jones", ColonistRole.ENGINEERING),
    ];
    const relationships = new Map<string, number>();

    manager.update(colonists, relationships);

    const positions = manager.getPositions();
    expect(positions.length).toBe(2);
    expect(positions.find((p) => p.id === "c1")).toBeDefined();
    expect(positions.find((p) => p.id === "c2")).toBeDefined();

    manager.destroy();
  });
});
