# Turn Phases + Policy Hand Modal & Card-Metaphor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Introduce a **within-turn phase system** to the core game, then build the policy UI on top of it. A turn opens in a **policy phase** when policy cards were drawn: they appear as a **blocking, centered modal hand**; the player selects keepers and clicks **Enact policies**; kept cards fly into a persistent **policy tableau row** and the rest flip-scale into per-ideology **discard piles**; the turn then advances to the **play phase** where building actions become legal. Decks/discards are **2×2 landscape grids on the right**, and policy cards use a **landscape card metaphor** throughout.

**Architecture:** The *phase gate lives in core* — the UI does not merely hide controls; the engine rejects out-of-phase commands. Data already flows through `snapshot.policy.{decks,discards,tableau,candidates}` + `effective`/`influence`; we add `epoch.turnPhase` and `enactPolicies`. Renderer animations extend `renderer/animation/cardFlight.ts` to per-ideology named piles. Builds on branch `feat/policy-tableau` (updates PR #146). `core → facade → renderer`, no upward imports. Flat Bauhaus (NO border-radius).

**Tech stack:** Vue 3 + TS + Bun.

---

## Locked design decisions (2026-06-17 design conversation)

- **Turn phases are a core concept, expandable.** `TurnPhase = "policy" | "play"` for now; the system is structured so future phases slot in (extend the union + `TURN_PHASE_ORDER` + the relevant command gates). `epoch.turnPhase` is orthogonal to the lifecycle `epoch.phase` (`play`/`crisis`/`end-of-epoch`) and only meaningful while `phase === "play"`.
- **The phase determines available actions, in core.** Building/board verbs reject unless `turnPhase === "play"`. Policy resolution requires `turnPhase === "policy"`. The renderer reflects this (disabled controls, modal) but is not the source of truth.
- **Policy cards are drawn first and must be resolved before anything else.** A turn that drew policies opens in `"policy"`; nothing else is playable until the player enacts. Turns with no draw (turn 1, tie-only turns) open directly in `"play"`.
- **Select-then-enact, as one command.** The modal toggles a "keep" selection per drawn card; one **Enact policies** button calls `enactPolicies(keepIds)`: kept → slotted (cap/stacking enforced), unkept → discarded, candidates cleared, phase → `"play"`. Replaces the per-card `slotPolicy`/`discardPolicyCandidate` from PR #146. `removePolicy` remains a play-phase tableau action.
- **5-slot cap with stacking enforced.** Projected new slots = distinct kept ids not already in the tableau; `tableau.length + newDistinct ≤ 5`. Core rejects an over-cap `enactPolicies`; the modal also prevents over-selection.
- **Temporary hand only.** Drawn cards live only in the modal until enacted; they are never placed on the board view. The modal floats centered over the hand area with a light scrim — board visible, not interactive.
- **Enact choreography.** Kept cards animate into their tableau-row slots; unkept flip-scale into their ideology's discard grid tile.
- **Landscape card metaphor everywhere** (modal hand, tableau row, deck/discard tiles): ideology accent + `SuitGlyph` + name + `describePolicy` effect + flavor; front+back faces for the flip; landscape aspect (distinct from portrait building cards).
- **Persistent policy zone (play phase):** tableau **row** under the building hand; **2×2 deck grid** + **2×2 discard grid** on the right (one tile per ideology, color-coded, count badge).
- **Retire** the right-rail "Policy tableau" flyout. No save-format bump (v6 is unmerged); default `turnPhase` to `"play"` when loading an older dev save.

## File structure

- Create `src/core/engine/turnPhase.ts` — `TurnPhase`, `TURN_PHASE_ORDER`, `openingTurnPhase`, gate predicate.
- Modify `src/core/engine/epoch.ts` (Epoch + `turnPhase`, createEpoch), `turn.ts` (phase transition in endTurn + endTurn gate), `commands.ts` (phase gates + `enactPolicies`, retire public slot/discard), `src/core/types.ts` (export `TurnPhase`).
- Modify `src/facade/GameAPI.ts` (snapshot `turnPhase`, `enactPolicies` passthrough, load default), `src/facade/persistence.ts` only if needed (no version bump).
- Modify `scripts/analyze-crisis.ts` (resolve policy phase via `enactPolicies` before building).
- Create `src/renderer/components/game/PolicyCard.vue`, `PolicyHandModal.vue`, `PolicyPiles.vue`; rework `PolicyTableau.vue` → row; delete `PolicyDraw.vue`.
- Modify `src/renderer/animation/cardFlight.ts` (named policy piles), `GameService.ts` (`enactPolicies`), `App.vue` (mount modal + zone, phase-aware), `util/policies.ts` if helpful, `theme.css`.
- Tests: rework `tests/policyCommands.test.ts` (phase gating + `enactPolicies`); update Epoch literals in `tests/{dispatch,storage,crisisflow}.test.ts` + `tests/fixtures.ts` with `turnPhase`; extend `tests/effectiveRules-routing.test.ts` if endTurn-phase interaction matters.

---

## PHASE 0 — Core turn-phase system (engine + facade + simulator)

### Task 0.1: `TurnPhase` type + epoch field (TDD)
**Files:** create `src/core/engine/turnPhase.ts`; modify `epoch.ts`, `types.ts`; update `tests/fixtures.ts` + Epoch literals.

- [ ] `turnPhase.ts`: `export type TurnPhase = "policy" | "play";` `export const TURN_PHASE_ORDER: TurnPhase[] = ["policy", "play"];` `export function openingTurnPhase(hasPolicyCandidates: boolean): TurnPhase` (→ `"policy"` if true else `"play"`). Add `export function isPlayPhase(epoch): boolean` and `requirePlayPhase`/`requirePolicyPhase` helpers (or a single `assertPhase`) returning a `CmdResult` error shape for reuse in commands.
- [ ] `epoch.ts`: add `turnPhase: TurnPhase` to `Epoch`; `createEpoch` sets `turnPhase: "play"`. Re-export `TurnPhase` via `types.ts`.
- [ ] Add `turnPhase: "play"` to every hand-built Epoch literal (`tests/dispatch.test.ts`, `tests/storage.test.ts`, `tests/crisisflow.test.ts`); if a shared `freshEpoch` helper exists in `tests/fixtures.ts`, set it there.
- [ ] Tests: `createEpoch(...).turnPhase === "play"`; `openingTurnPhase(true/false)` correct. `bun test && bun run typecheck`. Commit `feat(core): TurnPhase type + epoch.turnPhase`.

### Task 0.2: Phase transition on end of turn (TDD)
**Files:** modify `src/core/engine/turn.ts`.

- [ ] `endTurn`: guard at top — if `epoch.turnPhase !== "play"` return early/no-op (you can only end a turn from the play phase). At the start-of-turn tail, **after** `drawPolicies`, set `epoch.turnPhase = openingTurnPhase(epoch.policy.candidates.length > 0)`. (Crisis early-return path leaves turnPhase untouched.)
- [ ] Tests (construct epochs with unlocks so a draw happens): ending a turn that draws ≥1 candidate → next turn `turnPhase === "policy"`; a turn with zero influence/draws → `"play"`. `bun test && bun run typecheck`. Commit `feat(core): open turns in policy phase when cards are drawn`.

### Task 0.3: Phase-gate commands + `enactPolicies` (TDD)
**Files:** modify `src/core/engine/commands.ts`; rework `tests/policyCommands.test.ts`.

- [ ] Add a play-phase guard to every board verb (`placeCard`, `commitHand`, `storeCard`, `placeFromStorage`, `discardLand`, `discardCharter`, `recallInfluence`, `discardColumn`, `discardFromHand`, `buildColumn`, `removePolicy`): reject with `"Resolve drawn policies first."` when `turnPhase !== "play"`.
- [ ] `enactPolicies(epoch, keepIds: string[]): CmdResult<void>`: require `turnPhase === "policy"`; validate every id in `keepIds` is a current candidate; compute distinct-new-slots (kept ids not already in tableau) and reject if `tableau.length + newDistinct > 5`; then for each candidate slot it if kept (stacking onto a match) else discard it to its ideology pile; clear `candidates`; set `turnPhase = "play"`. Remove public `slotPolicy`/`discardPolicyCandidate` (inline their logic here or keep as unexported helpers).
- [ ] Tests: a board verb is rejected while `turnPhase === "policy"`; `enactPolicies(["mobilize"])` slots Mobilize, discards the rest, sets `"play"`; over-cap `keepIds` rejected (phase unchanged); `enactPolicies([])` discards all and advances; stacking (two same-id kept) consumes one slot. `bun test && bun run typecheck`. Commit `feat(core): phase-gate board commands + enactPolicies`.

### Task 0.4: Facade + simulator (TDD + empirical)
**Files:** modify `src/facade/GameAPI.ts`, `scripts/analyze-crisis.ts`; check `tests/smoke.test.ts`.

- [ ] `GameAPI`: snapshot exposes `turnPhase` (on the snapshot and/or epoch view); replace the `slotPolicy`/`discardPolicyCandidate` passthroughs with `enactPolicies(keepIds)` (persist on success); keep `removePolicy`. `loadFromState`: default `turnPhase` to `"play"` if a loaded epoch lacks it.
- [ ] `analyze-crisis.ts`: replace Step 0 — when `snapshot().epoch.turnPhase === "policy"`, compute `keepIds` from candidates (the existing beneficial/cap-aware heuristic: prefer draw/influence/storage, skip Conscription unless stacking, respect the 5-slot projection), call `api.enactPolicies(keepIds)`, `continue`. Board steps stay as-is (now naturally gated).
- [ ] Re-run `analyze-crisis.ts 500 <setting> {0,1000}` for all three; confirm win rates still ~Homeworld 78–83 / Ruined 79–82 / GenShip ~72–76 (batch enact shouldn't move them; if it does, note it). `bun test && bun run typecheck`. Commit `feat(facade+sim): turnPhase snapshot + enactPolicies; sim resolves policy phase`.

---

## PHASE 1 — Landscape PolicyCard + flight generalization (renderer)

### Task 1.1: `PolicyCard.vue` (landscape card metaphor)
**Files:** create `src/renderer/components/game/PolicyCard.vue`; touch `theme.css`.
- [ ] Landscape card: ideology accent, `SuitGlyph`, name, `describePolicy(card)`, optional flavor. Props `card`, `selectable?`, `selected?`, `stacks?` (`×N` when >1), `removable?`. Emits `select`, `remove`. `.card-front` + `.card-back-face` (`CardBack`) so the flip flight reads. Landscape aspect, no border-radius, theme tokens only.
- [ ] `bun run typecheck`. Commit `feat(renderer): landscape PolicyCard component`.

### Task 1.2: Generalize `cardFlight` to named policy piles
**Files:** modify `src/renderer/animation/cardFlight.ts`.
- [ ] Widen `PileKind` to also accept `"policy-deck:<ideology>"` / `"policy-discard:<ideology>"` (registry already keys by string). Add an optional `fromKind`/`toKind` param to the draw/discard flights (default `"deck"`/`"discard"`) so policy cards fly from/to a specific tile. Preserve existing building-hand behavior exactly.
- [ ] `bun run typecheck && bun test`. Commit `feat(renderer): per-pile card flight for policy decks/discards`.

---

## PHASE 2 — Persistent policy zone (tableau row + 2×2 grids)

### Task 2.1: `PolicyPiles.vue`
**Files:** create `src/renderer/components/game/PolicyPiles.vue`.
- [ ] Two labeled 2×2 grids (decks, discards): one ideology-colored landscape tile each, count badge, registering itself as a flight pile (`policy-deck:<ideology>` / `policy-discard:<ideology>`). Props `decks`, `discards`. No border-radius.
- [ ] `bun run typecheck`. Commit `feat(renderer): policy deck/discard 2x2 grids`.

### Task 2.2: Tableau row
**Files:** rework `src/renderer/components/game/PolicyTableau.vue`.
- [ ] Render ≤5 slots as a horizontal row of landscape `PolicyCard`s (stack badge, remove affordance; empty = flat placeholder). Prop `tableau`; emit `remove(slotIndex)`. No border-radius.
- [ ] `bun run typecheck && bun test`. Commit `feat(renderer): policy tableau as a landscape card row`.

### Task 2.3: Wire persistent zone into App; retire rail flyout
**Files:** modify `src/renderer/App.vue`.
- [ ] Policy zone under the building `.hand-row`: tableau row (left/center) + `PolicyPiles` (right). Wire `@remove` → `game.removePolicy`. Remove the `policies` rail item + its `RailFlyout`. Disable building controls (and gate handlers) when `snapshot.turnPhase === "policy"`.
- [ ] `bun run typecheck && bun test && bun run build`. Commit `feat(renderer): persistent policy zone, retire policy rail flyout`.

---

## PHASE 3 — Blocking policy-hand modal + enact choreography

### Task 3.1: `GameService.enactPolicies`
**Files:** modify `src/renderer/GameService.ts`.
- [ ] `enactPolicies(keepIds: string[])` → `api.enactPolicies(keepIds)`, set `lastError` on failure, refresh snapshot once. Drop the old `slotPolicy`/`discardPolicyCandidate` wrappers; keep `removePolicy`.
- [ ] `bun run typecheck`. Commit `feat(renderer): GameService.enactPolicies`.

### Task 3.2: `PolicyHandModal.vue`
**Files:** create `src/renderer/components/game/PolicyHandModal.vue`.
- [ ] Centered modal over the hand area; light scrim blocks board pointer-events but leaves it visible. `candidates` as selectable landscape `PolicyCard`s (toggle keep). Cap-aware: disable selecting a keeper that would exceed 5 distinct slots (stacking-aware), with a reason. Per-ideology draw counts. One **Enact policies** button → emit `enact(keepIds)` (enabled even with zero kept). No escape/scrim dismiss (required gate). No border-radius.
- [ ] `bun run typecheck`. Commit `feat(renderer): blocking policy-hand modal`.

### Task 3.3: Wire modal + enact animation into App
**Files:** modify `src/renderer/App.vue` (+ `cardFlight.ts` helper if needed).
- [ ] Show `PolicyHandModal` whenever `snapshot.turnPhase === "policy"`. On `@enact(keepIds)`: `game.enactPolicies(keepIds)`; kept cards animate into tableau-row slots, unkept flip-scale to their ideology discard tile (TransitionGroup leave hook routing slot-vs-discard via the per-pile flight). Board actions already core-gated; the modal enforces focus.
- [ ] `bun run typecheck && bun test && bun run build`. Commit `feat(renderer): wire policy modal + enact choreography`.

---

## PHASE 4 — Verification & cleanup

- [ ] Delete `PolicyDraw.vue`; remove dead imports/styles/rail refs.
- [ ] Live browser pass (dev server + Playwright): build a mono-ideology column → end turn → board is non-interactive and the modal blocks until enacted → select a keeper → Enact → kept flies to tableau row, rest to discard grid; a stacked slot shows `×N`; TurnBar deltas + deck/discard badges update; no modal on turn 1; confirm a board command is refused by core during the policy phase.
- [ ] `bun run typecheck && bun test && bun run lint && bun run build` green. Update CLAUDE.md (turn-phase invariant; `engine/turnPhase.ts`; `enactPolicies`; renderer policy components; PolicyDraw removed). Commit `feat: turn-phase + policy modal — docs + cleanup`.
- [ ] Final adversarial review (core phase-gating + spec compliance + quality + visual). Update PR #146 description.

## Out of scope
New policy cards; balance retuning (difficulties unchanged); additional turn phases beyond `policy`/`play` (the system just leaves room for them).
