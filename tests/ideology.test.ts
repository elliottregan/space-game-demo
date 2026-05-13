import { describe, test, expect } from "bun:test";
import { deriveVector, demonym } from "../src/core/engine/ideology.ts";
import { unlockedIdeologyBreakdown } from "../src/core/data/projects.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import { createEmptyColumn, placeLand, placeInfluence } from "../src/core/engine/column.ts";
import type { Column, KeystoneProject, ProjectUnlock } from "../src/core/types.ts";

function col(lands: string[], topper?: string): Column {
  const c = createEmptyColumn();
  for (const id of lands) placeLand(c, getCard(id));
  if (topper) {
    const card = getCard(topper);
    if (card.kind === "role") placeInfluence(c, card);
  }
  return c;
}

describe("deriveVector", () => {
  test("empty board with no unlocks yields zero vector", () => {
    const v = deriveVector([], [], []);
    expect(v).toEqual({ axis1: 0, axis2: 0 });
  });

  test("two solidarity lands contribute -2 to axis1 (flat ±1, rank-independent)", () => {
    const cols: Column[] = [col([landId(2, "solidarity")]), col([landId(3, "solidarity")])];
    const v = deriveVector(cols, [], []);
    expect(v.axis1).toBe(-2);
    expect(v.axis2).toBe(0);
  });

  test("one solidarity + one sovereignty land cancel on axis1", () => {
    // Each non-wild card adds ±1; opposite sides cancel out regardless of rank.
    const cols: Column[] = [col([landId(5, "solidarity")]), col([landId(3, "sovereignty")])];
    const v = deriveVector(cols, [], []);
    expect(v.axis1).toBe(0);
    expect(v.axis2).toBe(0);
  });

  test("topper contributes ±1 alongside lands", () => {
    const c = createEmptyColumn();
    placeLand(c, getCard(landId(3, "solidarity")));
    placeLand(c, getCard(landId(3, "solidarity")));
    placeInfluence(c, getCard(roleId("preacher", "solidarity")));
    const v = deriveVector([c], [], []);
    // 2 solidarity lands + 1 solidarity topper = -3 on axis1.
    expect(v.axis1).toBe(-3);
  });

  test("wild cards in columns contribute nothing", () => {
    const c = createEmptyColumn();
    placeLand(c, getCard(landId(3, "solidarity")));
    placeLand(c, getCard(landId(3, "solidarity")));
    const v = deriveVector([c], [], []);
    expect(v.axis1).toBe(-2);
  });

  test("project unlock contributes sign(net cards on axis) × project.value", () => {
    // Mono-sovereignty flush unlock with project.value = 4 → axis1 = +4.
    const project: KeystoneProject = {
      id: "p-flush",
      pattern: "flush",
      name: "Flush",
      flavor: "",
      value: 4,
    };
    const unlock: ProjectUnlock = {
      projectId: "p-flush",
      pattern: "flush",
      turn: 1,
      cards: [
        getCard(landId(4, "sovereignty")),
        getCard(landId(4, "sovereignty")),
        getCard(roleId("agitator", "sovereignty")),
      ],
    };
    const v = deriveVector([], [unlock], [project]);
    expect(v.axis1).toBe(4);
    expect(v.axis2).toBe(0);
  });

  test("project with balanced ideologies on an axis contributes 0 there", () => {
    const project: KeystoneProject = {
      id: "p-pair",
      pattern: "pair",
      name: "Pair",
      flavor: "",
      value: 2,
    };
    // One solidarity, one sovereignty on axis1 → net = 0 → sign(0) × value = 0.
    const unlock: ProjectUnlock = {
      projectId: "p-pair",
      pattern: "pair",
      turn: 1,
      cards: [getCard(landId(3, "solidarity")), getCard(landId(3, "sovereignty"))],
    };
    const v = deriveVector([], [unlock], [project]);
    expect(v.axis1).toBe(0);
    expect(v.axis2).toBe(0);
  });

  test("missing project lookup contributes 0 (graceful fallback)", () => {
    const unlock: ProjectUnlock = {
      projectId: "unknown",
      pattern: "pair",
      turn: 1,
      cards: [getCard(landId(3, "sovereignty")), getCard(landId(3, "sovereignty"))],
    };
    const v = deriveVector([], [unlock], []);
    expect(v).toEqual({ axis1: 0, axis2: 0 });
  });
});

describe("demonym", () => {
  test("null when no side dominant", () => {
    expect(demonym({ axis1: -3, axis2: 2 })).toBe(null);
  });
  test("strongest-dominant wins", () => {
    expect(demonym({ axis1: -9, axis2: 7 })).toBe("collective");
    expect(demonym({ axis1: 0, axis2: -6 })).toBe("keepers");
  });
});

describe("unlockedIdeologyBreakdown", () => {
  test("sums non-wild ideologies across unlocks", () => {
    const u: ProjectUnlock = {
      projectId: "x",
      pattern: "pair",
      turn: 1,
      cards: [getCard(landId(7, "solidarity")), getCard(landId(7, "heritage"))],
    };
    const b = unlockedIdeologyBreakdown([u]);
    expect(b.solidarity).toBe(1);
    expect(b.heritage).toBe(1);
    expect(b.sovereignty).toBe(0);
  });
});
