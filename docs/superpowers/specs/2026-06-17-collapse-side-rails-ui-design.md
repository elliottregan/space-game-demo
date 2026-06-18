# Collapse side rails into the projects column, a crisis bar, and a stats modal

Date: 2026-06-17
Status: approved (design)

## Problem

Both icon rails open **flyout panels** that waste a lot of vertical space and
hide information players want continuously. The right rail is mostly passive
game stats (Monuments, Legacy cards, Deck counts, Event log) that never needs to
sit on-screen. The left rail hides two things that *should* be persistent: the
Crisis urgency clock, and the ideology/score readouts that belong with the
projects (the projects *are* the points).

## Goal

Remove **both** side rails and **all six** flyouts. Relocate their content:

- **Crisis countdown** → an always-visible slim bar.
- **Score** → the projects column (points belong with projects).
- **Ideology plot** → the projects column.
- **Monuments / Legacy / Deck counts / Event log** → one consolidated modal.

Result: no chrome on the left or right edges of the screen.

## Non-goals / scope

- **Renderer-only.** No `core/` or `facade/` changes. No new game behavior, no
  rules or balance impact.
- No tabs, search, or filtering inside the stats modal — sections stack and
  scroll, exactly as they render today.
- No redesign of the individual section components' internals
  (`ProjectTreePanel`, `IdeologyDisplay`, the four `sidebar/` sections). They are
  **relocated**, not rewritten.
- `snapshot()` already exposes everything needed (`vector`, `effective`,
  `campaign.monuments`, `campaign.legacyCards`, `deckCounts`,
  `epoch.eventLog`) — no new facade queries.

## Current state (for reference)

- `App.vue` `.app-main` grid: `rail · projects · play-area · rail`.
- Left rail (`Rail.vue`) → `RailFlyout` for **Crisis counter** and **Ideology**.
- Right rail → `RailFlyout` for **Monuments**, **Legacy cards**, **Deck counts**,
  **Event log**.
- `CrisisCounterPanel.vue` holds **two** meters: turns-until-Crisis **and**
  score X / difficulty.
- `ProjectTreePanel.vue` already renders the per-ideology **influence chips**;
  these stay.
- `Rail.vue`, `RailFlyout.vue`, `RailIcon.vue`, `CrisisCounterPanel.vue` are used
  **only** by `App.vue` (Rail/RailIcon internally). `IdeologyDisplay.vue` is used
  only by `App.vue`. The four `sidebar/` sections are used only by `App.vue`.
- `TableauPanel.vue:103` has a CSS comment that mentions `RailFlyout`.

## Target layout

```
┌─ header: title · demonym ····················· [Stats] [Theme] [Saves] ┐
├─ TurnBar: Epoch · Turn N/M · Inf · Dissent · effective rules · [End turn] ┤
├─ CrisisBar (slim, full width): CRISIS · [▓▓▓▓▓░░] 3 turns left ··········· ┤
├──────────────┬─────────────────────────────────────────────────────────┤
│ info-column  │  play-area (tableau · hand+piles · policy zone)          │
│  ScoreMeter  │                                                          │
│  Ideology    │                                                          │
│  Projects    │                                                          │
└──────────────┴─────────────────────────────────────────────────────────┘
```

`.app-main` grid changes from four tracks to two: **`info-column · play-area`**.

The Crisis bar sits full-width directly under the TurnBar (the top region spans
the whole width once the rails are gone), so it is visible at all times.

## Components

### New

**`components/game/CrisisBar.vue`** — slim, full-width turns-until-Crisis meter.

