# Tabbed Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the cluttered 8-panel dashboard into a tabbed interface with Vue Router, reducing cognitive load while keeping EventLog always visible.

**Architecture:** Two route-based tabs (Main, Strategy) rendered via `<router-view>`, with EventLog in a fixed sidebar. Extract header into its own component. Existing panel components remain unchanged.

**Tech Stack:** Vue 3, Vue Router 4, TypeScript

---

## Task 1: Add Vue Router Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install vue-router**

Run:
```bash
bun add vue-router
```

Expected: vue-router added to dependencies in package.json

**Step 2: Verify installation**

Run:
```bash
bun run build
```

Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add vue-router dependency"
```

---

## Task 2: Create Router Configuration

**Files:**
- Create: `src/renderer/router.ts`

**Step 1: Create router configuration file**

```typescript
import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/main",
    },
    {
      path: "/main",
      name: "main",
      component: () => import("./components/MainTab.vue"),
    },
    {
      path: "/strategy",
      name: "strategy",
      component: () => import("./components/StrategyTab.vue"),
    },
  ],
});

export default router;
```

**Step 2: Verify file syntax**

Run:
```bash
bun run lint
```

Expected: No lint errors (component imports will be unresolved until we create them, but that's OK)

**Step 3: Commit**

```bash
git add src/renderer/router.ts
git commit -m "feat: add vue router configuration with main and strategy routes"
```

---

## Task 3: Create GameHeader Component

**Files:**
- Create: `src/renderer/components/GameHeader.vue`

**Step 1: Create the header component**

Extract header from App.vue into its own component:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";

const state = gameService.getState();

const props = defineProps<{
  isGameOver: boolean;
  hasActiveEvent: boolean;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function advanceTurn() {
  gameService.advanceTurn(10);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function newGame() {
  gameService.newGame();
}
</script>

<template>
  <header class="game-header">
    <h1>Mars Colony</h1>
    <div class="sol-display">Sol {{ state.currentSol }}</div>
    <div class="header-actions">
      <button
        @click="advanceTurn"
        :disabled="props.isGameOver || props.hasActiveEvent"
        class="advance-btn"
      >
        Advance 10 Sols
      </button>
      <button @click="newGame" class="new-game-btn">New Game</button>
    </div>
  </header>
</template>

<style scoped>
.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.game-header h1 {
  color: #e94560;
  font-size: 1.8rem;
}

.sol-display {
  font-size: 1.5rem;
  color: #ffd460;
  font-weight: bold;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.advance-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: linear-gradient(135deg, #e94560, #c73659);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-weight: bold;
  transition: transform 0.2s, box-shadow 0.2s;
}

.advance-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}

.advance-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-game-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.new-game-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
```

**Step 2: Verify lint passes**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/GameHeader.vue
git commit -m "feat: extract GameHeader component from App.vue"
```

---

## Task 4: Create TabNav Component

**Files:**
- Create: `src/renderer/components/TabNav.vue`

**Step 1: Create the tab navigation component**

```vue
<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <nav class="tab-nav">
    <RouterLink to="/main" class="tab-link" active-class="active">
      Main
    </RouterLink>
    <RouterLink to="/strategy" class="tab-link" active-class="active">
      Strategy
    </RouterLink>
  </nav>
</template>

