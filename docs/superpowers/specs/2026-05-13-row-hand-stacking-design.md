# Row-hand stacking — design

**Date:** 2026-05-13
**Status:** Approved for plan
**Branch context:** Built atop `feat/ui-colocate-projects-ideology-panels`. Implementation lands as a PR back into that branch (not `main`).

## Problem

Today only the Land row stacks. Influence (Role) and Charter rows are single-card slots. A player holding two Q-rank role cards expects to play both into the same column the way they would two same-rank lands, but the Influence row rejects the second card. The mechanic is inconsistent across rows.

We want a unified model in which a player can keep adding cards to a column over multiple turns to grow it into a stronger keystone — the way Lands already work — applied to Influence as well.

## Goals

- Land and Influence rows obey the same stacking rule.
- Charter row remains single-card (one Charter completes a column).
- The valid stack states are exactly the configured poker patterns; the row must be a valid poker hand after every placement.
- Same-rank growth (1 → pair → three → four) happens incrementally one card at a time.
- Multi-rank patterns (straight, two-pair, full-house) are reachable via a one-shot "commit a hand" action.
- Pattern set expands to the full poker ladder including straight-flush and royal-flush.

## Non-goals

- Changing how Charters are played.
- Changing the ideology vector derivation, end-of-turn cycling, Dissent-on-discard rule, or the `EffectSpec` DSL.
- Migrating existing save data — v3 saves are archived without conversion (matches the v2 → v3 precedent).
- Cross-row hand combinations that span ranks (e.g. a "straight" using lands 8, 9 and roles 10, 11, 12). Each row's hand is evaluated independently; the column combines hand types, not raw cards.
- Backwards compatibility of any kind.

## Mechanics

### Rows

| Row | Stack? | Contents | Valid states |
|---|---|---|---|
| Land | yes | `Card[]` where every card has `kind === "land"` | any row-hand type (see "Row hand types" below), 1–5 cards |
| Influence | yes | `Card[]` where every card has `kind === "role"` | any row-hand type, 1–5 cards |
| Charter | no | a single `Card` with `kind === "charter"` | unchanged from today |

A "row-hand type" is a subset of `PatternKind`: rows are validated against high-card, pair, two-pair, three-of-a-kind, straight, four-of-a-kind, full-house. Flush, straight-flush, and royal-flush are column-level resolutions and never validate a row.

The Land and Influence rows obey identical placement rules; they differ only in which `CardKind` they accept.

### Placement actions

**Single-card placement** (existing `placeCard`):

- Places one card from hand into a row.
- Valid iff the resulting stack is a recognised poker hand from the configured set.
- In practice: works for the first card of any row (high-card is always valid) and for same-rank growth (pair / three / four). Anything else is rejected with a clear message.

**Multi-card commit** (new `commitHand`):

- Plays a set of cards from hand into a row in one atomic move.
- Valid iff the resulting row stack is a recognised poker hand.
- Pays the summed `influenceCost` for the move.
- Triggers each card's `effect` in placement order (immediate effects fire on the running state; end-of-turn effects queue normally).
- Multi-card commits add **no Dissent** — committing is not a discard.

**Row-discard** (existing `recallInfluence`, `discardLand`, `discardColumn`):

- Wipes the entire row in one action. No per-card surgery.
- The "every discard adds 1 Quiet Dissent" rule still applies to the action, not per-card.
- This preserves the "row is always a valid hand" invariant after a discard (empty row is trivially valid; the column is no longer buildable until refilled).

### Stack cap

No hard `MAX_STACK_DEPTH`. The pattern set is the cap: the largest configured hand is 5 cards (straight, full-house, straight-flush, royal-flush), so a row tops out at 5.

## Pattern set

```ts
// src/core/data/projects.ts
export type PatternKind =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush"
  | "royal-flush";

export const PATTERNS_IN_ORDER: PatternKind[] = [
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
];

export const DEFAULT_PROJECT_VALUE: Record<PatternKind, number> = {
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
};
```

### Row hand types

A single Land or Influence row can independently form:

| Hand | Cards | Shape |
|---|---|---|
| high-card | 1 | any single card |
| pair | 2 | same rank |
| two-pair | 4 | two ranks, each ×2 |
| three-of-a-kind | 3 | same rank |
| straight | 5 | consecutive ranks |
| four-of-a-kind | 4 | same rank |
| full-house | 5 | 3 of rank A + 2 of rank B |

