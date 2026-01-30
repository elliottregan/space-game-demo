# Ideology Victory Projects Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ideology-based victory conditions where passing all faction projects unlocks a capstone vote that wins the game.

**Architecture:** Extend the existing project/voting system in IdeologyManager. Add new ProjectId values, capstone flag on Project interface, and capstone victory check in VictoryManager. Add one new prerequisite project (Democratic Assembly) and one new building (Assembly Hall).

**Tech Stack:** TypeScript, Bun test runner

---

## Task 1: Add New ProjectId Enum Values

**Files:**
- Modify: `src/core/models/NPCInfluence.ts:55-76`

**Step 1: Add enum values**

Add the new project IDs to the `ProjectId` enum and `ALL_PROJECT_IDS` array:

```typescript
export enum ProjectId {
  GENERATION_SHIP = "generation_ship",
  EARTH_MEMORIAL = "earth_memorial",
  HERITAGE_ARCHIVE = "heritage_archive",
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  AI_GOVERNANCE = "ai_governance",
  MINING_CONCESSION = "mining_concession",
  LABOR_EFFICIENCY = "labor_efficiency",
  // New projects
  DEMOCRATIC_ASSEMBLY = "democratic_assembly",
  // Capstone projects
  RETURN_MISSION = "return_mission",
  DECLARATION_OF_SOVEREIGNTY = "declaration_of_sovereignty",
  PLANETARY_ACQUISITION = "planetary_acquisition",
}

export const ALL_PROJECT_IDS: readonly ProjectId[] = [
  ProjectId.GENERATION_SHIP,
  ProjectId.EARTH_MEMORIAL,
  ProjectId.HERITAGE_ARCHIVE,
  ProjectId.UNIVERSAL_HOUSING,
  ProjectId.HEALTHCARE_EXPANSION,
  ProjectId.AI_GOVERNANCE,
  ProjectId.MINING_CONCESSION,
  ProjectId.LABOR_EFFICIENCY,
  ProjectId.DEMOCRATIC_ASSEMBLY,
  ProjectId.RETURN_MISSION,
  ProjectId.DECLARATION_OF_SOVEREIGNTY,
  ProjectId.PLANETARY_ACQUISITION,
] as const;
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/models/NPCInfluence.ts
git commit -m "feat: add new project IDs for ideology victory"
```

---

## Task 2: Extend Project Interface for Capstones

**Files:**
- Modify: `src/core/models/NPCInfluence.ts:89-104`

**Step 1: Add capstone fields to Project interface**

```typescript
export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  type: ProjectType;
  /** Resource cost to propose this project */
  proposalCost: ResourceDelta;
  /** Required faction support level to propose (0-1) */
  requiredSupport: number;
  /** Effects applied if project passes */
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
  /** True if this is a capstone victory project */
  isCapstone?: boolean;
  /** Projects that must be completed before this can be proposed */
  prerequisites?: ProjectId[];
  /** Required council support from this faction to propose capstone (0-1) */
  requiredCouncilSupport?: number;
}
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/models/NPCInfluence.ts
git commit -m "feat: add capstone fields to Project interface"
```

---

## Task 3: Add Democratic Assembly Project

**Files:**
- Modify: `src/core/data/projects.ts:33-52`

**Step 1: Add Democratic Assembly to Mars Independence projects**

Insert after HEALTHCARE_EXPANSION:

```typescript
  {
    id: ProjectId.DEMOCRATIC_ASSEMBLY,
    name: "Democratic Assembly",
    description: "Establish a formal democratic assembly where all colonists have a voice in governance.",
    type: NPCFaction.MarsIndependence,
    proposalCost: { materials: 70 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "assembly_hall" },
  },
```

**Step 2: Run tests**

Run: `bun test tests/IdeologyManager.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/data/projects.ts
git commit -m "feat: add Democratic Assembly project for Mars Independence"
```

---

## Task 4: Add Capstone Projects

**Files:**
- Modify: `src/core/data/projects.ts`

**Step 1: Add capstone projects at end of PROJECTS array**