<style scoped>
.tab-nav {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.tab-link {
  padding: 0.75rem 1.5rem;
  color: #888;
  text-decoration: none;
  font-weight: 500;
  border-radius: 6px;
  transition: color 0.2s, background 0.2s;
  border-bottom: 3px solid transparent;
}

.tab-link:hover {
  color: #e8e8e8;
  background: rgba(255, 255, 255, 0.05);
}

.tab-link.active {
  color: #e8e8e8;
  border-bottom-color: #e94560;
  background: rgba(255, 255, 255, 0.1);
}
</style>
```

**Step 2: Verify lint passes**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/TabNav.vue
git commit -m "feat: add TabNav component with router links"
```

---

## Task 5: Create MainTab Component

**Files:**
- Create: `src/renderer/components/MainTab.vue`

**Step 1: Create the main tab container**

```vue
<script setup lang="ts">
import ResourcePanel from "./ResourcePanel.vue";
import ColonyPanel from "./ColonyPanel.vue";
import BuildingPanel from "./BuildingPanel.vue";
</script>

<template>
  <div class="main-tab">
    <div class="main-tab-left">
      <ResourcePanel />
      <ColonyPanel />
    </div>
    <div class="main-tab-right">
      <BuildingPanel />
    </div>
  </div>
</template>

<style scoped>
.main-tab {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 1rem;
}

.main-tab-left {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.main-tab-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .main-tab {
    grid-template-columns: 1fr;
  }
}
</style>
```

**Step 2: Verify lint passes**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/MainTab.vue
git commit -m "feat: add MainTab component with Resources, Colony, Buildings"
```

---

## Task 6: Create StrategyTab Component

**Files:**
- Create: `src/renderer/components/StrategyTab.vue`

**Step 1: Create the strategy tab container**

```vue
<script setup lang="ts">
import TechnologyPanel from "./TechnologyPanel.vue";
import PoliticsPanel from "./PoliticsPanel.vue";
import OperationsPanel from "./OperationsPanel.vue";
import NPCInfluencePanel from "./NPCInfluencePanel.vue";
</script>

<template>
  <div class="strategy-tab">
    <div class="strategy-tab-left">
      <TechnologyPanel />
      <PoliticsPanel />
    </div>
    <div class="strategy-tab-right">
      <OperationsPanel />
      <NPCInfluencePanel />
    </div>
  </div>
</template>

<style scoped>
.strategy-tab {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.strategy-tab-left,
.strategy-tab-right {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 768px) {
  .strategy-tab {
    grid-template-columns: 1fr;
  }
}
</style>
```

**Step 2: Verify lint passes**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/StrategyTab.vue
git commit -m "feat: add StrategyTab component with Tech, Politics, Operations, NPC"
```

---

## Task 7: Create EventLogSidebar Component

**Files:**
- Create: `src/renderer/components/EventLogSidebar.vue`

**Step 1: Create the sidebar event log component**

Adapted from EventLog.vue for sidebar context:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const displayedEvents = computed(() => {
  return state.recentEvents.slice(-15).reverse();
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSeverityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getIcon(type: string): string {
  if (type.includes("RESOURCE")) return "📦";
  if (type.includes("BUILDING")) return "🏗️";
  if (type.includes("RESEARCH")) return "🔬";
  if (type.includes("COLONIST") || type.includes("POPULATION")) return "👥";
  if (type.includes("FACTION")) return "🏛️";
  if (type.includes("VICTORY")) return "🎉";
  if (type.includes("DEFEAT")) return "💀";
  if (type.includes("EVENT")) return "⚠️";
  if (type.includes("TRAINING")) return "📚";
  if (type.includes("MASTERY")) return "⭐";
  return "📌";
}
</script>

<template>
  <aside class="event-log-sidebar">
    <h2 class="sidebar-header">Event Log</h2>
    <div class="event-list">
      <div
        v-for="(event, index) in displayedEvents"
        :key="index"
        class="event-item"
        :class="getSeverityClass(event.severity)"
      >
        <span class="event-icon">{{ getIcon(event.type) }}</span>
        <span class="event-message">{{ event.message || event.type }}</span>
      </div>
      <div v-if="displayedEvents.length === 0" class="no-events">
        No recent events
      </div>
    </div>
  </aside>
</template>

<style scoped>
.event-log-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 180px);
}

.sidebar-header {
  font-size: 1.2rem;
  color: #ffd460;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin: 0;
  position: sticky;
  top: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px 8px 0 0;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.event-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid;
}

.event-item.info {
  border-color: #60a5fa;
}

.event-item.warning {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.event-item.critical {
  border-color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.event-icon {
  flex-shrink: 0;
}

.event-message {
  color: #e8e8e8;
  line-height: 1.3;
}

.no-events {
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 1rem;
}
</style>
```

**Step 2: Verify lint passes**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/EventLogSidebar.vue
git commit -m "feat: add EventLogSidebar component for always-visible event log"
```

---

## Task 8: Wire Up Router in main.ts

**Files:**
- Modify: `src/main.ts`

**Step 1: Update main.ts to use router**

Replace the entire contents of `src/main.ts`:

```typescript
import { createApp } from "vue";
import App from "./renderer/App.vue";
import router from "./renderer/router";
import { vResourceGlow, resourceHighlightStyles } from "./renderer/directives/ResourceHighlight";

// Inject resource highlight styles
const styleEl = document.createElement("style");
styleEl.textContent = resourceHighlightStyles;
document.head.appendChild(styleEl);

const app = createApp(App);

// Register the resource glow directive globally
app.directive("resource-glow", vResourceGlow);

// Use router
app.use(router);

app.mount("#app");
```

**Step 2: Verify build succeeds**

Run:
```bash
bun run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up vue router in main.ts"
```

---

## Task 9: Update App.vue to Use New Components

**Files:**
- Modify: `src/renderer/App.vue`

**Step 1: Replace App.vue with new tabbed layout**

Replace the entire contents of `src/renderer/App.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "./services/GameService";
import GameHeader from "./components/GameHeader.vue";
import TabNav from "./components/TabNav.vue";
import EventLogSidebar from "./components/EventLogSidebar.vue";
import EventModal from "./components/EventModal.vue";
import GameOverModal from "./components/GameOverModal.vue";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const isGameOver = computed(() => state.victoryState.status !== "playing");
// biome-ignore lint/correctness/noUnusedVariables: used in template
const hasActiveEvent = computed(() => state.activeEvent !== null);
</script>

<template>
  <div class="game-container">
    <GameHeader :is-game-over="isGameOver" :has-active-event="hasActiveEvent" />
    <TabNav />

    <main class="game-main">
      <div class="tab-content">
        <router-view />
      </div>
      <EventLogSidebar />
    </main>

    <EventModal v-if="hasActiveEvent" />
    <GameOverModal v-if="isGameOver" />
  </div>
</template>

<style>
:root {
  /* Semantic colors */
  --color-positive: #4ade80;
  --color-negative: #f87171;
  --color-danger: #ef4444;
  --color-warning: #fbbf24;
  --color-info: #60a5fa;
  --color-muted: #888;

  /* Semantic backgrounds */
  --bg-positive: rgba(74, 222, 128, 0.1);
  --bg-negative: rgba(248, 113, 113, 0.1);
  --bg-danger: rgba(239, 68, 68, 0.2);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  color: #e8e8e8;
  min-height: 100vh;
}

.game-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 1rem;
}

.game-main {
  display: flex;
  gap: 1rem;
}

.tab-content {
  flex: 1;
  min-width: 0;
}

.panel {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.panel h2 {
  font-size: 1.2rem;
  margin-bottom: 1rem;
  color: #ffd460;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #e94560;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #c73659;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
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

**Step 2: Verify build succeeds**

Run:
```bash
bun run build
```

Expected: Build succeeds

**Step 3: Verify dev server works**

Run:
```bash
bun run dev
```

Expected: App loads at localhost, tabs work, sidebar visible

**Step 4: Commit**

```bash
git add src/renderer/App.vue
git commit -m "feat: update App.vue to use tabbed layout with router-view"
```

---

## Task 10: Delete Old EventLog Component

**Files:**
- Delete: `src/renderer/components/EventLog.vue`

**Step 1: Remove the old EventLog component**

Run:
```bash
rm src/renderer/components/EventLog.vue
```

**Step 2: Verify build still succeeds**

Run:
```bash
bun run build
```

Expected: Build succeeds (EventLog.vue is no longer imported anywhere)

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: remove old EventLog component, replaced by EventLogSidebar"
```

---

## Task 11: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run:
```bash
bun test
```

Expected: All tests pass (core logic unchanged)

**Step 2: Run lint**

Run:
```bash
bun run lint
```

Expected: No errors

**Step 3: Format code**

Run:
```bash
bun run format
```

Expected: Files formatted

**Step 4: Final verification commit**

```bash
git add -A
git commit -m "chore: format and verify tabbed dashboard implementation"
```

---

## Task 12: Manual Testing Checklist

**Files:**
- None (manual verification)

**Step 1: Start dev server**

Run:
```bash
bun run dev
```

**Step 2: Verify these behaviors manually:**

- [ ] App loads on Main tab by default (URL is `/main`)
- [ ] Clicking "Strategy" tab navigates to `/strategy`
- [ ] Browser back button returns to Main tab
- [ ] Main tab shows: ResourcePanel, ColonyPanel, BuildingPanel
- [ ] Strategy tab shows: TechnologyPanel, PoliticsPanel, OperationsPanel, NPCInfluencePanel
- [ ] EventLog sidebar is always visible on both tabs
- [ ] "Advance 10 Sols" button works
- [ ] "New Game" button works
- [ ] Events appear in sidebar after advancing sols
- [ ] Event modal still appears when events trigger
- [ ] Game over modal still works

**Step 3: Document any issues found**

If issues found, create additional tasks to fix them before merging.

---

## Summary

After completing all tasks:

1. Vue Router is installed and configured
2. App uses tabbed navigation with two routes
3. Header, TabNav, and EventLogSidebar are separate components
4. MainTab and StrategyTab contain the appropriate panels
5. All existing panel components work unchanged
6. Tests pass, lint clean
