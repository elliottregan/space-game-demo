// GameEvent — the discriminated union routed through dispatch().
// Every state mutation in core is described as one of these events.

import type { Card, DissentVariant, Ideology } from "../data/cards.ts";
import type { CrisisOutcome, ProjectUnlock } from "../data/projects.ts";

export type DiscardSource = "tableau-land" | "tableau-charter" | "column" | "hand";

export type GameEvent =
  | { type: "card-played-to-land"; card: Card; columnIndex: number }
  | { type: "card-played-to-influence"; card: Card; columnIndex: number }
  | { type: "card-played-to-charter"; card: Card; columnIndex: number }
  | { type: "card-discarded"; card: Card; source: DiscardSource }
  | { type: "card-recalled-to-hand"; card: Card; columnIndex: number }
  | { type: "column-built"; columnIndex: number; unlock: ProjectUnlock }
  | { type: "dissent-added"; variant: DissentVariant; ideology?: Ideology }
  | { type: "turn-ended"; turn: number }
  | { type: "crisis-resolved"; outcome: CrisisOutcome };
