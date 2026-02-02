import { describe, expect, test } from "bun:test";
import { TickRunner } from "../../src/core/tick/TickRunner";
import { definePhase } from "../../src/core/tick/TickPhase";
import type { TickContext } from "../../src/core/tick/TickContext";

describe("TickRunner", () => {
  test("registers phases and computes execution order", () => {
    const runner = new TickRunner();

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);
    runner.register(phaseB);
    runner.recomputeOrder();

    const order = runner.getExecutionOrder();
    expect(order.map((p) => p.id)).toEqual(["test:phaseA", "test:phaseB"]);
  });

  test("topologically sorts based on reads/writes", () => {
    const runner = new TickRunner();

    // Register in reverse order to prove sorting works
    const phaseC = definePhase({
      id: "test:phaseC",
      name: "Phase C",
      reads: ["derived.valueB"],
      writes: ["derived.valueC"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseC);
    runner.register(phaseA);
    runner.register(phaseB);
    runner.recomputeOrder();

    const order = runner.getExecutionOrder();
    const ids = order.map((p) => p.id);

    // A must come before B, B must come before C
    expect(ids.indexOf("test:phaseA")).toBeLessThan(ids.indexOf("test:phaseB"));
    expect(ids.indexOf("test:phaseB")).toBeLessThan(ids.indexOf("test:phaseC"));
  });

  test("throws error when registering duplicate phase id", () => {
    const runner = new TickRunner();

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: [],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);

    expect(() => runner.register(phaseA)).toThrow('Phase with id "test:phaseA" already registered');
  });

  test("detects cycles in phase dependencies", () => {
    const runner = new TickRunner();

    // Create a cycle: A -> B -> C -> A
    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: ["derived.valueC"],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseC = definePhase({
      id: "test:phaseC",
      name: "Phase C",
      reads: ["derived.valueB"],
      writes: ["derived.valueC"],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);
    runner.register(phaseB);
    runner.register(phaseC);

    expect(() => runner.recomputeOrder()).toThrow("Cycle detected in phase dependencies");
  });

  test("handles phases with no dependencies", () => {
    const runner = new TickRunner();

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: [],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);
    runner.register(phaseB);
    runner.recomputeOrder();

    const order = runner.getExecutionOrder();
    // Both phases have no dependencies, so both should be present
    expect(order.length).toBe(2);
    expect(order.map((p) => p.id)).toContain("test:phaseA");
    expect(order.map((p) => p.id)).toContain("test:phaseB");
  });

  test("getPhase returns registered phase by id", () => {
    const runner = new TickRunner();

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: [],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);

    expect(runner.getPhase("test:phaseA")).toBe(phaseA);
    expect(runner.getPhase("nonexistent")).toBeUndefined();
  });

  test("getAllPhases returns all registered phases", () => {
    const runner = new TickRunner();

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: [],
      execute: (_ctx: TickContext) => [],
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: [],
      writes: [],
      execute: (_ctx: TickContext) => [],
    });

    runner.register(phaseA);
    runner.register(phaseB);

    const phases = runner.getAllPhases();
    expect(phases).toContain(phaseA);
    expect(phases).toContain(phaseB);
    expect(phases.length).toBe(2);
  });

  test("tick executes phases in order and collects events", () => {
    const runner = new TickRunner();
    const executionLog: string[] = [];

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => {
        executionLog.push("A");
        return [{ type: "test", message: "Event from A" }];
      },
    });

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: ["derived.valueB"],
      execute: (_ctx: TickContext) => {
        executionLog.push("B");
        return [{ type: "test", message: "Event from B" }];
      },
    });

    runner.register(phaseA);
    runner.register(phaseB);

    // Create a minimal mock context
    const mockContext = {
      currentSol: 1,
      derived: {
        socialCohesion: null,
        policyEffects: null,
        laborPoolBonus: 0,
        airContribution: 0,
      },
      settings: { autoAssignNewColonists: false },
    } as TickContext;

    const events = runner.tick(mockContext);

    // Verify execution order
    expect(executionLog).toEqual(["A", "B"]);

    // Verify events were collected
    expect(events.length).toBe(2);
    expect(events[0].message).toBe("Event from A");
    expect(events[1].message).toBe("Event from B");
  });

  test("tick auto-recomputes order if dirty", () => {
    const runner = new TickRunner();
    const executionLog: string[] = [];

    const phaseB = definePhase({
      id: "test:phaseB",
      name: "Phase B",
      reads: ["derived.valueA"],
      writes: [],
      execute: (_ctx: TickContext) => {
        executionLog.push("B");
        return [];
      },
    });

    const phaseA = definePhase({
      id: "test:phaseA",
      name: "Phase A",
      reads: [],
      writes: ["derived.valueA"],
      execute: (_ctx: TickContext) => {
        executionLog.push("A");
        return [];
      },
    });

    // Register in reverse dependency order
    runner.register(phaseB);
    runner.register(phaseA);

    const mockContext = {
      currentSol: 1,
      derived: {
        socialCohesion: null,
        policyEffects: null,
        laborPoolBonus: 0,
        airContribution: 0,
      },
      settings: { autoAssignNewColonists: false },
    } as TickContext;

    // tick() should auto-recompute and run A before B
    runner.tick(mockContext);
    expect(executionLog).toEqual(["A", "B"]);
  });
});
