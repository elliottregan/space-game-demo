# Victory Megastructures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add three faction megastructure buildings that trigger victory when constructed, unlocked by passing capstone projects.

**Architecture:** Add `requiredProject` and `isVictoryBuilding` fields to BuildingDefinition. BuildingManager checks project completion when evaluating canBuild. When a victory building completes construction, VictoryManager triggers a building-based victory. BuildingsFacade exposes project requirements.

**Tech Stack:** TypeScript, existing BuildingManager/VictoryManager/IdeologyManager patterns

---

## Task 1: Add New Building Model Fields

**Files:**
- Modify: `src/core/models/Building.ts`

**Step 1: Add imports for ProjectId**

Add at top of file:

```typescript
import type { ProjectId } from "./NPCInfluence";
```

**Step 2: Add new BuildingIds to enum**

Add after `ASSEMBLY_HALL`:

```typescript
  // Victory megastructures
  GENERATION_SHIP = "generation_ship",
  UNITED_MARS_STATION = "united_mars_station",
  SPACE_ELEVATOR = "space_elevator",
```

**Step 3: Add new fields to BuildingDefinition interface**

Add after `bondingStrength`:

```typescript
  requiredProject?: ProjectId; // Project that must be passed to unlock
  isVictoryBuilding?: boolean; // Completing this building wins the game
```

**Step 4: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/Building.ts
git commit -m "feat(models): add victory building fields to BuildingDefinition"
```

---

## Task 2: Add Megastructure Building Definitions

**Files:**
- Modify: `src/core/data/buildings.ts`

**Step 1: Add ProjectId import**

Add to imports:

```typescript
import { ProjectId } from "../models/NPCInfluence";
```

**Step 2: Add megastructure definitions**

Add at end of BUILDINGS array (before the closing `]`):

```typescript
  // Victory Megastructures (unlocked by capstone projects)
  {
    id: BuildingId.GENERATION_SHIP,
    name: "Generation Ship",
    description:
      "A massive interstellar vessel capable of carrying colonists to distant stars. Completing this proves Mars can seed the galaxy.",
    cost: { materials: 400 },
    constructionTime: 40,
    oxygenContribution: 10,
    purpose: BuildingPurpose.Industrial,
    requiredProject: ProjectId.RETURN_MISSION,
    isVictoryBuilding: true,
  },
  {
    id: BuildingId.UNITED_MARS_STATION,
    name: "United Mars Station",
    description:
      "An orbital station symbolizing Martian unity and independence. A beacon of sovereignty visible from Earth.",
    cost: { materials: 350 },
    constructionTime: 35,
    oxygenContribution: 8,
    purpose: BuildingPurpose.Industrial,
    requiredProject: ProjectId.DECLARATION_OF_SOVEREIGNTY,
    isVictoryBuilding: true,
  },
  {
    id: BuildingId.SPACE_ELEVATOR,
    name: "Space Elevator",
    description:
      "A tether to orbit enabling cheap access to space. The ultimate infrastructure for economic dominance.",
    cost: { materials: 300, power: 100 },
    constructionTime: 30,
    oxygenContribution: 5,
    purpose: BuildingPurpose.Industrial,
    requiredProject: ProjectId.PLANETARY_ACQUISITION,
    isVictoryBuilding: true,
  },
```

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/data/buildings.ts
git commit -m "feat(data): add victory megastructure building definitions"
```

---

## Task 3: Update Capstone Projects with Building Unlocks

**Files:**
- Modify: `src/core/data/projects.ts`

**Step 1: Add BuildingId import**

Add to imports:

```typescript
import { BuildingId } from "../models/Building";
```

**Step 2: Update RETURN_MISSION project**

Find the RETURN_MISSION project and add effects:

```typescript
  {
    id: ProjectId.RETURN_MISSION,
    name: "Return Mission",
    description:
      "Launch a crewed mission back to Earth, proving Mars can sustain true interplanetary civilization.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [
      ProjectId.EARTH_MEMORIAL,
      ProjectId.HERITAGE_ARCHIVE,
      ProjectId.GENERATION_SHIP,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.GENERATION_SHIP },
  },
```

**Step 3: Update DECLARATION_OF_SOVEREIGNTY project**

