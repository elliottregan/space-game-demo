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
  { id: "p-three", pattern: "three-of-a-kind", name: "Three", flavor: "", value: 4 },
  { id: "p-flush", pattern: "flush", name: "Flush", flavor: "", value: 5 },
  { id: "p-four", pattern: "four-of-a-kind", name: "Four", flavor: "", value: 8 },
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
});
