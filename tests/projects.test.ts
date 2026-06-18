import { describe, test, expect } from "bun:test";
import {
  DEFAULT_PROJECT_VALUE,
  PATTERNS_IN_ORDER,
  getProjectForPattern,
  reversePatternOrder,
  unlockedIdeologyBreakdown,
  projectLevels,
  projectContribution,
  marginalContribution,
  projectMajority,
  ideologyInfluence,
} from "../src/core/data/projects.ts";
import type { KeystoneProject, ProjectUnlock } from "../src/core/types.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";

const sample: KeystoneProject[] = [
  { id: "p-high", pattern: "high-card", name: "h", flavor: "", value: 1 },
  { id: "p-pair", pattern: "pair", name: "p", flavor: "", value: 2 },
  { id: "p-three", pattern: "three-of-a-kind", name: "t", flavor: "", value: 4 },
  { id: "p-flush", pattern: "flush", name: "f", flavor: "", value: 5 },
  { id: "p-four", pattern: "four-of-a-kind", name: "4", flavor: "", value: 8 },
];

describe("PatternKind extension", () => {
  test("PATTERNS_IN_ORDER lists all ten patterns ascending", () => {
    expect(PATTERNS_IN_ORDER).toEqual([
      "high-card",
      "pair",
      "two-pair",
      "three-of-a-kind",
      "straight",
      "flush",
      "full-house",
      "four-of-a-kind",
      "straight-flush",
      "royal-flush",
    ]);
  });

  test("DEFAULT_PROJECT_VALUE has an entry per pattern with poker-strength scaling", () => {
    expect(DEFAULT_PROJECT_VALUE).toEqual({
      "high-card": 1,
      pair: 2,
      "two-pair": 3,
      "three-of-a-kind": 4,
      straight: 5,
      flush: 6,
      "full-house": 7,
      "four-of-a-kind": 8,
      "straight-flush": 10,
      "royal-flush": 12,
    });
  });

  test("reversePatternOrder walks royal-flush → ... → high-card", () => {
    expect(reversePatternOrder()[0]).toBe("royal-flush");
    expect(reversePatternOrder().at(-1)).toBe("high-card");
  });
});

describe("projects helpers", () => {
  test("DEFAULT_PROJECT_VALUE returns the spec-default scale", () => {
    expect(DEFAULT_PROJECT_VALUE["high-card"]).toBe(1);
    expect(DEFAULT_PROJECT_VALUE["pair"]).toBe(2);
    expect(DEFAULT_PROJECT_VALUE["three-of-a-kind"]).toBe(4);
    expect(DEFAULT_PROJECT_VALUE["flush"]).toBe(6);
    expect(DEFAULT_PROJECT_VALUE["four-of-a-kind"]).toBe(8);
  });

  test("PATTERNS_IN_ORDER is low → high", () => {
    expect(PATTERNS_IN_ORDER).toEqual([
      "high-card",
      "pair",
      "two-pair",
      "three-of-a-kind",
      "straight",
      "flush",
      "full-house",
      "four-of-a-kind",
      "straight-flush",
      "royal-flush",
    ]);
  });

  test("reversePatternOrder is four → high", () => {
    expect(reversePatternOrder()).toEqual([
      "royal-flush",
      "straight-flush",
      "four-of-a-kind",
      "full-house",
      "flush",
      "straight",
      "three-of-a-kind",
      "two-pair",
      "pair",
      "high-card",
    ]);
  });

  test("getProjectForPattern returns matching project", () => {
    expect(getProjectForPattern(sample, "flush")?.id).toBe("p-flush");
  });

  test("getProjectForPattern returns null when missing", () => {
    expect(getProjectForPattern([], "pair")).toBeNull();
  });

  test("unlockedIdeologyBreakdown sums non-wild ideology counts", () => {
    const land = (
      rank: number,
      ideo: "solidarity" | "sovereignty" | "transformation" | "heritage",
    ) => getCard(landId(rank, ideo));
    const role = (
      r: "agitator" | "scholar" | "preacher" | "engineer" | "architect",
      i: "solidarity" | "sovereignty" | "transformation" | "heritage",
    ) => getCard(roleId(r, i));
    const unlocks: ProjectUnlock[] = [
      {
        projectId: "x",
        pattern: "pair",
        turn: 1,
        cards: [
          land(7, "solidarity"),
          land(7, "heritage"),
          role("scholar", "solidarity"),
          getCard("keystone-founding-charter"), // now a FULL_JOKER wild — excluded
        ],
      },
      {
        projectId: "y",
        pattern: "high-card",
        turn: 2,
        cards: [
          land(3, "sovereignty"),
          role("scholar", "sovereignty"),
          getCard("keystone-pioneer"),
        ], // wild keystone — excluded
      },
    ];
    const b = unlockedIdeologyBreakdown(unlocks);
    expect(b.solidarity).toBe(2); // land7 + role (founding-charter is now a wild, excluded)
    expect(b.heritage).toBe(1);
    expect(b.sovereignty).toBe(2); // land3 + role
    expect(b.transformation).toBe(0);
  });
});

