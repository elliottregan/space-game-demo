# Ideology mechanic simplification

## Context

The ideology system currently has three feedback loops (alignment-discount, opposed-backlash, terrain) layered on a complex per-turn vector. The vector is seeded by terrain, picks up rank-weighted contributions from cards placed in columns, dissent-in-hand bias, and transient shifts from card effects.

From the player's perspective there is **no reason to push for one ideology over another**:
- The influence cost discount (the main player-facing incentive) no longer matters now that the influence cap has been lowered enough that it doesn't limit cards-per-turn.
- The opposed-backlash penalty pushes you toward your current lean but doesn't reward picking any particular pole.
- Demonyms / monuments / terrain feed legacy/story but aren't player goals today.

We want to **simplify the vector** so it becomes a clean reflection of board state: cards in play + completed Keystone Projects. The vector still drives demonyms (storytelling) and monument terrain deltas (legacy persistence). We're removing the mechanical machinery the player no longer interacts with, so what's left is honest about its purpose: a status display that records what you've done this Epoch.

## New vector formula

```
vector.axisN =
    Σ over non-wild cards in current tableau columns:
        IDEOLOGY_AXIS[card.ideology].sign  (flat ±1, no rank weighting)
  + Σ over unlocked ProjectUnlocks:
        sign(net of ±1 over the project's cards on axisN) × project.value
```

- Built columns are cleared from `epoch.columns` on Build (verified at `dispatch.ts:42-53`), so cards already in a `ProjectUnlock` are *not* in the columns sum — no double-counting.
- The project contribution uses the **sign** of the project's net ideology direction on each axis, scaled by `project.value` (per-Setting from `settings/*.ts`, falling back to `DEFAULT_PROJECT_VALUE` in `data/projects.ts`). A flush column lands cleanly on one axis. A non-flush column with a balanced split on an axis contributes 0 to that axis.
- `project.value` is looked up via `setting.projects.find(p => p.id === unlock.projectId)`. The lookup is O(5) per project per snapshot — cheap.
- No terrain seed. No dissent-in-hand bias. No transient `shiftIdeology` contribution.

## Removals

**Engine:**
- `engine/ideology.ts`: delete `checkAlignment`, `axisVerdict`, `influenceCostAdjustment`, `Alignment` type.
- `engine/epoch.ts`: delete `effectiveInfluenceCost`, re-exported `Alignment`. Delete the dissent-in-hand backlash loop inside `currentVector`. `currentVector` signature changes from `(epoch, campaign)` to `(epoch, setting)`.
- `engine/commands.ts`: remove `alignment` from `PlaceResult` type and `playToTopRow` plumbing. Remove the opposed-backlash branch that queues `addDissent`. Use `card.influenceCost` directly (no effective-cost wrapper).
- `engine/effects.ts`: keep `applyTransientShift` and `getTransientShift` as dead code for now (defer per user) — the `shiftIdeology` EffectSpec kind remains in the DSL but no card invokes it after this change.

**Facade:**
- `facade/GameAPI.ts`: delete `getEffectiveCost`, `getAlignment`. Update imports (drop `effectiveInfluenceCost`, `checkAlignment`). Pass `setting` instead of `campaign` to `currentVector`.

**Renderer:**
- `renderer/GameService.ts`: delete `getEffectiveCost`, `getAlignment` wrappers.
- `renderer/App.vue`: delete `getEffectiveCost`, `getAlignment` locals + the two props passed to `HandPanel`.
- `renderer/components/game/HandPanel.vue`: drop `getEffectiveCost` / `getAlignment` props. Read `card.influenceCost` directly for the cost-budget check + button-disable. Drop the `:alignment` binding on `Card`.
- `renderer/components/core/Card.vue`: drop the `alignment` prop entirely; drop the `:class="['card-inf-cost', alignment]"` class binding (just use `card-inf-cost`); drop any alignment-keyed CSS rules.

**Card data:**
- `data/cards.ts`: remove the `shift(...)` component from all 7 cards that use it. Keep their other effects (`gainInf`, `draw`, `gainMat`, etc.) intact. The `shift` helper at line 244 can be deleted since nothing else calls it. Lines affected: 270, 283, 291, 315, 487, 500, 513.

## Modifications

**`engine/ideology.ts`** — new `deriveVector` signature:

```ts
export function deriveVector(
  columns: Column[],
  unlockedProjects: ProjectUnlock[],
  projects: KeystoneProject[],
): IdeologyVector {
  const v = { axis1: 0, axis2: 0 };
  for (const col of columns) {
    for (const c of columnCards(col)) {
      if (c.ideology === "wild") continue;
      const { axis, sign } = IDEOLOGY_AXIS[c.ideology];
      v[axis] += sign;
    }
  }
  for (const u of unlockedProjects) {
    const value = projects.find((p) => p.id === u.projectId)?.value ?? 0;
    const net = { axis1: 0, axis2: 0 };
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      const { axis, sign } = IDEOLOGY_AXIS[c.ideology];
      net[axis] += sign;
    }
    v.axis1 += Math.sign(net.axis1) * value;
    v.axis2 += Math.sign(net.axis2) * value;
  }
  return v;
}
```

`IdeologyTerrain` stays as a type and `terrain` still flows through `campaign` — but `deriveVector` no longer takes it as a parameter.

**`engine/epoch.ts`** — `currentVector` collapses:

```ts
export function currentVector(epoch: Epoch, setting: Setting): IdeologyVector {
  return deriveVector(epoch.columns, epoch.unlockedProjects, setting.projects);
}
```

Drop the `getTransientShift` import (not the function — keep it for the DSL kind that no card uses) and the dissent-in-hand loop.

**`engine/campaign.ts`** — `finalizeEpoch` already has `setting`. Change two `currentVector(epoch, campaign)` calls (lines 152, 162) to `currentVector(epoch, setting)`.