- Props: `{ crisis: Crisis; turn: number; maxTurns: number }`.
- Renders, in a single horizontal row: a `CRISIS · <name>` label, the
  turns-left meter track/fill, and the `countdownValue` text ("3 turns" / "1
  turn" / "now").
- Lifts the `turnsLeft`, `turnsBarWidth`, `countdownValue`, and `countdownClass`
  logic **verbatim** from `CrisisCounterPanel.vue`, including the
  `near` / `edge` urgency color classes and their CSS.
- Horizontal layout (not the stacked `meter-section` of the old panel). No
  `Panel` wrapper — it is a bar, not a card.
- Emits nothing.

**`components/game/ScoreMeter.vue`** — the score X / difficulty meter.

- Props: `{ crisis: Crisis; unlocks: ProjectUnlock[]; projects: KeystoneProject[] }`.
- Lifts the `currentScore`, `scoreBarWidth`, `statusLabel`, and the `passing`
  color logic **verbatim** from `CrisisCounterPanel.vue`, plus the `meter-*` CSS
  it needs.
- Renders a `Panel` (title `Score`) so it sits cleanly atop the info-column,
  matching the other panels in that column. Shows the `meter-hint`
  ("N more needed" / "On track to pass").

**`components/shell/StatsModal.vue`** — one modal consolidating the four stat
sections.

- Props: `{ monuments: Monument[]; legacyCards: LegacyCard[]; counts: DeckCounts; events: GameEvent[] }`.
- Emits `close`.
- Reuses the existing scrim/close idiom of `CardListModal.vue` (backdrop click +
  close button → `close`).
- Renders the four existing sections **stacked, in this order**, in a single
  scrolling body: `MonumentsSection` (`:monuments`), `LegacyCardsSection`
  (`:cards`), `DeckCountsSection` (`:counts`), `EventLogSection` (`:events`).
- Use the section components' existing prop names (`monuments`, `cards`,
  `counts`, `events`) — confirm against each `sidebar/*.vue`.
- `DeckCounts` is the type of `snapshot.deckCounts`; import it from the same type
  source `DeckCountsSection.vue` uses (or via `core/types.ts`).

### Relocated (unchanged internals)

- `IdeologyDisplay.vue` → rendered in the info-column. Still takes `vector`.
- The four `sidebar/*.vue` sections → rendered inside `StatsModal`.
- `ProjectTreePanel.vue` → stays in the info-column, unchanged (keeps influence
  chips).

### Deleted

- `components/shell/Rail.vue`
- `components/shell/RailFlyout.vue`
- `components/shell/RailIcon.vue`
- `components/game/CrisisCounterPanel.vue`

## `App.vue` changes

**Template**

- Header: add a **Stats** button (next to `ThemeToggle` / `SaveSlotMenu`) that
  sets `statsOpen = true`.
- Under the existing `.stats-bar` (TurnBar), add `<CrisisBar>` full width,
  wired to `setting.crisis`, `epoch.turn`, `setting.rules.maxTurns`.
- Replace the lone `<ProjectTreePanel>` in `.app-main` with an
  `<aside class="info-column">` stacking, top to bottom:
  `ScoreMeter` → `IdeologyDisplay` (`:vector="snapshot.vector"`) →
  `ProjectTreePanel`.
- Remove both `<Rail>` elements and **all six** `<RailFlyout>` blocks.
- Add `<StatsModal v-if="statsOpen" … @close="statsOpen = false">` near the
  other top-level modals (`CardListModal`, `CrisisScreen`).

**Script**

- Remove: `leftRailActive`, `rightRailActive`, `leftRailItems`, `rightRailItems`,
  `toggleLeft`, `toggleRight`, and the `Rail` / `RailFlyout` / `RailItem` /
  `CrisisCounterPanel` imports.
- Add: `const statsOpen = ref(false)`.
- Add imports for `CrisisBar`, `ScoreMeter`, `StatsModal`. Keep the
  `IdeologyDisplay` import (now used in the info-column).
- Keep the four `sidebar/*` imports only if still referenced; if they are now
  imported solely by `StatsModal`, drop them from `App.vue`.

**Style**

- `.app-main` grid template: drop the two rail columns; define
  `info-column · play-area`. `info-column` is a fixed/clamped width sidebar that
  scrolls vertically (mirroring today's projects column behavior).
- Add `.crisis-bar` region styles as needed (full width, slim).

## Cleanup

- `TableauPanel.vue:103` — update/remove the comment referencing `RailFlyout`
  (the overlay it described no longer exists; the comment should reflect the
  current overlays, e.g. the policy modal / stats modal, or be dropped if moot).

## Verification

- `bun run typecheck` — clean.
- `bun run lint` and `bun run format:check` — clean.
- `bun run build` — succeeds.
- `bun test` — existing suite still green (no core changes expected, but confirm
  nothing imported a deleted file).
- Manual click-through (`bun run dev`): rails gone; Crisis bar always visible and
  shows correct countdown + urgency color near the cap; Score + Ideology +
  Projects stacked in the info-column; Stats button opens a modal with all four
  sections stacked and scrolling; modal closes on backdrop and close button; no
  console errors; policy phase still locks the board correctly.

## Risks

- **Stale imports / dangling references** after deletion — caught by typecheck.
- **Prop-name drift** between `StatsModal` and the `sidebar/*` sections — mitigated
  by reusing their existing prop names verbatim.
- **CSS regressions** in the grid (info-column width, crisis bar height,
  scrolling) — caught in the manual click-through.
