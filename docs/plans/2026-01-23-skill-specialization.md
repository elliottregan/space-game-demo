# Skill Specialization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add unique skills to colonists that provide efficiency bonuses when working in related roles, making colonists feel more individual.

**Architecture:** Extend the Colonist model with a `skills` array. Create skill definitions in a new data file. Integrate skill bonuses into WorkforceManager efficiency calculations. Expose skills through the facade and display them in the UI.

**Tech Stack:** TypeScript, Vue 3, Bun test runner

---

## Task 1: Create Skill Definitions Data File

**Files:**
- Create: `src/core/data/skills.ts`

**Step 1: Create the skills data file**

```typescript
// src/core/data/skills.ts
import { ColonistRole } from "../models/Colonist";

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  affinity: ColonistRole[];
  efficiencyBonus: number;
}

export const SKILLS: SkillDefinition[] = [
  {
    id: "jury_rigger",
    name: "Jury-Rigger",
    description: "Can fix anything with duct tape",
    affinity: [ColonistRole.ENGINEERING],
    efficiencyBonus: 0.15,
  },
  {
    id: "green_thumb",
    name: "Green Thumb",
    description: "Innate talent with plants",
    affinity: [ColonistRole.FARMING],
    efficiencyBonus: 0.15,
  },
  {
    id: "lab_rat",
    name: "Lab Rat",
    description: "Obsessive attention to detail",
    affinity: [ColonistRole.RESEARCH],
    efficiencyBonus: 0.15,
  },
  {
    id: "people_person",
    name: "People Person",
    description: "Natural mediator",
    affinity: [ColonistRole.CIVIL_SCIENCE],
    efficiencyBonus: 0.15,
  },
  {
    id: "quick_learner",
    name: "Quick Learner",
    description: "Picks up new skills faster",
    affinity: [ColonistRole.RESEARCH, ColonistRole.ENGINEERING, ColonistRole.CIVIL_SCIENCE, ColonistRole.FARMING],
    efficiencyBonus: 0.05,
  },
  {
    id: "night_owl",
    name: "Night Owl",
    description: "Productive during off-hours",
    affinity: [ColonistRole.RESEARCH, ColonistRole.ENGINEERING, ColonistRole.CIVIL_SCIENCE, ColonistRole.FARMING],
    efficiencyBonus: 0.05,
  },
  {
    id: "calm_under_pressure",
    name: "Calm Under Pressure",
    description: "Performs well in crises",
    affinity: [ColonistRole.ENGINEERING, ColonistRole.RESEARCH],
    efficiencyBonus: 0.1,
  },
  {
    id: "homebody",
    name: "Homebody",
    description: "Thrives in routine work",
    affinity: [ColonistRole.FARMING, ColonistRole.CIVIL_SCIENCE],
    efficiencyBonus: 0.1,
  },
];

export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}
```

**Step 2: Verify file created**

Run: `ls -la src/core/data/skills.ts`
Expected: File exists

**Step 3: Commit**

```bash
git add src/core/data/skills.ts
git commit -m "feat(colonists): add skill definitions data file"
```

---

## Task 2: Extend Colonist Model

**Files:**
- Modify: `src/core/models/Colonist.ts`

**Step 1: Add skills field to Colonist interface**

In `src/core/models/Colonist.ts`, add the `skills` field to the `Colonist` interface:

```typescript
export interface Colonist {
  id: string;
  name: string;
  role: ColonistRole;
  experience: number;
  masteryLevel: MasteryLevel;
  trainingTarget?: ColonistRole;
  trainingProgress?: number;
  skills: string[];
}
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/models/Colonist.ts
git commit -m "feat(colonists): add skills field to Colonist interface"
```

---

## Task 3: Add Skill Balance Constants

**Files:**
- Modify: `src/core/balance/WorkforceBalance.ts`

**Step 1: Add skill efficiency constants**

Add at the end of `src/core/balance/WorkforceBalance.ts`:

```typescript
/** Maximum total efficiency bonus from skills */
export const MAX_SKILL_EFFICIENCY_BONUS = 0.2;

/** Number of skills assigned to each colonist (min, max) */
export const COLONIST_SKILL_COUNT = { min: 1, max: 2 };
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/balance/WorkforceBalance.ts
git commit -m "feat(colonists): add skill efficiency balance constants"
```

---

## Task 4: Write Test for Skill Assignment

