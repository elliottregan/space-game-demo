# UI Framework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a layered component library with design tokens, primitives (GPanel, GButton, GProgress), and game-specific composites (ResourceBadge, BuildingCard, CountdownTimer).

**Architecture:** Token-based styling via CSS custom properties using OKLCH color space. Low-level primitives compose into higher-level game-specific components. Props for common cases, slots for customization.

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), CSS custom properties, OKLCH colors

---

## Task 1: Create Directory Structure and Design Tokens

**Files:**
- Create: `src/renderer/ui/tokens/theme.css`
- Create: `src/renderer/ui/index.ts`
- Modify: `src/main.ts`

**Step 1: Create the ui directory structure**

```bash
mkdir -p src/renderer/ui/tokens src/renderer/ui/primitives src/renderer/ui/composites
```

**Step 2: Create theme.css with design tokens**

Create `src/renderer/ui/tokens/theme.css`:

```css
:root {
  /* Color palette - cool blues/cyans with warm accents */
  --g-color-bg-base: oklch(10% 0.02 250);
  --g-color-bg-surface: oklch(15% 0.02 250);
  --g-color-bg-elevated: oklch(20% 0.03 250);

  --g-color-border: oklch(30% 0.03 250);
  --g-color-border-focus: oklch(65% 0.15 250);

  --g-color-text: oklch(90% 0.01 250);
  --g-color-text-muted: oklch(55% 0.02 250);

  /* Semantic colors */
  --g-color-positive: oklch(70% 0.17 145);
  --g-color-negative: oklch(60% 0.2 25);
  --g-color-warning: oklch(75% 0.15 70);
  --g-color-info: oklch(65% 0.15 250);

  /* Effects - sci-fi glow */
  --g-glow-subtle: 0 0 8px oklch(65% 0.15 250 / 0.2);
  --g-glow-focus: 0 0 12px oklch(65% 0.15 250 / 0.4);

  /* Spacing scale (4px base) */
  --g-space-xs: 4px;
  --g-space-sm: 8px;
  --g-space-md: 16px;
  --g-space-lg: 24px;
  --g-space-xl: 32px;

  /* Typography */
  --g-font-mono: "JetBrains Mono", "Fira Code", "SF Mono", monospace;
  --g-font-size-xs: 0.625rem;
  --g-font-size-sm: 0.75rem;
  --g-font-size-md: 0.875rem;
  --g-font-size-lg: 1rem;

  /* Transitions */
  --g-transition-fast: 150ms ease;
  --g-transition-normal: 250ms ease;
}
```

**Step 3: Create barrel export file**

Create `src/renderer/ui/index.ts`:

```ts
// Design tokens are imported via CSS in main.ts

// Primitives
export { default as GPanel } from "./primitives/GPanel.vue";
export { default as GButton } from "./primitives/GButton.vue";
export { default as GProgress } from "./primitives/GProgress.vue";

// Composites
export { default as ResourceBadge } from "./composites/ResourceBadge.vue";
export { default as BuildingCard } from "./composites/BuildingCard.vue";
export { default as CountdownTimer } from "./composites/CountdownTimer.vue";
```

**Step 4: Import theme.css in main.ts**

Modify `src/main.ts` - add after line 4:

```ts
import "./renderer/ui/tokens/theme.css";
```

**Step 5: Verify the build still works**

