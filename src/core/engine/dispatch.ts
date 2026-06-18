// Single state-mutation entry point. Every state change in core flows
// through dispatch(epoch, event). Side-effect rules (e.g. "discard adds
// Dissent") live in one place: this file.

import type { Epoch, GameEvent } from "../types.ts";
import { makeDissent } from "../data/cards.ts";
import { clearColumn } from "./column.ts";
import type { RNG } from "./rng.ts";

/**
 * Apply a game event to the epoch.
 *
 * `rng` is optional and only consulted by the `dissent-added` rule: when
 * provided, a freshly-bred Dissent card is shuffled into a RANDOM position in
 * the draw pile (the documented behavior). When omitted, it falls back to a
 * deterministic front-insert — used by low-level tests that drive dispatch
 * directly without a PRNG. All gameplay paths thread the seedable rng through,
 * keeping Dissent placement reproducible under a fixed seed.
 */
export function dispatch(epoch: Epoch, ev: GameEvent, rng?: RNG): void {
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
      // Centralized rule: every WASTEFUL discard adds one Dissent. Recurse
      // through dispatch so any future hooks on `dissent-added` apply.
      // Forward rng so the bred Dissent shuffles in rather than stacking on top.
      // Exception: cards consumed by a Build (`source: "build"`) are the reward
      // path — they cycle back via the discard pile but breed no Dissent.
      if (ev.source !== "build") {
        dispatch(epoch, { type: "dissent-added" }, rng);
      }
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
          dispatch(epoch, { type: "card-discarded", card: c, source: "build" }, rng);
        }
      }
      return;
    }
    case "dissent-added": {
      // Shuffle the fresh Dissent into the draw pile at a random position so it
      // is not dealt straight into the next opening hand (it would be if it sat
      // at draw[0]). With no rng (low-level tests), front-insert deterministically.
      const dissent = makeDissent();
      if (rng) {
        const idx = rng.int(epoch.draw.length + 1);
        epoch.draw.splice(idx, 0, dissent);
      } else {
        epoch.draw.unshift(dissent);
      }
      break;
    }
    case "card-stored": {
      const col = epoch.columns[ev.columnIndex];
      if (col) col.storage.push(ev.card);
      break;
    }
    case "turn-ended":
    case "crisis-resolved":
      break;
  }
  epoch.eventLog.push(ev);
}
