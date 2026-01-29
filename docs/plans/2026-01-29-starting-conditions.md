# Starting Conditions Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow players to select starting conditions when starting a new game, with presets including the current default (14 colonists, no buildings) and an "established base" option with pre-built infrastructure.

**Architecture:** Add a `StartingCondition` model and preset definitions in core. Modify `GameState` constructor to accept optional starting conditions. Create a modal UI for selection when clicking "New Game". Thread the selection through GameAPI → GameFlowFacade → GameService.

**Tech Stack:** TypeScript, Vue 3, existing facade pattern

---

## Task 1: Create StartingCondition Model and Presets

**Files:**
- Create: `src/core/models/StartingCondition.ts`
- Create: `src/core/data/startingConditions.ts`

**Step 1: Write the failing test**

Create test file `tests/StartingCondition.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { STARTING_CONDITIONS, StartingConditionId } from "../src/core/data/startingConditions";
import { BuildingId } from "../src/core/models/Building";

describe("StartingConditions", () => {
  it("should have a default condition with no pre-built buildings", () => {
    const defaultCondition = STARTING_CONDITIONS.find(
      (c) => c.id === StartingConditionId.DEFAULT
    );
    expect(defaultCondition).toBeDefined();
    expect(defaultCondition!.preBuiltBuildings).toEqual([]);
    expect(defaultCondition!.population).toBe(14);
  });

  it("should have an established base condition with pre-built buildings", () => {
    const established = STARTING_CONDITIONS.find(
      (c) => c.id === StartingConditionId.ESTABLISHED_BASE
    );
    expect(established).toBeDefined();
    expect(established!.preBuiltBuildings).toContain(BuildingId.HABITAT);
    expect(established!.preBuiltBuildings).toContain(BuildingId.SOLAR_PANEL);
    expect(established!.preBuiltBuildings).toContain(BuildingId.BASIC_FARM);
    expect(established!.preBuiltBuildings).toContain(BuildingId.OXYGEN_GENERATOR);
  });

  it("should have unique IDs for all conditions", () => {
    const ids = STARTING_CONDITIONS.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/StartingCondition.test.ts`
Expected: FAIL with module not found error

**Step 3: Create the StartingCondition model**

Create `src/core/models/StartingCondition.ts`:

```typescript
import type { BuildingId } from "./Building";
import type { Resources } from "./Resources";

export interface StartingCondition {
  id: string;
  name: string;
  description: string;
  population: number;
  resources: Resources;
  preBuiltBuildings: BuildingId[];
}
```

**Step 4: Create the starting conditions data**

Create `src/core/data/startingConditions.ts`:

```typescript
import { STARTING_POPULATION, STARTING_RESOURCES } from "../balance/EconomyBaseline";
import { BuildingId } from "../models/Building";
import type { StartingCondition } from "../models/StartingCondition";

export enum StartingConditionId {
  DEFAULT = "default",
  ESTABLISHED_BASE = "established_base",
}

export const STARTING_CONDITIONS: StartingCondition[] = [
  {
    id: StartingConditionId.DEFAULT,
    name: "Fresh Start",
    description: "14 colonists with basic supplies. No infrastructure.",
    population: STARTING_POPULATION,
    resources: STARTING_RESOURCES,
    preBuiltBuildings: [],
  },
  {
    id: StartingConditionId.ESTABLISHED_BASE,
    name: "Established Base",
    description: "A small outpost with basic infrastructure already in place.",
    population: STARTING_POPULATION,
    resources: STARTING_RESOURCES,
    preBuiltBuildings: [
      BuildingId.HABITAT,
      BuildingId.HABITAT,
      BuildingId.SOLAR_PANEL,
      BuildingId.BASIC_FARM,
      BuildingId.BASIC_FARM,
      BuildingId.OXYGEN_GENERATOR,
      BuildingId.OXYGEN_GENERATOR,
    ],
  },
];

export function getStartingCondition(id: string): StartingCondition | undefined {
  return STARTING_CONDITIONS.find((c) => c.id === id);
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/StartingCondition.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add tests/StartingCondition.test.ts src/core/models/StartingCondition.ts src/core/data/startingConditions.ts
git commit -m "feat: add StartingCondition model and presets"
```

---

## Task 2: Modify GameState to Accept Starting Conditions

**Files:**
- Modify: `src/core/GameState.ts`
- Modify: `tests/StartingCondition.test.ts`

**Step 1: Write the failing test**

Add to `tests/StartingCondition.test.ts`:

```typescript
import { GameState } from "../src/core/GameState";
import { StartingConditionId } from "../src/core/data/startingConditions";

describe("GameState with StartingConditions", () => {
  it("should create default state when no condition specified", () => {
    const state = new GameState();
    expect(state.colony.getPopulation()).toBe(14);
    expect(state.buildings.getBuildingCount()).toBe(0);
  });

  it("should create state with pre-built buildings for established base", () => {
    const state = new GameState(StartingConditionId.ESTABLISHED_BASE);
    expect(state.colony.getPopulation()).toBe(14);
    // 2 habitats + 1 solar + 2 farms + 2 oxygen generators = 7 buildings
    expect(state.buildings.getBuildingCount()).toBe(7);
    expect(state.buildings.getActiveBuildings().length).toBe(7);
  });

  it("should register production/consumption for pre-built buildings", () => {
    const state = new GameState(StartingConditionId.ESTABLISHED_BASE);
    const production = state.resources.getProduction();
    const consumption = state.resources.getConsumption();

    // Solar panel produces power
    expect(production.power).toBeGreaterThan(0);
    // Farms consume water and power
    expect(consumption.water).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/StartingCondition.test.ts`
Expected: FAIL - GameState constructor doesn't accept arguments

**Step 3: Modify GameState constructor**

Update `src/core/GameState.ts`:

1. Add import at top:
```typescript
import { getStartingCondition, StartingConditionId } from "./data/startingConditions";
```

2. Modify constructor to accept optional starting condition:
```typescript
constructor(startingConditionId?: string) {
  const condition = startingConditionId
    ? getStartingCondition(startingConditionId)
    : getStartingCondition(StartingConditionId.DEFAULT);

  if (!condition) {
    throw new Error(`Unknown starting condition: ${startingConditionId}`);
  }

  this.resources = new ResourceManager(condition.resources);
  this.technology = new TechnologyTree(TECHNOLOGIES);
  this.buildings = new BuildingManager(BUILDINGS);
  this.colony = new ColonyManager(condition.population);
  this.buildings.setColonyManager(this.colony);
  this.buildings.setTechnologyTree(this.technology);
  this.workforce = new WorkforceManager();
  this.buildings.setWorkforceManager(this.workforce);
  this.events = new EventManager(RANDOM_EVENTS);
  this.victory = new VictoryManager();
  this.operations = new OperationsManager();
  this.npcInfluence = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

  // Create pre-built buildings
  this.createPreBuiltBuildings(condition.preBuiltBuildings);

  // Initialize colonist consumption
  this.colony.tick(this.resources, this.buildings, { morale: 0, health: 0 });
}
```

3. Add helper method after constructor:
```typescript
private createPreBuiltBuildings(buildingIds: BuildingId[]): void {
  for (const defId of buildingIds) {
    const def = this.buildings.getDefinition(defId);
    if (!def) continue;

    // Create building directly as active (skip construction)
    const building: Building = {
      id: `building_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      definitionId: defId,
      status: "active",
      constructionProgress: def.constructionTime,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
      condition: 100,
      age: 0,
      lastMaintenance: 0,
    };

    // Add to buildings manager (need to expose method)
    this.buildings.addBuilding(building);

    // Register production/consumption
    if (def.production) {
      this.resources.addProduction(def.production);
    }
    if (def.consumption) {
      this.resources.addConsumption(def.consumption);
    }
  }
}
```

4. Add import for Building type:
```typescript
import type { Building } from "./models/Building";
import { BuildingId } from "./models/Building";
```

**Step 4: Add addBuilding method to BuildingManager**

Update `src/core/systems/BuildingManager.ts` - add after `startBuilding` method:

```typescript
/**
 * Add a pre-built building directly (used for starting conditions).
 * Does not deduct costs or go through construction.
 */