**Files:**
- Create: `tests/SkillSpecialization.test.ts`

**Step 1: Write the failing test for skill assignment**

```typescript
// tests/SkillSpecialization.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { SKILLS } from "../src/core/data/skills";

describe("SkillSpecialization", () => {
  describe("Skill Assignment", () => {
    let colony: ColonyManager;

    beforeEach(() => {
      colony = new ColonyManager(0);
    });

    it("should assign 1-2 skills to new colonists", () => {
      const colonist = colony.addColonist();
      expect(colonist.skills).toBeDefined();
      expect(colonist.skills.length).toBeGreaterThanOrEqual(1);
      expect(colonist.skills.length).toBeLessThanOrEqual(2);
    });

    it("should assign valid skill IDs", () => {
      const colonist = colony.addColonist();
      const validSkillIds = SKILLS.map((s) => s.id);
      for (const skillId of colonist.skills) {
        expect(validSkillIds).toContain(skillId);
      }
    });

    it("should not assign duplicate skills", () => {
      // Create many colonists to test randomness
      for (let i = 0; i < 20; i++) {
        const colonist = colony.addColonist();
        const uniqueSkills = new Set(colonist.skills);
        expect(uniqueSkills.size).toBe(colonist.skills.length);
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/SkillSpecialization.test.ts`
Expected: FAIL (skills not assigned yet)

**Step 3: Commit failing test**

```bash
git add tests/SkillSpecialization.test.ts
git commit -m "test(colonists): add failing tests for skill assignment"
```

---

## Task 5: Implement Skill Assignment in ColonyManager

**Files:**
- Modify: `src/core/systems/ColonyManager.ts`

**Step 1: Import skills and balance constants**

At the top of `src/core/systems/ColonyManager.ts`, add imports:

```typescript
import { SKILLS } from "../data/skills";
import { COLONIST_SKILL_COUNT } from "../balance/WorkforceBalance";
```

**Step 2: Create skill assignment helper method**

Add this private method to the `ColonyManager` class (before `addColonist`):

```typescript
private assignRandomSkills(): string[] {
  const skillCount =
    Math.floor(Math.random() * (COLONIST_SKILL_COUNT.max - COLONIST_SKILL_COUNT.min + 1)) +
    COLONIST_SKILL_COUNT.min;

  const shuffled = [...SKILLS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, skillCount).map((s) => s.id);
}
```

**Step 3: Update addColonist to assign skills**

Modify the `addColonist` method to include skills:

```typescript
addColonist(name?: string): Colonist {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

  const colonist: Colonist = {
    id: `colonist_${this.nextId++}`,
    name: name || `${firstName} ${lastName}`,
    role: ColonistRole.UNASSIGNED,
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
    skills: this.assignRandomSkills(),
  };

  this.colonists.set(colonist.id, colonist);
  return colonist;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/SkillSpecialization.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/ColonyManager.ts
git commit -m "feat(colonists): implement random skill assignment on colonist creation"
```

---

## Task 6: Write Test for Skill Efficiency Calculation

**Files:**
- Modify: `tests/SkillSpecialization.test.ts`

**Step 1: Add tests for efficiency calculation**

Add to `tests/SkillSpecialization.test.ts`:

```typescript
import { WorkforceManager } from "../src/core/systems/WorkforceManager";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import { MASTERY_EFFICIENCY, MAX_SKILL_EFFICIENCY_BONUS } from "../src/core/balance/WorkforceBalance";

describe("Skill Efficiency", () => {
  let workforce: WorkforceManager;

  beforeEach(() => {
    workforce = new WorkforceManager();
  });

  it("should return base mastery efficiency for colonist with no matching skills", () => {
    const colonist = {
      id: "test_1",
      name: "Test",
      role: ColonistRole.ENGINEERING,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: ["green_thumb"], // Farming skill, not Engineering
    };

    const efficiency = workforce.getColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]);
  });

  it("should add skill bonus for matching skill", () => {
    const colonist = {
      id: "test_1",
      name: "Test",
      role: ColonistRole.ENGINEERING,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: ["jury_rigger"], // +15% for Engineering
    };

    const efficiency = workforce.getColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE] + 0.15);
  });

  it("should stack multiple matching skill bonuses", () => {
    const colonist = {
      id: "test_1",
      name: "Test",
      role: ColonistRole.ENGINEERING,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: ["jury_rigger", "calm_under_pressure"], // +15% + +10%
    };

    const efficiency = workforce.getColonistEfficiency(colonist);
    // Should be capped at MAX_SKILL_EFFICIENCY_BONUS (0.2)
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE] + MAX_SKILL_EFFICIENCY_BONUS);
  });

  it("should cap skill bonus at MAX_SKILL_EFFICIENCY_BONUS", () => {
    const colonist = {
      id: "test_1",
      name: "Test",
      role: ColonistRole.RESEARCH,
      experience: 0,
      masteryLevel: MasteryLevel.MASTER,
      skills: ["lab_rat", "calm_under_pressure"], // +15% + +10% = +25%, but capped at +20%
    };

    const efficiency = workforce.getColonistEfficiency(colonist);
    expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.MASTER] + MAX_SKILL_EFFICIENCY_BONUS);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/SkillSpecialization.test.ts`
