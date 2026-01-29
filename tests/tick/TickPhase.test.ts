import { describe, expect, test } from "bun:test";
import { definePhase } from "../../src/core/tick/TickPhase";
import type { TickContext } from "../../src/core/tick/TickContext";

describe("TickPhase", () => {
  test("definePhase creates a valid phase object", () => {
    const phase = definePhase({
      id: "test:example",
      name: "Example Phase",
      reads: ["resources"],
      writes: ["derived.testValue"],
      execute: (_ctx: TickContext) => [],
    });

    expect(phase.id).toBe("test:example");
    expect(phase.name).toBe("Example Phase");
    expect(phase.reads).toEqual(["resources"]);
    expect(phase.writes).toEqual(["derived.testValue"]);
  });
});
