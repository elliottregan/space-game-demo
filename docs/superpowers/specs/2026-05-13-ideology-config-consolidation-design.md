# Ideology config consolidation

**Status:** approved
**Date:** 2026-05-13

## Goal

Centralize ideology metadata that is currently scattered across 8+ files. Today, abbreviations are duplicated (three different styles in active use), CSS-var bindings are recomputed in multiple components, and axis mapping lives inline in switch statements. Pull this into two linked configs (one display, one mechanical) so adding properties or changing the canonical abbreviation is a one-file edit, and TypeScript prevents per-site drift.

The data model does not change. There are still exactly four ideologies plus "wild" as a special case.

## Architecture

Two configs, linked by the shared `Ideology` literal type:

**Display config** — `src/core/data/ideologies.ts` (new file)
- Owns the `Ideology` type, the `IDEOLOGIES` array, and per-ideology display properties.
- Read by anything that renders ideology text or color.

**Mechanical config** — `src/core/engine/ideology.ts` (existing file)
- Adds two new exported records: axis mapping, and ideology→demonym mapping.
- Switch statements in `deriveVector` and `demonym()` are replaced with lookups against these records.

Both configs are keyed by the same `Ideology` type, so adding a fifth ideology in the future is a typecheck-driven exercise.

The renderer continues to read from `core/`. CSS-var *names* are strings; referencing them from core does not pull a CSS dependency upward.

## Display config shape

```ts
// src/core/data/ideologies.ts

export type Ideology = "solidarity" | "sovereignty" | "transformation" | "heritage";

export interface IdeologyDisplay {
  id: Ideology;
  name: string;        // "Solidarity"
  abbrev: string;      // "SOL" — 3-letter, all caps; canonical short form
  code: string;        // "S" — 1-char (V for Sovereignty since S is taken)
  cssColorVar: string; // "--suit-solidarity"
}

export const IDEOLOGY_DISPLAY: Record<Ideology, IdeologyDisplay> = {
  solidarity:     { id: "solidarity",     name: "Solidarity",     abbrev: "SOL", code: "S", cssColorVar: "--suit-solidarity" },
  sovereignty:    { id: "sovereignty",    name: "Sovereignty",    abbrev: "SOV", code: "V", cssColorVar: "--suit-sovereignty" },
  transformation: { id: "transformation", name: "Transformation", abbrev: "TRA", code: "T", cssColorVar: "--suit-transformation" },
  heritage:       { id: "heritage",       name: "Heritage",       abbrev: "HER", code: "H", cssColorVar: "--suit-heritage" },
};

export const IDEOLOGIES: Ideology[] = ["solidarity", "sovereignty", "transformation", "heritage"];

/** Empty-zeroed breakdown counter, useful for tallies. */
export function zeroIdeologyBreakdown(): Record<Ideology, number> {
  return { solidarity: 0, sovereignty: 0, transformation: 0, heritage: 0 };
}
```

Note: the canonical 3-letter abbreviation becomes **SOL / SOV / TRA / HER** (all caps) everywhere. The previous title-case `Sol/Sov/Trn/Her` from `renderer/util/labels.ts` is retired.

## Mechanical config shape

```ts
// src/core/engine/ideology.ts (additions)

export const IDEOLOGY_AXIS: Record<Ideology, { axis: "axis1" | "axis2"; sign: -1 | 1 }> = {
  solidarity:     { axis: "axis1", sign: -1 },
  sovereignty:    { axis: "axis1", sign:  1 },
  transformation: { axis: "axis2", sign:  1 },
  heritage:       { axis: "axis2", sign: -1 },
};

export const DEMONYM_BY_IDEOLOGY: Record<Ideology, NonNullable<Demonym>> = {
  solidarity:     "collective",
  sovereignty:    "dominion",
  transformation: "ascendancy",
  heritage:       "keepers",
};
```

`deriveVector` is rewritten to iterate cards and apply `IDEOLOGY_AXIS[card.ideology]` for non-wild ideologies. `demonym(vector)` walks axes and uses `DEMONYM_BY_IDEOLOGY` (or its inverse) to resolve the pole.

The `Demonym` type and `demonymName()` helper stay in `engine/ideology.ts` since they're consumed mechanically (the Demonym union is part of the engine's vocabulary).

## Migration plan

### Files to add
- `src/core/data/ideologies.ts` (new)

### Files to modify

