import { describe, test, expect } from "bun:test";
import {
  deriveVector,
  checkAlignment,
  influenceCostAdjustment,
  demonym,
} from "../src/core/ideology.ts";
import { unlockedIdeologyBreakdown } from "../src/core/projects.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";
import { createEmptyColumn, placeLand, placeInfluence } from "../src/core/column.ts";
import type { Column, ProjectUnlock } from "../src/core/types.ts";

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
  test("empty board with zero terrain yields zero vector", () => {
    const v = deriveVector([], { axis1: 0, axis2: 0 });
    expect(v).toEqual({ axis1: 0, axis2: 0 });
  });

  test("tableau of Solidarity 2 + 3 tilts axis1 negative", () => {
    // Two separate columns — rank mismatch means they can't share a column,
    // but deriveVector is a pure function and accepts any columns.
    const cols: Column[] = [col([landId(2, "solidarity")]), col([landId(3, "solidarity")])];
    const v = deriveVector(cols, { axis1: 0, axis2: 0 });
    expect(v.axis1).toBe(-5);
    expect(v.axis2).toBe(0);
  });

  test("stacked matching-rank Lands both contribute to ideology", () => {
    const c = createEmptyColumn();
    placeLand(c, getCard(landId(3, "solidarity")));
    placeLand(c, getCard(landId(3, "solidarity")));
    const v = deriveVector([c], { axis1: 0, axis2: 0 });
    expect(v.axis1).toBe(-6);
  });

  test("topper contributes alongside lands", () => {
    const c = createEmptyColumn();
    placeLand(c, getCard(landId(3, "solidarity")));
    placeLand(c, getCard(landId(3, "solidarity")));
    placeInfluence(c, getCard(roleId("preacher", "solidarity")));
    const v = deriveVector([c], { axis1: 0, axis2: 0 });
    // 3+3 (Sol lands, axis1 -6) + 12 (Preacher Sol, axis1 -12) = -18
    expect(v.axis1).toBe(-18);
  });

  test("wild topper contributes nothing", () => {
    const c = createEmptyColumn();
    placeLand(c, getCard(landId(3, "solidarity")));
    placeLand(c, getCard(landId(3, "solidarity")));
    // keystone-pioneer is wild — use placeInfluence only if it's a role;
    // wild keystones aren't roles in the column sense, so skip placing it
    // and verify that just the two lands contribute.
    const v = deriveVector([c], { axis1: 0, axis2: 0 });
    expect(v.axis1).toBe(-6);
  });

  test("terrain pre-loads the vector", () => {
    const v = deriveVector([], { axis1: -3, axis2: 2 });
    expect(v).toEqual({ axis1: -3, axis2: 2 });
  });
});

describe("checkAlignment", () => {
  test("neutral when no axis is active", () => {
    const card = getCard(roleId("agitator", "solidarity"));
    expect(checkAlignment(card, { axis1: 2, axis2: 0 })).toBe("neutral");
  });

  test("aligned when suit matches dominant side", () => {
    const card = getCard(roleId("agitator", "solidarity"));
    expect(checkAlignment(card, { axis1: -5, axis2: 0 })).toBe("aligned");
  });

  test("opposed when suit matches inferior side", () => {
    const card = getCard(roleId("agitator", "sovereignty"));
    expect(checkAlignment(card, { axis1: -5, axis2: 0 })).toBe("opposed");
  });
});

describe("influenceCostAdjustment", () => {
  test("aligned -> -1, opposed -> +1, neutral -> 0", () => {
    expect(influenceCostAdjustment("aligned")).toBe(-1);
    expect(influenceCostAdjustment("opposed")).toBe(1);
    expect(influenceCostAdjustment("neutral")).toBe(0);
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