Run: `bun run build`
Expected: Build succeeds (may warn about missing components, that's OK)

**Step 6: Commit**

```bash
git add src/renderer/ui src/main.ts
git commit -m "feat(ui): add directory structure and design tokens"
```

---

## Task 2: Create GPanel Primitive

**Files:**
- Create: `src/renderer/ui/primitives/GPanel.vue`

**Step 1: Create GPanel component**

Create `src/renderer/ui/primitives/GPanel.vue`:

```vue
<script setup lang="ts">
defineProps<{
  title?: string;
  glow?: boolean;
}>();
</script>

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

<style scoped>
.g-panel {
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  transition: box-shadow var(--g-transition-normal);
}

.g-panel--glow {
  box-shadow: var(--g-glow-subtle);
  border-color: var(--g-color-border-focus);
}

.g-panel__header {
  padding: var(--g-space-sm) var(--g-space-md);
  background: var(--g-color-bg-elevated);
  border-bottom: 1px solid var(--g-color-border);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--g-color-text);
}

.g-panel__body {
  padding: var(--g-space-md);
}

.g-panel__footer {
  padding: var(--g-space-sm) var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
  background: var(--g-color-bg-elevated);
}
</style>
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GPanel.vue
git commit -m "feat(ui): add GPanel primitive component"
```

---

## Task 3: Create GButton Primitive

**Files:**
- Create: `src/renderer/ui/primitives/GButton.vue`

**Step 1: Create GButton component**

Create `src/renderer/ui/primitives/GButton.vue`:

```vue
<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md";
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: "secondary",
    size: "md",
    disabled: false,
    loading: false,
  }
);
</script>

<template>
  <button
    class="g-button"
    :class="[`g-button--${variant}`, `g-button--${size}`, { 'g-button--loading': loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="g-button__spinner" />
    <slot />
  </button>
</template>

<style scoped>
.g-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-weight: 500;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background var(--g-transition-fast),
    border-color var(--g-transition-fast),
    box-shadow var(--g-transition-fast);
}

.g-button:focus-visible {
  outline: none;
  box-shadow: var(--g-glow-focus);
}

.g-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.g-button--sm {
  padding: var(--g-space-xs) var(--g-space-sm);
  font-size: var(--g-font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.g-button--md {
  padding: var(--g-space-sm) var(--g-space-md);
  font-size: var(--g-font-size-sm);
}

/* Variants */
.g-button--primary {
  background: var(--g-color-info);
  color: oklch(10% 0.02 250);
  border-color: var(--g-color-info);
}

.g-button--primary:hover:not(:disabled) {
  background: oklch(70% 0.15 250);
  box-shadow: var(--g-glow-subtle);
}

.g-button--secondary {
  background: transparent;
  color: var(--g-color-text);
  border-color: var(--g-color-border);
}

.g-button--secondary:hover:not(:disabled) {
  border-color: var(--g-color-border-focus);
  box-shadow: var(--g-glow-subtle);
}

.g-button--danger {
  background: transparent;
  color: var(--g-color-negative);
  border-color: var(--g-color-negative);
}

.g-button--danger:hover:not(:disabled) {
  background: oklch(60% 0.2 25 / 0.15);
  box-shadow: 0 0 8px oklch(60% 0.2 25 / 0.3);
}

.g-button--ghost {
  background: transparent;
  color: var(--g-color-text-muted);
  border-color: transparent;
}

.g-button--ghost:hover:not(:disabled) {
  color: var(--g-color-text);
  background: var(--g-color-bg-elevated);
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
  border: 2px solid var(--g-color-text-muted);
  border-top-color: var(--g-color-info);
  border-radius: 50%;
  animation: g-spin 0.6s linear infinite;
}

@keyframes g-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GButton.vue
git commit -m "feat(ui): add GButton primitive component"
```

---

## Task 4: Create GProgress Primitive

**Files:**
- Create: `src/renderer/ui/primitives/GProgress.vue`

**Step 1: Create GProgress component**

Create `src/renderer/ui/primitives/GProgress.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    percent: number;
    variant?: "default" | "positive" | "negative" | "warning";
    showLabel?: boolean;
    label?: string;
  }>(),
  {
    variant: "default",
    showLabel: false,
  }
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const clampedPercent = computed(() => Math.max(0, Math.min(100, props.percent)));

// biome-ignore lint/correctness/noUnusedVariables: used in template
const displayLabel = computed(() => {
  if (props.label) return props.label;
  return `${Math.round(props.percent)}%`;
});
</script>

<template>
  <div class="g-progress" :class="`g-progress--${variant}`">
    <div class="g-progress__track">
      <div class="g-progress__fill" :style="{ width: `${clampedPercent}%` }" />
    </div>
    <span v-if="showLabel" class="g-progress__label">
      <slot>{{ displayLabel }}</slot>
    </span>
  </div>
</template>

<style scoped>
.g-progress {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.g-progress__track {
  flex: 1;
  height: 4px;
  background: var(--g-color-bg-elevated);
  overflow: hidden;
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
  box-shadow: inset 0 0 4px oklch(65% 0.15 250 / 0.5);
}

.g-progress--positive .g-progress__fill {
  background: var(--g-color-positive);
  box-shadow: inset 0 0 4px oklch(70% 0.17 145 / 0.5);
}

.g-progress--negative .g-progress__fill {
  background: var(--g-color-negative);
  box-shadow: inset 0 0 4px oklch(60% 0.2 25 / 0.5);
}

.g-progress--warning .g-progress__fill {
  background: var(--g-color-warning);
  box-shadow: inset 0 0 4px oklch(75% 0.15 70 / 0.5);
}
</style>
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/ui/primitives/GProgress.vue
git commit -m "feat(ui): add GProgress primitive component"
```

---

## Task 5: Create ResourceBadge Composite

**Files:**
- Create: `src/renderer/ui/composites/ResourceBadge.vue`

**Step 1: Create ResourceBadge component**

Create `src/renderer/ui/composites/ResourceBadge.vue`:

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
  }
);

