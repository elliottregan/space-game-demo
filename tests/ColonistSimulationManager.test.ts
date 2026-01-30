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

  it("preserves positions between updates", () => {
    const manager = new ColonistSimulationManager(600, 400);
    const colonists = [
      makeColonist("c1", "Alice Smith", ColonistRole.RESEARCH),
      makeColonist("c2", "Bob Jones", ColonistRole.ENGINEERING),
    ];
    const relationships = new Map<string, number>();

    // First update
    manager.update(colonists, relationships);
    const firstPositions = manager.getPositions();
    const c1First = firstPositions.find((p) => p.id === "c1");
    expect(c1First).toBeDefined();

    // Second update with same data - positions should be similar
    manager.update(colonists, relationships);
    const secondPositions = manager.getPositions();
    const c1Second = secondPositions.find((p) => p.id === "c1");
    expect(c1Second).toBeDefined();

    // Positions should be close (within 50px) since simulation warms from previous
    const distance = Math.sqrt(
      Math.pow(c1First!.x - c1Second!.x, 2) + Math.pow(c1First!.y - c1Second!.y, 2),
    );
    expect(distance).toBeLessThan(50);

    manager.destroy();
  });

  it("adds new colonists near existing relationships", () => {
    const manager = new ColonistSimulationManager(600, 400);

    // Start with one colonist
    const colonists1 = [makeColonist("c1", "Alice Smith")];
    manager.update(colonists1, new Map());

    // Add second colonist with strong relationship to first
    const colonists2 = [makeColonist("c1", "Alice Smith"), makeColonist("c2", "Bob Jones")];
    const relationships = new Map([["c1:c2", 0.8]]);
    manager.update(colonists2, relationships);

    const positions = manager.getPositions();
    const c1 = positions.find((p) => p.id === "c1");
    const c2 = positions.find((p) => p.id === "c2");
    expect(c1).toBeDefined();
    expect(c2).toBeDefined();

    // New colonist should be placed near the related colonist
    const distance = Math.sqrt(Math.pow(c1!.x - c2!.x, 2) + Math.pow(c1!.y - c2!.y, 2));
    expect(distance).toBeLessThan(200); // Strong relationship = close

    manager.destroy();
  });

  it("cleans up positions for departed colonists", () => {
    const manager = new ColonistSimulationManager(600, 400);

    // Start with two colonists
    const colonists1 = [makeColonist("c1", "Alice Smith"), makeColonist("c2", "Bob Jones")];
    manager.update(colonists1, new Map());

    // Remove one colonist
    const colonists2 = [makeColonist("c1", "Alice Smith")];
    manager.update(colonists2, new Map());

    const positions = manager.getPositions();
    expect(positions.length).toBe(1);
    expect(positions.find((p) => p.id === "c1")).toBeDefined();
    expect(positions.find((p) => p.id === "c2")).toBeUndefined();

    manager.destroy();
  });
});
