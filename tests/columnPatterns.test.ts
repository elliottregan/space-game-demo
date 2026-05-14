import { describe, test, expect } from "bun:test";
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
  placeCharter,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import type { KeystoneProject } from "../src/core/types.ts";

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));
const role = (
  r: "agitator" | "scholar" | "preacher" | "engineer" | "architect",
  i: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(roleId(r, i));
const charter = () => getCard("keystone-founding-charter");

const projects: KeystoneProject[] = [
  { id: "p-high", pattern: "high-card", name: "High", flavor: "", value: 1 },
  { id: "p-pair", pattern: "pair", name: "Pair", flavor: "", value: 2 },
  { id: "p-two-pair", pattern: "two-pair", name: "Two Pair", flavor: "", value: 3 },
  { id: "p-three", pattern: "three-of-a-kind", name: "Three", flavor: "", value: 4 },
  { id: "p-straight", pattern: "straight", name: "Straight", flavor: "", value: 5 },
  { id: "p-flush", pattern: "flush", name: "Flush", flavor: "", value: 6 },
  { id: "p-full-house", pattern: "full-house", name: "Full House", flavor: "", value: 7 },
  { id: "p-four", pattern: "four-of-a-kind", name: "Four", flavor: "", value: 8 },
  { id: "p-sf", pattern: "straight-flush", name: "Straight Flush", flavor: "", value: 10 },
  { id: "p-rf", pattern: "royal-flush", name: "Royal Flush", flavor: "", value: 12 },
];

function complete(
  rank: number,
  landIdeo: ("solidarity" | "sovereignty" | "transformation" | "heritage")[],
  roleIdeo: "solidarity" | "sovereignty" | "transformation" | "heritage" = "heritage",
) {
  const col = createEmptyColumn();
  for (const i of landIdeo) placeLand(col, land(rank, i));
  placeInfluence(col, role("scholar", roleIdeo));
  placeCharter(col, charter());
  return col;
}

describe("evaluateColumn", () => {
  test("returns null for incomplete column (no charter)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "heritage"));
    expect(evaluateColumn(col, projects)).toBeNull();
  });

  test("high-card: 1 land + role + charter, mixed ideology", () => {
    const m = evaluateColumn(complete(7, ["solidarity"]), projects);
    expect(m?.kind).toBe("high-card");
    expect(m?.projectId).toBe("p-high");
  });

  test("pair: 2 same-rank lands, mixed ideology", () => {
    const m = evaluateColumn(complete(7, ["solidarity", "heritage"], "sovereignty"), projects);
    expect(m?.kind).toBe("pair");
  });

  test("three-of-a-kind: 3 same-rank lands, mixed ideology", () => {
    const m = evaluateColumn(
      complete(7, ["solidarity", "heritage", "sovereignty"], "transformation"),
      projects,
    );
    expect(m?.kind).toBe("three-of-a-kind");
  });

  test("four-of-a-kind: 4 same-rank lands, beats flush even if mono-ideology", () => {
    // Four-of-a-Kind needs four lands; lands of one suit + matching role/charter ideology → also a flush.
    // Charter is "keystone-founding-charter" with ideology "solidarity".
    const col = createEmptyColumn();
    for (let i = 0; i < 4; i++) placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity charter
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("four-of-a-kind");
  });

  test("flush wins over three-of-a-kind (poker order)", () => {
    // 3 mono-ideology lands + matching-ideology role + matching-ideology charter = all 5 same ideology.
    // Per poker order, Flush beats Three of a Kind, so result is flush.
    const col = createEmptyColumn();
    for (let i = 0; i < 3; i++) placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // ideology "solidarity"
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("flush also fires for 1-land or 2-land mono-ideology columns", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("a 'wild' charter or role is not treated as matching for flush", () => {
    // base keystone-pioneer has ideology "wild" — should not match an ideology-based flush.
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, getCard("keystone-pioneer")); // wild
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("pair");
  });

  // ── New 10-pattern tests ────────────────────────────────────────────────────

  test("two-pair: pair-in-lands + pair-in-roles (cross-row)", () => {
    // 2 same-rank lands = pair in land row; 2 same-role cards = pair in role row
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, role("scholar", "sovereignty"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("two-pair");
    expect(m?.projectId).toBe("p-two-pair");
  });

  test("full-house: three-in-lands + pair-in-roles (cross-row)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeLand(col, land(7, "sovereignty"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, role("scholar", "sovereignty"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("full-house");
    expect(m?.projectId).toBe("p-full-house");
  });

  test("full-house: three-in-roles + pair-in-lands (cross-row, reversed)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, role("scholar", "sovereignty"));
    placeInfluence(col, role("scholar", "heritage"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("full-house");
  });

  test("full-house: three-in-lands + three-in-roles (both rows have ≥pair)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeLand(col, land(7, "sovereignty"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, role("scholar", "sovereignty"));
    placeInfluence(col, role("scholar", "heritage"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("full-house");
  });

  test("full-house: single-row full-house in land row (3+2 same-rank lands)", () => {
    // 5 lands: rank 7 ×3, rank 8 ×2 → land-row full-house
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeLand(col, land(7, "sovereignty"));
    placeLand(col, land(8, "solidarity"));
    placeLand(col, land(8, "heritage"));
    placeInfluence(col, role("scholar", "transformation"));
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("full-house");
  });

  test("straight: land-row straight (5 consecutive ranks)", () => {
    // ranks 5,6,7,8,9 in land row → straight
    const col = createEmptyColumn();
    for (const r of [5, 6, 7, 8, 9]) placeLand(col, land(r, "heritage"));
    placeInfluence(col, role("scholar", "solidarity")); // mixes ideology → no flush
    placeCharter(col, charter());
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("straight");
    expect(m?.projectId).toBe("p-straight");
  });

  test("straight-flush: land-row straight + every column card mono-ideology", () => {
    // ranks 5,6,7,8,9 all solidarity; role solidarity; charter solidarity
    const col = createEmptyColumn();
    for (const r of [5, 6, 7, 8, 9]) placeLand(col, land(r, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("straight-flush");
    expect(m?.projectId).toBe("p-sf");
  });

  test("royal-flush: role-row straight + every column card mono-ideology", () => {
    // one of each role type (ranks 10-14) all solidarity + 1 land solidarity + charter solidarity
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    for (const r of ["agitator", "scholar", "preacher", "engineer", "architect"] as const) {
      placeInfluence(col, role(r, "solidarity"));
    }
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("royal-flush");
    expect(m?.projectId).toBe("p-rf");
  });

  test("royal-flush beats straight-flush when both could apply (role-straight + flush)", () => {
    // If the role row is a straight AND the land row is also a straight, and it's mono-ideology,
    // royal-flush (rung 1) wins over straight-flush (rung 2).
    const col = createEmptyColumn();
    for (const r of [5, 6, 7, 8, 9]) placeLand(col, land(r, "solidarity"));
    for (const r of ["agitator", "scholar", "preacher", "engineer", "architect"] as const) {
      placeInfluence(col, role(r, "solidarity"));
    }
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("royal-flush");
  });

  test("flush beats straight when only flush is present (no straight in either row)", () => {
    // 3 same-rank lands + role + charter all solidarity → flush wins over anything lower
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("four-of-a-kind beats flush (4-land mono-ideology column)", () => {
    const col = createEmptyColumn();
    for (let i = 0; i < 4; i++) placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("four-of-a-kind");
  });
});