**`engine/commands.ts`** — `placeCard` and `playToTopRow` lose the alignment threading. `playToTopRow` becomes:

```ts
function playToTopRow(
  epoch: Epoch,
  _setting: Setting,
  card: Card,
  columnIndex: number,
  handIdx: number,
  eventType: ...,
  rng: RNG,
): PlaceResult {
  if (epoch.influence < card.influenceCost) {
    return { ok: false, error: `Need ${card.influenceCost} Influence (have ${epoch.influence}).` };
  }
  epoch.influence -= card.influenceCost;
  epoch.hand.splice(handIdx, 1);
  dispatch(epoch, { type: eventType, card, columnIndex } as GameEvent);
  applyEffect(card.effect, { epoch, rng, log: () => {} });
  return { ok: true, card };
}
```

`PlaceResult` becomes `{ ok: true; card: Card } | { ok: false; error: string }`.

**`facade/GameAPI.ts`** — `snapshot()` already calls `currentVector(this.epoch, this.campaign)` at line 167. Change to `currentVector(this.epoch, this.setting)`. Delete the `getEffectiveCost` / `getAlignment` methods entirely.

## What stays

- `IDEOLOGY_AXIS`, `DEMONYM_BY_IDEOLOGY`, `IDEOLOGY_BY_DEMONYM`, `OPPOSING_IDEOLOGY` constants — unchanged. (`OPPOSING_IDEOLOGY` is still used by the `addDissent`-with-ideology effect on cards like the Demagogue.)
- `demonym()` and `demonymName()` — unchanged. Demonyms still fire at ±6.
- `IdeologyDisplay.vue` — no changes needed. It still reads `vector` and renders the plot + demonym label.
- Terrain at campaign level: `applyScarredTerrainDissent` (Epoch start), `addMonumentToCampaign` (monument deltas), `applyLossTerrainScar` (loss erosion). The vector still feeds these as before — the formula change just means they receive a board-state-derived vector instead of a vector that included terrain + dissent-in-hand bias.
- Flush detection in `columnPatterns.ts` — unchanged.
- The `shiftIdeology` EffectSpec kind and its resolver (`applyTransientShift`, `getTransientShift`) — unchanged. No card uses them after this change; they remain available for future card design.

## Files to modify

| File | Change |
|---|---|
| `src/core/engine/ideology.ts` | Delete `checkAlignment`, `axisVerdict`, `influenceCostAdjustment`, `Alignment` type. Rewrite `deriveVector` to take `(columns, unlockedProjects, projects)`. |
| `src/core/engine/epoch.ts` | Delete `effectiveInfluenceCost`, `Alignment` re-export. Simplify `currentVector` to `(epoch, setting)`. Drop dissent-in-hand and transient-shift handling inside the vector path. |
| `src/core/engine/commands.ts` | Drop alignment threading and opposed-backlash branch. `PlaceResult` loses `alignment`. Use `card.influenceCost` directly. |
| `src/core/engine/campaign.ts` | Pass `setting` (already in scope) to `currentVector` calls at lines 152, 162. |
| `src/core/data/cards.ts` | Remove the `shift(...)` component from the 7 cards listed above. Delete the unused `shift` helper. |
| `src/core/types.ts` | Drop the `Alignment` re-export. |
| `src/facade/GameAPI.ts` | Delete `getEffectiveCost`, `getAlignment`. Update `snapshot()` to pass `setting` instead of `campaign` to `currentVector`. |
| `src/renderer/GameService.ts` | Delete `getEffectiveCost`, `getAlignment` wrappers. |
| `src/renderer/App.vue` | Delete the two locals + props plumbed to `HandPanel`. |
| `src/renderer/components/game/HandPanel.vue` | Drop the props; use `card.influenceCost` directly for cost checks. Drop `:alignment` on `Card`. |
| `src/renderer/components/core/Card.vue` | Drop `alignment` prop, class binding, and any alignment-keyed CSS rules. |

## Verification

```sh
bun run typecheck   # must pass
bun run lint        # must pass
bun test            # all existing tests; some will need updates (alignment assertions, opposed-backlash expectations, cost-discount checks)
bun run dev         # visual smoke
```

**Test updates expected:**
- `tests/ideology.test.ts`: drop `checkAlignment` cases.
- `tests/dispatch.test.ts` and `tests/smoke.test.ts`: drop assertions tied to opposed-backlash dissent generation if any exist.
- Add at least two new tests for the new `deriveVector`:
  - Cards-in-columns sum: pair of solidarity-rank-5 + sovereignty-rank-3 in one column → axis1 = 0 (one of each side, ±1 flat).
  - Project bonus: one unlocked flush project (mono-ideology, all sovereignty cards) with `project.value = 4` → axis1 includes +4.

**Manual smoke (in `bun run dev`):**
1. Place cards of different ideologies — the dot in the ideology plot should move ±1 per card, no rank weighting, with no terrain offset on a fresh campaign.
2. Build a flush column — confirm the dot jumps by `project.value` in that ideology's direction.
3. Play several "opposed" cards (relative to current lean) — confirm no Dissent enters the discard from those plays.
4. Check influence cost in the HandPanel — always equals `card.influenceCost`, regardless of vector position.
5. Reach ±6 on an axis — demonym label still activates.
6. End-of-Epoch monument deltas + scar still apply on next Epoch start (terrain still functions).

## Risk

Low–medium. Touches many files but each edit is small. The behavior shift is **visible in gameplay** (cards no longer get a discount, opposed plays no longer hurt) — intentional, but worth a smoke pass to make sure nothing emotional like "this card felt important" snaps. The 7 cards losing their shift effect become slightly weaker; that's the player-visible part of the simplification.
