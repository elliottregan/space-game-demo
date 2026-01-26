# Odyssey UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Mars Colony UI from a dark sci-fi theme to a 2001: A Space Odyssey inspired aesthetic with light backgrounds, monospace typography, color-coded sections, and sharp geometric panels.

**Architecture:** Update CSS custom properties in theme.css as the foundation, then modify primitive components (GPanel, GButton, etc.) to use new visual patterns (solid color headers, no border-radius), finally update feature components. Most styling changes cascade automatically through CSS variables.

**Tech Stack:** Vue 3, CSS custom properties, OKLCH color space

---

## Task 1: Update theme.css with Odyssey color system

**Files:**
- Modify: `src/renderer/ui/tokens/theme.css`

**Step 1: Replace the entire theme.css content**

Replace all contents with:

```css
:root {
  /* === ODYSSEY THEME === */
  /* Inspired by 2001: A Space Odyssey interfaces */

  /* Base palette - light backgrounds */
  --g-color-bg-base: #FFFFFF;
  --g-color-bg-surface: #F5F5F5;
  --g-color-bg-elevated: #FAFAFA;

  /* Text colors - dark on light */
  --g-color-text: #1A1A1A;
  --g-color-text-muted: #666666;

  /* Borders */
  --g-color-border: #E0E0E0;
  --g-color-border-focus: #BDBDBD;

  /* Section accent colors (solid blocks for headers) */
  --g-accent-red: #D32F2F;
  --g-accent-cyan: #00838F;
  --g-accent-olive: #827717;
  --g-accent-amber: #F57C00;
  --g-accent-slate: #455A64;

  /* Semantic colors */
  --g-color-positive: #2E7D32;
  --g-color-negative: #C62828;
  --g-color-warning: #EF6C00;
  --g-color-info: #00838F;

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

  /* Effects - removed glow for clean look */
  --g-glow-subtle: none;
  --g-glow-focus: 0 0 0 2px var(--g-color-border-focus);

  /* Spacing scale (4px base) */
  --g-space-xs: 4px;
  --g-space-sm: 8px;
  --g-space-md: 16px;
  --g-space-lg: 24px;
  --g-space-xl: 32px;

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

**Step 2: Run lint to verify syntax**

Run: `bun run lint`
Expected: No CSS errors

**Step 3: Commit**

```bash
git add src/renderer/ui/tokens/theme.css
git commit -m "feat(ui): update theme.css with Odyssey color system"
```

---

## Task 2: Update App.vue global styles

**Files:**
- Modify: `src/renderer/App.vue`

**Step 1: Update the global styles**

Replace the entire `<style>` block (lines 35-137) with:

```css
<style>
:root {
  /* Legacy semantic colors - mapped to new system */
  --color-positive: var(--g-color-positive);
  --color-negative: var(--g-color-negative);
  --color-danger: var(--g-color-negative);
  --color-warning: var(--g-color-warning);
  --color-info: var(--g-color-info);
  --color-muted: var(--g-color-text-muted);

  /* Legacy semantic backgrounds */
  --bg-positive: rgba(46, 125, 50, 0.1);
  --bg-negative: rgba(198, 40, 40, 0.1);
  --bg-danger: rgba(198, 40, 40, 0.2);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  background: var(--g-color-bg-base);
}

body {
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  min-height: 100vh;
}

.game-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--g-space-md);
}

.game-main {
  display: flex;
  gap: var(--g-space-md);
}

.tab-content {
  flex: 1;
  min-width: 0;
}

/* Legacy panel class - for components not yet migrated */
.panel {
  background: var(--g-color-bg-surface);
  padding: var(--g-space-md);
  border: 1px solid var(--g-color-border);
}