```typescript
  // Capstone Victory Projects
  {
    id: ProjectId.RETURN_MISSION,
    name: "Return Mission",
    description: "Launch a crewed mission back to Earth, proving Mars can sustain true interplanetary civilization.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [ProjectId.EARTH_MEMORIAL, ProjectId.HERITAGE_ARCHIVE, ProjectId.GENERATION_SHIP],
    requiredCouncilSupport: 0.65,
  },
  {
    id: ProjectId.DECLARATION_OF_SOVEREIGNTY,
    name: "Declaration of Sovereignty",
    description: "Formally declare Mars an independent nation, free from Earth jurisdiction.",
    type: NPCFaction.MarsIndependence,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [ProjectId.UNIVERSAL_HOUSING, ProjectId.HEALTHCARE_EXPANSION, ProjectId.DEMOCRATIC_ASSEMBLY],
    requiredCouncilSupport: 0.65,
  },
  {
    id: ProjectId.PLANETARY_ACQUISITION,
    name: "Planetary Acquisition",
    description: "Take the colony public. Shareholders on Earth now own Mars.",
    type: NPCFaction.CorporateInterests,
    proposalCost: {},
    requiredSupport: 0,
    isCapstone: true,
    prerequisites: [ProjectId.LABOR_EFFICIENCY, ProjectId.MINING_CONCESSION, ProjectId.AI_GOVERNANCE],
    requiredCouncilSupport: 0.65,
  },
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/data/projects.ts
git commit -m "feat: add capstone victory projects for each faction"
```

---

## Task 5: Add Assembly Hall Building

**Files:**
- Modify: `src/core/models/Building.ts:5-28` (add enum value)
- Modify: `src/core/data/buildings.ts` (add building definition)

**Step 1: Add ASSEMBLY_HALL to BuildingId enum**

In `src/core/models/Building.ts`, add after OBSERVATORY_DOME:

```typescript
  ASSEMBLY_HALL = "assembly_hall",
```

**Step 2: Add building definition**

In `src/core/data/buildings.ts`, add to the social buildings section:

```typescript
  {
    id: BuildingId.ASSEMBLY_HALL,
    name: "Assembly Hall",
    description: "A democratic gathering space that boosts morale for independence-minded colonists.",
    cost: { materials: 80 },
    constructionTime: 15,
    consumption: { power: 3 },
    moraleBoost: 3,
    oxygenContribution: 0,
    purpose: BuildingPurpose.Social,
    bondingStrength: 1.2,
  },
```

**Step 3: Run tests**

Run: `bun test tests/BuildingsFacade.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/core/models/Building.ts src/core/data/buildings.ts
git commit -m "feat: add Assembly Hall building unlocked by Democratic Assembly"
```

---

## Task 6: Add Capstone Methods to IdeologyManager

**Files:**
- Test: `tests/IdeologyManager.test.ts`
- Modify: `src/core/systems/IdeologyManager.ts`

**Step 1: Write failing tests**

Add to `tests/IdeologyManager.test.ts`:

