# Research Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable auto-queuing all prerequisites when clicking a locked technology in the research tree.

**Architecture:** Replace single `currentResearch` with a progress map (`researchProgress: Map<string, number>`) and queue (`researchQueue: string[]`). Progress persists across queue changes. The UI displays the queue in the tech details panel with mini progress bars.

**Tech Stack:** TypeScript core logic, Vue 3 + VueFlow for UI, Bun test runner.

---

### Task 1: Add Progress Map and Queue to TechnologyTree

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`

**Step 1: Write failing test for progress map**

Add to `tests/TechnologyTree.test.ts`:

```typescript
describe('Research Queue', () => {
  it('should track progress per tech in a map', () => {
    tree.startResearch('hydroponics', resources);

    // Advance 10 sols
    for (let i = 0; i < 10; i++) {
      tree.tick();
    }

    expect(tree.getResearchProgress('hydroponics')).toBe(10);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL with "tree.getResearchProgress is not a function"

**Step 3: Implement progress map in TechnologyTree**

Replace in `src/core/systems/TechnologyTree.ts`:

```typescript
export class TechnologyTree {
  private technologies: Map<string, Technology> = new Map();
  private researched: Set<string> = new Set();
  private researchProgress: Map<string, number> = new Map();
  private currentResearchId: string | null = null;
  private researchQueue: string[] = [];
  private researchSpeedBonus: number = 0;

  // ... constructor stays the same ...

  getResearchProgress(techId: string): number {
    return this.researchProgress.get(techId) ?? 0;
  }

  getCurrentResearchId(): string | null {
    return this.currentResearchId;
  }

  getResearchQueue(): string[] {
    return [...this.researchQueue];
  }
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): add progress map and queue data structures"
```

---

### Task 2: Update tick() to Use Progress Map

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write failing test for tick with progress map**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should increment progress in the map during tick', () => {
  tree.startResearch('hydroponics', resources);
  tree.tick();
  tree.tick();

  expect(tree.getResearchProgress('hydroponics')).toBe(2);
  expect(tree.getCurrentResearchId()).toBe('hydroponics');
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL (progress is 0 or getCurrentResearchId returns null)

**Step 3: Update tick() to use progress map**

Replace the `tick()` method in `src/core/systems/TechnologyTree.ts`:

```typescript
tick(): GameEvent[] {
  const events: GameEvent[] = [];

  if (this.currentResearchId) {
    const speedMultiplier = 1.0 + this.researchSpeedBonus;
    const currentProgress = this.researchProgress.get(this.currentResearchId) ?? 0;
    const newProgress = currentProgress + speedMultiplier;
    this.researchProgress.set(this.currentResearchId, newProgress);

    const tech = this.technologies.get(this.currentResearchId);
    if (!tech) {
      this.currentResearchId = null;
      return events;
    }

    if (newProgress >= tech.cost.sols) {
      this.researched.add(this.currentResearchId);
      this.researchProgress.delete(this.currentResearchId);

      // Remove from queue front
      if (this.researchQueue.length > 0 && this.researchQueue[0] === this.currentResearchId) {
        this.researchQueue.shift();
      }

      events.push({
        type: "RESEARCH_COMPLETE",
        techId: this.currentResearchId,
        techName: tech.name,
        severity: "info",
        message: `Research complete: ${tech.name}!`,
      });

      this.currentResearchId = null;
    }
  }

  return events;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): update tick() to use progress map"
```

---

### Task 3: Update startResearch() to Use New Model

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for startResearch with queue**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should set currentResearchId and add to queue on startResearch', () => {
  tree.startResearch('hydroponics', resources);

  expect(tree.getCurrentResearchId()).toBe('hydroponics');
  expect(tree.getResearchQueue()).toEqual(['hydroponics']);
});

it('should resume progress if tech was partially researched before', () => {
  tree.startResearch('hydroponics', resources);

  // Advance 10 sols
  for (let i = 0; i < 10; i++) {
    tree.tick();
  }

  // Cancel (simulate changing target)
  tree.cancelResearch();
  expect(tree.getResearchProgress('hydroponics')).toBe(10);

  // Start again - should resume
  tree.startResearch('hydroponics', resources);
  expect(tree.getResearchProgress('hydroponics')).toBe(10);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL

**Step 3: Update startResearch()**

Replace `startResearch()` in `src/core/systems/TechnologyTree.ts`:

```typescript
startResearch(techId: string, resources: ResourceManager): boolean {
  if (!this.canResearch(techId)) return false;
  if (this.currentResearchId) return false;

  const tech = this.technologies.get(techId);
  if (!tech) return false;

  if (tech.cost.resources && !resources.canAfford(tech.cost.resources)) {
    return false;
  }

  if (tech.cost.resources) {
    resources.deduct(tech.cost.resources);
  }

  this.currentResearchId = techId;

  // Add to queue if not already present
  if (!this.researchQueue.includes(techId)) {
    this.researchQueue.push(techId);
  }

  // Initialize progress if not already tracking (preserves existing progress)
  if (!this.researchProgress.has(techId)) {
    this.researchProgress.set(techId, 0);
  }

  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): update startResearch to use queue model"
```

---

### Task 4: Update cancelResearch() to Preserve Progress

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for cancel preserving progress**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should preserve progress when cancelling research', () => {
  tree.startResearch('hydroponics', resources);

  for (let i = 0; i < 20; i++) {
    tree.tick();
  }

  tree.cancelResearch();

  expect(tree.getCurrentResearchId()).toBeNull();
  expect(tree.getResearchProgress('hydroponics')).toBe(20);
  expect(tree.getResearchQueue()).toEqual([]);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL (queue not cleared or progress lost)

**Step 3: Update cancelResearch()**

Replace `cancelResearch()` in `src/core/systems/TechnologyTree.ts`:

```typescript
cancelResearch(): void {
  this.currentResearchId = null;
  this.researchQueue = [];
  // Note: progress is NOT cleared - preserved in researchProgress map
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): cancelResearch preserves progress"
```

---

### Task 5: Implement getPrerequisiteChain()

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for prerequisite chain**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should return prerequisite chain in topological order', () => {
  // generation_ship needs: fusion_drive, cryosleep, closed_ecosystem
  // fusion_drive needs: nuclear_fission, advanced_materials
  // cryosleep needs: advanced_medicine
  // advanced_medicine needs: genetics
  // genetics needs: hydroponics
  // closed_ecosystem needs: hydroponics, water_recycling, genetics
  // nuclear_fission needs: advanced_materials

  const chain = tree.getPrerequisiteChain('generation_ship');

  // Should include all unresearched prerequisites + target
  expect(chain).toContain('generation_ship');
  expect(chain).toContain('fusion_drive');
  expect(chain).toContain('hydroponics');

  // Prerequisites must come before dependents
  expect(chain.indexOf('hydroponics')).toBeLessThan(chain.indexOf('genetics'));
  expect(chain.indexOf('genetics')).toBeLessThan(chain.indexOf('advanced_medicine'));
  expect(chain.indexOf('advanced_materials')).toBeLessThan(chain.indexOf('fusion_drive'));
  expect(chain.indexOf('fusion_drive')).toBeLessThan(chain.indexOf('generation_ship'));
});

it('should exclude already researched techs from chain', () => {
  // Research hydroponics first
  tree.startResearch('hydroponics', resources);
  const tech = tree.getTech('hydroponics')!;
  for (let i = 0; i < tech.cost.sols; i++) {
    tree.tick();
  }

  const chain = tree.getPrerequisiteChain('genetics');

  expect(chain).not.toContain('hydroponics');
  expect(chain).toEqual(['genetics']);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL with "tree.getPrerequisiteChain is not a function"

**Step 3: Implement getPrerequisiteChain()**

Add to `src/core/systems/TechnologyTree.ts`:

```typescript
/**
 * Returns all unresearched prerequisites in topological order,
 * ending with the target tech.
 */
getPrerequisiteChain(techId: string): string[] {
  const tech = this.technologies.get(techId);
  if (!tech) return [];
  if (this.researched.has(techId)) return [];

  const visited = new Set<string>();
  const result: string[] = [];

  const visit = (id: string) => {
    if (visited.has(id)) return;
    if (this.researched.has(id)) return;

    visited.add(id);

    const t = this.technologies.get(id);
    if (!t) return;

    // Visit prerequisites first (topological sort)
    for (const prereq of t.prerequisites) {
      visit(prereq);
    }

    result.push(id);
  };

  visit(techId);
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): implement getPrerequisiteChain with topological sort"
```

---

### Task 6: Implement queueResearch()

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for queueResearch**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should queue all prerequisites when calling queueResearch on locked tech', () => {
  // genetics needs hydroponics
  tree.queueResearch('genetics', resources);

  expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);
  expect(tree.getCurrentResearchId()).toBe('hydroponics');
});

it('should merge queues when changing target', () => {
  // Start with genetics (needs hydroponics)
  tree.queueResearch('genetics', resources);
  expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);

  // Advance hydroponics 10 sols
  for (let i = 0; i < 10; i++) {
    tree.tick();
  }
  expect(tree.getResearchProgress('hydroponics')).toBe(10);

  // Change to advanced_medicine (needs hydroponics, genetics, advanced_medicine)
  tree.queueResearch('advanced_medicine', resources);

  // hydroponics still in queue (shared), genetics still needed, advanced_medicine added
  expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics', 'advanced_medicine']);
  // Progress preserved
  expect(tree.getResearchProgress('hydroponics')).toBe(10);
});

