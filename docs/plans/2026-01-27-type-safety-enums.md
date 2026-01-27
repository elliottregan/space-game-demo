# Type Safety Enums Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add strongly-typed enums for all predefined identifiers (EventId, NPCId, ProjectId) to provide compile-time validation and IDE autocomplete.

**Architecture:** Follow the established pattern from BuildingId/TechnologyId/SkillId - create enums in model/data files, update interfaces to use them, update data files to use enum values, export from facade types.

**Tech Stack:** TypeScript enums, Vue 3, Bun test runner

---

## Task 1: Add EventId enum

**Files:**
- Modify: `src/core/models/GameEvent.ts`
- Modify: `src/core/data/events.ts`
- Modify: `src/facade/types/events.ts`
- Modify: `src/facade/types/index.ts`

**Step 1: Add EventId enum to GameEvent.ts**

Add at the top of the file after imports:

```typescript
export enum EventId {
  FIRST_WAVE_SETTLERS = "first_wave_settlers",
  FAMILY_REUNIFICATION = "family_reunification",
  DUST_STORM = "dust_storm",
  METEOR_STRIKE = "meteor_strike",
  DISEASE_OUTBREAK = "disease_outbreak",
  EARTH_SUPPLY_SHIP = "earth_supply_ship",
  COLONIST_DISPUTE = "colonist_dispute",
  SCIENTIFIC_DISCOVERY = "scientific_discovery",
  NEW_COLONISTS = "new_colonists",
  CORPORATE_WORKFORCE_INITIATIVE = "corporate_workforce_initiative",
  INDEPENDENCE_VOLUNTEERS = "independence_volunteers",
  EQUIPMENT_FAILURE = "equipment_failure",
  ABANDONED_CACHE = "abandoned_cache",
  GEOLOGICAL_SURVEY = "geological_survey",
  EQUIPMENT_WINDFALL = "equipment_windfall",
}
```

**Step 2: Update RandomEventDefinition interface**

Change `id: string` to `id: EventId`:

```typescript
export interface RandomEventDefinition {
  id: EventId;
  name: string;
  description: string;
  minSol: number;
  maxSol?: number;
  chance: number;
  weight?: number;
  choices: EventChoice[];
}
```

**Step 3: Update ActiveEvent interface**

Change `eventId: string` to `eventId: EventId`:

```typescript
export interface ActiveEvent {
  eventId: EventId;
  triggeredAt: number;
  resolved: boolean;
}
```

**Step 4: Update events.ts data file**

Update import and all event IDs:

```typescript
import { EventId, type RandomEventDefinition } from "../models/GameEvent";

export const RANDOM_EVENTS: RandomEventDefinition[] = [
  {
    id: EventId.FIRST_WAVE_SETTLERS,
    // ... rest unchanged
  },
  {
    id: EventId.FAMILY_REUNIFICATION,
    // ... rest unchanged
  },
  // Continue for all 15 events...
];
```

**Step 5: Update facade/types/events.ts**

```typescript
import {
  EventId,
  type ActiveEvent,
  type EventChoice,
  type GameEvent,
  type RandomEventDefinition,
} from "../../core/models/GameEvent";

// ... interface unchanged ...

// Re-export core types
export { EventId };
export type { GameEvent, RandomEventDefinition, EventChoice, ActiveEvent };
```

**Step 6: Update facade/types/index.ts**

Change the events export line:

```typescript
// Event types
export { EventId } from "./events";
export type {
  ActiveEvent,
  ActiveEventSnapshot,
  EventChoice,
  GameEvent,
  RandomEventDefinition,
} from "./events";
```

**Step 7: Run build and tests**

```bash
bun run build && bun test
```

**Step 8: Commit**

```bash
git add src/core/models/GameEvent.ts src/core/data/events.ts src/facade/types/events.ts src/facade/types/index.ts
git commit -m "feat: add EventId enum for stronger typing"
```

---

## Task 2: Add NPCId enum

**Files:**
- Modify: `src/core/models/NPCInfluence.ts`
- Modify: `src/core/data/npcs.ts`
- Modify: `src/facade/types/npc.ts`
- Modify: `src/facade/types/index.ts`

**Step 1: Add NPCId enum to NPCInfluence.ts**

Add after the NPCFaction enum:

```typescript
export enum NPCId {
  // Earth Loyalists
  CHEN_WEI = "chen_wei",
  NOVA_SILVA = "nova_silva",
  ALEX_OKONKWO = "alex_okonkwo",
  // Mars Independence
  MARIA_SANTOS = "maria_santos",
  JAMES_LIU = "james_liu",
  AISHA_PATEL = "aisha_patel",
  MARCUS_REED = "marcus_reed",
  // Corporate Interests
  ELENA_VOLKOV = "elena_volkov",
  DAVID_MORRISON = "david_morrison",
  SARAH_CHEN = "sarah_chen",
}
```

**Step 2: Update NPC interface**

```typescript
export interface NPC {
  id: NPCId;
  name: string;
  faction: NPCFaction;
  influence: number;
}
```

**Step 3: Update ActiveProject interface**

```typescript
export interface ActiveProject {
  projectId: string; // Will be ProjectId in Task 3
  supportLevels: Map<NPCId, number>;
  solsRemaining: number;
}
```

**Step 4: Update Council interface**

```typescript
export interface Council {
  id: string; // Council IDs are dynamic, keep as string
  name: string;
  memberIds: NPCId[];
  relationshipBoost: number;
}
```

**Step 5: Update npcs.ts data file**

Update NPC definitions:

```typescript
import { NPCId, type NPC, NPCFaction, type Project } from "../models/NPCInfluence";

export const NPCS: NPC[] = [
  { id: NPCId.CHEN_WEI, name: "Dr. Chen Wei", faction: NPCFaction.EarthLoyalists, influence: 1.5 },
  { id: NPCId.NOVA_SILVA, name: "Nova Silva", faction: NPCFaction.EarthLoyalists, influence: 1.0 },
  { id: NPCId.ALEX_OKONKWO, name: "Alex Okonkwo", faction: NPCFaction.EarthLoyalists, influence: 1.2 },
  { id: NPCId.MARIA_SANTOS, name: "Maria Santos", faction: NPCFaction.MarsIndependence, influence: 1.3 },
  { id: NPCId.JAMES_LIU, name: "James Liu", faction: NPCFaction.MarsIndependence, influence: 1.0 },
  { id: NPCId.AISHA_PATEL, name: "Aisha Patel", faction: NPCFaction.MarsIndependence, influence: 1.1 },
  { id: NPCId.MARCUS_REED, name: "Marcus Reed", faction: NPCFaction.MarsIndependence, influence: 0.9 },
  { id: NPCId.ELENA_VOLKOV, name: "Elena Volkov", faction: NPCFaction.CorporateInterests, influence: 1.4 },
  { id: NPCId.DAVID_MORRISON, name: "David Morrison", faction: NPCFaction.CorporateInterests, influence: 1.0 },
  { id: NPCId.SARAH_CHEN, name: "Sarah Chen", faction: NPCFaction.CorporateInterests, influence: 1.1 },
];
```

**Step 6: Update INITIAL_RELATIONSHIPS type**

```typescript
/** Initial relationship weights. Key format: "fromId:toId" -> weight */
export const INITIAL_RELATIONSHIPS: Record<`${NPCId}:${NPCId}`, number> = {
  [`${NPCId.CHEN_WEI}:${NPCId.NOVA_SILVA}`]: 0.7,
  [`${NPCId.NOVA_SILVA}:${NPCId.CHEN_WEI}`]: 0.6,
  // ... continue for all relationships
};
```

**Step 7: Update facade/types/npc.ts**

```typescript
import { NPCId, type Council, type NPC, type Project } from "../../core/models/NPCInfluence";

export interface NPCInfluenceSnapshot {
  readonly npcs: readonly Readonly<NPC>[];
  readonly projects: readonly Readonly<Project>[];
  readonly activeProject: Readonly<{
    projectId: string; // Will be ProjectId after Task 3
    supportLevels: Readonly<Record<NPCId, number>>;
    solsRemaining: number;
    averageSupport: number;
  }> | null;
  readonly councils: readonly Readonly<Council>[];
  readonly relationshipMatrix: readonly (readonly number[])[];
}

// Re-export core types
export { NPCId };
export type { NPC, Project, Council };
```

**Step 8: Update facade/types/index.ts**

```typescript
// NPC types
export { NPCId } from "./npc";
export type { Council, NPC, NPCInfluenceSnapshot, Project } from "./npc";
```

**Step 9: Run build and tests**

```bash
bun run build && bun test
```

**Step 10: Commit**

```bash
git add src/core/models/NPCInfluence.ts src/core/data/npcs.ts src/facade/types/npc.ts src/facade/types/index.ts
git commit -m "feat: add NPCId enum for stronger typing"
```

---

## Task 3: Add ProjectId enum

