# Flat Bauhaus Re-theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the entire game UI theme with a flat Bauhaus style — a "table" of flat tonal mats and thin rules instead of bordered containers — per `docs/superpowers/specs/2026-06-10-bauhaus-retheme-design.md`.

**Architecture:** Clean-slate CSS rewrite. A new `src/renderer/theme.css` (cascade layers: `reset, tokens, base, layout, components`) defines a semantic token vocabulary (`--ground`, `--mat`, `--paper`, `--ink`, `--rule`, semantic shadows) with dark values on `:root` and light under `data-theme="light"`. A temporary **compatibility alias block** maps every legacy token name (`--surface-*`, `--text*`, `--border*`, `--radius-*`, `--elev-*`, `--shadow-*`) onto the new tokens so the whole app re-skins immediately; each task then migrates components onto semantic names and deletes the corresponding legacy CSS, until `styles.css` and the alias block are deleted.

**Tech stack:** Vue 3 SFCs, Vite 7, Bun, `@fontsource-variable/space-grotesk` (self-hosted font), CSS `@layer` + custom properties. No core/facade changes.

**Branch:** `feat/bauhaus-retheme` (already created, spec committed).

**Verification commands used throughout:**
- `bun run typecheck` — must stay clean
- `bun test` — must stay green (no logic changes)
- Visual check: dev server at `http://localhost:5173` (start with `bun run dev` if not running). Use Playwright browser tools: navigate, screenshot, and toggle the theme button (header, right side) to check **both themes**.