const proj = (value: number, levels?: { value: number }[]): KeystoneProject => ({
  id: "t",
  pattern: "pair",
  name: "T",
  flavor: "",
  value,
  ...(levels ? { levels } : {}),
});

describe("project leveling", () => {
  test("default curve: L1 = base, then halving with a floor of 1", () => {
    expect(projectLevels(proj(2)).map((l) => l.value)).toEqual([2, 1, 1]);
    expect(projectLevels(proj(6)).map((l) => l.value)).toEqual([6, 3, 2]);
  });

  test("authored levels override the default", () => {
    expect(projectLevels(proj(5, [{ value: 5 }, { value: 4 }])).map((l) => l.value)).toEqual([
      5, 4,
    ]);
  });

  test("contribution sums increments; tail repeats the last level", () => {
    const p = proj(2); // [2,1,1]
    expect(projectContribution(p, 0)).toBe(0);
    expect(projectContribution(p, 1)).toBe(2);
    expect(projectContribution(p, 2)).toBe(3);
    expect(projectContribution(p, 3)).toBe(4);
    expect(projectContribution(p, 5)).toBe(6); // 2+1+1+1+1
  });

  test("marginal value is the next build's increment", () => {
    const p = proj(2);
    expect(marginalContribution(p, 0)).toBe(2);
    expect(marginalContribution(p, 1)).toBe(1);
    expect(marginalContribution(p, 9)).toBe(1);
  });
});

const L = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("project majority", () => {
  test("plurality of non-wild card ideologies", () => {
    expect(projectMajority([L(2, "solidarity"), L(2, "solidarity"), L(3, "heritage")])).toBe(
      "solidarity",
    );
  });
  test("wild cards are excluded", () => {
    expect(projectMajority([L(2, "heritage"), getCard("keystone-pioneer")])).toBe("heritage");
  });
  test("a tie returns null", () => {
    expect(projectMajority([L(2, "solidarity"), L(3, "heritage")])).toBeNull();
  });
  test("all-wild returns null", () => {
    expect(projectMajority([getCard("keystone-pioneer")])).toBeNull();
  });
});

describe("ideologyInfluence", () => {
  test("counts unlocks per majority ideology, skipping ties", () => {
    const u = (cards: ReturnType<typeof getCard>[]) => ({
      projectId: "p",
      pattern: "pair" as const,
      turn: 1,
      cards,
    });
    const inf = ideologyInfluence([
      u([L(2, "solidarity"), L(2, "solidarity")]),
      u([L(3, "solidarity"), L(3, "solidarity")]),
      u([L(4, "heritage"), L(4, "heritage")]),
      u([L(5, "solidarity"), L(6, "heritage")]),
    ]);
    expect(inf.solidarity).toBe(2);
    expect(inf.heritage).toBe(1);
    expect(inf.sovereignty).toBe(0);
    expect(inf.transformation).toBe(0);
  });
});
