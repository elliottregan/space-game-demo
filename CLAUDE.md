# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The project

A deck-building roguelike strategy game. Vue 3 + TypeScript + Vite + Bun. Latest design spec is `docs/superpowers/specs/2026-05-12-tableau-three-tier-redesign-design.md`; the earlier `docs/specs/DECK-BUILDING-REDESIGN.md` is partly superseded.

Each run (an "Epoch") is a single card-play session on a `Setting` (Homeworld, Generation Ship, Ruined Homeworld). Players build a 3-row column tableau — Land, Influence (Role), Charter — and press **Build** to unlock a Keystone Project whose pattern matches the column's poker shape (high-card / pair / three / flush / four). The Epoch ends at the turn cap with the **Crisis**: cumulative project values are summed against the Crisis difficulty. Pass → mint Legacy + transition to next Setting. Monuments, Legacy Cards, and ideology terrain carry across Epochs.

## Commands

- `bun install` — install dependencies (auto-installs lefthook hooks via `prepare`)
- `bun run dev` — Vite dev server, http://localhost:5174
- `bun run build` — production build
- `bun run preview` — preview production build
- `bun run typecheck` — `tsc --noEmit`
- `bun test` / `bun test tests/<name>.test.ts` — Bun test runner
- `bun run lint` / `lint:fix` — oxlint
- `bun run format` / `format:check` — prettier
- `bun run scripts/analyze-crisis.ts [runs] [settingId] [seedOffset]` — Crisis simulator (settingId = `homeworld` | `generation-ship` | `ruined-homeworld`)

## Architecture

Strict three-layer separation: `core/` → `facade/` → `renderer/`. No layer imports the layer above it.

### `src/core/` — pure TypeScript game logic (no Vue)

Organized into three buckets. Each type lives next to the concept it describes; **`types.ts`** is a thin barrel that re-exports them so a mixed handful can be grabbed in one import.

- **Type homes:**
  - `Card`, `EffectSpec`, `Ideology`, `Role`, `Rank`, `CardKind`, etc. → `data/cards.ts`
  - `PatternKind`, `KeystoneProject`, `ProjectUnlock`, `Crisis`, `CrisisOutcome` → `data/projects.ts`
  - `IdeologyVector`, `IdeologyTerrain`, `Demonym`, `Alignment` → `engine/ideology.ts`
  - `Column`, `LandRow`, `InfluenceRow`, `CharterRow`, `ColumnConfig` → `engine/column.ts`
  - `GameEvent`, `DiscardSource` → `engine/events.ts`
  - `Epoch`, `EpochPhase`, `EpochStatus` → `engine/epoch.ts`
  - `Campaign`, `Monument`, `LegacyCard`, `LegacyCandidate`, `EpochResult` → `engine/campaign.ts`
  - `Setting`, `SettingRules` → `settings/index.ts`
- **`data/`** — static content + tunable defaults. Edit here for balance.
  - `cards.ts` — the card pool (Lands, Roles, Charters) + builders + id helpers + `makeDissent()` + all card-related types.
  - `projects.ts` — `DEFAULT_PROJECT_VALUE` (per-pattern value scale), `PATTERNS_IN_ORDER`, `reversePatternOrder`, `getProjectForPattern`, `unlockedIdeologyBreakdown` + project / crisis types.
- **`settings/`** — one file per scenario. Add a new scenario here.
  - `index.ts` — `Setting` / `SettingRules` types + registry (`SETTINGS`, `SETTING_BY_ID`, `getSetting`).
  - `homeworld.ts`, `generationShip.ts`, `ruinedHomeworld.ts` — `Setting` definitions. Each owns its `rules` (handSize, columnCount, maxTurns, influenceBaseline, dissentLossThreshold), `startingDeck` (card-id filter), `projects` (one per pattern; per-Setting `value`), `crisis` (id + difficulty + flavor), `transitions`.
- **`engine/`** — pure logic; no Vue.
  - `rng.ts` — seedable mulberry32 PRNG with `shuffle`.
  - `column.ts` — `Column` types + placement helpers (`canPlaceLand`/`Influence`/`Charter`, `placeLand`/…, `columnFromConfig`, `isBuildable`, `columnCards`).
  - `columnPatterns.ts` — `evaluateColumn(col, projects)` returns the highest poker pattern match.
  - `dispatch.ts` — single state-mutation entry point. Every event flows through `dispatch(epoch, event)`. The "every discard adds Dissent" rule lives in the `card-discarded` handler.
  - `events.ts` — `GameEvent` / `DiscardSource` types.
  - `effects.ts` — `applyEffect` (immediate) + `resolveEndOfTurn` (queued) + `drawToHandSize`, `purgeDissent`, `countDissentInDeck`.
  - `ideology.ts` — ideology types + `deriveVector(columns, terrain)`, `checkAlignment`, `demonym`.
  - `epoch.ts` — `Epoch` type + lifecycle: `createEpoch`, `currentVector`, `effectiveInfluenceCost`.
  - `commands.ts` — per-turn player verbs: `placeCard`, `discardLand`, `discardCharter`, `recallInfluence`, `discardColumn`, `discardFromHand`, `buildColumn`.
  - `turn.ts` — `endTurn`, `resolveCrisis`.
  - `legacy.ts` — Legacy minting from `CrisisOutcome`; Monument creation; terrain effects.
  - `campaign.ts` — `Campaign` / `Monument` / `LegacyCard` types + `createCampaign`, `prepareEndOfEpoch`, `finalizeEpoch` (Setting transitions).