**Hard style rules (re-check in every task):**
- No `border-radius`, no `text-transform: uppercase`, no `letter-spacing` tricks.
- Borders never enclose: `border` shorthand that draws 4 sides is banned; single-edge rules (`border-top`/`border-bottom`/`border-left`) are allowed.
- Shadows only on interactive/movable elements (`--shadow-interactive`) or floating sheets (`--shadow-lifted`). Disabled elements lose their shadow.
- Sentence case everywhere — fix any ALL-CAPS *text content* you touch (e.g., don't add new abbreviations).

---

### Task 1: Font package + `theme.css` foundation (tokens, reset, base) + legacy aliases

**Files:**
- Create: `src/renderer/theme.css`
- Modify: `src/main.ts`
- Modify: `src/renderer/styles.css` (delete tokens + base sections)
- Modify: `package.json` (via `bun add`)

- [ ] **Step 1.1: Install the font**

```bash
bun add @fontsource-variable/space-grotesk
```

Expected: dependency added to `package.json`.

- [ ] **Step 1.2: Create `src/renderer/theme.css`**

Complete file content:

```css
/* ------------------------------------------------------------------
 * Flat Bauhaus theme. See docs/superpowers/specs/2026-06-10-bauhaus-retheme-design.md
 *
 * Layers: reset < tokens < base < layout < components.
 * Dark ("Dark Bauhaus") values live on :root (the default).
 * Light ("Classic Bauhaus") overrides live under :root[data-theme="light"]
 * and under prefers-color-scheme: light when no explicit theme is set.
 * The theme attribute is set on <html> by src/renderer/util/theme.ts.
 *
 * Hard rules enforced by this file's vocabulary:
 *  - no radius tokens (square corners everywhere)
 *  - no uppercase / letter-spacing utilities (sentence case everywhere)
 *  - shadows are semantic: interactive elements and floating sheets only
 * ------------------------------------------------------------------ */

@import "@fontsource-variable/space-grotesk";

@layer reset, tokens, base, layout, components;

@layer reset {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
}

@layer tokens {
  :root {
    /* The table */
    --ground: #161513;
    --mat: #1e1c18;
    --mat-strong: #26231d;

    /* Physical objects (cards, piles, buttons, sheets) */
    --paper: #2b2823;
    --paper-hover: #332f28;
    --paper-dissent: #3a2422;

    /* Ink */
    --ink: #f0ede6;
    --ink-muted: #a8a399;
    --ink-subtle: #7a766d;

    /* Structural rules (lines that separate, never enclose) */
    --rule: #3c3830;
    --rule-strong: #57524a;

    /* Primary action */
    --accent: #eebf2e;
    --accent-hover: #f6cd4d;
    --accent-ink: #161513;

    /* Ideology suits */
    --suit-solidarity: #3f74c9;
    --suit-sovereignty: #e23b30;
    --suit-transformation: #44a04e;
    --suit-heritage: #a76bd6;
    --suit-wild: #eebf2e;
    --suit-dissent: #e23b30;

    /* Status */
    --status-positive: #44a04e;
    --status-negative: #e23b30;
    --status-warning: #eebf2e;
    --status-info: #3f74c9;

    /* Semantic shadows — soft, offset, quiet. Interactive = "you can move
       or click this"; lifted = hover/drag/floating sheet. */
    --shadow-interactive: 2px 3px 7px rgba(0, 0, 0, 0.35);
    --shadow-lifted: 5px 8px 18px rgba(0, 0, 0, 0.45);
    --scrim: rgba(10, 9, 8, 0.7);

    /* Spacing scale */
    --space-1: 4px;
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-5: 24px;
    --space-6: 32px;

    /* Layout */
    --rail-width: 44px;
  }

  /* Light theme — follows OS when user hasn't chosen. */
  @media (prefers-color-scheme: light) {
    :root:not([data-theme="dark"]) {
      --ground: #f4f1ea;
      --mat: #e9e4d8;
      --mat-strong: #ddd6c4;
      --paper: #fbf9f4;
      --paper-hover: #f0ece1;
      --paper-dissent: #f3ddd9;
      --ink: #14130f;
      --ink-muted: #5a5648;
      --ink-subtle: #8a8578;
      --rule: #cbc4b2;
      --rule-strong: #14130f;
      --accent: #e9b400;
      --accent-hover: #f5c41a;
      --accent-ink: #14130f;
      --suit-solidarity: #1c4fa0;
      --suit-sovereignty: #d02e26;
      --suit-transformation: #1f7d33;
      --suit-heritage: #7b2fa3;
      --suit-wild: #c79a00;
      --suit-dissent: #d02e26;
      --status-positive: #1f7d33;
      --status-negative: #d02e26;
      --status-warning: #a87a00;
      --status-info: #1c4fa0;
      --shadow-interactive: 2px 3px 7px rgba(20, 19, 15, 0.16);
      --shadow-lifted: 5px 8px 18px rgba(20, 19, 15, 0.22);
      --scrim: rgba(20, 19, 15, 0.45);
    }
  }

  /* Explicit light — overrides even when OS is dark. */
  :root[data-theme="light"] {
    --ground: #f4f1ea;
    --mat: #e9e4d8;
    --mat-strong: #ddd6c4;
    --paper: #fbf9f4;
    --paper-hover: #f0ece1;
    --paper-dissent: #f3ddd9;
    --ink: #14130f;
    --ink-muted: #5a5648;
    --ink-subtle: #8a8578;
    --rule: #cbc4b2;
    --rule-strong: #14130f;
    --accent: #e9b400;
    --accent-hover: #f5c41a;
    --accent-ink: #14130f;
    --suit-solidarity: #1c4fa0;
    --suit-sovereignty: #d02e26;
    --suit-transformation: #1f7d33;
    --suit-heritage: #7b2fa3;
    --suit-wild: #c79a00;
    --suit-dissent: #d02e26;
    --status-positive: #1f7d33;
    --status-negative: #d02e26;
    --status-warning: #a87a00;
    --status-info: #1c4fa0;
    --shadow-interactive: 2px 3px 7px rgba(20, 19, 15, 0.16);
    --shadow-lifted: 5px 8px 18px rgba(20, 19, 15, 0.22);
    --scrim: rgba(20, 19, 15, 0.45);
  }

  /* ---- LEGACY COMPATIBILITY ALIASES ------------------------------
   * Old token names mapped onto the new vocabulary so un-migrated
   * styles keep working during the rewrite.
   * DELETED in the final task. Do not add new consumers.
   * ---------------------------------------------------------------- */
  :root {
    --surface-base: var(--ground);
    --surface-raised: var(--mat);
    --surface-sunken: var(--mat-strong);
    --surface-card: var(--paper);
    --surface-card-hover: var(--paper-hover);
    --surface-dissent: var(--paper-dissent);
    --text: var(--ink);
    --text-muted: var(--ink-muted);
    --text-subtle: var(--ink-subtle);
    --border: var(--rule);
    --border-strong: var(--rule);
    --accent-text: var(--accent-ink);
    --radius-sm: 0px;
    --radius-md: 0px;
    --radius-lg: 0px;
    --shadow-card: var(--shadow-interactive);
    --shadow-dropdown: var(--shadow-lifted);
    --shadow-overlay: var(--scrim);
    --elev-1: var(--shadow-interactive);
    --elev-2: var(--shadow-lifted);
    --elev-3: var(--shadow-lifted);
    --rail-bg: var(--ground);
  }
}

@layer base {
  html,
  body,
  #app {
    height: 100%;
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: "Space Grotesk Variable", "Space Grotesk", system-ui, sans-serif;
    font-size: 13px;
  }

  h1,
  h2,
  h3,
  h4 {
    font-weight: 700;
  }

  button {
    background: var(--paper);
    color: var(--ink);
    border: none;
    padding: 5px 10px;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    box-shadow: var(--shadow-interactive);
    transition:
      background 0.1s,
      box-shadow 0.1s,
      translate 0.1s;
  }
  button:hover:not(:disabled) {
    background: var(--paper-hover);
  }
  button:active:not(:disabled) {
    translate: 1px 1px;
    box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.25);
  }
  /* Not clickable → not physical → no shadow. */
  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }
  button.primary {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  button.primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  button.linklike {
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--accent);
    font-size: 11px;
    padding: 0;
    text-decoration: underline;
  }

  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: var(--rule-strong);
  }
}
```

(`layout` and `components` layers start empty; they fill up in later tasks.)

- [ ] **Step 1.3: Import the theme before the legacy stylesheet**

In `src/main.ts`:

```ts
import { createApp } from "vue";
import App from "./renderer/App.vue";
import "./renderer/theme.css";
import "./renderer/styles.css";

createApp(App).mount("#app");
```

(Unlayered `styles.css` rules beat layered `theme.css` rules wherever both
match, which is exactly what we want during migration — legacy look wins
until the legacy rule is deleted.)

- [ ] **Step 1.4: Delete the superseded sections from `styles.css`**

Delete these sections wholesale (theme.css now owns them):
- The entire token block: `:root { ... }`, the `@media (prefers-color-scheme: light)` block, and the `:root[data-theme="light"]` block (lines 1–157).
- The `* { box-sizing }` rule, the `html, body, #app` rule, and all `button` rules (`button`, `button:hover`, `button:disabled`, `button.primary`, `button.primary:hover`).
- The `.linklike` rule (under the Hand section).
- The scrollbar rules at the bottom (`::-webkit-scrollbar*`).
- Dead styles: the entire `/* -------------------- Ideology -------------------- */` section's `.axis-row`, `.axis-label`, `.axis-value`, `.axis-bar` rules (the AxisBar component was deleted), `.stat-pill` rules (no component uses the class), `.market-panel`, `.market-row`, `.keystone-spot`, and the `.projects-panel`, `.projects-row`, `.project-zone`, `.project-header`, `.project-score`, `.project-patterns`, `.pattern-item`, `.project-requirement`, `.project-progress`, `.project-slots`, `.slotted-card` rules (UnlockedProjectsPanel has its own scoped styles), and `.tableau-slots`, `.tableau-slot`, `.slot-header` (tableau-slot variant), `.slot-status`, `.slot-empty-text`, `.topper-card`, `.tableau-slot .stack`, `.tableau-slot-empty`, `.tableau-slot .slot-actions` rules (pre-column-tableau leftovers; the live tableau uses `.cell`), and `.task-item` rules (nothing renders `task-item`).

Before deleting each "dead" selector, confirm it is unreferenced:

```bash
grep -rn "stat-pill\|axis-bar\|axis-row\|axis-label\|axis-value\|market-panel\|market-row\|keystone-spot\|projects-row\|project-zone\|pattern-item\|project-slots\|slotted-card\|tableau-slots\|tableau-slot\|topper-card\|task-item" src/renderer --include="*.vue"
```

Expected: no matches (if a selector matches, keep it and migrate it in its owning task instead).

- [ ] **Step 1.5: Verify**

```bash
bun run typecheck && bun test
```

Expected: both pass. Then visually: app loads at http://localhost:5173, all text renders in Space Grotesk, corners are square everywhere (radius aliases are 0), both themes show the new ground/ink palettes. Layout glitches in un-migrated components are acceptable; blank screens are not.

- [ ] **Step 1.6: Commit**

```bash
git add -A
git commit -m "feat(theme): Bauhaus token foundation — theme.css layers, Space Grotesk, legacy aliases"
```

---

### Task 2: `SuitGlyph` primitive

**Files:**
- Create: `src/renderer/components/core/SuitGlyph.vue`

- [ ] **Step 2.1: Create the component**

Complete file content:

```vue
<template>
  <svg
    class="suit-glyph"
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :style="{ color: colorVar }"
    role="img"
    :aria-label="variant"
  >
    <!-- Solidarity: circle -->
    <circle v-if="variant === 'solidarity'" cx="12" cy="12" r="10" fill="currentColor" />
    <!-- Sovereignty: triangle -->
    <polygon v-else-if="variant === 'sovereignty'" points="12,2.5 22,21.5 2,21.5" fill="currentColor" />
    <!-- Transformation: square -->
    <rect v-else-if="variant === 'transformation'" x="3" y="3" width="18" height="18" fill="currentColor" />
    <!-- Heritage: semicircle, flat side down -->
    <path v-else-if="variant === 'heritage'" d="M 2 17 A 10 10 0 0 1 22 17 Z" fill="currentColor" />
    <!-- Wild: four-quadrant disc, one quadrant per suit -->
    <template v-else-if="variant === 'wild'">
      <path d="M 12 12 L 12 2 A 10 10 0 0 1 22 12 Z" fill="var(--suit-solidarity)" />
      <path d="M 12 12 L 22 12 A 10 10 0 0 1 12 22 Z" fill="var(--suit-sovereignty)" />
      <path d="M 12 12 L 12 22 A 10 10 0 0 1 2 12 Z" fill="var(--suit-transformation)" />
      <path d="M 12 12 L 2 12 A 10 10 0 0 1 12 2 Z" fill="var(--suit-heritage)" />
    </template>
    <!-- Dissent: diagonal slash -->
    <line
      v-else-if="variant === 'dissent'"
      x1="4"
      y1="20"
      x2="20"
      y2="4"
      stroke="currentColor"
      stroke-width="3.5"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ideology } from "../../../core/types.ts";
import { IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";

export type SuitGlyphVariant = Ideology | "wild" | "dissent";

const props = withDefaults(
  defineProps<{
    variant: SuitGlyphVariant;
    size?: number;
  }>(),
  { size: 14 },
);

const colorVar = computed(() => {
  if (props.variant === "wild") return "var(--suit-wild)";
  if (props.variant === "dissent") return "var(--suit-dissent)";
  return `var(${IDEOLOGY_DISPLAY[props.variant].cssColorVar})`;
});
</script>

<style scoped>
.suit-glyph {
  display: block;
  flex-shrink: 0;
}
</style>
```

- [ ] **Step 2.2: Verify and commit**

```bash
bun run typecheck
git add src/renderer/components/core/SuitGlyph.vue
git commit -m "feat(theme): SuitGlyph primitive — geometric suit forms"
```

---

### Task 3: Card re-skin (pip, watermark, paper face)

**Files:**
- Modify: `src/renderer/components/core/Card.vue` (template + script)
- Modify: `src/renderer/styles.css` (delete the `/* Card */` section)
- Modify: `src/renderer/theme.css` (add card styles to `components` layer)

- [ ] **Step 3.1: Update `Card.vue` template**

Replace the `card-suit-chip` span with a SuitGlyph pip and add the watermark.
The template becomes:

```vue
<template>
  <div
    :class="[
      'card',
      `suit-${card.ideology}`,
      `kind-${card.kind}`,
      {
        selectable,
        selected,
        unaffordable,
        wild: card.ideology === 'wild',
        compact,
        dragging: isDragging,
      },
    ]"
    :draggable="draggable"
    @click="$emit('select')"
    @dragstart="$emit('dragstart', $event)"
    @dragend="$emit('dragend', $event)"
  >
    <SuitGlyph
      v-if="!compact && card.kind !== 'dissent'"
      class="card-watermark"
      :variant="card.ideology"
      :size="96"
    />
    <div class="card-header">
      <span class="card-rank">{{ rankLabel(card.rank) }}</span>
      <SuitGlyph
        :variant="card.kind === 'dissent' ? 'dissent' : card.ideology"
        :size="14"
        :title="suitLabel(card.ideology)"
      />
    </div>
    <div class="card-name">{{ card.name }}</div>
    <ul v-if="!compact && effectLines.length > 0" class="card-effect-list">
      <li v-for="(line, i) in effectLines" :key="i">{{ line }}</li>
    </ul>
    <div class="card-footer">
      <span
        v-if="showInfluence && card.kind !== 'land' && card.kind !== 'dissent'"
        class="card-inf-cost"
      >
        {{ card.influenceCost }} Inf
      </span>
      <span v-else-if="card.kind === 'land'" class="card-inf-cost">Land</span>
      <span v-else-if="card.kind === 'dissent'" class="card-inf-cost">—</span>
      <span v-if="showMarketCost" class="card-market-cost">{{ card.marketCost }} Mat</span>
    </div>
  </div>
</template>
```

In the script block, add the import (alongside the existing ones):

```ts
import SuitGlyph from "./SuitGlyph.vue";
```

(`suitLabel` stays imported — it's still used for the pip's `title`.)

- [ ] **Step 3.2: Add card styles to `theme.css` `components` layer**

Append inside `@layer components { ... }`:

```css
@layer components {
  /* -------------------- Card -------------------- */
  /* A card is paper on the table: square, flat face, suit bar on top.
     Shadow only when it can be picked up (selectable/draggable). */
  .card {
    --suit: var(--ink-subtle);
    position: relative;
    width: 112px;
    height: 150px;
    background: var(--paper);
    border-top: 5px solid var(--suit);
    display: flex;
    flex-direction: column;
    padding: 6px;
    font-size: 11px;
    flex-shrink: 0;
    overflow: hidden;
    user-select: none;
  }
  .card.suit-solidarity {
    --suit: var(--suit-solidarity);
  }
  .card.suit-sovereignty {
    --suit: var(--suit-sovereignty);
  }
  .card.suit-transformation {
    --suit: var(--suit-transformation);
  }
  .card.suit-heritage {
    --suit: var(--suit-heritage);
  }
  .card.suit-wild {
    --suit: var(--suit-wild);
  }
  .card.kind-dissent {
    --suit: var(--suit-dissent);
    background: var(--paper-dissent);
  }

  .card-watermark {
    position: absolute;
    right: -28px;
    bottom: -28px;
    opacity: 0.13;
    pointer-events: none;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 700;
    color: var(--suit);
  }
  .card-rank {
    font-size: 16px;
    line-height: 1;
  }
  .card-name {
    font-size: 11px;
    font-weight: 600;
    margin: 4px 0;
    line-height: 1.2;
    color: var(--ink);
  }
  .card-effect-list {
    list-style: none;
    padding: 0;
    margin: 4px 0 0 0;
    font-size: 10px;
    color: var(--ink-muted);
    line-height: 1.35;
    flex: 1;
    overflow: hidden;
  }
  .card-effect-list li {
    padding-left: 8px;
    position: relative;
  }
  .card-effect-list li::before {
    content: "·";
    position: absolute;
    left: 0;
    color: var(--ink-subtle);
  }
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: 4px;
    font-size: 10px;
    color: var(--ink-muted);
  }
  .card-inf-cost {
    color: var(--suit);
    font-weight: 700;
  }
  .card-market-cost {
    color: var(--ink-muted);
  }

  .card.selectable,
  .card[draggable="true"] {
    box-shadow: var(--shadow-interactive);
  }
  .card.selectable {
    cursor: pointer;
  }
  .card.selectable:hover {
    background: var(--paper-hover);
    box-shadow: var(--shadow-lifted);
  }
  .card.selected {
    outline: 2px solid var(--ink);
    outline-offset: 2px;
    box-shadow: var(--shadow-lifted);
  }
  .card.unaffordable {
    opacity: 0.55;
  }
  .card.dragging {
    opacity: 0.35;
  }
  .card[draggable="true"] {
    cursor: grab;
  }
  .card[draggable="true"]:active {
    cursor: grabbing;
  }
}
```

Note: the old `.card.wild { border-style: dashed }` is intentionally dropped — wild identity now comes from the four-quadrant glyph + watermark.

- [ ] **Step 3.3: Delete the legacy card section from `styles.css`**

Delete everything from `/* -------------------- Card -------------------- */` through the `.card[draggable="true"]:active` rule (the whole Card block, including `.card-suit-chip`). Keep the "Drop targets" rules that follow — they migrate in Task 5/6.

- [ ] **Step 3.4: Verify**

```bash
bun run typecheck && bun test
```

Visual check (both themes): cards show square corners, suit-colored top bar, geometric pip top-right, large faint watermark bottom-right; hand cards carry a soft shadow, cards inside the deck-review modal do not; dissent cards show the slash and tinted paper.

- [ ] **Step 3.5: Commit**

```bash
git add -A
git commit -m "feat(theme): card re-skin — paper face, suit pip, geometric watermark"
```

---

### Task 4: App chrome — header, stats bar, error bar, theme toggle, save-slot menu

**Files:**
- Modify: `src/renderer/theme.css` (`layout` + `components` layers)
- Modify: `src/renderer/styles.css` (delete migrated sections)
- Modify: `src/renderer/components/shell/ThemeToggle.vue` (style block)
- Modify: `src/renderer/components/shell/TurnBar.vue` (style block)
- Modify: `src/renderer/App.vue` (inline style var rename)

- [ ] **Step 4.1: Add layout styles to `theme.css` `layout` layer**

```css
@layer layout {
  .app-root {
    display: grid;
    grid-template-rows: auto auto 1fr;
    height: 100%;
  }

  /* Header: solid ink block — the one inverted band in the frame. */
  .app-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 16px;
    background: var(--ink);
    color: var(--ground);
  }
  .app-header h1 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
  }
  .app-header .spacer {
    flex: 1;
  }

  .stats-bar {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 6px 16px;
    border-bottom: 1px solid var(--rule-strong);
    background: var(--ground);
  }
  .turn-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .app-main {
    display: grid;
    grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--rail-width);
    overflow: hidden;
    min-height: 0;
  }

  .play-area {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto;
    padding: var(--space-3);
    gap: var(--space-3);
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }
  .hand-panel {
    min-width: 0;
    flex: 1 1 auto;
  }
  .hand-row {
    display: flex;
    gap: var(--space-3);
    align-items: stretch;
    min-width: 0;
  }

  .error-bar {
    background: color-mix(in srgb, var(--status-negative) 14%, var(--ground));
    color: var(--status-negative);
    padding: 6px 12px;
    border-top: 2px solid var(--status-negative);
    font-size: 12px;
  }
}
```

(The `.play-area` comment about overflow was load-bearing knowledge; the
behavior is preserved verbatim — `overflow: hidden` + `min-height: 0`.)

- [ ] **Step 4.2: Add save-slot menu styles to `theme.css` `components` layer**

The dropdown is a floating paper sheet; rows separated by rules. Append:

```css
@layer components {
  /* -------------------- Save slot menu -------------------- */
  .save-slot-menu {
    position: relative;
  }
  .slot-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 240px;
    padding: 6px 12px;
    background: var(--paper);
    border: none;
    box-shadow: var(--shadow-interactive);
    color: var(--ink);
    font-size: 12px;
    cursor: pointer;
  }
  .slot-trigger:hover {
    background: var(--paper-hover);
  }
  .slot-label {
    flex: 1;
    text-align: left;
  }
  .slot-caret {
    color: var(--ink-muted);
    font-size: 10px;
  }

  .slot-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 320px;
    background: var(--paper);
    color: var(--ink);
    box-shadow: var(--shadow-lifted);
    z-index: 20;
    overflow: hidden;
  }
  .slot-header {
    padding: 8px 12px;
    font-size: 11px;
    color: var(--ink-muted);
    border-bottom: 1px solid var(--rule);
  }
  .slot-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    overflow: auto;
  }
  .slot-row {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--rule);
  }
  .slot-row:last-child {
    border-bottom: 0;
  }
  .slot-row.empty {
    padding: 12px;
    color: var(--ink-subtle);
    font-size: 12px;
    justify-content: center;
  }
  .slot-row.active {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .slot-switch {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--ink);
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .slot-switch:hover {
    background: var(--paper-hover);
  }
  .slot-row.active .slot-switch {
    color: var(--accent);
    font-weight: 600;
  }
  .slot-row-label {
    flex: 1;
  }
  .slot-row-time {
    color: var(--ink-subtle);
    font-size: 10px;
    margin-left: 8px;
  }
  .slot-delete {
    background: transparent;
    border: none;
    box-shadow: none;
    color: var(--ink-subtle);
    font-size: 16px;
    line-height: 1;
    padding: 8px 12px;
    cursor: pointer;
  }
  .slot-delete:hover:not(:disabled) {
    color: var(--status-negative);
  }
  .slot-delete:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
  .slot-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid var(--rule);
  }
  .slot-footer button.primary {
    flex: 1;
  }
  .slot-hint {
    font-size: 10px;
    color: var(--ink-subtle);
  }
}
```

Note: `.slot-header` (the dropdown's "Slots" heading) drops its old
`text-transform: uppercase; letter-spacing: 0.08em` — sentence case now.

- [ ] **Step 4.3: Rewrite `ThemeToggle.vue` style block**

The toggle sits on the ink header band, so it inverts:

```vue
<style scoped>
.theme-toggle {
  background: transparent;
  color: var(--ground);
  border: none;
  box-shadow: none;
  border-bottom: 2px solid var(--ground);
  padding: 6px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
  justify-content: center;
}
.theme-toggle:hover {
  background: color-mix(in srgb, var(--ground) 15%, transparent);
}
</style>
```

- [ ] **Step 4.4: Fix `TurnBar.vue` status colors**

Replace its style block (drops the `--warn`/`--danger` fallback vars, which
don't exist):

```vue
<style scoped>
.turn-progress.near {
  color: var(--status-warning);
}
.turn-progress.edge {
  color: var(--status-negative);
}
</style>
```

- [ ] **Step 4.5: Fix App.vue inline style + SaveSlotMenu trigger contrast**

In `App.vue`, the header subtitle uses `var(--text-muted)`; on the ink band
that's wrong now. Change the inline style to:

```html
<span class="app-sub" style="color: var(--ink-subtle); font-size: 12px">
```

Check `src/renderer/components/shell/SaveSlotMenu.vue`'s template: the
trigger button sits on the ink header. The paper-on-ink default is fine —
no change needed unless the visual check shows otherwise.

- [ ] **Step 4.6: Delete migrated sections from `styles.css`**

Delete: `.app-root`, `.app-header` (+ `h1`, `.spacer`), `.stats-bar`,
`.turn-bar`, `.app-main`, `.play-area`, `.hand-panel`, `.hand-row`, the
whole `/* Save Slot Menu */` section, and `.error-bar`.

- [ ] **Step 4.7: Verify**

```bash
bun run typecheck && bun test
```

Visual (both themes): ink header band with legible title/menu/toggle, flat
stats bar with a single rule below, error bar (trigger one by clicking Build
on an empty column) reads as a flat tinted strip.

- [ ] **Step 4.8: Commit**

```bash
git add -A
git commit -m "feat(theme): chrome re-skin — ink header band, flat stats/error bars, save-slot sheet"
```

---

### Task 5: The table — Panel-as-mat, tableau, cells

**Files:**
- Modify: `src/renderer/components/core/Panel.vue` (style block)
- Modify: `src/renderer/components/game/TableauPanel.vue` (style block)
- Modify: `src/renderer/theme.css` (cells in `components` layer)
- Modify: `src/renderer/styles.css` (delete cell + column-footer + drop-target sections)

- [ ] **Step 5.1: Rewrite `Panel.vue` style block**

A panel is a mat on the table — flat tone, no border, plain heading:

```vue
<style scoped>
.panel {
  background: var(--mat);
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Allow the panel to shrink below its intrinsic content size when its
     parent gives it a bounded height — needed for in-panel scrolling. */
  min-height: 0;
}
.panel-header {
  padding: var(--space-2) var(--space-3) 0;
  flex: 0 0 auto;
}
.panel-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-muted);
}
.panel-body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}
</style>
```

- [ ] **Step 5.2: Rewrite `TableauPanel.vue` style block**

Row labels lose the uppercase styling and sit on the mat; everything else
(sticky pinning, z-index contract, isolation) is preserved verbatim:

```vue
<style scoped>
.tableau-scroll {
  overflow: auto;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  /* Confine the row-labels' very high z-index (needed to beat hovered land
     stacks and cell-action buttons) to a local stacking context so it can't
     punch through overlays like RailFlyout above the play area. */
  isolation: isolate;
}
.tableau-grid {
  display: grid;
  /* Column tracks grow with the widest horizontal land stack;
     --col-min-width is set on this grid so all columns match. */
  grid-template-columns: 80px repeat(var(--col-count), minmax(var(--col-min-width, 120px), 1fr));
  gap: var(--space-1);
  align-items: start;
}
.row-labels {
  display: grid;
  grid-template-rows: 150px 150px 150px auto;
  gap: var(--space-1);
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-muted);
  /* Pin to the left edge as the tableau scrolls horizontally, and keep
     them above stacked cards (max ~hover 9999) and cell buttons (10000). */
  position: sticky;
  left: 0;
  z-index: 10001;
  background: var(--mat);
}
.row-label {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: var(--space-2);
}
</style>
```

- [ ] **Step 5.3: Add cell styles to `theme.css` `components` layer**

Cells are spots on the mat, not boxes. Empty = faint deeper inset; locked =
even fainter; the Land/Influence/Charter bands are separated by thin rules
drawn under each cell. Append:

```css
@layer components {
  /* -------------------- Tableau cells -------------------- */
  .cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px;
    position: relative;
    min-width: 112px;
    width: 112px;
    margin-inline: auto;
    /* Thin rule under each band: separates Charter/Influence/Land rows
       without enclosing anything. */
    border-bottom: 1px solid var(--rule);
  }
  .cell.land-cell,
  .cell.influence-cell,
  .cell.charter-cell {
    height: 150px;
  }
  /* Land and Influence cells grow horizontally with their CardStacks. */
  .cell.land-cell,
  .cell.influence-cell {
    width: 100%;
  }
  .cell:not(.occupied) {
    background: color-mix(in srgb, var(--mat-strong) 60%, transparent);
  }
  .cell.occupied {
    padding: 0;
  }
  .cell.locked {
    background: transparent;
    color: var(--ink-subtle);
  }

  .cell-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--ink-subtle);
    font-size: 11px;
  }
  .cell-locked {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    height: 100%;
  }
  .lock-glyph {
    font-size: 18px;
    opacity: 0.5;
  }
  .lock-hint {
    font-size: 10px;
    color: var(--ink-subtle);
  }

  .cell-content {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .cell-content .card {
    margin-bottom: 0;
  }
  .cell-action {
    position: absolute;
    bottom: 4px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    padding: 2px 8px;
    /* Above stacked cards (max ~stack-size) and above the hover-pop value
       (9999) so the button stays clickable even while inspecting a card. */
    z-index: 10000;
  }

  /* Drop targets: solid accent-tinted fill, 2px accent rule on the bottom
     edge. No dashed outlines anywhere. */
  .cell.drop-target {
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    border-bottom: 2px solid var(--accent);
  }
  .cell.drag-over {
    background: color-mix(in srgb, var(--accent) 22%, transparent);
    border-bottom: 2px solid var(--accent);
  }

  .column-footer {
    display: flex;
    gap: 4px;
    flex-direction: column;
  }
  .column-footer button {
    font-size: 11px;
    padding: 4px 6px;
  }
}
```

- [ ] **Step 5.4: Delete migrated sections from `styles.css`**

Delete the `/* Column tableau (new three-tier model) */` section (`.cell*`,
`.cell-empty*`, `.cell-locked`, `.lock-glyph`, `.lock-hint`, `.cell-content`,
`.cell-action`, `.cell.drop-target`, `.cell.drag-over`, `.column-footer`)
and the top-of-file "Drop targets" rules for `.tableau-slot.drop-target` /
`.tableau-slot.drag-over` (dead — live code uses `.cell`).

- [ ] **Step 5.5: Verify**

```bash
bun run typecheck && bun test
```

Visual (both themes): tableau is a flat mat; empty cells are faint deeper
rectangles with sentence-case labels; thin rules separate the three bands;
dragging a land card over a column shows solid accent fills (no dashes);
horizontal scrolling with pinned row labels still works; cell action buttons
still float above stacks.

- [ ] **Step 5.6: Commit**

```bash
git add -A
git commit -m "feat(theme): the table — panels as mats, flat tableau cells, rule-separated bands"
```

---

### Task 6: Hand + piles

**Files:**
- Modify: `src/renderer/theme.css` (`components` layer)
- Modify: `src/renderer/styles.css` (delete Hand + Deck/Discard sections)

- [ ] **Step 6.1: Add hand + pile styles to `theme.css` `components` layer**

```css
@layer components {
  /* -------------------- Hand -------------------- */
  .hand-cards {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--space-2);
    min-height: 160px;
    overflow-x: auto;
    padding: var(--space-1);
    scrollbar-width: thin;
  }
  .hand-actions {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-2);
    /* Reserve enough vertical space for the meta line + a row of buttons so
       the panel size stays put when a selection toggles. */
    min-height: 56px;
  }
  .hand-hint {
    color: var(--ink-subtle);
    font-size: 12px;
    margin: auto 0;
  }
  .action-meta {
    font-size: 11px;
    color: var(--ink-muted);
    display: flex;
    gap: var(--space-1);
    align-items: center;
  }
  .action-handlabel {
    color: var(--ink);
  }
  .action-buttons {
    display: flex;
    gap: var(--space-1);
    flex-wrap: wrap;
  }
  .action-empty {
    color: var(--ink-muted);
    font-size: 12px;
  }

  /* -------------------- Deck / Discard piles -------------------- */
  /* A pile is a small stack of paper: the button is the top sheet, one
     offset pseudo-element suggests the sheets beneath. */
  .pile-row {
    display: flex;
    gap: 8px;
  }
  .pile-stack {
    position: relative;
    flex: 1 1 0;
    height: 106px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
    color: var(--ink);
    background: var(--paper);
    box-shadow: var(--shadow-interactive);
    transition: translate 0.1s;
  }
  .pile-stack:hover:not(:disabled) {
    translate: 0 -2px;
    box-shadow: var(--shadow-lifted);
  }
  .pile-stack:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }
  .pile-stack::after {
    content: "";
    position: absolute;
    inset: 0;
    translate: 4px 4px;
    background: var(--mat-strong);
    z-index: -1;
  }
  .pile-deck {
    background: repeating-linear-gradient(
      135deg,
      var(--paper) 0 6px,
      var(--mat-strong) 6px 12px
    );
  }
  .pile-discard {
    background: var(--paper);
  }
  .pile-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-muted);
  }
  .pile-count {
    font-size: 26px;
    font-weight: 700;
    color: var(--ink);
    line-height: 1;
    margin: 4px 0;
  }
  .pile-hint {
    font-size: 9px;
    color: var(--ink-subtle);
  }
  .pile-stack.drop-target {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .pile-stack.drag-over {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--accent) 14%, var(--paper));
  }
  .dissent-note {
    margin-top: 6px;
    font-size: 10px;
    color: var(--suit-dissent);
  }
  .market-button {
    margin-top: 8px;
    width: 100%;
  }
  .end-turn-big {
    margin-top: 8px;
    width: 100%;
  }
  .discard-end-turn {
    margin-top: 6px;
    width: 100%;
    padding: 8px 10px;
    font-size: 12px;
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 8px;
  }
  .discard-end-turn .btn-sub {
    color: var(--ink-subtle);
    font-size: 10px;
    font-weight: normal;
  }
}
```

Notes vs. legacy: pile labels drop `text-transform: uppercase`; pile count
is ink, not accent (quiet — accent is reserved for actions); the two fake
stacked-edge pseudo-elements collapse to one; the hand panel's deeper-mat
zone comes free from `Panel` (already a mat) — `DeckDiscardPanel`'s Panel
gets the deeper tone via `.deck-discard-panel` below.

Also append (deeper mat for the pile zone):

```css
@layer components {
  .deck-discard-panel {
    background: var(--mat-strong);
  }
}
```

(`.deck-discard-panel` is already on the Panel via the `class` attribute in
`DeckDiscardPanel.vue`; scoped panel styles use `var(--mat)` but this
unscoped rule in the `components` layer targets the same element. Scoped
styles are unlayered, so they win — to let the override apply, change the
`Panel.vue` `.panel` background to `background: var(--panel-bg, var(--mat));`
and write the override as `.deck-discard-panel { --panel-bg: var(--mat-strong); }`.)

Update `Panel.vue` `.panel` rule accordingly:

```css
.panel {
  background: var(--panel-bg, var(--mat));
  /* ...rest unchanged */
}
```

- [ ] **Step 6.2: Delete migrated sections from `styles.css`**

Delete the `/* Hand */` section (minus `.linklike`, already gone) and the
whole `/* Deck / Discard piles */` section, plus the remaining top-of-file
`.pile-stack.drop-target` / `.pile-stack.drag-over` rules.

- [ ] **Step 6.3: Verify**

```bash
bun run typecheck && bun test
```

Visual (both themes): hand sits on a mat with shadowed cards; deck/discard
zone is a deeper mat; piles read as paper stacks (one offset edge), deck has
flat diagonal stripes; dragging a card over Discard shows the accent
outline; End turn is an accent block.

- [ ] **Step 6.4: Commit**

```bash
git add -A
git commit -m "feat(theme): hand mat + paper piles"
```

---

### Task 7: Info panels — ideology plot, crisis meters, projects

**Files:**
- Modify: `src/renderer/components/game/IdeologyDisplay.vue` (template + style)
- Modify: `src/renderer/components/game/CrisisCounterPanel.vue` (style block)
- Modify: `src/renderer/components/game/UnlockedProjectsPanel.vue` (template + style)

- [ ] **Step 7.1: IdeologyDisplay — glyph poles, rule-colored crosshairs**

In the template, replace the pole-label `<text>` block:

```html
<!-- Pole markers: suit glyph + sentence-case name -->
<g v-for="id in IDEOLOGIES" :key="id">
  <svg
    :x="poleAnchor(id).x - 5"
    :y="poleAnchor(id).y - 5"
    width="10"
    height="10"
    viewBox="0 0 10 10"
  >
    <circle v-if="id === 'solidarity'" cx="5" cy="5" r="4.5" :fill="cssColorFor(id)" />
    <polygon v-else-if="id === 'sovereignty'" points="5,0.5 9.5,9.5 0.5,9.5" :fill="cssColorFor(id)" />
    <rect v-else-if="id === 'transformation'" x="1" y="1" width="8" height="8" :fill="cssColorFor(id)" />
    <path v-else-if="id === 'heritage'" d="M 0.5 7 A 4.5 4.5 0 0 1 9.5 7 Z" :fill="cssColorFor(id)" />
  </svg>
  <title>{{ IDEOLOGY_DISPLAY[id].name }}</title>
</g>
```

And update the two crosshair `<line>` elements' stroke from
`var(--border)` to `var(--rule)`, and the threshold rings' stroke from
`var(--text-subtle)` to `var(--ink-subtle)` (keep the dashes — they are
data marks inside a plot, not container borders).

In the pole-anchor positions nothing changes (`poleAnchor` already centers).
Remove the now-unused `.pole-label` CSS rule, and since `IDEOLOGY_DISPLAY`
abbreviations are no longer rendered, the import stays (used by `<title>`).

Replace the style block:

```vue
<style scoped>
.plot-wrap {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}
.ideology-plot {
  width: 100%;
  height: auto;
  max-width: 220px;
  aspect-ratio: 1 / 1;
  display: block;
}
.demonym-label {
  margin-top: var(--space-1);
  font-size: 12px;
  font-style: italic;
  text-align: center;
}
.demonym-label.unaligned {
  font-weight: 400;
}
.demonym-label:not(.unaligned) {
  font-weight: 600;
}
</style>
```

- [ ] **Step 7.2: CrisisCounterPanel — flat square meters**

Replace its style block (drops uppercase label styling and meter radii;
track becomes a deeper mat):

```vue
<style scoped>
.meter-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.meter-label {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
}
.meter-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--ink-muted);
}
.meter-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  transition: color 0.2s;
}
.meter-value.passing {
  color: var(--status-positive);
}
.meter-value.near {
  color: var(--status-warning);
}
.meter-value.edge {
  color: var(--status-negative);
}
.meter-track {
  height: 8px;
  background: var(--mat-strong);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  background: var(--ink-muted);
  transition:
    width 0.3s ease,
    background-color 0.2s ease;
}
.meter-fill.passing {
  background: var(--status-positive);
}
.meter-fill.near {
  background: var(--status-warning);
}
.meter-fill.edge {
  background: var(--status-negative);
}
.meter-hint {
  font-size: 11px;
  color: var(--ink-subtle);
}
</style>
```

- [ ] **Step 7.3: UnlockedProjectsPanel — flat entries, glyph breakdown**

Template: replace the star spans and ideology-count spans with squares and
SuitGlyphs. New template:

```vue
<template>
  <Panel
    class="unlocked-projects"
    :title="`Keystone projects (${unlocks.length}/${PATTERNS_IN_ORDER.length})`"
  >
    <div class="project-list">
      <div
        v-for="pattern in PATTERNS_IN_ORDER"
        :key="pattern"
        class="project-card"
        :class="{ unlocked: findUnlock(pattern) }"
      >
        <span class="project-mark" :class="{ filled: findUnlock(pattern) }"></span>
        <span class="project-name">{{ getProjectName(pattern) }}</span>
        <span class="project-pattern">{{ patternLabel(pattern) }}</span>
        <span v-if="findUnlock(pattern)" class="project-ideologies">
          <span
            v-for="(count, ideology) in ideologyBreakdown(findUnlock(pattern)!)"
            :key="ideology"
            class="project-ideology"
            :title="`${ideology}: ${count}`"
          >
            <SuitGlyph :variant="ideology" :size="10" /> {{ count }}
          </span>
        </span>
      </div>
    </div>
  </Panel>
</template>
```

Add to the script imports:

```ts
import SuitGlyph from "../core/SuitGlyph.vue";
```

Replace the style block:

```vue
<style scoped>
.project-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.project-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: var(--mat-strong);
  min-width: 120px;
  opacity: 0.6;
}
.project-card.unlocked {
  opacity: 1;
  border-top: 3px solid var(--accent);
}
.project-mark {
  width: 10px;
  height: 10px;
  background: transparent;
  border: 1px solid var(--ink-subtle);
}
.project-mark.filled {
  background: var(--accent);
  border-color: var(--accent);
}
.project-name {
  font-weight: 600;
  font-size: 0.85rem;
}
.project-pattern {
  font-size: 0.75rem;
  color: var(--ink-subtle);
}
.project-ideologies {
  display: flex;
  gap: var(--space-2);
}
.project-ideology {
  font-size: 0.75rem;
  color: var(--ink-muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
</style>
```

(The `.project-mark` square is a status indicator drawn as a tiny enclosed
square — it's a glyph, not a container; this is the same exception as the
SuitGlyph square.)

- [ ] **Step 7.4: Verify**

```bash
bun run typecheck && bun test
```

Visual (both themes, open via left rail icons): ideology plot shows shape
poles, crisis meters are flat square bars, projects list shows flat entries
with accent top-rule when unlocked and glyph+count breakdowns.

- [ ] **Step 7.5: Commit**

```bash
git add -A
git commit -m "feat(theme): info panels — glyph poles, flat meters, flat project entries"
```

---

### Task 8: Rails, flyouts, sidebar sections

**Files:**
- Modify: `src/renderer/components/shell/Rail.vue` (style block)
- Modify: `src/renderer/components/shell/RailFlyout.vue` (style block)
- Modify: `src/renderer/theme.css` (sidebar leftovers in `components` layer)
- Modify: `src/renderer/styles.css` (delete Sidebar section)

- [ ] **Step 8.1: Rewrite `Rail.vue` style block**

Rails are thin strips of the ground with a single separating rule:

```vue
<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) 0;
  background: var(--ground);
  border-right: 1px solid var(--rule);
  align-items: center;
}
.rail-right {
  border-right: none;
  border-left: 1px solid var(--rule);
}
.rail-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  box-shadow: none;
  color: var(--ink-muted);
  cursor: pointer;
  padding: 0;
  transition:
    color 120ms ease,
    background 120ms ease;
}
.rail-icon:hover {
  color: var(--ink);
  background: var(--mat);
}
.rail-icon.active {
  color: var(--accent-ink);
  background: var(--accent);
}
.rail-icon:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
```

- [ ] **Step 8.2: Rewrite `RailFlyout.vue` style block**

The flyout panel is a floating paper sheet (picked up → `--shadow-lifted`).
Only the `.flyout-panel` rule changes:

```css
.flyout-panel {
  --panel-bg: var(--paper);
  box-shadow: var(--shadow-lifted);
  max-height: 100%;
  overflow: auto;
}
```

(Everything else in the style block stays exactly as it is.)

- [ ] **Step 8.3: Migrate sidebar leftovers to `theme.css` `components` layer**

```css
@layer components {
  /* -------------------- Sidebar sections -------------------- */
  .monument-item {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 11px;
  }
  .monument-item:last-child {
    border-bottom: 0;
  }
  .monument-item.echo {
    opacity: 0.55;
  }
  .legacy-item {
    padding: 3px 0;
    border-bottom: 1px solid var(--rule);
    font-size: 11px;
  }
  .legacy-item:last-child {
    border-bottom: 0;
  }
  .deck-counts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    font-size: 11px;
    color: var(--ink-muted);
  }
  .deck-counts .danger {
    color: var(--status-negative);
  }
  .event-log {
    max-height: 200px;
    overflow: auto;
    font-size: 11px;
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    padding: 4px;
    background: var(--mat-strong);
  }
  .event-entry {
    color: var(--ink-muted);
  }
  .event-entry.warn {
    color: var(--status-warning);
  }
  .event-entry.danger {
    color: var(--status-negative);
  }
  .event-entry.info {
    color: var(--status-info);
  }
}
```

Delete from `styles.css`: the `/* Sidebar */` section (`.monument-item*`,
`.tier-badge`, `.tier-bronze/silver/gold/platinum`, `.legacy-item*`,
`.deck-counts*`, `.event-log`, `.event-entry*`). The tier-badge classes are
unreferenced (LegacySidebar was deleted) — confirm with:

```bash
grep -rn "tier-badge\|tier-bronze\|tier-silver\|tier-gold\|tier-platinum" src/renderer --include="*.vue"
```

Expected: no matches.

- [ ] **Step 8.4: Verify**

```bash
bun run typecheck && bun test
```

Visual (both themes): rails are flat strips; active icon is an accent
square; flyouts open as paper sheets with a soft deep shadow over the table;
sidebar lists separated by rules.

- [ ] **Step 8.5: Commit**

```bash
git add -A
git commit -m "feat(theme): rails as flat strips, flyouts as lifted paper sheets"
```

---

### Task 9: Overlays — crisis screen, modals, campaign end, legacy choices

**Files:**
- Modify: `src/renderer/components/game/CrisisScreen.vue` (style block)
- Modify: `src/renderer/theme.css` (modal/eoe styles in `components` layer)
- Modify: `src/renderer/styles.css` (delete remaining sections)

- [ ] **Step 9.1: Rewrite `CrisisScreen.vue` style block**

```vue
<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}
.modal.crisis-screen {
  background: var(--paper);
  box-shadow: var(--shadow-lifted);
  padding: var(--space-5);
  max-width: 640px;
  max-height: 90vh;
  width: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.modal.crisis-screen h1 {
  margin: 0;
  font-size: 18px;
}
.modal.crisis-screen .flavor {
  margin: 0;
  color: var(--ink-muted);
  font-style: italic;
}
.modal.crisis-screen .difficulty,
.modal.crisis-screen .verdict,
.modal.crisis-screen .ideology {
  margin: 0;
}
.unlock-walk {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 12px;
}
.unlock-walk li {
  display: grid;
  grid-template-columns: 60px 1fr auto auto;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--mat);
}
.step-pattern {
  color: var(--ink-muted);
  font-size: 11px;
  align-self: center;
}
.step-value {
  color: var(--status-positive);
  font-weight: 600;
}
.step-running {
  color: var(--ink-subtle);
}
.modal.crisis-screen .primary {
  align-self: flex-end;
}
</style>
```

- [ ] **Step 9.2: Migrate modal + end-of-epoch styles to `theme.css`**

Append to the `components` layer:

```css
@layer components {
  /* -------------------- Overlays: card list, market, campaign end -------------------- */
  .eoe-overlay {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .eoe-panel {
    background: var(--paper);
    box-shadow: var(--shadow-lifted);
    padding: 24px;
    width: 680px;
    max-width: 92vw;
    max-height: 90vh;
    overflow: auto;
  }
  .eoe-panel h2 {
    margin: 0 0 8px 0;
    font-size: 22px;
  }
  .eoe-subtitle {
    color: var(--ink-muted);
    margin-bottom: 18px;
  }
  .eoe-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .card-list-panel {
    background: var(--paper);
    box-shadow: var(--shadow-lifted);
    padding: 20px;
    width: 780px;
    max-width: 92vw;
    max-height: 82vh;
    display: flex;
    flex-direction: column;
  }
  .card-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .card-list-header h2 {
    margin: 0;
    font-size: 16px;
  }
  .card-list-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 8px;
    overflow: auto;
    padding: 4px;
    flex: 1;
  }
  .card-list-empty {
    color: var(--ink-muted);
    text-align: center;
    padding: 40px;
  }
  .card-list-footer {
    margin-top: 12px;
    border-top: 1px solid var(--rule);
    padding-top: 8px;
  }
  .card-list-hint {
    font-size: 11px;
    color: var(--ink-subtle);
  }

  /* -------------------- Legacy choice rows -------------------- */
  .legacy-choice {
    background: var(--mat);
    padding: 12px;
    margin-bottom: 12px;
  }
  .legacy-choice-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
  }
  .legacy-choice-header h3 {
    margin: 0;
    font-size: 14px;
  }
  .legacy-choice-source {
    font-size: 11px;
    color: var(--ink-muted);
  }
  .upgrade-options {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .upgrade-option {
    padding: 8px;
    text-align: left;
    font-size: 11px;
    background: var(--paper);
    cursor: pointer;
  }
  .upgrade-option.selected {
    background: color-mix(in srgb, var(--accent) 14%, var(--paper));
    border-bottom: 3px solid var(--accent);
  }
  .upgrade-option .upgrade-name {
    font-weight: 600;
    color: var(--ink);
    margin-bottom: 3px;
  }
  .upgrade-option .upgrade-desc {
    color: var(--ink-muted);
    font-size: 10px;
  }
}
```

Note: `.legacy-choice-source` drops `text-transform: uppercase`; selected
upgrade options switch from accent border-wrap to a flat accent tint +
bottom rule.

- [ ] **Step 9.3: Delete remaining sections from `styles.css`**

Delete the `/* Card list modal */`, `/* End-of-Epoch Screen */` sections
(`.eoe-overlay`, `.eoe-panel`, `.eoe-subtitle`, `.legacy-choice*`,
`.upgrade-options`, `.upgrade-option*`, `.eoe-actions`, `.card-list-*`).

- [ ] **Step 9.4: Verify**

```bash
bun run typecheck && bun test
```

Visual (both themes): click Deck pile → card-list modal is a flat paper
sheet over a scrim; cards inside it have no shadows (not selectable);
play an epoch to the crisis (or temporarily set a low `maxTurns` locally —
do not commit that) and confirm the crisis screen reads as a paper sheet
with mat-toned walk rows and flat upgrade options.

- [ ] **Step 9.5: Commit**

```bash
git add -A
git commit -m "feat(theme): overlays — paper sheets over flat scrim"
```

---

### Task 10: Delete `styles.css` + aliases; final sweep

**Files:**
- Delete: `src/renderer/styles.css`
- Modify: `src/main.ts` (remove import)
- Modify: `src/renderer/theme.css` (delete alias block)

- [ ] **Step 10.1: Confirm `styles.css` is empty of live rules**

After tasks 1–9, `styles.css` should contain nothing but comments/empty
sections. Verify nothing meaningful remains:

```bash
grep -v "^\s*\(/\*\|\*\|\s*$\)" src/renderer/styles.css
```

If any rules remain, they were missed — migrate each to its owning
component or `theme.css` following the same patterns before continuing.

- [ ] **Step 10.2: Delete the file and its import**

```bash
rm src/renderer/styles.css
```

In `src/main.ts`, remove the line `import "./renderer/styles.css";`.

- [ ] **Step 10.3: Delete the legacy alias block from `theme.css`**

Remove the entire `/* ---- LEGACY COMPATIBILITY ALIASES ---- */` `:root`
block, then confirm no consumer survives:

```bash
grep -rn -- "--surface-\|--text)\|--text-muted\|--text-subtle\|--border\b\|--border-strong\|--radius-\|--elev-\|--shadow-card\|--shadow-dropdown\|--shadow-overlay\|--accent-text\|--rail-bg" src/renderer
```

Expected: no matches. If a `.vue` file still references a legacy var, fix
it to the semantic equivalent (`--surface-card` → `--paper`, `--text-muted`
→ `--ink-muted`, `--border` → `--rule`, etc.).

- [ ] **Step 10.4: Hard-rule sweep**

```bash
grep -rn "text-transform\|letter-spacing\|border-radius" src/renderer
grep -rn "border:\s" src/renderer | grep -v "border: none"
```

Expected: first grep — no matches. Second grep — no matches (4-side border
shorthand is banned; single-edge `border-top/bottom/left/right` rules are
fine and won't match this pattern).

- [ ] **Step 10.5: Full verification**

```bash
bun run typecheck && bun test && bun run build
```

Expected: all pass. Then a full visual pass in **both themes** via
Playwright browser tools at http://localhost:5173:
1. Fresh campaign: header band, mats, rails, hand, piles.
2. Select cards → action buttons; drag a land onto a column → accent drop
   fills; place, build a column.
3. Open every rail flyout (projects, crisis, ideology, terrain, monuments,
   legacy, counts, log).
4. Open deck/discard modal and the market modal.
5. End turns to the crisis; resolve; legacy choice rows; advance.
6. Narrow the viewport (~900px) and confirm tableau scrolls inside its
   panel with pinned row labels.

- [ ] **Step 10.6: Commit**

```bash
git add -A
git commit -m "feat(theme): delete legacy stylesheet — Bauhaus re-theme complete"
```

---

### Task 11: Push branch + PR

- [ ] **Step 11.1: Push and open PR**

```bash
git push -u origin feat/bauhaus-retheme
gh pr create --title "feat: flat Bauhaus re-theme" --body "$(cat <<'EOF'
## Summary
- Clean-slate CSS rewrite per docs/superpowers/specs/2026-06-10-bauhaus-retheme-design.md
- New theme.css (@layer reset/tokens/base/layout/components) with semantic tokens: ground/mat/paper/ink/rule + semantic shadows
- Light = Classic Bauhaus, dark = Dark Bauhaus; same names, two value sets
- Space Grotesk (self-hosted via fontsource); SuitGlyph geometric suit system with card watermarks
- Play area reads as a table: flat tonal mats + thin rules, no enclosing borders, square corners, sentence case
- styles.css deleted

## Test plan
- [ ] bun run typecheck / bun test / bun run build green
- [ ] Both themes: full play loop, drag-and-drop, all flyouts and modals
- [ ] No text-transform / border-radius / letter-spacing / 4-side borders (grep sweep)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** tokens/layers (T1), font (T1), SuitGlyph (T2), card
  anatomy + watermark (T3), header/chrome (T4), Panel-as-mat + tableau +
  cells + drop targets (T5), hand/piles (T6), ideology plot + crisis meters
  + projects (T7), rails/flyouts/sidebar (T8), overlays (T9), deletion +
  hard-rule sweep + full visual pass (T10). Spec's "assets/fonts woff2" is
  satisfied via `@fontsource-variable/space-grotesk` (same self-hosting
  outcome, reproducible install) — deliberate packaging deviation.
- **Dissent watermark:** spec says dissent cards get no watermark — enforced
  by the `v-if` in Task 3's template.
- **Type consistency:** `SuitGlyphVariant = Ideology | "wild" | "dissent"`
  used consistently (T2 definition, T3 + T7 call sites).
- **Panel background override:** `--panel-bg` indirection introduced in T6
  and reused by T8's flyout (`--panel-bg: var(--paper)`).
