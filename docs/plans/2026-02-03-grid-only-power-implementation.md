# Grid-Only Power System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the global power strain metric and make the spatial GridManager the sole power system.

**Architecture:** Delete PowerGridManager and its associated tick phase. Modify BuildingManager to gate production/consumption on power state from GridManager instead of applying a global efficiency multiplier. Update UI to remove PowerGridPanel and enhance BaseGrid with power coverage visualization.

**Tech Stack:** TypeScript, Vue 3, Bun test runner

---

## Task 1: Add power state gate to BuildingManager

Make unpowered buildings produce/consume nothing by checking power state before calculating production.

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Add GridManager dependency**

Add a GridManager reference to BuildingManager so it can check power states.

```typescript
// After line 36 (private ideologyManager...)
private gridManager: GridManager | null = null;

// Add setter method after setVictoryManager
setGridManager(grid: GridManager): void {
  this.gridManager = grid;
}
```

**Step 2: Modify getEffectiveProduction to check power state**

```typescript
// Replace getEffectiveProduction method (around line 654)
getEffectiveProduction(buildingId: string): ResourceDelta {
  const result = this.getBuildingWithDef(buildingId);
  if (!result || result.building.status !== "active" || result.building.broken) return {};
  if (!result.def.production) return {};

  // Gate on power state - unpowered buildings produce nothing
  if (this.gridManager) {
    const powerState = this.gridManager.getPowerState(buildingId);
    if (powerState === PowerState.UNPOWERED) {
      return {};
    }
  }

  const modeMultiplier = BUILDING_MODES[result.building.mode].production;
  const efficiencyMultiplier = this.getBuildingEfficiencyMultiplier(buildingId);
  return applyMultiplier(result.def.production, modeMultiplier * efficiencyMultiplier);
}
```

**Step 3: Modify getEffectiveConsumption similarly**

```typescript
// Replace getEffectiveConsumption method (around line 664)
getEffectiveConsumption(buildingId: string): ResourceDelta {
  const result = this.getBuildingWithDef(buildingId);
  if (!result || result.building.status !== "active" || result.building.broken) return {};
  if (!result.def.consumption) return {};

  // Gate on power state - unpowered buildings consume nothing
  if (this.gridManager) {
    const powerState = this.gridManager.getPowerState(buildingId);
    if (powerState === PowerState.UNPOWERED) {
      return {};
    }
  }

  const modeMultiplier = BUILDING_MODES[result.building.mode].consumption;
  const efficiencyMultiplier = this.getBuildingEfficiencyMultiplier(buildingId);
  return applyMultiplier(result.def.consumption, modeMultiplier * efficiencyMultiplier);
}
```

**Step 4: Add PowerState import**

```typescript
// Add to imports at top of file
import { PowerState } from "../models/Grid";
```

**Step 5: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test tests/BuildingManager.test.ts
```

**Step 6: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "feat(power): gate building production on power state

Buildings in UNPOWERED state now produce and consume nothing.
This is part of removing the global power metric."
```

---

## Task 2: Remove powerGridEfficiency from BuildingManager

Remove the global power efficiency multiplier since power is now binary.

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Remove powerGridEfficiency field and setter**

Delete these lines:
```typescript
// Delete around line 39
private powerGridEfficiency: number = 1;

// Delete around line 57-59
setPowerGridEfficiency(multiplier: number): void {
  this.powerGridEfficiency = Math.max(0, Math.min(1, multiplier));
}
```

**Step 2: Remove from getBuildingEfficiencyMultiplier**

```typescript
// Replace getBuildingEfficiencyMultiplier (around line 626)
private getBuildingEfficiencyMultiplier(buildingId: string): number {
  const building = this.buildings.get(buildingId);
  if (!building) return 0;

  return combineMultipliers(
    this.airQualityEfficiency,
    this.getStaffingEfficiency(buildingId),
    this.getWorkerEfficiency(buildingId),
    this.getTeamCohesionMultiplier(buildingId),
  );
}
```

**Step 3: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test tests/BuildingManager.test.ts
```

**Step 4: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "refactor(power): remove powerGridEfficiency multiplier

Power is now binary (on/off) via power state gate, not a gradual
efficiency penalty."
```

---

## Task 3: Wire GridManager to BuildingManager in GameState

Connect the GridManager to BuildingManager so power state checks work.

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Add setGridManager call in constructor**

```typescript
// After line 88 (this.buildings.setVictoryManager(this.victory);)
this.buildings.setGridManager(this.grid);
```

**Step 2: Add setGridManager call in fromJSON**

