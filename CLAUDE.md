# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The project

A deck-building roguelike strategy game. Vue 3 + TypeScript + Vite + Bun. Design specs live in `docs/superpowers/specs/` (dated; later specs supersede earlier ones — e.g. the 2026-05-13 row-hand-stacking spec replaced the 2026-05-12 spec's 5-pattern model with the current 10-pattern ladder). `docs/specs/DECK-BUILDING-REDESIGN.md` is largely superseded.

Each run (an "Epoch") is a single card-play session on a `Setting` (Homeworld, Generation Ship, Ruined Homeworld). Players build a 3-row column tableau — Land, Influence (Role), Charter — and press **Build** to unlock a Keystone Project whose pattern matches the column's poker shape (a 10-pattern ladder from high-card to royal-flush; see Invariants). The Epoch ends at the turn cap with the **Crisis**: cumulative project values are summed against the Crisis difficulty. Pass → mint Legacy + transition to next Setting. Monuments (records of the strongest project built) and Legacy Cards carry across Epochs.

## Commands

- `bun install` — install dependencies (auto-installs lefthook hooks via `prepare`)
- `bun run dev` — Vite dev server, http://localhost:5173
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
  - `IdeologyVector`, `Demonym` → `engine/ideology.ts`
  - `Column`, `LandRow`, `InfluenceRow`, `CharterRow`, `ColumnConfig` → `engine/column.ts`
  - `RowHand` → `engine/rowHands.ts`
  - `GameEvent`, `DiscardSource` → `engine/events.ts`
  - `Epoch`, `EpochPhase`, `EpochStatus`, `PolicyState`, `PolicySlot` → `engine/epoch.ts`
  - `PolicyCard`, `PolicyModifier` → `data/policies.ts`
  - `EffectiveRules` → `engine/effectiveRules.ts`
  - `Campaign`, `Monument`, `LegacyCard`, `LegacyCandidate`, `LegacyUpgrade`, `EpochResult` → `engine/campaign.ts`
  - `Setting`, `SettingRules` → `settings/index.ts`
- **`data/`** — static content + tunable defaults. Edit here for balance.
  - `cards.ts` — the card pool (Lands, Roles, Charters) + builders + id helpers + `makeDissent()` + all card-related types.
  - `projects.ts` — `DEFAULT_PROJECT_VALUE` (per-pattern value scale), `PATTERNS_IN_ORDER`, `reversePatternOrder`, `getProjectForPattern`, `unlockedIdeologyBreakdown`, `projectLevels`/`projectContribution`/`marginalContribution` (leveled Crisis math), `projectMajority`/`ideologyInfluence` (each completed project's majority ideology + the per-ideology counts that drive policy draws) + project / crisis types.
  - `policies.ts` — the 8 launch policy cards (2 per ideology, all base-useful + stackable) + `POLICY_DECKS` (one finite draw pile per ideology) + `PolicyCard`/`PolicyModifier` types. Edit here to add or tune policies.
- **`settings/`** — one file per scenario. Add a new scenario here.
  - `index.ts` — `Setting` / `SettingRules` types + registry (`SETTINGS`, `SETTING_BY_ID`, `getSetting`).
  - `homeworld.ts`, `generationShip.ts`, `ruinedHomeworld.ts` — `Setting` definitions. Each owns its `rules` (handSize, columnCount, maxTurns, influenceBaseline), `startingDeck` (card-id filter), `projects` (one per pattern; per-Setting `value`), `crisis` (id + difficulty + flavor), `transitions`.
- **`engine/`** — pure logic; no Vue.
  - `rng.ts` — seedable mulberry32 PRNG with `shuffle`.
  - `column.ts` — `Column` types + placement helpers (`canPlaceLand`/`Influence`/`Charter`, `placeLand`/…, `columnFromConfig`, `isBuildable`, `columnCards`).
  - `rowHands.ts` — row-hand classification (`identifyRowHand`, `validateRowHand`, `canCommitHand`): which poker hand a Land/Influence row forms.
  - `columnPatterns.ts` — `evaluateColumn(col, projects)` returns the highest poker pattern match.
  - `dispatch.ts` — single state-mutation entry point. Every event flows through `dispatch(epoch, event)`. The "every discard adds Dissent" rule lives in the `card-discarded` handler.
  - `events.ts` — `GameEvent` / `DiscardSource` types.
  - `effects.ts` — `applyEffect` (immediate) + `resolveEndOfTurn` (queued) + `drawToHandSize`, `purgeDissent`, `addDissent`, `countDissentInDeck`.
  - `effectiveRules.ts` — `effectiveRules(epoch, setting)`: the **single** layer where slotted-policy numeric effects fold into a Setting's base rules (handSize, influenceBaseline, storageCapacity, endTurnKeep, dissentPurge, dissentAdd). Every consumer reads its knob from here, never from `setting.rules` directly.
  - `ideology.ts` — ideology types + `deriveVector(columns, unlockedProjects, projects)`, `demonym`.
  - `commands.ts` — per-turn player verbs: `placeCard`, `commitHand` (multi-card lay-down, may pull from storage), `storeCard`, `discardLand`, `discardCharter`, `recallInfluence`, `discardColumn`, `discardFromHand`, `buildColumn`, plus the policy-tableau verbs `slotPolicy` (slot a candidate, stacking onto a matching id or taking a free slot; rejects when full and no match), `discardPolicyCandidate`, `removePolicy`.
  - `epoch.ts` — `Epoch` type (incl. `policy: PolicyState` — per-ideology decks/discards, the ≤5-slot tableau, this turn's candidates) + lifecycle: `createEpoch` (shuffles the policy decks), `currentVector`.
  - `turn.ts` — `endTurn` (routes hand-draw/influence/storage/end-of-turn-keep/dissent through `effectiveRules`), `drawPolicies` (start-of-turn policy draw, scaled by `ideologyInfluence`), `resolveCrisis`.
  - `legacy.ts` — Legacy minting from `CrisisOutcome`; Monument record creation.
  - `campaign.ts` — `Campaign` / `Monument` / `LegacyCard` types + `createCampaign`, `prepareEndOfEpoch`, `finalizeEpoch` (Setting transitions).

### `src/facade/` — command/query API between core and renderer

- `GameAPI.ts` — class that owns `Campaign` + `Setting` + `Epoch` + `RNG`. Commands return `CommandResult<T>`; queries (`snapshot`, `validColumns`, …) return immutable-shaped views. `snapshot()` deep-clones mutable collections (incl. `policy`) so shallow-reactive Vue refs see new references after every mutation, and also exposes `effective` (the `EffectiveRules`) and `influence` (per-ideology counts). Policy commands `slotPolicy`/`discardPolicyCandidate`/`removePolicy` pass through. Constructor accepts `{ skipLoad?, forceSettingId? }` for testing.
- `persistence.ts` — 10-slot save store at `localStorage[deck-demo-saves-v6]`. Auto-archives v5 saves to `deck-demo-saves-v5-archive` on first load (no automatic migration).

### `src/renderer/` — Vue 3 UI

- `App.vue` — root layout. CSS grid: projects · ideology · tableau (horizontal scroll) · hand + piles · errors.
- `GameService.ts` — reactive bridge. `shallowRef<Snapshot>`, `shallowRef<SaveSlot[]>`, `ref<string | null>` for errors. Every command calls `api.persist()`. Policy verbs (`slotPolicy`/`discardPolicyCandidate`/`removePolicy`) refresh the snapshot ref like any other command.
- `components/` — SFCs, three buckets mirroring `core/`:
  - **`core/`** — pure visual primitives with no game-state knowledge. `Card`, `AxisBar`.
  - **`shell/`** — chrome and framing around the play area: header (`TurnBar`, `SaveSlotMenu`, `ThemeToggle`), modals (`CampaignEnd`, `CardListModal`), rails (`Rail`, `RailFlyout` + `sidebar/` sections).
  - **`game/`** — gameplay-bound UI: tableau (`TableauPanel`, `TableauColumn`, `LandCell`, `InfluenceCell`, `CharterCell`, `ColumnFooter`), hand (`HandPanel`), piles (`DeckDiscardPanel`), info panels (`IdeologyDisplay`, `ProjectTreePanel`), policy UI (`PolicyTableau`, `PolicyDraw`; effect text via `util/policies.ts` `describePolicy`), Crisis flow (`CrisisScreen`, `LegacyChoiceRow`).

### Scripts

- `scripts/analyze-crisis.ts` — per-Setting greedy heuristic simulator. Reports win rate, margin distribution, per-pattern unlock counts, first-unlock turns. Use to sanity-check balance after tweaking values.

## Invariants worth remembering

- **A column is buildable when** all three rows are filled: ≥1 Land + ≥1 Role + Charter.
- **The pattern is a 10-rung poker ladder** (`PATTERNS_IN_ORDER`): high-card < pair < two-pair < three-of-a-kind < straight < flush < full-house < four-of-a-kind < straight-flush < royal-flush. The Land row and Influence row are each classified as a row-hand (`rowHands.ts`); the column resolves to the highest applicable pattern (`columnPatterns.ts`). **Flush** = every card in the column (charter included) shares one non-wild ideology; **straight-flush** = land-row straight + flush; **royal-flush** = role-row straight + flush. Full-house can also be trips in one row + a pair in the other; two-pair can be a pair in each row.
- **Every intermediate row state must itself be a valid row-hand.** Single cards placed one at a time can only grow same-rank stacks (high-card → pair → trips → quads). Straights, two-pairs, and full houses are laid down via `commitHand` (multi-card commit from hand).
- **A Setting's `startingDeck` is just a list of card ids.** Filter `ALL_CARDS` however you like (by ideology, by rank, by tag) — see Generation Ship for an example of a 2-ideology constrained deck.
- **Same-rank patterns are gated by deck composition.** N-of-a-kind requires N cards of one rank in the deck. A 2-ideology filter caps any rank at 2 copies, ruling out trips / quads / full-house but not straights or flushes.
- **Dissent is pure deck clog.** Every deliberate discard (hand, tableau, column, recall, storage replacement, and the cascade after a Build) shuffles one unplayable Dissent card into the draw pile. End-of-turn hand cycling is *not* a discard — it does not add Dissent. There is no dissent-based loss condition.
- **Each column has an inert storage area** (capacity `effectiveRules().storageCapacity`; base `rules.storageCapacity` = 1, raised by Stockpile / Deep Reserves policies): any card may be stored for free, even Dissent — but **only once the column holds at least one Land** (storage is unlocked by play, like the Influence row). Stored cards are invisible to pattern/ideology evaluation (`columnCards` excludes them), pay no costs and fire no effects until played, and survive Build. Removal is replacement-only — the replaced card's discard adds Dissent. `placeCard` (with `source: "storage"`) and `commitHand` (with `fromStorageIds`) pull stored cards into the column's rows, paying costs at play time.
- **Crisis fires when `turn > rules.maxTurns`.** `resolveCrisis` sums each unlocked project's **leveled** contribution via `projectContribution` and compares to `crisis.difficulty`. Repeat builds of the same pattern are not flat `value × count` — they add diminishing increments (level 1 = full value; later levels taper via the authored or default curve, floored at 1 so no build is ever worthless). Pass → win + Legacy mint. Fail → loss.
- **Builds fuel a policy engine.** Each completed project has a **majority ideology** (`projectMajority`: strict plurality of its non-wild cards; a tie or all-wild = none). Your majority-counter count per ideology (`ideologyInfluence`) is how many policy candidates you draw from that ideology's finite deck at the start of each turn. Candidates are slotted into a **≤5-slot tableau** of base-useful, stackable cards; drawing a copy of a slotted card **stacks** it (amplifies, no new slot). Policy effects apply **only** through `effectiveRules(epoch, setting)`. Unslotted candidates auto-discard at end of turn; an emptied deck reshuffles its discard.
- **Influence resets to `effectiveRules().influenceBaseline` every turn** (base `rules.influenceBaseline`, raised by Mandate / Conscription policies) — unspent Influence does not carry over.
- **Ideology is derived**, never stored as a drifting float. `deriveVector(columns, unlockedProjects, projects)` sums per-card axis contributions plus a per-unlock contribution scaled by project value.
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
- **Policy cards / decks:** `data/policies.ts` (effects + copies per ideology). Policies are pure player power — re-baseline difficulty **up** after changing them.

After tweaking, run `bun run scripts/analyze-crisis.ts 300 <settingId>` to see the impact.

## Testing

Bun test runner, tests in `tests/`:

- `column.test.ts` — column placement rules
- `columnPatterns.test.ts` — pattern evaluator (full 10-pattern ladder)
- `dispatch.test.ts` — event dispatch + side-effect rules
- `projects.test.ts` — project helpers + ideology breakdown + `projectMajority`/`ideologyInfluence`
- `policies.test.ts` — policy card data + launch decks
- `effectiveRules.test.ts` — policy effects folded into base rules
- `effectiveRules-routing.test.ts` — handSize/influence/storage/cycle/dissent read through `effectiveRules`
- `policyCommands.test.ts` — policy draw + slot/stack/discard
- `projectTree.test.ts` — projects-panel view-model (majority counters + influence)
- `ideology.test.ts` — vector derivation
- `crisisflow.test.ts` — full Crisis end-of-Epoch resolution
- `smoke.test.ts` — end-to-end via `GameAPI`

`tests/fixtures.ts` provides `emptyPolicyState()` for hand-built `Epoch` literals. Run a single file with `bun test tests/<name>.test.ts`.

## Git workflow

Feature branches; PRs against `main`. Pre-commit hooks (`lefthook`) run `oxlint --fix` + `prettier --write` on staged files in parallel, then `tsc --noEmit` on the full project. Never push `--force` to `main`.