### `src/facade/` — command/query API between core and renderer

- `GameAPI.ts` — class that owns `Campaign` + `Setting` + `Epoch` + `RNG`. Commands return `CommandResult<T>`; queries (`snapshot`, `validColumns`, `getEffectiveCost`, …) return immutable-shaped views. `snapshot()` deep-clones mutable collections so shallow-reactive Vue refs see new references after every mutation. Constructor accepts `{ skipLoad?, forceSettingId? }` for testing.
- `persistence.ts` — 10-slot save store at `localStorage[deck-demo-saves-v3]`. Auto-archives v2 saves to `deck-demo-saves-v2-archive` on first load (no automatic migration).

### `src/renderer/` — Vue 3 UI

- `App.vue` — root layout. CSS grid: projects · ideology · tableau (horizontal scroll) · hand + piles · errors.
- `GameService.ts` — reactive bridge. `shallowRef<Snapshot>`, `shallowRef<SaveSlot[]>`, `ref<string | null>` for errors. Every command calls `api.persist()`.
- `components/` — SFCs:
  - Tableau: `TableauPanel`, `TableauColumn`, `LandCell`, `InfluenceCell`, `CharterCell`, `ColumnFooter`.
  - Sidebar / overlays: `UnlockedProjectsPanel`, `LegacySidebar`, `CrisisScreen`, `CampaignEnd`, `CardListModal`, `MarketModal`, `SaveSlotMenu`, `ThemeToggle`.
  - Other: `HandPanel`, `DeckDiscardPanel`, `IdeologyDisplay`, `AxisBar`, `TurnBar`, `Card`, `LegacyChoiceRow`.

### Scripts

- `scripts/analyze-crisis.ts` — per-Setting greedy heuristic simulator. Reports win rate, margin distribution, per-pattern unlock counts, first-unlock turns. Use to sanity-check balance after tweaking values.

## Invariants worth remembering

- **A column is buildable when** all three rows are filled: ≥1 Land + Role + Charter. The poker pattern is the column's land count (1 = high-card, 2 = pair, 3 = three, 4 = four-of-a-kind), upgraded to **Flush** if every card in the column shares one ideology. Four > Flush > Three > Pair > High Card.
- **A Setting's `startingDeck` is just a list of card ids.** Filter `ALL_CARDS` however you like (by ideology, by rank, by tag) — see Generation Ship for an example of a 2-ideology constrained deck.
- **Three-of-a-Kind and Four-of-a-Kind are gated by deck composition.** They require N Lands of the same rank in the deck. A 2-ideology filter caps you at Pair / Flush.
- **Every discard adds 1 Quiet Dissent** (deliberate hand discards, tableau discards, column discards). End-of-turn hand cycling is *not* a discard — it does not add Dissent.
- **Crisis fires when `turn > rules.maxTurns`.** `resolveCrisis` walks unlocked projects in `four → flush → three → pair → high-card` order, sums their `value`, compares to `crisis.difficulty`. Pass → win + Legacy mint. Fail → loss.
- **Ideology is derived**, never stored as a drifting float. `deriveVector(columns, terrain)` sums `card.rank` over every card in every column and adds the persisted terrain offset.
- **State mutation goes through `dispatch(epoch, event)`** so rules like "discard → Dissent" stay in one place.
- **Vue reactivity** is driven via `shallowRef` + `GameAPI.snapshot()` returning fresh array/object references each call. Do **not** mutate nested state and expect Vue to notice — rebuild the snapshot.

## Balance tuning quick reference

- **Crisis difficulty per Setting:** `settings/<scenario>.ts` → `CRISIS.difficulty`.
- **Turn budget per Setting:** `settings/<scenario>.ts` → `rules.maxTurns`.
- **Hand size / column count per Setting:** `settings/<scenario>.ts` → `rules.handSize` / `rules.columnCount`.
- **Project values per Setting:** `settings/<scenario>.ts` → `PROJECTS[i].value` (override `DEFAULT_PROJECT_VALUE` from `data/projects.ts`).
- **Starting deck per Setting:** `settings/<scenario>.ts` → filter on `ALL_CARDS` from `data/cards.ts`.
- **Default value scale (all-Setting fallback):** `data/projects.ts` → `DEFAULT_PROJECT_VALUE`.
- **Card stats (ranks, costs, effects):** `data/cards.ts`.

After tweaking, run `bun run scripts/analyze-crisis.ts 300 <settingId>` to see the impact.

## Testing

Bun test runner, tests in `tests/`:

- `column.test.ts` — column placement rules
- `columnPatterns.test.ts` — pattern evaluator (high-card / pair / three / flush / four)
- `dispatch.test.ts` — event dispatch + side-effect rules
- `projects.test.ts` — project helpers + ideology breakdown
- `ideology.test.ts` — vector derivation
- `crisisflow.test.ts` — full Crisis end-of-Epoch resolution
- `smoke.test.ts` — end-to-end via `GameAPI`

Run a single file with `bun test tests/<name>.test.ts`.

## Git workflow

Feature branches; PRs against `main`. Pre-commit hooks (`lefthook`) run `oxlint --fix` + `prettier --write` on staged files in parallel, then `tsc --noEmit` on the full project. Never push `--force` to `main`.