.panel h2 {
  font-size: var(--g-font-size-lg);
  margin-bottom: var(--g-space-md);
  color: var(--g-color-text);
  border-bottom: 1px solid var(--g-color-border);
  padding-bottom: var(--g-space-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.btn {
  padding: var(--g-space-sm) var(--g-space-md);
  border: none;
  cursor: pointer;
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: filter var(--g-transition-fast);
}

.btn-primary {
  background: var(--g-accent-red);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(0.9);
}

.btn-secondary {
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .game-main {
    flex-direction: column;
  }
}
</style>
```

**Step 2: Run dev server to verify no visual errors**

Run: `bun run dev`
Expected: App loads with light background

**Step 3: Commit**

```bash
git add src/renderer/App.vue
git commit -m "feat(ui): update App.vue global styles for Odyssey theme"
```

---

## Task 3: Update GPanel with solid color headers

**Files:**
- Modify: `src/renderer/ui/primitives/GPanel.vue`

**Step 1: Update the component**

Replace the entire file with:

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    accent?: "red" | "cyan" | "olive" | "amber" | "slate";
    glow?: boolean;
  }>(),
  {
    accent: "slate",
  }
);
</script>

<template>
  <div
    class="g-panel"
    :class="[`g-panel--accent-${accent}`, { 'g-panel--glow': glow }]"
    :style="{ '--panel-accent': `var(--g-accent-${accent})` }"
  >
    <header v-if="$slots.header || $slots['header-actions'] || title" class="g-panel__header">
      <span class="g-panel__title">
        <slot name="header">{{ title }}</slot>
      </span>
      <span v-if="$slots['header-actions']" class="g-panel__header-actions">
        <slot name="header-actions" />
      </span>
    </header>
    <div class="g-panel__body">
      <slot />
    </div>
    <footer v-if="$slots.footer" class="g-panel__footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.g-panel {
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  --panel-accent: var(--g-accent-slate);
}

.g-panel--glow {
  box-shadow: 0 0 0 2px var(--panel-accent);
}

.g-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--panel-accent);
  color: white;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.g-panel__title {
  flex: 1;
}

.g-panel__header-actions {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

/* Header action buttons should be white/transparent on colored bg */
.g-panel__header-actions :deep(.g-button) {
  background: transparent;
  color: white;
  border-color: rgba(255, 255, 255, 0.5);
}

.g-panel__header-actions :deep(.g-button:hover:not(:disabled)) {
  background: rgba(255, 255, 255, 0.1);
  border-color: white;
}

.g-panel__body {
  padding: var(--g-space-md);
}

.g-panel__footer {
  padding: var(--g-space-sm) var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
  background: var(--g-color-bg-surface);
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GPanel.vue
git commit -m "feat(ui): update GPanel with solid color header blocks"
```

---

## Task 4: Update GButton for Odyssey style

**Files:**
- Modify: `src/renderer/ui/primitives/GButton.vue`

**Step 1: Replace the style block**

Replace the entire `<style scoped>` block (lines 29-134) with:

```css
<style scoped>
.g-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter var(--g-transition-fast), border-color var(--g-transition-fast);
}

.g-button:focus-visible {
  outline: 2px solid var(--g-color-border-focus);
  outline-offset: 2px;
}

.g-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.g-button--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
}

.g-button--md {
  padding: var(--g-space-sm) var(--g-space-md);
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-button--primary {
  background: var(--g-accent-red);
  color: white;
  border-color: var(--g-accent-red);
}

.g-button--primary:hover:not(:disabled) {
  filter: brightness(0.9);
}

.g-button--secondary {
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border-color: var(--g-color-border);
}

.g-button--secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
  background: var(--g-color-bg-surface);
}

.g-button--danger {
  background: var(--g-color-negative);
  color: white;
  border-color: var(--g-color-negative);
}

.g-button--danger:hover:not(:disabled) {
  filter: brightness(0.9);
}

.g-button--ghost {
  background: transparent;
  color: var(--g-color-text-muted);
  border-color: transparent;
}

.g-button--ghost:hover:not(:disabled) {
  color: var(--g-color-text);
  background: var(--g-color-bg-surface);
}

/* Loading state */
.g-button--loading {
  position: relative;
  color: transparent;
}

.g-button__spinner {
  position: absolute;
  width: 1em;
  height: 1em;
  border: 2px solid var(--g-color-border);
  border-top-color: var(--g-color-text);
  animation: g-spin 0.6s linear infinite;
}

@keyframes g-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GButton.vue
git commit -m "feat(ui): update GButton for Odyssey style - sharp corners, light theme"
```

---

## Task 5: Update GProgress with grid lines

**Files:**
- Modify: `src/renderer/ui/primitives/GProgress.vue`

**Step 1: Replace the style block**

Replace the entire `<style scoped>` block (lines 38-85) with:

```css
<style scoped>
.g-progress {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.g-progress__track {
  flex: 1;
  height: 8px;
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  overflow: hidden;
  position: relative;
}

/* Grid lines inside track */
.g-progress__track::before {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 9.5%,
    var(--g-color-border) 9.5%,
    var(--g-color-border) 10%
  );
  pointer-events: none;
}

.g-progress__fill {
  height: 100%;
  transition: width var(--g-transition-normal);
}

.g-progress__label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  min-width: 3em;
  text-align: right;
}

/* Variants */
.g-progress--default .g-progress__fill {
  background: var(--g-color-info);
}

.g-progress--positive .g-progress__fill {
  background: var(--g-color-positive);
}

.g-progress--negative .g-progress__fill {
  background: var(--g-color-negative);
}

.g-progress--warning .g-progress__fill {
  background: var(--g-color-warning);
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GProgress.vue
git commit -m "feat(ui): update GProgress with grid lines and sharp corners"
```

---

## Task 6: Update GBadge for light theme

**Files:**
- Modify: `src/renderer/ui/primitives/GBadge.vue`

**Step 1: Replace the style block**

Replace the entire `<style scoped>` block (lines 20-72) with:

```css
<style scoped>
.g-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--g-font-mono);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

/* Sizes */
.g-badge--sm {
  padding: 2px 6px;
  font-size: var(--g-font-size-xs);
}

.g-badge--md {
  padding: 4px 8px;
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-badge--default {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
}

.g-badge--info {
  background: var(--g-color-info);
  color: white;
}

.g-badge--positive {
  background: var(--g-color-positive);
  color: white;
}

.g-badge--negative {
  background: var(--g-color-negative);
  color: white;
}

.g-badge--warning {
  background: var(--g-color-warning);
  color: white;
}

.g-badge--muted {
  background: var(--g-color-bg-surface);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GBadge.vue
git commit -m "feat(ui): update GBadge for Odyssey light theme"
```

---

## Task 7: Update GInput and GSelect for light theme

**Files:**
- Modify: `src/renderer/ui/primitives/GInput.vue`
- Modify: `src/renderer/ui/primitives/GSelect.vue`

**Step 1: Update GInput style block**

Replace the entire `<style scoped>` block in GInput.vue (lines 34-72) with:

```css
<style scoped>
.g-input {
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  transition: border-color var(--g-transition-fast);
  width: 100%;
  box-sizing: border-box;
}

.g-input::placeholder {
  color: var(--g-color-text-muted);
}

.g-input:focus {
  outline: none;
  border-color: var(--g-color-border-focus);
}

.g-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--g-color-bg-surface);
}

/* Sizes */
.g-input--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
}

.g-input--md {
  padding: var(--g-space-sm) var(--g-space-md);
  font-size: var(--g-font-size-sm);
}
</style>
```

**Step 2: Update GSelect style block**

Replace the entire `<style scoped>` block in GSelect.vue (lines 45-97) with:

```css
<style scoped>
.g-select-wrapper {
  position: relative;
  display: inline-block;
}

.g-select {
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  color: var(--g-color-text);
  border: 1px solid var(--g-color-border);
  cursor: pointer;
  appearance: none;
  padding-right: calc(var(--g-space-md) + 1em);
  transition: border-color var(--g-transition-fast);
}

.g-select:focus {
  outline: none;
  border-color: var(--g-color-border-focus);
}

.g-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--g-color-bg-surface);
}

.g-select__arrow {
  position: absolute;
  right: var(--g-space-sm);
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--g-color-text-muted);
  font-size: 0.75em;
}

/* Sizes */
.g-select--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  padding-right: calc(var(--g-space-sm) + 1.5em);
  font-size: var(--g-font-size-xs);
}

.g-select--md {
  padding: var(--g-space-sm) var(--g-space-md);
  padding-right: calc(var(--g-space-md) + 1.5em);
  font-size: var(--g-font-size-sm);
}
</style>
```

**Step 3: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/renderer/ui/primitives/GInput.vue src/renderer/ui/primitives/GSelect.vue
git commit -m "feat(ui): update GInput and GSelect for Odyssey light theme"
```

---

## Task 8: Update ResourceBadge with color-coded labels

**Files:**
- Modify: `src/renderer/ui/composites/ResourceBadge.vue`

**Step 1: Replace the entire file**

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    resource: "food" | "oxygen" | "water" | "power" | "materials";
    amount: number;
    rate?: number;
    size?: "sm" | "md";
  }>(),
  {
    size: "md",
  },
);

const resourceConfig = {
  food: { label: "FOOD", color: "#827717" },      // olive
  oxygen: { label: "O2", color: "#00838F" },       // cyan
  water: { label: "H2O", color: "#1565C0" },       // blue
  power: { label: "PWR", color: "#F57C00" },       // amber
  materials: { label: "MAT", color: "#455A64" },   // slate
};

const config = computed(() => resourceConfig[props.resource]);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const formattedAmount = computed(() => Math.floor(props.amount).toLocaleString());

// biome-ignore lint/correctness/noUnusedVariables: used in template
const formattedRate = computed(() => {
  if (props.rate === undefined) return null;
  const prefix = props.rate >= 0 ? "+" : "";
  return `${prefix}${props.rate.toFixed(1)}/sol`;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const rateClass = computed(() => {
  if (props.rate === undefined) return "";
  if (props.rate > 0) return "rate--positive";
  if (props.rate < 0) return "rate--negative";
  return "";
});
</script>

<template>
  <div class="resource-badge" :class="`resource-badge--${size}`">
    <span class="resource-badge__label" :style="{ background: config.color }">
      {{ config.label }}
    </span>
    <span class="resource-badge__amount">
      {{ formattedAmount }}
    </span>
    <span v-if="formattedRate" class="resource-badge__rate" :class="rateClass">
      {{ formattedRate }}
    </span>
  </div>
</template>

<style scoped>
.resource-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--g-font-mono);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.resource-badge--sm {
  font-size: var(--g-font-size-sm);
}

.resource-badge--md {
  font-size: var(--g-font-size-md);
}

.resource-badge__label {
  padding: var(--g-space-xs) var(--g-space-sm);
  color: white;
  font-weight: 600;
  font-size: 0.85em;
  letter-spacing: 0.05em;
}

.resource-badge__amount {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-weight: 600;
  color: var(--g-color-text);
}

.resource-badge__rate {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: 0.85em;
  border-left: 1px solid var(--g-color-border);
}

.rate--positive {
  color: var(--g-color-positive);
}

.rate--negative {
  color: var(--g-color-negative);
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/ui/composites/ResourceBadge.vue
git commit -m "feat(ui): update ResourceBadge with vital signs style color labels"
```

---

## Task 9: Update GameHeader for Odyssey style

**Files:**
- Modify: `src/renderer/components/GameHeader.vue`

**Step 1: Replace the style block**

Replace the entire `<style scoped>` block (lines 54-124) with:

```css
<style scoped>
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--g-space-sm);
  padding: var(--g-space-md);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  margin-bottom: var(--g-space-md);
}

.game-header h1 {
  font-family: var(--g-font-mono);
  color: var(--g-accent-red);
  font-size: var(--g-font-size-xl);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sol-display {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-2xl);
  color: var(--g-color-text);
  font-weight: 700;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  gap: var(--g-space-sm);
}

@media (max-width: 768px) {
  .game-header {
    padding: var(--g-space-sm);
  }

  .game-header h1 {
    font-size: var(--g-font-size-lg);
  }

  .sol-display {
    font-size: var(--g-font-size-xl);
  }

  .header-actions {
    gap: var(--g-space-xs);
  }
}

@media (max-width: 480px) {
  .game-header {
    justify-content: center;
  }

  .game-header h1 {
    width: 100%;
    text-align: center;
    font-size: var(--g-font-size-md);
  }

  .sol-display {
    font-size: var(--g-font-size-lg);
  }

  .header-actions {
    width: 100%;
    justify-content: center;
  }
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/GameHeader.vue
git commit -m "feat(ui): update GameHeader for Odyssey style"
```

---

## Task 10: Update TabNav for Odyssey style

**Files:**
- Modify: `src/renderer/components/TabNav.vue`

**Step 1: Replace the style block**

Replace the entire `<style scoped>` block (lines 22-52) with:

```css
<style scoped>
.tab-nav {
  display: flex;
  gap: 0;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
  margin-bottom: var(--g-space-md);
}

.tab-link {
  padding: var(--g-space-sm) var(--g-space-lg);
  color: var(--g-color-text-muted);
  text-decoration: none;
  font-family: var(--g-font-mono);
  font-weight: 500;
  font-size: var(--g-font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 3px solid transparent;
  transition: color var(--g-transition-fast), background var(--g-transition-fast);
}

.tab-link:hover {
  color: var(--g-color-text);
  background: var(--g-color-bg-surface);
}

.tab-link.active {
  color: var(--g-color-text);
  border-bottom-color: var(--g-accent-red);
  background: var(--g-color-bg-surface);
}

/* Add subtle dividers between tabs */
.tab-link + .tab-link {
  border-left: 1px solid var(--g-color-border);
}
</style>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/TabNav.vue
git commit -m "feat(ui): update TabNav for Odyssey style"
```

---

## Task 11: Update ResourcePanel to use accent colors

**Files:**
- Modify: `src/renderer/components/ResourcePanel/ResourcePanel.vue`

**Step 1: Update the GPanel usage**

Change line 63 from:
```vue
<GPanel title="Resources">
```

To:
```vue
<GPanel title="Resources" accent="red">
```

**Step 2: Update the style block**

Replace the entire `<style scoped>` block (lines 88-128) with:

```css
<style scoped>
.resource-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.resource-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.projected-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  opacity: 0.9;
  margin-left: auto;
  transition: all var(--g-transition-fast);
  color: inherit;
}

.projected-value.projected-negative {
  color: var(--g-color-negative);
}

.projected-value.projected-positive {
  color: var(--g-color-positive);
}

.projected-value.projected-danger {
  color: var(--g-color-negative);
  font-weight: bold;
  background: rgba(198, 40, 40, 0.1);
  padding: 0 var(--g-space-xs);
}
</style>
```

**Step 3: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/renderer/components/ResourcePanel/ResourcePanel.vue
git commit -m "feat(ui): update ResourcePanel with red accent"
```

---

## Task 12: Update EventLogSidebar for Odyssey style

**Files:**
- Modify: `src/renderer/components/EventLogSidebar.vue`

**Step 1: Read current file to understand structure**

Run: `cat src/renderer/components/EventLogSidebar.vue`

**Step 2: Update to use GPanel with slate accent and update styles**

If using GPanel, add `accent="slate"` prop.

Update styles to use Odyssey variables:
- Remove border-radius
- Use var(--g-color-*) variables
- Use var(--g-space-*) for spacing

**Step 3: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/renderer/components/EventLogSidebar.vue
git commit -m "feat(ui): update EventLogSidebar for Odyssey style"
```

---

## Task 13: Run full test suite and visual verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All 309 tests pass

**Step 2: Start dev server**

Run: `bun run dev`

**Step 3: Visual verification checklist**

- [ ] White/light background throughout
- [ ] Colored header blocks on panels (red for Resources, etc.)
- [ ] Sharp corners on all elements (no border-radius)
- [ ] Monospace typography everywhere
- [ ] Color-coded resource labels (FOOD, O2, H2O, PWR, MAT)
- [ ] Progress bars have grid lines
- [ ] Buttons have proper hover states
- [ ] Tab navigation has colored underline on active

**Step 4: Fix any visual issues found**

**Step 5: Final commit if needed**

```bash
git add -A
git commit -m "fix(ui): address visual issues from Odyssey theme"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | theme.css | New Odyssey color system |
| 2 | App.vue | Global styles update |
| 3 | GPanel.vue | Solid color headers |
| 4 | GButton.vue | Sharp corners, light theme |
| 5 | GProgress.vue | Grid lines, sharp corners |
| 6 | GBadge.vue | Light theme colors |
| 7 | GInput.vue, GSelect.vue | Light theme |
| 8 | ResourceBadge.vue | Vital signs style labels |
| 9 | GameHeader.vue | Light theme, red title |
| 10 | TabNav.vue | Sharp corners, colored underline |
| 11 | ResourcePanel.vue | Red accent |
| 12 | EventLogSidebar.vue | Slate accent |
| 13 | - | Testing and verification |

**Total commits:** 12-13

**Key patterns:**
- All components use `--g-*` CSS variables
- Panel headers use solid accent colors
- No border-radius anywhere
- Monospace font throughout
- Section-specific accent colors
