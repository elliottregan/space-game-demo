# Tableau Three-Tier Redesign

**Date:** 2026-05-12
**Branch:** `claude/deck-building-strategy-redesign-waif6`
**Status:** Approved for implementation planning

## Goal

Restructure the tableau into three explicit rows (Land → Influence → Charter) and move Mega-Structure completion off the hand and onto the column. A column's poker shape determines which **Keystone Project** unlocks. Epochs end at a per-Setting turn cap (the "Crisis"), and the outcome is decided by the cumulative value of unlocked projects vs. the Crisis difficulty.

This replaces the current model where Mega-Structures complete from the hand against a fixed `requiredHand` recipe per project.

## Player-facing summary

- The tableau has three rows per column: Land (bottom), Influence (middle), Charter (top).
- You stack matching-rank Lands in row 1 to "improve" the land. Once a column has any Land, you can place a Role in row 2. Once Influence is filled, you can place a Charter in row 3.
- Drag a card onto **any cell** of a column; it routes to the correct row based on its kind.
- A column with at least `1 Land + Role + Charter` can be **Built**. Building consumes the whole column (cards go to discard pile, slot empties) and unlocks the project corresponding to the column's poker pattern (high-card / pair / three-of-a-kind / flush / four-of-a-kind).
- Each Setting has a fixed turn budget. When the budget runs out, the **Crisis** fires: the engine walks your unlocked projects in reverse-pattern order, sums their values, and compares to the Crisis difficulty. Pass → win, mint Legacy, transition to the next Setting. Fail → loss.
- New verbs replace "retrieve":
  - Discard a Land from row 1 (free; adds 1 Quiet Dissent).
  - Discard a Charter from row 3 (free; adds 1 Quiet Dissent).
  - Recall an Influence (Role) from row 2 back to hand (free; no Dissent).
  - Discard the whole column (free; one Quiet Dissent per card).
- All discards (tableau or hand) add 1 Quiet Dissent. Hand discards no longer grant Material.

## Architecture decisions

### Option C selected (dedicated tier types)

Replace `TableauSlot` with a `Column` aggregate whose three rows have their own value types. Each row's placement rule is encoded in its own pure helper; misplacement is unrepresentable at the type level. Rationale: a 3-row tableau is structurally different from a stack, and the type system should make that explicit.

### Internal dispatch instead of scattered side effects

State-mutating game actions are modeled as a discriminated union (`GameEvent`) routed through a single `dispatch(epoch, event)` function. Side effects ("a discard adds Dissent") live in one place. Commands in `epoch.ts` validate input, build events, and call `dispatch`. No external subscriber/observer API in v1.

### Universal pattern engine; per-Setting project roster

Pattern detection (high-card / pair / three / flush / four) is global and pure. Each Setting carries its own roster of exactly five projects (one per pattern) with configurable values and flavor names. Highest-pattern-wins, one project unlock per Build, multiple unlocks of the same project allowed (each logged).

## Data model

