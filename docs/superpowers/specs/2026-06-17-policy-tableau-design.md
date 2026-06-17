# Policy Tableau & Majority Counters — design

**Date:** 2026-06-17
**Status:** Draft (from design sessions, June 2026)
**Supersedes:** the shelved **M4 "soft-gated tiers"** in `2026-06-10-column-storage-tech-tree-design.md`. The tech tree was judged "ceremony" — gating a sequence of builds that all just feed a number doesn't make the builds matter. This replaces it with a board-game-inspired engine where builds *fuel a persistent policy engine* and ideology commitment *is* the progression.

## Problem

Builds produce points, not consequences. After M3 a build is a leveled number landing in an accumulator; which project you pick matters only for its value. The "society" you build is a tally. A gating tree organizes the tally without giving any single build a consequence.

## Vision (board-game adaptation, single-player)

Two play areas:

1. **Building hand** — the existing loop (draw, play poker hands into columns, Build). Unchanged.
2. **Policy tableau** — a persistent, face-up row of up to **5 policy cards** that *modify how the building loop resolves*. It is an engine/character-sheet, not a hand played out each turn.

The bridge between them is **ideology influence**, earned by building: each completed project has a **majority ideology**, and your count of majority counters in an ideology is how many policy cards you draw from that ideology's deck each turn. So **every build is an investment in an ideology's policy engine** — the consequence builds were missing.

This folds three shelved ideas into one frame: policies are the old "laws/citizens/effects"; ideology decks are the four-faction engine; the projects panel becomes a board of counters instead of a goal-tree.

## Decisions (locked in design Q&A)

- **Single-player.** The source board-game doc was multiplayer brainstorm; ignore shared-board / competition framing.
- **Majority = strict plurality** of a completed project's cards by ideology, **wild excluded**. **A tie = no majority counter** (the project still scores for the Crisis; it just fuels no policy engine). This makes committed/mono-ideology columns the way to power policies — the build decision becomes dual-purpose (fast Crisis points vs. fuel an ideology).
- **Four independent ideology meters.** Majority counts are counted per-ideology independently — they do **not** run through the 2-axis vector. You can hold majority-Sovereignty and majority-Solidarity projects at once. The axis vector (`deriveVector`) is untouched and keeps doing its job (demonyms, ideology display, legacy). Measured greedy play already spreads across ~3 ideologies, so purity vs. coalition both emerge naturally.
- **Draws scale with majority count.** Each turn, for ideology *I*, you see `influence[I]` candidate policies from *I*'s deck. (Measured: median ~3–5 total draws/turn, peak ~2–3 from one deck, max ~8 — sane against a 5-slot cap.) Generation Ship runs hotter (2 decks) and is **accepted as not-yet-balanced**.
- **Draw = see a candidate, then choose.** You slot what you want (up to the 5-cap) and discard the rest. "More draws" = more options to curate, not waste.
- **Every policy card is base-useful and stackable.** No prerequisites, no "drawn-but-unplayable" discards. A card's base effect applies the moment it's slotted, at any level. Drawing a copy of a slotted card **stacks** onto it — amplifying the effect and **costing no new slot**. So fresh draws add variety, duplicate draws add power; nothing is a dead draw.
- **Closed numeric effect vocabulary.** Launch effects are pure numbers applied in one `effectiveRules(epoch, setting)` layer — never per-card hooks. This is the cleanup-PR discipline up front.
- **Finite cycling decks.** Each ideology deck is a finite pile; when empty, its discard reshuffles in. Since no card is unplayable, "cycling" just means seeing the tight deck's good cards again.

## Mechanics

### Majority counters & influence

- `projectMajority(cards): Ideology | null` — plurality of non-wild ideologies; `null` on a tie or all-wild.
- `ideologyInfluence(unlocks): Record<Ideology, number>` — count of unlocks whose `projectMajority` is each ideology.
- The projects panel renders each completed project as small per-card-ideology counters plus one **large counter** for its majority (none if tie). The big-counter tally per color = that ideology's influence = its policy draw count.

### Policy cards

```ts
// data/policies.ts
interface PolicyModifier {
  handSize?: number;
  influence?: number;       // baseline delta
  storage?: number;         // per-column capacity delta
  endTurnKeep?: number;     // cards kept (not cycled) at end of turn
  dissentPurge?: number;    // dissent removed at start of turn
  dissentAdd?: number;      // dissent added at start of turn (costs)
}
interface PolicyCard {
  id: string;
  name: string;
  ideology: Ideology;       // which deck
  flavor: string;
  base: PolicyModifier;     // applied × stacks
  scale?: { ideology: Ideology; per: number; mod: PolicyModifier }; // + mod × floor(influence/per) × stacks
}
```

**Launch deck (8 cards, 2 per ideology — all base-useful, all stackable, all pure numeric):**

