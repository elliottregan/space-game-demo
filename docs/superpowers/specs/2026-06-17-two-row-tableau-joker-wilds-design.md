# Two-Row Column + "Counts As" Wilds + Count-Scaled Promotion

**Date:** 2026-06-17
**Summary:** Collapse the 3-row column to two rows (Land + Influence), turn the former charter cards into general "counts as" full-joker wilds that *complete* poker shapes, and replace flat plurality policy-fuel with a player-chosen, count-scaled promotion at Build.
**Status:** Draft (v3 — count-scaling corrected to promoted-color-only; wilds are swing voters)

---

## 1. Motivation

Three problems with the current column drive this redesign:

- **The 3-row column is noisy.** Land / Influence / Charter forces the player to satisfy a third row that carries almost no decision weight — Charter is a single mandatory slot whose only job is to gate Build (`ColumnFooter.vue:13`, `column.ts:101-105`).
- **The charter card actively blocks the best shapes.** Today a charter is `ideology: "wild"`, and `sharesOneIdeology` (`columnPatterns.ts:85-91`) returns `false` the moment any card is wild — so the mandatory third card *prevents* flushes (and any column-wide shape that needs a shared color). The card you must play is the card that kills your pattern.
- **Emergent policy ideology gives no agency.** Policy fuel is re-derived every read as a flat `+1` to whichever ideology has strict plurality in the built column (`projectMajority` → `ideologyInfluence`, `projects.ts:164-186`). The player never *chooses* which color a Build feeds; it falls out of card counts, and a single off-color card can silently flip it.

The fix: drop the charter row, invert wilds so they **complete** shapes, generalize wildness into an extensible `countsAs` modifier resolved purely in core, and make the player **promote** one present ideology at Build with a contribution that scales with column size and counts wilds toward the promoted color.

---

## 2. Locked Decisions (source of truth — not re-litigated)

- Replace the 3-row column (Land / Influence / Charter) with a **two-row** column: Land (bottom) + Influence/Role (top). Drop the Charter kind and row **entirely**.
- **Build requires only:** both rows filled **and** the column resolves to a pattern. Land still unlocks the Influence row and storage (ordering unchanged). No charter gate. **No new build throttle yet** (deferred).
- The former charter cards become **full-joker wilds**: any rank, any ideology, playable into **either** row. Wilds **complete** shapes (this **inverts** the current rule where ideology "wild" breaks a flush).
- Generalize wilds via a **"counts as"** card-modifier system: each card MAY carry a `countsAs` descriptor that transforms its *effective* value (rank / ideology / row) for evaluation. A full joker = counts as any rank + any ideology + either row. The data model must support **future partial modifiers** ("counts as rank 5 or 10", "counts as solidarity or heritage", "counts as land or role"), but **only the full-joker behavior ships now.**
- **Pattern/ideology evaluation is PURE CORE TypeScript** (no Vue). The `countsAs` resolution lives in core as a pure function consumed by `rowHands` / `columnPatterns` / `ideology` / `projects`. The "Vue computed value" applies **only** to renderer *display*; the canonical resolution is in core. Strict `core → facade → renderer` (no layer imports the layer above; no Vue in core).
- **Flush is evaluated over Land + Influence cards only** now (charter removed from the set). `rowHands` + `columnPatterns` must evaluate the **best achievable** pattern under `countsAs` substitution, via a deterministic algorithm with explicit tie-breaks and explicit edge-case rules (single wild alone; straights completed by wilds; n-of-a-kind completed by wilds; flush completed by wilds; ace high/low).
- **Promotion:** at Build the player promotes **one ideology present in the column**, stored as `promotedIdeology` on the `ProjectUnlock`. The contribution is **count-scaled by the promoted color's own non-wild cards**. Wilds are *swing voters*: they complete shapes but add no policy fuel and never make a color promotable; off-color cards don't fuel the promoted color either. This replaces today's flat `+1`-to-plurality. It drives **`ideologyInfluence` only**. `deriveVector` (identity / demonym / Crisis vector) is **unchanged** — wilds still skipped there. *Identity = what you played; policy fuel = what you promote.*
- **All-wild build** (no non-wild ideology present) ⇒ **no promotion** (`promotedIdeology: null`). Accepted tradeoff of over-using wilds.
- **Deferred (do not design now):** two-pair floor gating, build throttle / Influence pacing, Crisis difficulty re-baseline. Re-baseline **will** be needed (fewer gates + count-scaled influence both raise player power). Plug points noted in §9.
- **Persistence:** column shape changes (no charter; unlock gains `promotedIdeology`). Bump the save store from `localStorage[deck-demo-saves-v6]`; older saves must load without crashing.

---

## 3. Mechanics

### 3.1 Two-row column + buildability

The `Column` becomes Land (bottom) + Influence/Role (top), plus the per-column inert storage area (unchanged). Land still unlocks the Influence row and storage; the ordering invariant is untouched.

```ts
// column.ts — isBuildable, two-row
export function isBuildable(col: Column): boolean {
  return col.lands.cards.length >= 1 && col.influence.cards.length >= 1;
}
```

The charter gate `col.charter.card !== null` (`column.ts:101-105`) is **deleted**, and **no throttle replaces it** (deferred). `columnCards(col)` (`column.ts:90-95`) drops the charter push — its result is now exactly the Land + Influence set, and because that one definition feeds **both** the flush evaluator (`columnPatterns.ts:16`) and `deriveVector` (`ideology.ts:59`), charter removal propagates correctly with no further membership edits. `isBuildable`, `columnCards`, `columnFromConfig`, `clearColumn`, and `createEmptyColumn` all lose their charter handling; `CharterRow`, `canPlaceCharter`, and `placeCharter` are deleted from `column.ts`; `ColumnConfig.charter` is removed.

Row placement (`canPlaceLand`/`canPlaceInfluence`) stops gating on the literal `card.kind` and instead consults `canOccupyRow(card, row)` from the new resolver (§3.2), so a full joker places into either row and a future row-restricted wild places correctly.

### 3.2 The "counts as" card-modifier system

#### Why a first-class descriptor, not an overloaded `ideology`

Today `ideology: "wild"` is overloaded by **two unrelated things**: the charter jokers (`cards.ts:281,292`) **and** the unplayable Dissent clog (`makeDissent`, `cards.ts:361`). If joker-ness were keyed on `ideology === "wild"`, Dissent would become a joker. Therefore **wildness MUST be driven by an explicit `countsAs` descriptor, never by the `ideology` value.** The canonical rule is: a card is wild iff `countsAs !== undefined`.