```ts
// src/core/types.ts (key additions / changes)

export type CardKind = "land" | "role" | "charter" | "dissent";
// "keystone" is renamed to "charter" across the codebase.

export interface LandRow {
  cards: Card[]; // all same rank when non-empty; max length 4
}

export interface InfluenceRow {
  card: Card | null; // a card with kind === "role"
}

export interface CharterRow {
  card: Card | null; // a card with kind === "charter"
}

export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  charter: CharterRow;
}

export type PatternKind =
  | "high-card"
  | "pair"
  | "three-of-a-kind"
  | "flush"
  | "four-of-a-kind";

export interface KeystoneProject {
  id: string;
  pattern: PatternKind;
  name: string; // setting-specific flavor: "Founding Stone", "Public Library", ...
  flavor: string;
  value: number; // contribution to Crisis score; configurable per project
  unlockEffect?: Effect; // optional; semantics (one-shot vs passive) deferred
}

export interface ProjectUnlock {
  projectId: string;
  pattern: PatternKind;
  turn: number;
  cards: Card[]; // every card in the column at Build time; used for ideology breakdown
}

export interface Crisis {
  id: string;
  name: string;
  flavor: string;
  difficulty: number; // sum of unlocked-project values needed to clear
}

export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  contributingUnlocks: ProjectUnlock[]; // ordered by reverse-pattern order
}

export type GameEvent =
  | { type: "card-played-to-land"; card: Card; columnIndex: number }
  | { type: "card-played-to-influence"; card: Card; columnIndex: number }
  | { type: "card-played-to-charter"; card: Card; columnIndex: number }
  | { type: "card-discarded"; card: Card; source: DiscardSource }
  | { type: "card-recalled-to-hand"; card: Card; columnIndex: number }
  | { type: "column-built"; columnIndex: number; unlock: ProjectUnlock }
  | { type: "dissent-added"; variant: "quiet" | "backlash" | "unrest" }
  | { type: "turn-ended"; turn: number }
  | { type: "crisis-resolved"; outcome: CrisisOutcome };

export type DiscardSource = "tableau-land" | "tableau-charter" | "column" | "hand";

export type EpochPhase = "play" | "crisis" | "end-of-epoch";

export interface Epoch {
  // existing: deck, discardPile, hand, turn, resources, terrain, ...
  columns: Column[]; // replaces tableau: TableauSlot[]
  unlockedProjects: ProjectUnlock[];
  eventLog: GameEvent[];
  phase: EpochPhase;
  crisis: { config: Crisis; status: "pending" | "resolved"; outcome?: CrisisOutcome };
}

export interface SettingRules {
  // existing fields...
  maxTurns: number; // new; configurable per Setting
  handSize: number;
}

export interface Setting {
  // existing: id, name, description, rules, startingDeck, transitions, ...
  rules: SettingRules;
  startingColumns: ColumnConfig[]; // replaces startingTableau
  projects: KeystoneProject[]; // exactly 5 (one per pattern)
  crisis: Crisis;
}
```

### Placement rules

| Row | Accepts | Gate |
|---|---|---|
| Land | `card.kind === "land"` | Empty OR `card.rank === lands.cards[0].rank`, and `lands.cards.length < 4` |
| Influence | `card.kind === "role"` | `influence.card === null` AND `lands.cards.length >= 1` |
| Charter | `card.kind === "charter"` | `charter.card === null` AND `influence.card !== null` |

`MAX_STACK_DEPTH = 4` unchanged.

## Pattern engine

`src/core/columnPatterns.ts` — new pure module.

```ts
export interface PatternMatch {
  kind: PatternKind;
  projectId: string;
  cards: Card[]; // every card in the column
}

export function evaluateColumn(col: Column, projects: KeystoneProject[]): PatternMatch | null;
```

Returns `null` unless the column has `lands.cards.length >= 1 && influence.card && charter.card`. Otherwise returns the **highest** matched pattern, checked in this order (poker rank: Four > Flush > Three > Pair > High Card):

1. **Four of a kind** — `lands.cards.length === 4`. Wins even if mono-ideology.
2. **Flush** — every card in the column shares one ideology. A 3-land mono-ideology column resolves as Flush (Flush outranks Three in poker order).
3. **Three of a kind** — `lands.cards.length === 3`.
4. **Pair** — `lands.cards.length === 2`.
5. **High card** — `lands.cards.length === 1`.

The matched `projectId` is looked up from the Setting's `projects` roster by `pattern`. Each Setting has exactly one project per pattern.

`unlockedIdeologyBreakdown(unlocks: ProjectUnlock[]): Record<Ideology, number>` — sums ideology occurrences across all unlocks' `cards`. Used by the sidebar's aggregate display and the campaign-transition hand-off (its consumer in future Epochs is TBD).

## Dispatch and side-effect rules

`src/core/dispatch.ts` — single entry point for state mutation.

```ts
export function dispatch(epoch: Epoch, ev: GameEvent): void;
```

Handlers (one per event type):

| Event | Effects |
|---|---|
| `card-played-to-land` | Push card to `col.lands.cards`. Append event to `epoch.eventLog`. |
| `card-played-to-influence` | Set `col.influence.card`. Apply role's on-play `effect` if defined. Append event. |
| `card-played-to-charter` | Set `col.charter.card`. Apply charter's on-play `effect` if defined. Append event. |
| `card-discarded` | Push card to `epoch.discardPile`. Recursively dispatch `dissent-added` (variant: "quiet"). Append event. |
| `dissent-added` | Push a generated dissent card to the top of `epoch.deck`. Append event. |
| `card-recalled-to-hand` | Move card from `col.influence` to `epoch.hand`. No dissent. Append event. |
| `column-built` | Push `ev.unlock` to `epoch.unlockedProjects`. Dispatch one `card-discarded` per card in `ev.unlock.cards` (so the discard pipeline applies uniformly, including Dissent — this is intentional). Empty the column. Append event. |
| `turn-ended` | Increment `epoch.turn`. If `epoch.turn > rules.maxTurns`, set `epoch.phase = "crisis"`. Otherwise run end-of-turn upkeep (draw to handSize, etc.). Append event. |
| `crisis-resolved` | Store outcome in `epoch.crisis.outcome`, set `status: "resolved"`, set `epoch.phase = "end-of-epoch"`. Append event. |

