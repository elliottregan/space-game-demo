import { describe, expect, it } from "bun:test";
import { computeForceLayout, type LayoutInput } from "../src/renderer/utils/forceLayout";
import type { NPC } from "../src/core/models/NPCInfluence";

describe("computeForceLayout", () => {
  const createNPC = (id: string, faction: "futurist" | "progressive" | "traditionalist"): NPC => ({
    id,
    name: `NPC ${id}`,
    faction,
    influence: 1.0,
  });

  it("returns empty array for empty input", () => {
    const input: LayoutInput = {
      npcs: [],
      relationshipMatrix: [],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);

    expect(result).toEqual([]);
  });

  it("should return positions for all NPCs", () => {
    const mockNPCs: NPC[] = [
      { id: "f1", name: "Futurist 1", faction: "futurist", influence: 1.0 },
      { id: "f2", name: "Futurist 2", faction: "futurist", influence: 1.0 },
      { id: "p1", name: "Progressive 1", faction: "progressive", influence: 1.0 },
      { id: "p2", name: "Progressive 2", faction: "progressive", influence: 1.0 },
      { id: "t1", name: "Traditionalist 1", faction: "traditionalist", influence: 1.0 },
      { id: "t2", name: "Traditionalist 2", faction: "traditionalist", influence: 1.0 },
    ];

    const mockMatrix = [
      [0, 0.8, 0.1, 0, 0, 0],
      [0.8, 0, 0, 0.1, 0, 0],
      [0.1, 0, 0, 0.8, 0, 0],
      [0, 0.1, 0.8, 0, 0, 0],
      [0, 0, 0, 0, 0, 0.8],
      [0, 0, 0, 0, 0.8, 0],
    ];

    const result = computeForceLayout({
      npcs: mockNPCs,
      relationshipMatrix: mockMatrix,
      width: 600,
      height: 400,
    });

    expect(result.length).toBe(6);
    for (const node of result) {
      expect(typeof node.x).toBe("number");
      expect(typeof node.y).toBe("number");
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it("should cluster same-faction NPCs closer together", () => {
    const mockNPCs: NPC[] = [
      { id: "f1", name: "Futurist 1", faction: "futurist", influence: 1.0 },
      { id: "f2", name: "Futurist 2", faction: "futurist", influence: 1.0 },
      { id: "p1", name: "Progressive 1", faction: "progressive", influence: 1.0 },
      { id: "p2", name: "Progressive 2", faction: "progressive", influence: 1.0 },
      { id: "t1", name: "Traditionalist 1", faction: "traditionalist", influence: 1.0 },
      { id: "t2", name: "Traditionalist 2", faction: "traditionalist", influence: 1.0 },
    ];

    // Relationship matrix where same-faction NPCs have strong connections
    const mockMatrix = [
      [0, 0.8, 0.1, 0, 0, 0],   // f1: strong to f2
      [0.8, 0, 0, 0.1, 0, 0],   // f2: strong to f1
      [0.1, 0, 0, 0.8, 0, 0],   // p1: strong to p2
      [0, 0.1, 0.8, 0, 0, 0],   // p2: strong to p1
      [0, 0, 0, 0, 0, 0.8],     // t1: strong to t2
      [0, 0, 0, 0, 0.8, 0],     // t2: strong to t1
    ];

    const result = computeForceLayout({
      npcs: mockNPCs,
      relationshipMatrix: mockMatrix,
      width: 600,
      height: 400,
    });

    const positions = Object.fromEntries(result.map((n) => [n.id, n]));

    // Distance between same-faction NPCs
    const f1f2 = Math.hypot(
      positions.f1!.x - positions.f2!.x,
      positions.f1!.y - positions.f2!.y
    );
    const p1p2 = Math.hypot(
      positions.p1!.x - positions.p2!.x,
      positions.p1!.y - positions.p2!.y
    );

    // Distance between different-faction NPCs
    const f1p1 = Math.hypot(
      positions.f1!.x - positions.p1!.x,
      positions.f1!.y - positions.p1!.y
    );

    // Same-faction should be closer than different-faction
    expect(f1f2).toBeLessThan(f1p1);
    expect(p1p2).toBeLessThan(f1p1);
  });

  it("should handle empty NPC list", () => {
    const result = computeForceLayout({
      npcs: [],
      relationshipMatrix: [],
      width: 600,
      height: 400,
    });

    expect(result).toEqual([]);
  });

  it("positions NPCs from same faction near each other", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("npc1", "progressive"),
        createNPC("npc2", "progressive"),
      ],
      relationshipMatrix: [
        [0, 0.5],
        [0.5, 0],
      ],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);

    expect(result).toHaveLength(2);
    const pos1 = result.find((p) => p.id === "npc1")!;
    const pos2 = result.find((p) => p.id === "npc2")!;

    // Both should be relatively close together (same faction)
    const distance = Math.hypot(pos1.x - pos2.x, pos1.y - pos2.y);
    expect(distance).toBeLessThan(200);
  });

  it("pulls strongly connected cross-faction NPCs closer together", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("futurist1", "futurist"),
        createNPC("trad1", "traditionalist"),
      ],
      relationshipMatrix: [
        [0, 0.9], // Strong connection
        [0.9, 0],
      ],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);
    const futurist = result.find((p) => p.id === "futurist1")!;
    const trad = result.find((p) => p.id === "trad1")!;

    // Calculate distance between them
    const distance = Math.sqrt((futurist.x - trad.x) ** 2 + (futurist.y - trad.y) ** 2);

    // Strong relationship should pull them closer than faction anchors would suggest
    expect(distance).toBeLessThan(250);
  });

  it("returns deterministic positions for same input", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("npc1", "futurist"),
        createNPC("npc2", "progressive"),
        createNPC("npc3", "traditionalist"),
      ],
      relationshipMatrix: [
        [0, 0.3, 0.2],
        [0.3, 0, 0.4],
        [0.2, 0.4, 0],
      ],
      width: 600,
      height: 400,
    };

    const result1 = computeForceLayout(input);
    const result2 = computeForceLayout(input);

    // Positions should be identical across runs
    expect(result1).toEqual(result2);
  });
});