```typescript
  {
    id: ProjectId.DECLARATION_OF_SOVEREIGNTY,
    name: "Declaration of Sovereignty",
    description: "Formally declare Mars an independent nation, free from Earth jurisdiction.",
    type: NPCFaction.MarsIndependence,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [
      ProjectId.UNIVERSAL_HOUSING,
      ProjectId.HEALTHCARE_EXPANSION,
      ProjectId.DEMOCRATIC_ASSEMBLY,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.UNITED_MARS_STATION },
  },
```

**Step 4: Update PLANETARY_ACQUISITION project**

```typescript
  {
    id: ProjectId.PLANETARY_ACQUISITION,
    name: "Planetary Acquisition",
    description: "Take the colony public. Shareholders on Earth now own Mars.",
    type: NPCFaction.CorporateInterests,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [
      ProjectId.LABOR_EFFICIENCY,
      ProjectId.MINING_CONCESSION,
      ProjectId.AI_GOVERNANCE,
    ],
    requiredCouncilSupport: 0.65,
    effects: { unlockBuilding: BuildingId.SPACE_ELEVATOR },
  },
```

**Step 5: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/data/projects.ts
git commit -m "feat(projects): add megastructure unlock effects to capstone projects"
```

---

## Task 4: Add Project-Gated Building Check to BuildingManager

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`
- Test: `tests/BuildingManager.test.ts`

**Step 1: Write failing test for project-gated building**

Add to `tests/BuildingManager.test.ts`:

```typescript
import { ProjectId } from "../src/core/models/NPCInfluence";

describe("Project-gated buildings", () => {
  it("should not allow building victory buildings without completed project", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 500, power: 200 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const ideology = new IdeologyManager();

    manager.setIdeologyManager(ideology);

    // Generation Ship requires RETURN_MISSION project
    const canBuild = manager.canBuild(BuildingId.GENERATION_SHIP, resources, technology);
    expect(canBuild).toBe(false);
  });

  it("should allow building victory buildings after project is completed", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 500, power: 200 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const ideology = new IdeologyManager();

    manager.setIdeologyManager(ideology);

    // Complete the required project
    ideology.completeProject(ProjectId.RETURN_MISSION);

    const canBuild = manager.canBuild(BuildingId.GENERATION_SHIP, resources, technology);
    expect(canBuild).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/BuildingManager.test.ts --test-name-pattern "Project-gated"`
Expected: FAIL (setIdeologyManager not defined)

**Step 3: Add IdeologyManager reference to BuildingManager**

Add after `private airQualityEfficiency`:

```typescript
  private ideologyManager: IdeologyManager | null = null;
```

Add method after `setAirQualityEfficiency`:

```typescript
  setIdeologyManager(ideology: IdeologyManager): void {
    this.ideologyManager = ideology;
  }
```

Add import at top:

```typescript
import type { IdeologyManager } from "./IdeologyManager";
```

**Step 4: Update canBuild method**

Update `canBuild` method to check project requirements:

```typescript
  canBuild(defId: BuildingId, resources: ResourceManager, technology: TechnologyTree): boolean {
    const def = this.definitions.get(defId);
    if (!def) return false;

    if (def.requiredTech && !technology.isResearched(def.requiredTech)) {
      return false;
    }

    // Check project requirements for victory buildings
    if (def.requiredProject) {
      if (!this.ideologyManager || !this.ideologyManager.isProjectCompleted(def.requiredProject)) {
        return false;
      }
    }

    return resources.canAfford(def.cost);
  }
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/BuildingManager.test.ts --test-name-pattern "Project-gated"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/systems/BuildingManager.ts tests/BuildingManager.test.ts
git commit -m "feat(buildings): add project requirement check to canBuild"
```

---

## Task 5: Wire IdeologyManager to BuildingManager in GameState

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Add setIdeologyManager call in constructor**

Add after `this.ideology = new IdeologyManager();`:

```typescript
    this.buildings.setIdeologyManager(this.ideology);
```

**Step 2: Add setIdeologyManager call in fromJSON**

Add after `state.ideology = IdeologyManager.fromJSON(data.ideology);` (inside the if block):

```typescript
      state.buildings.setIdeologyManager(state.ideology);
```

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat(state): wire IdeologyManager to BuildingManager"
```

---

## Task 6: Add Victory Building Detection to VictoryManager

**Files:**
- Modify: `src/core/systems/VictoryManager.ts`
- Test: `tests/VictoryManager.test.ts`

**Step 1: Write failing test for building victory**

Add to `tests/VictoryManager.test.ts` (create file if needed):

```typescript
import { describe, it, expect } from "bun:test";
import { VictoryManager } from "../src/core/systems/VictoryManager";
import { BuildingId } from "../src/core/models/Building";
import { NPCFaction } from "../src/core/models/NPCInfluence";

