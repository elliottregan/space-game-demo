import { describe, test, expect } from "bun:test";
import { evaluateColumn } from "../src/core/engine/columnPatterns.ts";
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
  placeCharter,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId, makeDissent, type Card } from "../src/core/data/cards.ts";
import type { KeystoneProject } from "../src/core/types.ts";
import { fullJoker } from "./fixtures.ts";

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

  // Still valid under the inverted flush: keystone-pioneer is bare "wild" with no
  // countsAs in P1 (effectiveCard ⇒ ideologies=[]), which BLOCKS the flush.
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

describe("evaluateColumn — wilds (counts-as) complete column shapes", () => {
  test("solidarity column + 1 wild ⇒ flush (wild completes the color)", () => {
    // 1 solidarity land + 1 solidarity role + 1 wild (influence row) + solidarity
    // charter. Every non-wild is solidarity; the wild admits all colors ⇒
    // intersection = {solidarity} ⇒ flush. Kept to one land so no cross-row
    // full-house (land-trips + role-pair) can outrank the flush — the point here
    // is the wild COMPLETING the color, evaluated at the flush rung. The wild
    // pairs the scholar in the role row, but flush (rung 5) beats that pair.
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, fullJoker());
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("2 full jokers ⇒ flush (intended ladder result, Red-team #7)", () => {
    // one wild land-row, one wild influence-row; charter solidarity. Each row
    // classifies high-card; intersection of {all4, all4, solidarity} = {solidarity}.
    const col = createEmptyColumn();
    placeLand(col, fullJoker());
    placeInfluence(col, fullJoker());
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });

  test("straight-flush via one wild that is both the 9 AND a solidarity", () => {
    // lands 5,6,7,8 solidarity + 1 wild ⇒ land-row straight (wild=9) AND, with
    // a solidarity role + solidarity charter, a column flush. The single joker
    // satisfies the rank fact (9) and the color fact (solidarity) at once.
    const col = createEmptyColumn();
    for (const r of [5, 6, 7, 8]) placeLand(col, land(r, "solidarity"));
    placeLand(col, fullJoker());
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("straight-flush");
  });

  test("royal-flush via a wild filling a role-row gap", () => {
    // role row: agitator(10), scholar(11), preacher(12), engineer(13) solidarity
    // + 1 wild ⇒ role-row straight (wild=14) AND flush ⇒ royal-flush.
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    for (const r of ["agitator", "scholar", "preacher", "engineer"] as const) {
      placeInfluence(col, role(r, "solidarity"));
    }
    placeInfluence(col, fullJoker());
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("royal-flush");
  });

  test("partial ideology wild {ideology:[sol,her]} narrows the flush correctly (no isWild escape hatch)", () => {
    // lands: 2 heritage (pair). The partial wild admits {sol,her}. Charter is
    // solidarity. Flush intersection over {heritage, heritage, {sol,her}-wild,
    // solidarity-role, solidarity-charter} is EMPTY (heritage ∩ solidarity = ∅)
    // ⇒ NO flush — the partial wild cannot bridge heritage↔solidarity.
    // The load-bearing assertion is the absence of a flush. The wild is still
    // structurally `isWild` (carries countsAs), so the row classifier lets it
    // stand in as the best RANK: in the influence row it pairs the scholar,
    // giving role=pair. Land=pair + role=pair ⇒ two-pair (the rung below flush).
    const partialWild: Card = {
      ...getCard(landId(7, "heritage")),
      countsAs: { ideology: ["solidarity", "heritage"] },
    };
    const col = createEmptyColumn();
    placeLand(col, land(7, "heritage"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, partialWild);
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("two-pair"); // no flush bridge; wild still pairs as a rank-wild
  });

  test("a stray Dissent in the column blocks the flush (empty option-set)", () => {
    // 2 rank-2 solidarity lands + a Dissent (rank 2, colorless) in the land row
    // ⇒ the Dissent joins the same-rank stack (land row = three-of-a-kind), but
    // its ideologies = [] BLOCK the flush. With a solidarity role + solidarity
    // charter the column would otherwise flush; Dissent's empty option-set kills
    // it ⇒ trips, not flush. (Rank 2 is chosen so the Dissent — which is always
    // rank 2 — does not break the land row's classification.)
    const col = createEmptyColumn();
    placeLand(col, land(2, "solidarity"));
    placeLand(col, land(2, "solidarity"));
    placeLand(col, makeDissent());
    placeInfluence(col, role("scholar", "solidarity"));
    placeCharter(col, charter()); // solidarity
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("three-of-a-kind");
  });

  test("cross-row full-house: land [5,5]+wild ⇒ trips, role pair ⇒ full-house", () => {
    // lands rank 5 ×2 + wild ⇒ three-of-a-kind; role row two same-role ⇒ pair.
    // Mixed colors so no flush outranks it. Charter heritage so it doesn't flush.
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    placeLand(col, fullJoker());
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, role("scholar", "sovereignty"));
    placeCharter(col, getCard("keystone-founding-charter")); // solidarity — mixed column, no flush
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("full-house");
  });

  test("cross-row full-house reversed: role [scholar,wild] ⇒ pair, land trips ⇒ full-house", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeLand(col, land(7, "sovereignty"));
    placeInfluence(col, role("scholar", "transformation"));
    placeInfluence(col, fullJoker());
    placeCharter(col, getCard("keystone-founding-charter"));
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("full-house");
  });
});