Expected: FAIL (getColonistEfficiency not implemented)

**Step 3: Commit**

```bash
git add tests/SkillSpecialization.test.ts
git commit -m "test(colonists): add failing tests for skill efficiency calculation"
```

---

## Task 7: Implement Skill Efficiency in WorkforceManager

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`

**Step 1: Import required dependencies**

Add imports at the top:

```typescript
import { SKILLS } from "../data/skills";
import { MASTERY_EFFICIENCY, MAX_SKILL_EFFICIENCY_BONUS } from "../balance/WorkforceBalance";
```

**Step 2: Implement getColonistEfficiency method**

Add this method to the `WorkforceManager` class:

```typescript
/**
 * Calculate the total efficiency multiplier for a colonist.
 * Combines mastery level bonus with skill bonuses (capped).
 */
getColonistEfficiency(colonist: Colonist): number {
  const masteryEfficiency = MASTERY_EFFICIENCY[colonist.masteryLevel];

  let skillBonus = 0;
  for (const skillId of colonist.skills) {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (skill && skill.affinity.includes(colonist.role)) {
      skillBonus += skill.efficiencyBonus;
    }
  }

  // Cap skill bonus
  skillBonus = Math.min(skillBonus, MAX_SKILL_EFFICIENCY_BONUS);

  return masteryEfficiency + skillBonus;
}
```

**Step 3: Run test to verify it passes**

Run: `bun test tests/SkillSpecialization.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/systems/WorkforceManager.ts
git commit -m "feat(colonists): implement skill efficiency calculation in WorkforceManager"
```

---

## Task 8: Update Facade Types for Skills

**Files:**
- Modify: `src/facade/types/colony.ts`

**Step 1: Add SkillDefinition to facade types**

Update `src/facade/types/colony.ts`:

```typescript
// src/facade/types/colony.ts
// Colony and colonist types for the facade

import type { Colonist, ColonistRole } from "../../core/models/Colonist";
import type { SkillDefinition } from "../../core/data/skills";

/**
 * Immutable snapshot of colony state.
 */
export interface ColonySnapshot {
  readonly population: number;
  readonly health: number;
  readonly morale: number;
  readonly colonists: readonly Readonly<Colonist>[];
  readonly skillDefinitions: readonly Readonly<SkillDefinition>[];
}

