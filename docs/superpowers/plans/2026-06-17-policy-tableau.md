# Policy Tableau & Majority Counters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). Spec: `docs/superpowers/specs/2026-06-17-policy-tableau-design.md` — read it; this plan implements it.

**Goal:** Builds fuel a persistent policy engine. Each completed project has a majority ideology; your majority-counter count per ideology = policies drawn from that deck each turn into a 5-slot tableau of base-useful, stackable cards whose numeric effects flow through one `effectiveRules` layer.

**Architecture:** `core/` adds majority/influence helpers, a `data/policies.ts` card set, `epoch.policy` state, an `effectiveRules(epoch, setting)` layer, and policy commands; every existing rules read (handSize, influence baseline, storage capacity, end-of-turn keep) routes through `effectiveRules`. `facade/` exposes policy state + commands and bumps the save to v6. `renderer/` adds the projects-panel counters and the policy tableau/candidate UI. The simulator learns to slot policies; difficulties retune up.

**Ships as five PRs (one per phase).** Do Phase A end-to-end (implement → review → PR → merge) before starting Phase B, because B/C build on A's helpers and panel.

**Conventions:** Vue 3 + TS + Bun; pre-commit runs lint/format/vue-tsc and must pass. Every layer: `core → facade → renderer`, no upward imports.

---

## PHASE A — Majority counters + ideology influence

Branch: `feat/policy-majority-counters` off `main`.

### A1: Majority + influence helpers (core, TDD)

**Files:** modify `src/core/data/projects.ts`; modify `src/core/types.ts`; test `tests/projects.test.ts`.

- [ ] **Write failing tests** (append to `tests/projects.test.ts`):

```ts
import { projectMajority, ideologyInfluence } from "../src/core/data/projects.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";

const L = (rank: number, ideo: "solidarity" | "sovereignty" | "transformation" | "heritage") =>
  getCard(landId(rank, ideo));

describe("project majority", () => {
  test("plurality of non-wild card ideologies", () => {
    expect(projectMajority([L(2, "solidarity"), L(2, "solidarity"), L(3, "heritage")])).toBe(
      "solidarity",
    );
  });
  test("wild cards are excluded", () => {
    // keystone-pioneer is a wild charter
    expect(
      projectMajority([L(2, "heritage"), getCard("keystone-pioneer")]),
    ).toBe("heritage");
  });
  test("a tie returns null", () => {
    expect(projectMajority([L(2, "solidarity"), L(3, "heritage")])).toBeNull();
  });
  test("all-wild returns null", () => {
    expect(projectMajority([getCard("keystone-pioneer")])).toBeNull();
  });
});

describe("ideologyInfluence", () => {
  test("counts unlocks per majority ideology, skipping ties", () => {
    const u = (cards: ReturnType<typeof getCard>[]) => ({
      projectId: "p", pattern: "pair" as const, turn: 1, cards,
    });
    const inf = ideologyInfluence([
      u([L(2, "solidarity"), L(2, "solidarity")]),       // solidarity
      u([L(3, "solidarity"), L(3, "solidarity")]),       // solidarity
      u([L(4, "heritage"), L(4, "heritage")]),           // heritage
      u([L(5, "solidarity"), L(6, "heritage")]),         // tie → skipped
    ]);
    expect(inf.solidarity).toBe(2);
    expect(inf.heritage).toBe(1);
    expect(inf.sovereignty).toBe(0);
    expect(inf.transformation).toBe(0);
  });
});
```

- [ ] **Run → fail.** `bun test tests/projects.test.ts`
- [ ] **Implement** in `src/core/data/projects.ts`:

```ts
import type { Ideology } from "./cards.ts";
import { IDEOLOGIES } from "./cards.ts"; // verify export; else import from ./ideologies.ts

export function projectMajority(cards: Card[]): Ideology | null {
  const tally = {} as Record<Ideology, number>;
  for (const c of cards) {
    if (c.ideology === "wild") continue;
    tally[c.ideology] = (tally[c.ideology] ?? 0) + 1;
  }
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null; // tie
  return ranked[0][0] as Ideology;
}

export function ideologyInfluence(unlocks: ProjectUnlock[]): Record<Ideology, number> {
  const out = Object.fromEntries(IDEOLOGIES.map((i) => [i, 0])) as Record<Ideology, number>;
  for (const u of unlocks) {
    const m = projectMajority(u.cards);
    if (m) out[m] += 1;
  }
  return out;
}
```