| Deck | Card | base | scale |
|---|---|---|---|
| Solidarity | Mobilize | handSize +1 | — |
| Solidarity | Solidarity Forever | handSize +1 | +1 handSize per 4 Solidarity |
| Sovereignty | Mandate | influence +1 | — |
| Sovereignty | Conscription | influence +2, dissentAdd +1 | — |
| Transformation | Stockpile | storage +1 | — |
| Transformation | Deep Reserves | storage +1 | +1 storage per 2 Transformation |
| Heritage | Continuity | dissentPurge +1 | — |
| Heritage | Archive | endTurnKeep +1 | — |

Each ideology's deck contains several copies of its 2 cards (e.g. 4 each → 8-card deck) so stacking is reachable. Exact counts are a tuning knob.

**Phase 2 (deferred — each needs a hook beyond a number):** Iron Rule & Sanctuary (Crisis scoring), Supply Lines (cross-column storage), Breakthrough (on-commit trigger), Assembly (extra policy candidates), and modal "play-as-X-or-stack-for-Y" cards. Add deliberately once the numeric layer proves out.

### The `effectiveRules` layer

```ts
interface EffectiveRules {
  handSize: number;
  influenceBaseline: number;
  storageCapacity: number;
  endTurnKeep: number;
  dissentPurge: number;
  dissentAdd: number;
}
function effectiveRules(epoch: Epoch, setting: Setting): EffectiveRules
```

Starts from `setting.rules`, then for each slotted policy adds `base × stacks` plus, if `scale`, `scale.mod × floor(influence[scale.ideology] / scale.per) × stacks`. This is the **only** place policy effects apply; every consumer reads through it:

| Knob | Consumer (today) |
|---|---|
| `handSize` | `drawToHandSize` at start of turn (was `setting.rules.handSize`) |
| `influenceBaseline` | influence reset at start of turn |
| `storageCapacity` | `storeCard` capacity check (was `setting.rules.storageCapacity`) — finally derives the M1-deferred capacity |
| `endTurnKeep` | the end-of-turn hand-cycle in `endTurn` (keep N instead of cycling all) |
| `dissentPurge` / `dissentAdd` | applied at start of turn |

### Turn flow additions

Start of turn (the tail of `endTurn`, after `turn += 1`; and skipped on the turn-1 path where influence is 0):
1. Apply `dissentAdd` then `dissentPurge`.
2. Reset influence to `effectiveRules().influenceBaseline`.
3. `drawToHandSize(effectiveRules().handSize)`.
4. **Policy draw:** for each ideology, draw `ideologyInfluence[I]` cards from deck *I* into `epoch.policy.candidates` (reshuffle that deck's discard when empty).

End of turn: keep `effectiveRules().endTurnKeep` cards in hand; cycle the rest.

Player actions (commands): `slotPolicy(cardId)` (from candidates → tableau, stacking onto a matching card or taking a free slot; rejects if full and no match), `discardPolicyCandidate(cardId)`, `removePolicy(slotIndex)` (tableau → that deck's discard). Leftover candidates auto-discard at end of turn.

### Epoch state additions

```ts
epoch.policy: {
  decks: Record<Ideology, PolicyCard[]>;
  discards: Record<Ideology, PolicyCard[]>;
  tableau: { card: PolicyCard; stacks: number }[]; // max 5
  candidates: PolicyCard[];                         // drawn this turn, awaiting decision
}
```

`createEpoch` builds and shuffles the four decks. Save format bumps v5 → v6 (archive, no migration).

## Balance expectations

Policies are pure player power, so win rates will rise — expect a difficulty retune **up** after the simulator learns to slot policies (Phase D). The greedy AI gets a simple policy heuristic (slot any candidate that fits an empty slot or stacks a card it already runs; prefer storage/draw/influence over situational). Re-baseline all three Settings; Generation Ship accepted as off-target.

## Phasing (each ships as its own PR)

| Phase | Scope | Independently shippable |
|---|---|---|
| **A** | Majority counters + `ideologyInfluence` + projects-panel counter display | yes — visible, no policies yet |
| **B** | Policy data + decks + `effectiveRules` + turn-flow wiring + commands (core + facade) | yes — engine works headless / via tests |
| **C** | Policy tableau + candidate-draw renderer UI | yes — playable |
| **D** | Simulator policy heuristic + re-baseline + difficulty retune | yes |
| **E** | Docs (CLAUDE.md, supersede tech-tree M4) | yes |

## Out of scope

- Phase-2 cards (scoring/capability/trigger/modal hooks).
- Card-synergy combos ("two same-faction cards merge").
- Victory-condition declaration / multiple endings — that's the M5 endings track (this spec only makes the policy engine; declaration consumes it later).
- Crisis meter with thresholds (we keep the fixed turn cap; Dissent already is "crisis cards degrading the deck").

## Open questions

1. Deck size / copies per card (affects how fast you can stack). Start 4 copies × 2 cards = 8 per deck; tune.
2. Should `removePolicy` cost anything (a Dissent)? Start free; revisit if churn is degenerate.
3. Candidate overflow: if `influence` draws exceed deck+discard, you simply draw fewer — fine.
4. Turn-1 has zero influence so zero policy draws — confirm that's the intended cold open (engine starts only once you've built).