it('should remove techs not in new chain when changing target', () => {
  // Start with robotics (needs advanced_materials)
  tree.queueResearch('robotics', resources);
  expect(tree.getResearchQueue()).toEqual(['advanced_materials', 'robotics']);

  // Change to genetics (needs hydroponics)
  tree.queueResearch('genetics', resources);

  // robotics and advanced_materials removed, new chain used
  expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL with "tree.queueResearch is not a function"

**Step 3: Implement queueResearch()**

Add to `src/core/systems/TechnologyTree.ts`:

```typescript
/**
 * Queue a technology and all its prerequisites.
 * Preserves progress for all techs. Starts researching the first
 * unresearched tech in the chain.
 */
queueResearch(techId: string, resources: ResourceManager): boolean {
  const chain = this.getPrerequisiteChain(techId);
  if (chain.length === 0) return false;

  // Update queue to new chain
  this.researchQueue = chain;

  // Find first unresearched tech in chain to start
  const firstTech = chain[0];

  // If we're not already researching the first tech, switch to it
  if (this.currentResearchId !== firstTech) {
    // Don't clear progress - it's preserved in the map
    this.currentResearchId = null;

    // Start the first tech (will deduct resources if needed)
    const tech = this.technologies.get(firstTech);
    if (tech) {
      // Only deduct resources if not already in progress
      if (!this.researchProgress.has(firstTech)) {
        if (tech.cost.resources) {
          if (!resources.canAfford(tech.cost.resources)) {
            // Can't afford - queue is set but nothing starts yet
            return true;
          }
          resources.deduct(tech.cost.resources);
        }
        this.researchProgress.set(firstTech, 0);
      }
      this.currentResearchId = firstTech;
    }
  }

  return true;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): implement queueResearch with chain merging"
```

---

### Task 7: Auto-Start Next Tech on Completion

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for auto-starting next queued tech**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should auto-start next tech in queue when current completes', () => {
  tree.queueResearch('genetics', resources);
  expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);

  // Complete hydroponics (60 sols)
  const hydroTech = tree.getTech('hydroponics')!;
  for (let i = 0; i < hydroTech.cost.sols; i++) {
    tree.tick();
  }

  expect(tree.isResearched('hydroponics')).toBe(true);
  expect(tree.getCurrentResearchId()).toBe('genetics');
  expect(tree.getResearchQueue()).toEqual(['genetics']);
});

