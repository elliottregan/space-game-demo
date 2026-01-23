# Recreation Buildings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recreation buildings that boost colony morale by consuming power without producing resources.

**Architecture:** Extend `BuildingDefinition` with an optional `moraleBoost` field. `ColonyManager.tick()` will query the `BuildingManager` for total morale boost from active recreation buildings and apply it to the morale recovery calculation. No changes to `BuildingManager` itself - it already handles production/consumption.

**Tech Stack:** TypeScript, Vue 3, Bun test runner

**Reference:** Discussion #32, DEV-EVAL-32

---

## Task 1: Add moraleBoost to BuildingDefinition

**Files:**
- Modify: `src/core/models/Building.ts:6-19`

**Step 1: Add the moraleBoost field**

Add `moraleBoost?: number;` to the `BuildingDefinition` interface after `repurposeTargets`:

```typescript
export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  cost: ResourceDelta;
  constructionTime: number;
  production?: ResourceDelta;
  consumption?: ResourceDelta;
  workerSlots?: number;
  workerRole?: ColonistRole;
  requiredTech?: string;
  requiresDeposit?: boolean;
  repurposeTargets?: string[];
  moraleBoost?: number; // NEW: Passive morale boost when active
}
```

**Step 2: Verify no type errors**

Run: `bun run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/core/models/Building.ts
git commit -m "feat(buildings): add moraleBoost field to BuildingDefinition"
```

---

## Task 2: Add Recreation Buildings Data

**Files:**
- Modify: `src/core/data/buildings.ts:171` (end of file)

**Step 1: Add 4 recreation building definitions**

Add these after the `cryo_facility` definition:

```typescript
  // Recreation buildings (morale boost, no production)
  {
    id: "common_room",
    name: "Common Room",
    description: "A shared space for colonists to relax and socialize",
    cost: { materials: 60 },
    constructionTime: 10,
    consumption: { power: 3 },
    moraleBoost: 5,
  },
  {
    id: "gymnasium",
    name: "Gymnasium",
    description: "Exercise facility to maintain physical and mental health",
    cost: { materials: 80 },
    constructionTime: 12,
    consumption: { power: 4 },
    moraleBoost: 6,
  },
  {
    id: "hydroponic_garden",
    name: "Hydroponic Garden",
    description: "Decorative plants providing a calming environment",
    cost: { materials: 70 },
    constructionTime: 14,
    consumption: { power: 2, water: 1 },
    moraleBoost: 4,
  },
  {
    id: "observatory_dome",
    name: "Observatory Dome",
    description: "A dome for stargazing, reminding colonists why they came",
    cost: { materials: 150 },
    constructionTime: 20,
    consumption: { power: 5 },
    moraleBoost: 8,
    requiredTech: "advanced_materials",
  },
```

**Step 2: Verify no syntax errors**

Run: `bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/data/buildings.ts
git commit -m "feat(buildings): add 4 recreation buildings with morale boost"
```

---

## Task 3: Write Test for Morale Boost Calculation

**Files:**
- Create: `tests/RecreationBuildings.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { GameState } from "../src/core/GameState";

describe("Recreation Buildings", () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  it("should calculate total morale boost from active recreation buildings", () => {
    // Build a common room (moraleBoost: 5)
    gameState.buildings.startBuilding(
      "common_room",
      gameState.resources,
      gameState.technology
    );

    // Fast-forward construction (10 sols)
    for (let i = 0; i < 10; i++) {
      gameState.tick();
    }

    // Verify building is active
    const buildings = gameState.buildings.getActiveBuildings();
    const commonRoom = buildings.find((b) => b.definitionId === "common_room");
    expect(commonRoom).toBeDefined();
    expect(commonRoom?.status).toBe("active");

    // Get total morale boost
    const totalBoost = gameState.buildings.getTotalMoraleBoost();
    expect(totalBoost).toBe(5);
  });

  it("should not include morale boost from broken buildings", () => {
    // Build a common room
    gameState.buildings.startBuilding(
      "common_room",
      gameState.resources,
      gameState.technology
    );

    // Fast-forward construction
    for (let i = 0; i < 10; i++) {
      gameState.tick();
    }

    // Break the building
    const buildings = gameState.buildings.getActiveBuildings();
    const commonRoom = buildings.find((b) => b.definitionId === "common_room");
    gameState.buildings.breakBuilding(commonRoom!.id, gameState.resources);

    // Morale boost should be 0
    const totalBoost = gameState.buildings.getTotalMoraleBoost();
    expect(totalBoost).toBe(0);
  });

  it("should sum morale boost from multiple recreation buildings", () => {
    // Give enough materials
    gameState.resources.add({ materials: 500 });

    // Build common room (5) and gymnasium (6)
    gameState.buildings.startBuilding(
      "common_room",
      gameState.resources,
      gameState.technology
    );
    gameState.buildings.startBuilding(
      "gymnasium",
      gameState.resources,
      gameState.technology
    );

    // Fast-forward construction (12 sols for gymnasium)
    for (let i = 0; i < 12; i++) {
      gameState.tick();
    }

    const totalBoost = gameState.buildings.getTotalMoraleBoost();
    expect(totalBoost).toBe(11); // 5 + 6
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/RecreationBuildings.test.ts`
Expected: FAIL - `getTotalMoraleBoost is not a function`