**Core:**
- `src/core/data/cards.ts` — drop the local `Ideology` type and `IDEOLOGIES` array. Re-import both from `data/ideologies.ts`. Replace the inline `{ solidarity: 0, sovereignty: 0, ... }` initialization template with a call to `zeroIdeologyBreakdown()`.
- `src/core/types.ts` — re-export `Ideology`, `IDEOLOGIES`, `IDEOLOGY_DISPLAY`, `IdeologyDisplay`, `zeroIdeologyBreakdown` from `data/ideologies.ts`. Existing barrel imports continue to resolve.
- `src/core/data/projects.ts` — replace the hardcoded breakdown record literal in `unlockedIdeologyBreakdown` with `zeroIdeologyBreakdown()`.
- `src/core/engine/ideology.ts` — rewrite `deriveVector` and `demonym()` to read from the new constants. The existing public API (`deriveVector`, `checkAlignment`, `demonym`, `demonymName`, `influenceCostAdjustment`) does not change.

**Renderer:**
- `src/renderer/util/labels.ts` — `suitLabel(ideology)` reads `IDEOLOGY_DISPLAY[ideology].abbrev` for the four non-wild ideologies. Wild stays special-cased ("Wild"). The output for cards changes from `Sol/Sov/Trn/Her` to `SOL/SOV/TRA/HER`.
- `src/renderer/components/game/IdeologyDisplay.vue` — drop the hardcoded pole-label text and the `DEMONYM_COLOR` constant. The four pole labels iterate over `IDEOLOGY_DISPLAY`; the dot color resolves via `IDEOLOGY_DISPLAY[ideologyForDemonym(demonymKey)].cssColorVar`. To get ideology-from-demonym, either invert `DEMONYM_BY_IDEOLOGY` once at module scope or add an `IDEOLOGY_BY_DEMONYM` constant in `engine/ideology.ts` and export it.
- `src/renderer/components/game/CrisisScreen.vue` — `S{x} · V{y} · T{z} · H{w}` template uses `IDEOLOGY_DISPLAY[id].code` (or iterate).
- `src/renderer/components/game/UnlockedProjectsPanel.vue` — replace the inline `{ solidarity: 0, ... }` initialization in `ideologyBreakdown(u)` with `zeroIdeologyBreakdown()`.

**Settings:**
- `src/core/settings/generationShip.ts` — the `SHIP_IDEOLOGIES` set is still hand-rolled (`["sovereignty", "transformation", "wild"]`); no change required, but the cast `new Set<string>(...)` can become `new Set<Ideology | "wild">(...)` if convenient. Optional.

### Files NOT touched
- `src/renderer/styles.css` — the `--suit-*` CSS variables and `.card.suit-*` class rules stay as-is. Moving these into JS would couple renderer logic to CSS class generation for no real win.
- Tests — existing tests assert behavior; if any test directly imports `Ideology` from `data/cards.ts`, the re-export in `cards.ts` keeps the import path valid. If a test imports the `IDEOLOGIES` array, same story.

## Pole-label rendering in IdeologyDisplay

Currently four hardcoded `<text>` elements with position presets (top/bottom/left/right). After the refactor, the four positions are derived from `IDEOLOGY_AXIS`: an ideology with `axis: "axis2", sign: +1` → top; `axis: "axis2", sign: -1` → bottom; `axis: "axis1", sign: +1` → right; `axis: "axis1", sign: -1` → left.

A small helper inside the component maps `(axis, sign)` → SVG anchor coordinates (`x`, `y`, `text-anchor`, `dominant-baseline`). The four `<text>` elements collapse into a single `v-for` over `IDEOLOGY_DISPLAY`.

This is a real simplification: today changing a pole color requires editing both the CSS var and the inline `:style` binding. After: edit only the config.

## Verification

This is a structural refactor with no behavior change.

- `bun run typecheck` — must pass.
- `bun run lint` — must pass.
- `bun test` — all existing tests must still pass. No new tests required.
- Visual smoke: `bun run dev` → load the app, confirm the ideology plot looks identical (apart from the abbreviation change on cards, which is intentional).

## Risk

Low–medium. The change touches many files, but each individual edit is small and TypeScript catches missed call sites. The main human-visible change is card suit labels switching from `Sol/Sov/Trn/Her` to `SOL/SOV/TRA/HER`; this was approved by the user as the unified canonical form.

The trickiest spot is the `ideologyForDemonym` inverse lookup in `IdeologyDisplay.vue`. The implementation plan should add a single `IDEOLOGY_BY_DEMONYM: Record<NonNullable<Demonym>, Ideology>` constant in `engine/ideology.ts` rather than computing the inverse at component scope.
