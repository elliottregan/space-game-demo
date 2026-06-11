# Column storage, project upgrades, and the soft-gated tech tree — design

**Date:** 2026-06-10
**Status:** Draft (from brainstorm — discussions #138–#141)
**Branch context:** `main`, post vestigial-systems cleanup (#137).

## Problem

Three observations from play and simulation, all one root cause:

1. **Build feels like punishment.** The reward for the game's central verb is watching your cards cascade to discard plus a Dissent penalty. Nothing persistent or forward-looking comes of it.
2. **Pairs dominate.** The greedy simulator wins ~80% of runs building only high-cards, pairs, two-pairs, and the odd flush — it has *never* built a straight or full house and doesn't need to. Values (pair 2 vs straight 5) don't price the difficulty gap.
3. **Rare hands are luck, not plans.** The "every intermediate row state must be a valid hand" rule means same-rank patterns grow incrementally (pair → trips → quads), but a straight must arrive as a 5-card simultaneous commit from a single 7-card hand. There is no way to store cards toward it. Players play pairs because pairs are the only plannable object in the game.

Root cause: **projects have no structure and the game has no memory for intentions.** Any project can be built at any moment the cards allow; nothing rewards aiming at something turns away.

## Vision

The player should feel like they're building a society (Frostpunk 2's fantasy at 7 Wonders' weight). Winning with pairs stays possible — that's the survivable floor. But the ambitious outcomes (save Earth, launch the generation ship) demand prioritizing toward rare hands. Three mechanics deliver this:

1. **Column storage** — a per-column staging space that turns rare hands from luck into plans.
2. **Project upgrades** — repeat builds of a pattern upgrade the project instead of duplicating it.
3. **A soft-gated tech tree** — visible goals, unlocked by what you've built, with rare hands gating only the ambitious branches.

## Goals

- A player can work toward a straight (or any multi-rank hand) across multiple turns.
- Storing is a plan: visible on the board, cheap to start, costly to abandon.
- Repeating the same hand stays viable but climbs a track instead of farming flat points.
- The project list reads as a map of goals, not a payout table.
- The pair-only line still clears the Crisis; rare hands buy *better endings*, not survival.

## Non-goals

- Endings / Crisis-resolution variants themselves (that's discussion #141's spine; this spec only leaves the hook).
- Laws (#140) and Citizens (#139) — compatible, not included.
- Changing row-hand validity rules, pattern evaluation, or the Dissent-on-discard rule.
- Save migration (archive precedent: v4 → v5, no conversion).

---

## Mechanic 1: Column storage

Each column gains a **storage** area (its warehouse / staging yard).

### Rules

1. **Any card kind can be stored** — land, role, or charter. The only limit is capacity.
2. **Base capacity: 1 slot per column** (tunable per Setting). Capacity can be raised by project-upgrade effects and tech-tree rewards.
3. **Storing is free** — no Influence, no action cost beyond playing the card from hand.
4. **Stored cards are inert.** Invisible to `evaluateColumn`, excluded from `columnCards` for ideology derivation, no effects fire, roles' Influence costs are *not* paid on storing.
5. **No retrieval — only replacement.** A stored card can't return to hand. Playing a new card into a full slot discards the stored one, and that discard adds Dissent like any other. *Changing your plan costs unrest; executing it doesn't.*
6. **Commits may pull from storage.** When placing or committing to this column's rows, stored cards may be combined with cards from hand, so long as the result is a valid row-hand (the existing invariant is untouched — partials live in storage, rows stay valid). Roles pay their Influence cost and fire their effects at commit time, not at store time.
7. **Storage is local.** A column's storage feeds that column's rows only.
8. **Storage survives Build.** When a column is built and cleared, unused stored cards remain — the warehouse is infrastructure, not part of the project.
9. **Presentation:** face-up, dimmed; full opacity on hover/focus. A half-stored straight sitting under a column is the plan made physical.

### Why this shape

- Rows remain valid hands at every moment — no change to `rowHands.ts` semantics.
- Replacement-only + the universal discard rule means **bad planning literally breeds Dissent**, with zero new rules.
- Capacity as the scarce resource gives the tech tree its first concrete mechanical reward (see Mechanic 3) and makes "more storage" a thing societies build toward.

### Schema sketch

```ts
// engine/column.ts
export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  charter: CharterRow;
  storage: Card[];          // NEW — capacity enforced by command, not type
}

// engine/events.ts
| { type: "card-stored"; card: Card; columnIndex: number }
// replacement emits card-stored after a card-discarded { source: "storage" }

// engine/commands.ts
storeCard(epoch, cardId, columnIndex)             // new verb
commitHand(epoch, columnIndex, row, cardIds, fromStorageIds, rng)  // extended
placeCard(...)                                    // optionally accepts a storage source
```

`DiscardSource` gains `"storage"`. Capacity lives in a per-Epoch derived value (base + upgrade/tech bonuses), not on `SettingRules` alone.

---

## Mechanic 2: Project upgrades (stacking builds)

Today a repeat unlock of the same pattern appends a duplicate worth full value — pair-spam farms flat points. Instead:

1. The **first** build of a pattern unlocks the project at level 1, contributing its value to the Crisis pool as today.
2. **Repeat** builds of the same pattern **upgrade** the project (level 2, 3, …) instead of duplicating it.
3. Each level defines its own contribution: typically a *smaller* value increment plus an **effect** — the prime candidate being `+1 storage capacity` (globally or on a chosen column). Other candidates: keep-1-card at hand cycling, an Influence trickle.
4. Levels are authored per Setting in the project data (`KeystoneProject.levels: { value, effect? }[]`), capped (e.g. 3); past the cap, repeats fall back to a small flat value so late builds are never worthless.

This keeps pair-spam *playable* (the floor) while bending it toward diminishing returns and infrastructure — repetition builds capacity that enables the rare-hand branches. It also resolves the District Passives dispute from #138: effects are earned through deliberate repeat builds, not printed automatically on every tile.

> Note for `resolveCrisis`: contribution becomes "sum of authored level values reached" rather than "value × unlock count." `ProjectUnlock` records stay per-build for the log/history.

---

## Mechanic 3: The soft-gated tech tree

Phased; each phase ships alone.

### v0 — Visualization (reframed DEV-EVAL-138, renderer-only)

Replace the unlock log/flyout with an always-visible **tree/ladder view** of the Setting's full project list: built projects lit (with level), unbuilt ones dimmed showing their pattern requirement. No core changes — `setting.projects`, `epoch.unlockedProjects`, and `PATTERNS_IN_ORDER` already carry everything. This is the cheapest probe of whether visible goals change behavior. (History note: persistent buildings *on the tableau* were tried pre-redesign and failed — horizontal scrolling at deck scale. The tree is a separate compact view, not board real estate.)

### v1 — Soft gates

Projects gain tiers with **soft** prerequisites — always OR-shaped, never single mandatory doors:

- *count gates*: "any 2 Tier-1 projects built"
- *category gates*: "any built project of Solidarity"
- *pattern gates* (ambitious branches only): "requires a Straight"

Hard chains ("requires specifically the Public Library") are banned by design rule: random draws must never make a tier unreachable. Tier 1 is completable with pairs alone. Schema: `KeystoneProject.tier` + `requires?: SoftGate`, evaluated as a pure derived function — no new state.

### v2 — Endings hook (defers to #141)

Ambitious branch tips connect to Crisis-resolution variants: pairs-only clears "endure"; the deep branches unlock "redirect"/"transcend" endings that select different next-Setting transitions and Legacy mints. This spec only requires that the tree's data shape leave room for an `endingId` on branch-tip projects. The endings architecture itself is designed once, in #141's track — #139's census and #140's law echoes want the same hook.

### Eventually — dedicated tree page

When the tree outgrows a side panel, it becomes the main alternate view (tableau ⇄ tree toggle). Not before v1 proves the structure matters.

---

## Simulator prerequisite

The greedy AI in `analyze-crisis.ts` never multi-card-commits — it has never built a straight or full house, so every mechanic above (storage value, pattern gates, upgrade pacing) is **invisible to current balance tooling**. Before tuning anything in this spec:

1. Teach the heuristic `commitHand` (lay down multi-rank hands when available).
2. Add a storage policy (store toward the highest-value reachable pattern; replace when plans die).
3. Re-baseline all three Settings; expect difficulty retunes since straights become plannable.

This lands once and pays off for every subsequent feature (#140's laws and #141's dedicate decision need it too).

## Balance notes

- Storage shifts straights from ~0/run to a plannable line — `DEFAULT_PROJECT_VALUE` likely needs flattening (straight at 5 was priced for luck) or Crisis difficulties rise; let the upgraded simulator decide.
- Generation Ship: 4 columns × small deck means capacity is precious — likely the Setting where storage tuning bites; its 2-ideology deck already locks out trips/quads, so storage is its only road past two-pair.
- Watch the **Dissent-quarantine** exploit/feature: "any card can be stored" includes Dissent cards, so storage can warehouse unrest out of the draw pile at the cost of plan capacity. Thematically excellent (suppressing dissent occupies civic capacity); flagged as an open question below rather than ruled out.

## What's intentionally NOT changing

- Row-hand validity, pattern evaluation order, and `commitHand`'s no-Dissent rule.
- Every deliberate discard adds 1 Dissent — including storage replacement.
- End-of-turn hand cycling (storage is the planning tool; the hand still flows).
- Influence reset per turn.
- Crisis trigger (`turn > maxTurns`).

## Phasing

| Milestone | Scope | Ships alone? |
|---|---|---|
| M0 | Tech tree v0 visualization (renderer-only) | yes — replaces DEV-EVAL-138's strip |
| M1 | Column storage (core + facade + UI) | yes |
| M2 | Simulator: commitHand + storage heuristic, re-baseline | yes — blocks *tuning* of M1/M3/M4, not their code |
| M3 | Project upgrades (levels) + Crisis contribution change | yes |
| M4 | Soft gates (tiers) on the tree view | yes |
| M5 | Endings integration | separate spec (#141) |

## Open questions

1. **Dissent in storage:** allow (quarantine as a capacity trade-off) or exclude (`storeCard` rejects `dissent` tags)? Leaning allow — it's an emergent decision with a real cost — but it needs simulator eyes on the dissent-ratio math.
2. **Base capacity:** 1 vs 2 per column, and is it per-Setting? (Generation Ship may want 2 to compensate for 4 columns.)
3. **Cross-column feeding:** strictly local storage is the current rule; is a tech-tree reward that allows pulling from an adjacent column's storage worth the rules complexity?
4. **Upgrade effects vocabulary:** keep to a closed set (storage capacity, keep-a-card, Influence trickle) expressible without new engine hooks — the cleanup PR's lesson. Which two or three make the launch set?
5. **Does a stored charter telegraph too much?** A charter in storage announces "this column will be built" — fine, or should charters be the one un-storable kind?