// Re-export core types
export type { Colonist, ColonistRole, SkillDefinition };
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/facade/types/colony.ts
git commit -m "feat(facade): add SkillDefinition to colony types"
```

---

## Task 9: Update ColonyFacade Snapshot

**Files:**
- Modify: `src/facade/domains/ColonyFacade.ts`

**Step 1: Import SKILLS and update snapshot**

Add import at top:

```typescript
import { SKILLS } from "../../core/data/skills";
```

Update the `snapshot()` method:

```typescript
snapshot(): ColonySnapshot {
  return {
    population: this.gameState.colony.getPopulation(),
    health: this.gameState.colony.getHealth(),
    morale: this.gameState.colony.getMorale(),
    colonists: Object.freeze([...this.gameState.colony.getColonists()]),
    skillDefinitions: Object.freeze([...SKILLS]),
  };
}
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/facade/domains/ColonyFacade.ts
git commit -m "feat(facade): expose skill definitions in ColonyFacade snapshot"
```

---

## Task 10: Update GameUIState for Skills

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Import SkillDefinition type**

Update the imports at top of file to include `SkillDefinition`:

```typescript
import {
  GameAPI,
  type Resources,
  type ResourceDelta,
  type Building,
  type BuildingDefinition,
  type Technology,
  type TechResearch,
  type Colonist,
  type ColonistRole,
  type Faction,
  type Decision,
  type DecisionResult,
  type RandomEventDefinition,
  type EventChoice,
  type ActiveEvent,
  type VictoryState,
  type ColonyPolicies,
  type ActiveExpedition,
  type ProspectingSite,
  type GameEvent,
  type BuildingMode,
  type PolicyType,
  type PolicyValue,
  type ExpeditionType,
  type SkillDefinition,
} from "../../facade";
```

**Step 2: Add skillDefinitions to GameUIState interface**

Add to the `GameUIState` interface (after `colonists`):

```typescript
interface GameUIState {
  // ... existing fields ...
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
  // ... rest of fields ...
}
```

**Step 3: Update createInitialState**

Add to `createInitialState()`:

```typescript
colonists: [],
skillDefinitions: [],
```

**Step 4: Update syncState**

Add to `syncState()` after the colonists sync:

```typescript
this.state.colonists = [...colony.colonists];
this.state.skillDefinitions = [...colony.skillDefinitions];
```

**Step 5: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat(ui): add skillDefinitions to GameUIState"
```

---

## Task 11: Export SkillDefinition from Facade Index

**Files:**
- Modify: `src/facade/types/index.ts`

**Step 1: Add SkillDefinition export**

Ensure `SkillDefinition` is exported from `src/facade/types/index.ts`. Add to the colony exports:

```typescript
export type { ColonySnapshot, Colonist, ColonistRole, SkillDefinition } from "./colony";
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/facade/types/index.ts
git commit -m "feat(facade): export SkillDefinition from types index"
```

---

## Task 12: Create ColonistSkillBadge Component

**Files:**
- Create: `src/renderer/components/ColonyPanel/ColonistSkillBadge.vue`

**Step 1: Create the skill badge component**

```vue
<script setup lang="ts">
import type { SkillDefinition } from "../../../facade";

defineProps<{
  skill: SkillDefinition;
  isActive: boolean;
}>();
</script>

<template>
  <span
    class="skill-badge"
    :class="{ active: isActive }"
    :title="`${skill.name}: ${skill.description} (${isActive ? '+' + (skill.efficiencyBonus * 100) + '% efficiency' : 'not active for current role'})`"
  >
    {{ skill.name }}
  </span>
</template>

<style scoped>
.skill-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg-elevated);
  color: var(--g-color-text-muted);
  border: 1px solid var(--g-color-border);
}

.skill-badge.active {
  background: color-mix(in srgb, var(--color-positive) 20%, transparent);
  color: var(--color-positive);
  border-color: var(--color-positive);
}
</style>
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/ColonyPanel/ColonistSkillBadge.vue
git commit -m "feat(ui): create ColonistSkillBadge component"
```

---

## Task 13: Create ColonistCard Component

**Files:**
- Create: `src/renderer/components/ColonyPanel/ColonistCard.vue`

**Step 1: Create the colonist card component**

```vue
<script setup lang="ts">
import type { Colonist, SkillDefinition } from "../../../facade";
import { ColonistRole } from "../../../core/models/Colonist";
import ColonistSkillBadge from "./ColonistSkillBadge.vue";
import { computed } from "vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
}>();

const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isSkillActive(skill: SkillDefinition): boolean {
  return skill.affinity.includes(props.colonist.role);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const roleNames: Record<ColonistRole, string> = {
  [ColonistRole.UNASSIGNED]: "Unassigned",
  [ColonistRole.RESEARCH]: "Researcher",
  [ColonistRole.ENGINEERING]: "Engineer",
  [ColonistRole.CIVIL_SCIENCE]: "Scientist",
  [ColonistRole.FARMING]: "Farmer",
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const masteryNames = ["Novice", "Skilled", "Expert", "Master"];
</script>

<template>
  <div class="colonist-card">
    <div class="colonist-header">
      <span class="colonist-name">{{ colonist.name }}</span>
      <span class="colonist-role">{{ roleNames[colonist.role] }}</span>
    </div>
    <div class="colonist-mastery">{{ masteryNames[colonist.masteryLevel] }}</div>
    <div class="colonist-skills" v-if="colonistSkills.length > 0">
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="isSkillActive(skill)"
      />
    </div>
  </div>
</template>

<style scoped>
.colonist-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  border: 1px solid var(--g-color-border);
}

.colonist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.colonist-name {
  font-weight: bold;
  font-size: var(--g-font-size-sm);
}

.colonist-role {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.colonist-mastery {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.colonist-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/ColonyPanel/ColonistCard.vue
git commit -m "feat(ui): create ColonistCard component with skill display"
```