const resourceConfig = {
  food: { icon: "🌾", hue: 145 },
  oxygen: { icon: "💨", hue: 220 },
  water: { icon: "💧", hue: 210 },
  power: { icon: "⚡", hue: 70 },
  materials: { icon: "🔧", hue: 280 },
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
  if (props.rate > 0) return "g-resource-badge__rate--positive";
  if (props.rate < 0) return "g-resource-badge__rate--negative";
  return "";
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const accentColor = computed(() => `oklch(65% 0.15 ${config.value.hue})`);
</script>

<template>
  <div class="g-resource-badge" :class="`g-resource-badge--${size}`">
    <span class="g-resource-badge__icon">{{ config.icon }}</span>
    <span class="g-resource-badge__amount" :style="{ color: accentColor }">
      {{ formattedAmount }}
    </span>
    <span v-if="formattedRate" class="g-resource-badge__rate" :class="rateClass">
      {{ formattedRate }}
    </span>
  </div>
</template>

<style scoped>
.g-resource-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--g-space-xs);
  font-family: var(--g-font-mono);
}

.g-resource-badge--sm {
  font-size: var(--g-font-size-sm);
}

.g-resource-badge--sm .g-resource-badge__icon {
  font-size: 1rem;
}

.g-resource-badge--md {
  font-size: var(--g-font-size-md);
}

.g-resource-badge--md .g-resource-badge__icon {
  font-size: 1.25rem;
}

.g-resource-badge__amount {
  font-weight: 600;
}

.g-resource-badge__rate {
  font-size: 0.85em;
  padding: 1px var(--g-space-xs);
  border-radius: 2px;
}

.g-resource-badge__rate--positive {
  color: var(--g-color-positive);
  background: oklch(70% 0.17 145 / 0.15);
}

.g-resource-badge__rate--negative {
  color: var(--g-color-negative);
  background: oklch(60% 0.2 25 / 0.15);
}
</style>
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/ui/composites/ResourceBadge.vue
git commit -m "feat(ui): add ResourceBadge composite component"
```

---

## Task 6: Create CountdownTimer Composite

**Files:**
- Create: `src/renderer/ui/composites/CountdownTimer.vue`

**Step 1: Create CountdownTimer component**

Create `src/renderer/ui/composites/CountdownTimer.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import GProgress from "../primitives/GProgress.vue";