**Files:**
- Modify: `src/core/models/NPCInfluence.ts`
- Modify: `src/core/data/npcs.ts`
- Modify: `src/facade/types/npc.ts`
- Modify: `src/facade/types/index.ts`

**Step 1: Add ProjectId enum to NPCInfluence.ts**

Add after NPCId enum:

```typescript
export enum ProjectId {
  // Earth Loyalists
  GENERATION_SHIP = "generation_ship",
  EARTH_MEMORIAL = "earth_memorial",
  HERITAGE_ARCHIVE = "heritage_archive",
  // Mars Independence
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  // Corporate Interests
  AI_GOVERNANCE = "ai_governance",
  MINING_CONCESSION = "mining_concession",
  LABOR_EFFICIENCY = "labor_efficiency",
}
```

**Step 2: Update Project interface**

```typescript
export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  type: ProjectType;
  proposalCost: ResourceDelta;
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}
```

**Step 3: Update ActiveProject interface**

```typescript
export interface ActiveProject {
  projectId: ProjectId;
  supportLevels: Map<NPCId, number>;
  solsRemaining: number;
}
```

**Step 4: Update FactionDemand interface**

```typescript
export interface FactionDemand {
  factionId: NPCFaction;
  demandedAt: number;
  deadline: number;
  projectIds: ProjectId[];
}
```

**Step 5: Update npcs.ts PROJECTS data**

```typescript
import { NPCId, ProjectId, type NPC, NPCFaction, type Project } from "../models/NPCInfluence";

export const PROJECTS: Project[] = [
  {
    id: ProjectId.GENERATION_SHIP,
    name: "Build Generation Ship",
    description: "Begin construction of an interstellar colony ship.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 100 },
    effects: { unlockBuilding: "shipyard" },
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    name: "Earth Memorial",
    description: "Build a memorial to honor our home planet.",
    type: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 40 },
  },
  // ... continue for all 8 projects
];
```

**Step 6: Update facade/types/npc.ts**

```typescript
import { NPCId, ProjectId, type Council, type NPC, type Project } from "../../core/models/NPCInfluence";

export interface NPCInfluenceSnapshot {
  readonly npcs: readonly Readonly<NPC>[];
  readonly projects: readonly Readonly<Project>[];
  readonly activeProject: Readonly<{
    projectId: ProjectId;
    supportLevels: Readonly<Record<NPCId, number>>;
    solsRemaining: number;
    averageSupport: number;
  }> | null;
  readonly councils: readonly Readonly<Council>[];
  readonly relationshipMatrix: readonly (readonly number[])[];
}

// Re-export core types
export { NPCId, ProjectId };
export type { NPC, Project, Council };
```

**Step 7: Update facade/types/index.ts**

```typescript
// NPC types
export { NPCId, ProjectId } from "./npc";
export type { Council, NPC, NPCInfluenceSnapshot, Project } from "./npc";
```

**Step 8: Run build and tests**

```bash
bun run build && bun test
```

**Step 9: Commit**

```bash
git add src/core/models/NPCInfluence.ts src/core/data/npcs.ts src/facade/types/npc.ts src/facade/types/index.ts
git commit -m "feat: add ProjectId enum for stronger typing"
```

---

## Task 4: Final verification and cleanup

**Step 1: Run full test suite**

```bash
bun test
```

Expected: All 582+ tests pass

**Step 2: Run build**

```bash
bun run build
```

Expected: Build succeeds with no type errors

**Step 3: Run lint**

```bash
bun run check
```

Expected: No lint errors

**Step 4: Verify all enums are exported**

Check that the facade exports all new enums:
- `EventId`
- `NPCId`
- `ProjectId`

**Step 5: Create summary commit (optional)**

If any fixups were needed:

```bash
git add -A
git commit -m "chore: type safety enum cleanup"
```

---

## Parallelization Notes

Tasks 1, 2, and 3 are **independent** and can be executed in parallel by separate subagents:

- **Subagent A:** Task 1 (EventId)
- **Subagent B:** Task 2 (NPCId)
- **Subagent C:** Task 3 (ProjectId)

Task 4 must run after all others complete.

**Important:** Task 2 and Task 3 both modify the same files (`NPCInfluence.ts`, `npcs.ts`, `npc.ts`). If running in parallel, they should be combined into a single task OR run sequentially to avoid merge conflicts.

**Recommended parallel execution:**
- **Subagent A:** Task 1 (EventId) - independent files
- **Subagent B:** Tasks 2+3 combined (NPCId + ProjectId) - shared files
- After both complete: Task 4 verification