Flush, straight-flush, and royal-flush are column-level resolutions (they require the column-wide ideology check) and never appear as a row-hand classification.

### Column pattern resolution

`evaluateColumn(col, projects)` walks the priority list top → bottom; first match wins. The column is only evaluated if buildable (≥1 Land, ≥1 Role, charter card present).

1. **royal-flush** — Influence row forms a straight AND every card in the column shares one ideology
2. **straight-flush** — Land row forms a straight AND every card in the column shares one ideology
3. **four-of-a-kind** — any row contains four
4. **full-house** — any row contains full-house, OR (one row has three + the other has at least a pair)
5. **flush** — every card in the column shares one ideology
6. **straight** — any row contains a straight
7. **three-of-a-kind** — any row contains three
8. **two-pair** — any row contains two-pair, OR both rows have at least a pair
9. **pair** — any row contains a pair
10. **high-card** — default

#### Why royal-flush only fires from the Influence row

Roles occupy ranks 10–14 (agitator/scholar/preacher/engineer/architect = 10/J/Q/K/A). A role-row straight is necessarily the 10-J-Q-K-A sequence — the poker "royal" range. Lands span 2–9, so any land-row straight tops out at 9 and never qualifies as royal. The split falls out of the existing rank scheme rather than requiring a special-case rank check.

#### Cross-row matching

Lands (2–9), roles (10–14), and charter (15) have non-overlapping rank ranges. Same-rank cross-row pairs can't form naturally. Cross-row straights are not allowed by design: each row's hand is evaluated independently, then combined at the hand-type level (pair + pair = two-pair, three + pair = full-house, etc.). Treating lands + roles as one merged poker hand was considered and rejected — it breaks the "row IS the hand" mental model the player builds via the single-card growth path.

### Crisis order

Falls out of `reversePatternOrder()` automatically:
`royal-flush → straight-flush → four → full-house → flush → straight → three → two-pair → pair → high-card`.

## Schema changes

```ts
// src/core/engine/column.ts
export interface InfluenceRow {
  cards: Card[];   // was: card: Card | null
}
// LandRow and CharterRow unchanged

export interface ColumnConfig {
  lands: string[];
  influence?: string[];   // was: influence?: string
  charter?: string;
}
```

`KeystoneProject`, `ProjectUnlock`, `Crisis`, `CrisisOutcome` types stay structurally identical — they're keyed on `pattern: PatternKind`, which gains new values.

## Files touched

### Core

| File | Change |
|---|---|
| `src/core/data/projects.ts` | extend `PatternKind`, `PATTERNS_IN_ORDER`, `DEFAULT_PROJECT_VALUE` |
| `src/core/engine/column.ts` | `InfluenceRow.cards`; new helpers `validateRowHand`, `canCommitHand`; update `canPlaceInfluence`, `placeInfluence`, `columnCards`, `columnFromConfig`, `isBuildable` |
| `src/core/engine/columnPatterns.ts` | full rewrite of `evaluateColumn` — per-row hand classification + 10-rung column resolution |
| `src/core/engine/commands.ts` | add `commitHand(epoch, columnIndex, row, cardIds)`; extend `recallInfluence` to wipe the entire influence stack |
| `src/core/engine/events.ts` | new event `cards-committed { columnIndex, row, cards }` |
| `src/core/engine/dispatch.ts` | handler for `cards-committed` — appends, deducts cost, fires per-card effects in order, **no Dissent** |
| `src/core/types.ts` | re-exports stay in sync |
| `src/core/settings/homeworld.ts`<br>`src/core/settings/generationShip.ts`<br>`src/core/settings/ruinedHomeworld.ts` | author 5 new keystone projects each: two-pair, straight, full-house, straight-flush, royal-flush (15 total) |

### Facade

| File | Change |
|---|---|
| `src/facade/GameAPI.ts` | expose `commitHand`; update `validColumns` (single-card check only), `getEffectiveCost`, `snapshot` (deep-clone influence stack) |
| `src/facade/persistence.ts` | archive v3 saves to `deck-demo-saves-v3-archive` on first load of v4; new key `deck-demo-saves-v4`. **No migration code.** |

### Renderer

