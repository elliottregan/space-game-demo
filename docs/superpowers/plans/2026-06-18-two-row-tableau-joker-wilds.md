# Two-Row Tableau + Counts-As Wilds + Promoted Ideology — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-row poker column with a two-row (Land+Influence) column whose former charter cards become pure-core "counts as" full-joker wilds that COMPLETE shapes, and let the player promote one present ideology at Build (count-scaled by that color's own non-wild cards; wilds are swing voters).

**Architecture:** A new pure-core `countsAs` resolver feeds the existing row-hand/column-pattern evaluators (no Vue in core; renderer computed is display-only). The charter row and the required `promotedIdeology` field are project-wide type changes that land as atomic tsc-green commits; everything else layers incrementally. Persistence migrates v6→v7. The build-time ideology promotion is a blocking modal built on a new reusable `Modal` component (Reka UI headless Dialog primitives), reusing the policy-card selectable style.

**Tech Stack:** Vue 3 + TypeScript + Vite + Bun (bun test, tsc --noEmit, lefthook pre-commit) + Reka UI (headless modal/Dialog primitives, added in this plan).

---

## Sequencing & commit safety

GREEN-AT-EACH-COMMIT RATIONALE. The charter/joker ordering knot: the ex-charter cards are simultaneously 'the charter row' (deleted) and 'the future jokers' (countsAs wilds). The resolver infra (countsAs.ts, Card.countsAs, RANKS, FULL_JOKER) is purely ADDITIVE and lands FIRST (P0) while charter still exists — no existing card sets countsAs, no evaluator reads it, so every existing test passes untouched. Evaluators (P1) are then taught to resolve via effectiveCard INCREMENTALLY, each driven by fullJoker() fixtures: non-wild inputs keep their exact current classification (identifyRowHand on fixed ranks is unchanged behavior; the inverted flush still reduces to 'every non-wild shares one color' when no wilds present), so old assertions stay green. Crucially P1's wild logic is dormant in production because the ex-charters are still kind:'charter' (not yet wild) — it only goes live when P2 recolors them. This lets the risky evaluation rewrites land as small, individually-tested commits BEFORE the big structural change.

TWO ATOMIC PHASES (each must be ONE tsc-green commit, larger than 2-5 min — acknowledged):
- P2 (charter removal): removing CharterRow/charter from the Column type breaks col.charter readers across core (column/commands/dispatch/events/GameAPI), renderer (8 SFCs + theme.css), scripts (explore-strategies, pattern_reachability), and tests (column/dispatch/storage/columnPatterns/smoke) ALL AT ONCE. The ex-charter recolor to FULL_JOKER MUST happen inside this same commit because deleting 'charter' from CardKind invalidates their kind:'charter' literals. Splitting any reader out would leave a type error somewhere in the project and fail the hook. The 'test' for the structural pieces is the rewritten suites going green.
- P3 (promotedIdeology required): making the field non-optional breaks EVERY ProjectUnlock literal and every buildColumn test caller across all suites simultaneously (tsc surfaces each missed site). The field add + every literal/helper backfill + the ideologyInfluence rewrite + the buildColumn promote branches + the facade promote threading must land together; a partial commit leaves literals missing a required field => tsc fails.

SCRIPTS NOTE: tsconfig.json `include` is ['src/**/*','tests/**/*'] — scripts/ is NOT in the project typecheck scope, so `bun run typecheck` (vue-tsc) does not flag them. BUT the spec §6 marks them compile-blocking and they DO break at runtime/`bun test` import-time once core changes (they read col.charter / kind==='charter'). I fold the script fixes (explore-strategies, pattern_reachability, analyze-crisis promote arg) into the same atomic commit that removes their referent (P2 for charter readers, P3 for the buildColumn promote arg) so no commit ever leaves a script referencing a deleted field. analyze-crisis's promote arg belongs in P3 (the buildColumn signature change), the charter-reading scripts in P2.

INDEPENDENT / PARALLELIZABLE: P5 (reka-ui + reusable Modal) depends only on adding the dependency and can run anytime in parallel with P0-P4. P6 (PromotionPicker + display) is the convergence point needing the facade query (P3), the two-cell column (P2), and the Modal (P5). Persistence (P4) depends on the final v7 type shape (P2+P3) so it follows them.

REKA UI API verified via context7 (/unovue/reka-ui): primitives import from 'reka-ui' as DialogRoot/DialogTrigger/DialogPortal/DialogOverlay/DialogContent/DialogTitle/DialogDescription/DialogClose; modal mode auto-traps focus and announces via Title/Description; controlled via :open + @update:open; non-dismissable achieved by .prevent on @escape-key-down/@pointer-down-outside. Adding reka-ui ships its own types so tsc stays green.

RETROFIT NOTE: Retrofitting PolicyHandModal (its hand-rolled .policy-modal-scrim) and other existing modals onto the new reusable Modal is explicitly OUT OF SCOPE — flagged as future cleanup; only PromotionPicker uses Modal.vue now. DEFERRED per spec §9: two-pair floor / build throttle / minimum-flush gate, per-card wild-face affordance, and the Crisis difficulty re-baseline (WILL be needed — run `bun run scripts/analyze-crisis.ts <runs> <settingId>` + run-simulation after mechanics land) are NOT in this backbone.

---

## Red-team corrections — apply these (authoritative; supersede any task text they touch)

These corrections were found by adversarial review of this plan against the real code. Where a task below conflicts with them, the correction wins.

- **C1 (HIGH) — no `land` import from `cards.ts`.** `cards.ts` exports `landId`/`roleId`/`getCard`, **not** `land`. Any task (esp. Task ~23, `tests/persistence.test.ts`) that writes `import { land } from ".../cards.ts"` or calls `land(2,"solidarity")` must instead define a local helper mirroring the other suites (`column.test.ts:16`): `const land = (rank, ideo) => getCard(landId(rank, ideo))` and `import { getCard, landId } from "..."`. Same for any `role(...)` helper (`getCard(roleId(...))`).
- **C2 (HIGH) — `countsAs` attaches to the ex-charters in P2, NOT P0.** P0 is purely additive infra (the `CountsAs` type, `RANKS`, `FULL_JOKER`, the `countsAs.ts` resolver, boot asserts) and **must not set `countsAs` on any card**. The ex-charter cards receive `countsAs: FULL_JOKER` (and their literal recolor) **only in P2**, in the same atomic commit that deletes `kind:"charter"`. This keeps the P1 evaluators dormant in production and keeps the P1 legacy flush test (Task ~6) GREEN. If any P0 task recolors/attaches `countsAs` to `keystone-pioneer` et al., move that into P2.
- **C3 (MED) — the "scripts break the green gate" rationale is false; fix scripts deliberately anyway.** `tsconfig.json` `include` is `["src/**/*","tests/**/*"]`, so `scripts/` is **outside** `bun run typecheck`, and **no test imports any script** — so a broken `scripts/*.ts` (reading `col.charter` / `kind:"charter"`) passes `bun test`, `bun run typecheck`, AND the pre-commit hook. Still fix `scripts/explore-strategies.ts` + `scripts/pattern_reachability.ts` in the P2 commit and the `analyze-crisis.ts` `promote` arg in P3 — but because correctness requires it (they break when *run*), not because a gate forces it. Correct the "SCRIPTS NOTE" wording accordingly.
- **C4 (MED) — storage-replay test must match `placeCard`'s literal-kind routing.** `placeCard` routes by the **literal** `card.kind` (`if (card.kind==="land")` / `"role"`), not `canOccupyRow`. The P0 `fullJoker()` fixture is built from a **land** (`kind:"land"`). So a P2 storage-replay test (Task ~8) that plays a `fullJoker()` via `placeCard(source:"storage")` lands it in **`col.lands`**, not `col.influence` — assert land-row placement, or test influence-row replay via `commitHand` (which is `countsAs`-aware) or a `kind:"role"` joker fixture.
- **C5 (MED) — a land-home joker with a real cost/effect must not skip them.** After P2, `keystone-founding-charter` is `kind:"land"`, `influenceCost:2`, `effect:gainInf(2)`, `countsAs:FULL_JOKER`. `placeCard`'s land branch charges no cost and fires no effect (real lands are cost-0/noop), which would silently skip both — violating spec §3.2 ("a wild pays its literal cost; fires its own effect"). Resolve in Task ~13: either charge cost + fire effect in the land branch when the card has them, or give the land-home joker `influenceCost:0`/noop. Pick one and make it explicit.
- **C6 (LOW) — "five" ex-charters, not "six".** `buildCharters()` returns exactly 5 cards. Fix the prose in the P2 banner + Task ~10/~16 intros ("six ex-charters" → "five"); the executable `buildJokers()` already lists 5.
- **C7 (LOW) — preserve the `build` comment in `events.ts`.** In the P2 `events.ts` edit, do a targeted removal of only the `"tableau-charter"` `DiscardSource` member and the `card-played-to-charter` `GameEvent` variant; do **not** wholesale-rewrite the union (it would delete the multi-line `// Cards consumed by completing a project …` comment above `build`).
- **C8 (LOW) — verify the jokers survive the Homeworld/Ruined decks.** Add a concrete check in P2 (Task ~19) that the 5 joker ids still appear in each Setting's `startingDeck` (Homeworld/Ruined use `ALL_CARD_IDS`), so the "auto-include" assumption is actually confirmed.
- **C9 (LOW) — note the isolated-file green caveat in P3.** `bun test tests/<file>.ts` transpiles+runs only imported modules (no project-wide typecheck), so P3 Tasks ~20/~21 can pass in isolation while `bun run typecheck` stays RED until the Task ~22 backfill. State this so an implementer doesn't expect project-wide green mid-phase.

---

## Phase P0 — Additive `countsAs` resolver + card-data scaffolding (breaks nothing)

**This phase is NOT atomic.** It is purely additive: the new resolver, the `Card.countsAs` field, `RANKS`/`FULL_JOKER`, and two boot asserts. No existing card sets `countsAs`; no evaluator reads it. Charter cards keep `kind: "charter"` and `rank: 15` for now. Every pre-existing test stays green untouched. Tasks land as small red→green→commit cycles.

> **P0-specific nuance — the `RANKS` boot assert and charter rank 15.** In P0 the charter cards still exist as data (`kind: "charter"`, `rank: 15`). `RANKS = [2..14]` deliberately excludes 15. The boot assert that pins `RANKS` against `ALL_CARDS` must therefore exclude **`dissent`, `legacy`, AND `charter`** kinds — charter is a dead kind being removed in P2, so its rank-15 is not part of the live evaluable rank domain. (Once P2 deletes charters, the `charter` exclusion becomes a no-op, so the assert remains correct after charter removal with no edit.)

---

### Task 1: Add `RowKind`, `CountsAs`, `Card.countsAs`, `FULL_JOKER`, and `RANKS` to `data/cards.ts`

