# Dark Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dark mode with OKLCH colors, pure black backgrounds, system preference detection, and manual override toggle.

**Architecture:** CSS variables in theme.css define both light/dark themes. Media query + `data-theme` attribute control which applies. Vue composable manages preference state and localStorage persistence. Toggle button in GameHeader cycles through system/light/dark.

**Tech Stack:** Vue 3, CSS custom properties, OKLCH color space, localStorage

---

## Task 1: Update theme.css with OKLCH light theme

**Files:**
- Modify: `src/renderer/ui/tokens/theme.css`

**Step 1: Convert existing light theme to OKLCH**

Replace the entire contents of `src/renderer/ui/tokens/theme.css`:

```css
:root {
  /* === ODYSSEY THEME === */
  /* Light mode (default) - converted to OKLCH */

  /* Base palette - light backgrounds */
  --g-color-bg-base: oklch(100% 0 0);
  --g-color-bg-surface: oklch(96% 0 0);
  --g-color-bg-elevated: oklch(98% 0 0);

  /* Text colors - dark on light */
  --g-color-text: oklch(15% 0 0);
  --g-color-text-muted: oklch(40% 0 0);

  /* Borders */
  --g-color-border: oklch(88% 0 0);
  --g-color-border-strong: oklch(15% 0 0);
  --g-color-border-focus: oklch(75% 0 0);

  /* Section accent colors */
  --g-accent-red: oklch(52% 0.22 25);
  --g-accent-cyan: oklch(52% 0.10 200);
  --g-accent-olive: oklch(52% 0.12 105);
  --g-accent-amber: oklch(62% 0.18 55);
  --g-accent-slate: oklch(42% 0.02 250);

  /* Semantic colors */
  --g-color-positive: oklch(48% 0.15 145);
  --g-color-negative: oklch(48% 0.22 25);
  --g-color-warning: oklch(58% 0.18 55);
  --g-color-info: oklch(52% 0.10 200);

  /* Section-specific accent mappings */
  --g-section-resources: var(--g-accent-red);
  --g-section-buildings: var(--g-accent-amber);
  --g-section-technology: var(--g-accent-cyan);
  --g-section-colony: var(--g-accent-olive);
  --g-section-politics: var(--g-accent-slate);
  --g-section-operations: var(--g-accent-amber);
  --g-section-events: var(--g-accent-slate);

  /* Current section accent (set by panels) */
  --g-current-accent: var(--g-accent-slate);

  /* Effects */
  --g-glow-subtle: none;
  --g-glow-focus: 0 0 0 2px var(--g-color-border-focus);

  /* Spacing scale (4px base) */
  --g-space-xs: 4px;
  --g-space-sm: 8px;
  --g-space-md: 16px;
  --g-space-lg: 24px;
  --g-space-xl: 32px;

  /* Border widths */
  --g-border-width-thin: 1px;
  --g-border-width: 2px;
  --g-border-width-thick: 3px;

  /* Typography */
  --g-font-mono: "JetBrains Mono", "Fira Code", "SF Mono", "Consolas", monospace;
  --g-font-size-xs: 0.625rem;
  --g-font-size-sm: 0.75rem;
  --g-font-size-md: 0.875rem;
  --g-font-size-lg: 1rem;
  --g-font-size-xl: 1.25rem;
  --g-font-size-2xl: 1.5rem;

  /* Transitions */
  --g-transition-fast: 150ms ease;
  --g-transition-normal: 250ms ease;
}
```

**Step 2: Run dev server to verify light theme still works**

Run: `bun run dev`
Expected: App renders with same appearance as before (OKLCH values match original hex)

**Step 3: Commit**

```bash
git add src/renderer/ui/tokens/theme.css
git commit -m "refactor(theme): convert light theme to OKLCH color space"
```

---

## Task 2: Add dark mode CSS variables

**Files:**
- Modify: `src/renderer/ui/tokens/theme.css`

**Step 1: Add dark mode via media query and data-theme**

Append to the end of `src/renderer/ui/tokens/theme.css`:

```css

/* === DARK MODE === */
/* System preference - applies when no manual override */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Pure black backgrounds */
    --g-color-bg-base: oklch(0% 0 0);
    --g-color-bg-surface: oklch(0% 0 0);
    --g-color-bg-elevated: oklch(0% 0 0);

    /* Pure white text */
    --g-color-text: oklch(100% 0 0);
    --g-color-text-muted: oklch(60% 0 0);

    /* Dark borders */
    --g-color-border: oklch(25% 0 0);
    --g-color-border-strong: oklch(100% 0 0);
    --g-color-border-focus: oklch(40% 0 0);

    /* Brightened accents for dark mode */
    --g-accent-red: oklch(65% 0.22 25);
    --g-accent-cyan: oklch(70% 0.12 200);
    --g-accent-olive: oklch(68% 0.12 105);
    --g-accent-amber: oklch(72% 0.16 65);
    --g-accent-slate: oklch(55% 0.02 250);

    /* Brightened semantic colors */
    --g-color-positive: oklch(68% 0.17 145);
    --g-color-negative: oklch(65% 0.22 25);
    --g-color-warning: oklch(75% 0.18 60);
    --g-color-info: oklch(70% 0.12 200);

    /* Glow effect for focus states */
    --g-glow-focus: 0 0 0 2px var(--g-color-border-focus);
  }
}

/* Manual dark mode override */
:root[data-theme="dark"] {
  /* Pure black backgrounds */
  --g-color-bg-base: oklch(0% 0 0);
  --g-color-bg-surface: oklch(0% 0 0);
  --g-color-bg-elevated: oklch(0% 0 0);

  /* Pure white text */
  --g-color-text: oklch(100% 0 0);
  --g-color-text-muted: oklch(60% 0 0);

  /* Dark borders */
  --g-color-border: oklch(25% 0 0);
  --g-color-border-strong: oklch(100% 0 0);
  --g-color-border-focus: oklch(40% 0 0);

  /* Brightened accents for dark mode */
  --g-accent-red: oklch(65% 0.22 25);
  --g-accent-cyan: oklch(70% 0.12 200);
  --g-accent-olive: oklch(68% 0.12 105);
  --g-accent-amber: oklch(72% 0.16 65);
  --g-accent-slate: oklch(55% 0.02 250);

  /* Brightened semantic colors */
  --g-color-positive: oklch(68% 0.17 145);
  --g-color-negative: oklch(65% 0.22 25);
  --g-color-warning: oklch(75% 0.18 60);
  --g-color-info: oklch(70% 0.12 200);

  /* Glow effect for focus states */
  --g-glow-focus: 0 0 0 2px var(--g-color-border-focus);
}
```

