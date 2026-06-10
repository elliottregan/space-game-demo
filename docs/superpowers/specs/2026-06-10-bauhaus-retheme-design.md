# Bauhaus Re-theme — Design

**Date:** 2026-06-10
**Status:** Approved
**Approach:** Clean-slate CSS rewrite (replace `styles.css` wholesale)

## Vision

A comprehensive re-theme of the entire game to a flat Bauhaus style. The play
area reads as a **table** — flat tonal zones laid on a continuous ground — not
as containers with borders. Two theme variants share one semantic token system:

- **Light ("Classic Bauhaus")** — off-white ground, black structural rules,
  pure red/blue/yellow primaries. Gallery-poster bright.
- **Dark ("Dark Bauhaus")** — charcoal ground, saturated primaries punching
  out, light linework. Current dark-game mood, fully flattened.

### Hard style rules

- No enclosing borders. Thin rules may *separate*; they never *wrap*.
- Square corners everywhere. No radius tokens exist.
- No all-caps styling. No `text-transform: uppercase`, no letter-spacing
  tricks. Sentence case throughout.
- No glows or decorative shadows. Shadows are **semantic**: a soft offset
  shadow marks an element as movable/interactive, and must stay quieter than
  the element's content.
- Typeface: **Space Grotesk** (self-hosted variable woff2).
- Each ideology suit has a geometric form used as pip and as a large cropped
  low-opacity card watermark.

## CSS architecture

New `src/renderer/theme.css` replaces `src/renderer/styles.css` (deleted at
the end). Native cascade layers:

```css
@layer reset, tokens, base, layout, components;
```

- **reset** — box-sizing, margin zeroing, `@font-face` for Space Grotesk.
- **tokens** — all custom properties (below), dark values on `:root`, light
  under `:root[data-theme="light"]` and the `prefers-color-scheme: light`
  fallback for `:root:not([data-theme="dark"])`. `theme.ts` and `ThemeToggle`
  are unchanged.