> **Data-error invariant (Red-team #6).** `ideology: "wild"` on a *playable* card with **no** `countsAs` is a **data error**, not a joker. The resolver treats such a card as colorless-non-wild (`ideologies = []`, `isWild = false`), which — under the inverted flush — **blocks every flush** (it admits no color and is not wild). This is the correct, conservative failure (a malformed card cannot silently become an all-completing joker), but it is a footgun: `"wild"` reads as "joker." Mitigations, both shipped:
> 1. A dev-time assertion in `data/cards.ts` (runs once at module load over `ALL_CARDS`): **no card may carry `ideology: "wild"` without `countsAs`, except `makeDissent()`-shaped cards** (`kind: "dissent"`). Throw on violation so the error surfaces at boot, never mid-game.
> 2. A test (`countsAs.test.ts`) pinning: a `dissent`-kind card (`ideology:"wild"`, no `countsAs`) ⇒ `ideologies = []`, `isWild = false`, **not** a joker, and documented as the *only* legal bare-`"wild"` shape.
>
> A future, stricter option (deferred, noted §10) is to split the type so playable cards cannot be authored with bare `"wild"`. The runtime assert is the shipped guard.

#### Data model (core, in `data/cards.ts`)

One optional field on `Card`. Optional + absent-means-literal keeps every existing card, every test fixture, and every old save valid with zero edits. The "array-ness" the locked decision asked for lives **inside each dimension** (`rank: Rank[]`, `ideology: Ideology[]`) — exactly where future partial wilds need OR-sets — rather than as a top-level array of heterogeneous descriptors (which would force the resolver to union them anyway and complicate "is this dimension overridden?" checks).

```ts
// src/core/data/cards.ts
export type RowKind = "land" | "role"; // the two playable rows (charter is gone)

/** One substitution descriptor: the dimensions this card MAY count as for
 *  EVALUATION only (pattern, flush, promotion-detection). Each field is
 *  optional; absent ⇒ "no override on this dimension — use the literal".
 *  `"any"` is the full-wild marker; an array enumerates a finite OR-set
 *  (future partial wilds, e.g. rank [5, 10]). NOTE the ideology array element
 *  type is `Ideology` (the 4 real colors), NOT `CardIdeology` — a countsAs
 *  ideology override can never re-introduce the "wild" sentinel. */
export interface CountsAs {
  rank?: Rank[] | "any";
  ideology?: Ideology[] | "any";
  kind?: RowKind[] | "any";
}

export interface Card {
  // …existing fields…
  /** Optional evaluation modifiers. Absent ⇒ counts as exactly its literal
   *  rank/ideology/kind. A full joker carries FULL_JOKER. */
  countsAs?: CountsAs;
}

export const FULL_JOKER: CountsAs = { rank: "any", ideology: "any", kind: "any" };
```

`kind` is deliberately `RowKind[]` (`"land" | "role"`), **not** the full `CardKind` union: charter is deleted and `dissent`/`legacy` are never evaluable. This keeps the type honest about where a card may be played for pattern purposes; widening `RowKind` is the seam for any future evaluable row.

> **Design note on the array vs. per-dimension form.** The locked decision says "think an array." We honor array-ness per dimension. If a genuinely *coupled* multi-dimension wild is ever needed ("either a red 5 or a black 10 as a pair"), promote `Card.countsAs` to `CountsAs | CountsAs[]` and have the resolver union across descriptors — a **one-file change** in the resolver, invisible to consumers (they read only the expanded option-sets). This is design headroom, not work.

#### The `RANKS` export and its domain (Red-team #21, #24)

`"any"` rank expansion needs the **set of ranks any live card can actually hold**, which is **not** the `Rank` *type* union. The `Rank` type is `2..15` (`cards.ts:25`), but rank 15 was **only** ever the charter rank, and charters are deleted as data. A full joker that could "count as 15" would let the straight scanner certify role-row straights like `[11,12,13,14,15]` that no real card can form.

Therefore:

```ts
// src/core/data/cards.ts — adjacent to `Rank`
/** The ranks a live card may hold: lands 2–9, roles 10–14. EXCLUDES 15
 *  (the deleted charter rank). This — not the `Rank` type union — is the
 *  domain a `countsAs.rank: "any"` expands to and the straight window scans. */
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
```

A boot-time assertion pins it: **`RANKS` must equal the distinct set of ranks present across `ALL_CARDS` minus dissent/legacy** (so it can never drift to include 15 or miss a real rank). Risk #15's "derive/assert against the Rank union" is corrected here: the assert is against **live card ranks**, never the type union (which still contains 15). Whether to also narrow the `Rank` type to drop 15 is deferred (noted §10).

#### The pure resolver (new file `src/core/engine/countsAs.ts`)

A single pure module is the **only** place wildness is interpreted. It expands a stored `Card` into the option-sets it may assume, plus thin predicates the evaluators call. No Vue, no facade import.

```ts
// src/core/engine/countsAs.ts
import type { Card, Ideology, Rank, RowKind } from "../data/cards.ts";
import { IDEOLOGIES, RANKS } from "../data/cards.ts";

export const ALL_ROWS: readonly RowKind[] = ["land", "role"];

/** The fully-expanded set of (rank, ideology, row) values a card MAY count as
 *  for evaluation. A literal dimension collapses to a single-element set; "any"
 *  expands to the full domain; an array expands to itself.
 *
 *  `ideologies` is `readonly Ideology[]` — it NEVER contains the "wild"
 *  sentinel (Red-team #16). A real-color literal ⇒ [that color]; a "wild"
 *  literal with no override (Dissent / data error) ⇒ []; "any" ⇒ all 4
 *  IDEOLOGIES; an array ⇒ itself. Consumers may rely on every element being a
 *  real color. */
export interface EffectiveCard {
  card: Card;
  ranks: readonly Rank[];          // always non-empty (>=1)
  ideologies: readonly Ideology[]; // bare-"wild"-without-countsAs ⇒ []
  rows: readonly RowKind[];
  isWild: boolean;                 // card.countsAs !== undefined
  /** True iff the ideology dimension is INDETERMINATE — "any" or a literal
   *  "wild" override. Drives the deriveVector skip (§3.4); a rank-only partial
   *  with a real literal color has fullColorWild=false and is NOT skipped. */
  ideologyWild: boolean;
}

function expandRank(card: Card): readonly Rank[] {
  const ca = card.countsAs?.rank;
  if (ca === "any") return RANKS;
  if (Array.isArray(ca)) return ca;
  return [card.rank];
}

function expandIdeology(card: Card): readonly Ideology[] {
  const ca = card.countsAs?.ideology;
  if (ca === "any") return IDEOLOGIES;
  if (Array.isArray(ca)) return ca;
  // No override: a real ideology counts as itself; the legacy sentinel "wild"
  // (Dissent, or a data error) counts as NOTHING for flush. Post-narrow,
  // card.ideology is `Ideology`, so the single-element array is `Ideology[]`.
  return card.ideology === "wild" ? [] : [card.ideology];
}

function expandRows(card: Card): readonly RowKind[] {
  const ca = card.countsAs?.kind;
  if (ca === "any") return ALL_ROWS;
  if (Array.isArray(ca)) return ca;
  return card.kind === "land" ? ["land"] : card.kind === "role" ? ["role"] : [];
}

function ideologyIsWild(card: Card): boolean {
  const ca = card.countsAs?.ideology;
  return ca === "any" || (ca === undefined && card.ideology === "wild");
}

export function effectiveCard(card: Card): EffectiveCard {
  return {
    card,
    ranks: expandRank(card),
    ideologies: expandIdeology(card),
    rows: expandRows(card),
    isWild: card.countsAs !== undefined,
    ideologyWild: ideologyIsWild(card),
  };
}

export const canCountAsRank = (c: Card, r: Rank): boolean => effectiveCard(c).ranks.includes(r);
export const canCountAsIdeology = (c: Card, i: Ideology): boolean =>
  effectiveCard(c).ideologies.includes(i);
export const canOccupyRow = (c: Card, row: RowKind): boolean => effectiveCard(c).rows.includes(row);
export const isWildCard = (c: Card): boolean => c.countsAs !== undefined;
```

`EffectiveCard.ideologies` is typed `readonly Ideology[]` and **never** contains `"wild"` (the `=== "wild"` narrow guarantees TS sees `Ideology` in the single-element branch — confirm with `bun run typecheck`; Red-team #16). `IDEOLOGIES` (the `"any"` expansion) is the 4-color array, so a full joker's flush-eligible colors are the 4 real ideologies, never the sentinel.

`isWild` (`countsAs !== undefined`) is the **structural** predicate (used for storage-clone discipline, the data-error guard, and "this card carries a modifier"). `ideologyWild` is the **ideology-dimension** predicate (used for the identity-vector skip). For the shipped full joker both are true; they diverge only for future partial wilds, which is exactly where they must (Red-team #18).

#### The full-joker representation

The former charter cards lose `kind: "charter"` (that kind/row is deleted) and become normal cards carrying `countsAs: FULL_JOKER`. They keep a **concrete literal `ideology`** for cost/effect/flavor identity. The two formerly `ideology: "wild"` jokers (Pioneer, Apostle) get a **concrete color** so promotion/effects have an identity, **and** so the Generation Ship filter behaves predictably (§3.6 / Red-team #12, #23 fix the recolor choice). Their literal `rank`/`ideology`/`kind` are now irrelevant to evaluation (the resolver overrides all three dimensions) but remain for display, cost, and effect.

```ts
// e.g. the former "The Pioneer" (cards.ts:277)
{
  id: "keystone-pioneer",
  name: "The Pioneer",
  kind: "role",                // a concrete home kind for deck/UI; resolver ignores it for rows
  rank: 14,                    // literal kept for display; resolver ignores it (NOT 15 — see RANKS)
  ideology: "transformation",  // concrete identity for effects/flavor/promotion; ignored for pattern
  influenceCost: 3,
  effect: draw(2),
  tags: ["charter"],           // tag reused as a joker/legacy marker (or rename)
  countsAs: FULL_JOKER,
  flavor: "Wild role, wild suit.",
}
```

> **Recolor + literal-rank choices (concrete, Red-team #12 / #21 / #23):** the six ex-charters get the following **literal** identities (evaluation ignores all of them; only deck filters / display / promotion / cost read them):
> | id | literal `kind` | literal `rank` | literal `ideology` |
> |----|----|----|----|
> | `keystone-pioneer` | `role` | 14 | `transformation` (was `"wild"`) |
> | `keystone-apostle` | `role` | 14 | `heritage` (was `"wild"`) |
> | `keystone-navigators-compass` | `role` | 14 | `transformation` (unchanged) |
> | `keystone-founding-charter` | `land` | 9 | `solidarity` (unchanged) |
> | `keystone-critical-mass` | `role` | 14 | `sovereignty` (unchanged) |
> | (6th, if present) | — | ≤14 | (keep its color) |
>
> Literal ranks are pinned **inside the live `RANKS` domain** (never 15): a `role`-home joker gets 14, a `land`-home joker gets 9. This is display/identity only and never affects pattern evaluation (the resolver returns `RANKS` for the wild's `ranks`), but it keeps `RANKS` derivable from `ALL_CARDS` without a 15 leaking in. The recolors decide Generation Ship inclusion — see §3.6.

#### Three lenses, one descriptor (the contract)

`countsAs` is an **evaluation-only** lens. It MUST NOT touch a card's economic/effect identity:

- **Cost** is read from `card.influenceCost` at play time (`commands.ts:128,134` single-card; the `commitHand` cost path). A wild pays its literal cost — the resolver is never consulted.
- **Effects** fire from `card.effect` via `applyEffect` (`commands.ts:138`; `effects.ts`). A wild fires its **own** effect. The resolver is never consulted.
- **Identity vector** (`deriveVector`, `ideology.ts:52-77`): skip a card iff its **ideology dimension is indeterminate** — replace the two `c.ideology === "wild"` checks (`ideology.ts:60,69`) with `effectiveCard(c).ideologyWild`. This skips full jokers and literal-`"wild"` jokers, but keeps a future rank-only partial (real literal color) **in** the vector. Identity = what you *literally, color-determinately* played (Red-team #18).
- **Promotion / `ideologyInfluence`** (`projects.ts:164-186`): counts **only the promoted color's own non-wild cards**. Wilds are *swing voters* — they complete the shape but never add to any ideology's fuel, nor make a color promotable (§3.4).

> Contract: **cost & effect = literal card; pattern/flush/row = `effectiveCard`; identity vector = skip color-indeterminate cards (`ideologyWild`); promotion = only the promoted color's own non-wild cards count; wilds are swing voters.** Four lenses, one descriptor.

#### Extensibility without touching consumers

Consumers only ever ask: *can this card be rank R? ideology I? row K?* They never inspect the shape of `countsAs`. So:

- Partial rank wild `{ rank: [5, 10] }` → `expandRank` returns `[5,10]`; the straight / n-of-a-kind search already iterates `effectiveCard(card).ranks`. No consumer change. (Its `ideologyWild` is `false`, so `deriveVector` keeps it — correct, it has a real color.)
- Partial ideology wild `{ ideology: ["solidarity", "heritage"] }` → flush search already iterates `effectiveCard(card).ideologies` (§3.3, set-theoretic, **no** `isWild` escape hatch). No consumer change.
- Row-restricted wild `{ kind: ["role"] }` → `canOccupyRow` returns `["role"]`; placement gating already consults it. No consumer change.

### 3.3 Wild substitution / best-achievable-pattern algorithm

All resolution is pure core. `rowHands.ts` and `columnPatterns.ts` consume `effectiveCard(card)`. A row is ≤5 cards, so bounded enumeration is exact and cheap. The evaluator returns the **best achievable** pattern given that wilds can stand in for ranks, ideologies, and rows.

> **Independence invariant (Red-team #14, #23 — make this explicit and TEST it).** Each wild's **rank** and **ideology** are assigned **independently**: the row classifier picks the wild's rank to maximize the row-hand; `sharesOneIdeology` picks the wild's color to complete a flush. This is sound **because rank and color are orthogonal dimensions of a single full joker** — a full joker can simultaneously be "the 9" (for a straight) and "solidarity" (for a flush). Straight-flush / royal-flush therefore work: the land/role straight is a rank fact, the flush a color fact, and one full joker satisfies both at once.
> This independence holds **only for the shipped full joker**, which is unconstrained on every dimension. A future *partial* wild that constrains rank **or** color (`{rank:[5]}`, `{ideology:["heritage"]}`) could break it — e.g. a straight assignment forcing rank 9 while a flush needs that same wild to be a color it cannot be. **Flagged at the `resolveColumnPattern` call site** as: "rank and color are assigned independently; partial wilds that constrain a single wild on rank AND participate in flush need a joint solver." This supersedes the earlier "no pattern couples ranks across rows" justification, which was incomplete (it ignored the straight-flush color coupling). Risk #11 / #14 in §10 carry the deferred note.

#### Inverting the flush (`columnPatterns.ts`)

Today `sharesOneIdeology` returns `false` on any wild (`columnPatterns.ts:85-91`). **Invert it, set-theoretically** (Red-team #17 — **no `isWild` escape hatch**, so partial ideology wilds are honored): a flush exists iff some single concrete color is admitted by **every** card's `ideologies` option-set, where a full joker contributes the full color universe and a color-indeterminate non-wild (Dissent / data error) contributes the empty set (which **blocks**). Flush is evaluated over the Land + Influence set only (charter gone via `columnCards`).

```ts
// columnPatterns.ts
function sharesOneIdeology(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  const sets = cards.map((c) => effectiveCard(c).ideologies); // each is readonly Ideology[]
  // A flush exists iff the intersection over all cards' admissible-color sets
  // is non-empty. An empty set (bare-"wild" non-wild / Dissent) blocks. A full
  // joker contributes all 4 colors, so it never narrows the intersection.
  let inter: Set<Ideology> | null = null;
  for (const s of sets) {
    if (s.length === 0) return false; // colorless, non-completing ⇒ no flush
    if (inter === null) inter = new Set(s);
    else inter = new Set([...inter].filter((i) => s.includes(i)));
    if (inter.size === 0) return false;
  }
  return (inter?.size ?? 0) > 0;
}
```

For the shipped full-joker shape this reduces to: a flush iff every **non-wild** card shares one color, wilds (full color universe) never narrowing the intersection. A partial ideology wild `{ideology:["solidarity","heritage"]}` correctly narrows the intersection to its two colors — the bug the old `e.isWild ||` shortcut would have masked is avoided. A **stray Dissent** (empty set) blocks the flush — keep a test for it. An **all-wild** column trivially satisfies flush (intersection = all 4) — see the ladder note below.

#### All-wild column ⇒ flush, and the 2-card-flush consequence (Red-team #7)

`resolveColumnPattern` checks flush at rung 5 (`columnPatterns.ts:54-55`), **before** straight/trips/pair, so a 2-joker column (one land-row joker, one influence-row joker) — each row classifying as `"high-card"`, the column flush flag `true` — resolves to **`flush`** (value 6). **This is intended and documented, not silently accepted:** two full jokers buy a rung-6 build. It is a real power spike that **compounds Risk #8** (player power) more than the original draft admitted. We do **not** add a minimum-column-size flush gate now (that is the deferred two-pair-floor / throttle work, §9). The plug point and the magnitude are recorded so the deferred **re-baseline** (§9, Risk #8) explicitly accounts for cheap joker flushes. A test in `columnPatterns.test.ts` pins "2 full jokers ⇒ flush" as the **expected** ladder result so it cannot regress unnoticed.

#### Best-achievable row-hand (`rowHands.ts`)

`identifyRowHand(cards)` becomes "the **highest** RowHand this multiset can form, choosing the best assignment of each wild's rank." `isStraight` (`rowHands.ts:40-47`) is replaced by a windowed `canFormStraight`.

1. Resolve `eff = cards.map(effectiveCard)`. Split into `wilds` (`isWild`) and `fixed` (one concrete rank each, in the shipped model). Let `w = wilds.length`, `n = cards.length`.
2. **Empty / single:** `n === 0 → null`; `n === 1 → "high-card"` (a lone wild is also `"high-card"`).
3. **N-of-a-kind / pairs.** Build `counts` over fixed ranks; group sizes are **over distinct ranks**, sorted descending `g0 ≥ g1 ≥ …` (`g0`/`g1` default to 0 when absent). `best = g0`; `maxSame = min(n, best + w)` (a wild may join the largest group or seed a new one). Evaluate highest-first:
   - **four-of-a-kind** (`n===4`): `maxSame >= 4`.
   - **full-house** (`n===5`): feasible iff `max(0, 3 - g0) + max(0, 2 - g1) <= w`. The two groups are on **distinct** ranks by construction (`g0`,`g1` are the two largest distinct-rank counts; wilds seeding the second group take a rank distinct from the first). Worked cases pinned in §8: `[5,5,5]+2w` (g0=3,g1=0 ⇒ 0+2=2≤2 ✓), `[5,5]+3w` (g0=2,g1=0 ⇒ 1+2=3≤3 ✓), `[5,5,9,9]+w` (g0=2,g1=2 ⇒ 1+0=1≤1 ✓, wild completes the trips), all-wild `w=5` (g0=g1=0 ⇒ 3+2=5≤5 ✓).
   - **three-of-a-kind** (`n===3`): `maxSame >= 3`.
   - **two-pair** (`n===4`): two **distinct** ranks each reach ≥2: `max(0, 2 - g0) + max(0, 2 - g1) <= w`, the seeded second group using a rank distinct from the first.
   - **pair** (`n===2`): `maxSame >= 2`.
4. **Straight** (`n===5`), via `canFormStraight(fixedRanks, w)`: fixed ranks must be **distinct** (a duplicate kills the straight). A straight is achievable iff some length-5 consecutive window `[lo..lo+4]` **drawn from `RANKS`** (so `lo` ranges so the whole window lies in `[2..14]`, i.e. `lo ∈ [2..10]`) contains all fixed ranks **and** `w >= 5 - |fixed|`. **Row-domain restriction (Red-team #11/#24):** windows are **not** further clamped to land-only `[2..9]` or role-only `[10..14]`. Lands and roles share the same numeric ladder for straight purposes, and because each row holds only one kind today, fixed cards already constrain the window to their natural band; a wild filling a gap inside that band is correct. The only hard exclusion is **rank 15** (never in `RANKS`), so `[11,12,13,14,15]` can never be certified. (Whether a land-row joker should be barred from claiming a role-band rank 10–14 to "out-straight" what real lands can do is a **deferred** balance question — noted §10 — not a correctness one, since the joker is unconstrained by design.)
5. **Return highest:** `four-of-a-kind > full-house > straight > three-of-a-kind > two-pair > pair > high-card` (mirrors the existing precedence; straight stays above trips as today).

`validateRowHand` is unchanged in contract (`identifyRowHand(cards) !== null`). The set of *valid* intermediate states only grows; nothing previously valid becomes invalid.

> **Determinism (Red-team #20):** `canFormStraight` and every feasibility check return **booleans** — the *pattern* is fully deterministic on identical inputs. The algorithm certifies **existence**, never a specific wild-face assignment. For `[4,5,6,7]+wild`, both window `[3..7]` (wild=3) and `[4..8]` (wild=8) succeed; the boolean is `true` either way. **No per-card "the wild became the 8" face is computed or stored** (`match.cards` keeps the literal cards). Any *future* per-card resolution (the deferred tableau affordance, Risk #14) MUST pick a deterministic window (e.g. lowest `lo`) and live in core so it stays the single source — the spec for that affordance is deferred, but the determinism rule is stated now so it has somewhere to plug in.

#### Column resolution (`columnPatterns.ts`)

`evaluateColumn` / `resolveColumnPattern` keep their structure and the 10-rung ladder (`columnPatterns.ts:13-72`). `columnCards` is now Land + Influence; `isColumnFlush` uses the inverted (set-theoretic) test; `landHand`/`roleHand` use the best-achievable classifier; `containsPair` (`:74-83`) is **unchanged** — it maps `RowHand → bool` over the *classification*, so it transparently accepts wild-built pairs/trips. The two rows are classified **independently** (wild rank assignment is local to a row), valid under the independence invariant above. Add explicit **cross-row-with-wild** tests (Red-team #19): land `[5,5]+wild` ⇒ trips, role `[k,k]` ⇒ pair ⇒ **full-house** fires; role `[scholar, wild]` ⇒ pair feeding a land-trips full-house; 4 solidarity lands `[5,6,7,8,wild]` ⇒ straight **and** flush ⇒ **straight-flush** (the wild is the 9 *and* a solidarity simultaneously — pins the independence invariant).

#### Explicit edge cases

- **Single wild alone in a row** → `"high-card"` (valid intermediate state).
- **Wild on a same-rank stack via single placement:** wild onto `[5]` → pair; onto `[5,5]` → trips; onto `[5,5,5]` → quads; onto empty → high-card. Every step is a valid row-hand.
- **Straight gap by wild:** `[3,4,6,7] + wild` → window `[3..7]`, needs 1 wild → straight. `[3,3,5,6] + wild` → duplicate fixed → straight impossible → falls back to trips.
- **N-of-a-kind / full-house via wilds:** `[5,5,9,9] + wild` → 3-group(5,5,w) + 2-group(9,9) → full-house.
- **Flush via wilds:** three solidarity + one wild → flush; all-wild column → flush + whatever same-rank shape the wilds choose.
- **Ace high/low:** ranks are linear over `RANKS` (`[2..14]`); rank 15 is excluded (charters deleted). There is **no** ace-low wrap today, so straights are plain consecutive windows — no special ace handling. A future wrap plugs into `canFormStraight`'s window generator only.

#### Single-card-placement invariant — RECONCILED with wild two-pair (Red-team #2 / locked invariant)

The original draft claimed both "the n=4 two-pair feasibility rule" **and** "single placement still cannot incrementally build a two-pair." Those contradict: `[5,5]` (pair) → place a single wild → `[5,5,wild]` (trips, valid) → place a single `7` → `[5,5,wild,7]` classifies as **two-pair** under the n=4 rule (`g0=2`, `g1=1`, `w=1` ⇒ `0 + 1 = 1 ≤ 1`). Every intermediate state is a valid row-hand, so single-card placement is **not** rejected — a two-pair *was* built incrementally.

**Resolution (we take the locked-invariant-preserving option (b), not (a)):** **single-card placement of a wild is gated to same-rank-stack growth only.** A wild may be placed (single-card) into a row **only when** the row is empty **or** all its current cards share one rank (i.e. the wild extends `[] / [r] / [r,r] / [r,r,r]`). Mixed-rank or partial-shape rows reject a single wild; those shapes must be laid down via `commitHand` (the multi-card path), exactly as straights/two-pairs already are. Concretely:

- `canPlaceLand` / `canPlaceInfluence` (`column.ts`) gain, for a wild card, the predicate: *target row is empty, or every card in it shares a single fixed rank.* (Implemented over `effectiveCard` of the existing cards: all fixed, one distinct rank.)
- `[5,5]` + single wild ⇒ allowed (→ trips). `[5,5,wild]` + single `7` ⇒ the row is now mixed (`5,5,wild`), so the **non-wild** `7` is the one being placed — but `[5,5,wild,7]` is two-pair, a shape single-placement must not reach. The gate that blocks this is the **existing** rule that the *resulting* row must be a valid same-rank-growth state under single placement: we keep `validateRowHand([...row, card])` AND, for single placement, additionally require the result to be a same-rank stack (high-card / pair / trips / quads) — never two-pair / full-house / straight. This restores the CLAUDE.md invariant verbatim.
- `commitHand` is unaffected (multi-card lay-downs of two-pair/full-house/straight, with or without wilds, remain legal because they are atomic, not incremental).

The §8 tests pin: "single wild onto `[5,5]` ⇒ trips (allowed)"; "single non-wild `7` onto `[5,5,wild]` ⇒ **rejected** (would make two-pair via single placement)"; "two-pair-with-wild only reachable via `commitHand`." The earlier "wild + two different fixed ranks ⇒ null" case still holds (`identifyRowHand` returns null; placement rejected).

`canCommitHand` (`rowHands.ts:53-63`) replaces its strict `c.kind !== requiredKind` check (`:56`) with a row-eligibility check via `canOccupyRow(card, row)`, so a full joker is committable into either row while an ordinary land stays land-only.

### 3.4 Promotion + count-scaled `ideologyInfluence`

#### `ProjectUnlock` gains `promotedIdeology`

```ts
// src/core/data/projects.ts (ProjectUnlock at :45-51)
export interface ProjectUnlock {
  projectId: string;
  pattern: PatternKind;
  turn: number;
  cards: Card[];
  /** Ideology the player promoted at Build. Drives ideologyInfluence ONLY.
   *  null when the built column had no non-wild ideology (all-wild build).
   *  REQUIRED (non-optional): every literal must set it (see §8 test scope). */
  promotedIdeology: Ideology | null;
}
```

The field is **required**, not optional — so the type system forces every `ProjectUnlock` literal (production and test) to set it, surfacing missed sites at `tsc` time rather than at runtime as `out[undefined] += n ⇒ NaN`. The cost is a wide edit across tests (§8 enumerates **every** site).

A core helper enumerates the **legal choices** — ideologies with ≥1 **non-wild** card in the column. Promotion reads the **literal** `c.ideology`, never the `countsAs`-resolved value, exactly as `unlockedIdeologyBreakdown` (`projects.ts:151-160`) and `deriveVector` do:

```ts
// src/core/data/projects.ts
export function presentIdeologies(cards: Card[]): Ideology[] {
  const tally = zeroIdeologyBreakdown();
  for (const c of cards) {
    // Wilds (countsAs) are swing voters: they never make a color promotable,
    // so an all-wild column has no present ideology ⇒ no promotion. The legacy
    // "wild" sentinel (Dissent / old data) is skipped too.
    if (c.countsAs !== undefined || c.ideology === "wild") continue;
    tally[c.ideology] += 1;
  }
  return (Object.keys(tally) as Ideology[]).filter((i) => tally[i] > 0);
}
```

#### `buildColumn` captures the choice — with a core single-option auto-promote (Red-team #22)

`buildColumn` (`commands.ts:213-235`) gains a `promote?: Ideology` parameter. To keep core usable by **headless callers** (the simulator, tests, future AI) without each re-implementing the picker, core **auto-promotes when exactly one ideology is present** (as unambiguous as the all-wild ⇒ null case) and only errors when `promote` is omitted **and** ≥2 ideologies are present:

```ts
export function buildColumn(
  epoch: Epoch, setting: Setting, columnIndex: number, rng: RNG, promote?: Ideology,
): CmdResult<ProjectUnlock> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  const match = evaluateColumn(col, setting.projects);
  if (!match) return { ok: false, error: "Column is not buildable." };

  const present = presentIdeologies(match.cards);
  let promotedIdeology: Ideology | null;
  if (present.length === 0) promotedIdeology = null;                 // all-wild ⇒ no promotion
  else if (promote && present.includes(promote)) promotedIdeology = promote;
  else if (promote) return { ok: false, error: "Cannot promote an ideology not present in the column." };
  else if (present.length === 1) promotedIdeology = present[0];      // unambiguous ⇒ auto-promote
  else return { ok: false, error: "Choose an ideology to promote." };

  const unlock: ProjectUnlock = {
    projectId: match.projectId, pattern: match.kind, turn: epoch.turn,
    cards: [...match.cards], promotedIdeology,
  };
  dispatch(epoch, { type: "column-built", columnIndex, unlock }, rng);
  return { ok: true, value: unlock };
}
```

This means a test or the simulator may call `buildColumn` **without** `promote` and succeed for the common 0- and 1-ideology columns; only genuinely multi-color columns require an explicit choice. The §8 table adds tests for all three branches (0→null, 1→auto, ≥2→reject-without / accept-with). The renderer's `onBuild` still pre-computes via `promotableIdeologies` so it can open the picker (§5), but it is no longer the *only* place the single-option case is handled.

The `column-built` handler (`dispatch.ts:53-67`) pushes `ev.unlock` whole — `promotedIdeology` rides along with **no handler edit**.

#### Count-scaled `ideologyInfluence`

Today `ideologyInfluence` (`projects.ts:178-186`) adds a flat `+1` to each unlock's plurality color. The redesign makes it **count-scaled but promoted-color-only**: each unlock contributes, to its `promotedIdeology`, the count of **its own non-wild cards of that color** — wilds and off-color cards are excluded; a `null` promotion contributes nothing.

```ts
export function ideologyInfluence(unlocks: ProjectUnlock[]): Record<Ideology, number> {
  const out = zeroIdeologyBreakdown();
  for (const u of unlocks) {
    if (u.promotedIdeology === null) continue;
    // Swing voters: a wild (countsAs) completes the shape but adds no fuel, and
    // off-color cards don't fuel the promoted color. Count ONLY the promoted
    // color's own non-wild cards.
    for (const c of u.cards) {
      if (c.countsAs === undefined && c.ideology === u.promotedIdeology) out[u.promotedIdeology] += 1;
    }
  }
  return out;
}
```

> **Semantic note — wilds are "swing voters" (locked decision).** Only the promoted color's **own non-wild** cards count. A 5-card column of 3 solidarity + 1 heritage + 1 wild, promoted to solidarity, contributes **3** to solidarity: the heritage card fuels nothing here (it's off-color) and the wild — though it helped *form* the shape — adds **no** fuel. Wilds complete hands but never tip an ideology's policy weight, and (per `presentIdeologies` above) a wild's literal color does not even make that color promotable. This rewards color **commitment** over column **size**. The §8 `projects.test.ts` rewrite pins an explicit off-color + wild case so this is not buried under "count-scaled."

`projectMajority` (`projects.ts:164-176`) is **no longer consumed by core influence** but is **kept** as a pure helper: the migration backfill (§7) and the renderer's per-build counters use it, and its existing test block documents the old derivation. The renderer's big-counter tally re-points from `projectMajority` to `promotedIdeology` (§5).

#### Identity is untouched (the deliberate split)

`deriveVector` (`ideology.ts:52-77`) is **unchanged in behavior** — it sums per-card axis contributions and a per-unlock signed contribution, skipping color-indeterminate cards, and **never references `promotedIdeology`**. The only edit is mechanical: the two `c.ideology === "wild"` skips (`ideology.ts:60,69`) become `effectiveCard(c).ideologyWild` so literal-`"wild"` jokers **and** full jokers are skipped (and a Dissent is never counted), while a future rank-only partial with a real color is **kept**. `unlockedIdeologyBreakdown` (the Crisis/Monument ideology record, `campaign.ts`) is likewise unchanged, card-derived, wild-excluded (it keeps its literal `c.ideology === "wild"` skip — full jokers carry a real literal color but `unlockedIdeologyBreakdown` is a pure identity record; for the shipped full joker, which always carries a concrete literal color, this would **count** the joker's literal color. **Decision:** switch `unlockedIdeologyBreakdown` to skip on `effectiveCard(c).ideologyWild` as well, so the Crisis/Monument breakdown matches `deriveVector` — identity excludes wilds consistently. This is a one-line edit; pin it with a test that an all-joker column contributes 0 to the breakdown).

> **Identity = what you played (vector, demonym, Crisis breakdown — color-indeterminate cards skipped). Policy fuel = what you promote (`ideologyInfluence`, count-scaled by the promoted color's **own non-wild** cards; wilds + off-color excluded).** A reviewer must not "unify" the two: `sharesOneIdeology` and the promotion tally treat wilds as matching/folding; `deriveVector`/`unlockedIdeologyBreakdown` skip them. Document the divergence at each call site.

#### Influence consumers (unchanged shape, larger values)

All four consumers read the `Record<Ideology, number>` shape; only the values grow:
- `drawPolicies` (`turn.ts:28`) — a 4-card flush promoting solidarity now draws 4 candidates instead of 1; the finite-deck reshuffle loop already tolerates draws larger than the deck. **Primary balance lever.**
- `effectiveRules.ts:43` — `floor(influence / scale.per)` yields more scale steps. Same record; power scales up.
- `policies.ts:34` — `scale` *shape* doc only; the read is in `effectiveRules`.
- `GameAPI.ts:243` — `snapshot.influence = ideologyInfluence(epoch.unlockedProjects)`; now count-scaled.

### 3.5 Events, dispatch, and the playToTopRow signature (Red-team #1/#26/#27 — charter event removal)

The charter row removal cascades through the event layer. **`events.ts` and `dispatch.ts` are first-class affected files** (§6):

- `events.ts`: delete the `card-played-to-charter` variant (`events.ts:18`) from `GameEvent` and the `"tableau-charter"` member (`events.ts:9`) from `DiscardSource`.
- `dispatch.ts`: delete the `card-played-to-charter` handler (`dispatch.ts:32-36`) — it dereferences `col.charter.card`, which no longer exists (would be a typecheck error if left).
- `commands.ts:125`: the `playToTopRow` signature types its `eventType` as `GameEvent["type"] & ("card-played-to-influence" | "card-played-to-charter")`. Narrow it to just `"card-played-to-influence"` (the charter branch in `placeCard` at `:99-113` is deleted, so the only top-row callers are influence/wild-into-influence). A wild placed into the **influence** row dispatches `card-played-to-influence`; a wild placed into the **land** row goes through the land path (`card-played-to-land`) — there is no charter event.

These deletions are **mandatory** (compile-blocking), not optional cleanup: the variant and handler reference a removed field.

### 3.6 Generation Ship deck filter (Red-team #12 / #23 — the §6/Risk-#13 contradiction RESOLVED)

The original draft's "no filter-code change" and Risk #13's "admits all former charters" were **both wrong and contradictory**. The filter is `SHIP_IDEOLOGIES = {sovereignty, transformation, wild}` over **literal** `c.ideology` (`generationShip.ts:11-12`). After the refactor **no joker has `ideology === "wild"`** — each carries a concrete literal color (§3.2 recolor table). So under the *unchanged* filter, the Ship would admit only the jokers whose literal color is `sovereignty` or `transformation`:

- `keystone-pioneer` (transformation) — **admitted**
- `keystone-navigators-compass` (transformation) — **admitted**
- `keystone-critical-mass` (sovereignty) — **admitted**
- `keystone-apostle` (heritage) — **dropped**
- `keystone-founding-charter` (solidarity) — **dropped** (already excluded today; unchanged)

**Decision (write it down): the Generation Ship keeps exactly the three jokers whose literal color is sovereignty/transformation, and loses the heritage/solidarity ones.** This is consistent with the Ship's "left Solidarity and Heritage behind" identity. To make the intent **explicit and drift-proof** (rather than an emergent side effect of recolor choices), the filter switches from "color-matches" to an **explicit joker allowlist OR'd with the color filter**:

```ts
// generationShip.ts
const SHIP_IDEOLOGIES = new Set<string>(["sovereignty", "transformation"]); // drop "wild"
const SHIP_JOKERS = new Set<string>([
  "keystone-pioneer", "keystone-navigators-compass", "keystone-critical-mass",
]);
const STARTING_DECK = ALL_CARDS
  .filter((c) => SHIP_IDEOLOGIES.has(c.ideology) || SHIP_JOKERS.has(c.id))
  .map((c) => c.id);
```

The `"wild"` set entry is **removed** (it now matches nothing — no playable card carries bare `"wild"`). The comment block (`generationShip.ts:8-10`) is rewritten to describe jokers as universal wilds and to name the three the Ship gets. §6 lists this as a **real code change**, correcting the old "no filter-code change" row. (If a balance pass later wants a different joker set, it edits `SHIP_JOKERS` — a single, legible knob.)

Homeworld / Ruined Homeworld use `startingDeck = ALL_CARD_IDS` and auto-include all six jokers once they remain in `ALL_CARDS`; verify post-refactor (no edit expected).

---

## 4. Architecture & Layering

**`countsAs` resolution is a pure-core function, never a Vue concern.** The evaluation pipeline that determines what a column *is* — pattern, ideology, buildability, promotion-eligibility — lives entirely in `core/` and is imported **down** the stack. A grep confirms core imports no Vue and no facade/renderer, and facade imports no renderer; that must stay true when adding `countsAs.ts`.

The renderer already reaches into core for evaluation — the **correct** direction:
- `App.vue:251` calls `evaluateColumn(col, projects)` for the build tooltip (`ColumnFooter.vue:12`, the only pattern feedback the player gets).
- `HandPanel.vue:187` calls `identifyRowHand`; `HandPanel.vue:203-218` simulate placement to preview a commit.
- `TableauPanel.vue:88-90` calls the `canPlace*` helpers for drop-target highlighting.

If `countsAs` resolution lived only in a Vue computed, every one of these core call sites would evaluate the *unresolved* card and disagree with the canonical build-time result (`commands.ts:224`). The renderer's "computed value" is therefore strictly a **display mirror** — **not** the source of truth. The full joker is "any": there is **no per-card player choice** threaded into core for evaluation; the resolver picks the best assignment deterministically. If a future partial modifier ever needs a player-chosen assignment, it enters core as plain data on the `Card`/placement command, **never** as renderer state.

**The renderer must not re-impose a stricter rule than core (Red-team #1/#5 — the `validForDrag`/`canPlaceStored` fix).** Several renderer predicates today AND a raw `card.kind ===` prefix onto the core `canPlace*` call:
- `TableauPanel.validForDrag` (`TableauPanel.vue:88-90`): `land: card.kind === "land" && canPlaceLand(col, card)`, `influence: card.kind === "role" && canPlaceInfluence(col, card)`.
- `App.canPlaceStored` (`App.vue:344-348`): branches on `card.kind` before calling `canPlaceLand`/`canPlaceInfluence`.
- `HandPanel.canPlaceAllSequentially` (`HandPanel.vue:203-218`): branches on `c.kind`.

A full joker carries a concrete literal `kind` (`"role"` for role-home jokers; §3.2), so **`card.kind === "land"` is false** and the joker would never highlight/drop into the Land row — even though core's now-joker-aware `canPlaceLand` (via `canOccupyRow`) accepts it. **Fix: drop the raw `card.kind ===` prefixes entirely** in all three, relying **solely** on core's `canPlaceLand`/`canPlaceInfluence` (which now encode row eligibility via `canOccupyRow`). The original draft's claim "the only `validForDrag` edit is removing the charter branch" was **wrong**; §5/§6 are corrected to drop the land/role kind prefixes too. The contract: **the renderer's drop-affordance is exactly `core.canPlaceLand || core.canPlaceInfluence`, never a renderer-local kind test.**

**Snapshot / reactivity contract holds**, with two additive plain-data fields:
- `GameAPI.snapshot()` `columnsView` (`GameAPI.ts:197-202`) **must** drop the `charter: { card: c.charter.card }` key — after `Column` loses `charter`, reading `c.charter.card` is a **type error**, so this is a **compile-blocking mandatory** edit, not polish. Clone only `lands`, `influence`, `storage`.
- `validColumns` (`GameAPI.ts:266-277`) deletes the `charter` branch (`:274`) and routes land/role through joker-aware placement (no raw kind prefix); the `canPlaceCharter` import (`:51`) is removed.
- `ProjectUnlock` gaining `promotedIdeology` (a primitive set once at Build, never mutated) needs no clone-discipline change.
- `snapshot()` continues returning fresh top-level references each call; the renderer's `shallowRef<Snapshot>` swaps wholesale; no nested mutation. `countsAs` on `Card` and `promotedIdeology` on `ProjectUnlock` serialize and clone trivially.

---

## 5. Renderer / UX

The Vue layer **reflects** core and never re-implements it. It keeps importing the core helpers exactly as today; loosening happens in core, the renderer only stops pre-filtering.

**Two-cell column.** Delete `CharterCell.vue`. In `TableauColumn.vue`: remove the `<CharterCell>` block + import, drop the `discard-charter` emit, narrow `validForDrag` to `{ land, influence }` **and drop its raw `card.kind ===` prefixes (rely on `canPlaceLand`/`canPlaceInfluence`)**, drop the charter clause from `empty`, and set `grid-template-rows: 150px 150px auto`. In `TableauPanel.vue`: remove the `Charter` row-label, set `.row-labels` grid to the byte-identical `150px 150px auto`, drop the `discardCharter` emit + `@discard-charter` wiring + `canPlaceCharter` import, **and rewrite `validForDrag(i)` to `land: canPlaceLand(col, card)` / `influence: canPlaceInfluence(col, card)` with no kind prefix** (Red-team #1). `colMinWidth` already inspects only land + influence — no change.

**`ColumnFooter.vue`:** change the disabled Build tooltip (`:13`) from "Build needs Land + Influence + Charter" to "Build needs a Land and an Influence row that form a pattern." The enabled tooltip (`buildableLabels[i]`) is unchanged — that pipeline (`App.vue:249-256` → `TableauPanel` prop → `buildTooltip(i)` → `ColumnFooter`) reads `evaluateColumn`'s output verbatim, so it automatically reflects wild-completed shapes with zero renderer change.

**Promotion picker.** Eligibility comes from core via a new facade query `GameService.promotableIdeologies(columnIndex): Ideology[]` (wraps `presentIdeologies` over the evaluated column). `App.onBuild(i)` (`App.vue:385-387`) becomes the decision point:
- 0 options (all-wild) → `game.buildColumn(i, null)` straight through.
- 1 option → auto-promote, `game.buildColumn(i, list[0])` (core also auto-promotes if the renderer omits it — §3.4 — so this is belt-and-suspenders).
- ≥2 options → open a new lightweight `PromotionPicker.vue` modal (gated by a `pendingPromotion` ref mirroring the existing `pendingConfirm` pattern), listing one swatch per option (`SuitGlyph` + `suitLabel`); confirm calls `game.buildColumn(columnIndex, chosen)`.

`GameService.buildColumn` and `GameAPI.buildColumn` (`:303`) gain the `promotedIdeology` arg threaded to `buildColumnCore`; the renderer always passes it.

**`projectTree.ts`:** `buildProjectTree` derives the big-counter `majorities` from `u.promotedIdeology` instead of `projectMajority(u.cards)`, keeping the `null` (all-wild) handling. `cardIdeologies` (small per-card counters) is unchanged — it already filters wilds and reflects identity. (`projectTree.ts:31` already types `majorities: (Ideology|null)[]`, compatible.)

**Wild rendering.** Wilds keep `ideology` as a concrete literal color now (no longer `"wild"`), so their **suit** glyph renders that color — but they still display the joker affordance via the new `countsAs` field. A **display-only** `countsAsLabel` computed in `Card.vue` reads `countsAs` and formats it (full joker → "Wild: any rank, any color, either row"; future partial → "Counts as 5 or 10"). This is the only place the "Vue computed value" instruction applies — display text, not evaluation, and **no core dependency** (Red-team #14). The tableau "what the wild resolved to" affordance is a deferred follow-up (depends on `columnPatterns` reporting a deterministic per-card substitution, §3.3); the pattern label already communicates the achieved shape.

**`HandPanel.vue` placement.** In `canPlaceAllSequentially` (`:203-218`): drop the `charter` field from the `sim` column literal (`:209`), delete the `else if (c.kind === "charter")` branch (`:214`), remove the `canPlaceCharter` import (`:95`). **Stop pre-filtering by raw `kind`**; for each selected card try Land then Influence via core (`if (canPlaceLand(sim,c)) … else if (canPlaceInfluence(sim,c)) … else return false`). In `rowHandForRow`/`commitTargets` (`:154-188`), accept a joker for either row (validity still from core `canCommitHand`). `playVerb` (`:229-233`) may stay as-is.

**`App.vue`** also removes the `onDiscardCharter` handler, `@discard-charter` wiring, `canPlaceCharter` import, the charter branch in `canPlaceStored`, **and the raw `card.kind ===` prefixes in `canPlaceStored`** (try `canPlaceLand` then `canPlaceInfluence` — a stored full joker must be replayable into either row; storage→row replay is a real path via `placeCard source:"storage"` / `commitHand fromStorageIds`, Red-team #5).

**`EventLogSection.vue`** (`:27`): delete the `case "card-played-to-charter":` arm — its event type no longer exists (Red-team #1/#26). **`theme.css`** (`:751`): delete the orphaned `.cell.charter-cell` rule.

---

## 6. Affected Files

| File | Change |
|------|--------|
| `src/core/data/cards.ts` | Add `RowKind`, `CountsAs` interface (ideology array element type `Ideology`, not `CardIdeology`), optional `countsAs?: CountsAs` on `Card`, `FULL_JOKER` const, and `RANKS = [2..14]` (EXCLUDES 15) with a boot assert that it equals the distinct live-card rank set. Add a boot assert: no playable (non-`dissent`) card carries `ideology:"wild"` without `countsAs`. Remove `"charter"` from `CardKind` (`:31`) and `CardTag` (`:33`). Convert the 6 former charters (`:273-331`) from `kind:"charter"` to a concrete home kind carrying `countsAs: FULL_JOKER`; recolor Pioneer→transformation, Apostle→heritage; set literal ranks within `[2..14]` (role-home 14, land-home 9). |
| `src/core/engine/countsAs.ts` | **NEW** pure-core resolver. `EffectiveCard` (incl. `isWild` and `ideologyWild`), `effectiveCard(card)`, predicates `canCountAsRank`/`canCountAsIdeology`/`canOccupyRow`/`isWildCard`, `ALL_ROWS`. The single interpreter of wildness; no Vue, no facade import. |
| `src/core/types.ts` | **Remove** `CharterRow` from the `./engine/column.ts` re-export (`:32`). Add `CountsAs`/`RowKind` (from `data/cards.ts`) and `EffectiveCard` (from `engine/countsAs.ts`) re-exports. Export `RANKS` value if barrel-exposed. |
| `src/core/engine/column.ts` | Remove `CharterRow`, `charter` field, `ColumnConfig.charter`, `canPlaceCharter`/`placeCharter`, and all charter handling in `columnCards`, `isBuildable`, `columnFromConfig`, `clearColumn`, `createEmptyColumn`. `isBuildable` = `lands>=1 && influence>=1`. `canPlaceLand`/`canPlaceInfluence` gate via `canOccupyRow`, **plus** the single-card wild same-rank-stack-growth restriction (§3.3). **Delete `columnLandRank`** (`:97-99`) — no live consumer (Red-team #10); if a consumer is found in implementation, instead return `null` when the row holds a wild. |
| `src/core/engine/rowHands.ts` | Best-achievable `identifyRowHand` via `effectiveCard` (distinct-rank group sizes `g0,g1`; `maxSame=g0+w`; full-house/two-pair feasibility on distinct ranks; bounded straight-window scan over `RANKS`, windows `lo∈[2..10]`, never rank 15). Replace `isStraight` with boolean `canFormStraight(fixedRanks, w)`. `canCommitHand` gates row eligibility via `canOccupyRow` (replacing `c.kind !== requiredKind` at `:56`). `validateRowHand` contract unchanged. |
| `src/core/engine/columnPatterns.ts` | **Invert** `sharesOneIdeology` (`:85-91`) set-theoretically over `effectiveCard().ideologies` (no `isWild` escape hatch; empty set blocks; full joker = full universe). `evaluateColumn`/`resolveColumnPattern` keep structure + 10-rung ladder. Add the independence-invariant comment at `resolveColumnPattern`. |
| `src/core/engine/ideology.ts` | Replace the two `c.ideology === "wild"` skips (`:60,69`) with `effectiveCard(c).ideologyWild`. Document the intentional divergence from `sharesOneIdeology`/promotion. |
| `src/core/engine/events.ts` | **Delete** `"tableau-charter"` from `DiscardSource` (`:9`) and the `card-played-to-charter` variant from `GameEvent` (`:18`). |
| `src/core/engine/dispatch.ts` | **Delete** the `card-played-to-charter` handler (`:32-36`) that dereferences `col.charter.card`. |
| `src/core/data/projects.ts` | Add required `promotedIdeology: Ideology \| null` to `ProjectUnlock`. Add `presentIdeologies(cards)`. Rewrite `ideologyInfluence` to count the promoted color's own non-wild cards (`c.countsAs === undefined && c.ideology === promoted`; skip null). Exclude wilds in `presentIdeologies` too (`c.countsAs !== undefined` ⇒ not promotable). **Keep** `projectMajority`. Optionally update `unlockedIdeologyBreakdown` to skip on `effectiveCard().ideologyWild` (consistency — §3.4). |
| `src/core/engine/commands.ts` | Add `promote?: Ideology` to `buildColumn`; validate against `presentIdeologies`; auto-promote on single option; reject on omitted-with-≥2; null on all-wild. Delete the charter branch in `placeCard` (`:99-113`) and the charter clear in `discardColumn` (`:193-195`); delete the `discardCharter` command (`:154-164`) and its `col.charter`/recall references (`recallInfluence` charter guard `:172-174`). Narrow `playToTopRow`'s `eventType` (`:125`) to `"card-played-to-influence"` only. |
| `src/core/settings/generationShip.ts` | **Real change** (corrects old "no change"): drop `"wild"` from `SHIP_IDEOLOGIES`; add `SHIP_JOKERS` allowlist (`pioneer`, `navigators-compass`, `critical-mass`); `STARTING_DECK` filter OR's color + joker-id. Rewrite the comment block (`:8-10`) to describe jokers as universal wilds and name the three the Ship keeps. |
| `src/core/settings/homeworld.ts`, `ruinedHomeworld.ts` | No edit — `startingDeck = ALL_CARD_IDS` auto-includes ex-charters. Verify post-refactor. |
| `src/facade/GameAPI.ts` | Thread `promote?: Ideology` through `buildColumn`; widen result to include `promotedIdeology`. **Mandatory (compile-blocking):** drop the `charter` key in `columnsView` (`:200`, reads `c.charter.card`). Delete the charter branch in `validColumns` (`:274`); remove `canPlaceCharter` import (`:51`). **Remove** the `discardCharter as discardCharterCore` import (`:13`) and the `discardCharter` pass-through method (`:291-292`). Bump `exportState` version 6→7 (`:109`); update the v6 comments at `:91-93,107-116,185-187` to v7/"pre-promotion". Add a defensive `promotedIdeology ??= null` backfill loop in the constructor (`:91-93`) and `loadFromState` (`:185-187`) **after** any state load (mirroring the `turnPhase` default). Add a `promotableIdeologies(columnIndex)` query. |
| `src/facade/persistence.ts` | Bump `STORE_KEY`→`deck-demo-saves-v7`, `PREV_KEY`→`…v6`, `ARCHIVE_KEY`→`…v6-archive`; `SavedState.version`/`SaveStore.version`/`emptyStore` literals `6`→`7` (all three must flip together — literal-union types). Add `migrateV6toV7`; restructure `loadStore` (see §7) — **delete the old v5-archival block** (PREV_KEY now points at v6). Import `projectMajority`/`ProjectUnlock` from core. |
| `src/renderer/components/game/CharterCell.vue` | **DELETE.** |
| `src/renderer/components/game/TableauColumn.vue` | Remove `<CharterCell>` + import + `discard-charter` emit; narrow `validForDrag` to `{land,influence}` **and drop raw `card.kind ===` prefixes**; drop charter from `empty`; `grid-template-rows: 150px 150px auto`. |
| `src/renderer/components/game/TableauPanel.vue` | Remove `Charter` row-label; `.row-labels` grid → `150px 150px auto`; drop `discardCharter` emit + wiring + `canPlaceCharter` import; **rewrite `validForDrag(i)` to drop both raw `card.kind ===` prefixes** (`:88-90`), relying solely on `canPlaceLand`/`canPlaceInfluence`. |
| `src/renderer/components/game/ColumnFooter.vue` | Update disabled Build tooltip (`:13`) to the two-row/pattern message. |
| `src/renderer/components/game/HandPanel.vue` | Remove charter from `sim` literal + charter branch + `canPlaceCharter` import in `canPlaceAllSequentially`; **drop raw kind pre-filter** so wilds try Land then Influence via core; accept a joker for either row in `rowHandForRow`/`commitTargets`. |
| `src/renderer/App.vue` | Remove `onDiscardCharter` + `@discard-charter` wiring + `canPlaceCharter` import + charter branch in `canPlaceStored` **and the raw `card.kind ===` prefixes in `canPlaceStored`** (`:344-348`). `onBuild(i)`: call `promotableIdeologies(i)` → 0 build(null) / 1 build(auto) / ≥2 open `PromotionPicker` via a `pendingPromotion` ref. |
| `src/renderer/components/game/PromotionPicker.vue` | **NEW** modal listing promotable ideologies (`SuitGlyph` + `suitLabel`); emits `@promote(ideology)`/`@cancel`; shown only when >1 distinct ideology. |
| `src/renderer/components/core/Card.vue` | Add display-only `countsAsLabel` computed reading the `countsAs` descriptor; render a card line for wilds. Generic over future partials. No core dependency. |
| `src/renderer/components/shell/sidebar/EventLogSection.vue` | **Delete** the `case "card-played-to-charter":` arm (`:27`). |
| `src/renderer/theme.css` | **Delete** the orphaned `.cell.charter-cell` rule (`:751`). |
| `src/renderer/util/projectTree.ts` | `buildProjectTree`: derive `majorities` from `u.promotedIdeology` (keep null handling). `cardIdeologies` unchanged. |
| `src/renderer/GameService.ts` | `buildColumn` gains the `promotedIdeology` arg; add `promotableIdeologies(columnIndex)` delegating to the new `GameAPI` query. **Remove** the `discardCharter()` pass-through (`:73-74`) and its `@discard-charter` wiring. |
| `scripts/analyze-crisis.ts` | **Deferred but prerequisite for re-baseline:** teach the greedy build AI to pass a `promote` ideology (e.g. column plurality). With the core single-option auto-promote (§3.4), only multi-color columns require it, but the simulator should still pass one to exercise the count-scaled path. |
| `scripts/pattern_reachability.ts` | **Compile-blocking + model-stale:** the flush/straight-flush/royal builders use `c.kind === "charter"` (`:99-100,151-154`) and a 3-card flush model. Either update its model (flush over Land+Influence only; charters are jokers) or scope it out explicitly (it must still `tsc` clean — pre-commit runs project-wide). Recommended: update the model. |
| `scripts/explore-strategies.ts` | **Compile-blocking:** touches `col.charter.card` (`:62,297`) and `placeKind("charter")` (`:379,395`) — won't compile against the two-row `Column`. Update to two rows (drop charter pushes/placements) or scope out explicitly. |

---

## 7. Persistence & Migration

The `Epoch` shape changes structurally: `column.charter` is removed; each `ProjectUnlock` gains required `promotedIdeology`. Old `deck-demo-saves-v6` saves have `promotedIdeology === undefined` (so `out[undefined] += count` ⇒ NaN influence) and a dead `charter` field. Bump v6 → v7 **with a real in-place migrator** (today the code only *archives* v5, no migration — `persistence.ts:48-53`; we must not lose in-flight runs across this change).

- **Keys:** `STORE_KEY = "deck-demo-saves-v7"`, `PREV_KEY = "deck-demo-saves-v6"`, `ARCHIVE_KEY = "deck-demo-saves-v6-archive"`. `SavedState.version`/`SaveStore.version`/`emptyStore()` literals → `7` (all three together — literal-union types won't half-compile).
- **`loadStore` restructure (Red-team #28 — explicit ordering, drop the v5 block):**
  1. Read `STORE_KEY` (v7); if `version === 7` and `slots` is an array, return it.
  2. Else read `PREV_KEY` (v6); if present and `version === 6` and `slots` is an array: run `migrateV6toV7`, `writeStore` under v7, copy the **raw** v6 string to `ARCHIVE_KEY`, `removeItem(PREV_KEY)`, return the migrated store.
  3. **Delete** the existing one-time v5-archival block (`:48-53`) entirely — `PREV_KEY` no longer points at v5, so leaving it would try to archive v6→`v6-archive` **without migrating**, racing the migrate branch. v5 saves are no longer handled (they were already archived on the prior release; acknowledged tradeoff).
  4. Wrap the whole thing in try/catch — fall through to `emptyStore()` on corruption.
- **`migrateV6toV7`** is a pure defensive transform (never throws on a partial save; corrupt slots dropped, not fatal). Per slot:
  - For each unlock with `promotedIdeology === undefined`, set `promotedIdeology = projectMajority(u.cards)` — an `Ideology | null` (null is **retained as null**, not coerced; a tie/all-wild old build correctly gets null). This reproduces the pre-redesign **color choice** for already-built columns.
  - For each column, `delete col.charter`.
  - Set the slot's `state.version: 7`.
- **Belt-and-suspenders (Red-team #25 — ordering):** the `GameAPI` constructor (`:91-93`) and `loadFromState` (`:185-187`) add a loop defaulting any **still-`undefined`** `promotedIdeology` to `null`. This runs **after** the migrator's `projectMajority` backfill, never instead of it — it only catches hand-edited or migrator-skipped saves, and it must **not** overwrite a migrator-set `null` (the loop fills `undefined → null`, leaving real `null` alone; `x.promotedIdeology ??= null` is wrong only if `x.promotedIdeology` were ever a falsy-but-valid value, which `Ideology|null` is not, so `??=` is safe). `exportState` (`:109`) bumps its `version` literal to `7`.

> **Accepted side effect — color faithful, magnitude rescaled (Red-team #3 / #25 — the "exact" wording corrected).** The migrator reproduces the pre-redesign **color choice** (plurality / null-on-tie), **not** the pre-redesign **magnitude**: under the new count-scaled `ideologyInfluence`, a migrated unlock contributes the count of its promoted color's **own non-wild cards** instead of flat `1`. (Old charter jokers were serialized as `ideology:"wild"` with no `countsAs`, so they contribute nothing — consistent with the swing-voter rule.) A mid-run save therefore gains influence retroactively. This is harmless (it matches what an equivalent fresh run would earn; consumers tolerate any non-negative integer) and intentional. The migration comment says exactly this — "color choice faithful, magnitude rescaled to match a fresh run" — and does **not** claim to reproduce the exact pre-redesign influence.

---

## 8. Testing Plan

> **Scope note (Red-team #25/#26/#27):** `promotedIdeology` is **required**, so **every** hand-built `ProjectUnlock` literal and **every** `buildColumn` test caller must be updated or `tsc` fails. The grep targets are: `projectId:` + `cards:` literals, and the helpers `influenceUnlock()` / `u()` / `pairUnlock()` across **all** suites. Charter scaffolding (`placeCharter`, `canPlaceCharter`, `charter()`, `col.charter`) is deleted and forces **structural rewrites** in several suites, not assertion flips.

| Test file | New / changed cases |
|-----------|---------------------|
| `tests/countsAs.test.ts` (**NEW**) | Literal card ⇒ single-element sets, `isWild=false`, `ideologyWild=false`; `FULL_JOKER` ⇒ full `RANKS`/`IDEOLOGIES`/both rows, `isWild=true`, `ideologyWild=true`; partial `{rank:[5,10]}` ⇒ ranks=[5,10], `isWild=true`, **`ideologyWild=false`** (real literal color kept); partial `{ideology:[…]}` expands; a `dissent`-kind card (`ideology:"wild"`, no `countsAs`) ⇒ `ideologies=[]`, `isWild=false`, **NOT a joker, documented as the only legal bare-"wild"**; assert `RANKS` excludes 15; assert the boot guard rejects a playable bare-`"wild"`-no-`countsAs` card. |
| `tests/rowHands.test.ts` | Lone wild ⇒ high-card; single wild onto `[5,5]` ⇒ trips (allowed); **single non-wild `7` onto `[5,5,wild]` ⇒ REJECTED** (would make two-pair via single placement — invariant); two-pair-with-wild reachable only via `commitHand`; `[3,4,6,7]+wild` ⇒ straight; `[3,3,5,6]+wild` ⇒ trips (no straight); full-house feasibility worked cases `[5,5,5]+2w`, `[5,5]+3w`, `[5,5,9,9]+w`, all-wild `w=5`; wild + two different fixed ranks (`n=3`) ⇒ null; **joker cannot form a straight using rank 15** (`[11,12,13,14]+wild` ⇒ NOT `[11..15]`); plain land rejected from the influence row. |
| `tests/columnPatterns.test.ts` (**structural rewrite**) | Remove `placeCharter` import + `charter()` builder; rewrite `complete()` helper to two rows. Flush over Land+Influence only; **wild COMPLETES a flush** (3 solidarity + 1 wild ⇒ flush — inverts the old assertion); **2 full jokers ⇒ flush** (pinned as the intended ladder result, Red-team #7); all-wild column ⇒ flush + same-rank shape; **straight-flush via a wild that is both the 9 AND a solidarity** (independence invariant, Red-team #14); royal-flush with a wild filling a role-row gap; partial ideology wild `{ideology:[sol,her]}` narrows the flush color correctly (no `isWild` escape hatch, Red-team #17); stray Dissent in the set blocks the flush; **cross-row-with-wild full-house** (land `[5,5]+wild`⇒trips, role pair) and (role `[scholar,wild]`⇒pair, land trips). |
| `tests/projects.test.ts` | Rewrite the `ideologyInfluence` block (`:207-226`) to promoted-color-only assertions with explicit `promotedIdeology`: a 2-solidarity build ⇒ **2**; a 2 solidarity + 1 wild build, promote solidarity ⇒ **2** (the wild adds nothing); the **off-color + wild** case 3 sol + 1 her + 1 wild, promote solidarity ⇒ **3** (heritage and wild both excluded); all-wild ⇒ **0**. Add `promotedIdeology` to every `ProjectUnlock` literal in the `unlockedIdeologyBreakdown` cases (`:118-145`) and the `u()` helper (`:209-220`). Add a `presentIdeologies` test (mixed column lists only its non-wild colors; **all-wild column ⇒ `[]`**, confirming not-promotable). Keep the `projectMajority` block as documentation. |
| `tests/ideology.test.ts` | All-wild build moves the vector by 0; a build with a non-wild present still moves it; literal-color full jokers are skipped by `deriveVector` (via `ideologyWild`); a rank-only partial wild with a real color is **NOT** skipped; `unlockedIdeologyBreakdown` excludes full jokers. |
| `tests/policyCommands.test.ts` (**add to plan**) | `influenceUnlock(ideo)` (`:38-46`) **must set `promotedIdeology: ideo`** or it contributes 0 under count-scaling — the "draws ideologyInfluence[I] cards" test would silently assert against 0. Add `promotedIdeology` to all such helpers; update expected draw counts to count-scaled (a same-ideology pair ⇒ 2 draws, not 1). |
| `tests/turnPhase.test.ts` (**add to plan**) | `influenceUnlock` (`:21-28`) likewise needs `promotedIdeology: ideo`; the "opens in policy when candidates exist" test depends on `ideologyInfluence > 0`. Update counts to count-scaled. |
| `tests/effectiveRules.test.ts` (**add to plan**) | `influenceUnlock` (`:15`) needs `promotedIdeology: ideo`; update the `floor(influence/per)` expectations to count-scaled (a single same-ideology pair now yields 2, crossing more `per` thresholds). |
| `tests/crisisflow.test.ts`, `tests/smoke.test.ts` | Add `promotedIdeology` to every hand-built `ProjectUnlock`; `buildColumn` callers pass `promote` (or rely on single-option auto-promote); `smoke.test.ts:18` drops the `col.charter.card === null` read. |
| `tests/column.test.ts` (**structural rewrite**) | Remove `canPlaceCharter`/`placeCharter` imports + the charter tests (`:63-96`). Two-row buildability (`lands>=1 && influence>=1`, no charter); joker places into either row; ordinary card single-row; single-card wild same-rank-growth gate. |
| `tests/dispatch.test.ts` (**structural rewrite**) | Remove `placeCharter` import (`:7`) + the charter-built/discard tests (`:74-89`) that drive `placeCharter` and assert `col.charter.card`. |
| `tests/storage.test.ts` (**structural rewrite**) | Remove `placeCharter` import (`:7`) + the `col.charter.card` assertions (`:259,278`); add a stored-full-joker-replayable-into-either-row case. |
| `tests/persistence` (if present) / migration | A v6 save with a charter row + no `promotedIdeology` migrates: charter dropped, `promotedIdeology` backfilled via `projectMajority` (null retained on tie/all-wild), version 7, archived to `…v6-archive`, v6 key removed; corrupt slot dropped without throwing; the defensive `??= null` loop fills only still-undefined. |
| `tests/buildColumn` (commands) | `buildColumn` with 0 present ⇒ `promotedIdeology: null`; 1 present + no `promote` ⇒ auto-promotes; ≥2 present + no `promote` ⇒ rejects "Choose an ideology to promote"; `promote` not present ⇒ rejects; valid `promote` ⇒ set. |

Use `tests/fixtures.ts` `emptyPolicyState()` for hand-built `Epoch` literals; add a `fullJoker()` card fixture for wild cases.

---

## 9. Deferred / Out of Scope

Do **not** design these now; this is only where they plug in:

- **Two-pair floor gating** — a new guard before/after `evaluateColumn` in `buildColumn` (`commands.ts:213`), orthogonal to `countsAs` resolution. Surfaces in the renderer as a disabled Build state + reason string via the existing `buildableLabels` → `build-tooltip` channel. **This is also the natural home for a minimum-column-size flush gate** if the cheap 2-joker flush (§3.3, Red-team #7) proves too strong.
- **Build throttle / Influence pacing** — the same `buildColumn` guard site; possibly a per-column "build budget" indicator at `ColumnFooter`.
- **Crisis difficulty re-baseline** — **WILL be needed.** Fewer build gates (no charter), count-scaled `ideologyInfluence` (the promoted color's own non-wild cards, §3.4), **and** cheap joker-completed flushes/straights/quads (incl. the 2-joker rung-6 flush) all raise player power. Re-tune `CRISIS.difficulty` per Setting (`homeworld.ts` = 16, `generationShip.ts` = 12, `ruinedHomeworld.ts` = 23) via `bun run scripts/analyze-crisis.ts <runs> <settingId>` and the `run-simulation` skill **after** the mechanics land. The simulator's greedy build AI **must** pass a `promote` ideology (e.g. column plurality) to `buildColumn` — with the core single-option auto-promote (§3.4) only multi-color columns strictly require it, but the AI should pass one to exercise the count-scaled fuel path and to avoid the ≥2-present rejection. Prerequisite for any meaningful balance pass.
- **Per-card wild-face resolution** (the tableau "what the wild became" affordance) — depends on `columnPatterns` reporting a **deterministic** per-card substitution (lowest-`lo` window, §3.3). Core change, not in v1; ship the hand-side `countsAsLabel` (pure display) first.
- **Land-row vs role-row straight band restriction for jokers** — whether a land-row joker may claim a role-band rank (10–14) to form a straight no real land could is a **balance** question, not correctness; deferred. Today the algorithm allows it (the full joker is unconstrained); revisit at re-baseline.

---

## 10. Open Risks

| # | Risk | Severity | Mitigation / Disposition |
|---|------|----------|------------|
| 1 | `ideology: "wild"` is overloaded by charter jokers **and** Dissent (`cards.ts:281,292,361`). Keying joker-ness on `ideology === "wild"` would turn Dissent into a joker. | High | **Fixed (§3.2):** wildness = `countsAs !== undefined`; the resolver is the only interpreter; boot assert + test that a Dissent card is NOT a joker. |
| 2 | Four call sites read `card.ideology === "wild"` for evaluation (`columnPatterns.ts:87`, `ideology.ts:60,69`, `projects.ts:167`). A missed migration silently diverges flush vs. identity vs. promotion. | High | **Fixed:** grep-clean sweep to `effectiveCard`/`ideologyWild`; a test per consumer. |
| 3 | `deriveVector` (skips wilds) and `sharesOneIdeology`/promotion (count wilds) treat wilds **oppositely** — a "unify wild handling" refactor breaks the locked identity-vs-fuel split. | High | **Fixed:** documented at every call site; `deriveVector`/`unlockedIdeologyBreakdown` skip on `ideologyWild`, read literal `ideology`; tests pin all-wild ⇒ vector 0 but still promotes. |
| 4 | Inverting `sharesOneIdeology` flips existing assertions and any simulator heuristic assuming "wild ⇒ no flush." | High | **Fixed:** `columnPatterns.test.ts` rewritten; `pattern_reachability.ts` flush model updated (§6). |
| 5 | The renderer imports core evaluators directly; duplicating `countsAs` resolution as a renderer-only computed would desync from canonical build-time evaluation. | High | **Fixed:** `effectiveCard` is the sole resolver in core; renderer wraps it for display only; the raw `card.kind ===` prefixes in `validForDrag`/`canPlaceStored`/`canPlaceAllSequentially` are **removed** so the renderer no longer re-imposes a stricter rule than core. |
| 6 | Promotion eligibility computed in the renderer would duplicate the rule. | High | **Fixed:** `GameAPI.promotableIdeologies`; `onBuild` calls it; core auto-promotes the single-option case so headless callers don't re-implement the picker. |
| 7 | The `analyze-crisis.ts` greedy AI calls `buildColumn` with no `promote`; without auto-promote every multi-color build would be rejected ⇒ 0% win rate silently. | High | **Mitigated:** core auto-promotes 0- and 1-ideology columns; the simulator still must pass `promote` for multi-color builds before any balance run (§9 prerequisite). |
| 8 | Player power rises sharply (jokers complete flushes/straights/quads incl. a 2-joker rung-6 flush; whole-column count-scaled influence; no charter gate; no throttle). Existing `CRISIS.difficulty` too easy. | High | **Deferred per locked decision but flagged louder** — §9 re-baseline explicitly accounts for cheap joker flushes + whole-column fuel; `scripts/analyze-crisis.ts` + `run-simulation` per Setting once mechanics land. |
| 9 | v6 saves carry a charter row + no `promotedIdeology`; a skipped/failed migrator yields `out[undefined] += count` ⇒ NaN and a dead `charter`. | High | **Fixed (§7):** required field forces `tsc` coverage; `migrateV6toV7` (backfill via `projectMajority`, null retained, delete charter) **plus** the defensive `undefined → null` loop (runs after the migrator); migrator wrapped in try/catch. |
| 10 | `columnLandRank` (`column.ts:97-99`) reads `cards[0].rank` — ambiguous once a land row holds a joker. | Med | **Disposition:** no live consumer found (grep) ⇒ **delete it** (entropy-reducing). If implementation finds a consumer, return `null` when the row holds a wild. |
| 11 | Rows classified independently with local wild rank assignment; a future column-wide n-of-a-kind would under-count. | Med | **Documented** at `resolveColumnPattern`; current ladder has no such pattern. |
| 12 | Loosening `canCommitHand`/`HandPanel`/`validForDrag` row gating could let a plain land into the influence row if done by raw kind. | Med | **Fixed:** all gating routes through `canOccupyRow`; ordinary cards stay single-row; test "plain land rejected from influence row." |
| 13 | Generation Ship's deck filter behavior under recolored jokers. | Med | **Fixed (§3.6):** drop `"wild"` from the filter; explicit `SHIP_JOKERS` allowlist keeps pioneer/navigator/critical-mass; comment + §6 corrected (the old "no filter change" was wrong). |
| 14 | Straight-flush/royal couples a row-straight with a column color via one wild; "rows independent" is sound for the **full** joker (rank ⊥ color) but breaks for partial wilds. | Med | **Documented (§3.3 independence invariant)** + test (wild is both the 9 and a solidarity); partial-wild joint solver flagged for future work. |
| 15 | `RANKS` (the `"any"` domain) must be the live-card rank set and **exclude 15**; a type-derived `2..15` would manufacture phantom top-end straights. | Med | **Fixed (§3.2):** `RANKS = [2..14]`, boot-asserted against live `ALL_CARDS` ranks (not the type union); test that a joker can't straight via 15. |
| 16 | `CountsAs.ideology` typed `Ideology[]`; `EffectiveCard.ideologies` must never contain the `"wild"` sentinel; back-compat narrow must type-check. | Med | **Fixed:** `ideologies: readonly Ideology[]`; the `=== "wild"` narrow gives `Ideology` in the literal branch; verify with `bun run typecheck`. |
| 17 | The inverted `sharesOneIdeology` must honor **partial** ideology wills (no `isWild` escape hatch) and let a Dissent (empty set) block. | Med | **Fixed:** set-theoretic intersection over `effectiveCard().ideologies`; full joker = universe, empty set blocks; tests for partial-narrowing and Dissent-blocks. |
| 18 | `isWildCard` (`countsAs !== undefined`) vs "ideology-wild" diverge for partials; `deriveVector` skipping on the former would drop a rank-only partial that has a real color. | Med | **Fixed:** two predicates — `isWild` (structural) and `ideologyWild` (color dimension); `deriveVector`/`unlockedIdeologyBreakdown` skip on `ideologyWild`. |
| 19 | Cross-row-with-wild patterns (full-house from wild-built trips + pair) are the highest-risk untested combination. | Med | **Fixed:** explicit cross-row-with-wild tests added (§8 `columnPatterns.test.ts`). |
| 20 | Multiple satisfiable straight windows ⇒ which the algorithm "uses" is unspecified; matters for the deferred per-card display. | Low | **Fixed:** `canFormStraight` returns boolean-only (pattern deterministic, no face stored); any future per-card resolution must pick lowest-`lo` in core. |
| 21 | Ex-charters keep a literal `rank` for display; if it stays 15, `RANKS` could leak a 15. | Low | **Fixed (§3.2):** literal ranks pinned to `[2..14]` (role-home 14, land-home 9). |
| 22 | Core `buildColumn` erroring on omitted `promote` makes it unusable for headless callers (sim/tests). | Med | **Fixed:** core auto-promotes the single-ideology case; errors only on omitted-with-≥2; tests pin all three branches. |
| 23 | "Rows independent, no coupling" justification was incomplete (ignored straight-flush color coupling). | High | **Fixed:** replaced with the explicit rank ⊥ color independence invariant (§3.3); partial-wild joint solver flagged. |
| 24 | Straight-window bounds were unspecified; jokers could fabricate cross-domain / rank-15 straights. | High | **Fixed (§3.3):** windows over `RANKS`, `lo∈[2..10]`, rank 15 excluded; land/role band clamping is a deferred *balance* question, not correctness. |
| 25 | Migration "reproduces exact pre-redesign influence" contradicted the count-scaled inflation note; `??= null` vs migrator ordering ambiguous. | Low | **Fixed (§7):** wording is "color faithful, magnitude inflated"; defensive loop runs **after** the migrator and only fills still-`undefined`, never overwriting a migrator `null`. |
| 26 | Charter `GameEvent`/`DiscardSource`/dispatch handler + `EventLogSection`/`theme.css` references left dead ⇒ `tsc`/build break. | High | **Fixed (§3.5, §6):** `events.ts`, `dispatch.ts`, `commands.ts:125`, `EventLogSection.vue:27`, `theme.css:751` all enumerated for deletion. |
| 27 | `types.ts` barrel still re-exports deleted `CharterRow`; required `promotedIdeology` breaks every untouched `ProjectUnlock` literal. | High | **Fixed (§6, §8):** barrel `CharterRow` removed + new re-exports added; §8 enumerates every literal/helper site across all suites. |
| 28 | `loadStore` v6→v7 vs the old v5-archival block could double-archive or skip; v5 handling silently drops. | Med | **Fixed (§7):** explicit ordered branches; **delete** the v5 block; v5 no-longer-handled acknowledged. |
| 29 | `projectMajority` becomes dead in *core* (only renderer + migrator use it). | Low | **Kept:** re-point renderer big-counters at `promotedIdeology`; migrator + test block keep `projectMajority` alive as documentation. |
| 30 | Bounded row enumeration is exact only for ≤5-card rows + the `maxSame = g0 + w` shortcut; a larger row or partial-rank `countsAs` needs the general per-card enumerator. | Low | **Flagged:** shortcut is wild-only; revisit for any future partial-rank work. |
| 31 | Migrated mid-run saves gain retroactive influence under count-scaling. | Low | **Accepted (§7):** matches an equivalent fresh run; documented in the migration comment. |
| 32 | A future stricter type forbidding bare `"wild"` on playable cards (vs the shipped runtime assert) is **not** designed now. | Low | **Deferred:** the boot assertion is the shipped guard; the type split is noted as a future option, not built. |