**Step 2: Test dark mode manually**

Run: `bun run dev`
Open browser DevTools, add `data-theme="dark"` to `<html>` element.
Expected: Background turns pure black, text turns white, accent colors brighten.

**Step 3: Commit**

```bash
git add src/renderer/ui/tokens/theme.css
git commit -m "feat(theme): add dark mode with OKLCH colors and pure black backgrounds"
```

---

## Task 3: Create useTheme composable

**Files:**
- Create: `src/renderer/composables/useTheme.ts`

**Step 1: Create the composable**

Create `src/renderer/composables/useTheme.ts`:

```typescript
import { ref } from "vue";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme-preference";

const theme = ref<Theme>(
  (localStorage.getItem(STORAGE_KEY) as Theme) || "system"
);

function applyTheme(newTheme: Theme) {
  if (newTheme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", newTheme);
  }
}

export function setTheme(newTheme: Theme) {
  theme.value = newTheme;

  if (newTheme === "system") {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, newTheme);
  }

  applyTheme(newTheme);
}

export function initTheme() {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored && stored !== "system") {
    applyTheme(stored);
    theme.value = stored;
  }
}

export function useTheme() {
  return { theme, setTheme };
}
```

**Step 2: Verify file compiles**

Run: `bun run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Commit**

```bash
git add src/renderer/composables/useTheme.ts
git commit -m "feat(theme): add useTheme composable for theme switching"
```

---

## Task 4: Initialize theme on app start

**Files:**
- Modify: `src/main.ts`

**Step 1: Import and call initTheme**

In `src/main.ts`, add the import after existing imports:

```typescript
import { initTheme } from "./renderer/composables/useTheme";
```

Then add the call before `app.mount("#app")`:

```typescript
// Initialize theme from localStorage
initTheme();

app.mount("#app");
```

**Step 2: Verify initialization works**

Run: `bun run dev`
Open browser, set `localStorage.setItem('theme-preference', 'dark')` in console, refresh.
Expected: Page loads with dark theme applied (data-theme="dark" on html element).

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(theme): initialize theme preference on app startup"
```

---

## Task 5: Add theme toggle to GameHeader

**Files:**
- Modify: `src/renderer/components/GameHeader.vue`

**Step 1: Add theme toggle button**

In `src/renderer/components/GameHeader.vue`:

Add import in `<script setup>`:

```typescript
import { computed } from "vue";
import { useTheme, setTheme, type Theme } from "../composables/useTheme";
```

Add after existing function definitions:

```typescript
const { theme } = useTheme();

const themeLabel = computed(() => {
  switch (theme.value) {
    case "light":
      return "Light";
    case "dark":
      return "Dark";
    default:
      return "Auto";
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function cycleTheme() {
  const order: Theme[] = ["system", "light", "dark"];
  const currentIndex = order.indexOf(theme.value);
  const nextIndex = (currentIndex + 1) % order.length;
  setTheme(order[nextIndex]);
}
```

In the template, add a button before the "New Game" button:

```vue
<GButton variant="secondary" @click="cycleTheme">
  {{ themeLabel }}
</GButton>
```

**Step 2: Verify toggle works**

Run: `bun run dev`
Click the theme toggle button repeatedly.
Expected: Cycles through Auto → Light → Dark → Auto, and UI updates accordingly.

**Step 3: Commit**

```bash
git add src/renderer/components/GameHeader.vue
git commit -m "feat(theme): add theme toggle button to GameHeader"
```

---

## Task 6: Run full test suite and verify

**Step 1: Run all tests**

Run: `bun test`
Expected: All 477 tests pass

**Step 2: Manual verification checklist**

Run: `bun run dev`

Verify:
- [ ] Light mode: White background, dark text, muted accents
- [ ] Dark mode: Pure black background, white text, bright accents
- [ ] System mode: Follows OS preference
- [ ] Toggle cycles: Auto → Light → Dark → Auto
- [ ] Preference persists after page refresh
- [ ] All panels render correctly in both modes
- [ ] Buttons, badges, progress bars adapt to theme

**Step 3: Final commit if any fixes needed**

---

## Summary

| Task | Files | Commits |
|------|-------|---------|
| 1 | theme.css | refactor: convert to OKLCH |
| 2 | theme.css | feat: add dark mode |
| 3 | useTheme.ts | feat: add composable |
| 4 | main.ts | feat: initialize theme |
| 5 | GameHeader.vue | feat: add toggle |
| 6 | - | verification |

**Total: 5 commits, 4 files modified/created**