- **base** — element defaults (html/body/#app, button, headings).
- **layout** — app grid, header, stats bar, play area, rails.
- **components** — global styles for markup whose styles don't live in a
  component's scoped block.

### Semantic tokens

Components never use raw colors — only these names:

| Token | Role |
| --- | --- |
| `--ground` | the table itself (page background) |
| `--mat` / `--mat-strong` | flat tonal zones on the ground (tableau, hand; piles one tone deeper) |
| `--paper` / `--paper-hover` | card faces and other "physical" objects |
| `--ink` / `--ink-muted` / `--ink-subtle` | text hierarchy |
| `--rule` / `--rule-strong` | thin structural lines (the only "borders") |
| `--accent` / `--accent-ink` | primary action color (theme's yellow family), used sparingly |
| `--suit-solidarity` / `--suit-sovereignty` / `--suit-transformation` / `--suit-heritage` / `--suit-wild` / `--suit-dissent` | ideology colors |
| `--status-positive` / `--status-negative` / `--status-warning` / `--status-info` | status colors |
| `--shadow-interactive` | soft offset shadow for movable/clickable elements at rest |
| `--shadow-lifted` | deeper soft shadow for hover/drag/floating sheets |
| `--scrim` | modal overlay backdrop |
| `--space-1..6` | spacing scale (carried over from today) |
| `--rail-width` | layout constant (carried over) |

Deliberately absent: radius tokens, uppercase/letter-spacing utilities,
elevation scale beyond the two semantic shadows.

### Palette anchors

Light: ground `#f4f1ea`, ink `#111`, red `#d02e26`, blue `#1c4fa0`,
yellow `#e9b400`. Dark: ground `#161513`, paper `#23211e`, ink `#f0ede6`,
red `#e23b30`, blue `#3f74c9`, yellow `#eebf2e`. Mats are tonal steps off the
ground. Exact values tuned during implementation for WCAG AA contrast on
10–12px text.

## Layout & the table look

The app grid (header / stats bar / rails / play area) keeps its current
structure — re-skin, not re-layout.

- **Play area** is the table: `--ground` edge to edge. No panel borders or
  rounded boxes anywhere.
- **Mats**: tableau and hand row each sit on a flat `--mat` block; the
  deck/discard zone inside the hand row uses `--mat-strong`. Mats are
  separated by spacing; their color edges do the work.
- **Rules** appear only where structure needs them: under the header, between
  stats bar and table, and as Land/Influence/Charter band separators inside
  the tableau. Lines separate, never enclose.
- **Header**: solid ink block — `--ink` background, ground-colored text in
  light theme; inverted treatment in dark. Save-slot menu and theme toggle
  become flat elements on it.
- **Panel.vue** keeps its API (`title` + slot) but renders as a mat with a
  plain sentence-case heading — no border, no header rule. Call sites
  unchanged.
- **Rails** become thin ink-on-ground strips; **flyouts** are paper sheets
  with `--shadow-lifted` (floating elements are "picked up", so they may
  shadow).
- **Empty tableau cells**: dashed outlines replaced by a faint mat-tone inset
  block with a small sentence-case label ("land", "role", "charter").

## Cards, suits & components

### SuitGlyph primitive

`src/renderer/components/core/SuitGlyph.vue` — renders an ideology's
geometric form as inline SVG at any size:

| Suit | Form |
| --- | --- |
| Solidarity | circle |
| Sovereignty | triangle |
| Transformation | square |
| Heritage | semicircle |
| Wild | four-quadrant disc (all suits) |
| Dissent | diagonal slash |

Used at pip size on cards, rails, the ideology plot, and project pattern
lists. The shape mapping is defined once, alongside the suit color tokens.

### Card anatomy

Square corners, `--paper` face:

- Suit-colored top bar (~5px) replaces the current full colored border.
- Header row: rank + pip (SuitGlyph). Name and effect text unchanged.
- **Watermark**: the suit form, large and cropped into the bottom-right
  corner at ~12–14% opacity. Pure CSS/SVG, no image assets.
- `--shadow-interactive` only when selectable/draggable; static cards (modal
  lists) sit flat. Selected = 2px `--ink` outline + `--shadow-lifted`.
  Dragging keeps the current opacity treatment.
- Dissent cards: dissent-tinted paper + slash glyph, no watermark.

### Other components

- **Piles**: flat `--paper` rectangles with `--shadow-interactive`
  (clickable); stacked-edge pseudo-elements simplify to one offset paper
  edge, no borders. Deck back: flat diagonal stripes in mat tones.
- **Buttons**: flat ink-on-paper, square, `--shadow-interactive` because
  clickable; primary = accent block. Accent used sparingly — Build, End
  turn, selection highlights.
- **Stat pills → stat blocks**: square, mat-toned, sentence-case labels.
- **Drop targets**: solid accent-tinted mat fill (no dashed outlines);
  drag-over deepens the fill and adds a 2px accent rule on the targeted edge.
- **Modals / Crisis screen / flyouts**: paper sheets with `--shadow-lifted`
  over a flat `--scrim`; internally flattened (rules not boxes, sentence
  case).
- **Ideology plot, crisis meters, project zones**: re-skinned with mat fills,
  rules, and SuitGlyphs; internal layout logic untouched.

## Execution & scope

**New files:** `src/renderer/theme.css`,
`src/renderer/components/core/SuitGlyph.vue`,
`src/renderer/assets/fonts/SpaceGrotesk*.woff2`.

**Rewritten:** `<style scoped>` blocks of all styled components; global
selectors from `styles.css` move either to `theme.css` (layout/shared) or
into the component that owns the markup. Dead styles (`.axis-bar`, legacy
`.tableau-slot`, market stubs) are not carried over.

**Deleted:** `src/renderer/styles.css`.

**Untouched:** `core/`, `facade/`, `theme.ts`, `GameService.ts`, component
markup/logic except class renames and SuitGlyph insertions.

**Order of work** (each step leaves the app runnable):

1. Tokens + reset + fonts (`theme.css` alongside `styles.css` temporarily)
2. Core primitives: Card, SuitGlyph, CardStack, Panel
3. Play area: tableau, hand, piles
4. Chrome: header, stats bar, rails, flyouts, sidebar sections
5. Overlays: modals, crisis screens
6. Delete `styles.css`; sweep for stragglers

## Verification

- `bun run typecheck` and `bun test` stay green (no logic changes; smoke
  test guards regressions).
- Playwright visual pass at each milestone against the dev server: both
  themes, full play loop (select → place → build → end turn → crisis),
  drag-and-drop states, narrow viewport.
- Final grep sweep for `text-transform`, `border-radius`, `letter-spacing`,
  and `border:` usages that violate the hard style rules.
- Saves untouched — pure presentation change.