**Centralized discard rule.** Every discard (tableau land, tableau charter, column-build cascade, hand) flows through `card-discarded`. Changing the Dissent rule later (e.g., "Charter discard adds Backlash, not Quiet Dissent") is a single edit in the `card-discarded` handler. No call-site hunt.

**Event log persistence.** `epoch.eventLog` accumulates every dispatched event and persists to save state. Not surfaced in v1 UI; available for future replay / undo / debug.

## Commands (renderer-facing GameAPI)

| Command | Args | Internal events dispatched |
|---|---|---|
| `placeCard` | `(cardId, columnIndex)` | One of `card-played-to-{land\|influence\|charter}` based on `card.kind`. Validates row gates first. |
| `discardLand` | `(columnIndex)` | `card-discarded` (source: `tableau-land`) for the top land card. |
| `discardCharter` | `(columnIndex)` | `card-discarded` (source: `tableau-charter`) for the charter card. |
| `recallInfluence` | `(columnIndex)` | `card-recalled-to-hand` for the role card. |
| `discardColumn` | `(columnIndex)` | N × `card-discarded` (source: `column`) for every card in the column. |
| `buildColumn` | `(columnIndex)` | `column-built` with the evaluated `ProjectUnlock`. No-op if `evaluateColumn` returns null. |
| `discardFromHand` | `(cardId)` | `card-discarded` (source: `hand`). **No Material gained.** |
| `endTurn` | — | `turn-ended`. |
| `resolveCrisis` | — | `crisis-resolved` with computed outcome. Walks unlocks in `four → flush → three → pair → high-card` order; sums `value`; compares to `crisis.difficulty`. |
| `advanceEpoch` | `(legacyChoices)` | Unchanged from current campaign flow; consumes Legacy candidates and transitions to the next Setting. |

`validColumns(cardId)` (replaces `validSlots`) — returns indices of columns where the dragged card could legally land. The renderer uses this to highlight whole columns during drag.

## Removed code paths

- `MegaProject`, `HandRequirement`, `requiredHand`, `keystoneId` (type + Setting fields).
- `src/core/patterns.ts` — replaced by `src/core/columnPatterns.ts`.
  - `evaluateMegaStructure`, `scoreMegaStructure`, `completionTier`, `legacyCandidateCount`, `describeRequirement` all removed.
- `playMegaStructure` command on Epoch and GameAPI.
- `src/core/tableau.ts` — replaced by `src/core/column.ts`.
- `discardForMaterial` (renamed to `discardFromHand` with new semantics — no Material gain).
- Renderer: `ProjectZonesPanel.vue`, `ProjectZone.vue`, `EndOfEpochScreen.vue` (Crisis screen subsumes its role).

## Setting balance knobs

Each Setting declares:

- `rules.maxTurns: number` — turn budget.
- `crisis: Crisis` — id, name, flavor, `difficulty`.
- `projects: KeystoneProject[]` — exactly five, one per pattern. `value` field is per-project (configurable).

Default value scale (recommendation, not enforced): `high-card: 1, pair: 2, three-of-a-kind: 4, flush: 5, four-of-a-kind: 8`. Individual Settings can override per project for balance.

Initial Settings to update: `homeworld.ts`, `generationShip.ts`, `ruinedHomeworld.ts`. Each gets a `crisis`, a `maxTurns`, and five `KeystoneProject` entries.

## UI

### Tableau

CSS-grid container (`TableauPanel.vue`), 3 rows × N columns. Row labels (Charter / Influence / Land) anchored in the left margin. Header retains the production indicator.

- `TableauColumn.vue` — wraps one column. Owns drag-drop entry; routes `placeCard` to the correct row by `card.kind`.
- `LandCell.vue` — stacked Land cards, top card has a "Discard" button.
- `InfluenceCell.vue` — single role card with a "Recall" button.
- `CharterCell.vue` — single charter card with a "Discard" button.
- `ColumnFooter.vue` — docked under each column: `[Discard column]` `[Build]`. Build's tooltip surfaces the pattern that would unlock and the project's value.

