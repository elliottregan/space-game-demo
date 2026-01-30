// tests/ColonistSimulationManager.test.ts
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { ColonistSimulationManager } from "../src/renderer/utils/ColonistSimulationManager";
import { ColonistRole, MasteryLevel, type Colonist } from "../src/core/models/Colonist";

// Polyfill requestAnimationFrame for test environment
let rafId = 0;
const rafCallbacks = new Map<number, FrameRequestCallback>();

beforeAll(() => {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    const id = ++rafId;
    rafCallbacks.set(id, callback);
    setTimeout(() => {
      const cb = rafCallbacks.get(id);
      if (cb) {
        rafCallbacks.delete(id);
        cb(performance.now());
      }
    }, 16); // ~60fps
    return id;
  };

  globalThis.cancelAnimationFrame = (id: number): void => {
    rafCallbacks.delete(id);
  };
});

afterAll(() => {
  // @ts-expect-error Cleaning up polyfill
  delete globalThis.requestAnimationFrame;
  // @ts-expect-error Cleaning up polyfill
  delete globalThis.cancelAnimationFrame;
});

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

  it("calls onTick callback during animation", async () => {
    const manager = new ColonistSimulationManager(600, 400);
    const colonists = [makeColonist("c1", "Alice Smith"), makeColonist("c2", "Bob Jones")];
    const relationships = new Map([["c1:c2", 0.5]]);

    let tickCount = 0;
    manager.setOnTick(() => {
      tickCount++;
    });

    manager.update(colonists, relationships);
    manager.startAnimation();

    // Wait for some animation frames
    await new Promise((resolve) => setTimeout(resolve, 100));

    manager.stopAnimation();
    expect(tickCount).toBeGreaterThan(0);

    manager.destroy();
  });

  it("stops animation when stopAnimation is called", async () => {
    const manager = new ColonistSimulationManager(600, 400);
    const colonists = [makeColonist("c1", "Alice Smith")];

    manager.update(colonists, new Map());
    manager.startAnimation();
    expect(manager.isAnimating()).toBe(true);

    // Wait for a frame
    await new Promise((resolve) => setTimeout(resolve, 50));

    manager.stopAnimation();
    expect(manager.isAnimating()).toBe(false);

    manager.destroy();
  });

  it("auto-stops animation when simulation settles", async () => {
    const manager = new ColonistSimulationManager(600, 400);
    const colonists = [makeColonist("c1", "Alice Smith")];

    manager.update(colonists, new Map());
    manager.startAnimation();

    // Run many frames until alpha drops below threshold
    // This tests the auto-stop behavior
    let frames = 0;
    const maxFrames = 500; // Safety limit
    while (manager.isAnimating() && frames < maxFrames) {
      await new Promise((resolve) => setTimeout(resolve, 16));
      frames++;
    }

    // Should have auto-stopped due to low alpha, not hit the safety limit
    expect(manager.isAnimating()).toBe(false);
    expect(frames).toBeLessThan(maxFrames);

    manager.destroy();
  });
});