**Step 3: Commit**

```bash
git add tests/RecreationBuildings.test.ts
git commit -m "test(buildings): add failing tests for recreation building morale boost"
```

---

## Task 4: Implement getTotalMoraleBoost in BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Add the method**

Add this method to `BuildingManager` class (after `getActiveBuildingCount`):

```typescript
  getTotalMoraleBoost(): number {
    let total = 0;
    for (const building of this.buildings.values()) {
      if (building.status !== "active" || building.broken) continue;
      const def = this.definitions.get(building.definitionId);
      if (def?.moraleBoost) {
        total += def.moraleBoost;
      }
    }
    return total;
  }
```

**Step 2: Run test to verify it passes**

Run: `bun test tests/RecreationBuildings.test.ts`
Expected: PASS (all 3 tests)

**Step 3: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "feat(buildings): implement getTotalMoraleBoost method"
```

---

## Task 5: Write Test for Morale Integration in ColonyManager

**Files:**
- Modify: `tests/RecreationBuildings.test.ts`

**Step 1: Add integration test**

Add this test to the existing describe block:

```typescript
  it("should apply morale boost during colony tick", () => {
    // Lower morale to see the effect
    gameState.colony.setMorale(50);

    // Build a common room
    gameState.buildings.startBuilding(
      "common_room",
      gameState.resources,
      gameState.technology
    );

    // Fast-forward construction
    for (let i = 0; i < 10; i++) {
      gameState.tick();
    }

    // Record morale before additional ticks
    const moraleBefore = gameState.colony.getMorale();

    // Tick a few times with positive resources to see morale boost
    gameState.resources.add({ food: 1000, oxygen: 1000, water: 1000 });
    for (let i = 0; i < 5; i++) {
      gameState.tick();
    }

    const moraleAfter = gameState.colony.getMorale();

    // Morale should have increased (base recovery + morale boost)
    expect(moraleAfter).toBeGreaterThan(moraleBefore);
  });
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/RecreationBuildings.test.ts`
Expected: May pass or fail depending on current morale recovery - this establishes baseline

**Step 3: Commit**

```bash
git add tests/RecreationBuildings.test.ts
git commit -m "test(colony): add test for morale boost integration"
```

---

## Task 6: Update ColonyManager.tick to Apply Morale Boost

**Files:**
- Modify: `src/core/systems/ColonyManager.ts:68-106`
- Modify: `src/core/GameState.ts:70`

**Step 1: Update ColonyManager.tick signature**

Change the `tick` method signature to accept `BuildingManager`:

```typescript
import type { BuildingManager } from "./BuildingManager";