it('should pause queue if resources insufficient for next tech', () => {
  // asteroid_mining costs 200 materials
  // Set up: research advanced_materials and robotics first
  tree.queueResearch('robotics', resources);

  // Complete advanced_materials
  const amTech = tree.getTech('advanced_materials')!;
  for (let i = 0; i < amTech.cost.sols; i++) {
    tree.tick();
  }

  // Complete robotics
  const robTech = tree.getTech('robotics')!;
  for (let i = 0; i < robTech.cost.sols; i++) {
    tree.tick();
  }

  // Now queue asteroid_mining with insufficient resources
  const poorResources = new ResourceManager({
    food: 100, oxygen: 100, water: 100, power: 100, materials: 50
  });

  tree.queueResearch('asteroid_mining', poorResources);

  // Queue is set but nothing is researching (waiting for resources)
  expect(tree.getResearchQueue()).toEqual(['asteroid_mining']);
  expect(tree.getCurrentResearchId()).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL (next tech doesn't auto-start)

**Step 3: Update tick() to auto-start next**

Update the `tick()` method in `src/core/systems/TechnologyTree.ts` to add auto-start logic after completion:

```typescript
tick(resources?: ResourceManager): GameEvent[] {
  const events: GameEvent[] = [];

  if (this.currentResearchId) {
    const speedMultiplier = 1.0 + this.researchSpeedBonus;
    const currentProgress = this.researchProgress.get(this.currentResearchId) ?? 0;
    const newProgress = currentProgress + speedMultiplier;
    this.researchProgress.set(this.currentResearchId, newProgress);

    const tech = this.technologies.get(this.currentResearchId);
    if (!tech) {
      this.currentResearchId = null;
      return events;
    }

    if (newProgress >= tech.cost.sols) {
      this.researched.add(this.currentResearchId);
      this.researchProgress.delete(this.currentResearchId);

      // Remove from queue front
      if (this.researchQueue.length > 0 && this.researchQueue[0] === this.currentResearchId) {
        this.researchQueue.shift();
      }

      events.push({
        type: "RESEARCH_COMPLETE",
        techId: this.currentResearchId,
        techName: tech.name,
        severity: "info",
        message: `Research complete: ${tech.name}!`,
      });

      this.currentResearchId = null;

      // Auto-start next in queue
      this.tryStartNextInQueue(resources);
    }
  } else if (this.researchQueue.length > 0) {
    // Nothing researching but queue exists - try to start
    this.tryStartNextInQueue(resources);
  }

  return events;
}

private tryStartNextInQueue(resources?: ResourceManager): void {
  if (this.researchQueue.length === 0) return;
  if (this.currentResearchId) return;

  const nextTechId = this.researchQueue[0];
  const tech = this.technologies.get(nextTechId);
  if (!tech) return;

  // Check if we can afford it
  if (tech.cost.resources && resources) {
    if (!resources.canAfford(tech.cost.resources)) {
      // Can't afford - stay paused
      return;
    }
    resources.deduct(tech.cost.resources);
  }

  // Initialize progress if needed
  if (!this.researchProgress.has(nextTechId)) {
    this.researchProgress.set(nextTechId, 0);
  }

  this.currentResearchId = nextTechId;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): auto-start next queued tech on completion"
```

---

### Task 8: Update getCurrentResearch() for Backward Compatibility

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for backward-compatible getCurrentResearch**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should return TechResearch object from getCurrentResearch for compatibility', () => {
  tree.startResearch('hydroponics', resources);

  for (let i = 0; i < 10; i++) {
    tree.tick();
  }

  const research = tree.getCurrentResearch();
  expect(research).not.toBeNull();
  expect(research?.techId).toBe('hydroponics');
  expect(research?.progress).toBe(10);
  expect(research?.requiredSols).toBe(60);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL (getCurrentResearch returns wrong format or null)

**Step 3: Update getCurrentResearch()**

Replace `getCurrentResearch()` in `src/core/systems/TechnologyTree.ts`:

```typescript
getCurrentResearch(): TechResearch | null {
  if (!this.currentResearchId) return null;

  const tech = this.technologies.get(this.currentResearchId);
  if (!tech) return null;

  return {
    techId: this.currentResearchId,
    progress: this.researchProgress.get(this.currentResearchId) ?? 0,
    requiredSols: tech.cost.sols,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): backward-compatible getCurrentResearch"
```

---

### Task 9: Update toJSON/fromJSON for Persistence

**Files:**
- Modify: `src/core/systems/TechnologyTree.ts`
- Modify: `tests/TechnologyTree.test.ts`

**Step 1: Write test for serialization**

Add to `tests/TechnologyTree.test.ts`:

```typescript
it('should serialize and restore queue and progress', () => {
  tree.queueResearch('genetics', resources);

  // Advance 15 sols
  for (let i = 0; i < 15; i++) {
    tree.tick();
  }

  const json = tree.toJSON();
  const restored = TechnologyTree.fromJSON(json, TECHNOLOGIES);

  expect(restored.getCurrentResearchId()).toBe('hydroponics');
  expect(restored.getResearchProgress('hydroponics')).toBe(15);
  expect(restored.getResearchQueue()).toEqual(['hydroponics', 'genetics']);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: FAIL

**Step 3: Update toJSON and fromJSON**

Replace in `src/core/systems/TechnologyTree.ts`:

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

static fromJSON(
  data: {
    researched: string[];
    researchProgress?: Record<string, number>;
    currentResearchId?: string | null;
    researchQueue?: string[];
    // Legacy field
    currentResearch?: TechResearch | null;
    researchSpeedBonus: number;
  },
  techs: Technology[],
): TechnologyTree {
  const tree = new TechnologyTree(techs);
  tree.researched = new Set(data.researched);
  tree.researchSpeedBonus = data.researchSpeedBonus || 0;

  // Handle new format
  if (data.researchProgress) {
    tree.researchProgress = new Map(Object.entries(data.researchProgress));
  }
  tree.currentResearchId = data.currentResearchId ?? null;
  tree.researchQueue = data.researchQueue ?? [];

  // Legacy migration: convert old currentResearch to new format
  if (!data.researchProgress && data.currentResearch) {
    tree.currentResearchId = data.currentResearch.techId;
    tree.researchProgress.set(data.currentResearch.techId, data.currentResearch.progress);
    tree.researchQueue = [data.currentResearch.techId];
  }

  return tree;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/TechnologyTree.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/TechnologyTree.ts tests/TechnologyTree.test.ts
git commit -m "feat(tech): serialize queue and progress map"
```

---

### Task 10: Update GameState to Pass Resources to tick()

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Examine current GameState.tick()**

Read `src/core/GameState.ts` to find where technology.tick() is called.

**Step 2: Update technology tick call**

Find the line calling `this.technology.tick()` and update to:

```typescript
events.push(...this.technology.tick(this.resources));
```

**Step 3: Run all tests to verify no regressions**

Run: `bun test`
Expected: All 289+ tests pass

**Step 4: Commit**

```bash
git add src/core/GameState.ts
git commit -m "fix(game): pass resources to technology tick for auto-queue"
```

---

### Task 11: Update TechnologyFacade with Queue Methods

**Files:**
- Modify: `src/facade/domains/TechnologyFacade.ts`

**Step 1: Add queue methods to facade**

Add to `src/facade/domains/TechnologyFacade.ts`:

```typescript
/**
 * Get the current research queue.
 */
getResearchQueue(): readonly string[] {
  return Object.freeze([...this.gameState.technology.getResearchQueue()]);
}

/**
 * Get progress for a specific technology.
 */
getResearchProgress(techId: string): number {
  return this.gameState.technology.getResearchProgress(techId);
}

/**
 * Get prerequisite chain for a technology.
 */
getPrerequisiteChain(techId: string): readonly string[] {
  return Object.freeze([...this.gameState.technology.getPrerequisiteChain(techId)]);
}

/**
 * Queue a technology and all its prerequisites.
 */
queueResearch(techId: string): Result<void> {
  return this.executeCommand(() => {
    const success = this.gameState.technology.queueResearch(techId, this.gameState.resources);

    if (!success) {
      return err({
        type: "INVALID_TARGET",
        target: techId,
        reason: "Cannot queue research",
      });
    }

    return ok(undefined);
  });
}

/**
 * Clear the research queue (preserves progress).
 */
clearQueue(): Result<void> {
  return this.executeCommand(() => {
    this.gameState.technology.cancelResearch();
    return ok(undefined);
  });
}
```

**Step 2: Update snapshot() to include queue**

Update the `snapshot()` method:

```typescript
snapshot(): TechnologySnapshot {
  return {
    all: Object.freeze([...this.gameState.technology.getAllTechs()]),
    available: Object.freeze([...this.gameState.technology.getAvailableTechs()]),
    researched: Object.freeze([...this.gameState.technology.getResearchedTechs()]),
    currentResearch: this.gameState.technology.getCurrentResearch(),
    researchQueue: Object.freeze([...this.gameState.technology.getResearchQueue()]),
  };
}
```

**Step 3: Run tests**

Run: `bun test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/facade/domains/TechnologyFacade.ts
git commit -m "feat(facade): add queue methods to TechnologyFacade"
```

---

### Task 12: Update TechnologySnapshot Type

**Files:**
- Modify: `src/facade/types/index.ts` (or wherever TechnologySnapshot is defined)

**Step 1: Find and update TechnologySnapshot**

Find TechnologySnapshot type definition and add:

```typescript
export interface TechnologySnapshot {
  all: readonly Technology[];
  available: readonly Technology[];
  researched: readonly Technology[];
  currentResearch: TechResearch | null;
  researchQueue: readonly string[];
}
```

**Step 2: Run tests**

Run: `bun test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/facade/types/index.ts
git commit -m "feat(types): add researchQueue to TechnologySnapshot"
```

---

### Task 13: Update GameUIState and syncState

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Add researchQueue to GameUIState**

Update interface:

```typescript
interface GameUIState {
  // ... existing fields ...
  currentResearch: TechResearch | null;
  researchQueue: string[];
  // ... rest of fields ...
}
```

**Step 2: Update createInitialState()**

Add to initial state:

```typescript
researchQueue: [],
```

**Step 3: Update syncState()**

Add after currentResearch sync:

```typescript
this.state.researchQueue = [...techs.researchQueue];
```

**Step 4: Run tests**

Run: `bun test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat(ui): add researchQueue to GameUIState"
```

---

### Task 14: Add Queue Display to TechTreeGraph.vue

**Files:**
- Modify: `src/renderer/components/TechTreeGraph.vue`

**Step 1: Add computed for queue with progress**

Add after existing computed properties:

```typescript
const queueWithProgress = computed(() => {
  return state.researchQueue.map((techId, index) => {
    const tech = state.technologies.find(t => t.id === techId);
    if (!tech) return null;

    const progress = gameService.api.technology.getResearchProgress(techId);
    const isActive = index === 0 && state.currentResearch?.techId === techId;

    return {
      tech,
      progress,
      percentage: (progress / tech.cost.sols) * 100,
      isActive,
    };
  }).filter(Boolean);
});
```

**Step 2: Add queueResearch function**

```typescript
function queueAllPrerequisites() {
  if (selectedTech.value) {
    gameService.api.technology.queueResearch(selectedTech.value.id);
  }
}

function clearQueue() {
  gameService.api.technology.clearQueue();
}

function isInQueue(techId: string): boolean {
  return state.researchQueue.includes(techId);
}
```

**Step 3: Update template actions section**

Replace the actions div with:

```vue
<div class="actions">
  <GButton
    v-if="canResearch(selectedTech.id)"
    variant="primary"
    class="full-width"
    @click="startResearch"
  >
    Start Research
  </GButton>
  <GButton
    v-else-if="getTechStatus(selectedTech) === 'locked' && !isInQueue(selectedTech.id)"
    variant="primary"
    class="full-width"
    @click="queueAllPrerequisites"
  >
    Queue All Prerequisites
  </GButton>
  <GButton
    v-else-if="state.currentResearch?.techId === selectedTech.id"
    variant="danger"
    class="full-width"
    @click="cancelResearch"
  >
    Cancel Research
  </GButton>
  <GBadge
    v-else-if="isInQueue(selectedTech.id)"
    variant="info"
    class="status-badge-centered"
  >
    In Queue
  </GBadge>
  <GBadge
    v-else-if="state.researchedTechs.some((t) => t.id === selectedTech.id)"
    variant="positive"
    class="status-badge-centered"
  >
    Researched
  </GBadge>
  <GBadge v-else variant="muted" class="status-badge-centered">
    Locked
  </GBadge>
</div>
```

**Step 4: Add queue display section after actions**

```vue
<div v-if="queueWithProgress.length > 0" class="queue-section">
  <h4>Research Queue</h4>
  <div class="queue-list">
    <div
      v-for="(item, index) in queueWithProgress"
      :key="item.tech.id"
      class="queue-item"
      :class="{ active: item.isActive }"
    >
      <span class="queue-index">{{ index + 1 }}.</span>
      <span class="queue-name">{{ item.tech.name }}</span>
      <div class="queue-progress-bar">
        <div
          class="queue-progress-fill"
          :style="{ width: `${item.percentage}%` }"
        />
      </div>
    </div>
  </div>
  <GButton
    variant="ghost"
    size="sm"
    class="full-width"
    @click="clearQueue"
  >
    Clear Queue
  </GButton>
</div>
```

**Step 5: Commit (no test - manual verification)**

```bash
git add src/renderer/components/TechTreeGraph.vue
git commit -m "feat(ui): add queue display to tech tree"
```

---

### Task 15: Add Queue Styles

**Files:**
- Modify: `src/renderer/components/TechTreeGraph.vue`

**Step 1: Add CSS for queue section**

Add to `<style scoped>`:

```css
.queue-section {
  margin-top: var(--g-space-md);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.queue-section h4 {
  margin: 0 0 var(--g-space-sm) 0;
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  font-weight: normal;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-sm);
}

.queue-item {
  display: grid;
  grid-template-columns: 24px 1fr 60px;
  gap: var(--g-space-xs);
  align-items: center;
  font-size: var(--g-font-size-xs);
  padding: var(--g-space-xs);
  border-radius: 3px;
  background: var(--g-color-bg);
}

.queue-item.active {
  background: oklch(65% 0.15 250 / 0.1);
  border: 1px solid oklch(65% 0.15 250 / 0.3);
}

.queue-index {
  color: var(--g-color-text-muted);
  text-align: right;
}

.queue-name {
  color: var(--g-color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-progress-bar {
  height: 4px;
  background: var(--g-color-bg-elevated);
  border-radius: 2px;
  overflow: hidden;
}

.queue-progress-fill {
  height: 100%;
  background: var(--g-color-info);
  transition: width 0.3s ease;
}
```

**Step 2: Commit**

```bash
git add src/renderer/components/TechTreeGraph.vue
git commit -m "style(ui): add queue section styling"
```

---

### Task 16: Run Full Test Suite and Manual Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass

**Step 2: Run dev server and manually test**

Run: `bun run dev`

Manual verification checklist:
- [ ] Click locked tech → "Queue All Prerequisites" button appears
- [ ] Click button → queue populates with prerequisite chain
- [ ] Queue shows in details panel with progress bars
- [ ] First tech starts researching automatically
- [ ] When first tech completes, second auto-starts
- [ ] Clicking different locked tech → queue updates, progress preserved
- [ ] "Clear Queue" clears queue but preserves tech progress
- [ ] Progress bars update each sol

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address manual testing issues"
```

---

### Task 17: Run Lint and Format

**Step 1: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 2: Run formatter**

Run: `bun run format`

**Step 3: Commit if changes**

```bash
git add -A
git commit -m "style: format code"
```
