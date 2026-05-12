// Single state-mutation entry point. Every state change in core flows
// through dispatch(epoch, event). Side-effect rules (e.g. "discard adds
// Dissent") live in one place: this file.

import type { Card, Column, Epoch, GameEvent, ProjectUnlock } from "./types.ts";
import { makeDissent } from "./cards.ts";
import { clearColumn } from "./column.ts";

// Local widening: Epoch in types.ts still has the old shape (tableau,
// EventEntry[]) from before the Task 8 reshape. dispatch.ts targets the
// *future* Epoch shape; we cast once here so the function body is typed.
type EpochV2 = Epoch & {
  columns: Column[];
  unlockedProjects: ProjectUnlock[];
  eventLog: GameEvent[];
};

export function dispatch(epoch: Epoch, ev: GameEvent): void {
  const ep = epoch as EpochV2;

  switch (ev.type) {
    case "card-played-to-land": {
      const col = ep.columns[ev.columnIndex];
      if (col) col.lands.cards.push(ev.card);
      break;
    }
    case "card-played-to-influence": {
      const col = ep.columns[ev.columnIndex];
      if (col) col.influence.card = ev.card;
      break;
    }
    case "card-played-to-charter": {
      const col = ep.columns[ev.columnIndex];
      if (col) col.charter.card = ev.card;
      break;
    }
    case "card-discarded": {
      ep.discard.push(ev.card);
      ep.eventLog.push(ev);
      // Centralized rule: every discard adds one Quiet Dissent. Recurse
      // through dispatch so any future hooks on `dissent-added` apply.
      dispatch(ep, { type: "dissent-added", variant: "quiet" });
      return; // eventLog already appended above
    }
    case "card-recalled-to-hand": {
      const col = ep.columns[ev.columnIndex];
      if (col) col.influence.card = null;
      ep.hand.push(ev.card);
      break;
    }
    case "column-built": {
      ep.unlockedProjects.push(ev.unlock);
      const col = ep.columns[ev.columnIndex];
      if (col) {
        const cards = [...ev.unlock.cards];
        clearColumn(col);
        // Append the column-built event before the cascading discards so the
        // log records the build atomically before its consequences.
        ep.eventLog.push(ev);
        for (const c of cards) {
          dispatch(ep, { type: "card-discarded", card: c, source: "column" });
        }
      }
      return;
    }
    case "dissent-added": {
      const card = makeDissent(ev.variant);
      ep.draw.unshift(card);
      break;
    }
    case "turn-ended":
    case "crisis-resolved":
      break;
  }
  ep.eventLog.push(ev);
}