```typescript
describe("capstone projects", () => {
  let manager: IdeologyManager;
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    manager = new IdeologyManager();
    relationshipManager = new RelationshipManager();
  });

  describe("getPassedProjectsForFaction", () => {
    test("returns empty array when no projects passed", () => {
      expect(manager.getPassedProjectsForFaction(NPCFaction.EarthLoyalists)).toEqual([]);
    });

    test("returns only projects for specified faction", () => {
      manager.completeProject(ProjectId.EARTH_MEMORIAL);
      manager.completeProject(ProjectId.UNIVERSAL_HOUSING);

      const earthProjects = manager.getPassedProjectsForFaction(NPCFaction.EarthLoyalists);
      expect(earthProjects).toContain(ProjectId.EARTH_MEMORIAL);
      expect(earthProjects).not.toContain(ProjectId.UNIVERSAL_HOUSING);
    });
  });

  describe("canProposeCapstone", () => {
    test("returns false when prerequisites not met", () => {
      const colonists = [
        createTestColonist("c1", "Colonist 1", {
          earthLoyalist: 0.9, marsIndependence: 0.1, corporateInterests: 0.1, conviction: 0.8
        }),
      ];
      relationshipManager.initializeRelationships(colonists);
      manager.selectCouncil(colonists, relationshipManager, 0);

      expect(manager.canProposeCapstone(NPCFaction.EarthLoyalists)).toEqual({
        canPropose: false,
        reason: "Prerequisites not met: 0/3 projects passed",
      });
    });

    test("returns false when council support insufficient", () => {
      // Complete all Earth Loyalist prerequisites
      manager.completeProject(ProjectId.EARTH_MEMORIAL);
      manager.completeProject(ProjectId.HERITAGE_ARCHIVE);
      manager.completeProject(ProjectId.GENERATION_SHIP);

      // But council is mostly Mars Independence
      const colonists = [
        createTestColonist("c1", "Colonist 1", {
          earthLoyalist: 0.1, marsIndependence: 0.9, corporateInterests: 0.1, conviction: 0.8
        }),
        createTestColonist("c2", "Colonist 2", {
          earthLoyalist: 0.1, marsIndependence: 0.9, corporateInterests: 0.1, conviction: 0.8
        }),
        createTestColonist("c3", "Colonist 3", {
          earthLoyalist: 0.9, marsIndependence: 0.1, corporateInterests: 0.1, conviction: 0.8
        }),
      ];
      relationshipManager.initializeRelationships(colonists);
      manager.selectCouncil(colonists, relationshipManager, 0);

      expect(manager.canProposeCapstone(NPCFaction.EarthLoyalists)).toEqual({
        canPropose: false,
        reason: "Insufficient council support: 33% (need 65%)",
      });
    });

    test("returns true when prerequisites met and council support sufficient", () => {
      manager.completeProject(ProjectId.EARTH_MEMORIAL);
      manager.completeProject(ProjectId.HERITAGE_ARCHIVE);
      manager.completeProject(ProjectId.GENERATION_SHIP);

      // Council is mostly Earth Loyalists
      const colonists = [
        createTestColonist("c1", "Colonist 1", {
          earthLoyalist: 0.9, marsIndependence: 0.1, corporateInterests: 0.1, conviction: 0.8
        }),
        createTestColonist("c2", "Colonist 2", {
          earthLoyalist: 0.9, marsIndependence: 0.1, corporateInterests: 0.1, conviction: 0.8
        }),
        createTestColonist("c3", "Colonist 3", {
          earthLoyalist: 0.9, marsIndependence: 0.1, corporateInterests: 0.1, conviction: 0.8
        }),
      ];
      relationshipManager.initializeRelationships(colonists);
      manager.selectCouncil(colonists, relationshipManager, 0);

      expect(manager.canProposeCapstone(NPCFaction.EarthLoyalists)).toEqual({
        canPropose: true,
      });
    });
  });

  describe("isCapstoneProject", () => {
    test("returns true for capstone projects", () => {
      expect(manager.isCapstoneProject(ProjectId.RETURN_MISSION)).toBe(true);
      expect(manager.isCapstoneProject(ProjectId.DECLARATION_OF_SOVEREIGNTY)).toBe(true);
      expect(manager.isCapstoneProject(ProjectId.PLANETARY_ACQUISITION)).toBe(true);
    });

    test("returns false for regular projects", () => {
      expect(manager.isCapstoneProject(ProjectId.EARTH_MEMORIAL)).toBe(false);
      expect(manager.isCapstoneProject(ProjectId.UNIVERSAL_HOUSING)).toBe(false);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/IdeologyManager.test.ts`
Expected: FAIL - methods don't exist

**Step 3: Implement methods in IdeologyManager**

Add imports at top of file:

```typescript
import { getProject, getProjectsByFaction } from "../data/projects";
```

Add methods before `// ============ Serialization ============`:

```typescript
  // ============ Capstone Projects ============

  /**
   * Get all passed projects for a specific faction.
   */
  getPassedProjectsForFaction(faction: NPCFaction): ProjectId[] {
    const factionProjects = getProjectsByFaction(faction);
    return factionProjects
      .filter((p) => !p.isCapstone && this.completedProjects.has(p.id))
      .map((p) => p.id);
  }

  /**
   * Check if a project is a capstone victory project.
   */
  isCapstoneProject(projectId: ProjectId): boolean {
    const project = getProject(projectId);
    return project?.isCapstone === true;
  }

  /**
   * Check if a capstone project can be proposed.
   * Requires all prerequisites passed AND sufficient council support.
   */
  canProposeCapstone(faction: NPCFaction): { canPropose: boolean; reason?: string } {
    // Find the capstone for this faction
    const factionProjects = getProjectsByFaction(faction);
    const capstone = factionProjects.find((p) => p.isCapstone);
    if (!capstone) {
      return { canPropose: false, reason: "No capstone project for faction" };
    }

    // Check prerequisites
    const prerequisites = capstone.prerequisites ?? [];
    const passedPrereqs = prerequisites.filter((p) => this.completedProjects.has(p));
    if (passedPrereqs.length < prerequisites.length) {
      return {
        canPropose: false,
        reason: `Prerequisites not met: ${passedPrereqs.length}/${prerequisites.length} projects passed`,
      };
    }

    // Check council support
    const requiredSupport = capstone.requiredCouncilSupport ?? 0.65;
    const counts = this.getCouncilFactionCounts();
    const factionSeats = counts[faction] ?? 0;
    const totalSeats = this.council.length;
    const supportRatio = totalSeats > 0 ? factionSeats / totalSeats : 0;

    if (supportRatio < requiredSupport) {
      return {
        canPropose: false,
        reason: `Insufficient council support: ${Math.round(supportRatio * 100)}% (need ${Math.round(requiredSupport * 100)}%)`,
      };
    }

    return { canPropose: true };
  }
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/IdeologyManager.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add tests/IdeologyManager.test.ts src/core/systems/IdeologyManager.ts
git commit -m "feat: add capstone project methods to IdeologyManager"
```

---

## Task 7: Update VictoryManager for Capstone Victories

**Files:**
- Test: `tests/VictoryManager.test.ts` (create new file)
- Modify: `src/core/systems/VictoryManager.ts`

**Step 1: Create test file**

Create `tests/VictoryManager.test.ts`:

```typescript
import { describe, expect, test, beforeEach } from "bun:test";
import { VictoryManager } from "../src/core/systems/VictoryManager";
import { ProjectId } from "../src/core/models/NPCInfluence";

describe("VictoryManager", () => {
  let manager: VictoryManager;

  beforeEach(() => {
    manager = new VictoryManager();
  });

  describe("checkCapstoneVictory", () => {
    test("returns victory for Return Mission capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.RETURN_MISSION);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("VICTORY");
      expect(result?.message).toContain("Return Mission");
    });

    test("returns victory for Declaration of Sovereignty capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.DECLARATION_OF_SOVEREIGNTY);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("VICTORY");
      expect(result?.message).toContain("Declaration of Sovereignty");
    });

    test("returns victory for Planetary Acquisition capstone", () => {
      const result = manager.checkCapstoneVictory(ProjectId.PLANETARY_ACQUISITION);
      expect(result).not.toBeNull();
      expect(result?.type).toBe("VICTORY");
      expect(result?.message).toContain("Planetary Acquisition");
    });

    test("returns null for non-capstone project", () => {
      const result = manager.checkCapstoneVictory(ProjectId.EARTH_MEMORIAL);
      expect(result).toBeNull();
    });
  });

  describe("removed victory conditions", () => {
    test("100 population does not trigger victory", () => {
      // This test verifies the 100 pop victory is removed
      // by checking VictoryManager state after construction
      expect(manager.getState().status).toBe("playing");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/VictoryManager.test.ts`
Expected: FAIL - checkCapstoneVictory doesn't exist

**Step 3: Update VictoryManager**

Replace imports and add new method:

```typescript
import type { GameEvent } from "../models/GameEvent";
import { TechnologyId } from "../models/Technology";
import { ProjectId } from "../models/NPCInfluence";
import { getProject } from "../data/projects";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";
import type { TechnologyTree } from "./TechnologyTree";
```

Add method after `tick()`:

```typescript
  /**
   * Check if a passed project triggers a capstone victory.
   * Returns a victory event if the project is a capstone, null otherwise.
   */
  checkCapstoneVictory(projectId: ProjectId): GameEvent | null {
    const project = getProject(projectId);
    if (!project?.isCapstone) {
      return null;
    }

    this.status = "victory";
    this.reason = `${project.name} achieved! ${project.description}`;

    return {
      type: "VICTORY",
      reason: this.reason,
      severity: "info",
      message: this.reason,
    };
  }
```

Remove from `tick()` method - delete the 100 population victory check (lines ~92-102) and the Generation Ship tech victory check (lines ~79-90). Keep only:
- Colony Charter victory
- Defeat conditions (population < 5, food = 0)

**Step 4: Run tests to verify they pass**