(`zeroIdeologyBreakdown()` already exists in `data/ideologies.ts` and returns exactly this zeroed record — prefer reusing it over `Object.fromEntries` if it's importable here without a cycle.)

- [ ] **Run → pass.** Commit: `feat(core): projectMajority + ideologyInfluence helpers`

### A2: Projects panel shows majority counters (renderer)

**Files:** modify `src/renderer/util/projectTree.ts` (or rename intent to "completed projects"); modify `src/renderer/components/game/ProjectTreePanel.vue`; test `tests/projectTree.test.ts`.

- [ ] Extend the view-model: each built node gains `majority: Ideology | null` (from `projectMajority` of the unlock's cards) and `cardIdeologies: Ideology[]` (per-card, wild excluded) for the small counters. Add an `influence: Record<Ideology, number>` summary (from `ideologyInfluence`). Add a test asserting a built pair of two Solidarity lands yields `majority === "solidarity"`.
- [ ] In `ProjectTreePanel.vue`, render for each built project: a row of small ideology-colored counters (one per non-wild card) plus one **large** counter for `majority` (omit if null). Add a compact per-ideology influence readout (the big-counter tally) at the panel top — this is the number that will drive policy draws in Phase B. Use existing ideology color tokens; no border-radius.
- [ ] `bun run typecheck && bun test`. Commit: `feat(renderer): majority counters + influence readout in projects panel`

### A3: Phase A review + PR
- [ ] Final review subagent (spec compliance + quality + visual check via dev server). Confirm ties show no big counter; influence readout matches counter tallies.
- [ ] PR → `main`, title `feat: project majority counters + ideology influence (M4 Phase A)`. Merge before Phase B.

---

## PHASE B — Policy engine (core + facade)

Branch: `feat/policy-engine` off `main` (after A merges).

### B1: Policy card data (core, TDD)

**Files:** create `src/core/data/policies.ts`; modify `src/core/types.ts` (export `PolicyCard`, `PolicyModifier`); test `tests/policies.test.ts`.

- [ ] Define `PolicyModifier`, `PolicyCard` (per spec), the 8 launch cards, and `POLICY_DECKS: Record<Ideology, PolicyCard[]>` (4 copies of each of the ideology's 2 cards = 8-card deck). Export `ALL_POLICIES` + an id→card map.
- [ ] Tests: each deck has the right cards; ids unique; every card's `base` is non-empty (no dead cards); Conscription has `dissentAdd: 1`.
- [ ] Commit: `feat(core): policy card data + launch deck`

### B2: `effectiveRules` layer (core, TDD)

**Files:** create `src/core/engine/effectiveRules.ts`; modify `src/core/types.ts`; test `tests/effectiveRules.test.ts`.

- [ ] `effectiveRules(epoch, setting): EffectiveRules` (per spec). Base from `setting.rules` (handSize, influenceBaseline, storageCapacity; endTurnKeep=0, dissentPurge=0, dissentAdd=0). For each `epoch.policy.tableau` entry add `base × stacks`; if `scale`, add `scale.mod × floor(ideologyInfluence(epoch.unlockedProjects)[scale.ideology] / scale.per) × stacks`.
- [ ] Tests (build epochs with a hand-set `policy.tableau`): empty tableau → equals `setting.rules`; one Mandate → influenceBaseline +1; Mandate ×3 stacks → +3; Stockpile → storageCapacity 1→2; Deep Reserves with 4 transformation counters → storage +1 base +2 scaled = +3; Conscription → influence +2 and dissentAdd 1; Solidarity Forever with 8 solidarity counters → handSize +1 +2.
- [ ] Commit: `feat(core): effectiveRules layer`

### B3: Epoch policy state + deck init (core, TDD)

**Files:** modify `src/core/engine/epoch.ts` (Epoch type + createEpoch); modify `src/core/types.ts`; modify `tests/*` epoch literals that now need `policy`.

- [ ] Add `epoch.policy` (decks/discards/tableau/candidates per spec). `createEpoch` shuffles `POLICY_DECKS` into `epoch.policy.decks` (rng), empty discards/tableau/candidates. Update all hand-built `Epoch` literals in tests (storage.test, dispatch.test, crisisflow.test) with an empty `policy` — provide a shared `tests/fixtures.ts` `emptyPolicyState()` helper to avoid duplication (consolidate the duplicated `freshEpoch` helpers while here if low-risk).
- [ ] Commit: `feat(core): epoch policy state + deck init`

### B4: Route existing reads through `effectiveRules` (core, TDD)

**Files:** modify `src/core/engine/turn.ts`, `effects.ts` (if handSize read there), `commands.ts` (`storeCard` capacity); tests.

- [ ] `endTurn` start-of-turn tail: influence reset uses `effectiveRules().influenceBaseline`; `drawToHandSize` uses `effectiveRules().handSize`; apply `dissentAdd` then `dissentPurge` (reuse `purgeDissent` + a dissent-add dispatch); end-of-turn cycle keeps `effectiveRules().endTurnKeep` cards.
- [ ] `storeCard` capacity check uses `effectiveRules(epoch, setting).storageCapacity` instead of `setting.rules.storageCapacity`.
- [ ] Tests: a slotted Stockpile lets a 2nd card be stored in a column (cap 1→2); a slotted Mandate raises next turn's influence; Archive keeps 1 card across end of turn; Continuity purges 1 dissent at start of turn. (Construct epochs with pre-slotted tableaux.)
- [ ] Commit: `feat(core): apply effectiveRules to influence/draw/storage/cycle/dissent`

### B5: Policy draw + slotting commands (core, TDD)

**Files:** modify `src/core/engine/commands.ts` (or new `policyCommands.ts`); modify `turn.ts` (draw step); `events.ts`/`dispatch.ts` if events used; tests.

- [ ] Start-of-turn **policy draw**: after hand draw, for each ideology draw `ideologyInfluence(unlocks)[I]` cards from `decks[I]` into `candidates` (reshuffle `discards[I]` when a deck empties; if both empty, draw fewer).
- [ ] Commands: `slotPolicy(epoch, cardId)` — move a candidate to `tableau`, stacking onto a same-id slot (stacks++) or taking a free slot; reject if 5 slots full and no matching slot. `discardPolicyCandidate(epoch, cardId)` → that deck's discard. `removePolicy(epoch, slotIndex)` → push the slot's card (one copy per stack) to its deck's discard, remove slot. Leftover candidates flushed to discards at end of turn (in `endTurn`).
- [ ] Tests: drawing scales with influence; slotting onto a match stacks (no new slot); slotting when full+no-match rejects; stacking then `effectiveRules` reflects the stack; removePolicy frees the slot.
- [ ] Commit: `feat(core): policy draw + slot/stack/discard commands`

### B6: Facade + save v6

**Files:** modify `src/facade/GameAPI.ts` (snapshot exposes `policy` + `ideologyInfluence` + `effectiveRules` view; passthrough commands `slotPolicy`/`discardPolicyCandidate`/`removePolicy`); modify `src/facade/persistence.ts` (v5→v6, archive, no migration).

- [ ] snapshot deep-clones `policy` (decks/discards/tableau/candidates) and adds `effective: EffectiveRules` + `influence: Record<Ideology,number>` for the renderer. Passthrough the three commands (persist on success like `commitHand`).
- [ ] persistence: STORE_KEY `deck-demo-saves-v6`, PREV `…v5`, ARCHIVE `…v5-archive`; version literals 6; `exportState` version 6.
- [ ] `bun run typecheck && bun test`. Commit: `feat(facade): policy state/commands + save v6`

### B7: Phase B review + PR
- [ ] Final review (spec compliance, atomicity of slot/stack, effectiveRules single-source, save-format audit). PR → `main`, `feat: policy engine — decks, tableau, effectiveRules (M4 Phase B)`. Headless-complete; merge before C.

---

## PHASE C — Policy renderer UI

Branch: `feat/policy-ui` off `main` (after B).

### C1: Policy tableau component
- [ ] `components/game/PolicyTableau.vue` — 5 slots, each showing card name/effect/ideology color and a stack badge (×N) when stacks>1; a remove affordance per slot. Reuse `describeEffectSpec`-style helper or a new `describePolicy(card)`. No border-radius.

### C2: Candidate draw UI
- [ ] `components/game/PolicyDraw.vue` (or a section) — this turn's `candidates`, each with "Slot" (disabled with reason if tableau full and no stack match) and "Discard"; leftover auto-discards on end turn. Surface the per-ideology draw counts.

### C3: Wire into App + layout
- [ ] Mount in `App.vue`; add handlers (`onSlotPolicy`/`onDiscardCandidate`/`onRemovePolicy`) on `GameService`. Show the `effective` rules somewhere compact (e.g. TurnBar: "Hand 7 (+2), Inf 10 (+2), Storage 2"). Decide placement (likely a right-rail flyout + a always-visible candidate prompt when candidates exist).
- [ ] `bun run typecheck && bun test`; visual verification via dev server (build a mono-ideology column → majority counter → next turn a policy candidate appears → slot it → effective rules change). Commit per component; PR → `main`, `feat: policy tableau + draw UI (M4 Phase C)`.

---

## PHASE D — Simulator + balance

Branch: `feat/policy-balance` off `main` (after C).

- [ ] `scripts/analyze-crisis.ts`: after the existing policy steps, add a **policy slotting** step — each turn, for each candidate, slot it if (a) a free tableau slot exists, or (b) it stacks a card already slotted; prefer storage/draw/influence cards over Conscription (downside) and over Archive when slots are scarce. Drop nothing on the floor that can be slotted.
- [ ] Re-baseline 500×2 (offset 0 and 1000) per Setting. Policies raise win rates → retune each `crisis.difficulty` **up** toward ~80% on the 4-ideology Settings; record before/after. Generation Ship accepted off-target (note its number, don't chase it).
- [ ] Update `.claude/skills/run-simulation/SKILL.md` policy bullet to mention policy slotting. Commit; PR → `main`, `feat(sim): policy slotting heuristic + re-baseline (M4 Phase D)`.

---

## PHASE E — Docs

Branch: `feat/policy-docs` (or fold into D's PR).

- [ ] CLAUDE.md: new invariant — "Each completed project has a majority ideology; majority-counter counts per ideology drive per-turn policy draws into a 5-slot tableau; policy effects apply only through `effectiveRules(epoch, setting)`." Add `data/policies.ts`, `engine/effectiveRules.ts` to the architecture map; note save v6.
- [ ] In `2026-06-10-column-storage-tech-tree-design.md`, mark M4 superseded by this spec (link it); resolve its tier-gate section as shelved.
- [ ] Commit; PR (or include in D).

---

## Out of scope (per spec)
Phase-2 policy cards (scoring/capability/trigger/modal hooks), card synergies, victory declaration / endings (M5), crisis meter.