```typescript
// After line 432 (state.buildings.setVictoryManager(state.victory);)
state.buildings.setGridManager(state.grid);
```

**Step 3: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test
```

**Step 4: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat(power): wire GridManager to BuildingManager

Allows BuildingManager to check power state when calculating
production/consumption."
```

---

## Task 4: Delete PowerGridManager and related files

Remove the global power grid system entirely.

**Files:**
- Delete: `src/core/systems/PowerGridManager.ts`
- Delete: `src/core/balance/PowerGridBalance.ts`
- Delete: `src/core/tick/phases/powerGrid.ts`

**Step 1: Delete the files**

```bash
cd /workspace/.worktrees/grid-only-power
rm src/core/systems/PowerGridManager.ts
rm src/core/balance/PowerGridBalance.ts
rm src/core/tick/phases/powerGrid.ts
```

**Step 2: Commit deletions**

```bash
git add -A
git commit -m "chore(power): delete PowerGridManager and related files

- Removed PowerGridManager.ts
- Removed PowerGridBalance.ts
- Removed powerGrid tick phase

These are replaced by the grid-based power system."
```

---

## Task 5: Remove PowerGridManager from GameState

Update GameState to not reference the deleted PowerGridManager.

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Remove import**

```typescript
// Delete this line (around line 18)
import { PowerGridManager } from "./systems/PowerGridManager";
```

**Step 2: Remove property declaration**

```typescript
// Delete this line (around line 39)
powerGrid: PowerGridManager;
```

**Step 3: Remove instantiation in constructor**

```typescript
// Delete this line (around line 82)
this.powerGrid = new PowerGridManager();
```

**Step 4: Remove from toJSON**

```typescript
// Delete this line from toJSON (around line 382)
powerGrid: this.powerGrid.toJSON(),
```

**Step 5: Remove from fromJSON**

```typescript
// Delete these lines from fromJSON (around line 415-417)
if (data.powerGrid) {
  state.powerGrid = PowerGridManager.fromJSON(data.powerGrid);
}
```

**Step 6: Remove from tick context creation**

In the `tick()` method, remove `powerGridManager: this.powerGrid` from the context object (around line 318).

**Step 7: Run tests to see what breaks**

```bash
cd /workspace/.worktrees/grid-only-power && bun test 2>&1 | head -50
```

**Step 8: Commit**

```bash
git add src/core/GameState.ts
git commit -m "refactor(power): remove PowerGridManager from GameState"
```

---

## Task 6: Remove PowerGridManager from TickContext

Update the tick context to not require PowerGridManager.

**Files:**
- Modify: `src/core/tick/TickContext.ts`

**Step 1: Remove import**

```typescript
// Delete this line (around line 10)
import type { PowerGridManager } from "../systems/PowerGridManager";
```

**Step 2: Remove from DerivedValues**

```typescript
// Delete these lines from DerivedValues interface (around line 34-35)
powerGrid: number;
powerGridEffects: { efficiency: number } | null;
```

**Step 3: Remove from TickContext interface**

```typescript
// Delete this line (around line 65)
powerGridManager: PowerGridManager;
```

**Step 4: Remove from createTickContext managers parameter**

```typescript
// Delete from the managers type (around line 94)
powerGridManager: PowerGridManager;
```

**Step 5: Remove from createTickContext derived initialization**

```typescript
// Delete these lines (around line 108-109)
powerGrid: 1,
powerGridEffects: null,
```

**Step 6: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test 2>&1 | head -50
```

**Step 7: Commit**

```bash
git add src/core/tick/TickContext.ts
git commit -m "refactor(power): remove PowerGridManager from TickContext"
```

---

## Task 7: Remove calculatePowerGrid from tick phases

Update the tick runner to not register the deleted power grid phase.

**Files:**
- Modify: `src/core/tick/phases/index.ts`

**Step 1: Remove import**

```typescript
// Delete this line (around line 6)
import { calculatePowerGrid } from "./powerGrid";
```

**Step 2: Remove export**

```typescript
// Delete this line (around line 44)
export { calculatePowerGrid } from "./powerGrid";
```

**Step 3: Remove from createStandardTickRunner**

```typescript
// Delete this line (around line 89)
runner.register(calculatePowerGrid);
```

**Step 4: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test 2>&1 | head -50
```

**Step 5: Commit**

```bash
git add src/core/tick/phases/index.ts
git commit -m "refactor(power): remove calculatePowerGrid tick phase"
```

---

## Task 8: Update PowerGridFacade for grid-only queries

Replace PowerGridFacade to provide grid-based power statistics instead of global strain.