Purely additive type/data scaffolding. No existing card sets `countsAs`, so behavior is unchanged. The two boot asserts live here and run once at module load over `ALL_CARDS`.

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/data/cards.ts`
  - After the `Rank` type (`cards.ts:25`): add `RANKS` const.
  - After the `CardTag` type (`cards.ts:33`): add `RowKind` + `CountsAs` interface + `FULL_JOKER`.
  - In the `Card` interface (`cards.ts:53-64`): add optional `countsAs?: CountsAs`.
  - After `ALL_CARDS` (`cards.ts:338`): add the two boot asserts.

**Steps:**

- [ ] Add `RANKS` adjacent to `Rank`. The `Rank` type union still includes 15 (deferred); `RANKS` is the live-card domain and excludes it. Insert immediately after line 25 (`export type Rank = …;`):

  ```ts
  /** The ranks a live card may hold: lands 2–9, roles 10–14. EXCLUDES 15
   *  (the deleted charter rank — charters are removed in a later phase). This
   *  — NOT the `Rank` type union (which still contains 15) — is the domain a
   *  `countsAs.rank: "any"` expands to and the straight window scans. */
  export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  ```

- [ ] Add `RowKind`, `CountsAs`, and `FULL_JOKER` immediately after the `CardTag` line (`cards.ts:33`):

  ```ts
  export type RowKind = "land" | "role"; // the two playable rows (charter is being removed)

  /** One substitution descriptor: the dimensions this card MAY count as for
   *  EVALUATION only (pattern, flush, promotion-detection). Each field is
   *  optional; absent ⇒ "no override on this dimension — use the literal".
   *  `"any"` is the full-wild marker; an array enumerates a finite OR-set
   *  (future partial wilds, e.g. rank [5, 10]). The ideology array element type
   *  is `Ideology` (the 4 real colors), NOT `CardIdeology` — a countsAs ideology
   *  override can never re-introduce the "wild" sentinel. */
  export interface CountsAs {
    rank?: Rank[] | "any";
    ideology?: Ideology[] | "any";
    kind?: RowKind[] | "any";
  }

  /** A full joker: counts as any rank, any ideology, either row. */
  export const FULL_JOKER: CountsAs = { rank: "any", ideology: "any", kind: "any" };
  ```

- [ ] Add the optional `countsAs` field to the `Card` interface. Edit the interface (`cards.ts:53-64`) to add the field after `flavor?: string;`:

  ```ts
  export interface Card {
    id: string;
    name: string;
    kind: CardKind;
    rank: Rank;
    ideology: CardIdeology;
    role?: Role;
    influenceCost: number;
    effect: EffectSpec;
    tags: CardTag[];
    flavor?: string;
    /** Optional evaluation modifiers (rank/ideology/row). Absent ⇒ counts as
     *  exactly its literal rank/ideology/kind. A full joker carries FULL_JOKER.
     *  Wildness is keyed on `countsAs !== undefined`, NEVER on ideology === "wild". */
    countsAs?: CountsAs;
  }
  ```

- [ ] Add the two boot asserts immediately after `ALL_CARDS` is declared (`cards.ts:338`). The first pins `RANKS` to the distinct live-card rank set (excluding `dissent`, `legacy`, **and** `charter` — the dead kind still present in this phase). The second forbids a bare `ideology: "wild"` on any playable card without `countsAs`, except `dissent`-kind cards:

  ```ts
  // -------------------------------------------------------------------------
  // Boot-time data asserts (run once at module load over ALL_CARDS).
  // -------------------------------------------------------------------------

  // RANKS must equal the distinct rank set across live evaluable cards. We
  // exclude dissent + legacy (never evaluated) and charter (a dead kind being
  // removed — its rank 15 is not part of the live domain). After charters are
  // deleted this exclusion is a no-op, so the assert stays correct unchanged.
  {
    const NON_EVALUABLE: ReadonlySet<CardKind> = new Set(["dissent", "legacy", "charter"]);
    const live = new Set<Rank>(
      ALL_CARDS.filter((c) => !NON_EVALUABLE.has(c.kind)).map((c) => c.rank),
    );
    const expected = new Set<Rank>(RANKS);
    const missing = [...expected].filter((r) => !live.has(r));
    const extra = [...live].filter((r) => !expected.has(r));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `RANKS mismatch with live card ranks: missing ${JSON.stringify(missing)}, ` +
          `extra ${JSON.stringify(extra)}.`,
      );
    }
  }

  // A bare `ideology: "wild"` on a PLAYABLE card with no `countsAs` is a data
  // error (it would block every flush and is not a joker). The only legal
  // bare-"wild" shape is a dissent-kind card (the unplayable deck clog).
  for (const c of ALL_CARDS) {
    if (c.ideology === "wild" && c.countsAs === undefined && c.kind !== "dissent") {
      throw new Error(
        `Data error: playable card "${c.id}" has ideology:"wild" without countsAs. ` +
          `Wildness must be expressed via countsAs (e.g. FULL_JOKER), never a bare "wild".`,
      );
    }
  }
  ```

  > **NOTE:** The charter cards at `cards.ts:281,292` (`keystone-pioneer`, `keystone-apostle`) currently carry `ideology: "wild"` with `kind: "charter"` and **no** `countsAs`. The second assert excludes only `dissent`-kind, so these two charters would trip it. **In this same edit**, give those two charters a `countsAs: FULL_JOKER` so the assert passes while they stay `kind: "charter"`. This is forward-compatible (P2 recolors them to concrete-home FULL_JOKER cards) and additive (no evaluator reads `countsAs` yet). Apply both edits below.

- [ ] Add `countsAs: FULL_JOKER` to `keystone-pioneer` (the `ideology: "wild"` charter at `cards.ts:277-286`). Insert the field after `tags,`:

  ```ts
    {
      id: "keystone-pioneer",
      name: "The Pioneer",
      kind: "charter",
      rank: 15,
      ideology: "wild",
      influenceCost: 3,
      effect: draw(2),
      tags,
      countsAs: FULL_JOKER,
      flavor: "Wild role, wild suit. No Dissent.",
    },
  ```

- [ ] Add `countsAs: FULL_JOKER` to `keystone-apostle` (the `ideology: "wild"` charter at `cards.ts:287-297`). Insert the field after `tags,`:

  ```ts
    {
      id: "keystone-apostle",
      name: "The Apostle",
      kind: "charter",
      rank: 15,
      ideology: "wild",
      influenceCost: 2,
      effect: compound(gainInf(2), addDissent(1)),
      tags,
      countsAs: FULL_JOKER,
      flavor: "Wild role, wild suit. Stirs Dissent.",
    },
  ```

- [ ] Run typecheck + the full suite to confirm the asserts pass at boot and nothing regressed (no evaluator reads `countsAs` yet):

  ```
  bun run typecheck
  ```
  Expected: no output / exit 0 (no errors).

  ```
  bun test
  ```
  Expected: all suites pass, `0 fail`. (If either boot assert throws, the failure surfaces at import time across every suite that imports `cards.ts` — so a green run confirms both asserts hold.)

- [ ] Commit:

  ```
  git add src/core/data/cards.ts
  git commit -m "feat(core): add countsAs/RowKind/RANKS/FULL_JOKER scaffolding + boot asserts"
  ```

---

### Task 2: Write `tests/countsAs.test.ts` (failing — resolver missing), then implement `src/core/engine/countsAs.ts`

TDD the pure resolver. The test asserts the full contract from spec §3.2 (`EffectiveCard` shape + predicates) and the data-error guard from §3.2's red-team note. Write it first against a not-yet-existing module so it fails on a missing import; then implement the resolver to green.

**Files:**
- Create `/Users/elliott/Projects/space-game-demo/tests/countsAs.test.ts`
- Create `/Users/elliott/Projects/space-game-demo/src/core/engine/countsAs.ts`

**Steps:**

- [ ] Write the failing test file `tests/countsAs.test.ts`. It imports the (missing) resolver and pins: literal card ⇒ single-element sets, `isWild=false`, `ideologyWild=false`; `FULL_JOKER` ⇒ full `RANKS`/`IDEOLOGIES`/both rows, `isWild`+`ideologyWild`=true; partial `{rank:[5,10]}` ⇒ `ranks=[5,10]`, `isWild=true`, `ideologyWild=false`; a `dissent`-kind bare-`"wild"` card ⇒ `ideologies=[]`, `isWild=false`, not a joker; `RANKS` excludes 15; predicates; and the boot guard rejecting a bare-`"wild"` playable card:

  ```ts
  import { describe, test, expect } from "bun:test";
  import {
    effectiveCard,
    canCountAsRank,
    canCountAsIdeology,
    canOccupyRow,
    isWildCard,
    ALL_ROWS,
  } from "../src/core/engine/countsAs.ts";
  import {
    type Card,
    FULL_JOKER,
    RANKS,
    getCard,
    landId,
    makeDissent,
  } from "../src/core/data/cards.ts";
  import { IDEOLOGIES } from "../src/core/data/ideologies.ts";

  describe("effectiveCard — literal (no countsAs)", () => {
    const card = getCard(landId(5, "solidarity"));
    const eff = effectiveCard(card);

    test("rank collapses to a single-element set", () => {
      expect([...eff.ranks]).toEqual([5]);
    });
    test("ideology collapses to a single-element set of the literal color", () => {
      expect([...eff.ideologies]).toEqual(["solidarity"]);
    });
    test("rows collapses to the literal home row", () => {
      expect([...eff.rows]).toEqual(["land"]);
    });
    test("is not wild and not ideologyWild", () => {
      expect(eff.isWild).toBe(false);
      expect(eff.ideologyWild).toBe(false);
    });
  });

  describe("effectiveCard — FULL_JOKER", () => {
    const card: Card = { ...getCard(landId(5, "solidarity")), countsAs: FULL_JOKER };
    const eff = effectiveCard(card);

    test("ranks expand to the full live RANKS domain", () => {
      expect([...eff.ranks].sort((a, b) => a - b)).toEqual([...RANKS].sort((a, b) => a - b));
    });
    test("ideologies expand to all 4 real ideologies (never 'wild')", () => {
      expect([...eff.ideologies].sort()).toEqual([...IDEOLOGIES].sort());
      expect(eff.ideologies).not.toContain("wild");
    });
    test("rows expand to both playable rows", () => {
      expect([...eff.rows].sort()).toEqual([...ALL_ROWS].sort());
    });
    test("is wild and ideologyWild", () => {
      expect(eff.isWild).toBe(true);
      expect(eff.ideologyWild).toBe(true);
    });
  });

  describe("effectiveCard — partial rank wild {rank:[5,10]}", () => {
    const card: Card = { ...getCard(landId(5, "solidarity")), countsAs: { rank: [5, 10] } };
    const eff = effectiveCard(card);

    test("ranks expand to the explicit OR-set", () => {
      expect([...eff.ranks].sort((a, b) => a - b)).toEqual([5, 10]);
    });
    test("is structurally wild (carries a modifier)", () => {
      expect(eff.isWild).toBe(true);
    });
    test("but NOT ideologyWild — its color is a real literal", () => {
      expect(eff.ideologyWild).toBe(false);
      expect([...eff.ideologies]).toEqual(["solidarity"]);
    });
  });

  describe("effectiveCard — dissent (bare 'wild', no countsAs)", () => {
    const card = makeDissent();
    const eff = effectiveCard(card);

    test("ideologies is the EMPTY set (colorless, blocks flush)", () => {
      expect([...eff.ideologies]).toEqual([]);
    });
    test("is NOT a joker (no countsAs) and NOT ideologyWild", () => {
      expect(eff.isWild).toBe(false);
      expect(eff.ideologyWild).toBe(false);
      expect(isWildCard(card)).toBe(false);
    });
    test("ranks still collapse to its literal rank", () => {
      expect([...eff.ranks]).toEqual([card.rank]);
    });
  });

  describe("RANKS domain", () => {
    test("excludes 15 (the deleted charter rank)", () => {
      expect(RANKS).not.toContain(15);
      expect([...RANKS].sort((a, b) => a - b)).toEqual([
        2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
      ]);
    });
  });

  describe("predicates", () => {
    const joker: Card = { ...getCard(landId(5, "solidarity")), countsAs: FULL_JOKER };
    const land = getCard(landId(5, "solidarity"));

    test("canCountAsRank", () => {
      expect(canCountAsRank(joker, 14)).toBe(true);
      expect(canCountAsRank(land, 14)).toBe(false);
      expect(canCountAsRank(land, 5)).toBe(true);
    });
    test("canCountAsIdeology", () => {
      expect(canCountAsIdeology(joker, "heritage")).toBe(true);
      expect(canCountAsIdeology(land, "heritage")).toBe(false);
      expect(canCountAsIdeology(land, "solidarity")).toBe(true);
    });
    test("canOccupyRow", () => {
      expect(canOccupyRow(joker, "land")).toBe(true);
      expect(canOccupyRow(joker, "role")).toBe(true);
      expect(canOccupyRow(land, "land")).toBe(true);
      expect(canOccupyRow(land, "role")).toBe(false);
    });
    test("isWildCard keys on countsAs presence", () => {
      expect(isWildCard(joker)).toBe(true);
      expect(isWildCard(land)).toBe(false);
    });
  });

  describe("data-error boot guard (documented in cards.ts)", () => {
    test("a bare-'wild' playable card (no countsAs, not dissent) is rejected at module load", () => {
      // The guard lives in data/cards.ts and runs over ALL_CARDS at import time.
      // We assert it would throw for a hand-built offending card by re-running
      // the same predicate the guard uses.
      const offending: Card = {
        ...getCard(landId(5, "solidarity")),
        id: "bad-wild",
        ideology: "wild",
      };
      const isDataError =
        offending.ideology === "wild" &&
        offending.countsAs === undefined &&
        offending.kind !== "dissent";
      expect(isDataError).toBe(true);
      // Its resolver result is colorless-non-wild (the conservative failure).
      const eff = effectiveCard(offending);
      expect([...eff.ideologies]).toEqual([]);
      expect(eff.isWild).toBe(false);
    });
  });
  ```

- [ ] Run the new test and confirm it FAILS on the missing resolver module:

  ```
  bun test tests/countsAs.test.ts
  ```
  Expected: failure — `error: Cannot find module '../src/core/engine/countsAs.ts'` (the file does not exist yet), so the suite errors before running any assertion.

- [ ] Implement the resolver `src/core/engine/countsAs.ts` exactly per spec §3.2:

  ```ts
  // src/core/engine/countsAs.ts
  // The SOLE place card wildness is interpreted. Pure core: no Vue, no facade
  // import. Expands a stored Card into the option-sets it may assume for
  // EVALUATION (pattern, flush, row placement, promotion-detection), plus thin
  // predicates the evaluators call. Cost & effect are NEVER read here.

  import type { Card, Ideology, Rank, RowKind } from "../data/cards.ts";
  import { IDEOLOGIES, RANKS } from "../data/cards.ts";

  export const ALL_ROWS: readonly RowKind[] = ["land", "role"];

  /** The fully-expanded set of (rank, ideology, row) values a card MAY count as
   *  for evaluation. A literal dimension collapses to a single-element set;
   *  "any" expands to the full domain; an array expands to itself.
   *
   *  `ideologies` is `readonly Ideology[]` and NEVER contains the "wild"
   *  sentinel: a real-color literal ⇒ [that color]; a "wild" literal with no
   *  override (Dissent / data error) ⇒ []; "any" ⇒ all 4 IDEOLOGIES; an array
   *  ⇒ itself. Consumers may rely on every element being a real color. */
  export interface EffectiveCard {
    card: Card;
    ranks: readonly Rank[]; // always non-empty (>= 1)
    ideologies: readonly Ideology[]; // bare-"wild"-without-countsAs ⇒ []
    rows: readonly RowKind[];
    isWild: boolean; // card.countsAs !== undefined (structural)
    /** True iff the ideology dimension is INDETERMINATE — "any" or a literal
     *  "wild" override. Drives the deriveVector skip; a rank-only partial with a
     *  real literal color has ideologyWild=false and is NOT skipped. */
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
    // (Dissent, or a data error) counts as NOTHING for flush. The === "wild"
    // narrow guarantees TS sees `Ideology` in the single-element branch.
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
  export const canOccupyRow = (c: Card, row: RowKind): boolean =>
    effectiveCard(c).rows.includes(row);
  export const isWildCard = (c: Card): boolean => c.countsAs !== undefined;
  ```

  > **Typecheck guard (spec §3.2 / red-team #16):** `expandIdeology` relies on the `card.ideology === "wild"` narrow so TS infers `Ideology` (not `CardIdeology`) in the `[card.ideology]` branch, keeping `EffectiveCard.ideologies` typed `readonly Ideology[]`. Confirm with `bun run typecheck` (next step) — if TS complains the array is `CardIdeology[]`, the narrow is the fix, not a cast.

- [ ] Re-run the test to GREEN:

  ```
  bun test tests/countsAs.test.ts
  ```
  Expected: all `describe` blocks pass, `0 fail`.

- [ ] Run typecheck to confirm the `Ideology` narrow holds and nothing else broke:

  ```
  bun run typecheck
  ```
  Expected: no output / exit 0.

- [ ] Commit:

  ```
  git add src/core/engine/countsAs.ts tests/countsAs.test.ts
  git commit -m "feat(core): add pure countsAs resolver (effectiveCard + predicates) with tests"
  ```

---

### Task 3: Add `fullJoker()` fixture to `tests/fixtures.ts`

A reusable test fixture that wraps any base card with `countsAs: FULL_JOKER`, for the wild-aware evaluator tests in P1/P2. Additive; no production change.

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/tests/fixtures.ts`

**Steps:**

- [ ] Add the `fullJoker()` fixture. Append imports + the helper to `tests/fixtures.ts` (the file currently imports only ideology/policy types — add the card imports at the top, after the existing imports on lines 3-6, and the helper after `emptyPolicyState`):

  ```ts
  import type { Card } from "../src/core/data/cards.ts";
  import { FULL_JOKER, getCard, landId } from "../src/core/data/cards.ts";

  /** A full-joker card for evaluator tests: any rank, any ideology, either row.
   *  Wraps a base card (default: a real land) so it keeps a valid literal
   *  identity (id/cost/effect) while `countsAs: FULL_JOKER` overrides every
   *  evaluation dimension. Pass `id` to disambiguate multiple jokers in one row.
   */
  export function fullJoker(id?: string): Card {
    const base = getCard(landId(5, "solidarity"));
    return {
      ...base,
      id: id ?? `joker-${Math.random().toString(36).slice(2, 8)}`,
      countsAs: FULL_JOKER,
    };
  }
  ```

  > Place the two new `import` lines with the other top-of-file imports (after line 6) so all imports stay grouped; place the `fullJoker` function after the closing brace of `emptyPolicyState` (line 18).

- [ ] Run the full suite to confirm the fixture file still compiles and imports cleanly (it is consumed in later phases, but must not break the current suite):

  ```
  bun test
  ```
  Expected: all suites pass, `0 fail`.

  ```
  bun run typecheck
  ```
  Expected: no output / exit 0.

- [ ] Commit:

  ```
  git add tests/fixtures.ts
  git commit -m "test(core): add fullJoker() fixture for wild-aware evaluator tests"
  ```

---

### Task 4: Re-export `CountsAs`/`RowKind`/`EffectiveCard` from the `types.ts` barrel

Make the new types grabbable from the barrel like every other public type. `CharterRow` stays in the barrel for now (removed in P2). Additive.

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/types.ts`

**Steps:**

- [ ] Add `CountsAs` and `RowKind` to the `data/cards.ts` type re-export block (`types.ts:5-14`), and add a new re-export line for `EffectiveCard` from the resolver. Edit the cards type block to include the two new names:

  ```ts
  export type {
    Card,
    CardIdeology,
    CardKind,
    CardTag,
    CountsAs,
    EffectSpec,
    Rank,
    Role,
    RowKind,
    Timing,
  } from "./data/cards.ts";
  export { FULL_JOKER, RANKS, ROLE_RANK } from "./data/cards.ts";
  ```

  > This also promotes the existing `export { ROLE_RANK }` line (`types.ts:15`) to additionally export the runtime values `FULL_JOKER` and `RANKS` so consumers can grab them from the barrel.

- [ ] Add the `EffectiveCard` type re-export. Insert after the `DiscardSource, GameEvent` line (`types.ts:34`):

  ```ts
  export type { EffectiveCard } from "./engine/countsAs.ts";
  ```

  > `CharterRow` stays in the `column.ts` re-export (`types.ts:32`) — it is removed in the atomic P2 charter-removal phase, not here.

- [ ] Run typecheck + full suite to confirm the barrel re-exports resolve and nothing regressed:

  ```
  bun run typecheck
  ```
  Expected: no output / exit 0.

  ```
  bun test
  ```
  Expected: all suites pass, `0 fail`.

- [ ] Commit:

  ```
  git add src/core/types.ts
  git commit -m "feat(core): re-export CountsAs/RowKind/EffectiveCard + RANKS/FULL_JOKER from types barrel"
  ```

---

**End of P0.** At this point the wildness model exists in pure core (`effectiveCard` + predicates), `Card.countsAs` is authorable, `RANKS`/`FULL_JOKER` are exported, and the two boot asserts guard the data — all additive, every pre-existing test green, no evaluator consuming `countsAs` yet. The two `ideology: "wild"` charters carry `countsAs: FULL_JOKER` so the data-error assert passes while they remain `kind: "charter"` (P2 recolors them). P1 will teach `rowHands`/`columnPatterns`/`ideology` to resolve through `effectiveCard`, driven by the `fullJoker()` fixture added here.


---

## Phase P1 — Make pattern/ideology evaluators wild-aware (incremental, charter still present)

**Not atomic.** Three independent consumers (`rowHands`, `columnPatterns`, `ideology`) each land as their own red→green→commit. This phase depends on **P0** (which has already shipped: `effectiveCard`/`EffectiveCard`/`FULL_JOKER`/`RANKS` in core, the boot asserts, and the `fullJoker()` card fixture in `tests/fixtures.ts`).

**Critical green-at-each-commit invariants for this phase:**
- The Charter row/kind **still exists** here (it is deleted in P2). `placeCharter`, `getCard("keystone-founding-charter")`, `kind:"charter"`, and `isBuildable`-requires-charter are all still live. Every column built in a `columnPatterns` test MUST still call `placeCharter(...)` or `evaluateColumn` returns `null`.
- The six ex-charter cards are **still `kind:"charter"`, not yet wild** (no `countsAs`). So P1's wild logic is dormant in production — only the explicit `fullJoker()` fixtures exercise it. All pre-existing assertions stay green because non-wild inputs keep their exact current classification.
- `getCard(id)` returns a **shared reference** from `CARD_BY_ID`. Reusing the same object in a multiset is fine for classification (the evaluators read `.rank`/`.ideology`/`.countsAs`, never identity). The `fullJoker()` fixture is a **factory** returning a fresh card each call, so multiple wilds in one row are distinct objects.
- `fullJoker()` (from P0, in `tests/fixtures.ts`) returns a `Card` carrying `countsAs: FULL_JOKER` and a concrete literal color. To make a **partial** wild in a test, spread a real card and attach a `countsAs`: `{ ...getCard(landId(5,"solidarity")), countsAs: { rank: [5, 10] } }`.

---

### Task 5: Make `identifyRowHand` best-achievable under wilds + route `canCommitHand` through `canOccupyRow`

The row classifier learns to let a wild stand in for the best rank, and `canCommitHand` stops gating on the literal `card.kind`, consulting `canOccupyRow` instead so a full joker is committable into either row while an ordinary land stays land-only. Non-wild inputs keep their exact current classification, so every pre-existing `rowHands.test.ts` assertion stays green.

**Files:**
- Modify: `tests/rowHands.test.ts` (failing tests first)
- Modify: `src/core/engine/rowHands.ts` (`identifyRowHand` rewrite at lines 18-47; `canCommitHand` line 53-63, swap `c.kind !== requiredKind` at line 56)

**Steps:**

- [ ] **Add the wild import + fixture import to `tests/rowHands.test.ts`.** At the top, alongside the existing imports, add:
  ```ts
  import { fullJoker } from "./fixtures.ts";
  import { landId } from "../src/core/data/cards.ts";
  ```
  (The existing imports `identifyRowHand, validateRowHand, canCommitHand`, `ALL_CARDS, type Card`, and `createEmptyColumn, placeLand` stay.)

- [ ] **Write the failing wild row-hand tests.** Append a new `describe` block to `tests/rowHands.test.ts` (after the existing `identifyRowHand` block, before `validateRowHand`):
  ```ts
  describe("identifyRowHand — wilds (counts-as) complete shapes", () => {
    const lands = landsPool();
    const landOf = (rank: number): Card => {
      const c = lands.find((x) => x.rank === rank);
      if (!c) throw new Error(`no land of rank ${rank}`);
      return c;
    };

    it("a lone wild is high-card", () => {
      expect(identifyRowHand([fullJoker()])).toBe("high-card");
    });

    it("a single wild onto [5,5] makes three-of-a-kind", () => {
      expect(identifyRowHand([landOf(5), landOf(5), fullJoker()])).toBe("three-of-a-kind");
    });

    it("[3,4,6,7] + wild fills the gap to a straight", () => {
      const hand = [landOf(3), landOf(4), landOf(6), landOf(7), fullJoker()];
      expect(identifyRowHand(hand)).toBe("straight");
    });

    it("[3,3,5,6] + wild cannot straight (duplicate fixed rank) — falls back to trips", () => {
      // counts: rank 3 ×2; a wild joins the 3s → three-of-a-kind, never a straight.
      const hand = [landOf(3), landOf(3), landOf(5), landOf(6), fullJoker()];
      expect(identifyRowHand(hand)).toBe("three-of-a-kind");
    });

    it("[5,5,5] + 2 wilds is full-house (g0=3, g1=0 ⇒ 0+2=2 ≤ 2)", () => {
      const hand = [landOf(5), landOf(5), landOf(5), fullJoker(), fullJoker()];
      expect(identifyRowHand(hand)).toBe("full-house");
    });

    it("[5,5] + 3 wilds is full-house (g0=2, g1=0 ⇒ 1+2=3 ≤ 3)", () => {
      const hand = [landOf(5), landOf(5), fullJoker(), fullJoker(), fullJoker()];
      expect(identifyRowHand(hand)).toBe("full-house");
    });

    it("[5,5,9,9] + wild is full-house (g0=2, g1=2 ⇒ wild completes the trips)", () => {
      const hand = [landOf(5), landOf(5), landOf(9), landOf(9), fullJoker()];
      expect(identifyRowHand(hand)).toBe("full-house");
    });

    it("all-wild w=5 is full-house (g0=g1=0 ⇒ 3+2=5 ≤ 5)", () => {
      const hand = [fullJoker(), fullJoker(), fullJoker(), fullJoker(), fullJoker()];
      expect(identifyRowHand(hand)).toBe("full-house");
    });

    it("wild + two distinct fixed ranks (n=3) is null (no pair/trips reachable)", () => {
      // g0=1, w=1 ⇒ maxSame=2 < 3 for trips; n=3 has no two-pair/pair classification → null.
      const hand = [landOf(4), landOf(6), fullJoker()];
      expect(identifyRowHand(hand)).toBeNull();
    });

    it("a joker cannot form a straight using rank 15 (charter rank excluded from RANKS)", () => {
      // [11,12,13,14] are role-band ranks; a wild could only complete with rank 10 or 15.
      // 15 is not in RANKS, so the only straight is [10,11,12,13,14] via the wild as 10.
      // Build it on the role pool to prove the wild fills 10, never 15.
      const roles = ALL_CARDS.filter((x) => x.kind === "role");
      const roleOf = (rank: number): Card => {
        const c = roles.find((x) => x.rank === rank);
        if (!c) throw new Error(`no role of rank ${rank}`);
        return c;
      };
      const hand = [roleOf(11), roleOf(12), roleOf(13), roleOf(14), fullJoker()];
      // window [10..14] (wild=10) succeeds; [11..15] is impossible (15 ∉ RANKS).
      expect(identifyRowHand(hand)).toBe("straight");
    });
  });

  describe("canCommitHand — row eligibility via canOccupyRow", () => {
    it("a full joker is committable into the influence row", () => {
      const col = createEmptyColumn();
      placeLand(col, landsPool()[0]); // unlock the influence row
      expect(canCommitHand(col, "influence", [fullJoker()])).toBe(true);
    });

    it("a plain land is rejected from the influence row", () => {
      const col = createEmptyColumn();
      placeLand(col, landsPool()[0]);
      const land = landsPool()[1];
      expect(canCommitHand(col, "influence", [land])).toBe(false);
    });
  });
  ```

- [ ] **Run the new tests — expect failure** (the current `identifyRowHand` ignores `countsAs` entirely, and `canCommitHand` gates on `c.kind`):
  ```
  bun test tests/rowHands.test.ts
  ```
  Expected: the new `wilds (counts-as)` and `row eligibility` cases fail — e.g. `a lone wild is high-card` passes (n===1 already returns high-card), but `a single wild onto [5,5]` returns `null` (wild's rank 14 ≠ 5, three distinct ranks), `[3,4,6,7] + wild` returns `null`, all full-house-via-wild cases return `null`, and `a full joker is committable into the influence row` fails because the joker's literal `kind` is not `"role"`. Pre-existing `identifyRowHand`/`validateRowHand`/`canCommitHand` cases still pass.

- [ ] **Rewrite `identifyRowHand` (and helpers) in `src/core/engine/rowHands.ts`.** Replace lines 18-47 (the `identifyRowHand` body, `rankCounts`, and `isStraight`) with a best-achievable classifier over `effectiveCard`. Add the import at the top:
  ```ts
  import { effectiveCard } from "./countsAs.ts";
  import { RANKS } from "../data/cards.ts";
  ```
  Then:
  ```ts
  export function identifyRowHand(cards: Card[]): RowHand | null {
    const n = cards.length;
    if (n === 0) return null;
    if (n === 1) return "high-card";

    const eff = cards.map(effectiveCard);
    const wilds = eff.filter((e) => e.isWild);
    const w = wilds.length;
    // Fixed cards contribute exactly one concrete rank each (shipped model).
    const fixedRanks = eff.filter((e) => !e.isWild).map((e) => e.ranks[0]);

    // Distinct-rank group sizes over the fixed cards, descending.
    const counts = new Map<number, number>();
    for (const r of fixedRanks) counts.set(r, (counts.get(r) ?? 0) + 1);
    const groups = [...counts.values()].sort((a, b) => b - a);
    const g0 = groups[0] ?? 0;
    const g1 = groups[1] ?? 0;
    const maxSame = Math.min(n, g0 + w);

    // Highest-first, mirroring the existing precedence.
    if (n === 5 && canFormStraight(fixedRanks, w)) return "straight";
    if (n === 4 && maxSame >= 4) return "four-of-a-kind";
    if (n === 5 && Math.max(0, 3 - g0) + Math.max(0, 2 - g1) <= w) return "full-house";
    if (n === 3 && maxSame >= 3) return "three-of-a-kind";
    if (n === 4 && Math.max(0, 2 - g0) + Math.max(0, 2 - g1) <= w) return "two-pair";
    if (n === 2 && maxSame >= 2) return "pair";
    if (n === 1) return "high-card";
    return null;
  }

  /** True iff some length-5 consecutive window drawn from RANKS contains every
   *  fixed rank and the wilds can fill the remaining slots. Windows scan lo such
   *  that the whole [lo..lo+4] lies in [2..14] (lo ∈ [2..10]); rank 15 is never
   *  in RANKS so phantom top-end straights cannot be certified. Duplicate fixed
   *  ranks kill the straight. */
  function canFormStraight(fixedRanks: number[], w: number): boolean {
    if (fixedRanks.length + w !== 5) return false;
    const distinct = new Set(fixedRanks);
    if (distinct.size !== fixedRanks.length) return false; // duplicate ⇒ no straight
    const minRank = RANKS[0];
    const maxRank = RANKS[RANKS.length - 1];
    for (let lo = minRank; lo + 4 <= maxRank; lo++) {
      const window = new Set([lo, lo + 1, lo + 2, lo + 3, lo + 4]);
      const allInside = fixedRanks.every((r) => window.has(r));
      if (allInside && w >= 5 - distinct.size) return true;
    }
    return false;
  }
  ```
  Note: `RANKS = [2..14]`, so `minRank = 2`, `maxRank = 14`, and `lo` runs `2..10` — exactly the spec window. Keep the `RowHand` type export and `validateRowHand` unchanged.

- [ ] **Swap `canCommitHand`'s kind gate to `canOccupyRow`.** In `src/core/engine/rowHands.ts`, replace lines 55-56:
  ```ts
    const requiredKind = row === "land" ? "land" : "role";
    if (newCards.some((c) => c.kind !== requiredKind)) return false;
  ```
  with:
  ```ts
    const requiredRow: RowKind = row === "land" ? "land" : "role";
    if (newCards.some((c) => !canOccupyRow(c, requiredRow))) return false;
  ```
  and extend the import line to bring in `canOccupyRow` and the `RowKind` type:
  ```ts
  import { canOccupyRow, effectiveCard } from "./countsAs.ts";
  import { RANKS, type RowKind } from "../data/cards.ts";
  ```

- [ ] **Run the suite to green:**
  ```
  bun test tests/rowHands.test.ts
  ```
  Expected: `0 fail`, all `identifyRowHand` (original + wild), `validateRowHand`, and `canCommitHand` (original + eligibility) cases pass.

- [ ] **Run the full suite + typecheck** to confirm no regression in other consumers (`columnPatterns`, `commands`, smoke all call `identifyRowHand`/`canCommitHand`):
  ```
  bun test && bun run typecheck
  ```
  Expected: `0 fail` across all files; `tsc --noEmit` exits 0.

- [ ] **Commit:**
  ```
  git add src/core/engine/rowHands.ts tests/rowHands.test.ts
  git commit -m "feat(core): best-achievable row-hand classification under counts-as wilds"
  ```

---

### Task 6: Invert the flush to a set-theoretic intersection (wilds complete, empty-set blocks)

`sharesOneIdeology` flips from "any wild ⇒ no flush" to "a flush exists iff some single color is admitted by every card's `effectiveCard().ideologies` option-set." A full joker contributes the 4-color universe (never narrows); a partial ideology wild narrows to its OR-set (no `isWild` escape hatch); a colorless non-wild (Dissent / data error) contributes the empty set and **blocks**. The land/role rows already classify via the now-wild-aware `identifyRowHand`, so straight-flush/royal/cross-row-full-house all fire when a single joker is simultaneously the right rank and the right color.

**Files:**
- Modify: `tests/columnPatterns.test.ts` (failing tests first; charter scaffolding stays — P2 removes it)
- Modify: `src/core/engine/columnPatterns.ts` (`sharesOneIdeology` lines 85-91; independence comment at `resolveColumnPattern` line 29)

**Steps:**

- [ ] **Add the wild fixture + helpers imports to `tests/columnPatterns.test.ts`.** Alongside the existing imports add:
  ```ts
  import { fullJoker } from "./fixtures.ts";
  import { makeDissent } from "../src/core/data/cards.ts";
  ```
  Keep the existing `placeCharter` import and `charter()` helper — **the charter row is still required for `isBuildable` in P1.** Every column in these new tests must still `placeCharter(col, charter())`, and the charter (`keystone-founding-charter`) is **solidarity**, so it does not block a solidarity flush but **does** narrow a non-solidarity flush. Choose the charter color deliberately per case.

- [ ] **Write the failing wild flush/pattern tests.** Append to `tests/columnPatterns.test.ts` inside the `describe("evaluateColumn", …)` block (or a new `describe` after it):
  ```ts
  describe("evaluateColumn — wilds (counts-as) complete column shapes", () => {
    test("3 solidarity + 1 wild ⇒ flush (wild completes the color)", () => {
      // lands: 3 solidarity (rank 7) — trips; one solidarity role; one wild in
      // the influence row; solidarity charter. Every non-wild is solidarity, the
      // wild admits all colors ⇒ intersection = {solidarity} ⇒ flush.
      const col = createEmptyColumn();
      for (let i = 0; i < 3; i++) placeLand(col, land(7, "solidarity"));
      placeInfluence(col, role("scholar", "solidarity"));
      placeInfluence(col, fullJoker());
      placeCharter(col, charter()); // solidarity
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("flush");
    });

    test("2 full jokers ⇒ flush (intended ladder result, Red-team #7)", () => {
      // one wild land-row, one wild influence-row; charter solidarity. Each row
      // classifies high-card; intersection of {all4, all4, solidarity} = {solidarity}.
      const col = createEmptyColumn();
      placeLand(col, fullJoker());
      placeInfluence(col, fullJoker());
      placeCharter(col, charter()); // solidarity
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("flush");
    });

    test("straight-flush via one wild that is both the 9 AND a solidarity", () => {
      // lands 5,6,7,8 solidarity + 1 wild ⇒ land-row straight (wild=9) AND, with
      // a solidarity role + solidarity charter, a column flush. The single joker
      // satisfies the rank fact (9) and the color fact (solidarity) at once.
      const col = createEmptyColumn();
      for (const r of [5, 6, 7, 8]) placeLand(col, land(r, "solidarity"));
      placeLand(col, fullJoker());
      placeInfluence(col, role("scholar", "solidarity"));
      placeCharter(col, charter()); // solidarity
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("straight-flush");
    });

    test("royal-flush via a wild filling a role-row gap", () => {
      // role row: agitator(10), scholar(11), preacher(12), engineer(13) solidarity
      // + 1 wild ⇒ role-row straight (wild=14) AND flush ⇒ royal-flush.
      const col = createEmptyColumn();
      placeLand(col, land(7, "solidarity"));
      for (const r of ["agitator", "scholar", "preacher", "engineer"] as const) {
        placeInfluence(col, role(r, "solidarity"));
      }
      placeInfluence(col, fullJoker());
      placeCharter(col, charter()); // solidarity
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("royal-flush");
    });

    test("partial ideology wild {ideology:[sol,her]} narrows the flush correctly (no isWild escape hatch)", () => {
      // lands: 2 heritage (pair). The partial wild admits {sol,her}. Charter is
      // solidarity. Intersection over {heritage, heritage, {sol,her}, solidarity-role?, solidarity-charter}.
      // Make the role + charter solidarity and the lands heritage ⇒ intersection
      // is EMPTY (heritage ∩ solidarity = ∅) ⇒ NO flush ⇒ falls to pair.
      const partialWild: Card = {
        ...getCard(landId(7, "heritage")),
        countsAs: { ideology: ["solidarity", "heritage"] },
      };
      const col = createEmptyColumn();
      placeLand(col, land(7, "heritage"));
      placeLand(col, land(7, "heritage"));
      placeInfluence(col, role("scholar", "solidarity"));
      placeInfluence(col, partialWild);
      placeCharter(col, charter()); // solidarity
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("pair"); // partial wild cannot bridge heritage↔solidarity
    });

    test("a stray Dissent in the column blocks the flush (empty option-set)", () => {
      // 3 solidarity lands + solidarity role + a Dissent in the influence row +
      // solidarity charter. Dissent's ideologies = [] ⇒ blocks ⇒ trips, not flush.
      const col = createEmptyColumn();
      for (let i = 0; i < 3; i++) placeLand(col, land(7, "solidarity"));
      placeInfluence(col, role("scholar", "solidarity"));
      placeInfluence(col, makeDissent());
      placeCharter(col, charter()); // solidarity
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("three-of-a-kind");
    });

    test("cross-row full-house: land [5,5]+wild ⇒ trips, role pair ⇒ full-house", () => {
      // lands rank 5 ×2 + wild ⇒ three-of-a-kind; role row two same-role ⇒ pair.
      // Mixed colors so no flush outranks it. Charter heritage so it doesn't flush.
      const col = createEmptyColumn();
      placeLand(col, land(5, "solidarity"));
      placeLand(col, land(5, "heritage"));
      placeLand(col, fullJoker());
      placeInfluence(col, role("scholar", "solidarity"));
      placeInfluence(col, role("scholar", "sovereignty"));
      placeCharter(col, getCard("keystone-founding-charter")); // solidarity — mixed column, no flush
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("full-house");
    });

    test("cross-row full-house reversed: role [scholar,wild] ⇒ pair, land trips ⇒ full-house", () => {
      const col = createEmptyColumn();
      placeLand(col, land(7, "solidarity"));
      placeLand(col, land(7, "heritage"));
      placeLand(col, land(7, "sovereignty"));
      placeInfluence(col, role("scholar", "transformation"));
      placeInfluence(col, fullJoker());
      placeCharter(col, getCard("keystone-founding-charter"));
      const m = evaluateColumn(col, projects);
      expect(m?.kind).toBe("full-house");
    });
  });
  ```
  Also add `type Card` and `getCard, landId` to the existing import from `../src/core/data/cards.ts` if not already present (the partial-wild case needs them):
  ```ts
  import { getCard, landId, roleId, makeDissent, type Card } from "../src/core/data/cards.ts";
  ```

- [ ] **Run the new tests — expect failure** (the current `sharesOneIdeology` returns `false` the moment any wild is present, and the rows themselves don't yet read `countsAs` for the flush membership):
  ```
  bun test tests/columnPatterns.test.ts
  ```
  Expected: `3 solidarity + 1 wild ⇒ flush` fails (gets `three-of-a-kind`), `2 full jokers ⇒ flush` fails (gets `high-card`), `straight-flush`/`royal-flush` fail (get `straight`), `partial ideology wild … ⇒ pair` may pass or fail depending on the old code path — pin it anyway. Pre-existing `evaluateColumn` cases (incl. `a 'wild' charter or role is not treated as matching for flush`) **change meaning under the inverted flush** and may now fail; that legacy test asserted the OLD behavior. Note it in the next step.

- [ ] **Reconcile the legacy "wild charter is not matched for flush" test.** The pre-existing test at lines 104-113 (`a 'wild' charter or role is not treated as matching for flush`) places `keystone-pioneer`, which **still has bare `ideology:"wild"` and no `countsAs` in P1** (it becomes a `FULL_JOKER` only in P2). Under the inverted `sharesOneIdeology`, a bare-`"wild"` card has `ideologies = []` (empty set) and **blocks** the flush — so the column still resolves to `pair`, and **this test still passes unchanged**. Leave it as-is; add a one-line comment above it:
  ```ts
  // Still valid under the inverted flush: keystone-pioneer is bare "wild" with no
  // countsAs in P1 (effectiveCard ⇒ ideologies=[]), which BLOCKS the flush.
  ```

- [ ] **Invert `sharesOneIdeology` in `src/core/engine/columnPatterns.ts`.** Replace lines 85-91:
  ```ts
  function sharesOneIdeology(cards: Card[]): boolean {
    // "wild" cards never satisfy a flush.
    if (cards.some((c) => c.ideology === "wild")) return false;
    if (cards.length === 0) return false;
    const ideology = cards[0].ideology;
    return cards.every((c) => c.ideology === ideology);
  }
  ```
  with the set-theoretic intersection:
  ```ts
  function sharesOneIdeology(cards: Card[]): boolean {
    if (cards.length === 0) return false;
    // A flush exists iff the intersection over every card's admissible-color set
    // is non-empty. A full joker contributes all 4 colors (never narrows); a
    // partial ideology wild contributes its OR-set; a colorless non-wild
    // (bare-"wild" / Dissent) contributes the empty set, which BLOCKS. There is
    // NO isWild escape hatch — partial ideology wilds are honored set-theoretically.
    let inter: Set<Ideology> | null = null;
    for (const c of cards) {
      const colors = effectiveCard(c).ideologies;
      if (colors.length === 0) return false; // colorless, non-completing ⇒ no flush
      if (inter === null) inter = new Set(colors);
      else inter = new Set([...inter].filter((i) => colors.includes(i)));
      if (inter.size === 0) return false;
    }
    return (inter?.size ?? 0) > 0;
  }
  ```
  Add the imports at the top of the file:
  ```ts
  import { effectiveCard } from "./countsAs.ts";
  import type { Ideology } from "../data/cards.ts";
  ```

- [ ] **Add the independence-invariant comment at `resolveColumnPattern`.** Above the function declaration (line 29), add:
  ```ts
  // Independence invariant (full joker only): each wild's RANK and IDEOLOGY are
  // assigned independently — the row classifier picks the rank to maximize the
  // row-hand, sharesOneIdeology picks the color to complete a flush. Sound here
  // because rank ⊥ color for an unconstrained full joker (it can be "the 9" for a
  // straight AND "solidarity" for a flush at once), which is exactly why
  // straight-flush / royal-flush work. A FUTURE partial wild that constrains a
  // single wild on rank AND participates in a flush would need a joint solver.
  ```

- [ ] **Run the suite to green:**
  ```
  bun test tests/columnPatterns.test.ts
  ```
  Expected: `0 fail` — all pre-existing `evaluateColumn` cases plus the new `wilds (counts-as) complete column shapes` block pass.

- [ ] **Run the full suite + typecheck** (the inverted flush touches every column evaluation; confirm `commands`, `smoke`, `crisisflow` still pass since their non-wild columns reduce to the old "every non-wild shares one color" behavior):
  ```
  bun test && bun run typecheck
  ```
  Expected: `0 fail`; `tsc --noEmit` exits 0.

- [ ] **Commit:**
  ```
  git add src/core/engine/columnPatterns.ts tests/columnPatterns.test.ts
  git commit -m "feat(core): invert flush to set-theoretic intersection so wilds complete it"
  ```

---

### Task 7: Skip color-indeterminate cards in `deriveVector` + `unlockedIdeologyBreakdown` via `ideologyWild`

Identity must stay "what you literally, color-determinately played." The two `c.ideology === "wild"` skips in `deriveVector` and the one in `unlockedIdeologyBreakdown` become `effectiveCard(c).ideologyWild`, so full jokers and bare-`"wild"` cards are skipped, but a future rank-only partial with a real literal color is **kept**. Behavior is unchanged for every current card (none carry `countsAs` in production until P2), so all pre-existing `ideology.test.ts` assertions stay green.

**Files:**
- Modify: `tests/ideology.test.ts` (failing tests first)
- Modify: `src/core/engine/ideology.ts` (lines 60, 69 — the two `c.ideology === "wild"` skips)
- Modify: `src/core/data/projects.ts` (`unlockedIdeologyBreakdown` — the `c.ideology === "wild"` skip)

**Steps:**

- [ ] **Confirm the `unlockedIdeologyBreakdown` skip line.** Open `src/core/data/projects.ts` and locate `unlockedIdeologyBreakdown` (around lines 151-160). It iterates each unlock's `cards` and skips on `c.ideology === "wild"`. That is the line edited below. (Read it first so the exact `old_string` matches.)

- [ ] **Add fixture imports + write the failing tests in `tests/ideology.test.ts`.** Add to the imports:
  ```ts
  import { fullJoker } from "./fixtures.ts";
  import type { Card } from "../src/core/types.ts";
  ```
  Then append:
  ```ts
  describe("deriveVector — counts-as wilds skipped by ideologyWild", () => {
    test("a literal-color full joker in a column is skipped (contributes 0)", () => {
      const c = createEmptyColumn();
      placeLand(c, getCard(landId(3, "solidarity")));
      placeInfluence(c, fullJoker()); // FULL_JOKER carries a literal color but is ideologyWild
      const v = deriveVector([c], [], []);
      // Only the one solidarity land counts ⇒ axis1 = -1; the joker adds nothing.
      expect(v.axis1).toBe(-1);
      expect(v.axis2).toBe(0);
    });

    test("a rank-only partial wild with a REAL color is NOT skipped", () => {
      // countsAs.rank only ⇒ ideologyWild=false ⇒ its literal color (heritage) counts.
      const partial: Card = {
        ...getCard(landId(7, "heritage")),
        countsAs: { rank: [5, 10] },
      };
      const c = createEmptyColumn();
      placeLand(c, partial);
      const v = deriveVector([c], [], []);
      // heritage is axis2 sign -1 ⇒ axis2 = -1; rank-only wild keeps its color.
      expect(v.axis2).toBe(-1);
      expect(v.axis1).toBe(0);
    });

    test("an unlock of all full jokers contributes 0 to the vector", () => {
      const project: KeystoneProject = {
        id: "p-flush", pattern: "flush", name: "Flush", flavor: "", value: 4,
      };
      const unlock: ProjectUnlock = {
        projectId: "p-flush", pattern: "flush", turn: 1,
        cards: [fullJoker(), fullJoker(), fullJoker()],
      };
      const v = deriveVector([], [unlock], [project]);
      expect(v).toEqual({ axis1: 0, axis2: 0 });
    });
  });

  describe("unlockedIdeologyBreakdown — full jokers excluded", () => {
    test("an all-joker column contributes 0 to the breakdown", () => {
      const u: ProjectUnlock = {
        projectId: "x", pattern: "flush", turn: 1,
        cards: [fullJoker(), fullJoker(), fullJoker()],
      };
      const b = unlockedIdeologyBreakdown([u]);
      expect(b.solidarity).toBe(0);
      expect(b.sovereignty).toBe(0);
      expect(b.transformation).toBe(0);
      expect(b.heritage).toBe(0);
    });

    test("a partial rank-only wild with a real color IS counted", () => {
      const partial: Card = {
        ...getCard(landId(7, "heritage")),
        countsAs: { rank: [5, 10] },
      };
      const u: ProjectUnlock = {
        projectId: "y", pattern: "pair", turn: 1,
        cards: [getCard(landId(7, "solidarity")), partial],
      };
      const b = unlockedIdeologyBreakdown([u]);
      expect(b.solidarity).toBe(1);
      expect(b.heritage).toBe(1);
    });
  });
  ```
  Note: these `ProjectUnlock` literals do **not** carry `promotedIdeology` because that field is still **optional** in P1 (it becomes required only in P3). The P3 atomic task will add `promotedIdeology` to every literal across all suites — including these. Do **not** add it here.

- [ ] **Run the new tests — expect failure** (current code skips only the literal `"wild"` sentinel, but the full joker carries a literal real color, so it is **counted**, not skipped):
  ```
  bun test tests/ideology.test.ts
  ```
  Expected: `a literal-color full joker … contributes 0` fails (gets the joker's literal color added), `an unlock of all full jokers contributes 0` fails, and `an all-joker column contributes 0 to the breakdown` fails. The `rank-only partial … is NOT skipped` / `IS counted` cases pass (rank-only partials already carry a real `ideology`, currently counted). Pre-existing cases pass.

- [ ] **Replace the two skips in `src/core/engine/ideology.ts`.** Add the import:
  ```ts
  import { effectiveCard } from "./countsAs.ts";
  ```
  At line 60 (column loop) replace:
  ```ts
        if (c.ideology === "wild") continue;
  ```
  with:
  ```ts
        // Skip color-indeterminate cards (full jokers + bare-"wild"); a rank-only
        // partial with a real literal color is kept. Identity = what you played.
        if (effectiveCard(c).ideologyWild) continue;
  ```
  At line 69 (unlock loop) replace the second `if (c.ideology === "wild") continue;` with:
  ```ts
        if (effectiveCard(c).ideologyWild) continue;
  ```
  (Use `replace_all: false` and unique surrounding context for each, or edit each occurrence individually since they are identical lines.)

- [ ] **Replace the skip in `unlockedIdeologyBreakdown` (`src/core/data/projects.ts`).** Add the import if not present:
  ```ts
  import { effectiveCard } from "../engine/countsAs.ts";
  ```
  Replace the `c.ideology === "wild"` skip inside `unlockedIdeologyBreakdown` with:
  ```ts
      if (effectiveCard(c).ideologyWild) continue;
  ```
  with a comment:
  ```ts
      // Crisis/Monument identity record excludes wilds, matching deriveVector.
  ```

- [ ] **Run the suite to green:**
  ```
  bun test tests/ideology.test.ts
  ```
  Expected: `0 fail` — pre-existing `deriveVector`/`demonym`/`unlockedIdeologyBreakdown` cases plus the new wild-skip cases pass.

- [ ] **Run the full suite + typecheck** (`projects.ts` is imported widely; confirm `projects.test.ts`, `crisisflow.test.ts`, `smoke.test.ts` still pass):
  ```
  bun test && bun run typecheck
  ```
  Expected: `0 fail`; `tsc --noEmit` exits 0.

- [ ] **Commit:**
  ```
  git add src/core/engine/ideology.ts src/core/data/projects.ts tests/ideology.test.ts
  git commit -m "feat(core): skip color-indeterminate wilds in deriveVector + breakdown via ideologyWild"
  ```

---

**End-of-phase verification.** After all three commits, the evaluators read `countsAs` via `effectiveCard`, but production behavior is **unchanged** — no production card carries `countsAs` until P2 recolors the ex-charters. Confirm the whole project is green before handing off to P2:
```
bun test && bun run typecheck
```
Expected: `0 fail`; `tsc --noEmit` exits 0. The wild paths are exercised only by the `fullJoker()` fixtures added this phase; they go live in production at P2.


---

## Phase P2 — ATOMIC: delete the Charter row/kind project-wide + recolor the ex-charters to `FULL_JOKER`

> **This phase is ATOMIC.** Removing `CharterRow`/`charter` from the `Column` type breaks every `col.charter` reader across core, facade, renderer, scripts, and tests *at once*; and deleting `"charter"` from `CardKind` invalidates the six ex-charter `kind:"charter"` literals at the same instant. There is no green intermediate point — splitting any reader out leaves a type error somewhere and the lefthook `tsc --noEmit` (project-wide) fails. Therefore **all the tasks below land in ONE commit.** The "TDD" loop is inverted for the structural pieces: we first rewrite each affected test suite to the two-row + joker shape (Tasks 1–2 below are the *test* rewrites — they go red because they reference deleted helpers and joker behavior that is not yet live), then make every production deletion/recolor (Tasks 3–11), then run the whole suite green and commit (Task 12). Acknowledge the implementation block is much larger than a 2–5 minute TDD step — that is expected and unavoidable for a project-wide type change.
>
> **Assumes P0 + P1 are already merged on this branch.** That means `src/core/engine/countsAs.ts` exists and exports `effectiveCard`, `canOccupyRow`, `isWildCard`, `ALL_ROWS`; `src/core/data/cards.ts` exports `RANKS`, `FULL_JOKER`, `RowKind`, `CountsAs`, and the optional `countsAs?: CountsAs` field on `Card`; `identifyRowHand`/`canFormStraight` and `sharesOneIdeology` are wild-aware; `ideology.ts` skips on `effectiveCard(c).ideologyWild`; and `tests/fixtures.ts` exports `fullJoker()`. The six ex-charters are still `kind:"charter"` after P1 (so the wild logic is dormant in production). This commit recolors them to `FULL_JOKER`, which makes P1's wild evaluation go live.
>
> **Out of scope for P2 (lands in P3):** the `promotedIdeology` field on `ProjectUnlock`, `presentIdeologies`, the count-scaled `ideologyInfluence` rewrite, and the full `buildColumn` promote-validation branches. P2 only adds the optional `promote?: Ideology` *parameter* to `buildColumn` (ignored for now) so the facade signature is stable; it does NOT validate it or set `promotedIdeology`.

---

### Task 8: Rewrite the four structural test suites to the two-row + joker shape (RED)

These edits delete every reference to the charter row/kind/helpers and add the new two-row buildability, joker-into-either-row, same-rank-growth-gate, and stored-joker-replay cases. They will not compile/pass until the production code in Tasks 3–11 lands — that is the intended red state for this atomic phase.

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/tests/column.test.ts`
- Modify `/Users/elliott/Projects/space-game-demo/tests/dispatch.test.ts`
- Modify `/Users/elliott/Projects/space-game-demo/tests/columnPatterns.test.ts`
- Modify `/Users/elliott/Projects/space-game-demo/tests/storage.test.ts`

#### 1a. `tests/column.test.ts` — drop charter, add two-row + joker cases

- [ ] Replace the import block (lines 1–14) — drop `canPlaceCharter`, `placeCharter`, `columnLandRank`, and add `getCard` + `fullJoker`:

```ts
import { describe, test, expect } from "bun:test";
import {
  createEmptyColumn,
  canPlaceLand,
  canPlaceInfluence,
  placeLand,
  placeInfluence,
  clearColumn,
  columnCards,
  isBuildable,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import { fullJoker } from "./fixtures.ts";

const land = (
  rank: number,
  ideology: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(landId(rank, ideology));
const role = (
  r: "agitator" | "scholar" | "preacher" | "engineer" | "architect",
  i: "solidarity" | "sovereignty" | "transformation" | "heritage",
) => getCard(roleId(r, i));
```

- [ ] Delete the two charter tests (`"charter row rejected without influence"` and `"charter row accepted once influence filled"`, current lines 63–74).
- [ ] In `"clearColumn empties all rows"` (lines 76–85), remove the `placeCharter(col, charter())` line and the `expect(col.charter.card).toBeNull();` assertion; keep the lands/influence assertions.
- [ ] Rewrite `"columnCards returns all cards in lands+influence+charter order"` (lines 87–98) to two rows:

```ts
  test("columnCards returns all cards in lands+influence order", () => {
    const col = createEmptyColumn();
    const l1 = land(7, "solidarity");
    const l2 = land(7, "heritage");
    const r = role("scholar", "solidarity");
    placeLand(col, l1);
    placeLand(col, l2);
    placeInfluence(col, r);
    expect(columnCards(col)).toEqual([l1, l2, r]);
  });
```

- [ ] Delete the `"columnLandRank returns the rank of the first land, or null if empty"` test entirely (lines 100–105) — `columnLandRank` is deleted (spec §6, Risk #10, no live consumer).
- [ ] Add a new `describe` block for two-row buildability and joker placement at the end of the file (after the existing `single-card placement routing` block):

```ts
describe("two-row buildability + joker placement", () => {
  test("a column is buildable with >=1 land + >=1 influence (no charter)", () => {
    const col = createEmptyColumn();
    expect(isBuildable(col)).toBe(false);
    placeLand(col, land(7, "solidarity"));
    expect(isBuildable(col)).toBe(false);
    placeInfluence(col, role("scholar", "solidarity"));
    expect(isBuildable(col)).toBe(true);
  });

  test("a full joker places into the land row (canOccupyRow, not card.kind)", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, fullJoker())).toBe(true);
  });

  test("a full joker places into the influence row once a land is below", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, fullJoker())).toBe(true);
  });

  test("a plain land is still rejected from the influence row", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(canPlaceInfluence(col, land(5, "solidarity"))).toBe(false);
  });

  test("single-card wild allowed onto a same-rank stack [5,5] (grows to trips)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    expect(canPlaceLand(col, fullJoker())).toBe(true);
  });

  test("single-card wild allowed onto an empty land row", () => {
    const col = createEmptyColumn();
    expect(canPlaceLand(col, fullJoker())).toBe(true);
  });

  test("single-card NON-wild 7 rejected onto a mixed [5,5,wild] row (would make two-pair via single placement)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    placeLand(col, fullJoker()); // row is now [5,5,wild] -> trips, a same-rank stack
    // A single non-wild 7 would make [5,5,wild,7] = two-pair, which single
    // placement must never reach (commitHand only). The same-rank-growth gate
    // rejects it.
    expect(canPlaceLand(col, land(7, "solidarity"))).toBe(false);
  });
});
```

#### 1b. `tests/dispatch.test.ts` — drop the charter import + rewrite the build cascade test

- [ ] Edit the import block (lines 3–8): drop `placeCharter`:

```ts
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
} from "../src/core/engine/column.ts";
```

- [ ] Rewrite the `"column-built cascades…"` test (lines 69–93) to a two-row column (3 cards consumed, no charter):

```ts
  test("column-built cascades consumed cards to the discard pile, clears the column, and breeds NO dissent (build is the reward path)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    placeLand(col, land(7, "heritage"));
    placeInfluence(col, getCard(roleId("scholar", "solidarity")));
    const ep = freshEpoch([col]);
    const influence = col.influence.cards[0];
    if (!influence) throw new Error("expected placed cards");
    const unlock: ProjectUnlock = {
      projectId: "p-pair",
      pattern: "pair",
      turn: ep.turn,
      cards: [...col.lands.cards, influence],
    };
    dispatch(ep, { type: "column-built", columnIndex: 0, unlock });
    expect(ep.unlockedProjects).toContain(unlock);
    expect(col.lands.cards.length).toBe(0);
    expect(col.influence.cards.length).toBe(0);
    // 3 cards cycle back via the discard pile, but a Build breeds no Dissent.
    expect(ep.draw.filter((c) => c.tags.includes("dissent")).length).toBe(0);
    expect(ep.discard.length).toBe(3);
  });
```

> Note: the `ProjectUnlock` literal here has NO `promotedIdeology` — P2 does NOT make that field required (P3 does). Leave it absent. P3 will add it to this literal when it makes the field required.

#### 1c. `tests/columnPatterns.test.ts` — structural rewrite to two rows + joker flush cases

- [ ] Edit the import block (lines 3–8): drop `placeCharter`; add `fullJoker` from fixtures:

```ts
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
} from "../src/core/engine/column.ts";
import { getCard, landId, roleId } from "../src/core/data/cards.ts";
import type { KeystoneProject } from "../src/core/types.ts";
import { fullJoker } from "./fixtures.ts";
```

- [ ] Delete the `const charter = () => getCard("keystone-founding-charter");` line (line 18).
- [ ] Rewrite the `complete()` helper (lines 33–43) to two rows (no charter):

```ts
function complete(
  rank: number,
  landIdeo: ("solidarity" | "sovereignty" | "transformation" | "heritage")[],
  roleIdeo: "solidarity" | "sovereignty" | "transformation" | "heritage" = "heritage",
) {
  const col = createEmptyColumn();
  for (const i of landIdeo) placeLand(col, land(rank, i));
  placeInfluence(col, role("scholar", roleIdeo));
  return col;
}
```

- [ ] Update `"returns null for incomplete column (no charter)"` (line 46) — its body already only places a land + influence and expects null; change its title to `"returns null for incomplete column (only a land)"` and make it actually incomplete:

```ts
  test("returns null for incomplete column (only a land)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(7, "solidarity"));
    expect(evaluateColumn(col, projects)).toBeNull();
  });
```

- [ ] In every remaining test that calls `placeCharter(col, charter())`, delete that line. The mono-ideology flush tests need their flush to come from land + influence only. Specifically: the `"four-of-a-kind…"`, `"flush wins over three-of-a-kind"`, `"flush also fires for 1-land or 2-land mono-ideology columns"`, `"straight-flush…"`, `"royal-flush…"`, and `"royal-flush beats straight-flush…"` tests each drop their `placeCharter` line (the lands+role already carry the shared ideology, so the flush still resolves over the two rows).
- [ ] Rewrite the old `"a 'wild' charter or role is not treated as matching for flush"` test (lines 104–110) into its INVERSE — wilds now COMPLETE a flush:

```ts
  test("a full joker COMPLETES a flush (3 solidarity + 1 joker => flush)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "solidarity"));
    placeInfluence(col, fullJoker()); // wild contributes all 4 colors, never narrows
    const m = evaluateColumn(col, projects);
    expect(m?.kind).toBe("flush");
  });
```

- [ ] Add the new joker-pattern cases at the end of the `describe("evaluateColumn")` block:

```ts
  test("2 full jokers => flush (one land-row joker, one influence-row joker)", () => {
    const col = createEmptyColumn();
    placeLand(col, fullJoker());
    placeInfluence(col, fullJoker());
    // Flush is checked at rung 5 before straight/trips/pair; an all-wild column
    // trivially satisfies it (intersection = all 4 colors). Pinned as the
    // intended ladder result (spec §3.3, Red-team #7) so it can't regress.
    expect(evaluateColumn(col, projects)?.kind).toBe("flush");
  });

  test("straight-flush via a wild that is both the 9 AND a solidarity", () => {
    // ranks 5,6,7,8 solidarity + 1 joker fills the 9 and the color simultaneously
    const col = createEmptyColumn();
    for (const r of [5, 6, 7, 8]) placeLand(col, land(r, "solidarity"));
    placeLand(col, fullJoker());
    placeInfluence(col, role("scholar", "solidarity"));
    expect(evaluateColumn(col, projects)?.kind).toBe("straight-flush");
  });

  test("royal-flush: a wild fills the role-row straight gap and the color", () => {
    // four real role ranks (10,11,12,14 all solidarity) + 1 joker as the 13
    const col = createEmptyColumn();
    placeLand(col, land(9, "solidarity"));
    placeInfluence(col, role("agitator", "solidarity")); // 10
    placeInfluence(col, role("scholar", "solidarity")); // 11
    placeInfluence(col, role("preacher", "solidarity")); // 12
    placeInfluence(col, fullJoker()); // 13
    placeInfluence(col, role("architect", "solidarity")); // 14
    expect(evaluateColumn(col, projects)?.kind).toBe("royal-flush");
  });

  test("a stray Dissent in the column BLOCKS the flush (empty color set)", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "solidarity"));
    // makeDissent is ideology:"wild" with NO countsAs => effectiveCard.ideologies
    // is [] => blocks. (Dissent is normally unplayable, but the evaluator must
    // still treat an empty color set as a flush-blocker.)
    col.lands.cards.push(makeDissent());
    placeInfluence(col, role("scholar", "solidarity"));
    expect(evaluateColumn(col, projects)?.kind).not.toBe("flush");
  });

  test("cross-row-with-wild full-house: land [5,5,wild] (trips) + role pair", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    placeLand(col, fullJoker()); // land row -> trips
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, role("scholar", "heritage")); // role row -> pair (rank 11)
    expect(evaluateColumn(col, projects)?.kind).toBe("full-house");
  });

  test("cross-row-with-wild full-house: role [scholar,wild] (pair) + land trips", () => {
    const col = createEmptyColumn();
    placeLand(col, land(5, "solidarity"));
    placeLand(col, land(5, "heritage"));
    placeLand(col, land(5, "sovereignty")); // land row -> trips
    placeInfluence(col, role("scholar", "solidarity"));
    placeInfluence(col, fullJoker()); // role row -> pair
    expect(evaluateColumn(col, projects)?.kind).toBe("full-house");
  });
```

- [ ] Add `makeDissent` to the `cards.ts` import in this file (needed by the Dissent-blocks test):

```ts
import { getCard, landId, makeDissent, roleId } from "../src/core/data/cards.ts";
```

#### 1d. `tests/storage.test.ts` — drop charter import + assertions, add stored-joker case

- [ ] Edit the import block (lines 2–8): drop `placeCharter`:

```ts
import {
  createEmptyColumn,
  placeLand,
  placeInfluence,
} from "../src/core/engine/column.ts";
```

(Keep whatever other named imports the block already had besides `placeCharter`.)

- [ ] Rewrite the `"placeCard with source 'storage' plays a stored charter"` test (lines 249–260) into a stored-full-joker-replayed-into-the-influence-row case, asserting on `col.influence.cards`:

```ts
  test("placeCard with source 'storage' replays a stored full joker into the influence row", () => {
    const ep = freshEpoch();
    const col = ep.columns[0];
    placeLand(col, land(7, "solidarity"));
    const joker = fullJoker(); // cost 0 in the fixture; no Influence needed
    col.storage = [joker];
    const campaign = createCampaign(1);
    const r = placeCard(ep, campaign, getSetting("homeworld"), joker.id, 0, rng, "storage");
    expect(r.ok).toBe(true);
    expect(col.influence.cards).toContain(joker);
    expect(col.storage.length).toBe(0);
  });
```

> The `fullJoker()` fixture is `kind:"role"` (its concrete home, §3.2), so `placeCard`'s role branch routes it through the influence row; `canPlaceInfluence` accepts it via `canOccupyRow`. If the fixture carries a non-zero `influenceCost`, set `ep.influence` high enough first.

- [ ] In `"Build clears the column but storage survives"` (lines 273–286), remove the `placeCharter(col, getCard("keystone-founding-charter"));` line — the column is now buildable with land + influence alone (a pair of same-rank lands + a role).
- [ ] Add `fullJoker` to the fixtures import at the top of the file:

```ts
import { emptyPolicyState, fullJoker } from "./fixtures.ts";
```

---

### Task 9: Update `tests/smoke.test.ts` — drop the `col.charter.card` read (RED)

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/tests/smoke.test.ts`

- [ ] In the "fresh epoch has empty columns" assertion (lines 14–19), drop the `col.charter.card === null` clause:

```ts
      s.epoch.columns.every(
        (col) =>
          col.lands.cards.length === 0 &&
          col.influence.cards.length === 0,
      ),
```

- [ ] Leave smoke's `buildColumn` callers untouched — the facade `buildColumn(columnIndex)` still takes a single arg in P2 (the `promote` param is added as optional on the *core* signature; the facade keeps its 1-arg shape until P3).

- [ ] Run the rewritten suites now to confirm they are RED (they reference deleted production symbols + dormant joker behavior):

```
bun test tests/column.test.ts tests/dispatch.test.ts tests/columnPatterns.test.ts tests/storage.test.ts tests/smoke.test.ts
```

Expected: failures — `column.ts` still exports `canPlaceCharter`/`placeCharter`/`columnLandRank` (so the *old* tests that referenced them are gone, but the new joker tests fail because the ex-charters are still `kind:"charter"` and `fullJoker()` placement / flush-completion is not yet live in production), and TypeScript errors on the now-deleted helpers. Example expected output fragment:

```
error: Export named 'canPlaceCharter' not found ...   (no — it IS still exported; the failures are runtime)
... fullJoker() canPlaceLand expected true, got false
... 2 full jokers => flush: expected "flush", got null
(fail) N pass, M fail
```

This red state is expected for an atomic phase; proceed to the production changes.

---

### Task 10: `data/cards.ts` — remove the `charter` kind/tag, recolor the 6 ex-charters to `FULL_JOKER`

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/data/cards.ts`

- [ ] Remove `"charter"` from `CardKind` (line 31):

```ts
export type CardKind = "land" | "role" | "dissent" | "legacy";
```

- [ ] Remove `"charter"` from `CardTag` (line 33):

```ts
export type CardTag = "dissent" | "legacy";
```

- [ ] Rewrite `buildCharters()` (lines 273–332): convert each card from `kind:"charter"` / `rank:15` to a concrete home kind + a `countsAs: FULL_JOKER`, applying the §3.2 recolor table (Pioneer → `transformation`, Apostle → `heritage`; others keep their color). Role-home jokers get `kind:"role"`, `rank:14`; the land-home joker (`keystone-founding-charter`) gets `kind:"land"`, `rank:9`. Drop the `"charter"` tag (use `[]` or a non-charter marker — `tags` is now `CardTag[]` without `"charter"`):

```ts
function buildJokers(): Card[] {
  // Former charter cards. They lose kind:"charter" (that row is gone) and
  // become full-joker wilds via countsAs: FULL_JOKER — any rank, any ideology,
  // either row, for EVALUATION only. Their literal kind/rank/ideology survive
  // for display, cost, effect, and deck-filter identity (the resolver ignores
  // all three). Literal ranks are pinned inside RANKS [2..14], never 15.
  return [
    {
      id: "keystone-pioneer",
      name: "The Pioneer",
      kind: "role",
      rank: 14,
      ideology: "transformation",
      influenceCost: 3,
      effect: draw(2),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Wild role, wild suit. No Dissent.",
    },
    {
      id: "keystone-apostle",
      name: "The Apostle",
      kind: "role",
      rank: 14,
      ideology: "heritage",
      influenceCost: 2,
      effect: compound(gainInf(2), addDissent(1)),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Wild role, wild suit. Stirs Dissent.",
    },
    {
      id: "keystone-navigators-compass",
      name: "The Navigator's Compass",
      kind: "role",
      rank: 14,
      ideology: "transformation",
      influenceCost: 2,
      effect: draw(2),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Keystone — The Ark.",
    },
    {
      id: "keystone-founding-charter",
      name: "The Founding Charter",
      kind: "land",
      rank: 9,
      ideology: "solidarity",
      influenceCost: 2,
      effect: gainInf(2),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Keystone — The Commune.",
    },
    {
      id: "keystone-critical-mass",
      name: "Critical Mass",
      kind: "role",
      rank: 14,
      ideology: "sovereignty",
      influenceCost: 3,
      effect: compound(gainInf(2), draw(1)),
      tags: [],
      countsAs: FULL_JOKER,
      flavor: "Keystone — The Reactor.",
    },
  ];
}
```

- [ ] Update the registry export (line 338) to call the renamed builder:

```ts
export const ALL_CARDS: Card[] = [...buildRoles(), ...buildLands(), ...buildJokers()];
```

> `FULL_JOKER`, `draw`, `compound`, `gainInf`, `addDissent` are all already in scope in this module (P0 added `FULL_JOKER`; the effect builders already exist). The P0 boot assert "no playable non-`dissent` card carries `ideology:"wild"` without `countsAs`" now passes trivially — every joker carries a concrete color. The P0 `RANKS`-equals-live-card-ranks boot assert still passes because no live card holds rank 15 anymore (the role-home jokers are 14, the land-home joker is 9).

---

### Task 11: `engine/column.ts` — delete the Charter row + gate placement via `canOccupyRow`

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/engine/column.ts`

- [ ] Delete the `CharterRow` interface (lines 20–23).
- [ ] In the `Column` interface (lines 25–33), delete the `charter: CharterRow;` field.
- [ ] In `ColumnConfig` (lines 35–40), delete `charter?: string;`.
- [ ] Update the imports at the top to pull the resolver predicates:

```ts
import type { Card } from "../data/cards.ts";
import { canOccupyRow, effectiveCard, isWildCard } from "./countsAs.ts";
import { validateRowHand } from "./rowHands.ts";
```

- [ ] Rewrite `createEmptyColumn` (lines 46–53) without the charter field:

```ts
export function createEmptyColumn(): Column {
  return {
    lands: { cards: [] },
    influence: { cards: [] },
    storage: [],
  };
}
```

- [ ] Replace `canPlaceLand` (lines 55–58) — gate by `canOccupyRow(card, "land")` instead of `card.kind !== "land"`, and add the single-card wild same-rank-growth restriction (spec §3.3):

```ts
export function canPlaceLand(col: Column, card: Card): boolean {
  if (!canOccupyRow(card, "land")) return false;
  if (isWildCard(card) && !isSameRankGrowth(col.lands.cards)) return false;
  return validateRowHand([...col.lands.cards, card]);
}
```

- [ ] Replace `canPlaceInfluence` (lines 60–64) similarly:

```ts
export function canPlaceInfluence(col: Column, card: Card): boolean {
  if (!canOccupyRow(card, "role")) return false;
  if (col.lands.cards.length < 1) return false;
  if (isWildCard(card) && !isSameRankGrowth(col.influence.cards)) return false;
  return validateRowHand([...col.influence.cards, card]);
}
```

- [ ] Add the `isSameRankGrowth` helper (the gate that keeps single-card wild placement to same-rank-stack growth only, preserving the "every intermediate row state is a valid row-hand" invariant — §3.3, Red-team #2):

```ts
/** A wild may be placed via SINGLE-CARD placement only when the target row is
 *  empty or every card already in it shares one fixed rank — i.e. the wild
 *  extends [] / [r] / [r,r] / [r,r,r]. This blocks reaching two-pair /
 *  full-house / straight incrementally; those shapes must go through
 *  commitHand. Mixed-rank or already-wild-bearing rows are NOT same-rank. */
function isSameRankGrowth(existing: Card[]): boolean {
  if (existing.length === 0) return true;
  if (existing.some((c) => isWildCard(c))) return false;
  const ranks = new Set(existing.map((c) => effectiveCard(c).ranks[0]));
  return ranks.size === 1;
}
```

- [ ] Delete `canPlaceCharter` (lines 66–70) and `placeCharter` (lines 80–82) entirely.
- [ ] Rewrite `clearColumn` (lines 84–88) without the charter line:

```ts
export function clearColumn(col: Column): void {
  col.lands.cards.length = 0;
  col.influence.cards.length = 0;
}
```

- [ ] Rewrite `columnCards` (lines 90–95) to Land + Influence only:

```ts
export function columnCards(col: Column): Card[] {
  return [...col.lands.cards, ...col.influence.cards];
}
```

- [ ] Delete `columnLandRank` (lines 97–99) entirely (no live consumer; Risk #10).
- [ ] Rewrite `isBuildable` (lines 101–105) to two rows:

```ts
export function isBuildable(col: Column): boolean {
  return col.lands.cards.length >= 1 && col.influence.cards.length >= 1;
}
```

- [ ] Rewrite `columnFromConfig` (lines 107–125) — drop the charter block:

```ts
export function columnFromConfig(
  cfg: ColumnConfig,
  resolve: (id: string) => Card | undefined,
): Column {
  const col = createEmptyColumn();
  for (const id of cfg.lands) {
    const c = resolve(id);
    if (c) col.lands.cards.push(c);
  }
  for (const id of cfg.influence ?? []) {
    const c = resolve(id);
    if (c) col.influence.cards.push(c);
  }
  return col;
}
```

---

### Task 12: `engine/events.ts` + `engine/dispatch.ts` — delete the charter event variant + handler

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/engine/events.ts`
- Modify `/Users/elliott/Projects/space-game-demo/src/core/engine/dispatch.ts`

- [ ] In `events.ts`, delete `"tableau-charter"` from the `DiscardSource` union (line 9):

```ts
export type DiscardSource =
  | "tableau-land"
  | "column"
  | "hand"
  | "influence-recall"
  | "storage"
  | "build";
```

- [ ] In `events.ts`, delete the `card-played-to-charter` variant from `GameEvent` (line 21):

```ts
export type GameEvent =
  | { type: "card-played-to-land"; card: Card; columnIndex: number }
  | { type: "card-played-to-influence"; card: Card; columnIndex: number }
  | { type: "card-discarded"; card: Card; source: DiscardSource }
  | { type: "cards-committed"; columnIndex: number; row: "land" | "influence"; cards: Card[] }
  | { type: "column-built"; columnIndex: number; unlock: ProjectUnlock }
  | { type: "dissent-added" }
  | { type: "card-stored"; card: Card; columnIndex: number }
  | { type: "turn-ended"; turn: number }
  | { type: "crisis-resolved"; outcome: CrisisOutcome };
```

- [ ] In `dispatch.ts`, delete the entire `case "card-played-to-charter":` block (lines 32–36) — it dereferences `col.charter.card`, which no longer exists.

---

### Task 13: `engine/commands.ts` — strip charter verbs/branches, stub the `buildColumn` `promote?` param

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/engine/commands.ts`

- [ ] Update the column-helper import (line 15): drop `canPlaceCharter`:

```ts
import { canPlaceInfluence, canPlaceLand, columnCards } from "./column.ts";
```

- [ ] Add `Ideology` to the type import block (lines 5–13) — needed for the `buildColumn` `promote?` param:

```ts
import type {
  Campaign,
  Card,
  Epoch,
  GameEvent,
  Ideology,
  PolicyCard,
  ProjectUnlock,
  Setting,
} from "../types.ts";
```

- [ ] In `placeCard`, delete the entire `if (card.kind === "charter")` branch (lines 99–113). A wild placed into the influence row is already handled by the `card.kind === "role"` branch only if its literal kind is `role`; but a land-home joker (`keystone-founding-charter`, `kind:"land"`) routes through the land branch. Both branches now call `canPlaceLand`/`canPlaceInfluence`, which gate via `canOccupyRow`, so a full joker is accepted into whichever row its literal kind targets via single placement. (Cross-row wild placement into the *other* row uses `commitHand`.) The remaining branch structure becomes land → role → fallthrough error:

```ts
  if (card.kind === "land") {
    if (!canPlaceLand(col, card)) {
      return { ok: false, error: "Land cannot be placed there (would not form a valid hand)." };
    }
    pool.splice(poolIdx, 1);
    dispatch(epoch, { type: "card-played-to-land", card, columnIndex });
    return { ok: true, card };
  }

  if (card.kind === "role") {
    if (!canPlaceInfluence(col, card)) {
      return { ok: false, error: "Influence row needs at least one Land below." };
    }
    return playToTopRow(
      epoch,
      setting,
      card,
      columnIndex,
      pool,
      poolIdx,
      "card-played-to-influence",
      rng,
    );
  }

  return { ok: false, error: "Card kind cannot be played." };
```

- [ ] Narrow `playToTopRow`'s `eventType` parameter (line 125) to just `"card-played-to-influence"`:

```ts
function playToTopRow(
  epoch: Epoch,
  _setting: Setting,
  card: Card,
  columnIndex: number,
  pool: Card[],
  poolIdx: number,
  eventType: "card-played-to-influence",
  rng: RNG,
): PlaceResult {
```

(The single caller now passes only `"card-played-to-influence"`. You can also simplify the `dispatch(... as GameEvent)` cast on line 136 if the narrowed type makes it redundant; leaving the cast is harmless.)

- [ ] Delete the entire `discardCharter` command (lines 154–164).
- [ ] In `recallInfluence` (lines 166–183), delete the charter guard (lines 172–174):

```ts
export function recallInfluence(epoch: Epoch, columnIndex: number, rng: RNG): CmdResult<Card[]> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };
  if (col.influence.cards.length === 0) return { ok: false, error: "No Influence to recall." };
  const recalled = [...col.influence.cards];
  for (const card of recalled) {
    dispatch(epoch, { type: "card-discarded", card, source: "influence-recall" }, rng);
  }
  col.influence.cards.length = 0;
  return { ok: true, value: recalled };
}
```

- [ ] In `discardColumn` (lines 185–200), delete the `col.charter.card = null;` line (line 195).
- [ ] Add the optional `promote?: Ideology` parameter to `buildColumn` (lines 213–235). In P2 it is accepted but NOT yet validated or written to the unlock (the `promotedIdeology` field and validation land in P3). The param exists so the facade signature is stable across the atomic boundary:

```ts
export function buildColumn(
  epoch: Epoch,
  setting: Setting,
  columnIndex: number,
  rng: RNG,
  // P2: accepted but unused — promotion validation + promotedIdeology land in P3.
  _promote?: Ideology,
): CmdResult<ProjectUnlock> {
  const blocked = requirePlayable(epoch);
  if (blocked) return blocked;
  const col = epoch.columns[columnIndex];
  if (!col) return { ok: false, error: "Invalid column." };

  const match = evaluateColumn(col, setting.projects);
  if (!match) return { ok: false, error: "Column is not buildable." };

  const unlock: ProjectUnlock = {
    projectId: match.projectId,
    pattern: match.kind,
    turn: epoch.turn,
    cards: [...match.cards],
  };
  dispatch(epoch, { type: "column-built", columnIndex, unlock }, rng);
  return { ok: true, value: unlock };
}
```

> The `_promote` underscore prefix keeps oxlint's no-unused-vars rule quiet on an intentionally-unused param. P3 renames it to `promote` and adds the validation branches.

---

### Task 14: `types.ts` barrel + `settings/generationShip.ts`

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/core/types.ts`
- Modify `/Users/elliott/Projects/space-game-demo/src/core/settings/generationShip.ts`

- [ ] In `types.ts`, remove `CharterRow` from the `./engine/column.ts` re-export (line 32):

```ts
export type { Column, ColumnConfig, InfluenceRow, LandRow } from "./engine/column.ts";
```

> The `CountsAs`/`RowKind`/`EffectiveCard` re-exports were already added by P0; leave them.

- [ ] In `generationShip.ts`, rewrite the comment block (lines 7–10) + the filter (lines 11–12) to drop `"wild"` from the color set and add an explicit joker allowlist (spec §3.6):

```ts
// Generation Ship runs on a constrained deck: only Sovereignty + Transformation
// (captaincy + technological progress). The Solidarity and Heritage ideologies
// are Homeworld concerns the migrants left behind. The former charter cards are
// now universal jokers (countsAs: FULL_JOKER, complete any shape); the Ship
// keeps exactly the three whose literal color is sovereignty/transformation —
// Pioneer, Navigator's Compass, Critical Mass. ~30 cards total.
const SHIP_IDEOLOGIES = new Set<string>(["sovereignty", "transformation"]);
const SHIP_JOKERS = new Set<string>([
  "keystone-pioneer",
  "keystone-navigators-compass",
  "keystone-critical-mass",
]);
const STARTING_DECK = ALL_CARDS.filter(
  (c) => SHIP_IDEOLOGIES.has(c.ideology) || SHIP_JOKERS.has(c.id),
).map((c) => c.id);
```

> Homeworld and Ruined Homeworld use `startingDeck = ALL_CARD_IDS` and auto-include all jokers — no edit there; verify they still compile and the jokers appear.

---

### Task 15: `facade/GameAPI.ts` — drop charter readers, thread the `promote?` param

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/facade/GameAPI.ts`

- [ ] Delete the `discardCharter as discardCharterCore` import (line 13):

```ts
import {
  buildColumn as buildColumnCore,
  commitHand as commitHandCore,
  discardColumn as discardColumnCore,
  discardFromHand as discardFromHandCore,
  discardLand as discardLandCore,
  enactPolicies as enactPoliciesCore,
  placeCard as placeCardCore,
  recallInfluence as recallInfluenceCore,
  removePolicy as removePolicyCore,
  storeCard as storeCardCore,
} from "../core/engine/commands.ts";
```

- [ ] Drop `canPlaceCharter` from the column-helper import (line 51):

```ts
import { canPlaceInfluence, canPlaceLand } from "../core/engine/column.ts";
```

- [ ] In `snapshot()`'s `columnsView` (lines 197–202), drop the `charter` key (reading `c.charter.card` is now a type error):

```ts
    const columnsView: Column[] = this.epoch.columns.map((c) => ({
      lands: { cards: [...c.lands.cards] },
      influence: { cards: c.influence.cards.map((card) => ({ ...card })) },
      storage: [...c.storage],
    }));
```

- [ ] In `validColumns` (lines 266–277), delete the charter branch (line 274):

```ts
  validColumns(cardId: string): number[] {
    const card = this.epoch.hand.find((c) => c.id === cardId);
    if (!card) return [];
    const out: number[] = [];
    for (let i = 0; i < this.epoch.columns.length; i++) {
      const col = this.epoch.columns[i];
      if (canPlaceLand(col, card)) out.push(i);
      else if (canPlaceInfluence(col, card)) out.push(i);
    }
    return out;
  }
```

> Note the raw `card.kind === "land"` / `card.kind === "role"` prefixes are dropped too — `canPlaceLand`/`canPlaceInfluence` now encode row eligibility via `canOccupyRow`, so a full joker (literal `kind:"role"`) can highlight the land column when its row allows it (spec §4, Red-team #1/#5).

- [ ] Delete the `discardCharter` pass-through method (lines 291–293):

```ts
  recallInfluence(columnIndex: number): CommandResult<Card[]> {
    return recallInfluenceCore(this.epoch, columnIndex, this.rng);
  }
```

(i.e. the `discardCharter(...)` method between `discardLand` and `recallInfluence` is removed.)

- [ ] Thread an optional `promote?: Ideology` through the facade `buildColumn` (lines 303–308) so the renderer can pass one later (P6); P2 just plumbs it:

```ts
  buildColumn(
    columnIndex: number,
    promote?: Ideology,
  ): CommandResult<{ projectId: string; pattern: string }> {
    const r = buildColumnCore(this.epoch, this.setting, columnIndex, this.rng, promote);
    return r.ok
      ? { ok: true, value: { projectId: r.value.projectId, pattern: r.value.pattern } }
      : r;
  }
```

> `Ideology` is already imported in the `import type { … Ideology … }` block (line 44). No `promotableIdeologies` query yet — that is P3.

---

### Task 16: Renderer — delete `CharterCell.vue`, strip charter from the tableau/hand/footer/log/theme

**Files:**
- Delete `/Users/elliott/Projects/space-game-demo/src/renderer/components/game/CharterCell.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/components/game/TableauColumn.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/components/game/TableauPanel.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/components/game/ColumnFooter.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/components/game/HandPanel.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/components/shell/sidebar/EventLogSection.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/theme.css`

- [ ] Delete the file `src/renderer/components/game/CharterCell.vue`:

```
git rm src/renderer/components/game/CharterCell.vue
```

- [ ] `TableauColumn.vue`: remove the `<CharterCell>` block (lines 3–9), its import (line 42), the `validForDrag.charter` prop member (line 51), the `discard-charter` emit (line 62), and the `props.column.charter.card === null` clause in `empty` (line 72). Set `grid-template-rows: 150px 150px auto` (line 81). Result for the template + script + style:

```vue
<template>
  <div class="tableau-column">
    <InfluenceCell
      :cards="column.influence.cards"
      :locked="column.lands.cards.length === 0"
      :accepts-drop="validForDrag.influence"
      @place="(id) => $emit('place-card', id)"
      @recall="$emit('recall-influence')"
    />
    <LandCell
      :cards="column.lands.cards"
      :storage="column.storage"
      :selected-storage-ids="selectedStorageIds"
      :can-place-stored="canPlaceFromStorage"
      :accepts-land-drop="validForDrag.land"
      @place="(id) => $emit('place-card', id)"
      @store="(id) => $emit('store-card', id)"
      @toggle-storage-select="(id) => $emit('toggle-storage-select', id)"
      @play-from-storage="(id) => $emit('place-from-storage', id)"
      @discard="$emit('discard-land')"
    />
    <ColumnFooter
      :empty="empty"
      :buildable="buildable"
      :build-tooltip="buildTooltip"
      @discard-column="$emit('discard-column')"
      @build="$emit('build')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Card as CardT, Column } from "../../../core/types.ts";
import InfluenceCell from "./InfluenceCell.vue";
import LandCell from "./LandCell.vue";
import ColumnFooter from "./ColumnFooter.vue";

const props = defineProps<{
  column: Column;
  buildable: boolean;
  buildTooltip: string;
  validForDrag: { land: boolean; influence: boolean };
  selectedStorageIds: string[];
  canPlaceFromStorage: (card: CardT) => boolean;
}>();

defineEmits<{
  "place-card": [cardId: string];
  "store-card": [cardId: string];
  "toggle-storage-select": [cardId: string];
  "place-from-storage": [cardId: string];
  "discard-land": [];
  "recall-influence": [];
  "discard-column": [];
  build: [];
}>();

const empty = computed(
  () => props.column.lands.cards.length === 0 && props.column.influence.cards.length === 0,
);
</script>

<style scoped>
.tableau-column {
  display: grid;
  grid-template-rows: 150px 150px auto;
  gap: 6px;
}
</style>
```

- [ ] `TableauPanel.vue`: remove the `Charter` row-label (line 9), the `@discard-charter` wiring (line 28), the `discardCharter` emit (line 64), the `canPlaceCharter` import (line 44), set both `grid-template-rows` to `150px 150px auto` (lines 81 in TableauColumn already done; here it's line 116 in `.row-labels`), and rewrite `validForDrag(i)` (lines 83–92) to drop the `charter` member AND the raw `card.kind ===` prefixes:

  - Line 9: delete `<div class="row-label">Charter</div>`.
  - Line 28: delete `@discard-charter="$emit('discardCharter', i)"`.
  - Line 44: `import { canPlaceInfluence, canPlaceLand } from "../../../core/engine/column.ts";`
  - Line 64: delete `discardCharter: [columnIndex: number];` from the emits.
  - Line 116: `.row-labels { … grid-template-rows: 150px 150px auto; … }`.
  - Rewrite `validForDrag`:

```ts
function validForDrag(i: number): { land: boolean; influence: boolean } {
  const card = dragging.value ? props.getCardFromHand(dragging.value.cardId) : null;
  if (!card) return { land: false, influence: false };
  const col = props.columns[i];
  return {
    land: canPlaceLand(col, card),
    influence: canPlaceInfluence(col, card),
  };
}
```

- [ ] `ColumnFooter.vue`: change the disabled Build tooltip (line 12):

```vue
      :title="buildable ? buildTooltip : 'Build needs a Land and an Influence row that form a pattern.'"
```

- [ ] `HandPanel.vue`: in `canPlaceAllSequentially` (lines 203–218) drop the `charter` field from the `sim` literal (line 208), delete the `else if (c.kind === "charter")` branch (line 214) and the raw `c.kind ===` pre-filters (try Land then Influence via core), and remove `canPlaceCharter` from the column-helper import (line 95). Also relax `rowHandForRow` (lines 182–188) so a joker can be classified for either row (validity still from core). Result for the two functions + import:

  - Line 95: `import { canPlaceLand, canPlaceInfluence } from "../../../core/engine/column.ts";`
  - Rewrite `canPlaceAllSequentially`:

```ts
function canPlaceAllSequentially(cards: CardT[], col: Column): boolean {
  const sim: Column = {
    lands: { cards: [...col.lands.cards] },
    influence: { cards: [...col.influence.cards] },
    storage: [...col.storage],
  };
  for (const c of cards) {
    if (canPlaceLand(sim, c)) sim.lands.cards.push(c);
    else if (canPlaceInfluence(sim, c)) sim.influence.cards.push(c);
    else return false;
  }
  return true;
}
```

  - Rewrite `rowHandForRow` to gate row eligibility via `canOccupyRow` instead of the raw `c.kind !== requiredKind` filter (so a joker counts for either row, and a plain land is still rejected from influence):

```ts
function rowHandForRow(row: "land" | "influence"): string | null {
  const cards = combinedSelection.value;
  if (cards.length === 0) return null;
  const requiredRow = row === "land" ? "land" : "role";
  if (cards.some((c) => !canOccupyRow(c, requiredRow))) return null;
  return identifyRowHand(cards);
}
```

  - Add `canOccupyRow` to the imports (it lives in core `engine/countsAs.ts`):

```ts
import { canOccupyRow } from "../../../core/engine/countsAs.ts";
```

- [ ] `EventLogSection.vue`: delete the `case "card-played-to-charter":` arm (line 27). The remaining arm:

```ts
    case "card-played-to-land":
    case "card-played-to-influence":
      return `${e.type.replace(/-/g, " ")}: ${e.card.name} → col ${e.columnIndex + 1}`;
```

- [ ] `theme.css`: delete the orphaned `.cell.charter-cell` selector. At lines 749–753 the rule reads:

```css
  .cell.land-cell,
  .cell.influence-cell,
  .cell.charter-cell {
    height: 150px;
  }
```

  Remove the `.cell.charter-cell` line so it becomes:

```css
  .cell.land-cell,
  .cell.influence-cell {
    height: 150px;
  }
```

---

### Task 17: Renderer — `App.vue` + `GameService.ts` charter removal

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/App.vue`
- Modify `/Users/elliott/Projects/space-game-demo/src/renderer/GameService.ts`

- [ ] `App.vue`: remove the `@discard-charter="onDiscardCharter"` wiring on `<TableauPanel>` (line 65), the `onDiscardCharter` handler (lines 376–378), and drop `canPlaceCharter` from the column-helper import (line 202):

  - Line 65: delete `@discard-charter="onDiscardCharter"`.
  - Line 202: `import { canPlaceLand, canPlaceInfluence } from "../core/engine/column.ts";`
  - Delete the `onDiscardCharter` function (lines 376–378).

- [ ] `App.vue`: rewrite `canPlaceStored` (lines 341–350) — drop the charter branch (lines 347–348) and the raw `card.kind ===` prefixes (a stored full joker must be replayable into either row via storage→row replay):

```ts
function canPlaceStored(col: number, card: Card): boolean {
  const column = epoch.value.columns[col];
  if (!column || card.tags.includes("dissent")) return false;
  if (canPlaceLand(column, card)) return true;
  if (canPlaceInfluence(column, card)) return epoch.value.influence >= card.influenceCost;
  return false;
}
```

> Keep `onBuild(i)` as the simple `game.buildColumn(i)` for P2 — the `promotableIdeologies`-driven picker decision is P6. The facade `buildColumn` now takes an optional `promote?` second arg, so the existing 1-arg call still typechecks.

- [ ] `GameService.ts`: delete the `discardCharter` pass-through (lines 73–74). Leave `buildColumn(columnIndex)` 1-arg for P2 (the `promote` arg is added in P6 when the picker exists); it calls `this.api.buildColumn(columnIndex)`, which is valid because the facade's second param is optional.

```ts
  discardLand(columnIndex: number): void {
    this.run(() => this.api.discardLand(columnIndex));
  }
  recallInfluence(columnIndex: number): void {
    this.run(() => this.api.recallInfluence(columnIndex));
  }
```

---

### Task 18: Scripts — rewrite `explore-strategies.ts` and `pattern_reachability.ts` to the two-row/joker model

> `tsconfig.json` `include` is `['src/**/*','tests/**/*']`, so `bun run typecheck` (vue-tsc) does NOT flag `scripts/`. But both scripts read `col.charter.card` / `card.kind === "charter"` and break at **runtime / `bun test` import-time** once core changes, and the spec §6 marks them compile-blocking for the project-wide pre-commit. Fix them in this same atomic commit so no commit leaves a script referencing a deleted field.

**Files:**
- Modify `/Users/elliott/Projects/space-game-demo/scripts/explore-strategies.ts`
- Modify `/Users/elliott/Projects/space-game-demo/scripts/pattern_reachability.ts`

- [ ] `explore-strategies.ts`: delete the two `if (col.charter.card) …` pushes (line 62 — `all.push(col.charter.card)`; line 297 — `tableau.push(col.charter.card)`), and remove the two `placeKind("charter")` entries from the strategy step lists (lines 379 and 395). The `placeKind` helper (line 238–) itself stays — it is still used with `"role"` — but it must no longer be called with `"charter"`. Update the `placeKind` doc comment (line 238) from "(charter/role)" to "(role)". The two column-card-gathering helpers (`all`/`tableau`) now collect lands + influence only:

  - Line 62: delete `if (col.charter.card) all.push(col.charter.card);`.
  - Line 297: delete `if (col.charter.card) tableau.push(col.charter.card);`.
  - Lines 379, 395: remove the `placeKind("charter"),` array entries.

- [ ] `pattern_reachability.ts`: rewrite the flush / straight-flush / royal-flush reachability to evaluate over Land + Influence only and to treat jokers (`countsAs !== undefined`) as universal wilds (they complete any color):

  - The `flush` block (lines 88–109): a flush is reachable iff, for some ideology, the deck holds enough land + role cards of that ideology (or jokers) to fill a column with no off-color non-wild card. Drop the `chartersOfIdeology` lookup (lines 99–103) — charters no longer exist as a kind. Replace it with a joker count:

```ts
    const jokers = Array.from(cardMap.values()).filter(
      (c) => c.countsAs !== undefined && cardIds.includes(c.id),
    ).length;
```

    and fold `jokers` into the flush feasibility (a joker can stand in for any missing same-color card).

  - The `straight-flush` block (lines 112–133) and `royal-flush` block (lines 135–162): delete every `c.kind === "charter"` lookup and the `chartersOfIdeology > 0` gate; the role/land straight + flush is now over the two rows, with jokers able to fill any rank or color slot. Keep the `if (ideology === "wild") continue;` guard out — no card carries bare `"wild"` anymore; instead skip a card from the flush color tally when `c.countsAs !== undefined` (it matches any color) by counting it as a joker rather than a colored card.

> This script is a balance/exploration tool, not part of the test suite — its exact heuristic does not need to be perfect, only (a) free of references to the deleted `charter` kind / `col.charter` field, and (b) runtime-clean when imported. Verify with the run step in Task 12.

---

### Task 19: Run the full suite + typecheck to GREEN, commit atomically

**Files:** (no new edits — verification + commit)

- [ ] Run the full test suite. With the production changes from Tasks 3–11 landed, the suites rewritten in Tasks 1–2 (and every untouched suite) should pass:

```
bun test
```

Expected: all green, e.g.:

```
 NNN pass
 0 fail
```

- [ ] Run the project-wide typecheck (this is what the lefthook pre-commit runs over the whole project):

```
bun run typecheck
```

Expected: clean exit, no output (no errors). If `tsc` reports a residual `col.charter` reader anywhere (core/facade/renderer/tests in `src` or `tests`), fix that site — the atomic commit must leave ZERO `charter` type references. Sites to double-check if `tsc` complains: `src/core/engine/turn.ts`, `src/core/engine/campaign.ts`, `src/core/engine/epoch.ts`, and any `columnFromConfig` caller — grep them:

```
grep -rn "charter\|Charter\|CharterRow\|placeCharter\|canPlaceCharter\|columnLandRank\|card-played-to-charter\|tableau-charter" src tests
```

Expected: no matches (the only acceptable remaining hits would be unrelated string literals — there should be none).

- [ ] Smoke-run the two rewritten scripts to confirm they import + execute without dereferencing a deleted field:

```
bun run scripts/explore-strategies.ts 2>&1 | head -5
bun run scripts/pattern_reachability.ts 2>&1 | head -5
```

Expected: each runs to completion (or prints its normal output) with no `Cannot read properties of undefined (reading 'card')` / `charter` errors.

- [ ] Stage everything (including the deleted `CharterCell.vue`) and commit as ONE atomic change:

```
git add -A
git commit -m "feat(core): two-row column — delete Charter row/kind, recolor ex-charters to full-joker wilds

Remove the Charter row and kind across core/facade/renderer/scripts/tests in one
atomic change (col.charter readers break project-wide simultaneously). Convert the
six ex-charter cards from kind:\"charter\" to concrete-home FULL_JOKER wilds
(Pioneer->transformation, Apostle->heritage), making P1's wild evaluation live in
production. Build now needs only a filled Land + Influence row that resolves to a
pattern; buildColumn gains an (unused, P3-validated) promote? param; the Generation
Ship deck filter switches to an explicit joker allowlist.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

> Pre-commit (lefthook) re-runs `oxlint --fix` + `prettier --write` on staged files and `tsc --noEmit` project-wide. If the hook reformats files, re-stage and re-commit. If `tsc` fails, it has found a missed `col.charter` reader — fix it and retry; do not split the commit.


---

## Phase P3 — ATOMIC: `promotedIdeology` required on `ProjectUnlock` + count-scaled `ideologyInfluence`

> **THIS PHASE IS ATOMIC.** Making `ProjectUnlock.promotedIdeology` a **required** (non-optional) field is a project-wide type change: it breaks **every** `ProjectUnlock` literal and **every** `buildColumn` test caller across all suites the instant the field lands, and `tsc --noEmit` runs over the whole project in the pre-commit hook. Therefore the field addition + every literal/helper backfill + the `ideologyInfluence` rewrite + the `presentIdeologies` helper + the `buildColumn` promote branches + the facade `promote` threading + `promotableIdeologies` + the simulator's `promote` arg + the renderer delegate **must all land in ONE commit**. A partial commit leaves some literal missing a required field ⇒ `tsc` fails ⇒ the hook rejects the commit.
>
> **Pre-req state at the start of P3** (after P2 has landed): the Charter row/kind is gone; `buildColumn(epoch, setting, columnIndex, rng, promote?)` already carries a *stub* `promote?: Ideology` parameter (P2 widened the signature so its facade caller compiled) but does **not** yet validate it — P3 finalizes the promote logic. `presentIdeologies` does **not** exist yet (P3 adds it). `ideologyInfluence` is still the old flat-`+1`-per-plurality version (P3 rewrites it). The wildness model (`countsAs`, `effectiveCard`) from P0/P1 is live.
>
> **TDD shape for an atomic phase:** because every test file fails to compile the moment the field becomes required, the conventional "write one failing test, run it red, implement, run green" micro-loop cannot run in isolation — the suite is uncompilable until *all* literals are fixed. So Tasks N.1–N.2 stage the **core type + logic + their direct unit tests** (these can be driven red→green in `tests/projects.test.ts` because that file is self-contained once its own literals are fixed), and Task N.3 performs the **single atomic sweep** of every remaining consumer + every remaining test literal, ending with one project-wide `bun run typecheck` + full `bun test` + one commit. Task N.3 is explicitly larger than a 2–5-minute step; that is expected and unavoidable for a required-field change.

---

### Task 20: Add `presentIdeologies`, make `promotedIdeology` required, rewrite `ideologyInfluence` (count-scaled) — driven red→green in `tests/projects.test.ts`

This task changes `projects.ts` and rewrites the `tests/projects.test.ts` `ideologyInfluence`/`projectMajority`/`unlockedIdeologyBreakdown` blocks plus adds a `presentIdeologies` block. It compiles and passes in isolation because `tests/projects.test.ts` only references its own literals (all fixed here). The *rest* of the project will still have un-backfilled literals — that is fine; we do not run a project-wide `typecheck` until Task N.3. We run the **single file** here.

**Files:**
- Modify: `/Users/elliott/Projects/space-game-demo/src/core/data/projects.ts` (`ProjectUnlock` at lines 45–51; `unlockedIdeologyBreakdown` at 151–160; `projectMajority` at 164–176; `ideologyInfluence` at 179–186)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/projects.test.ts` (`unlockedIdeologyBreakdown` literals at 118–146; the `u()` helper + `ideologyInfluence` block at 207–226)

**Steps:**

- [ ] **Write the failing `presentIdeologies` + count-scaled `ideologyInfluence` tests first.** In `/Users/elliott/Projects/space-game-demo/tests/projects.test.ts`, add `presentIdeologies` and the wild keystone helper to the import on line 2–13, and add a `W` joker helper. Replace the entire `describe("ideologyInfluence", …)` block (lines 207–226) and append a `describe("presentIdeologies", …)` block with the count-scaled and swing-voter assertions:

  Update the import block (lines 2–13) to add `presentIdeologies`:
  ```ts
  import {
    DEFAULT_PROJECT_VALUE,
    PATTERNS_IN_ORDER,
    getProjectForPattern,
    reversePatternOrder,
    unlockedIdeologyBreakdown,
    projectLevels,
    projectContribution,
    marginalContribution,
    projectMajority,
    ideologyInfluence,
    presentIdeologies,
  } from "../src/core/data/projects.ts";
  ```

  Replace the `ideologyInfluence` describe block (lines 207–226) with:
  ```ts
  // A full-joker keystone (countsAs: FULL_JOKER), carries a concrete literal color.
  const W = () => getCard("keystone-pioneer"); // transformation-colored full joker

  describe("ideologyInfluence (count-scaled, promoted-color-only)", () => {
    const u = (
      cards: ReturnType<typeof getCard>[],
      promotedIdeology: "solidarity" | "sovereignty" | "transformation" | "heritage" | null,
    ): ProjectUnlock => ({
      projectId: "p",
      pattern: "pair" as const,
      turn: 1,
      cards,
      promotedIdeology,
    });

    test("a 2-solidarity build promoting solidarity contributes 2 (count-scaled)", () => {
      const inf = ideologyInfluence([u([L(2, "solidarity"), L(2, "solidarity")], "solidarity")]);
      expect(inf.solidarity).toBe(2);
      expect(inf.heritage).toBe(0);
    });

    test("a wild adds NO fuel: 2 solidarity + 1 wild, promote solidarity ⇒ 2", () => {
      const inf = ideologyInfluence([
        u([L(2, "solidarity"), L(2, "solidarity"), W()], "solidarity"),
      ]);
      expect(inf.solidarity).toBe(2);
      expect(inf.transformation).toBe(0); // the wild's literal color does NOT count
    });

    test("off-color cards excluded: 3 sol + 1 her + 1 wild, promote solidarity ⇒ 3", () => {
      const inf = ideologyInfluence([
        u(
          [L(2, "solidarity"), L(3, "solidarity"), L(4, "solidarity"), L(5, "heritage"), W()],
          "solidarity",
        ),
      ]);
      expect(inf.solidarity).toBe(3);
      expect(inf.heritage).toBe(0);
      expect(inf.transformation).toBe(0);
    });

    test("a null (all-wild) promotion contributes nothing", () => {
      const inf = ideologyInfluence([u([W(), W()], null)]);
      expect(inf.solidarity).toBe(0);
      expect(inf.sovereignty).toBe(0);
      expect(inf.transformation).toBe(0);
      expect(inf.heritage).toBe(0);
    });

    test("sums across unlocks by promoted color", () => {
      const inf = ideologyInfluence([
        u([L(2, "solidarity"), L(2, "solidarity")], "solidarity"),
        u([L(3, "solidarity"), L(3, "solidarity")], "solidarity"),
        u([L(4, "heritage"), L(4, "heritage")], "heritage"),
      ]);
      expect(inf.solidarity).toBe(4); // 2 + 2
      expect(inf.heritage).toBe(2);
      expect(inf.sovereignty).toBe(0);
      expect(inf.transformation).toBe(0);
    });
  });

  describe("presentIdeologies", () => {
    test("lists only the non-wild colors in the column", () => {
      const p = presentIdeologies([L(2, "solidarity"), L(2, "solidarity"), L(3, "heritage")]);
      expect(p.sort()).toEqual(["heritage", "solidarity"]);
    });

    test("wilds are swing voters: an all-wild column has NO present ideology ⇒ []", () => {
      expect(presentIdeologies([W(), W()])).toEqual([]);
    });

    test("a wild's literal color does not make that color promotable", () => {
      // 1 heritage + 1 wild (transformation-colored joker): only heritage present.
      expect(presentIdeologies([L(2, "heritage"), W()])).toEqual(["heritage"]);
    });
  });
  ```

- [ ] **Backfill `promotedIdeology` in the `unlockedIdeologyBreakdown` test literals** (lines 118–146 of `tests/projects.test.ts`) so the file type-checks once the field is required. Add `promotedIdeology` to each of the two unlocks:
  - the `projectId: "x"` unlock (line 119): add `promotedIdeology: "solidarity",`
  - the `projectId: "y"` unlock (line 130): add `promotedIdeology: "sovereignty",`

- [ ] **Run the new tests RED** (the implementation does not exist / is still flat). Expected: import error / failing assertions because `presentIdeologies` is missing and `ideologyInfluence` still adds flat `+1`.
  ```
  bun test tests/projects.test.ts
  ```
  Expected output (representative): an error like `Export named 'presentIdeologies' not found in module '.../projects.ts'` (the import fails), so the whole file errors. This is the red state.

- [ ] **Make `promotedIdeology` required** on `ProjectUnlock` in `/Users/elliott/Projects/space-game-demo/src/core/data/projects.ts`. Replace the interface (lines 45–51):
  ```ts
  export interface ProjectUnlock {
    projectId: string;
    pattern: PatternKind;
    turn: number;
    /** Snapshot of the built column at Build time (used for the unlock log). */
    cards: Card[];
    /** Ideology the player promoted at Build. Drives ideologyInfluence ONLY.
     *  null when the built column had no non-wild ideology (all-wild build).
     *  REQUIRED (non-optional): every literal must set it (see P3 test scope) — a
     *  missing value would make ideologyInfluence read out[undefined] ⇒ NaN, so we
     *  force the type system to surface every site at tsc time. */
    promotedIdeology: Ideology | null;
  }
  ```

- [ ] **Add `presentIdeologies`** in `/Users/elliott/Projects/space-game-demo/src/core/data/projects.ts`, immediately above `projectMajority` (before line 162). Promotion reads the **literal** `c.ideology`, never the `countsAs`-resolved value (consistent with `deriveVector`); wilds (`countsAs !== undefined`) and the `"wild"` sentinel are skipped so an all-wild column has no present ideology:
  ```ts
  /** Ideologies with ≥1 non-wild card in the column — the legal promotion
   *  choices at Build. Wilds (countsAs) are swing voters: they never make a
   *  color promotable, so an all-wild column returns []. The legacy "wild"
   *  sentinel (Dissent / old data) is skipped too. */
  export function presentIdeologies(cards: Card[]): Ideology[] {
    const tally = zeroIdeologyBreakdown();
    for (const c of cards) {
      if (c.countsAs !== undefined || c.ideology === "wild") continue;
      tally[c.ideology] += 1;
    }
    return (Object.keys(tally) as Ideology[]).filter((i) => tally[i] > 0);
  }
  ```

- [ ] **Rewrite `ideologyInfluence`** in `/Users/elliott/Projects/space-game-demo/src/core/data/projects.ts` (replace lines 178–186) to count only the promoted color's own non-wild cards. **Keep `projectMajority` (lines 164–176) exactly as-is** — it is still used by the renderer big-counters and the persistence migrator (P4):
  ```ts
  /** Each unlock contributes, to its promotedIdeology, the count of its OWN
   *  non-wild cards of that color. Swing voters: wilds (countsAs) complete the
   *  shape but add no fuel; off-color cards don't fuel the promoted color; a null
   *  promotion (all-wild build) contributes nothing. This is the count-scaled
   *  replacement for the old flat-+1-to-plurality derivation. (deriveVector and
   *  unlockedIdeologyBreakdown — the IDENTITY record — deliberately diverge: they
   *  skip wilds entirely. Do not "unify" the two.) */
  export function ideologyInfluence(unlocks: ProjectUnlock[]): Record<Ideology, number> {
    const out = zeroIdeologyBreakdown();
    for (const u of unlocks) {
      if (u.promotedIdeology === null) continue;
      for (const c of u.cards) {
        if (c.countsAs === undefined && c.ideology === u.promotedIdeology) {
          out[u.promotedIdeology] += 1;
        }
      }
    }
    return out;
  }
  ```

- [ ] **Run the file GREEN.**
  ```
  bun test tests/projects.test.ts
  ```
  Expected output (last lines):
  ```
   <N> pass
   0 fail
  ```
  (All `presentIdeologies`, count-scaled `ideologyInfluence`, `projectMajority`, `unlockedIdeologyBreakdown`, and the unchanged leveling/pattern blocks pass.)

- [ ] **Do NOT commit yet.** Project-wide `tsc` is still red (every other suite's `ProjectUnlock` literal lacks the required field). The commit happens at the end of Task N.3.

---

### Task 21: Finalize `buildColumn` promote logic + its command-level tests

This task completes the core promote branches in `commands.ts` and pins all four with tests in `tests/policyCommands.test.ts` (which already imports `buildColumn`). It still cannot pass a project-wide `tsc`; we run only the targeted file. The `presentIdeologies` import added here.

**Files:**
- Modify: `/Users/elliott/Projects/space-game-demo/src/core/engine/commands.ts` (`buildColumn`, now at the P2-stub signature; its import block line 14–21)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/policyCommands.test.ts` (add a `describe("buildColumn promotion", …)` block; fix the `influenceUnlock` helper + recompute count-scaled draw counts)

**Steps:**

- [ ] **Write the failing `buildColumn` promotion tests first.** In `/Users/elliott/Projects/space-game-demo/tests/policyCommands.test.ts`, add imports for the column builders and `presentIdeologies` is not needed there; we drive `buildColumn` against a real two-row column. Add to the existing import of card helpers (line 25) `roleId` and add `createEmptyColumn`, `placeLand`, `placeInfluence`, `getSetting` is already imported. Append a new describe block at the end of the file:
  ```ts
  import { createEmptyColumn, placeLand, placeInfluence } from "../src/core/engine/column.ts";
  // (extend the existing cards import on line 25 to also bring in roleId)
  // import { getCard, landId, roleId } from "../src/core/data/cards.ts";

  describe("buildColumn promotion", () => {
    const homeworld = getSetting("homeworld");

    /** A live epoch whose single column is the given Column, ready to build. */
    function epochWithColumn(col: ReturnType<typeof createEmptyColumn>): Epoch {
      const ep = makeEpoch();
      ep.columns = [col];
      return ep;
    }

    test("all-wild column ⇒ promotedIdeology: null (auto)", () => {
      const col = createEmptyColumn();
      placeLand(col, getCard("keystone-founding-charter")); // a full joker (land-home)
      placeInfluence(col, getCard("keystone-pioneer")); // a full joker (role-home)
      const ep = epochWithColumn(col);
      const r = buildColumn(ep, homeworld, 0, createRng(1));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.promotedIdeology).toBeNull();
    });

    test("exactly one present ideology ⇒ auto-promotes without a promote arg", () => {
      const col = createEmptyColumn();
      placeLand(col, getCard(landId(2, "solidarity")));
      placeLand(col, getCard(landId(2, "solidarity")));
      placeInfluence(col, getCard(roleId("scholar", "solidarity")));
      const ep = epochWithColumn(col);
      const r = buildColumn(ep, homeworld, 0, createRng(1));
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.promotedIdeology).toBe("solidarity");
    });

    test("≥2 present ideologies + no promote ⇒ rejects", () => {
      const col = createEmptyColumn();
      placeLand(col, getCard(landId(2, "solidarity")));
      placeLand(col, getCard(landId(2, "heritage")));
      placeInfluence(col, getCard(roleId("scholar", "solidarity")));
      const ep = epochWithColumn(col);
      const r = buildColumn(ep, homeworld, 0, createRng(1));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe("Choose an ideology to promote.");
    });

    test("promote not present in the column ⇒ rejects", () => {
      const col = createEmptyColumn();
      placeLand(col, getCard(landId(2, "solidarity")));
      placeLand(col, getCard(landId(2, "heritage")));
      placeInfluence(col, getCard(roleId("scholar", "solidarity")));
      const ep = epochWithColumn(col);
      const r = buildColumn(ep, homeworld, 0, createRng(1), "sovereignty");
      expect(r.ok).toBe(false);
      if (!r.ok)
        expect(r.error).toBe("Cannot promote an ideology not present in the column.");
    });

    test("valid promote among present ⇒ set on the unlock", () => {
      const col = createEmptyColumn();
      placeLand(col, getCard(landId(2, "solidarity")));
      placeLand(col, getCard(landId(2, "heritage")));
      placeInfluence(col, getCard(roleId("scholar", "solidarity")));
      const ep = epochWithColumn(col);
      const r = buildColumn(ep, homeworld, 0, createRng(1), "heritage");
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.promotedIdeology).toBe("heritage");
    });
  });
  ```

  > Note: the exact card ids/ranks above must form a buildable two-row column (a same-rank land pair + a role ⇒ a buildable pattern). If a chosen `landId`/`roleId` does not exist in the Homeworld pool, swap to any valid id — the assertion under test is the `promotedIdeology` value, not the pattern. `keystone-founding-charter` (land-home full joker) + `keystone-pioneer` (role-home full joker) form an all-wild two-row column that resolves to flush (both rows present) — buildable, all-wild ⇒ null.

- [ ] **Run the new buildColumn tests RED** (current `buildColumn` ignores `promote` and never sets `promotedIdeology`, and the stub may not even compile the test file because `r.value.promotedIdeology` is not yet a known property). Expected: failing assertions / a type error on `promotedIdeology`.
  ```
  bun test tests/policyCommands.test.ts
  ```
  Expected: failures in the `buildColumn promotion` block (`promotedIdeology` undefined or the reject branches not firing).

- [ ] **Finalize `buildColumn`** in `/Users/elliott/Projects/space-game-demo/src/core/engine/commands.ts`. First add `presentIdeologies` and the `Ideology` type to the imports (the `../types.ts` import block at lines 5–13 already has the `Card`/`ProjectUnlock` etc.; add `Ideology`; add a named import of `presentIdeologies` from `../data/projects.ts`):
  ```ts
  import type {
    Campaign,
    Card,
    Epoch,
    GameEvent,
    Ideology,
    PolicyCard,
    ProjectUnlock,
    Setting,
  } from "../types.ts";
  import { presentIdeologies } from "../data/projects.ts";
  ```
  Then replace the `buildColumn` body (lines 213–235) with the finalized promote logic:
  ```ts
  export function buildColumn(
    epoch: Epoch,
    setting: Setting,
    columnIndex: number,
    rng: RNG,
    promote?: Ideology,
  ): CmdResult<ProjectUnlock> {
    const blocked = requirePlayable(epoch);
    if (blocked) return blocked;
    const col = epoch.columns[columnIndex];
    if (!col) return { ok: false, error: "Invalid column." };

    const match = evaluateColumn(col, setting.projects);
    if (!match) return { ok: false, error: "Column is not buildable." };

    // Promotion: the player promotes one PRESENT ideology (drives ideologyInfluence).
    // Core auto-promotes the unambiguous cases so headless callers (sim/tests/AI)
    // need not re-implement the picker: 0 present ⇒ null; exactly 1 ⇒ that one;
    // a valid explicit promote ⇒ honored; ≥2 with none chosen ⇒ reject.
    const present = presentIdeologies(match.cards);
    let promotedIdeology: Ideology | null;
    if (present.length === 0) promotedIdeology = null;
    else if (promote && present.includes(promote)) promotedIdeology = promote;
    else if (promote)
      return { ok: false, error: "Cannot promote an ideology not present in the column." };
    else if (present.length === 1) promotedIdeology = present[0];
    else return { ok: false, error: "Choose an ideology to promote." };

    const unlock: ProjectUnlock = {
      projectId: match.projectId,
      pattern: match.kind,
      turn: epoch.turn,
      cards: [...match.cards],
      promotedIdeology,
    };
    dispatch(epoch, { type: "column-built", columnIndex, unlock }, rng);
    return { ok: true, value: unlock };
  }
  ```

- [ ] **Recompute the count-scaled draw counts in `tests/policyCommands.test.ts`.** The `influenceUnlock(ideo, rank)` helper (lines 39–46) builds a same-ideology land pair; with the required field it must now set `promotedIdeology: ideo`, which under count-scaling makes each such unlock contribute **2** (two non-wild cards of the promoted color), not 1. Update the helper and every dependent assertion:

  Replace the helper (lines 39–46):
  ```ts
  /** A built unlock that fuels `ideo` by `count` (default 2): a same-ideology
   *  land pair promoted to `ideo` contributes 2 under count-scaling. */
  function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
    return {
      projectId: `u-${ideo}-${rank}`,
      pattern: "pair",
      turn: 1,
      cards: [L(rank, ideo), L(rank, ideo)],
      promotedIdeology: ideo,
    };
  }
  ```

  In the `"draws ideologyInfluence[I] cards from each ideology's deck"` test (lines 88–109): the unlocks `influenceUnlock("solidarity",2)` + `influenceUnlock("solidarity",3)` now give `infl.solidarity = 4` (2+2), and `influenceUnlock("heritage",4)` gives `infl.heritage = 2`. The decks must supply enough cards and the candidate-count expectations change. Update that test to:
  ```ts
  test("draws ideologyInfluence[I] cards from each ideology's deck", () => {
    const ep = makeEpoch({
      // 2 solidarity pair-unlocks → infl.solidarity = 4; 1 heritage pair → infl.heritage = 2.
      unlocks: [
        influenceUnlock("solidarity", 2),
        influenceUnlock("solidarity", 3),
        influenceUnlock("heritage", 4),
      ],
      decks: {
        solidarity: [
          getPolicy("mobilize"),
          getPolicy("mobilize"),
          getPolicy("mobilize"),
          getPolicy("mobilize"),
          getPolicy("mobilize"),
        ],
        heritage: [getPolicy("continuity"), getPolicy("archive"), getPolicy("continuity")],
      },
    });
    drawPolicies(ep, createRng(1));
    const cands = ep.policy.candidates;
    expect(cands.filter((c) => c.ideology === "solidarity")).toHaveLength(4);
    expect(cands.filter((c) => c.ideology === "heritage")).toHaveLength(2);
    expect(cands).toHaveLength(6);
    // 4 of 5 solidarity drawn; 2 of 3 heritage drawn.
    expect(ep.policy.decks.solidarity).toHaveLength(1);
    expect(ep.policy.decks.heritage).toHaveLength(1);
  });
  ```

  In the `"reshuffles discard into deck when the deck empties mid-draw"` test (lines 120–131): the two solidarity pair-unlocks now require **4** solidarity draws (not 2). Update so deck has 2 + discard has 2 → reshuffle yields all 4:
  ```ts
  test("reshuffles discard into deck when the deck empties mid-draw", () => {
    const ep = makeEpoch({
      // Need 4 solidarity draws; deck has 2, discard has 2 → reshuffle to get all four.
      unlocks: [influenceUnlock("solidarity", 2), influenceUnlock("solidarity", 3)],
      decks: { solidarity: [getPolicy("mobilize"), getPolicy("mobilize")] },
      discards: {
        solidarity: [getPolicy("solidarity-forever"), getPolicy("solidarity-forever")],
      },
    });
    drawPolicies(ep, createRng(7));
    expect(ep.policy.candidates).toHaveLength(4);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
    expect(ep.policy.decks.solidarity).toHaveLength(0);
  });
  ```

  In the `"when deck + discard both run dry, draws fewer than requested"` test (lines 133–143): the two pair-unlocks now request 4 solidarity but only 1 card exists. The assertions still hold (`candidates` length 1, deck + discard empty) — update the comment only:
  ```ts
  test("when deck + discard both run dry, draws fewer than requested", () => {
    const ep = makeEpoch({
      // Need 4 solidarity draws but only 1 card total exists.
      unlocks: [influenceUnlock("solidarity", 2), influenceUnlock("solidarity", 3)],
      decks: { solidarity: [getPolicy("mobilize")] },
    });
    drawPolicies(ep, createRng(3));
    expect(ep.policy.candidates).toHaveLength(1);
    expect(ep.policy.decks.solidarity).toHaveLength(0);
    expect(ep.policy.discards.solidarity).toHaveLength(0);
  });
  ```

  (The `"turn-1 cold open: zero influence draws nothing"` test at lines 111–118 needs no value change — zero unlocks ⇒ zero influence regardless of scaling. The board-verb/enactPolicies/removePolicy blocks do not depend on influence magnitude.)

- [ ] **Extend the cards import** at line 25 of `tests/policyCommands.test.ts` to add `roleId`:
  ```ts
  import { getCard, landId, roleId } from "../src/core/data/cards.ts";
  ```

- [ ] **Run the file GREEN.**
  ```
  bun test tests/policyCommands.test.ts
  ```
  Expected output (last lines):
  ```
   <N> pass
   0 fail
  ```

- [ ] **Do NOT commit yet** — the rest of the project still has un-backfilled `ProjectUnlock` literals; project-wide `tsc` is red until Task N.3.

---

### Task 22: ATOMIC SWEEP — facade/renderer/script threading + backfill EVERY remaining `ProjectUnlock` literal + recompute count-scaled expectations, then one project-wide green commit

This is the atomic step. It is **larger than a 2–5-minute task** — that is expected for a required-field change. There is no isolated red→green micro-loop here: the whole project is uncompilable (un-backfilled literals) until every site below is fixed; the "test" for this step is the **project-wide `bun run typecheck` plus full `bun test` going green**, after which we commit once.

**Files:**
- Modify: `/Users/elliott/Projects/space-game-demo/src/facade/GameAPI.ts` (thread `promote`; widen result; add `promotableIdeologies`)
- Modify: `/Users/elliott/Projects/space-game-demo/src/renderer/GameService.ts` (`buildColumn` gains `promote` arg; add `promotableIdeologies` delegate)
- Modify: `/Users/elliott/Projects/space-game-demo/scripts/analyze-crisis.ts` (build AI passes a `promote` color)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/turnPhase.test.ts` (`influenceUnlock` + recompute)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/effectiveRules.test.ts` (`influenceUnlock` + a `singleUnlock` helper + recompute every scaled expectation)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/crisisflow.test.ts` (`pairUnlock` literal)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/smoke.test.ts` (no `ProjectUnlock` literal — verify only)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/ideology.test.ts` (4 `ProjectUnlock` literals — backfill the required field)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/dispatch.test.ts` (surviving `ProjectUnlock` literal — backfill)
- Modify: `/Users/elliott/Projects/space-game-demo/tests/projectTree.test.ts` (`unlock`/`unlockWith` helpers — backfill the required field; semantic re-point to `promotedIdeology` is P6, here we only keep tsc green)

**Steps:**

- [ ] **Thread `promote` through `GameAPI.buildColumn` and widen its result** in `/Users/elliott/Projects/space-game-demo/src/facade/GameAPI.ts`. Replace the `buildColumn` method (lines 303–308):
  ```ts
  buildColumn(
    columnIndex: number,
    promote?: Ideology,
  ): CommandResult<{ projectId: string; pattern: string; promotedIdeology: Ideology | null }> {
    const r = buildColumnCore(this.epoch, this.setting, columnIndex, this.rng, promote);
    return r.ok
      ? {
          ok: true,
          value: {
            projectId: r.value.projectId,
            pattern: r.value.pattern,
            promotedIdeology: r.value.promotedIdeology,
          },
        }
      : r;
  }
  ```
  (`Ideology` is already imported on line 44 of `GameAPI.ts`.)

- [ ] **Add the `promotableIdeologies` query** to `/Users/elliott/Projects/space-game-demo/src/facade/GameAPI.ts`. Add `presentIdeologies` to the projects import on line 55:
  ```ts
  import { ideologyInfluence, presentIdeologies } from "../core/data/projects.ts";
  ```
  Then add the method right after `buildColumn` (after line ~320):
  ```ts
  /** The promotable ideologies for a column at Build: the non-wild colors of the
   *  column's evaluated pattern cards. [] when the column is not buildable or is
   *  all-wild. The renderer uses this to decide whether to open the picker. */
  promotableIdeologies(columnIndex: number): Ideology[] {
    const col = this.epoch.columns[columnIndex];
    if (!col) return [];
    const match = evaluateColumn(col, this.setting.projects);
    if (!match) return [];
    return presentIdeologies(match.cards);
  }
  ```
  (`evaluateColumn` is already imported on line 52.)

- [ ] **Update `GameService.buildColumn` + add the delegate** in `/Users/elliott/Projects/space-game-demo/src/renderer/GameService.ts`. Add the `Ideology` import (it currently imports only `LegacyUpgrade` from core types on line 6):
  ```ts
  import type { Ideology, LegacyUpgrade } from "../core/types.ts";
  ```
  Replace `buildColumn` (lines 85–87):
  ```ts
  buildColumn(columnIndex: number, promote?: Ideology): void {
    this.run(() => this.api.buildColumn(columnIndex, promote));
  }
  ```
  Add a query delegate in the Queries section (after `validColumns`, around line 64):
  ```ts
  promotableIdeologies(columnIndex: number): Ideology[] {
    return this.api.promotableIdeologies(columnIndex);
  }
  ```

- [ ] **Teach the simulator's build AI to pass a promote color** in `/Users/elliott/Projects/space-game-demo/scripts/analyze-crisis.ts`. The build loop (around lines 296–325) computes `bestCol` from `evaluateColumn`; pass a plurality promote so multi-color builds aren't rejected and the count-scaled fuel path is exercised. Add `projectMajority` to the projects import on line 11:
  ```ts
  import { PATTERNS_IN_ORDER, marginalContribution, projectMajority } from "../src/core/data/projects.ts";
  ```
  Replace the build call at line 316 (`const r = api.buildColumn(bestCol);`) with one that derives a promote color from the evaluated column's cards (plurality; null/undefined falls through to core auto-promote):
  ```ts
  // Promote the column's plurality color so multi-color builds aren't rejected
  // and the count-scaled influence path is exercised. projectMajority returns
  // null on a tie/all-wild; pass undefined so core auto-promotes (or returns null).
  const bestMatch = evaluateColumn(snap.epoch.columns[bestCol], snap.setting.projects);
  const promote = bestMatch ? (projectMajority(bestMatch.cards) ?? undefined) : undefined;
  const r = api.buildColumn(bestCol, promote);
  ```
  > Edge case: if `projectMajority` is null because of a **tie** among ≥2 present colors, `undefined` would make core reject with "Choose an ideology to promote." To be robust, fall back to the first present color on a tie. Replace the two lines above with:
  ```ts
  const bestMatch = evaluateColumn(snap.epoch.columns[bestCol], snap.setting.projects);
  let promote: import("../src/core/types.ts").Ideology | undefined;
  if (bestMatch) {
    const present = api.promotableIdeologies(bestCol);
    promote = projectMajority(bestMatch.cards) ?? present[0] ?? undefined;
  }
  const r = api.buildColumn(bestCol, promote);
  ```

- [ ] **Backfill `tests/turnPhase.test.ts`.** The `influenceUnlock` helper (lines 21–28) needs `promotedIdeology: ideo`. The "opens in policy when candidates exist" test only needs `ideologyInfluence > 0`, which a count-2 unlock still satisfies — no count recompute is required there. Replace the helper:
  ```ts
  /** A built unlock that fuels `ideo` (a same-ideology land pair, count-scaled to
   *  2), so ideologyInfluence[ideo] > 0 and endTurn draws candidates. */
  function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
    return {
      projectId: `u-${ideo}-${rank}`,
      pattern: "pair",
      turn: 1,
      cards: [L(rank, ideo), L(rank, ideo)],
      promotedIdeology: ideo,
    };
  }
  ```
  (The two `endTurn` transition tests at lines 63–86 still pass: one solidarity pair ⇒ `infl.solidarity = 2 > 0` ⇒ `candidates.length > 0`; zero unlocks ⇒ 0 ⇒ no candidates.)

- [ ] **Backfill + recompute `tests/effectiveRules.test.ts`.** Add `promotedIdeology` to `influenceUnlock` and introduce a `singleUnlock` (contributes exactly 1) so the "below per" tests stay meaningful, then recompute every scaled expectation. Replace the helper (lines 14–22):
  ```ts
  /** A pair-unlock that fuels `ideo` by 2 (count-scaled same-ideology land pair). */
  function influenceUnlock(ideo: Ideology, rank: number): ProjectUnlock {
    return {
      projectId: `u-${ideo}-${rank}`,
      pattern: "pair",
      turn: 1,
      cards: [L(rank, ideo), L(rank, ideo)],
      promotedIdeology: ideo,
    };
  }

  /** A single-card unlock that fuels `ideo` by exactly 1 (for below-`per` tests). */
  function singleUnlock(ideo: Ideology, rank: number): ProjectUnlock {
    return {
      projectId: `s-${ideo}-${rank}`,
      pattern: "high-card",
      turn: 1,
      cards: [L(rank, ideo)],
      promotedIdeology: ideo,
    };
  }
  ```
  Recompute each scaled test (Deep Reserves `per = 2`; Solidarity Forever `per = 4`):

  - `"Deep Reserves with 4 transformation influence: +1 base +2 scaled = +3 storage"` (lines 76–85): four pair-unlocks now give `infl.transformation = 8`, so `+1 base + floor(8/2)=4 scaled = +5`. To keep the test's *intent* (4 influence ⇒ +3 storage), use **two** pair-unlocks (2×2 = 4 influence) instead of four. Rewrite:
    ```ts
    test("Deep Reserves with 4 transformation influence: +1 base +2 scaled = +3 storage", () => {
      const unlocks = [
        influenceUnlock("transformation", 2),
        influenceUnlock("transformation", 3),
      ]; // 2 pair-unlocks × 2 = 4 transformation influence
      const r = effectiveRules(makeEpoch([slot("deep-reserves")], unlocks), setting);
      expect(r.storageCapacity).toBe(setting.rules.baseStorageCapacity + 3); // +1 base + floor(4/2)
    });
    ```
  - `"Deep Reserves with influence below per: floor(1/2)=0, base only (+1 storage)"` (lines 99–103): use `singleUnlock` for exactly 1 influence:
    ```ts
    test("Deep Reserves with influence below per: floor(1/2)=0, base only (+1 storage)", () => {
      const unlocks = [singleUnlock("transformation", 2)]; // 1 transformation influence
      const r = effectiveRules(makeEpoch([slot("deep-reserves")], unlocks), setting);
      expect(r.storageCapacity).toBe(setting.rules.baseStorageCapacity + 1);
    });
    ```
  - `"Deep Reserves x2 at 4 influence: (+1 base +2 scaled) x2 stacks = +6 storage"` (lines 111–115): keep 4 influence via two pair-unlocks:
    ```ts
    test("Deep Reserves x2 at 4 influence: (+1 base +2 scaled) x2 stacks = +6 storage", () => {
      const unlocks = [
        influenceUnlock("transformation", 2),
        influenceUnlock("transformation", 3),
      ]; // 4 transformation influence
      const r = effectiveRules(makeEpoch([slot("deep-reserves", 2)], unlocks), setting);
      expect(r.storageCapacity).toBe(setting.rules.baseStorageCapacity + 6); // (1 + floor(4/2)) × 2
    });
    ```
  - `"Solidarity Forever with 8 solidarity influence: handSize +1 base +2 scaled"` (lines 93–97): need 8 solidarity influence = **four** pair-unlocks (4×2 = 8). Rewrite:
    ```ts
    test("Solidarity Forever with 8 solidarity influence: handSize +1 base +2 scaled", () => {
      const unlocks = Array.from({ length: 4 }, (_, i) => influenceUnlock("solidarity", i + 2)); // 8
      const r = effectiveRules(makeEpoch([slot("solidarity-forever")], unlocks), setting);
      expect(r.handSize).toBe(setting.rules.baseHandSize + 3); // +1 base + floor(8/4)=2
    });
    ```
  - `"Solidarity Forever with influence below per: floor(3/4)=0, base only (+1 handSize)"` (lines 105–109): need 3 solidarity influence (below `per = 4`) → one pair-unlock (2) + one single-unlock (1) = 3:
    ```ts
    test("Solidarity Forever with influence below per: floor(3/4)=0, base only (+1 handSize)", () => {
      const unlocks = [influenceUnlock("solidarity", 2), singleUnlock("solidarity", 3)]; // 3
      const r = effectiveRules(makeEpoch([slot("solidarity-forever")], unlocks), setting);
      expect(r.handSize).toBe(setting.rules.baseHandSize + 1);
    });
    ```
  (The Mandate/Stockpile/Conscription/Archive/Continuity tests use no `influenceUnlock` and are unchanged.)

- [ ] **Backfill `tests/crisisflow.test.ts`.** The `pairUnlock` literal (lines 65–70) needs `promotedIdeology`. Its single card is solidarity:
  ```ts
  const pairUnlock = (turn: number): ProjectUnlock => ({
    projectId: "homeworld-commons", // pattern "pair", base value 2
    pattern: "pair",
    turn,
    cards: [getCard(landId(7, "solidarity"))],
    promotedIdeology: "solidarity",
  });
  ```
  (`resolveCrisis` reads only project values, not `promotedIdeology`, so the `2+1+1` leveling assertions are unchanged. The GameAPI-driven tests at lines 10–41 don't build columns, so they are unaffected.)

- [ ] **Verify `tests/smoke.test.ts` needs no `ProjectUnlock` edit.** It has no hand-built `ProjectUnlock` literal (P2 already removed the `col.charter.card === null` read at line 19). The `s.influence.*` assertions (lines 38–41) check **zero** influence before any build, which holds under count-scaling. No change required here in P3 — confirm by inspection.

- [ ] **Backfill `tests/ideology.test.ts`** (owned by P1, but its 4 `ProjectUnlock` literals must gain the required field to keep tsc green). Add `promotedIdeology` to each:
  - line 66 (`projectId: "p-flush"`, all sovereignty cards): add `promotedIdeology: "sovereignty",`
  - line 90 (`projectId: "p-pair"`, solidarity + sovereignty): add `promotedIdeology: "solidarity",` (any present color; `deriveVector` ignores the field)
  - line 102 (`projectId: "unknown"`, two sovereignty): add `promotedIdeology: "sovereignty",`
  - line 125 (`projectId: "x"`, solidarity + heritage): add `promotedIdeology: "solidarity",`
  (These tests assert `deriveVector`/`unlockedIdeologyBreakdown` outputs, which never read `promotedIdeology`, so the chosen value is immaterial — it only satisfies the type.)

- [ ] **Backfill `tests/dispatch.test.ts`** (rewritten in P2). Its surviving `ProjectUnlock` literal (the `column-built` test, currently at ~line 79) needs `promotedIdeology`. After P2's two-row rewrite the literal builds from `col.lands.cards` + influence cards; add `promotedIdeology: "solidarity",` (or whatever color matches the test's cards — the dispatch handler pushes the unlock whole and does not read the field, so any valid value satisfies tsc). Locate the `const unlock: ProjectUnlock = {` literal and append the field before the closing brace.

- [ ] **Backfill `tests/projectTree.test.ts`** (semantic re-point is P6; here only keep tsc green). The `unlock` helper (lines 17–24) and `unlockWith` helper (lines 26–32) build `ProjectUnlock`s without the field. Add `promotedIdeology` to both — for `unlock` (single solidarity card) use `"solidarity"`; for `unlockWith` derive nothing yet (P6 owns the semantics), just pass `null` so the field is present:
  ```ts
  function unlock(pattern: ProjectUnlock["pattern"], turn: number): ProjectUnlock {
    return {
      projectId: `test-${pattern}`,
      pattern,
      turn,
      cards: [getCard(landId(7, "solidarity"))],
      promotedIdeology: "solidarity",
    };
  }

  function unlockWith(
    pattern: ProjectUnlock["pattern"],
    turn: number,
    cards: ProjectUnlock["cards"],
  ): ProjectUnlock {
    return { projectId: `test-${pattern}`, pattern, turn, cards, promotedIdeology: null };
  }
  ```
  > Note: `buildProjectTree` today still derives big-counter majorities from `projectMajority(u.cards)` (P6 re-points it to `u.promotedIdeology`). With `unlock` carrying a solidarity card, `projectMajority` returns solidarity, so the existing big-counter assertions in `projectTree.test.ts` continue to pass under the P3 field-add. If any assertion there reads a majority that `projectMajority` would now compute differently, leave it — P6 owns the re-point. If P3's field-add alone breaks an assertion, set `unlock`/`unlockWith`'s `promotedIdeology` to match what the test expects rather than changing the assertion.

- [ ] **Run the project-wide typecheck.** This is the gate for the atomic change — it must surface zero errors anywhere (core, facade, renderer, tests; `scripts/` is outside `tsconfig.include` but is still imported at `bun test` time).
  ```
  bun run typecheck
  ```
  Expected output: no output / exit 0 (i.e. `tsc --noEmit` prints nothing on success). If any `ProjectUnlock` literal is still missing `promotedIdeology`, `tsc` reports `Property 'promotedIdeology' is missing in type '{ … }' but required in type 'ProjectUnlock'` — fix that literal and re-run until clean. This is the safety net that proves every site was hit.

- [ ] **Run the full test suite.**
  ```
  bun test
  ```
  Expected output (last lines):
  ```
   <N> pass
   0 fail
  ```
  All suites green: `projects.test.ts` (count-scaled influence + presentIdeologies), `policyCommands.test.ts` (buildColumn promote branches + recomputed draw counts), `turnPhase.test.ts`, `effectiveRules.test.ts` (recomputed scale thresholds), `crisisflow.test.ts`, `smoke.test.ts`, `ideology.test.ts`, `dispatch.test.ts`, `projectTree.test.ts`, and all P0–P2 suites.

- [ ] **Smoke-run the simulator** to confirm the build AI's `promote` arg keeps multi-color builds from being rejected (no exceptions, non-zero builds):
  ```
  bun run scripts/analyze-crisis.ts 30 homeworld
  ```
  Expected: the report prints win-rate / margin / per-pattern unlock counts without throwing, and per-pattern unlock counts are non-zero (the build AI is successfully building). A balance **re-baseline** of `CRISIS.difficulty` is explicitly **deferred** (spec §9) — do not retune difficulty in this phase; just confirm the path runs.

- [ ] **Commit the entire atomic change as one commit:**
  ```
  git add -A && git commit -m "feat(core): required promotedIdeology + count-scaled ideologyInfluence

Make ProjectUnlock.promotedIdeology a required Ideology|null field, add
presentIdeologies, rewrite ideologyInfluence to count only the promoted
color's own non-wild cards (swing-voter wilds + off-color excluded), and
finalize buildColumn promote branches (0->null, 1->auto, >=2->choose,
not-present->reject). Thread promote through GameAPI/GameService, add
promotableIdeologies, teach the simulator build AI to pass a promote color,
and backfill every ProjectUnlock literal + recompute count-scaled draw/scale
expectations across all suites. Atomic: the required field breaks every
literal project-wide at once.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```


---

## Phase P4 — Persistence v6→v7 migration (strip charter, backfill `promotedIdeology`)

**Not atomic.** Depends on P2 (charter removed from `Column`) and P3 (`ProjectUnlock.promotedIdeology` now a required field) having already landed — the v7 type shape is in place, so these commits compile against the post-P3 codebase. Three tasks, each red→green→commit.

> **Runtime note (load-bearing):** in the Bun test runtime `typeof localStorage === "undefined"` (verified), so `loadStore()` early-returns `emptyStore()` and the migration code is never exercised. The persistence test **must** install a `Map`-backed `globalThis.localStorage` stub in `beforeEach` and tear it down in `afterEach`, or every migration assertion silently passes against an empty store. This is the single most important detail in Task 1.

---

### Task 23: Write the failing `tests/persistence.test.ts` migration suite

**Files:**
- Create `tests/persistence.test.ts`

This test is written FIRST and must fail because `migrateV6toV7` and the v7 keys do not exist yet (`loadStore` still reads `deck-demo-saves-v6` and returns it as-is, so a v6 store is returned unmigrated — charter still present, `promotedIdeology` still `undefined`, `version` still `6`).

- [ ] Create `tests/persistence.test.ts` with a `Map`-backed `localStorage` stub and the full migration assertions:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { land } from "../src/core/data/cards.ts";
import { projectMajority } from "../src/core/data/projects.ts";
import { loadStore } from "../src/facade/persistence.ts";

// ---------------------------------------------------------------------------
// localStorage stub — Bun's test runtime has no `localStorage`, so without this
// loadStore() early-returns emptyStore() and the migrator is never exercised.
// ---------------------------------------------------------------------------
function installLocalStorage(): Map<string, string> {
  const map = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as { localStorage?: unknown }).localStorage = stub;
  return map;
}

const V7_KEY = "deck-demo-saves-v7";
const V6_KEY = "deck-demo-saves-v6";
const V6_ARCHIVE_KEY = "deck-demo-saves-v6-archive";

/** A minimal v6 save slot: one column with a charter row, two unlocks (one a
 *  solidarity-majority pair → migrates to "solidarity", one an all-wild/tie
 *  build → migrates to null). `promotedIdeology` is intentionally absent. */
function v6SaveStore() {
  const solPair = [land(2, "solidarity"), land(2, "solidarity"), land(3, "heritage")];
  // sanity: projectMajority(solPair) === "solidarity"
  return {
    version: 6,
    activeSlotId: "slot-a",
    slots: [
      {
        id: "slot-a",
        label: "E1 · Homeworld · T3",
        createdAt: 1,
        lastPlayedAt: 2,
        state: {
          version: 6,
          settingId: "homeworld",
          seed: 7,
          endOfEpoch: null,
          campaign: { seed: 7 },
          epoch: {
            columns: [
              {
                lands: { cards: [land(2, "solidarity")] },
                influence: { cards: [] },
                charter: { card: land(9, "solidarity") }, // dead field — must be deleted
                storage: [],
              },
            ],
            unlockedProjects: [
              { projectId: "p-sol", pattern: "pair", turn: 1, cards: solPair }, // → "solidarity"
              { projectId: "p-tie", pattern: "high-card", turn: 2, cards: [] }, // all-wild → null
            ],
          },
        },
      },
    ],
  };
}

let store: Map<string, string>;
beforeEach(() => {
  store = installLocalStorage();
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("persistence v6 → v7 migration", () => {
  test("migrates a v6 save: charter dropped, promotedIdeology backfilled, version 7", () => {
    store.set(V6_KEY, JSON.stringify(v6SaveStore()));

    const migrated = loadStore();

    expect(migrated.version).toBe(7);
    expect(migrated.slots).toHaveLength(1);
    const slot = migrated.slots[0];
    expect(slot.state.version).toBe(7);

    // Charter field stripped from every column.
    const col = slot.state.epoch.columns[0] as Record<string, unknown>;
    expect("charter" in col).toBe(false);

    // promotedIdeology backfilled via projectMajority (solidarity), null retained on tie.
    const unlocks = slot.state.epoch.unlockedProjects;
    expect(unlocks[0].promotedIdeology).toBe("solidarity");
    expect(unlocks[1].promotedIdeology).toBe(null);
  });

  test("backfill matches projectMajority exactly", () => {
    const raw = v6SaveStore();
    const cards = raw.slots[0].state.epoch.unlockedProjects[0].cards;
    store.set(V6_KEY, JSON.stringify(raw));

    const migrated = loadStore();
    expect(migrated.slots[0].state.epoch.unlockedProjects[0].promotedIdeology).toBe(
      projectMajority(cards),
    );
  });

  test("archives the raw v6 string to v6-archive and removes the v6 key", () => {
    const raw = JSON.stringify(v6SaveStore());
    store.set(V6_KEY, raw);

    loadStore();

    expect(store.get(V6_ARCHIVE_KEY)).toBe(raw); // RAW, unmigrated string
    expect(store.has(V6_KEY)).toBe(false);
    // Migrated store written under the v7 key.
    expect(JSON.parse(store.get(V7_KEY)!).version).toBe(7);
  });

  test("a v7 store is returned as-is (no re-migration)", () => {
    const v7 = { version: 7, activeSlotId: null, slots: [] };
    store.set(V7_KEY, JSON.stringify(v7));

    const loaded = loadStore();
    expect(loaded.version).toBe(7);
    expect(loaded.slots).toHaveLength(0);
    // v6 archival untouched when v7 already present.
    expect(store.has(V6_ARCHIVE_KEY)).toBe(false);
  });

  test("a corrupt slot is dropped without throwing", () => {
    const raw = v6SaveStore();
    // Second slot has a null state → migrator must skip it, not crash.
    raw.slots.push({
      id: "slot-bad",
      label: "corrupt",
      createdAt: 0,
      lastPlayedAt: 0,
      state: null as unknown as (typeof raw.slots)[0]["state"],
    });
    store.set(V6_KEY, JSON.stringify(raw));

    let migrated!: ReturnType<typeof loadStore>;
    expect(() => {
      migrated = loadStore();
    }).not.toThrow();
    // Good slot survives; corrupt slot dropped.
    expect(migrated.slots).toHaveLength(1);
    expect(migrated.slots[0].id).toBe("slot-a");
  });

  test("totally corrupt v6 JSON falls through to an empty v7 store", () => {
    store.set(V6_KEY, "{not json");
    const migrated = loadStore();
    expect(migrated.version).toBe(7);
    expect(migrated.slots).toHaveLength(0);
  });

  test("no localStorage ⇒ empty v7 store, no throw", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    const migrated = loadStore();
    expect(migrated.version).toBe(7);
    expect(migrated.slots).toHaveLength(0);
  });
});
```

- [ ] Run the test and confirm it FAILS (the migrator and v7 keys don't exist yet; `loadStore` returns the v6 store unmigrated so `version` is `6`, `promotedIdeology` is `undefined`, `charter` is still present):

```
bun test tests/persistence.test.ts
```

Expected output: failures on the migration assertions, e.g.

```
error: expect(received).toBe(expected)
  Expected: 7
  Received: 6
      at .../tests/persistence.test.ts  (migrates a v6 save…)
...
 X fail
```

(The `loadStore` import resolves — `persistence.ts` exists — but it has no v7 branch, so the assertions on `version === 7`, `promotedIdeology`, and the dropped charter all fail. The "no localStorage" and "totally corrupt JSON" tests may already pass since `loadStore` returns `emptyStore()` on those paths, but with `version: 6` they will fail the `toBe(7)` check until Task 2.)

- [ ] Commit the failing test:

```
git add tests/persistence.test.ts
git commit -m "test(persistence): failing v6→v7 migration suite (charter strip + promotedIdeology backfill)"
```

---

### Task 24: Implement `migrateV6toV7` + v7 keys + restructured `loadStore`

**Files:**
- Modify `src/facade/persistence.ts` (keys `:7-9`; `SavedState`/`SaveStore`/`emptyStore` version literals `:14,32,37`; `loadStore` `:40-58`; add migrator + imports)

- [ ] Add the core imports at the top of `src/facade/persistence.ts` (after the existing `import type` lines `:4-5`):

```ts
import { projectMajority } from "../core/data/projects.ts";
import type { ProjectUnlock } from "../core/types.ts";
```

- [ ] Bump the three key constants (`:7-9`) to v7-relative:

```ts
const STORE_KEY = "deck-demo-saves-v7";
const PREV_KEY = "deck-demo-saves-v6";
const ARCHIVE_KEY = "deck-demo-saves-v6-archive";
```

- [ ] Flip the three `version` literals together (`SavedState.version` `:14`, `SaveStore.version` `:32`, and `emptyStore()` `:37`) — they are a literal-union type so they must all move at once or `tsc` fails:

`SavedState`:
```ts
export interface SavedState {
  version: 7;
```

`SaveStore`:
```ts
export interface SaveStore {
  version: 7;
```

`emptyStore`:
```ts
function emptyStore(): SaveStore {
  return { version: 7, activeSlotId: null, slots: [] };
}
```

- [ ] Add `migrateV6toV7` directly above `loadStore` (a pure, defensive per-slot transform — never throws on a partial save; corrupt slots are dropped, not fatal). It strips the dead `charter` field from every column and backfills `promotedIdeology` via `projectMajority`, retaining `null`:

```ts
/** In-place migrate a parsed v6 store to v7: strip the dead `charter` row from
 *  every column, and backfill each unlock's `promotedIdeology` via
 *  projectMajority (color choice faithful, magnitude rescaled to match a fresh
 *  run — NOT the pre-redesign flat-1 magnitude). Corrupt slots are dropped, not
 *  fatal; the whole call is wrapped in try/catch by loadStore. */
function migrateV6toV7(parsed: { activeSlotId: string | null; slots: unknown[] }): SaveStore {
  const slots: SaveSlot[] = [];
  for (const rawSlot of parsed.slots) {
    try {
      const slot = rawSlot as SaveSlot;
      const epoch = slot.state.epoch as unknown as {
        columns: Array<Record<string, unknown>>;
        unlockedProjects: Array<ProjectUnlock & { cards: unknown }>;
      };
      for (const col of epoch.columns ?? []) {
        delete col.charter;
      }
      for (const u of epoch.unlockedProjects ?? []) {
        if (u.promotedIdeology === undefined) {
          u.promotedIdeology = projectMajority((u.cards as ProjectUnlock["cards"]) ?? []);
        }
      }
      slot.state.version = 7;
      slots.push(slot);
    } catch {
      // drop the corrupt slot, keep migrating the rest
    }
  }
  const activeSlotId =
    parsed.activeSlotId && slots.some((s) => s.id === parsed.activeSlotId)
      ? parsed.activeSlotId
      : (slots[slots.length - 1]?.id ?? null);
  return { version: 7, activeSlotId, slots };
}
```

- [ ] Replace the body of `loadStore` (`:40-58`) with the explicit ordered branches from §7, and DELETE the old v5-archival block entirely:

```ts
export function loadStore(): SaveStore {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    // 1. Current v7 store — return as-is.
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SaveStore;
      if (parsed.version === 7 && Array.isArray(parsed.slots)) return parsed;
    }
    // 2. Previous v6 store — migrate, persist under v7, archive the raw string.
    const prevRaw = localStorage.getItem(PREV_KEY);
    if (prevRaw) {
      const prev = JSON.parse(prevRaw) as { version?: number; activeSlotId: string | null; slots?: unknown[] };
      if (prev.version === 6 && Array.isArray(prev.slots)) {
        const migrated = migrateV6toV7(prev as { activeSlotId: string | null; slots: unknown[] });
        writeStore(migrated);
        localStorage.setItem(ARCHIVE_KEY, prevRaw); // raw, unmigrated v6
        localStorage.removeItem(PREV_KEY);
        return migrated;
      }
    }
  } catch {
    // corrupted — start fresh
  }
  return emptyStore();
}
```

Note the migrate branch must run `writeStore(migrated)` BEFORE archiving so the v7 key holds the migrated store (the test asserts `JSON.parse(store.get(V7_KEY)).version === 7`), and it archives `prevRaw` (the **raw** unmigrated string, satisfying `expect(store.get(V6_ARCHIVE_KEY)).toBe(raw)`).

- [ ] Run the persistence test to green:

```
bun test tests/persistence.test.ts
```

Expected output:

```
 7 pass
 0 fail
```

- [ ] Run the full suite + typecheck to confirm nothing else regressed (the key/version bump and new imports touch the project-wide type graph):

```
bun test && bun run typecheck
```

Expected output: all tests pass; `tsc --noEmit` exits 0 with no output.

- [ ] Commit:

```
git add src/facade/persistence.ts
git commit -m "feat(persistence): bump save store v6→v7 with charter-strip + promotedIdeology migrator"
```

---

### Task 25: Defensive `promotedIdeology ??= null` backfill + v7 in `GameAPI`

**Files:**
- Modify `src/facade/GameAPI.ts` (`exportState` version `:109`; v6 comments `:91-93,107-116,185-187`; constructor load path `:88-94`; `loadFromState` `:181-189`)

This is the belt-and-suspenders backfill from §7: it runs AFTER the migrator and only fills a STILL-`undefined` `promotedIdeology` to `null`, never overwriting a migrator-set real `null`. It catches hand-edited or migrator-skipped saves so `ideologyInfluence` never does `out[undefined] += n ⇒ NaN`.

- [ ] Add a failing assertion to `tests/persistence.test.ts` that drives the `GameAPI` defensive loop. Add this `describe` block at the end of the file (it constructs a `GameAPI` over a save whose unlock still has `promotedIdeology === undefined` after a hand-edit, and asserts the loaded epoch reads `null`, not `undefined`). First add the import at the top of the file:

```ts
import { GameAPI } from "../src/facade/GameAPI.ts";
```

Then append:

```ts
describe("GameAPI defensive promotedIdeology backfill", () => {
  test("a loaded unlock with undefined promotedIdeology is defaulted to null", () => {
    // A v7 store whose unlock somehow still lacks promotedIdeology (hand-edit /
    // migrator-skipped). The migrator isn't involved here — the constructor's
    // defensive loop must fill undefined → null so influence math stays a number.
    const v7 = {
      version: 7,
      activeSlotId: "slot-x",
      slots: [
        {
          id: "slot-x",
          label: "E1 · Homeworld · T1",
          createdAt: 1,
          lastPlayedAt: 1,
          state: {
            version: 7,
            settingId: "homeworld",
            seed: 3,
            endOfEpoch: null,
            campaign: { seed: 3, currentSettingId: "homeworld" },
            epoch: {
              turnPhase: "play",
              columns: [],
              unlockedProjects: [
                { projectId: "p", pattern: "pair", turn: 1, cards: [] }, // no promotedIdeology
              ],
            },
          },
        },
      ],
    };
    store.set(V7_KEY, JSON.stringify(v7));

    const api = new GameAPI(1);
    const snap = api.snapshot();
    const u = snap.epoch.unlockedProjects[0] as { promotedIdeology: unknown };
    expect(u.promotedIdeology).toBe(null);
  });
});
```

- [ ] Run it and confirm it FAILS (the constructor does not yet backfill, so the loaded unlock keeps `promotedIdeology === undefined`):

```
bun test tests/persistence.test.ts
```

Expected output:

```
error: expect(received).toBe(expected)
  Expected: null
  Received: undefined
      at .../tests/persistence.test.ts  (a loaded unlock with undefined promotedIdeology…)
 1 fail
 7 pass
```

(`new GameAPI(1)` calls `loadStore()` → returns the v7 store as-is → loads the epoch unchanged; `snapshot()` clones the unlock whole, so `promotedIdeology` stays `undefined`.)

- [ ] In `src/facade/GameAPI.ts`, bump `exportState`'s version literal (`:109`) to `7`:

```ts
  exportState(): SavedState {
    return {
      version: 7,
```

- [ ] Add the defensive backfill in the constructor's active-slot branch. Replace the existing `turnPhase` default block (`:91-94`) with both the `turnPhase` default and the new `promotedIdeology` loop:

```ts
      this.epoch = saved.epoch;
      // Defensive: a v6 save predating `turnPhase` would otherwise load
      // `undefined` and lock the board (every verb gated off the play phase).
      if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
      // Defensive: runs AFTER migrateV6toV7's projectMajority backfill — only
      // fills a STILL-undefined promotedIdeology (hand-edit / migrator-skipped)
      // to null, never overwriting a migrator-set real null. Keeps
      // ideologyInfluence from doing out[undefined] += n ⇒ NaN.
      for (const u of this.epoch.unlockedProjects) {
        if (u.promotedIdeology === undefined) u.promotedIdeology = null;
      }
      this.endOfEpoch = saved.endOfEpoch;
      this.rng = createRng(saved.seed);
```

- [ ] Add the same loop in `loadFromState` (`:181-189`), after the `turnPhase` default:

```ts
  private loadFromState(state: SavedState): void {
    this.campaign = state.campaign;
    this.setting = getSetting(state.settingId);
    this.epoch = state.epoch;
    // Defensive: an older save may predate `turnPhase`. Default to "play" so a
    // loaded epoch is immediately interactive.
    if (this.epoch.turnPhase === undefined) this.epoch.turnPhase = "play";
    // Defensive: fill any still-undefined promotedIdeology to null (see ctor).
    for (const u of this.epoch.unlockedProjects) {
      if (u.promotedIdeology === undefined) u.promotedIdeology = null;
    }
    this.endOfEpoch = state.endOfEpoch;
    this.rng = createRng(state.seed);
  }
```

Note: because `ProjectUnlock.promotedIdeology` is a required `Ideology | null` after P3, the `=== undefined` comparison and the `= null` assignment both type-check (a freshly loaded save object can structurally carry `undefined` at runtime even though the type says it cannot — TS narrows the comparison and `null` satisfies the field type). Confirm with `bun run typecheck`.

- [ ] Update the stale `v6` doc comments to `v7`/"pre-promotion" at the load-path comment sites (`:91-93` covered above; `:185-187` covered above). If any remaining `// v6` reference exists in `exportState`'s surrounding comment block, change it to `v7`. Verify there are no lingering `v6` mentions in load/export paths:

```
grep -n "v6\|version 6" src/facade/GameAPI.ts
```

Expected output: no lines (or only the migration-history comments you intend to keep, none referring to the live store version).

- [ ] Run the persistence test to green:

```
bun test tests/persistence.test.ts
```

Expected output:

```
 8 pass
 0 fail
```

- [ ] Run the full suite + typecheck:

```
bun test && bun run typecheck
```

Expected output: all tests pass; `tsc --noEmit` exits 0 with no output.

- [ ] Commit:

```
git add src/facade/GameAPI.ts tests/persistence.test.ts
git commit -m "feat(facade): defensive promotedIdeology backfill + v7 exportState on load paths"
```


---

## Phase P5 — Add reka-ui + reusable accessible `Modal.vue`

**Not atomic.** Two independent renderer-infra tasks. Neither touches `core`/`facade` or any existing component, so every existing `bun test` and `bun run typecheck` stays green throughout. This phase has **no Bun unit tests** — the repo's test runner (`bun test tests/`) only covers pure `core`/`facade` logic; there is no DOM/component test harness, and adding one is out of scope. The green gate for these renderer tasks is therefore **`bun run typecheck` (vue-tsc over `src/**` + `tests/**`) + full `bun test` staying green + `bun run build` succeeding** (Vite compiles + type-checks every SFC it bundles, so a broken `Modal.vue` fails the build). `reka-ui` ships its own `.d.ts` types, so `vue-tsc` resolves the imports with no `@types` shim.

Dependency note: this phase depends on nothing (only the new dependency). It can run in parallel with P0–P4. `PromotionPicker.vue` (P6) consumes `Modal.vue` from here.

---

### Task 26: Add the `reka-ui` dependency

**Files:**
- Modify: `/Users/elliott/Projects/space-game-demo/package.json` (adds `reka-ui` under `dependencies`, alongside `vue` at lines 28–31)
- Modify: `/Users/elliott/Projects/space-game-demo/bun.lock` (regenerated by `bun add`)

**Pre-flight (verify the package is not already present):**

- [ ] Confirm `reka-ui` is not yet installed (expected: not present):
  ```bash
  ls /Users/elliott/Projects/space-game-demo/node_modules/reka-ui 2>/dev/null && echo "ALREADY INSTALLED" || echo "NOT INSTALLED — proceed"
  ```
  Expected output: `NOT INSTALLED — proceed`

**Add the dependency:**

- [ ] Install `reka-ui` (Reka UI v2, headless Vue 3 primitives — verified current major against the live docs at `/unovue/reka-ui`):
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun add reka-ui
  ```
  Expected: bun reports `installed reka-ui@2.x.x` (v2 line) and updates `bun.lock`. No peer-dependency error against `vue@^3.5.38` (Reka UI v2 targets Vue 3.5+).

- [ ] Verify it landed in `package.json` under `dependencies`:
  ```bash
  grep -n '"reka-ui"' /Users/elliott/Projects/space-game-demo/package.json
  ```
  Expected output (a single line inside the `dependencies` block, e.g.):
  ```
  31:    "reka-ui": "^2.x.x"
  ```

- [ ] Verify the package resolves with its own bundled types (no `@types/reka-ui` needed):
  ```bash
  ls /Users/elliott/Projects/space-game-demo/node_modules/reka-ui/dist/index.d.ts && echo "TYPES PRESENT"
  ```
  Expected output ends with: `TYPES PRESENT`

**Gate — nothing else changed, so the whole project must still be green:**

- [ ] Typecheck the whole project (the new dependency must not perturb anything):
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun run typecheck
  ```
  Expected: no output / exit code 0 (vue-tsc `--noEmit` passes; no errors anywhere in `src/**` or `tests/**`).

- [ ] Run the full test suite (unaffected — pure core/facade tests):
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test tests
  ```
  Expected: all suites pass, `0 fail` (identical to the pre-task baseline; adding a dependency changes no behavior).

**Commit:**

- [ ] Stage and commit:
  ```bash
  cd /Users/elliott/Projects/space-game-demo && git add package.json bun.lock && git commit -m "build(deps): add reka-ui for headless accessible Dialog primitives"
  ```
  (Pre-commit hook runs oxlint/prettier on staged files + `tsc --noEmit` project-wide — `package.json`/`bun.lock` are not source, so only the project typecheck runs; it passes from the gate above.)

---

### Task 27: Build the reusable accessible `Modal.vue` on Reka UI's Dialog primitives

A shared scrim + dialog wrapper: controlled `open`, three named slots (`header` / default body / `footer`), accessible by construction (role=dialog + aria-modal + focus trap via Reka's `modal` mode; labelled/described via `DialogTitle`/`DialogDescription`), and an optional **non-dismissable** mode for "resolution required" flows (suppresses Esc + outside-click close).

**Reka UI v2 API (verified live against `/unovue/reka-ui`, do NOT change these):**
- Named exports from `'reka-ui'`: `DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription`.
- `DialogRoot` is controlled via `:open` + `@update:open` (equivalently `v-model:open`); `modal` prop defaults `true` → focus is auto-trapped inside `DialogContent` and outside content is inert + hidden from screen readers.
- `DialogContent` renders `role="dialog"` + `aria-modal="true"`; it wires `aria-labelledby` to the rendered `DialogTitle` and `aria-describedby` to the rendered `DialogDescription` automatically.
- Dismiss events on `DialogContent` (kebab-case in template; emit names `escapeKeyDown` / `pointerDownOutside`): `@escape-key-down` (KeyboardEvent) and `@pointer-down-outside` (PointerDownOutsideEvent). Calling `event.preventDefault()` cancels that dismissal — this is how non-dismissable mode is implemented.

**Files:**
- Create: `/Users/elliott/Projects/space-game-demo/src/renderer/components/core/Modal.vue` (new shared primitive in the `core/` bucket — pure visual chrome, no game-state knowledge, matching the bucket's contract: see `Panel.vue`, `ConfirmDialog.vue`)

**Step 1 — write the component (no failing-test step: this phase has no DOM test runner; the build/typecheck is the gate, as noted above).**

- [ ] Create `/Users/elliott/Projects/space-game-demo/src/renderer/components/core/Modal.vue` with exactly this content. Theme tokens (`--scrim`, `--paper`, `--shadow-lifted`, `--space-*`) are the existing ones from `theme.css`; z-index `200` matches `ConfirmDialog.vue`'s overlay so this sits above the policy gate (z 70) and crisis screen (z 100), consistent with the existing top-of-stack modal:

  ```vue
  <template>
    <!--
      Reusable accessible modal built on Reka UI's headless Dialog. Reka's
      `modal` (default true) traps focus inside DialogContent, makes the rest of
      the page inert, and hides it from screen readers. DialogContent renders
      role="dialog" + aria-modal and is labelled/described by DialogTitle/
      DialogDescription. When `dismissable` is false (resolution-required
      flows), Esc and outside-pointer dismissals are cancelled with
      preventDefault so the dialog can only be closed programmatically.
    -->
    <DialogRoot :open="open" @update:open="onUpdateOpen">
      <DialogPortal>
        <DialogOverlay class="modal-scrim" />
        <DialogContent
          class="modal-dialog"
          @escape-key-down="onEscapeKeyDown"
          @pointer-down-outside="onPointerDownOutside"
        >
          <header class="modal-head">
            <DialogTitle class="modal-title">{{ title }}</DialogTitle>
            <slot name="header" />
          </header>

          <!-- Visually-hidden description keeps aria-describedby satisfied even
               when callers pass none; Reka warns in dev if absent. -->
          <DialogDescription v-if="description" class="modal-desc">
            {{ description }}
          </DialogDescription>
          <DialogDescription v-else class="sr-only">{{ title }}</DialogDescription>

          <div class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-foot">
            <slot name="footer" />
          </footer>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </template>

  <script setup lang="ts">
  import {
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogRoot,
    DialogTitle,
  } from "reka-ui";

  const props = withDefaults(
    defineProps<{
      /** Controlled open state. */
      open: boolean;
      /** Required accessible title (rendered as the dialog heading + aria-labelledby). */
      title: string;
      /** Optional accessible description (aria-describedby). Falls back to the title. */
      description?: string;
      /**
       * When false, the dialog cannot be dismissed by Esc or an outside click —
       * only a programmatic close (parent flipping `open`) will close it. Use for
       * "resolution required" gates (e.g. the promotion picker). Default true.
       */
      dismissable?: boolean;
    }>(),
    {
      description: undefined,
      dismissable: true,
    },
  );

  const emit = defineEmits<{
    /** Mirrors Reka's controlled-open contract: the parent owns `open`. */
    "update:open": [value: boolean];
    /** Fired only when the dialog requests a close (dismissable closes / programmatic false). */
    close: [];
  }>();

  function onUpdateOpen(value: boolean): void {
    emit("update:open", value);
    if (!value) emit("close");
  }

  function onEscapeKeyDown(event: KeyboardEvent): void {
    if (!props.dismissable) event.preventDefault();
  }

  function onPointerDownOutside(event: Event): void {
    if (!props.dismissable) event.preventDefault();
  }
  </script>

  <style scoped>
  .modal-scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    /* Above existing modals (crisis 100, policy gate 70); matches ConfirmDialog. */
    z-index: 200;
  }

  .modal-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 201;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    width: 100%;
    max-width: min(92vw, 560px);
    max-height: 90vh;
    overflow: auto;
    padding: var(--space-5);
    background: var(--paper);
    box-shadow: var(--shadow-lifted);
  }

  .modal-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .modal-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: var(--ink);
  }
  .modal-desc {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-muted);
  }
  .modal-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .modal-foot {
    display: flex;
    gap: var(--space-2);
    justify-content: flex-end;
    margin-top: var(--space-1);
  }

  /* Accessible-but-invisible: keeps DialogDescription in the a11y tree without
     showing it when no `description` prop is given. */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  </style>
  ```

**Step 2 — gate: the build and typecheck must pass (this is the test for an SFC with no unit harness).**

- [ ] Typecheck the whole project — vue-tsc must resolve the `reka-ui` imports, the slot usage, and the `defineProps`/`defineEmits` generics with no error:
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun run typecheck
  ```
  Expected: no output / exit code 0. (If `reka-ui` were missing or an export name were wrong, vue-tsc would emit `Cannot find module 'reka-ui'` or `'DialogContent' has no exported member` here — both are caught at this step.)