D-1 interaction model: multi-select buffer in `HandPanel`, commit via a buffered "Lay down hand" button targeting a row.

| File | Change |
|---|---|
| `src/renderer/components/game/HandPanel.vue` | multi-select state, pending-commit buffer (running cost + live row-hand classification), commit button per row, inline "why invalid" hint |
| `src/renderer/components/game/InfluenceCell.vue` | render as a stack (visual port of `LandCell`); accept commit-drop target |
| `src/renderer/components/game/LandCell.vue` | accept commit-drop alongside single-card drop |
| `src/renderer/components/game/TableauColumn.vue` | layout for the now-stackable influence row |
| `src/renderer/components/game/ColumnFooter.vue` | render new pattern names (two-pair, straight, full-house, straight-flush, royal-flush) |
| `src/renderer/components/game/UnlockedProjectsPanel.vue` | row entries for 5 new patterns |
| `src/renderer/GameService.ts` | bind `commitHand`; expose multi-select buffer state |

### Tests

| File | New / updated cases |
|---|---|
| `tests/columnPatterns.test.ts` | row-hand classification per new pattern; cross-row full-house (3+2); straight-flush vs royal-flush split by row; flush vs straight precedence; cross-row pair → two-pair |
| `tests/column.test.ts` | `canCommitHand` validates row-hand correctness; single-card placement rejects invalid intermediate states (e.g. land 5 + land 6); multi-card commit appends in order |
| `tests/dispatch.test.ts` | `cards-committed` deducts summed cost, fires per-card effects in placement order, **does not** add Dissent |
| `tests/crisisflow.test.ts` | Crisis sums new pattern values; ordering walks `royal → straight-flush → four → ...` correctly |
| `tests/smoke.test.ts` | end-to-end multi-card commit via `GameAPI.commitHand`; influence stack reflected in snapshot |

## Deck composition reality check

The new patterns inherit deck-gating the same way four-of-a-kind currently does. Per Setting:

| Setting | Likely reachable | Likely locked out by deck filter |
|---|---|---|
| Homeworld (open) | all 10 patterns | — |
| Generation Ship (2-ideology) | up to flush, possibly full-house | royal-flush (need 5 ideology-matched roles, only 2 ideologies present); straight-flush depends on whether the 2 ideologies span 5 consecutive land ranks |
| Ruined Homeworld | depends on current filter — audit during balance pass | TBD |

For Settings whose decks naturally lock out high-tier patterns, the authored keystone for that pattern simply never triggers. No special-casing; the data does it.

## Balance retune

Bumping flush 5 → 6 + adding 10/12 top tiers + the new mid tiers means every Setting's existing `crisis.difficulty` was sized against a softer ceiling. Post-implementation:

```
bun run scripts/analyze-crisis.ts 300 homeworld
bun run scripts/analyze-crisis.ts 300 generation-ship
bun run scripts/analyze-crisis.ts 300 ruined-homeworld
```

Adjust each Setting's `crisis.difficulty` until win rate lands where it was pre-change. This is a separate step inside the plan (after the implementation, before merge).

## What's intentionally NOT changing

- Charter placement and discard rules.
- Ideology vector derivation (`deriveVector` still sums all cards in all columns).
- Quiet Dissent on every discard. Commit is not a discard.
- End-of-turn hand cycling.
- 10-slot save store and `GameAPI` constructor surface.
- The `EffectSpec` DSL — no new effect kinds.
- `validColumns(card)` semantics — still answers "where can this single card go". Commit affordance is signaled by the hand-side buffer.

## Implementation workflow

- New worktree branched from `feat/ui-colocate-projects-ideology-panels`.
- PR target: `feat/ui-colocate-projects-ideology-panels` (not `main`).
- Plan structured so the engine layer (core + facade + tests) lands and passes before any renderer change; the renderer + content (15 new projects) lands second; the Crisis retune lands third as the final commit.

## Open items (deferred to plan / implementation)

- Generation Ship and Ruined Homeworld deck-filter audit: confirm exactly which new patterns are reachable, so authored projects align with what players can build.
- Specific keystone names, flavor, and `unlockEffect` for the 15 new projects — author during implementation, not as a blocking design item.
- Exact pixel-level layout of the Influence row when stacked deep (5 cards) — handled during the renderer slice with the existing card-stack visual idiom.
