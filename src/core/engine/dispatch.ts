// Single state-mutation entry point. Every state change in core flows
// through dispatch(epoch, event). Side-effect rules (e.g. "discard adds
// Dissent") live in one place: this file.

import type { Epoch, GameEvent } from "../types.ts";
import { makeDissent } from "../data/cards.ts";
import { clearColumn } from "./column.ts";

export function dispatch(epoch: Epoch, ev: GameEvent): void {
  switch (ev.type) {
    case "card-played-to-land": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.lands.cards.push(ev.card);
      break;
    }
    case "card-played-to-influence": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.influence.cards.push(ev.card);
      break;
    }
    case "card-played-to-charter": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.charter.card = ev.card;
      break;
    }
    case "cards-committed": {
      const col = epoch.columns[ev.columnIndex];
      if (!col) return;
      const target = ev.row === "land" ? col.lands.cards : col.influence.cards;
      for (const card of ev.cards) target.push(card);
      break;
    }
    case "card-discarded": {
      epoch.discard.push(ev.card);
      epoch.eventLog.push(ev);
      // Centralized rule: every discard adds one Quiet Dissent. Recurse
      // through dispatch so any future hooks on `dissent-added` apply.
      dispatch(epoch, { type: "dissent-added", variant: "quiet" });
      return; // eventLog already appended above
    }
    case "column-built": {
      epoch.unlockedProjects.push(ev.unlock);
      const col = epoch.columns[ev.columnIndex];
      if (col) {
        const cards = [...ev.unlock.cards];
        clearColumn(col);
        // Append the column-built event before the cascading discards so the
        // log records the build atomically before its consequences.
        epoch.eventLog.push(ev);
        for (const c of cards) {
          dispatch(epoch, { type: "card-discarded", card: c, source: "column" });
        }
      }
      return;
    }
    case "dissent-added": {
      const card = makeDissent(ev.variant, ev.ideology);
      epoch.draw.unshift(card);
      break;
    }
    case "turn-ended":
    case "crisis-resolved":
      break;
  }
  epoch.eventLog.push(ev);
}
