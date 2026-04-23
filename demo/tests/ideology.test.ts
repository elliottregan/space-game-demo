import { describe, test, expect } from "bun:test";
import {
  deriveVector,
  checkAlignment,
  influenceCostAdjustment,
  demonym,
} from "../src/core/ideology.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";
import type { TableauSlot } from "../src/core/types.ts";

function slot(lands: string[], topper?: string): TableauSlot {
  return {
    lands: lands.map((id) => getCard(id)),
    topper: topper ? getCard(topper) : null,
  };
}

describe("deriveVector", () => {
  test("empty board with zero terrain yields zero vector", () => {
    const v = deriveVector([], { axis1: 0, axis2: 0 });
    expect(v).toEqual({ axis1: 0, axis2: 0 });
  });

  test("tableau of Solidarity 2 + 3 tilts axis1 negative", () => {
    const s = slot([landId(2, "solidarity"), landId(3, "solidarity")]);
    // Note: demo rule is matching-rank stacking; this test treats the core function
    // as pure and allows any cards. Real play enforces matching-rank stacks.
    const v = deriveVector([s], { axis1: 0, axis2: 0 });
    expect(v.axis1).toBe(-5);
    expect(v.axis2).toBe(0);
  });

  test("stacked matching-rank Lands both contribute to ideology", () => {
    const s = slot([landId(3, "solidarity"), landId(3, "solidarity")]);
    const v = deriveVector([s], { axis1: 0, axis2: 0 });
    expect(v.axis1).toBe(-6);
  });

  test("topper contributes alongside lands", () => {
    const s = slot(
      [landId(3, "solidarity"), landId(3, "solidarity")],
      roleId("preacher", "solidarity"),
    );
    const v = deriveVector([s], { axis1: 0, axis2: 0 });
    // 3+3 (Sol lands, axis1 -6) + 12 (Preacher Sol, axis1 -12) = -18
    expect(v.axis1).toBe(-18);
  });

  test("wild topper contributes nothing", () => {
    const s = slot([landId(3, "solidarity"), landId(3, "solidarity")], "keystone-pioneer");
    const v = deriveVector([s], { axis1: 0, axis2: 0 });
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