const props = defineProps<{
  remaining: number;
  total: number;
  label?: string;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const percent = computed(() => ((props.total - props.remaining) / props.total) * 100);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const timeLabel = computed(() => {
  if (props.remaining === 1) return "1 sol remaining";
  return `${props.remaining} sols remaining`;
});
</script>

<template>
  <div class="g-countdown">
    <div v-if="label" class="g-countdown__label">{{ label }}</div>
    <GProgress :percent="percent" showLabel>
      {{ timeLabel }}
    </GProgress>
  </div>
</template>

<style scoped>
.g-countdown {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.g-countdown__label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/ui/composites/CountdownTimer.vue
git commit -m "feat(ui): add CountdownTimer composite component"
```

---

## Task 7: Create BuildingCard Composite

**Files:**
- Create: `src/renderer/ui/composites/BuildingCard.vue`

**Step 1: Create BuildingCard component**

Create `src/renderer/ui/composites/BuildingCard.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import GPanel from "../primitives/GPanel.vue";
import GProgress from "../primitives/GProgress.vue";
import ResourceBadge from "./ResourceBadge.vue";
import type { PlacedBuilding } from "@/core/models/Building";

const props = defineProps<{
  building: PlacedBuilding;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const isConstructing = computed(() => props.building.constructionProgress !== undefined);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const constructionPercent = computed(() => {
  if (!props.building.constructionProgress) return 100;
  const { current, required } = props.building.constructionProgress;
  return (current / required) * 100;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const productionEntries = computed(() => {
  if (!props.building.template.production) return [];
  return Object.entries(props.building.template.production).filter(([, v]) => v !== 0);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const consumptionEntries = computed(() => {
  if (!props.building.template.consumption) return [];
  return Object.entries(props.building.template.consumption).filter(([, v]) => v !== 0);
});
</script>

<template>
  <GPanel :title="building.template.name" :glow="isConstructing">
    <div class="g-building-card__content">
      <div v-if="isConstructing" class="g-building-card__construction">
        <GProgress :percent="constructionPercent" showLabel>
          Building...
        </GProgress>
      </div>

      <template v-else>
        <div v-if="building.workers !== undefined" class="g-building-card__workers">
          <span class="g-building-card__workers-label">Workers</span>
          <span class="g-building-card__workers-count">
            {{ building.workers }} / {{ building.template.workers }}
          </span>
        </div>

        <div v-if="productionEntries.length" class="g-building-card__resources">
          <span class="g-building-card__resources-label">Produces</span>
          <div class="g-building-card__resources-list">
            <ResourceBadge
              v-for="[key, value] in productionEntries"
              :key="key"
              :resource="key as any"
              :amount="0"
              :rate="value"
              size="sm"
            />
          </div>
        </div>

        <div v-if="consumptionEntries.length" class="g-building-card__resources">
          <span class="g-building-card__resources-label">Consumes</span>
          <div class="g-building-card__resources-list">
            <ResourceBadge
              v-for="[key, value] in consumptionEntries"
              :key="key"
              :resource="key as any"
              :amount="0"
              :rate="-Math.abs(value)"
              size="sm"
            />
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <slot name="actions" />
    </template>
  </GPanel>
</template>

<style scoped>
.g-building-card__content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.g-building-card__construction {
  padding: var(--g-space-xs) 0;
}

.g-building-card__workers {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.g-building-card__workers-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.g-building-card__workers-count {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
}

.g-building-card__resources {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.g-building-card__resources-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.g-building-card__resources-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-sm);
}
</style>
```

**Step 2: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/ui/composites/BuildingCard.vue
git commit -m "feat(ui): add BuildingCard composite component"
```

---

## Task 8: Create UI Showcase Page

**Files:**
- Create: `src/renderer/components/UIShowcase.vue`
- Modify: `src/renderer/router.ts`

**Step 1: Create UIShowcase component for visual testing**

Create `src/renderer/components/UIShowcase.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { GPanel, GButton, GProgress, ResourceBadge, CountdownTimer } from "../ui";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const loading = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function simulateLoading() {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 2000);
}
</script>

<template>
  <div class="showcase">
    <h1 class="showcase__title">UI Framework Showcase</h1>

    <!-- Panels -->
    <section class="showcase__section">
      <h2>GPanel</h2>
      <div class="showcase__row">
        <GPanel title="Default Panel">
          <p>Panel body content goes here.</p>
        </GPanel>
        <GPanel title="Glow Panel" glow>
          <p>Panel with glow effect for emphasis.</p>
        </GPanel>
        <GPanel>
          <template #header>Custom Header Slot</template>
          <p>Using the header slot instead of title prop.</p>
          <template #footer>
            <GButton size="sm">Footer Action</GButton>
          </template>
        </GPanel>
      </div>
    </section>

    <!-- Buttons -->
    <section class="showcase__section">
      <h2>GButton</h2>
      <div class="showcase__row">
        <GButton variant="primary">Primary</GButton>
        <GButton variant="secondary">Secondary</GButton>
        <GButton variant="danger">Danger</GButton>
        <GButton variant="ghost">Ghost</GButton>
      </div>
      <div class="showcase__row">
        <GButton variant="primary" size="sm">Small Primary</GButton>
        <GButton variant="secondary" size="sm">Small Secondary</GButton>
        <GButton disabled>Disabled</GButton>
        <GButton :loading="loading" @click="simulateLoading">
          {{ loading ? "Loading..." : "Click to Load" }}
        </GButton>
      </div>
    </section>

    <!-- Progress -->
    <section class="showcase__section">
      <h2>GProgress</h2>
      <div class="showcase__column">
        <GProgress :percent="25" showLabel />
        <GProgress :percent="50" variant="positive" showLabel />
        <GProgress :percent="75" variant="warning" showLabel />
        <GProgress :percent="90" variant="negative" showLabel />
        <GProgress :percent="60" showLabel>Custom Label</GProgress>
      </div>
    </section>

    <!-- Resource Badges -->
    <section class="showcase__section">
      <h2>ResourceBadge</h2>
      <div class="showcase__row">
        <ResourceBadge resource="food" :amount="1250" :rate="12.5" />
        <ResourceBadge resource="water" :amount="800" :rate="-5.2" />
        <ResourceBadge resource="power" :amount="500" />
        <ResourceBadge resource="oxygen" :amount="2000" :rate="0" size="sm" />
        <ResourceBadge resource="materials" :amount="350" :rate="8" size="sm" />
      </div>
    </section>

    <!-- Countdown Timer -->
    <section class="showcase__section">
      <h2>CountdownTimer</h2>
      <div class="showcase__column" style="max-width: 300px;">
        <CountdownTimer :remaining="5" :total="10" label="Research" />
        <CountdownTimer :remaining="1" :total="3" label="Construction" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.showcase {
  padding: var(--g-space-lg);
  max-width: 1200px;
}

.showcase__title {
  font-family: var(--g-font-mono);
  font-size: 1.5rem;
  color: var(--g-color-text);
  margin-bottom: var(--g-space-xl);
}

.showcase__section {
  margin-bottom: var(--g-space-xl);
}

.showcase__section h2 {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-md);
  padding-bottom: var(--g-space-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.showcase__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-md);
  align-items: flex-start;
}

.showcase__column {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
```

**Step 2: Add route to router.ts**

Modify `src/renderer/router.ts` - add to the routes array:

```ts
{
  path: "/ui",
  name: "ui-showcase",
  component: () => import("./components/UIShowcase.vue"),
},
```

**Step 3: Verify build succeeds**

Run: `bun run build`
Expected: Build succeeds

**Step 4: Run dev server and verify visually**

Run: `bun run dev`
Navigate to: `http://localhost:5173/ui`
Expected: All components render correctly with clean sci-fi styling

**Step 5: Commit**

```bash
git add src/renderer/components/UIShowcase.vue src/renderer/router.ts
git commit -m "feat(ui): add UI showcase page for visual testing"
```

---

## Task 9: Run Tests and Final Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All 122 tests pass

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 3: Run production build**

Run: `bun run build`
Expected: Build succeeds with no errors

**Step 4: Commit any fixes if needed**

If lint or build issues found, fix and commit with appropriate message.

---

## Summary

After completing all tasks, the UI framework will include:

- **Design tokens** in `src/renderer/ui/tokens/theme.css` with OKLCH colors
- **3 primitives**: GPanel, GButton, GProgress
- **3 composites**: ResourceBadge, CountdownTimer, BuildingCard
- **Showcase page** at `/ui` for visual testing
- **Barrel export** for clean imports

All components use the new design token system and follow the clean sci-fi aesthetic.