**Files:**
- Modify: `src/facade/domains/PowerGridFacade.ts`
- Modify: `src/facade/types/powerGrid.ts`

**Step 1: Update PowerGridSnapshot type**

```typescript
// Replace contents of src/facade/types/powerGrid.ts
export interface PowerGridSnapshot {
  /** Total power being produced by all active power sources */
  readonly totalProduction: number;
  /** Total power being consumed by all powered buildings */
  readonly totalConsumption: number;
  /** Count of buildings in each power state */
  readonly buildingCounts: {
    readonly powered: number;
    readonly onBattery: number;
    readonly lowBattery: number;
    readonly unpowered: number;
  };
}
```

**Step 2: Update PowerGridFacade**

```typescript
// Replace contents of src/facade/domains/PowerGridFacade.ts
import type { GameState } from "../../core/GameState";
import { PowerState } from "../../core/models/Grid";
import type { Queryable } from "../types/interfaces";
import type { PowerGridSnapshot } from "../types/powerGrid";

/**
 * Facade for power grid queries.
 * Provides statistics about the grid-based power system.
 */
export class PowerGridFacade implements Queryable<PowerGridSnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get power grid statistics snapshot.
   */
  snapshot(): PowerGridSnapshot {
    const production = this.gameState.buildings.getTotalPowerProduction();
    const consumption = this.gameState.buildings.getTotalPowerConsumption();

    // Count buildings by power state
    const counts = { powered: 0, onBattery: 0, lowBattery: 0, unpowered: 0 };

    for (const building of this.gameState.buildings.getActiveBuildings()) {
      const state = this.gameState.grid.getPowerState(building.id);
      switch (state) {
        case PowerState.POWERED:
          counts.powered++;
          break;
        case PowerState.ON_BATTERY:
          counts.onBattery++;
          break;
        case PowerState.LOW_BATTERY:
          counts.lowBattery++;
          break;
        case PowerState.UNPOWERED:
          counts.unpowered++;
          break;
      }
    }

    return {
      totalProduction: production,
      totalConsumption: consumption,
      buildingCounts: counts,
    };
  }
}
```

**Step 3: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test
```

**Step 4: Commit**

```bash
git add src/facade/domains/PowerGridFacade.ts src/facade/types/powerGrid.ts
git commit -m "refactor(power): update PowerGridFacade for grid-only system

Now provides building counts by power state instead of global strain."
```

---

## Task 9: Update GameService UI state

Remove global power metrics from GameUIState and add grid-based power summary.

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Update GameUIState interface**

Replace power grid fields (around lines 97-102):

```typescript
// Replace these lines:
//   powerGrid: number;
//   powerGridProduction: number;
//   powerGridConsumption: number;
//   powerGridEfficiency: number;
//   powerGridIsComfortable: boolean;
//   powerGridIsCritical: boolean;
// With:
powerStats: {
  totalProduction: number;
  totalConsumption: number;
  poweredCount: number;
  onBatteryCount: number;
  lowBatteryCount: number;
  unpoweredCount: number;
};
```

**Step 2: Update createInitialState**

Replace power grid initialization (around lines 235-240):

```typescript
// Replace these lines with:
powerStats: {
  totalProduction: 0,
  totalConsumption: 0,
  poweredCount: 0,
  onBatteryCount: 0,
  lowBatteryCount: 0,
  unpoweredCount: 0,
},
```

**Step 3: Update syncState**

Replace power grid sync (around lines 353-360):

```typescript
// Replace the Power Grid section with:
// Power Stats
const powerData = this.facade.powerGrid.snapshot();
this.state.powerStats = {
  totalProduction: powerData.totalProduction,
  totalConsumption: powerData.totalConsumption,
  poweredCount: powerData.buildingCounts.powered,
  onBatteryCount: powerData.buildingCounts.onBattery,
  lowBatteryCount: powerData.buildingCounts.lowBattery,
  unpoweredCount: powerData.buildingCounts.unpowered,
};
```

**Step 4: Run tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test
```

**Step 5: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "refactor(power): update GameService for grid-only power

Replaces global strain metrics with building power state counts."
```

---

## Task 10: Delete PowerGridPanel component

Remove the panel that showed global power strain.

**Files:**
- Delete: `src/renderer/components/PowerGridPanel/PowerGridPanel.vue`
- Delete: `src/renderer/components/PowerGridPanel/index.ts`

**Step 1: Delete the files**

```bash
cd /workspace/.worktrees/grid-only-power
rm -rf src/renderer/components/PowerGridPanel
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore(ui): delete PowerGridPanel component