- [ ] Production build — Vite compiles every SFC it can reach plus runs the type-check path; a malformed `Modal.vue` template/script breaks it:
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun run build
  ```
  Expected: `vite build` completes with `✓ built in …` and no errors. (`Modal.vue` is not yet imported by any component, so this proves it compiles standalone; P6 wires it into `PromotionPicker.vue`.)

- [ ] Full test suite still green (unchanged — no core/facade touched):
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun test tests
  ```
  Expected: all suites pass, `0 fail`.

- [ ] Lint/format the new file (matches the pre-commit hook so the commit's hook stage is a no-op):
  ```bash
  cd /Users/elliott/Projects/space-game-demo && bun run lint src/renderer/components/core/Modal.vue && bun run format:check src/renderer/components/core/Modal.vue
  ```
  Expected: oxlint reports `0 warnings, 0 errors`; prettier reports the file is already formatted (no `[warn]`). If prettier flags it, run `bun run format src/renderer/components/core/Modal.vue` and re-check.

**Step 3 — record the out-of-scope retrofit (note only; do NOT touch other modals).**

- [ ] Confirm `PolicyHandModal.vue` and the other existing modals are **left untouched** in this phase. Their hand-rolled `.policy-modal-scrim` / `.confirm-overlay` are NOT migrated onto `Modal.vue` here — that retrofit is explicit future cleanup (per the spec dev-note: "Retrofitting PolicyHandModal / other existing modals onto the new reusable Modal is OUT OF SCOPE"). Only `PromotionPicker.vue` (P6) will consume `Modal.vue`. Verify nothing else imports it yet (expected: only the new file mentions it):
  ```bash
  grep -rn "components/core/Modal.vue\|from \"../core/Modal" /Users/elliott/Projects/space-game-demo/src/renderer | grep -v "/core/Modal.vue:"
  ```
  Expected output: empty (no other component imports `Modal.vue` in this phase).

**Commit:**

- [ ] Stage and commit:
  ```bash
  cd /Users/elliott/Projects/space-game-demo && git add src/renderer/components/core/Modal.vue && git commit -m "feat(renderer): reusable accessible Modal on reka-ui Dialog primitives"
  ```
  (Pre-commit hook: oxlint --fix + prettier --write on the staged SFC, then `tsc --noEmit` project-wide — all green from Step 2. PolicyHandModal retrofit deferred as noted above.)


---

## Phase P6 — PromotionPicker on the reusable Modal + wild display polish

This phase is **not atomic**. It is the convergence point and depends on three already-landed phases:
- **P3** ships `GameService.promotableIdeologies(columnIndex): Ideology[]` and the `buildColumn(columnIndex, promote?: Ideology)` signature (wired through `GameAPI.buildColumn` → `buildColumnCore`).
- **P2** has already removed the charter cell, so `TableauColumn`/`TableauPanel` render two rows and the ex-charter cards carry `countsAs: FULL_JOKER` with concrete literal colors.
- **P5** ships `src/renderer/components/core/Modal.vue` (Reka UI wrapper) with a controlled `:open` / `@update:open`, named slots `#header` / default / `#footer`, and a `non-dismissable` boolean prop.

If any of those three is not yet on the branch, stop and land them first — every task below references their public surface.

Work in dependency order: (1) the display-only `countsAsLabel` on `Card.vue` (no other deps, smallest), (2) `projectTree.ts` re-point to `promotedIdeology` (test-driven, core already required-typed by P3), (3) the `PromotionPicker.vue` component built on `Modal.vue`, (4) wiring `App.vue`'s build flow to the facade query. Each is its own red→green→commit.

---

### Task 28: Display-only `countsAsLabel` on `Card.vue`

Wilds keep a concrete literal `ideology` after P2, so their suit glyph already renders a real color. Add a **display-only** affordance line that reads the new `countsAs` descriptor and labels the wild. This is pure renderer text — no core import beyond the `Card` type, no evaluation (Red-team #14: this is the *only* place the "Vue computed value" instruction applies, and it is display, never resolution).

**Files:**
- Modify `src/renderer/components/core/Card.vue` (script block `:55-99`, template `:36-39`)

Steps:

- [ ] Read `src/renderer/components/core/Card.vue` to confirm the current `<script setup>` shape (it imports `Card` from `../../../core/types.ts`, has `effectLines` computed, and renders `card-name` + `card-effect-list`).

- [ ] Add a `countsAsLabel` computed to the script block, immediately after the existing `effectLines` computed (around `:91`). It returns `null` for non-wild cards and a human string for the shipped full joker, while staying generic enough to format a future partial:

```ts
const countsAsLabel = computed<string | null>(() => {
  const ca = props.card.countsAs;
  if (!ca) return null;
  const isAny = (v: unknown): v is "any" => v === "any";
  // Shipped case: the full joker (every dimension "any").
  if (isAny(ca.rank) && isAny(ca.ideology) && isAny(ca.kind)) {
    return "Wild: any rank, any color, either row";
  }
  // Generic partial formatting (future modifiers; no consumer ships these yet).
  const parts: string[] = [];
  if (ca.rank !== undefined) {
    parts.push(isAny(ca.rank) ? "any rank" : `rank ${ca.rank.map(rankLabel).join(" or ")}`);
  }
  if (ca.ideology !== undefined) {
    parts.push(
      isAny(ca.ideology) ? "any color" : ca.ideology.map((i) => suitLabel(i)).join(" or "),
    );
  }
  if (ca.kind !== undefined) {
    parts.push(isAny(ca.kind) ? "either row" : ca.kind.join(" or "));
  }
  return parts.length ? `Counts as ${parts.join(", ")}` : null;
});
```

  `rankLabel` and `suitLabel` are already imported (`:59`). No new import is needed.

- [ ] Render the label below the card name in the template. Add this block right after the `card-name` div (`:36`), before the `card-effect-list`:

```html
<div v-if="!compact && countsAsLabel" class="card-counts-as">{{ countsAsLabel }}</div>
```

- [ ] Add a minimal scoped style for the new line. If `Card.vue` has no `<style scoped>` block (it currently ends after `</script>` at `:100`), append one; otherwise add the rule to the existing block:

```html
<style scoped>
.card-counts-as {
  font-size: 9px;
  line-height: 1.2;
  font-style: italic;
  color: var(--ink-subtle);
}
</style>
```

- [ ] Typecheck (no test for pure display text — it is exercised by `bun run dev` and the smoke flow):

```
bun run typecheck
```

  Expected: clean exit, no errors. (`props.card.countsAs` is typed `CountsAs | undefined` because P0 added the optional field to `Card` and the barrel re-exports it; `"any"` narrowing is exhaustive over `Rank[] | "any"` etc.)

- [ ] Run the full suite to confirm nothing regressed:

```
bun test
```

  Expected: all tests pass (this change touches only a renderer SFC; no test imports `Card.vue`).

- [ ] Commit:

```
git add src/renderer/components/core/Card.vue
git commit -m "feat(renderer): display-only countsAs label on Card.vue for wild affordance"
```

---

### Task 29: Re-point `projectTree` big-counters from `projectMajority` to `promotedIdeology`

After P3, `ProjectUnlock` carries a **required** `promotedIdeology: Ideology | null` that is the player's actual Build-time choice. The project-tree panel's big counters must reflect *that* choice, not the re-derived `projectMajority`, so the rendered counters stay in lockstep with the new count-scaled `ideologyInfluence`. The `cardIdeologies` (small per-card swatches) stays identity-based but must now also exclude `countsAs` wilds (the ex-charters carry a concrete literal color after P2, so the old `i !== "wild"` filter alone would wrongly count a full joker's literal color).

**Files:**
- Modify `tests/projectTree.test.ts` (`unlock` helper `:17-24`, `unlockWith` helper `:26-32`, ideology-view-model block `:84-171`)
- Modify `src/renderer/util/projectTree.ts` (`:52` cardIdeologies, `:55` majorities, import `:11`)

Steps:

- [ ] **Write the failing tests first.** Update `tests/projectTree.test.ts` so every `ProjectUnlock` literal sets the now-required `promotedIdeology` and the assertions move to the promoted field. First fix both helpers so the file even type-checks under P3's required field:

```ts
function unlock(pattern: ProjectUnlock["pattern"], turn: number): ProjectUnlock {
  return {
    projectId: `test-${pattern}`,
    pattern,
    turn,
    cards: [getCard(landId(7, "solidarity"))],
    promotedIdeology: "solidarity",
  };
}

function unlockWith(
  pattern: ProjectUnlock["pattern"],
  turn: number,
  cards: ProjectUnlock["cards"],
  promotedIdeology: ProjectUnlock["promotedIdeology"] = null,
): ProjectUnlock {
  return { projectId: `test-${pattern}`, pattern, turn, cards, promotedIdeology };
}
```

- [ ] Rewrite the three majority-dependent cases in the `buildProjectTree ideology view-model` block so `majorities` is driven by the passed `promotedIdeology`, not re-derived. Replace the existing `:87-94`, `:96-103`, and `:105-112` tests with:

```ts
  test("built node carries per-build promotedIdeology + non-wild cardIdeologies", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")], "solidarity"),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.majorities).toEqual(["solidarity"]);
    expect(pair?.cardIdeologies).toEqual(["solidarity", "solidarity"]);
  });

  test("wild cards are excluded from cardIdeologies even with a concrete literal color", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "heritage"), getCard("keystone-pioneer")], "heritage"),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.majorities).toEqual(["heritage"]);
    // keystone-pioneer carries countsAs (full joker) with a literal "transformation"
    // color after P2; it must NOT leak into cardIdeologies.
    expect(pair?.cardIdeologies).toEqual(["heritage"]);
  });

  test("a build promoted to null yields a null majority entry but keeps both card ideologies", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(3, "heritage")], null),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.majorities).toEqual([null]);
    expect(pair?.cardIdeologies).toEqual(["solidarity", "heritage"]);
  });
```

- [ ] Rewrite the repeat-build case (`:122-133`) so the two distinct counters come from the promoted choices, not derivation:

```ts
  test("repeat builds carry one promoted entry per build, never pooled", () => {
    const { nodes } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")], "solidarity"),
      unlockWith("pair", 2, [L(3, "heritage"), L(3, "heritage")], "heritage"),
    ]);
    const pair = nodes.find((n) => n.pattern === "pair");
    expect(pair?.buildCount).toBe(2);
    expect(pair?.majorities).toEqual(["solidarity", "heritage"]);
    expect(pair?.cardIdeologies).toEqual(["solidarity", "solidarity", "heritage", "heritage"]);
  });
```

- [ ] Rewrite the two influence-tally cases (`:135-170`) so the big-counter tally equals the **count-scaled** `ideologyInfluence` (P3) and the promoted entry drives both. With count-scaling, two solidarity cards promoted to solidarity contribute **2** each:

```ts
  test("the big-counter tally equals the count-scaled influence readout under repeat builds", () => {
    const tree = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")], "solidarity"),
      unlockWith("pair", 2, [L(3, "solidarity"), L(3, "solidarity")], "solidarity"),
      unlockWith("pair", 3, [L(4, "heritage"), L(4, "heritage")], "heritage"),
      unlockWith("pair", 4, [L(5, "solidarity"), L(6, "heritage")], null), // no promotion
    ]);

    // One big counter per non-null promoted entry (unchanged rendering rule).
    let solCounters = 0;
    let herCounters = 0;
    for (const n of tree.nodes) {
      for (const maj of n.majorities) {
        if (maj === "solidarity") solCounters += 1;
        if (maj === "heritage") herCounters += 1;
      }
    }
    expect(solCounters).toBe(3); // three solidarity-promoted builds
    expect(herCounters).toBe(1);

    // influence is count-scaled: each solidarity build contributes its 2 own
    // solidarity cards; the null build contributes nothing.
    expect(tree.influence.solidarity).toBe(4); // 2 + 2
    expect(tree.influence.heritage).toBe(2);
  });

  test("panel influence summary is count-scaled by the promoted color's own cards", () => {
    const { influence } = buildProjectTree(PROJECTS, [
      unlockWith("pair", 1, [L(2, "solidarity"), L(2, "solidarity")], "solidarity"),
      unlockWith("two-pair", 2, [L(3, "solidarity"), L(3, "solidarity")], "solidarity"),
      unlockWith("three-of-a-kind", 3, [L(4, "heritage"), L(4, "heritage")], "heritage"),
      unlockWith("straight", 4, [L(5, "solidarity"), L(6, "heritage")], null), // no promotion
    ]);
    expect(influence.solidarity).toBe(4); // 2 + 2
    expect(influence.heritage).toBe(2);
    expect(influence.sovereignty).toBe(0);
    expect(influence.transformation).toBe(0);
  });
```

- [ ] Run the test — expect failures, because `projectTree.ts` still derives `majorities` from `projectMajority(u.cards)` and `cardIdeologies` still includes the joker's literal color:

```
bun test tests/projectTree.test.ts
```

  Expected: FAIL — e.g. `repeat builds carry one promoted entry per build` and the `cardIdeologies` joker-exclusion case fail (`projectMajority` re-derives, and `cardIdeologies` includes `"transformation"`).

- [ ] **Implement the minimal change** in `src/renderer/util/projectTree.ts`. Drop the now-unused `projectMajority` import (`:11`) and re-point `majorities` to the stored choice; also exclude `countsAs` wilds from `cardIdeologies`:

  Change the import block (`:5-11`) to remove `projectMajority`:

```ts
import {
  PATTERNS_IN_ORDER,
  getProjectForPattern,
  ideologyInfluence,
  projectContribution,
} from "../../core/data/projects.ts";
```

  Change `cardIdeologies` (`:52`) to also skip `countsAs` wilds:

```ts
    const cardIdeologies = cards
      .filter((c) => c.countsAs === undefined)
      .map((c) => c.ideology)
      .filter((i): i is Ideology => i !== "wild");
```

  Change `majorities` (`:55`) to read the stored promotion:

```ts
    // The big-counter majority IS the player's Build-time promotion choice,
    // not a re-derivation; this keeps counters in lockstep with the
    // count-scaled ideologyInfluence.
    const majorities = builds.map((u) => u.promotedIdeology);
```

- [ ] Update the `majorities` doc comment on `ProjectTreeNode` (`:25-31`) to reflect the new source:

```ts
  /**
   * The ideology the player PROMOTED for each individual build, in build order;
   * an entry is null when that build promoted nothing (all-wild). One large
   * counter is rendered per non-null entry, so the big-counter tally per color
   * matches that color's count-scaled `ideologyInfluence`.
   */
  majorities: (Ideology | null)[];
```

- [ ] Re-run to green:

```
bun test tests/projectTree.test.ts
```

  Expected: PASS — all `buildProjectTree` and ideology-view-model cases green.

- [ ] Typecheck and full suite:

```
bun run typecheck && bun test
```

  Expected: clean typecheck; full suite green.

- [ ] Commit:

```
git add src/renderer/util/projectTree.ts tests/projectTree.test.ts
git commit -m "feat(renderer): drive project-tree counters from promotedIdeology; exclude wilds from cardIdeologies"
```

---

### Task 30: `PromotionPicker.vue` built on the reusable `Modal.vue`

A new modal, opened from the Build flow only when ≥2 ideologies are promotable. It lists one selectable card per promotable ideology — mirroring `PolicyCard.vue`'s selectable look (`SuitGlyph` + label, accent border on select) — with a header and a primary **Promote** action. It is built **on top of** `src/renderer/components/core/Modal.vue` (P5), the convergence requirement of this phase. (Retrofitting `PolicyHandModal.vue` onto `Modal.vue` is explicitly OUT OF SCOPE — future cleanup.)

**Files:**
- Create `src/renderer/components/game/PromotionPicker.vue`

Steps:

- [ ] Confirm the dependency surface before writing the component:

```
sed -n '1,40p' src/renderer/components/core/Modal.vue
```

  Expected: `Modal.vue` exists (from P5) and exposes a controlled `open` prop + `update:open` emit, named slots `header` / default / `footer`, and a `non-dismissable` boolean. If the slot names differ, adapt the `<template #...>` usage below to match P5's actual slot names — do not invent names.

- [ ] Create `src/renderer/components/game/PromotionPicker.vue`. It receives the promotable ideologies and the column index, renders a selectable card per ideology mirroring `PolicyCard`'s `.selectable`/`.selected` accent style, and emits `@promote(ideology)` / `@cancel`. The modal stays open (non-dismissable is not required here — promotion is cancelable — but escape/outside-click maps to `@cancel` via `update:open`):

```html
<template>
  <Modal :open="true" @update:open="(v: boolean) => { if (!v) emit('cancel'); }">
    <template #header>
      <h2 class="pp-title">Promote an ideology</h2>
      <p class="pp-sub">Choose which color this Build fuels.</p>
    </template>

    <div class="pp-grid">
      <button
        v-for="ideology in ideologies"
        :key="ideology"
        type="button"
        class="pp-card"
        :class="{ selected: chosen === ideology }"
        :style="{ '--card-accent': cssColorFor(ideology) }"
        :aria-pressed="chosen === ideology"
        @click="chosen = ideology"
      >
        <div class="pp-accent" aria-hidden="true"></div>
        <SuitGlyph class="pp-watermark" :variant="ideology" :size="72" :aria-hidden="true" />
        <div class="pp-card-body">
          <SuitGlyph :variant="ideology" :size="16" :title="labelFor(ideology)" />
          <span class="pp-card-name">{{ labelFor(ideology) }}</span>
        </div>
      </button>
    </div>

    <template #footer>
      <button type="button" class="ghost" @click="emit('cancel')">Cancel</button>
      <button
        type="button"
        class="primary"
        :disabled="chosen === null"
        @click="confirm"
      >
        Promote
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { Ideology } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import SuitGlyph from "../core/SuitGlyph.vue";
import Modal from "../core/Modal.vue";

defineProps<{
  /** The promotable ideologies (≥2 — the picker only opens in that case). */
  ideologies: Ideology[];
}>();

const emit = defineEmits<{
  promote: [ideology: Ideology];
  cancel: [];
}>();

const chosen = ref<Ideology | null>(null);

function labelFor(ideology: Ideology): string {
  return IDEOLOGY_DISPLAY[ideology].name;
}

function confirm(): void {
  if (chosen.value !== null) emit("promote", chosen.value);
}
</script>

<style scoped>
.pp-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
}
.pp-sub {
  margin: var(--space-1) 0 0;
  font-size: 11px;
  color: var(--ink-muted);
}
.pp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  padding: var(--space-3) 0;
}
.pp-card {
  --card-accent: var(--ink-subtle);
  position: relative;
  width: 160px;
  aspect-ratio: 3 / 2;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  padding: 0;
  background: var(--paper);
  box-shadow: var(--shadow-interactive);
  cursor: pointer;
  transition: box-shadow 0.1s;
}
.pp-card:hover {
  box-shadow: var(--shadow-lifted);
}
.pp-card:focus-visible {
  box-shadow: var(--shadow-lifted);
  outline: none;
}
.pp-card.selected {
  box-shadow:
    var(--shadow-interactive),
    inset 0 0 0 2px var(--card-accent);
}
.pp-accent {
  flex: 0 0 6px;
  background: var(--card-accent);
}
.pp-watermark {
  position: absolute;
  right: -18px;
  bottom: -18px;
  opacity: 0.12;
  pointer-events: none;
  color: var(--card-accent);
}
.pp-card-body {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.pp-card-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}
</style>
```

- [ ] Typecheck the new component (it has no unit test of its own — it is exercised through `App.vue` wiring in the next task and `bun run dev`):

```
bun run typecheck
```

  Expected: clean exit. `cssColorFor` and `IDEOLOGY_DISPLAY` exist in `src/core/data/ideologies.ts`; `SuitGlyph` accepts `variant: Ideology` and a `title`; `Modal` props/emits/slots come from P5.

- [ ] Run the full suite (should be untouched — no test imports `PromotionPicker.vue` yet):

```
bun test
```

  Expected: all pass.

- [ ] Commit:

```
git add src/renderer/components/game/PromotionPicker.vue
git commit -m "feat(renderer): PromotionPicker modal on reusable Modal mirroring PolicyCard select style"
```

---

### Task 31: Wire `App.vue` build flow to `promotableIdeologies` + the picker

`App.onBuild(i)` becomes the decision point. It calls the P3 facade query `game.promotableIdeologies(i)` and branches: 0 present ⇒ `game.buildColumn(i, null)` (all-wild, core also coerces to null); 1 present ⇒ auto-promote `game.buildColumn(i, list[0])`; ≥2 ⇒ open `PromotionPicker` via a `pendingPromotion` ref that mirrors the existing `pendingConfirm` pattern. Confirming the picker calls `game.buildColumn(columnIndex, chosen)`.

**Files:**
- Modify `src/renderer/App.vue` (`onBuild` `:385-387`, imports `:178-202`, template after `ConfirmDialog` `:150-163`)
- Modify `src/renderer/GameService.ts` (`buildColumn` `:85-87`, add `promotableIdeologies`)

Steps:

- [ ] **GameService surface (delegates to P3's `GameAPI`).** In `src/renderer/GameService.ts`, change `buildColumn` to forward the promote argument and add a `promotableIdeologies` query. Replace the current `buildColumn` (`:85-87`):

```ts
  buildColumn(columnIndex: number, promote: Ideology | null): void {
    this.run(() => this.api.buildColumn(columnIndex, promote ?? undefined));
  }
```

  Add a query alongside `validColumns` (after `:64`):

```ts
  promotableIdeologies(columnIndex: number): Ideology[] {
    return this.api.promotableIdeologies(columnIndex);
  }
```

  Add the `Ideology` import to the top-of-file type import (`:6`):

```ts
import type { Ideology, LegacyUpgrade } from "../core/types.ts";
```

  (`api.promotableIdeologies` and the `buildColumn(columnIndex, promote?)` overload both ship in P3's `GameAPI`. The `promote ?? undefined` lets a `null` pass as "no explicit choice"; core treats an all-wild column as `null` regardless.)

- [ ] **App.vue imports.** Add the `PromotionPicker` import next to the other `game/` imports (after `PolicyPiles` at `:196`):

```ts
import PromotionPicker from "./components/game/PromotionPicker.vue";
```

  `Ideology` is already imported at `:197` (`import type { Card, Ideology, LegacyUpgrade } ...`).

- [ ] **App.vue state.** Add a `pendingPromotion` ref next to `pendingConfirm` (after `:219`):

```ts
// When a Build needs a player promotion choice (≥2 present ideologies), hold the
// target column here to open the PromotionPicker; mirrors pendingConfirm.
const pendingPromotion = ref<{ columnIndex: number; ideologies: Ideology[] } | null>(null);
```

- [ ] **App.vue onBuild.** Replace the current `onBuild` (`:385-387`):

```ts
function onBuild(i: number): void {
  const options = game.promotableIdeologies(i);
  if (options.length === 0) {
    game.buildColumn(i, null); // all-wild ⇒ no promotion
  } else if (options.length === 1) {
    game.buildColumn(i, options[0]); // unambiguous ⇒ auto-promote
  } else {
    pendingPromotion.value = { columnIndex: i, ideologies: options };
  }
}

function onPromote(ideology: Ideology): void {
  const pending = pendingPromotion.value;
  if (!pending) return;
  game.buildColumn(pending.columnIndex, ideology);
  pendingPromotion.value = null;
}
```

- [ ] **App.vue template.** Mount the picker right after the `ConfirmDialog` block (after `:163`, before the closing `</div>` of `.app-root`):

```html
    <PromotionPicker
      v-if="pendingPromotion"
      :ideologies="pendingPromotion.ideologies"
      @promote="onPromote"
      @cancel="pendingPromotion = null"
    />
```

- [ ] Typecheck — this is the integration check that the facade signatures line up:

```
bun run typecheck
```

  Expected: clean exit. `game.promotableIdeologies(i)` returns `Ideology[]`; `game.buildColumn(i, Ideology | null)` matches the new GameService signature; `PromotionPicker` props/emits match.

- [ ] Run the smoke suite plus the full suite to confirm the end-to-end build path still works (the auto-promote/null branches keep headless callers green; the picker only opens for genuinely multi-color columns):

```
bun test
```

  Expected: all pass — `smoke.test.ts` and every core suite green (P3 already pins the `buildColumn` promote branches; this task only wires the renderer to them).

- [ ] **Manual verification of the picker** (the only path not covered by unit tests). Launch the dev server and build a multi-color column to confirm the picker opens, a swatch selects, Promote fires the build, and Cancel dismisses without building:

```
bun run dev
```

  Expected: at `http://localhost:5173`, a column with ≥2 distinct present ideologies opens `PromotionPicker` on Build; selecting a swatch enables **Promote**; confirming unlocks the project with that promotion; Cancel closes the modal and leaves the column unbuilt. A single-color or all-wild column builds immediately with no modal. Stop the server when done.

- [ ] Commit:

```
git add src/renderer/App.vue src/renderer/GameService.ts
git commit -m "feat(renderer): wire Build flow through promotableIdeologies and PromotionPicker"
```

---

**Phase exit check (run after the last commit):**

```
bun run typecheck && bun test
```

Expected: clean typecheck across the whole project and a fully green suite, with the renderer now reflecting the count-scaled promotion model end-to-end (display-only `countsAsLabel`, promoted-driven big counters, and the build-flow picker). Note for the record: retrofitting `PolicyHandModal.vue` and other hand-rolled modals onto `Modal.vue` is deferred future cleanup; only `PromotionPicker` uses the reusable `Modal` now. The per-card "what the wild resolved to" tableau affordance and the Crisis difficulty re-baseline remain deferred per spec §9.

