import { describe, test, expect } from "bun:test";
import { dispatch } from "../src/core/dispatch.ts";
import { createEmptyColumn, placeLand, placeInfluence, placeCharter } from "../src/core/column.ts";
import { getCard, landId, roleId } from "../src/core/cards.ts";
import type { Column, Epoch, ProjectUnlock } from "../src/core/types.ts";

function freshEpoch(columns: Column[] = []): Epoch {
  return {
    epochNumber: 1,
    settingId: "test",
    turn: 1,
    phase: "play",
    hand: [],
    draw: [],
    discard: [],
    columns,
    unlockedProjects: [],
    eventLog: [],
    influence: 0,
    materials: 0,
    taskProgress: {},
    tasksRevealed: [],
    endOfTurnQueue: [],
    status: { kind: "in-progress" },
    crisis: { status: "pending" },
  };
}

const land = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("dispatch", () => {
  test("card-discarded pushes to discard pile AND adds a quiet dissent to deck", () => {
    const ep = freshEpoch();
    const card = land(7, "solidarity");
    dispatch(ep, { type: "card-discarded", card, source: "hand" });
    expect(ep.discard).toContain(card);
    const top = ep.draw[0];
    expect(top?.tags.includes("dissent")).toBe(true);
    expect(top?.name).toBe("Quiet Dissent");
  });

  test("dissent-added places a dissent card on top of the deck", () => {
    const ep = freshEpoch();
    dispatch(ep, { type: "dissent-added", variant: "quiet" });
    expect(ep.draw[0]?.tags.includes("dissent")).toBe(true);
  });

  test("card-recalled-to-hand moves card back to hand with no dissent", () => {
    const col = createEmptyColumn();
    const r = getCard(roleId("scholar", "solidarity"));
    placeLand(col, land(7, "solidarity"));
    placeInfluence(col, r);
    const ep = freshEpoch([col]);
    dispatch(ep, { type: "card-recalled-to-hand", card: r, columnIndex: 0 });
    expect(ep.hand).toContain(r);
    expect(ep.draw.length).toBe(0); // no dissent
    expect(col.influence.card).toBeNull();
  });

  test("column-built cascades discards through the discard handler (one dissent per card) and clears the column", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    placeCharter(col, getCard("keystone-founding-charter"));
    const ep = freshEpoch([col]);
    const unlock: ProjectUnlock = {
      projectId: "p-pair",
      pattern: "pair",
      turn: ep.turn,
      cards: [...col.lands.cards, col.influence.card!, col.charter.card!],
    };
    dispatch(ep, { type: "column-built", columnIndex: 0, unlock });
    expect(ep.unlockedProjects).toContain(unlock);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.card).toBeNull();
    expect(col.charter.card).toBeNull();
    // 4 cards discarded → 4 dissent added.
    expect(ep.draw.filter((c) => c.tags.includes("dissent")).length).toBe(4);
    expect(ep.discard.length).toBe(4);
  });

  test("event is appended to eventLog", () => {
    const ep = freshEpoch();
    dispatch(ep, { type: "dissent-added", variant: "quiet" });
    expect(ep.eventLog.length).toBe(1);
    expect(ep.eventLog[0]!.type).toBe("dissent-added");
  });
});
