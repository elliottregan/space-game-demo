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

  it("positions single NPC near faction anchor", () => {
    const input: LayoutInput = {
      npcs: [createNPC("npc1", "futurist")],
      relationshipMatrix: [[0]],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("npc1");
    // Futurist anchor is at (0.5, 0.15) = (300, 60) for 600x400
    // With center force, should be pulled somewhat toward center
    expect(result[0].x).toBeGreaterThan(200);
    expect(result[0].x).toBeLessThan(400);
    expect(result[0].y).toBeGreaterThan(0);
    expect(result[0].y).toBeLessThan(250);
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

    // Both should be in bottom-left quadrant (progressive faction)
    expect(pos1.x).toBeLessThan(350);
    expect(pos1.y).toBeGreaterThan(150);
    expect(pos2.x).toBeLessThan(350);
    expect(pos2.y).toBeGreaterThan(150);
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
    // Faction anchors are (300, 60) and (480, 300) = ~300px apart
    // With strong link, should be noticeably closer
    expect(distance).toBeLessThan(250);
  });

  it("keeps weakly connected cross-faction NPCs near their factions", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("futurist1", "futurist"),
        createNPC("trad1", "traditionalist"),
      ],
      relationshipMatrix: [
        [0, 0.05], // Very weak connection
        [0.05, 0],
      ],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);
    const futurist = result.find((p) => p.id === "futurist1")!;
    const trad = result.find((p) => p.id === "trad1")!;

    // Futurist should be in top half
    expect(futurist.y).toBeLessThan(250);
    // Traditionalist should be in bottom-right area
    expect(trad.x).toBeGreaterThan(300);
    expect(trad.y).toBeGreaterThan(200);
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