Locked cells render as dimmed frames with a lock glyph and a one-line hint ("place a Land first" / "fill Influence first"). The hint adapts during drag to reflect whether the dragged card could ever land there.

**Drag highlighting.** When dragging from the hand, every column that could accept the card glows; within a glowing column the legal cell highlights brighter. Dropping anywhere on a glowing column dispatches to the right row.

### Sidebar (`UnlockedProjectsPanel.vue`)

Replaces `ProjectZonesPanel.vue` + `ProjectZone.vue`. Layout:

- Header: aggregate ideology display (4 counts: Solidarity / Sovereignty / Heritage / Transformation), derived via `unlockedIdeologyBreakdown(unlocks)`.
- Below: list of `ProjectUnlock` entries grouped by pattern. Each group has a heading with its running tally (`"3 Pairs unlocked · value 6"`). Each entry shows project name, pattern badge, value, text ideology breakdown (e.g., `"S 3 · H 1"`), and turn played.

### Turn bar (`TurnBar.vue`)

Adds turn budget. Format: `Turn 4 / 12 · Crisis on turn 13`. Progress bar saturates toward red as the cap approaches.

### Crisis (`CrisisScreen.vue`, new)

Subsumes the old end-of-epoch screen for both win and loss.

- Crisis name + flavor + difficulty.
- Static reveal of the resolution walk: list unlocks in reverse-pattern order with their value contributions and a cumulative running total compared to `difficulty`.
- Aggregate ideology breakdown derived from all unlocks (same data the sidebar shows; surfaced on the Crisis screen for end-of-Epoch context).
- Verdict line + Legacy choice (reuses `LegacyChoiceRow.vue`) on win. Loss path uses the same screen with no Legacy mint.

Legacy candidate selection on win consumes `CrisisOutcome` plus the unlock log: the existing `legacy.ts` mint logic adapts to read pattern types and ideology counts instead of the deprecated `completionTier`. Aggregate ideology counts are also stored on the resulting Campaign state for cross-Epoch consumers (placeholder for future effects).

### Hand

`HandPanel.vue`: drop the "play to project" path. Cards leave hand via drag-to-column or the per-card "Discard" button. Discard tooltip explains the Dissent cost. No Material reward.

## Tests

- Rename `tests/patterns.test.ts` → `tests/columnPatterns.test.ts`. Cover every pattern, tie-breakers (3-land mono-ideology resolves as Flush; 4-land mono-ideology resolves as Four of a Kind), and incomplete columns (return null).
- Rename `tests/winflow.test.ts` → `tests/crisisflow.test.ts`. Drive an Epoch to the turn cap, verify outcome calc, verify Legacy minting on win.
- New `tests/dispatch.test.ts` — every event type → asserted state transition. Covers the centralized discard rule and the column-built cascade.
- Update `tests/ideology.test.ts` to include `unlockedIdeologyBreakdown`.
- Update `tests/smoke.test.ts` to drive the new GameAPI command surface end-to-end.

## Heuristic script

Rename `scripts/analyze-paths.ts` → `scripts/analyze-crisis.ts`. New goal: per Setting, run N Epochs with a greedy heuristic that fills columns and presses Build when a target pattern matches. Report:

- Crisis win rate.
- Average turn of first Pair / Three / Flush / Four unlock.
- Average value-vs-difficulty margin at Crisis.
- Final ideology breakdown.

## Persistence

Bump `localStorage` key from `deck-demo-saves-v2` → `deck-demo-saves-v3`. On first load with no v3 key:

- If a v2 store exists, copy it to `deck-demo-saves-v2-archive` and initialize an empty v3 store.
- Show a one-time banner: "Your previous saves were preserved in `localStorage` under the v2 key; the new mechanics aren't save-compatible."

No automated v2 → v3 migration is built. The shape change is too large to justify the effort.

## Out of scope (deferred)

- Multi-column patterns (two-pair, full house, straight, straight flush, royal flush).
- Concrete semantics of `KeystoneProject.unlockEffect` (one-shot vs passive). Field exists; behavior is no-op for now.
- Cross-Epoch consumer of `unlockedIdeologyBreakdown` output. The data is captured at Crisis time; future Epochs can read it via campaign state, but no consumer is wired in v1.
- Animations on the Crisis screen.
- Internal event emitter for the renderer to subscribe to game events.