describe("VictoryManager building victory", () => {
  it("should trigger victory when victory building completes", () => {
    const manager = new VictoryManager();

    const event = manager.checkBuildingVictory(BuildingId.GENERATION_SHIP);

    expect(event).not.toBeNull();
    expect(event?.type).toBe("VICTORY");
    expect(manager.getState().status).toBe("victory");
  });

  it("should not trigger victory for normal buildings", () => {
    const manager = new VictoryManager();

    const event = manager.checkBuildingVictory(BuildingId.HABITAT);

    expect(event).toBeNull();
    expect(manager.getState().status).toBe("playing");
  });

  it("should include faction in victory reason", () => {
    const manager = new VictoryManager();

    const event = manager.checkBuildingVictory(BuildingId.SPACE_ELEVATOR);

    expect(event).not.toBeNull();
    expect(event?.message).toContain("Space Elevator");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/VictoryManager.test.ts --test-name-pattern "building victory"`
Expected: FAIL (checkBuildingVictory not defined)

**Step 3: Add imports to VictoryManager**

Add at top:

```typescript
import { BuildingId } from "../models/Building";
import { BUILDINGS } from "../data/buildings";
```

**Step 4: Add checkBuildingVictory method**

Add after `checkCapstoneVictory`:

```typescript
  /**
   * Check if a completed building triggers victory.
   * Returns a victory event if the building is a victory building, null otherwise.
   */
  checkBuildingVictory(buildingId: BuildingId): GameEvent | null {
    const def = BUILDINGS.find((b) => b.id === buildingId);
    if (!def?.isVictoryBuilding) {
      return null;
    }

    this.status = "victory";
    this.reason = `${def.name} completed! ${def.description}`;

    return {
      type: "VICTORY",
      reason: this.reason,
      severity: "info",
      message: this.reason,
    };
  }
```

**Step 5: Run test to verify it passes**

Run: `bun test tests/VictoryManager.test.ts --test-name-pattern "building victory"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/systems/VictoryManager.ts tests/VictoryManager.test.ts
git commit -m "feat(victory): add building-based victory detection"
```

---

## Task 7: Emit Victory Event on Building Completion

**Files:**
- Modify: `src/core/systems/BuildingManager.ts`

**Step 1: Add VictoryManager reference**

Add after `private ideologyManager`:

```typescript
  private victoryManager: VictoryManager | null = null;
```

Add method:

```typescript
  setVictoryManager(victory: VictoryManager): void {
    this.victoryManager = victory;
  }
```

Add import:

```typescript
import type { VictoryManager } from "./VictoryManager";
```

**Step 2: Update processConstruction to check for victory**

In `processConstruction`, after the `BUILDING_COMPLETE` event push, add:

```typescript
      // Check for victory building completion
      if (def.isVictoryBuilding && this.victoryManager) {
        const victoryEvent = this.victoryManager.checkBuildingVictory(building.definitionId);
        if (victoryEvent) {
          events.push(victoryEvent);
        }
      }
```

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/systems/BuildingManager.ts
git commit -m "feat(buildings): emit victory event on megastructure completion"
```

---

## Task 8: Wire VictoryManager to BuildingManager in GameState

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Add setVictoryManager call in constructor**

Add after `this.buildings.setIdeologyManager(this.ideology);`:

```typescript
    this.buildings.setVictoryManager(this.victory);
```

**Step 2: Add setVictoryManager call in fromJSON**

Add in the restoration section (after buildings is restored):

```typescript
    state.buildings.setVictoryManager(state.victory);
```

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat(state): wire VictoryManager to BuildingManager"
```

---

## Task 9: Update BuildingsFacade for Project Requirements

**Files:**
- Modify: `src/facade/domains/BuildingsFacade.ts`

**Step 1: Update canBuild to check project requirements**

Update the `canBuild` method to include project check:

```typescript
  canBuild(defId: BuildingId): CanDoResult {
    const def = this.gameState.buildings.getDefinition(defId);
    if (!def) {
      return { allowed: false, reason: `Building type "${defId}" not found` };
    }

    // Check tech requirements
    if (def.requiredTech && !this.gameState.technology.isResearched(def.requiredTech)) {
      const tech = this.gameState.technology.getTech(def.requiredTech);
      return {
        allowed: false,
        reason: `Requires technology: ${tech?.name ?? def.requiredTech}`,
      };
    }

    // Check project requirements (for victory buildings)
    if (def.requiredProject && !this.gameState.ideology.isProjectCompleted(def.requiredProject)) {
      const project = this.gameState.ideology.getCompletedProjects().includes(def.requiredProject)
        ? null
        : def.requiredProject;
      return {
        allowed: false,
        reason: `Requires capstone project to be passed first`,
      };
    }

    // Check resource cost
    const affordability = this.checkAffordability(def.cost);
    if (!affordability.allowed) {
      return affordability;
    }

    return { allowed: true };
  }
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/facade/domains/BuildingsFacade.ts
git commit -m "feat(facade): add project requirement check to canBuild"
```

---

## Task 10: Integration Test

**Files:**
- Test: `tests/VictoryMegastructures.test.ts` (new file)

**Step 1: Create integration test file**

Create `tests/VictoryMegastructures.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";
import { ProjectId } from "../src/core/models/NPCInfluence";

describe("Victory Megastructures Integration", () => {
  it("should not allow building megastructure without capstone project", () => {
    const state = new GameState();

    // Give plenty of resources
    state.resources.add({ materials: 1000, power: 500 });

    // Try to build Generation Ship without completing project
    const canBuild = state.buildings.canBuild(
      BuildingId.GENERATION_SHIP,
      state.resources,
      state.technology,
    );

    expect(canBuild).toBe(false);
  });

  it("should allow building megastructure after capstone project completed", () => {
    const state = new GameState();

    // Give plenty of resources
    state.resources.add({ materials: 1000, power: 500 });

    // Complete the capstone project
    state.ideology.completeProject(ProjectId.RETURN_MISSION);

    // Now should be able to build
    const canBuild = state.buildings.canBuild(
      BuildingId.GENERATION_SHIP,
      state.resources,
      state.technology,
    );

    expect(canBuild).toBe(true);
  });

  it("should trigger victory when megastructure completes", () => {
    const state = new GameState();

    // Setup: complete project and give resources
    state.ideology.completeProject(ProjectId.RETURN_MISSION);
    state.resources.add({ materials: 1000 });

    // Start building
    const building = state.buildings.startBuilding(
      BuildingId.GENERATION_SHIP,
      state.resources,
      state.technology,
    );
    expect(building).not.toBeNull();

    // Fast-forward construction (40 sols)
    let victoryEvent = null;
    for (let i = 0; i < 50; i++) {
      const events = state.tick();
      const victory = events.find((e) => e.type === "VICTORY");
      if (victory) {
        victoryEvent = victory;
        break;
      }
    }

    expect(victoryEvent).not.toBeNull();
    expect(state.victory.getState().status).toBe("victory");
    expect(state.victory.getState().reason).toContain("Generation Ship");
  });

  it("should include building name in victory message", () => {
    const state = new GameState();

    // Setup for Space Elevator
    state.ideology.completeProject(ProjectId.PLANETARY_ACQUISITION);
    state.resources.add({ materials: 500, power: 200 });

    // Start building
    state.buildings.startBuilding(
      BuildingId.SPACE_ELEVATOR,
      state.resources,
      state.technology,
    );

    // Fast-forward construction (30 sols)
    for (let i = 0; i < 35; i++) {
      state.tick();
    }

    expect(state.victory.getState().status).toBe("victory");
    expect(state.victory.getState().reason).toContain("Space Elevator");
  });
});
```

**Step 2: Run integration tests**

Run: `bun test tests/VictoryMegastructures.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/VictoryMegastructures.test.ts
git commit -m "test: add victory megastructures integration tests"
```

---

## Task 11: Run Full Test Suite

**Step 1: Run all tests**

Run: `bun test`
Expected: PASS (all existing tests + new tests)

**Step 2: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from full test suite"
```

---

## Summary

This implementation:

1. **Adds model fields** - `requiredProject` and `isVictoryBuilding` to BuildingDefinition
2. **Defines megastructures** - Generation Ship, United Mars Station, Space Elevator
3. **Updates capstones** - Each capstone project unlocks its faction's megastructure
4. **Enforces project gating** - BuildingManager checks project completion before allowing build
5. **Triggers victory** - VictoryManager detects victory building completion
6. **Updates facade** - BuildingsFacade reports project requirements in canBuild

The victory flow is:
1. Complete 3 faction projects → Pass capstone → Unlocks megastructure
2. Build megastructure (300-400 materials, 30-40 sols)
3. Construction complete → Victory!