Replaced by grid-based power visualization in BaseGrid."
```

---

## Task 11: Remove PowerGridPanel from MainTab

Update MainTab to not import the deleted component.

**Files:**
- Modify: `src/renderer/components/MainTab.vue`

**Step 1: Remove import**

```typescript
// Delete this line (line 7)
import { PowerGridPanel } from "./PowerGridPanel";
```

**Step 2: Remove from template**

```vue
<!-- Delete this line (around line 16) -->
<PowerGridPanel />
```

**Step 3: Run dev server to verify**

```bash
cd /workspace/.worktrees/grid-only-power && bun run build
```

**Step 4: Commit**

```bash
git add src/renderer/components/MainTab.vue
git commit -m "refactor(ui): remove PowerGridPanel from MainTab"
```

---

## Task 12: Add power summary to BaseTab header

Show power building counts in the BaseTab header.

**Files:**
- Modify: `src/renderer/components/BaseTab.vue`

**Step 1: Add power stats computed**

```typescript
// Add after gridDeposits computed (around line 110)
const powerStats = computed(() => state.value.powerStats);
```

**Step 2: Update template header**

```vue
<!-- Replace the power-summary div (around line 250-252) -->
<div class="power-summary">
  <span class="power-stat powered">{{ powerStats.poweredCount }} powered</span>
  <span v-if="powerStats.onBatteryCount > 0" class="power-stat battery">
    {{ powerStats.onBatteryCount }} on battery
  </span>
  <span v-if="powerStats.unpoweredCount > 0" class="power-stat unpowered">
    {{ powerStats.unpoweredCount }} unpowered
  </span>
</div>
```

**Step 3: Add styles**

```css
/* Add to <style scoped> section */
.power-stat {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.power-stat.powered {
  color: var(--g-color-positive);
}

.power-stat.battery {
  color: var(--g-color-warning);
}

.power-stat.unpowered {
  color: var(--g-color-negative);
}

.power-summary {
  display: flex;
  gap: var(--g-space-md);
}
```

**Step 4: Run build**

```bash
cd /workspace/.worktrees/grid-only-power && bun run build
```

**Step 5: Commit**

```bash
git add src/renderer/components/BaseTab.vue
git commit -m "feat(ui): add power stats summary to BaseTab header

Shows count of powered/on-battery/unpowered buildings."
```

---

## Task 13: Fix simulation runner references

Update simulation code that references the old power grid.

**Files:**
- Modify: `src/simulation/SimulationRunner.ts`
- Modify: `src/simulation/HeuristicStrategy.ts`

**Step 1: Search for powerGrid references**

```bash
cd /workspace/.worktrees/grid-only-power
grep -n "powerGrid\|PowerGrid" src/simulation/*.ts
```

**Step 2: Update SimulationRunner if needed**

Remove any references to `powerGrid.getGridStrain()` or similar.

**Step 3: Update HeuristicStrategy if needed**

The AI strategy may check power status - update to use the new snapshot format.

**Step 4: Run simulation tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test tests/simulation
```

**Step 5: Commit**

```bash
git add src/simulation/
git commit -m "refactor(simulation): update for grid-only power system"
```

---

## Task 14: Fix remaining test failures

Update any tests that reference the removed power grid.

**Files:**
- Modify: `tests/simulation/HeuristicStrategy.test.ts` (if needed)
- Modify: Any other failing tests

**Step 1: Run all tests and identify failures**

```bash
cd /workspace/.worktrees/grid-only-power && bun test 2>&1 | grep -A 5 "FAIL\|Error"
```

**Step 2: Fix each failing test**

Update mocks and assertions to use the new power system.

**Step 3: Run full test suite**

```bash
cd /workspace/.worktrees/grid-only-power && bun test
```

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: fix tests for grid-only power system"
```

---

## Task 15: Run full verification

Ensure everything works together.

**Step 1: Run linter**

```bash
cd /workspace/.worktrees/grid-only-power && bun run lint
```

**Step 2: Run formatter**

```bash
cd /workspace/.worktrees/grid-only-power && bun run format
```

**Step 3: Run all tests**

```bash
cd /workspace/.worktrees/grid-only-power && bun test
```

**Step 4: Run build**

```bash
cd /workspace/.worktrees/grid-only-power && bun run build
```

**Step 5: Run simulation**

```bash
cd /workspace/.worktrees/grid-only-power && bun run simulate --runs 5 --log silent
```

**Step 6: Final commit if any formatting changes**

```bash
git add -A
git commit -m "chore: format and lint fixes" || true
```