addBuilding(building: Building): void {
  this.buildings.set(building.id, building);
  // Update nextId if needed to avoid collisions
  const numericId = parseInt(building.id.split("_")[1], 10);
  if (!isNaN(numericId) && numericId >= this.nextId) {
    this.nextId = numericId + 1;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/StartingCondition.test.ts`
Expected: PASS

**Step 6: Run all tests to ensure no regressions**

Run: `bun test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/core/GameState.ts src/core/systems/BuildingManager.ts tests/StartingCondition.test.ts
git commit -m "feat: GameState accepts starting condition for pre-built buildings"
```

---

## Task 3: Thread Starting Condition Through Facade Layer

**Files:**
- Modify: `src/facade/domains/GameFlowFacade.ts`
- Modify: `src/facade/GameAPI.ts`

**Step 1: Write the failing test**

Add to `tests/StartingCondition.test.ts`:

```typescript
import { GameAPI } from "../src/facade/GameAPI";

describe("GameAPI with StartingConditions", () => {
  it("should start new game with default condition", () => {
    const api = new GameAPI();
    api.newGame();
    expect(api.colony.population()).toBe(14);
    expect(api.buildings.all().length).toBe(0);
  });

  it("should start new game with specified condition", () => {
    const api = new GameAPI();
    api.newGame(StartingConditionId.ESTABLISHED_BASE);
    expect(api.colony.population()).toBe(14);
    expect(api.buildings.all().length).toBe(7);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/StartingCondition.test.ts`
Expected: FAIL - newGame doesn't accept arguments

**Step 3: Update GameFlowFacade**

Modify `src/facade/domains/GameFlowFacade.ts`:

1. Update type definition:
```typescript
type ResetGameState = (startingConditionId?: string) => void;
```

2. Update newGame method:
```typescript
/**
 * Start a new game, resetting all state.
 * @param startingConditionId - Optional starting condition ID
 */
newGame(startingConditionId?: string): void {
  this.resetGameState(startingConditionId);
}
```

**Step 4: Update GameAPI**

Modify `src/facade/GameAPI.ts`:

1. Update resetGameState method:
```typescript
/**
 * Reset game state for new game.
 */
private resetGameState = (startingConditionId?: string): void => {
  this.gameState = new GameState(startingConditionId);
  this.lastEvents = [];
  this.initializeFacades();
  this.notifyStateChange();
};
```

2. Update newGame method:
```typescript
/**
 * Start a new game.
 * @param startingConditionId - Optional starting condition ID
 */
newGame(startingConditionId?: string): void {
  this.resetGameState(startingConditionId);
}
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/StartingCondition.test.ts`
Expected: PASS

**Step 6: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/facade/domains/GameFlowFacade.ts src/facade/GameAPI.ts tests/StartingCondition.test.ts
git commit -m "feat: thread starting condition through facade layer"
```

---

## Task 4: Add Starting Conditions Query to Facade

**Files:**
- Modify: `src/facade/domains/GameFlowFacade.ts`
- Modify: `src/facade/index.ts`

**Step 1: Write the failing test**

Add to `tests/StartingCondition.test.ts`:

```typescript
describe("GameAPI Starting Conditions Query", () => {
  it("should return all available starting conditions", () => {
    const api = new GameAPI();
    const conditions = api.game.getStartingConditions();
    expect(conditions.length).toBeGreaterThanOrEqual(2);
    expect(conditions.find((c) => c.id === StartingConditionId.DEFAULT)).toBeDefined();
    expect(conditions.find((c) => c.id === StartingConditionId.ESTABLISHED_BASE)).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/StartingCondition.test.ts`
Expected: FAIL - getStartingConditions method doesn't exist

**Step 3: Add query method to GameFlowFacade**

Update `src/facade/domains/GameFlowFacade.ts`:

1. Add import:
```typescript
import { STARTING_CONDITIONS } from "../../core/data/startingConditions";
import type { StartingCondition } from "../../core/models/StartingCondition";
```

2. Add method in Queries section:
```typescript
/**
 * Get all available starting conditions.
 */
getStartingConditions(): readonly StartingCondition[] {
  return STARTING_CONDITIONS;
}
```

**Step 4: Export types from facade index**

Update `src/facade/index.ts` to export the new types:

```typescript
export type { StartingCondition } from "../core/models/StartingCondition";
export { StartingConditionId, STARTING_CONDITIONS } from "../core/data/startingConditions";
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/StartingCondition.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/facade/domains/GameFlowFacade.ts src/facade/index.ts tests/StartingCondition.test.ts
git commit -m "feat: add starting conditions query to facade"
```

---

## Task 5: Update GameService for Starting Conditions

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Update newGame method in GameService**

Modify `src/renderer/services/GameService.ts`:

1. Add import at top (if not already importing from facade):
```typescript
import { StartingConditionId } from "../../facade";
```

2. Update newGame method:
```typescript
// Game management
newGame(startingConditionId?: string): void {
  this.facade.newGame(startingConditionId);
  this.state.recentEvents = [];
}
```

3. Add method to get starting conditions:
```typescript
getStartingConditions() {
  return this.facade.game.getStartingConditions();
}
```

**Step 2: Verify no TypeScript errors**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat: update GameService to support starting conditions"
```

---

## Task 6: Create NewGameModal Component

**Files:**
- Create: `src/renderer/components/NewGameModal.vue`

**Step 1: Create the modal component**

Create `src/renderer/components/NewGameModal.vue`:

```vue
<script setup lang="ts">
import { ref } from "vue";
import type { StartingCondition } from "../../facade";
import { gameService } from "../services/GameService";
import { GButton } from "../ui";

const emit = defineEmits<{
  close: [];
}>();

const conditions = gameService.getStartingConditions();
const selectedId = ref(conditions[0]?.id ?? "default");

function startGame() {
  gameService.newGame(selectedId.value);
  emit("close");
}

function cancel() {
  emit("close");
}

function selectCondition(condition: StartingCondition) {
  selectedId.value = condition.id;
}
</script>

<template>
  <div class="modal-overlay" @click.self="cancel">
    <div class="modal">
      <h2>New Game</h2>
      <p class="subtitle">Select starting conditions</p>

      <div class="conditions-list">
        <button
          v-for="condition in conditions"
          :key="condition.id"
          class="condition-card"
          :class="{ selected: selectedId === condition.id }"
          @click="selectCondition(condition)"
        >
          <h3>{{ condition.name }}</h3>
          <p>{{ condition.description }}</p>
          <div class="details">
            <span class="detail">
              <span class="label">Population:</span>
              {{ condition.population }}
            </span>
            <span class="detail">
              <span class="label">Buildings:</span>
              {{ condition.preBuiltBuildings.length }}
            </span>
          </div>
        </button>
      </div>

      <div class="actions">
        <GButton variant="secondary" @click="cancel">Cancel</GButton>
        <GButton variant="primary" @click="startGame">Start Game</GButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.modal {
  background: var(--g-color-bg-base);
  border: 2px solid var(--g-accent-slate);
  padding: var(--g-space-xl);
  max-width: 500px;
  width: 90%;
}

h2 {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xl);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-xs);
}

.subtitle {
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  margin-bottom: var(--g-space-lg);
}

.conditions-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
  margin-bottom: var(--g-space-xl);
}

.condition-card {
  background: var(--g-color-bg-surface);
  border: 2px solid var(--g-color-border);
  padding: var(--g-space-md);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.condition-card:hover {
  border-color: var(--g-accent-slate);
}

.condition-card.selected {
  border-color: var(--g-accent-red);
  background: var(--g-color-bg-elevated);
}

.condition-card h3 {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  color: var(--g-color-text);
  margin-bottom: var(--g-space-xs);
}

.condition-card p {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.details {
  display: flex;
  gap: var(--g-space-md);
}

.detail {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text);
}

.detail .label {
  color: var(--g-color-text-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--g-space-sm);
}
</style>
```

**Step 2: Verify no TypeScript errors**

Run: `bun run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/renderer/components/NewGameModal.vue
git commit -m "feat: create NewGameModal component for starting condition selection"
```

---

## Task 7: Integrate NewGameModal into GameHeader

**Files:**
- Modify: `src/renderer/components/GameHeader.vue`

**Step 1: Update GameHeader to show modal**

Modify `src/renderer/components/GameHeader.vue`:

1. Add import:
```typescript
import { ref } from "vue";
import NewGameModal from "./NewGameModal.vue";
```

2. Add state for modal visibility:
```typescript
const showNewGameModal = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function openNewGameModal() {
  showNewGameModal.value = true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function closeNewGameModal() {
  showNewGameModal.value = false;
}
```

3. Remove the old newGame function (replace with openNewGameModal)

4. Update template - change New Game button:
```vue
<GButton variant="secondary" @click="openNewGameModal">New Game</GButton>
```

5. Add modal at end of template (before closing </template>):
```vue
<NewGameModal v-if="showNewGameModal" @close="closeNewGameModal" />
```

**Step 2: Run dev server and manually test**

Run: `bun run dev`
- Click "New Game" button
- Modal should appear with two options
- Select "Established Base" and click "Start Game"
- Verify buildings panel shows 7 buildings

**Step 3: Commit**

```bash
git add src/renderer/components/GameHeader.vue
git commit -m "feat: integrate NewGameModal into GameHeader"
```

---

## Task 8: Run Full Test Suite and Fix Any Issues

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 3: Run format check**

Run: `bun run format:check`
If needed: `bun run format`

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix lint/format issues"
```

---

## Task 9: Update Simulation to Use Starting Conditions (Optional Enhancement)

**Files:**
- Modify: `src/simulation/SimulationRunner.ts`

This task is optional - only if the simulation system needs to test different starting conditions.

**Step 1: Check if SimulationRunner creates GameState directly**

If it does, update it to accept an optional starting condition parameter.

**Step 2: Commit if changes made**

```bash
git add src/simulation/SimulationRunner.ts
git commit -m "feat: simulation supports starting conditions"
```

---

## Summary

After completing all tasks, the feature will:

1. Define a `StartingCondition` model with presets (Default, Established Base)
2. Allow `GameState` to initialize with pre-built active buildings
3. Thread the selection through GameAPI → GameFlowFacade → GameService
4. Show a modal when clicking "New Game" to select starting conditions
5. Maintain full backward compatibility (default condition matches current behavior)
