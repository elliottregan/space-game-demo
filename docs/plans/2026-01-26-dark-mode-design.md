# Dark Mode Design

## Overview

Add a dark mode theme inspired by 2001: A Space Odyssey's pure black interfaces combined with Habita's clean minimalist approach. Uses OKLCH color space for perceptually consistent colors. Supports system preference detection with manual override.

## Design Decisions

- **Backgrounds**: Pure black (#000) with no intermediate surface layers - colored elements float on the void
- **Text**: Pure white for maximum contrast
- **Accent colors**: Brightened versions of existing accents using OKLCH for better visibility on dark backgrounds
- **Theme switching**: Respects `prefers-color-scheme` with manual override stored in localStorage

## Color Tokens

### Light Mode (current, converted to OKLCH)

```css
--g-color-bg-base: oklch(100% 0 0);
--g-color-bg-surface: oklch(96% 0 0);
--g-color-bg-elevated: oklch(98% 0 0);
--g-color-text: oklch(15% 0 0);
--g-color-text-muted: oklch(40% 0 0);
--g-color-border: oklch(88% 0 0);
--g-color-border-strong: oklch(15% 0 0);
--g-color-border-focus: oklch(75% 0 0);
```

### Dark Mode

```css
--g-color-bg-base: oklch(0% 0 0);
--g-color-bg-surface: oklch(0% 0 0);
--g-color-bg-elevated: oklch(0% 0 0);
--g-color-text: oklch(100% 0 0);
--g-color-text-muted: oklch(60% 0 0);
--g-color-border: oklch(25% 0 0);
--g-color-border-strong: oklch(100% 0 0);
--g-color-border-focus: oklch(40% 0 0);
```

### Accent Colors (brightened for dark mode)

```css
/* Dark mode accents - increased lightness */
--g-accent-red: oklch(65% 0.22 25);
--g-accent-cyan: oklch(70% 0.12 200);
--g-accent-olive: oklch(68% 0.12 105);
--g-accent-amber: oklch(72% 0.16 65);
--g-accent-slate: oklch(55% 0.02 250);

/* Semantic colors */
--g-color-positive: oklch(68% 0.17 145);
--g-color-negative: oklch(65% 0.22 25);
--g-color-warning: oklch(75% 0.18 60);
--g-color-info: oklch(70% 0.12 200);
```

### Light Mode Accents (original values in OKLCH)

```css
--g-accent-red: oklch(52% 0.22 25);
--g-accent-cyan: oklch(52% 0.10 200);
--g-accent-olive: oklch(52% 0.12 105);
--g-accent-amber: oklch(62% 0.18 55);
--g-accent-slate: oklch(42% 0.02 250);

--g-color-positive: oklch(48% 0.15 145);
--g-color-negative: oklch(48% 0.22 25);
--g-color-warning: oklch(58% 0.18 55);
--g-color-info: oklch(52% 0.10 200);
```

## Implementation

### Files to Modify

| File | Change |
|------|--------|
| `src/renderer/ui/tokens/theme.css` | Add dark mode variables with media query and `[data-theme]` selectors |
| `src/main.ts` | Initialize theme from localStorage on app start |
| `src/renderer/components/GameHeader.vue` | Add ThemeToggle button |

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/composables/useTheme.ts` | Theme state management and toggle logic |

### No Changes Needed

All UI primitives (GPanel, GButton, GBadge, GProgress, etc.) already use CSS variables and will automatically adapt.

## Theme CSS Structure

```css
:root {
  /* Light theme (default) */
  --g-color-bg-base: oklch(100% 0 0);
  /* ... */
}

/* Dark theme - system preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --g-color-bg-base: oklch(0% 0 0);
    /* ... */
  }
}

/* Dark theme - manual override */
:root[data-theme="dark"] {
  --g-color-bg-base: oklch(0% 0 0);
  /* ... */
}
```

## useTheme Composable

```ts
// src/renderer/composables/useTheme.ts
import { ref, watchEffect } from 'vue';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'theme-preference';

const theme = ref<Theme>(
  (localStorage.getItem(STORAGE_KEY) as Theme) || 'system'
);

function setTheme(newTheme: Theme) {
  theme.value = newTheme;

  if (newTheme === 'system') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem(STORAGE_KEY);
  } else {
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
  }
}

// Initialize on import
const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
if (stored && stored !== 'system') {
  document.documentElement.setAttribute('data-theme', stored);
}

export function useTheme() {
  return { theme, setTheme };
}
```

## Theme Toggle UI

A three-state toggle in GameHeader:

```vue
<template>
  <GButton variant="secondary" @click="cycleTheme">
    {{ themeIcon }}
  </GButton>
</template>

<script setup>
import { computed } from 'vue';
import { useTheme } from '../composables/useTheme';

const { theme, setTheme } = useTheme();

const themeIcon = computed(() => {
  switch (theme.value) {
    case 'light': return 'Light';
    case 'dark': return 'Dark';
    default: return 'Auto';
  }
});

function cycleTheme() {
  const order: Theme[] = ['system', 'light', 'dark'];
  const currentIndex = order.indexOf(theme.value);
  const nextIndex = (currentIndex + 1) % order.length;
  setTheme(order[nextIndex]);
}
</script>
```

## Testing

1. Toggle between light/dark/system and verify colors change
2. Refresh page and verify preference persists
3. Change OS preference and verify system mode responds
4. Verify all panels, buttons, badges render correctly in both modes