---

## Task 14: Add Colonist List to ColonyPanel

**Files:**
- Modify: `src/renderer/components/ColonyPanel/ColonyPanel.vue`

**Step 1: First read the current ColonyPanel to understand its structure**

Read the file to understand how to integrate the colonist list.

**Step 2: Import and use ColonistCard**

Add import in script section:

```typescript
import ColonistCard from "./ColonistCard.vue";
```

Get skillDefinitions from state and pass to ColonistCard.

**Step 3: Add colonist list section to template**

Add after the workforce section:

```vue
<div class="colonist-list" v-if="state.colonists.length > 0">
  <h3>Colonists</h3>
  <div class="colonist-grid">
    <ColonistCard
      v-for="colonist in state.colonists"
      :key="colonist.id"
      :colonist="colonist"
      :skill-definitions="state.skillDefinitions"
    />
  </div>
</div>
```

**Step 4: Add styles**

```css
.colonist-list {
  margin-top: var(--g-space-md);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.colonist-list h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.colonist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--g-space-sm);
  max-height: 300px;
  overflow-y: auto;
}
```

**Step 5: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 6: Commit**

```bash
git add src/renderer/components/ColonyPanel/ColonyPanel.vue
git commit -m "feat(ui): display colonist list with skills in ColonyPanel"
```

---

## Task 15: Handle Save/Load Compatibility

**Files:**
- Modify: `src/core/systems/ColonyManager.ts`

**Step 1: Update fromJSON to handle missing skills**

In the `fromJSON` static method, ensure colonists without skills get an empty array (backwards compatibility):

```typescript
static fromJSON(data: {
  colonists: Colonist[];
  nextId: number;
  health: number;
  morale: number;
}): ColonyManager {
  const manager = new ColonyManager(0);
  data.colonists.forEach((c) => {
    // Handle backwards compatibility for saves without skills
    if (!c.skills) {
      c.skills = [];
    }
    manager.colonists.set(c.id, c);
  });
  manager.nextId = data.nextId;
  manager.health = data.health;
  manager.morale = data.morale;
  return manager;
}
```

**Step 2: Verify lint passes**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/systems/ColonyManager.ts
git commit -m "feat(colonists): handle backwards compatibility for saves without skills"
```

---

## Task 16: Run All Tests

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Run build**

Run: `bun run build`
Expected: Build succeeds

---

## Task 17: Final Commit and Summary

**Step 1: Verify git status**

Run: `git status`
Expected: Clean working directory (all changes committed)

**Step 2: View commit history**

Run: `git log --oneline -10`
Expected: See all feature commits

---

## Summary of Changes

### New Files
- `src/core/data/skills.ts` - Skill definitions (8 skills)
- `src/renderer/components/ColonyPanel/ColonistSkillBadge.vue` - Skill badge component
- `src/renderer/components/ColonyPanel/ColonistCard.vue` - Colonist card with skills
- `tests/SkillSpecialization.test.ts` - Tests for skill system

### Modified Files
- `src/core/models/Colonist.ts` - Added `skills: string[]` field
- `src/core/balance/WorkforceBalance.ts` - Added skill constants
- `src/core/systems/ColonyManager.ts` - Skill assignment on colonist creation
- `src/core/systems/WorkforceManager.ts` - Skill efficiency calculation
- `src/facade/types/colony.ts` - Added SkillDefinition export
- `src/facade/types/index.ts` - Export SkillDefinition
- `src/facade/domains/ColonyFacade.ts` - Expose skills in snapshot
- `src/renderer/services/GameService.ts` - Add skillDefinitions to UI state
- `src/renderer/components/ColonyPanel/ColonyPanel.vue` - Display colonist list

### Architecture Patterns Followed
- Core/renderer separation maintained
- TDD approach with failing tests first
- Existing efficiency multiplier pattern extended
- Facade pattern for state exposure
- Backwards compatible save/load
