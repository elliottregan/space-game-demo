# UI Framework Design

## Problem

Building game UI suffers from three pain points:
- **Consistency** - UI elements look/behave differently across panels
- **Boilerplate** - Same patterns written repeatedly (panels, buttons, progress bars)
- **Reuse** - Similar UI patterns exist but aren't easily reusable

## Solution

A layered component library with low-level primitives and high-level game-specific composites. Visual refresh with a clean sci-fi aesthetic (minimal, sharp edges, subtle glows).

## Architecture

```
src/renderer/ui/
├── tokens/           # Design tokens (CSS custom properties)
│   └── theme.css
├── primitives/       # Low-level building blocks
│   ├── GButton.vue
│   ├── GPanel.vue
│   ├── GProgress.vue
│   └── GIcon.vue
├── composites/       # Game-specific higher-level components
│   ├── ResourceBadge.vue
│   ├── BuildingCard.vue
│   └── CountdownTimer.vue
└── index.ts          # Barrel export
```

**Naming:** All primitives prefixed with `G` (for "Game") to avoid conflicts and make them recognizable.

**Imports:**
```ts
import { GButton, GPanel, GProgress } from '@/renderer/ui'
```

## Design Tokens

Token-based styling via CSS custom properties. Components reference tokens, never hardcoded values. Uses OKLCH color space for perceptual uniformity.

```css
:root {
  /* Color palette - cool blues/cyans with warm accents */
  --g-color-bg-base: oklch(10% 0.02 250);       /* Deep space black */
  --g-color-bg-surface: oklch(15% 0.02 250);    /* Panel backgrounds */
  --g-color-bg-elevated: oklch(20% 0.03 250);   /* Hover, raised elements */

  --g-color-border: oklch(30% 0.03 250);        /* Subtle borders */
  --g-color-border-focus: oklch(65% 0.15 250);  /* Focus/active states */

  --g-color-text: oklch(90% 0.01 250);          /* Primary text */
  --g-color-text-muted: oklch(55% 0.02 250);    /* Secondary text */

  /* Semantic colors */
  --g-color-positive: oklch(70% 0.17 145);      /* Success, gains */
  --g-color-negative: oklch(60% 0.2 25);        /* Danger, losses */
  --g-color-warning: oklch(75% 0.15 70);        /* Caution */
  --g-color-info: oklch(65% 0.15 250);          /* Accent, interactive */

  /* Effects - sci-fi glow using info color */
  --g-glow-subtle: 0 0 8px oklch(65% 0.15 250 / 0.2);
  --g-glow-focus: 0 0 12px oklch(65% 0.15 250 / 0.4);

  /* Spacing scale (4px base) */
  --g-space-xs: 4px;
  --g-space-sm: 8px;
  --g-space-md: 16px;
  --g-space-lg: 24px;

  /* Typography */
  --g-font-mono: 'JetBrains Mono', monospace;
  --g-font-size-sm: 0.75rem;
  --g-font-size-md: 0.875rem;
}
```

## Primitive Components

### GPanel

Foundational container - the "window" that frames content.

```vue
<template>
  <div class="g-panel" :class="{ 'g-panel--glow': glow }">
    <header v-if="$slots.header || title" class="g-panel__header">
      <slot name="header">{{ title }}</slot>
    </header>
    <div class="g-panel__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="g-panel__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>
```

**Props:**
- `title?: string` - Quick header text (or use `#header` slot)
- `glow?: boolean` - Adds subtle border glow for emphasis

**Slots:**
- `default` - Main content
- `header` - Custom header (overrides `title` prop)
- `footer` - Optional footer for actions

**Visual treatment:**
- Sharp corners (no border-radius)
- Single-pixel border using `--g-color-border`
- Header separated by bottom border, slightly elevated background
- Optional glow state for active/important panels

### GButton

Handles all interactive actions with consistent styling and states.

```vue
<template>
  <button
    class="g-button"
    :class="[
      `g-button--${variant}`,
      `g-button--${size}`,
      { 'g-button--loading': loading }
    ]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="g-button__spinner" />
    <slot />
  </button>
</template>
```

**Props:**
- `variant?: 'primary' | 'secondary' | 'danger' | 'ghost'` - Visual style (default: `secondary`)
- `size?: 'sm' | 'md'` - Button size (default: `md`)
- `disabled?: boolean` - Disabled state
- `loading?: boolean` - Shows spinner, disables interaction

**Visual treatment:**
- `primary` - Filled with `--g-color-info`, bright and prominent
- `secondary` - Border only, subtle, for most actions
- `danger` - `--g-color-negative` for destructive actions
- `ghost` - No border, text only, for tight spaces
- All variants get `--g-glow-subtle` on hover, `--g-glow-focus` when focused
- Sharp corners, uppercase text at small size, monospace font

### GProgress

Progress indicators for completion, countdowns, and resource levels.

```vue
<template>
  <div class="g-progress" :class="`g-progress--${variant}`">
    <div class="g-progress__track">
      <div
        class="g-progress__fill"
        :style="{ width: `${clampedPercent}%` }"
      />
    </div>
    <span v-if="showLabel" class="g-progress__label">
      <slot>{{ label }}</slot>
    </span>
  </div>
</template>
```

**Props:**
- `percent: number` - Fill amount 0-100 (required)
- `variant?: 'default' | 'positive' | 'negative' | 'warning'` - Color coding
- `showLabel?: boolean` - Display percentage or slot content
- `label?: string` - Text label (or use default slot)

**Visual treatment:**
- Thin horizontal bar (4px height) with `--g-color-bg-elevated` track
- Fill uses variant color with subtle inner glow
- Optional label to the right, monospace for alignment
- Smooth CSS transition on value changes

## Composite Components

### ResourceBadge

Displays a resource amount with icon and optional rate.

```vue
<ResourceBadge resource="energy" :amount="1250" :rate="+12" />
```

**Props:** `resource`, `amount`, `rate?`, `size?`

Uses `GIcon` + formatted numbers with `--g-color-positive/negative` for rates.

### BuildingCard

Panel-based card for a building with status and actions.

```vue
<BuildingCard :building="hab">
  <template #actions>
    <GButton size="sm">Upgrade</GButton>
  </template>
</BuildingCard>
```

Wraps `GPanel`, displays building name, worker count, production/consumption, and `GProgress` for construction if incomplete.

### CountdownTimer

Time remaining display for operations, research, etc.

```vue
<CountdownTimer :remaining="42" :total="100" label="Research" />
```

Combines `GProgress` with formatted time display.

## Integration

**No big-bang migration required.**

1. Add `theme.css` import to `main.ts` - tokens become globally available
2. New components import from `@/renderer/ui`
3. Existing components adopt primitives incrementally when touched

**Coexistence:** The `--g-` prefix prevents collision with existing `--color-*` variables in `App.vue`. Both coexist until migration complete.