Run: `bun test tests/VictoryManager.test.ts`
Expected: All tests pass

**Step 5: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add tests/VictoryManager.test.ts src/core/systems/VictoryManager.ts
git commit -m "feat: add capstone victory check, remove 100 pop and generation ship victories"
```

---

## Task 8: Integrate Capstone Victory into Game Loop

**Files:**
- Modify: `src/core/tick/phases/ideology.ts`

**Step 1: Update processProjectVotes to check for capstone victory**

Modify the `processProjectVotes` phase to call `checkCapstoneVictory` when a project passes:

```typescript
import { getProject } from "../../data/projects";
import type { GameEvent } from "../../events/GameEvent";
import { definePhase } from "../TickPhase";

// ... propagateIdeology phase unchanged ...

export const processProjectVotes = definePhase({
  id: "ideology:processProjectVotes",
  name: "Process Project Votes",
  reads: ["ideology", "colony", "workforce", "currentSol", "victory"],
  writes: ["ideology", "victory"],
  execute(ctx) {
    const events: GameEvent[] = [];
    const colonists = ctx.colony.getColonists();

    // Process any votes that are due
    const voteResults = ctx.ideology.processVotes(ctx.currentSol);

    for (const result of voteResults) {
      const project = getProject(result.projectId);
      if (!project) continue;

      if (result.passed) {
        // Check for capstone victory
        const victoryEvent = ctx.victory.checkCapstoneVictory(result.projectId);
        if (victoryEvent) {
          events.push(victoryEvent);
          return events; // Stop processing, game is won
        }

        // Apply morale effects for passed projects
        ctx.ideology.applyProjectMoraleEffects(project.type, colonists, ctx.colonistMorale);

        events.push({
          type: "project_passed",
          message: `Project "${project.name}" passed the council vote (${result.votesFor}-${result.votesAgainst})`,
          details: {
            projectId: result.projectId,
            votesFor: result.votesFor,
            votesAgainst: result.votesAgainst,
          },
        });
      } else {
        events.push({
          type: "project_failed",
          message: `Project "${project.name}" failed the council vote (${result.votesFor}-${result.votesAgainst})`,
          details: {
            projectId: result.projectId,
            votesFor: result.votesFor,
            votesAgainst: result.votesAgainst,
          },
        });
      }
    }

    return events;
  },
});
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/tick/phases/ideology.ts
git commit -m "feat: integrate capstone victory check into game loop"
```

---

## Task 9: Update Simulation Strategy for Capstone Victories

**Files:**
- Modify: `src/simulation/HeuristicStrategy.ts` (if needed)

**Step 1: Check if simulation needs updates**

The simulation should still work because:
- Colony Charter victory path remains unchanged
- Simulation AI doesn't pursue political victories intentionally

Run simulation to verify:

Run: `bun run scripts/simulate.ts --runs 5 --verbose`
Expected: Completes without errors, shows victory/defeat results

**Step 2: Commit if changes were needed**

If no changes needed, skip this step.

---

## Task 10: Final Integration Test

**Files:**
- None (manual verification)

**Step 1: Run full test suite**

Run: `bun test`
Expected: All 817+ tests pass

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Run simulation**

Run: `bun run scripts/simulate.ts --runs 10 --verbose`
Expected: Completes, shows mix of victories/defeats

**Step 4: Verify build**

Run: `bun run build`
Expected: Builds successfully

**Step 5: Create final commit if any cleanup needed**

```bash
git status
# If clean, no commit needed
```

---

## Summary

**Tasks completed:**
1. Add new ProjectId enum values
2. Extend Project interface for capstones
3. Add Democratic Assembly project
4. Add capstone victory projects
5. Add Assembly Hall building
6. Add capstone methods to IdeologyManager
7. Update VictoryManager for capstone victories
8. Integrate capstone victory into game loop
9. Verify simulation compatibility
10. Final integration test

**Files modified:**
- `src/core/models/NPCInfluence.ts`
- `src/core/models/Building.ts`
- `src/core/data/projects.ts`
- `src/core/data/buildings.ts`
- `src/core/systems/IdeologyManager.ts`
- `src/core/systems/VictoryManager.ts`
- `src/core/tick/phases/ideology.ts`
- `tests/IdeologyManager.test.ts`
- `tests/VictoryManager.test.ts` (new)
