# Research Queue Auto-Prerequisite Design

## Overview

When clicking a locked technology in the research tree, automatically queue all required prerequisites and display the queue in the details panel.

## Core Changes

### Data Model (`TechnologyTree.ts`)

Replace single-research tracking with multi-tech progress model:

```typescript
// Before
currentResearch: TechResearch | null  // { techId, progress, requiredSols }

// After
researchProgress: Map<string, number>  // techId → sols completed
currentResearchId: string | null       // which tech is actively progressing
researchQueue: string[]                // ordered queue of tech IDs
```

### New Methods

- `getPrerequisiteChain(techId: string): string[]` - Returns all unresearched prerequisites in topological order (dependencies first), ending with the target tech
- `queueResearch(techId: string): void` - Computes prerequisite chain and sets/updates the queue
- `clearQueue(): void` - Empties the queue (preserves progress)
- `getResearchProgress(techId: string): number` - Returns sols completed for a tech

### Queue Change Behavior

When user clicks a new target tech:

1. Compute the new prerequisite chain for the target
2. Keep techs from current queue that are also in new chain
3. Remove techs not needed for new target
4. Current research switches to first item in new queue
5. All progress is preserved in the map (never lost)

**Example:**
- Current queue: `[A, B, C, D]` (A is 50% done)
- User clicks E, which needs `[A, B, E]`
- A and B are in both chains → kept
- C is not in new chain → removed
- Result: `[A, B, E]`, A continues at 50%

**Example - current research not in new chain:**
- Current queue: `[X, Y, Z]` (X is 50% done)
- User clicks E, which needs `[A, B, E]`
- X progress (50%) preserved in map for later
- New queue: `[A, B, E]`, A starts (or resumes if has prior progress)

### Tick Behavior

1. If `currentResearchId` is set, increment its progress in the map
2. When tech completes: remove from map, add to `researched`, remove from queue front
3. If queue non-empty, start next tech (if resources available)
4. If insufficient resources, queue pauses (not cleared)

### Resource Handling

- Resources deducted when each tech **starts**, not when queued
- If insufficient resources when auto-starting next tech, queue pauses
- Auto-starts on next tick when resources become available

## UI Changes (`TechTreeGraph.vue`)

### Queue Display

Add queue section to details panel below selected tech info:

```
┌─────────────────────────────┐
│ Fusion Drive            [x] │  ← selected tech header
│ Enables interstellar travel │  ← description
│ Cost: 50 sols               │
│ Unlocks: generation_ship    │
├─────────────────────────────┤
│ [Queue All Prerequisites]   │  ← button (if locked)
├─────────────────────────────┤
│ Research Queue              │  ← section header
│ 1. Advanced Materials  ████░│  ← 80% progress
│ 2. Nuclear Fission     ░░░░░│  ← 0%, waiting
│ 3. Fusion Drive        ░░░░░│  ← target
│                             │
│ [Clear Queue]               │
└─────────────────────────────┘
```

### Button Logic by Tech State

| State | Button |
|-------|--------|
| Locked | "Queue All Prerequisites" |
| Available (no current research) | "Start Research" |
| Available (has current research) | "Queue" (adds to end) |
| Already in queue | "In Queue" badge (disabled) |
| Already researched | "Researched" badge |

### Interactions

- Each queue item shows mini progress bar
- Current research (first item) is highlighted
- "Clear Queue" clears queue but preserves all progress

## Serialization

Update `toJSON`/`fromJSON` in `TechnologyTree.ts`:

```typescript
toJSON() {
  return {
    researched: Array.from(this.researched),
    researchProgress: Object.fromEntries(this.researchProgress),
    currentResearchId: this.currentResearchId,
    researchQueue: this.researchQueue,
    researchSpeedBonus: this.researchSpeedBonus,
  };
}
```

## Files to Modify

1. `src/core/systems/TechnologyTree.ts` - Core queue logic and progress model
2. `src/core/models/Technology.ts` - Update `TechResearch` type if needed
3. `src/renderer/components/TechTreeGraph.vue` - Queue display and interactions
4. `src/renderer/services/GameService.ts` - Expose queue methods to UI