// ... in class ColonyManager:

  tick(resources: ResourceManager, buildings?: BuildingManager): GameEvent[] {
```

**Step 2: Apply morale boost in the positive conditions block**

Update the morale recovery section (around line 103-106):

```typescript
    // Positive conditions improve morale
    if ((netFlow.food || 0) > 0 && (netFlow.oxygen || 0) > 0 && (netFlow.water || 0) > 0) {
      let moraleRecovery = 0.5;

      // Add morale boost from recreation buildings
      if (buildings) {
        moraleRecovery += buildings.getTotalMoraleBoost() * 0.1; // Scale boost
      }

      this.morale = Math.min(100, this.morale + moraleRecovery);
      this.health = Math.min(100, this.health + 0.2);
    }
```

**Step 3: Update GameState.tick to pass buildings**

In `src/core/GameState.ts`, update line 70:

```typescript
    // 4. Colony tick (population, health, morale)
    events.push(...this.colony.tick(this.resources, this.buildings));
```

**Step 4: Update initial tick in constructor**

In `src/core/GameState.ts`, update line 49:

```typescript
    // Initialize colonist consumption
    this.colony.tick(this.resources, this.buildings);
```

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/core/systems/ColonyManager.ts src/core/GameState.ts
git commit -m "feat(colony): integrate recreation building morale boost into tick"
```

---

## Task 7: Add Recreation Category to BuildingPanel

**Files:**
- Modify: `src/renderer/components/BuildingPanel/CategoryTabs.vue`
- Modify: `src/renderer/components/BuildingPanel/BuildingPanel.vue`

**Step 1: Update CategoryTabs to include Recreation**

Update the props and template in `CategoryTabs.vue`:

```typescript
defineProps<{
  selectedCategory: "all" | "available" | "built" | "recreation";
  activeCount: number;
}>();
```

Add button in template after "Built":

```vue
    <GButton
      :variant="selectedCategory === 'recreation' ? 'primary' : 'ghost'"
      size="sm"
      @click="emit('update:selectedCategory', 'recreation')"
    >
      Recreation
    </GButton>
```

**Step 2: Update BuildingPanel to filter recreation**

In `BuildingPanel.vue`, update the `selectedCategory` ref type:

```typescript
const selectedCategory = ref<"all" | "available" | "built" | "recreation">("available");
```

Update the `filteredBuildings` computed:

```typescript
const filteredBuildings = computed(() => {
  switch (selectedCategory.value) {
    case "available":
      return availableBuildings.value;
    case "built":
      return state.buildingDefinitions.filter(
        (def) =>
          state.buildings.some((b) => b.definitionId === def.id) ||
          state.pendingBuildings.some((b) => b.definitionId === def.id),
      );
    case "recreation":
      return availableBuildings.value.filter((def) => def.moraleBoost !== undefined);
    default:
      return state.buildingDefinitions;
  }
});
```

**Step 3: Verify UI works**

Run: `bun run dev`
Expected: Recreation tab shows only recreation buildings

**Step 4: Commit**

```bash
git add src/renderer/components/BuildingPanel/CategoryTabs.vue src/renderer/components/BuildingPanel/BuildingPanel.vue
git commit -m "feat(ui): add Recreation category filter to BuildingPanel"
```

---

## Task 8: Show Morale Boost in Building Tooltips

**Files:**
- Modify: `src/renderer/components/BuildingPanel/BuildingCard.vue`

**Step 1: Read BuildingCard.vue**

Read the file to understand the current tooltip structure.

**Step 2: Add morale boost display**

In the template where cost/production/consumption are displayed, add morale boost:

```vue
<div v-if="definition.moraleBoost" class="stat morale-boost">
  <span class="label">Morale Boost:</span>
  <span class="value positive">+{{ definition.moraleBoost }}</span>
</div>
```

**Step 3: Add styling**

```css
.morale-boost .value.positive {
  color: var(--color-positive);
}
```

**Step 4: Verify UI**

Run: `bun run dev`
Expected: Recreation buildings show morale boost in card

**Step 5: Commit**

```bash
git add src/renderer/components/BuildingPanel/BuildingCard.vue
git commit -m "feat(ui): display morale boost in building cards"
```

---

## Task 9: Display Total Morale Bonus in ColonyPanel

**Files:**
- Modify: `src/renderer/components/ColonyPanel/ColonyPanel.vue`
- Modify: `src/renderer/services/GameService.ts` (if needed for reactive state)

**Step 1: Check if moraleBoost is exposed in GameService**

Read `src/renderer/services/GameService.ts` to see if we need to add it.

**Step 2: Add total morale boost to reactive state or compute directly**

If needed, add to GameUIState:

```typescript
moraleBoost: number;
```

And sync in `syncState`:

```typescript
this.state.moraleBoost = this.game.buildings.getTotalMoraleBoost();
```

**Step 3: Update ColonyPanel to display morale boost**

Add after the Morale StatRow:

```vue
<StatRow
  v-if="state.moraleBoost > 0"
  label="Morale Bonus"
  :value="`+${state.moraleBoost}`"
  variant="positive"
/>
```

Or as a subtitle under morale:

```vue
<StatRow
  label="Morale"
  :progress="state.morale"
  :variant="getMoraleVariant(state.morale)"
  show-progress-label
  :subtitle="state.moraleBoost > 0 ? `+${state.moraleBoost} from recreation` : undefined"
/>
```

**Step 4: Verify UI**

Run: `bun run dev`
Expected: ColonyPanel shows morale bonus when recreation buildings are active

**Step 5: Commit**

```bash
git add src/renderer/components/ColonyPanel/ColonyPanel.vue src/renderer/services/GameService.ts
git commit -m "feat(ui): display total morale bonus in ColonyPanel"
```

---

## Task 10: Run Full Test Suite and Lint

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors (warnings OK)

**Step 3: Run build**

Run: `bun run build`
Expected: No errors

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix lint issues"
```

---

## Summary

| Task | Files Modified | Type |
|------|----------------|------|
| 1 | `Building.ts` | Data model |
| 2 | `buildings.ts` | Static data |
| 3 | `RecreationBuildings.test.ts` | Test |
| 4 | `BuildingManager.ts` | Core logic |
| 5 | `RecreationBuildings.test.ts` | Test |
| 6 | `ColonyManager.ts`, `GameState.ts` | Core logic |
| 7 | `CategoryTabs.vue`, `BuildingPanel.vue` | UI |
| 8 | `BuildingCard.vue` | UI |
| 9 | `ColonyPanel.vue`, `GameService.ts` | UI |
| 10 | N/A | Verification |

**Estimated effort:** 2-3 hours
**Complexity:** S-M
