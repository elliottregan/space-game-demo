# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The project

A deck-building roguelike strategy game. Vue 3 + TypeScript + Vite + Bun. The design spec is in `docs/specs/DECK-BUILDING-REDESIGN.md` — read it when in doubt about mechanics.

Each run (an "Epoch") is a single card-play session on a `Setting` (Homeworld, Generation Ship, …). Players build a tableau of Lands + Role/Keystone toppers, then assemble a winning hand (poker pattern + project keystone) to complete a Mega-Structure. Monuments, Legacy Cards, and ideology terrain carry across Epochs into a branching campaign.

## Commands

- `bun install` — install dependencies
- `bun run dev` — Vite dev server, http://localhost:5174
- `bun run build` — production build
- `bun run preview` — preview production build
- `bun run typecheck` — `tsc --noEmit`
- `bun test` / `bun test tests/patterns.test.ts` — Bun test runner
- `bun run scripts/analyze-paths.ts [runsPerPath]` — greedy-heuristic win-path simulation

## Architecture

Strict three-layer separation. No layer imports from the layer above it.

### `src/core/` — pure TypeScript game logic (no Vue)

- `types.ts` — shared types (`Card`, `Epoch`, `Campaign`, `MegaProject`, effect DSL, etc.)
- `cards.ts` — the 57-card pool: 20 Roles × 4 Ideologies + 32 Lands × 8 ranks + 2 base Keystones + 3 project Keystones. Builders + id helpers + `makeDissent()` for generated cards.
- `homeworld.ts`, `generationShip.ts`, `ruinedHomeworld.ts` — `Setting` definitions. Each holds rules, starting deck, starting tableau, mega-projects (via `requiredHand`), tasks, and transitions.
- `settings.ts` — the Setting registry.
- `ideology.ts` — `deriveVector(tableau, terrain)` returns the 2-axis ideology vector from card ranks. `checkAlignment` and `demonym` too.
- `patterns.ts` — `evaluateMegaStructure(project, hand)` decides whether a hand can play a given mega-structure (poker hand + keystone). Also scoring + completion tiers.
- `tableau.ts` — slot placement rules: Lands stack only with matching rank; a slot is **improved** at 2+ Lands; Roles/Keystones become the topper on improved slots.
- `effects.ts` — `applyEffect` (immediate) + `resolveEndOfTurn` (queued) + helpers: `drawToHandSize`, `purgeDissent`, `countDissentInDeck`.
- `epoch.ts` — turn state machine + commands: `playCard`, `retrieveFromTableau`, `playMegaStructure`, `endTurn`, `discardForMaterial`. Owns the Epoch lifecycle.
- `legacy.ts` — Legacy Card minting on win/loss, upgrade-path application, Monument creation, terrain scarring.
- `campaign.ts` — `createCampaign`, `prepareEndOfEpoch`, `finalizeEpoch` (transitions to the next Setting).
- `rng.ts` — seedable mulberry32 PRNG with `shuffle`.

### `src/facade/` — command/query API between core and renderer

- `GameAPI.ts` — a class that owns `Campaign` + `Setting` + `Epoch` + `RNG`. Commands (`playCard`, `retrieveFromTableau`, `playMegaStructure`, `discardForMaterial`, `endTurn`, `advanceEpoch`) return `CommandResult<T>`; queries (`snapshot`, `validSlots`, `getEffectiveCost`, …) return immutable-shaped views. **`snapshot()` deep-clones mutable collections** so consumers (shallow-reactive Vue refs) see new references after every mutation.
- `persistence.ts` — 10-slot save store in `localStorage` (key `deck-demo-saves-v2`). `loadStore`, `upsertActiveSlot`, `addNewSlot`, `switchSlot`, `deleteSlot`, `clearStore`. Auto-migrates a legacy v1 single-save into slot 1 on first load.

### `src/renderer/` — Vue 3 UI

- `App.vue` — root layout using CSS grid template-areas: projects, ideology, tableau (horizontal scroll), hand + piles side-by-side, errors.
- `GameService.ts` — reactive bridge. Holds `shallowRef<Snapshot>`, `shallowRef<SaveSlot[]>`, `ref<string | null>` for errors. Every command calls `api.persist()` so saves are always fresh.
- `components/` — one SFC per panel (`HandPanel`, `TableauPanel`, `ProjectZonesPanel`, `IdeologyDisplay`, `LegacySidebar`, `SaveSlotMenu`, `DeckDiscardPanel`, `Card`, `EndOfEpochScreen`, `CampaignEnd`, `CardListModal`, `MarketModal`, `TurnBar`).

### Scripts

- `scripts/analyze-paths.ts` — plays N epochs per target mega-structure with a greedy heuristic. Reports win rates, turns-to-win, completion tiers, final ideology, tableau state. Useful when rebalancing.

## Invariants worth remembering

- **Cards leave hand by being played to the tableau or discarded**, not by slotting into projects. Mega-structures complete from the hand, atomically.
- **Ideology is derived**, never stored as a drifting float. `deriveVector` sums `card.rank` over the tableau and adds the persisted terrain offset.
- **A slot is improved at 2+ matching-rank Lands.** Only improved slots accept a Role/Keystone topper.
- **Retrieving a Land costs Influence + Material and adds one Quiet Dissent to the top of the deck.** Retrieving a topper is just Influence.
- **Hand persists across turns.** `drawToHandSize` tops the hand up to `rules.handSize` at turn start; no forced discard.
- **Vue reactivity** is driven via `shallowRef` + `GameAPI.snapshot()` returning fresh array/object references each call. Do **not** mutate nested state and expect Vue to notice — rebuild the snapshot.

## Testing

Bun test runner, tests in `tests/`:

- `ideology.test.ts` — derivation, alignment, demonym
- `patterns.test.ts` — hand-based mega-structure evaluation + scoring/tiers
- `winflow.test.ts` — force a win, verify Monument + terrain + transition
- `smoke.test.ts` — end-to-end via `GameAPI`

Run a single file with `bun test tests/<name>.test.ts`.

## Git workflow

Feature branches; PRs against `main`. Pre-commit hooks run format + lint automatically. Never push `--force` to `main`.
