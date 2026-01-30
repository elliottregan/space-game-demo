# Colonist Graph Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the per-render force layout calculation with a persistent D3 simulation that maintains positions between updates and animates smoothly.

**Architecture:** Create a `ColonistSimulationManager` class that owns the D3 force simulation, stores positions, and exposes reactive state. The Vue component becomes a thin wrapper that passes data in and reads positions out.

**Tech Stack:** D3-force (already installed), Vue 3 reactivity (ref/shallowRef), requestAnimationFrame for render loop.

---

## Task 1: Create ColonistSimulationManager with Basic Structure

**Files:**
- Create: `src/renderer/utils/ColonistSimulationManager.ts`
- Test: `tests/ColonistSimulationManager.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/ColonistSimulationManager.test.ts
import { describe, expect, it } from "bun:test";
import { ColonistSimulationManager } from "../src/renderer/utils/ColonistSimulationManager";
import { ColonistRole, type Colonist } from "../src/core/models/Colonist";

function makeColonist(id: string, name: string, role = ColonistRole.UNASSIGNED): Colonist {
  return {
    id,
    name,
    role,
    skills: { research: 0.5, engineering: 0.5, farming: 0.5, civilScience: 0.5 },
    morale: 100,
    health: 100,
    age: 30,
    isC%.cohort: false,
  };
}

describe("ColonistSimulationManager", () => {
  it("initializes with empty state", () => {
    const manager = new ColonistSimulationManager(600, 400);
    expect(manager.getPositions()).toEqual([]);
    manager.destroy();
  });

  it("updates with colonists and returns positions", () => {
    const manager = new ColonistSimulationManager(600, 400);
    const colonists = [
      makeColonist("c1", "Alice Smith", ColonistRole.RESEARCH),
      makeColonist("c2", "Bob Jones", ColonistRole.ENGINEERING),
    ];
    const relationships = new Map<string, number>();

    manager.update(colonists, relationships);

    const positions = manager.getPositions();
    expect(positions.length).toBe(2);
    expect(positions.find(p => p.id === "c1")).toBeDefined();
    expect(positions.find(p => p.id === "c2")).toBeDefined();

    manager.destroy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/renderer/utils/ColonistSimulationManager.ts
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { type Colonist, ColonistRole } from "../../core/models/Colonist";

export interface PositionedColonist {
  id: string;
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  role: ColonistRole;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
}

export class ColonistSimulationManager {
  private simulation: Simulation<SimNode, SimLink> | null = null;
  private nodes: SimNode[] = [];
  private links: SimLink[] = [];
  private width: number;
  private height: number;
  private positions: Map<string, { x: number; y: number }> = new Map();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  update(colonists: Colonist[], relationships: Map<string, number>): void {
    // Create nodes
    this.nodes = colonists.map((c) => ({
      id: c.id,
      role: c.role,
      x: this.positions.get(c.id)?.x ?? this.width / 2,
      y: this.positions.get(c.id)?.y ?? this.height / 2,
    }));

    // Create links
    const nodeById = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = [];
    for (const [key, weight] of relationships) {
      if (weight < 0.05) continue;
      const [id1, id2] = key.split(":");
      if (nodeById.has(id1!) && nodeById.has(id2!)) {
        this.links.push({ source: id1!, target: id2!, weight });
      }
    }

    // Create or update simulation
    this.initSimulation();

    // Run simulation synchronously for initial positions
    this.simulation?.tick(100);

    // Store positions
    for (const node of this.nodes) {
      this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    }
  }

  private initSimulation(): void {
    this.simulation?.stop();

    this.simulation = forceSimulation(this.nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(this.links)
          .id((d) => d.id)
          .distance((link) => 220 - link.weight * 160)
          .strength((link) => 0.1 + link.weight * 0.3)
      )
      .force("charge", forceManyBody().strength(-500).distanceMax(300))
      .force("center", forceCenter(this.width / 2, this.height / 2))
      .force("collide", forceCollide(50).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.4);
  }

  getPositions(): PositionedColonist[] {
    const padding = 40;
    return this.nodes.map((node) => ({
      id: node.id,
      x: Math.max(padding, Math.min(this.width - padding, node.x ?? this.width / 2)),
      y: Math.max(padding, Math.min(this.height - padding, node.y ?? this.height / 2)),
    }));
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.simulation) {
      this.simulation.force("center", forceCenter(width / 2, height / 2));
    }
  }

  destroy(): void {
    this.simulation?.stop();
    this.simulation = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/utils/ColonistSimulationManager.ts tests/ColonistSimulationManager.test.ts
git commit -m "feat: add ColonistSimulationManager with basic structure"
```

---

## Task 2: Add Position Persistence and Incremental Updates

**Files:**
- Modify: `src/renderer/utils/ColonistSimulationManager.ts`
- Modify: `tests/ColonistSimulationManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/ColonistSimulationManager.test.ts`:

```typescript
it("preserves positions between updates", () => {
  const manager = new ColonistSimulationManager(600, 400);
  const colonists = [
    makeColonist("c1", "Alice Smith", ColonistRole.RESEARCH),
    makeColonist("c2", "Bob Jones", ColonistRole.ENGINEERING),
  ];
  const relationships = new Map<string, number>();

  // First update
  manager.update(colonists, relationships);
  const firstPositions = manager.getPositions();
  const c1First = firstPositions.find(p => p.id === "c1")!;

  // Second update with same data - positions should be similar
  manager.update(colonists, relationships);
  const secondPositions = manager.getPositions();
  const c1Second = secondPositions.find(p => p.id === "c1")!;

  // Positions should be close (within 50px) since simulation warms from previous
  const distance = Math.sqrt(
    Math.pow(c1First.x - c1Second.x, 2) + Math.pow(c1First.y - c1Second.y, 2)
  );
  expect(distance).toBeLessThan(50);

  manager.destroy();
});

it("adds new colonists near existing relationships", () => {
  const manager = new ColonistSimulationManager(600, 400);

  // Start with one colonist
  const colonists1 = [makeColonist("c1", "Alice Smith")];
  manager.update(colonists1, new Map());
  const pos1 = manager.getPositions().find(p => p.id === "c1")!;

  // Add second colonist with strong relationship to first
  const colonists2 = [
    makeColonist("c1", "Alice Smith"),
    makeColonist("c2", "Bob Jones"),
  ];
  const relationships = new Map([["c1:c2", 0.8]]);
  manager.update(colonists2, relationships);

  const positions = manager.getPositions();
  const c1 = positions.find(p => p.id === "c1")!;
  const c2 = positions.find(p => p.id === "c2")!;

  // New colonist should be placed near the related colonist
  const distance = Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
  expect(distance).toBeLessThan(200); // Strong relationship = close

  manager.destroy();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: Likely passes already due to basic implementation, but verifies behavior

**Step 3: Enhance implementation for better position handling**

Update `ColonistSimulationManager.ts` - modify the `update` method:

```typescript
update(colonists: Colonist[], relationships: Map<string, number>): void {
  const existingIds = new Set(this.nodes.map((n) => n.id));
  const newIds = new Set(colonists.map((c) => c.id));

  // Find new colonists
  const addedColonists = colonists.filter((c) => !existingIds.has(c.id));

  // Create nodes, preserving existing positions
  this.nodes = colonists.map((c) => {
    const existing = this.positions.get(c.id);
    if (existing) {
      return { id: c.id, role: c.role, x: existing.x, y: existing.y };
    }

    // New colonist - find strongest relationship to position near
    let spawnX = this.width / 2;
    let spawnY = this.height / 2;
    let strongestWeight = 0;

    for (const [key, weight] of relationships) {
      const [id1, id2] = key.split(":");
      const otherId = id1 === c.id ? id2 : id2 === c.id ? id1 : null;
      if (otherId && weight > strongestWeight) {
        const otherPos = this.positions.get(otherId);
        if (otherPos) {
          strongestWeight = weight;
          // Spawn near the related colonist with small offset
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 20;
          spawnX = otherPos.x + Math.cos(angle) * dist;
          spawnY = otherPos.y + Math.sin(angle) * dist;
        }
      }
    }

    return { id: c.id, role: c.role, x: spawnX, y: spawnY };
  });

  // Remove positions for departed colonists
  for (const id of this.positions.keys()) {
    if (!newIds.has(id)) {
      this.positions.delete(id);
    }
  }

  // Create links
  const nodeById = new Map(this.nodes.map((n) => [n.id, n]));
  this.links = [];
  for (const [key, weight] of relationships) {
    if (weight < 0.05) continue;
    const [id1, id2] = key.split(":");
    if (nodeById.has(id1!) && nodeById.has(id2!)) {
      this.links.push({ source: id1!, target: id2!, weight });
    }
  }

  // Create or update simulation
  this.initSimulation();

  // Run simulation - fewer ticks if just warming from existing positions
  const ticks = addedColonists.length > 0 ? 100 : 50;
  this.simulation?.tick(ticks);

  // Store positions
  for (const node of this.nodes) {
    this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/utils/ColonistSimulationManager.ts tests/ColonistSimulationManager.test.ts
git commit -m "feat: add position persistence and incremental updates"
```

---

## Task 3: Add Animation Loop with requestAnimationFrame

**Files:**
- Modify: `src/renderer/utils/ColonistSimulationManager.ts`
- Modify: `tests/ColonistSimulationManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/ColonistSimulationManager.test.ts`:

```typescript
it("calls onTick callback during animation", async () => {
  const manager = new ColonistSimulationManager(600, 400);
  const colonists = [
    makeColonist("c1", "Alice Smith"),
    makeColonist("c2", "Bob Jones"),
  ];
  const relationships = new Map([["c1:c2", 0.5]]);

  let tickCount = 0;
  manager.setOnTick(() => {
    tickCount++;
  });

  manager.update(colonists, relationships);
  manager.startAnimation();

  // Wait for some animation frames
  await new Promise((resolve) => setTimeout(resolve, 100));

  manager.stopAnimation();
  expect(tickCount).toBeGreaterThan(0);

  manager.destroy();
});

it("stops animation when alpha is low", async () => {
  const manager = new ColonistSimulationManager(600, 400);
  const colonists = [makeColonist("c1", "Alice Smith")];

  manager.update(colonists, new Map());
  manager.startAnimation();

  // Animation should auto-stop when settled
  await new Promise((resolve) => setTimeout(resolve, 500));

  expect(manager.isAnimating()).toBe(false);

  manager.destroy();
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: FAIL with "setOnTick is not a function"

**Step 3: Add animation loop**

Update `ColonistSimulationManager.ts`:

```typescript
export class ColonistSimulationManager {
  private simulation: Simulation<SimNode, SimLink> | null = null;
  private nodes: SimNode[] = [];
  private links: SimLink[] = [];
  private width: number;
  private height: number;
  private positions: Map<string, { x: number; y: number }> = new Map();
  private animationFrame: number | null = null;
  private onTickCallback: (() => void) | null = null;
  private _isAnimating = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setOnTick(callback: (() => void) | null): void {
    this.onTickCallback = callback;
  }

  isAnimating(): boolean {
    return this._isAnimating;
  }

  startAnimation(): void {
    if (this._isAnimating || !this.simulation) return;
    this._isAnimating = true;
    this.animate();
  }

  stopAnimation(): void {
    this._isAnimating = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private animate = (): void => {
    if (!this._isAnimating || !this.simulation) return;

    this.simulation.tick(1);

    // Update stored positions
    for (const node of this.nodes) {
      this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    }

    // Notify listener
    this.onTickCallback?.();

    // Check if settled
    if (this.simulation.alpha() < 0.001) {
      this.stopAnimation();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.animate);
  };

  // ... rest of existing methods, but modify update to not run sync ticks when animating:

  update(colonists: Colonist[], relationships: Map<string, number>): void {
    const existingIds = new Set(this.nodes.map((n) => n.id));
    const newIds = new Set(colonists.map((c) => c.id));
    const addedColonists = colonists.filter((c) => !existingIds.has(c.id));

    // Create nodes, preserving existing positions
    this.nodes = colonists.map((c) => {
      const existing = this.positions.get(c.id);
      if (existing) {
        return { id: c.id, role: c.role, x: existing.x, y: existing.y };
      }

      // New colonist - find strongest relationship to position near
      let spawnX = this.width / 2;
      let spawnY = this.height / 2;
      let strongestWeight = 0;

      for (const [key, weight] of relationships) {
        const [id1, id2] = key.split(":");
        const otherId = id1 === c.id ? id2 : id2 === c.id ? id1 : null;
        if (otherId && weight > strongestWeight) {
          const otherPos = this.positions.get(otherId);
          if (otherPos) {
            strongestWeight = weight;
            const angle = Math.random() * Math.PI * 2;
            const dist = 30 + Math.random() * 20;
            spawnX = otherPos.x + Math.cos(angle) * dist;
            spawnY = otherPos.y + Math.sin(angle) * dist;
          }
        }
      }

      return { id: c.id, role: c.role, x: spawnX, y: spawnY };
    });

    // Remove positions for departed colonists
    for (const id of this.positions.keys()) {
      if (!newIds.has(id)) {
        this.positions.delete(id);
      }
    }

    // Create links
    const nodeById = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = [];
    for (const [key, weight] of relationships) {
      if (weight < 0.05) continue;
      const [id1, id2] = key.split(":");
      if (nodeById.has(id1!) && nodeById.has(id2!)) {
        this.links.push({ source: id1!, target: id2!, weight });
      }
    }

    // Initialize simulation
    this.initSimulation();

    // Warm up alpha for animation
    const hasChanges = addedColonists.length > 0 || this.links.length !== this.links.length;
    if (hasChanges) {
      this.simulation?.alpha(0.3);
    } else {
      this.simulation?.alpha(0.1);
    }

    // If not animating, run synchronously
    if (!this._isAnimating) {
      const ticks = addedColonists.length > 0 ? 100 : 50;
      this.simulation?.tick(ticks);

      for (const node of this.nodes) {
        this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
      }
    }
  }

  destroy(): void {
    this.stopAnimation();
    this.simulation?.stop();
    this.simulation = null;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/renderer/utils/ColonistSimulationManager.ts tests/ColonistSimulationManager.test.ts
git commit -m "feat: add animation loop with requestAnimationFrame"
```

---

## Task 4: Integrate Manager into ColonistGraph.vue

**Files:**
- Modify: `src/renderer/components/ColonistGraph/ColonistGraph.vue`

**Step 1: Read current implementation (for context)**

The current `ColonistGraph.vue` uses `computeColonistForceLayout` computed property. We need to replace it with the manager.

**Step 2: Update the Vue component**

Replace the layout-related code in `ColonistGraph.vue`:

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import type { Colonist } from "../../../core/models/Colonist";
import type { Guild } from "../../../core/models/Guild";
import { WEAK_TIE_THRESHOLD } from "../../../core/balance/WorkforceBalance";
import type { CoworkerRelationship } from "../../../core/systems/WorkforceManager";
import { ColonistSimulationManager } from "../../utils/ColonistSimulationManager";
import {
  type ColonistGraphData,
  type ColonistGraphLink,
  type ColonistGraphNode,
  type RelationshipType,
  renderColonistGraph,
} from "./renderColonistGraph";

interface BuildingInfo {
  id: string;
  name: string;
  active: boolean;
  assignedWorkers: string[];
}

interface Props {
  colonists: Colonist[];
  relationships: Map<string, CoworkerRelationship>;
  buildings: BuildingInfo[];
  guilds: Guild[];
  selectedColonistId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [colonistId: string | null];
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);

// Reactive dimensions from container
const dimensions = ref({ width: 600, height: 400 });

// Simulation manager
let simulationManager: ColonistSimulationManager | null = null;

// Reactive positions from simulation
const layoutPositions = ref<{ id: string; x: number; y: number }[]>([]);

function updateDimensions() {
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    dimensions.value = {
      width: Math.max(200, rect.width),
      height: Math.max(200, rect.height),
    };
    simulationManager?.resize(dimensions.value.width, dimensions.value.height);
  }
}

// Build relationship map for layout (just strengths)
const relationshipStrengths = computed(() => {
  const map = new Map<string, number>();
  for (const [key, rel] of props.relationships) {
    map.set(key, rel.strength);
  }
  return map;
});

// Update simulation when data changes
function updateSimulation() {
  if (!simulationManager) return;

  simulationManager.update(props.colonists, relationshipStrengths.value);
  layoutPositions.value = simulationManager.getPositions();

  // Start animation for smooth transitions
  simulationManager.startAnimation();
}

// Build coworker pairs from buildings
const coworkerPairs = computed(() => {
  const pairs = new Set<string>();
  for (const building of props.buildings) {
    if (!building.active || building.assignedWorkers.length < 2) continue;
    const workers = building.assignedWorkers;
    for (let i = 0; i < workers.length; i++) {
      for (let j = i + 1; j < workers.length; j++) {
        const key = [workers[i], workers[j]].sort().join(":");
        pairs.add(key);
      }
    }
  }
  return pairs;
});

// Build housemate pairs from colonist housing
const housematePairs = computed(() => {
  const pairs = new Set<string>();
  const housingGroups = new Map<string, string[]>();

  for (const colonist of props.colonists) {
    if (colonist.housingId) {
      const group = housingGroups.get(colonist.housingId) || [];
      group.push(colonist.id);
      housingGroups.set(colonist.housingId, group);
    }
  }

  for (const [, members] of housingGroups) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const key = [members[i], members[j]].sort().join(":");
        pairs.add(key);
      }
    }
  }
  return pairs;
});

// Get building info for a colonist
function getColonistBuilding(colonistId: string): { name: string; active: boolean } | null {
  for (const building of props.buildings) {
    if (building.assignedWorkers.includes(colonistId)) {
      return { name: building.name, active: building.active };
    }
  }
  return null;
}

// Count connections per colonist
const connectionCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const colonist of props.colonists) {
    counts.set(colonist.id, 0);
  }
  for (const [key, rel] of props.relationships) {
    if (rel.strength < 0.05) continue;
    const [id1, id2] = key.split(":");
    if (id1) counts.set(id1, (counts.get(id1) ?? 0) + 1);
    if (id2) counts.set(id2, (counts.get(id2) ?? 0) + 1);
  }
  return counts;
});

// Detect bridge colonists (connect otherwise disconnected groups using weak ties)
const bridgeColonists = computed(() => {
  const bridges = new Set<string>();

  for (const [key, rel] of props.relationships) {
    if (rel.strength >= WEAK_TIE_THRESHOLD) continue;
    if (rel.strength < 0.05) continue;

    const [id1, id2] = key.split(":");
    if (!id1 || !id2) continue;

    const id1Connections = new Set<string>();
    const id2Connections = new Set<string>();

    for (const [otherKey, otherRel] of props.relationships) {
      if (otherRel.strength < WEAK_TIE_THRESHOLD) continue;
      const [a, b] = otherKey.split(":");
      if (a === id1) id1Connections.add(b!);
      if (b === id1) id1Connections.add(a!);
      if (a === id2) id2Connections.add(b!);
      if (b === id2) id2Connections.add(a!);
    }

    const overlap = [...id1Connections].filter((c) => id2Connections.has(c));
    if (overlap.length === 0) {
      bridges.add(id1);
      bridges.add(id2);
    }
  }

  return bridges;
});

// Build guild membership lookup
const guildMembership = computed(() => {
  const membership = new Map<string, string[]>();
  for (const colonist of props.colonists) {
    membership.set(colonist.id, []);
  }
  for (const guild of props.guilds) {
    for (const memberId of guild.memberIds) {
      const guilds = membership.get(memberId) ?? [];
      guilds.push(guild.id);
      membership.set(memberId, guilds);
    }
  }
  return membership;
});

// Check if two colonists share a guild
function getSharedGuildIds(id1: string, id2: string): string[] {
  const guilds1 = guildMembership.value.get(id1) ?? [];
  const guilds2 = guildMembership.value.get(id2) ?? [];
  return guilds1.filter((g) => guilds2.includes(g));
}

// Build graph data for rendering
const graphData = computed<ColonistGraphData>(() => {
  const positionMap = new Map(layoutPositions.value.map((p) => [p.id, p]));

  const nodes: ColonistGraphNode[] = props.colonists.map((colonist) => {
    const pos = positionMap.get(colonist.id) ?? { x: 0, y: 0 };
    const buildingInfo = getColonistBuilding(colonist.id);
    const guildCount = guildMembership.value.get(colonist.id)?.length ?? 0;

    return {
      id: colonist.id,
      x: pos.x,
      y: pos.y,
      colonist,
      isWorking: buildingInfo?.active ?? false,
      buildingName: buildingInfo?.name,
      guildCount,
      isBridge: bridgeColonists.value.has(colonist.id),
      connectionCount: connectionCounts.value.get(colonist.id) ?? 0,
    };
  });

  const links: ColonistGraphLink[] = [];

  for (const [key, rel] of props.relationships) {
    if (rel.strength < 0.05) continue;

    const [id1, id2] = key.split(":");
    if (!id1 || !id2) continue;

    const isCoworker = coworkerPairs.value.has(key);
    const isHousemate = housematePairs.value.has(key);
    const sharedGuilds = getSharedGuildIds(id1, id2);
    const hasSharedGuild = sharedGuilds.length > 0;
    const isWeakTie = rel.strength < WEAK_TIE_THRESHOLD;
    const isCohort = rel.isCohort ?? false;

    let type: RelationshipType;
    if (isCoworker && isHousemate) {
      type = "both";
    } else if (isHousemate) {
      type = "housemate";
    } else if (isCoworker) {
      type = "coworker";
    } else if (hasSharedGuild) {
      type = "guild";
    } else {
      type = "social";
    }

    links.push({
      source: id1,
      target: id2,
      weight: rel.strength,
      type,
      isWeakTie,
      isCohort,
      hasSharedGuild,
    });
  }

  return { nodes, links };
});

// Render when data changes
function render() {
  if (!svgRef.value) return;

  renderColonistGraph(svgRef.value, graphData.value, {
    width: dimensions.value.width,
    height: dimensions.value.height,
    selectedId: props.selectedColonistId,
    onNodeClick: (id) => emit("select", id),
  });
}

// ResizeObserver to track container size changes
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  updateDimensions();

  // Create simulation manager
  simulationManager = new ColonistSimulationManager(
    dimensions.value.width,
    dimensions.value.height
  );

  // Set up tick callback for animation
  simulationManager.setOnTick(() => {
    layoutPositions.value = simulationManager!.getPositions();
  });

  // Initial update
  updateSimulation();
  render();

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateDimensions();
      render();
    });
    resizeObserver.observe(containerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  simulationManager?.destroy();
  simulationManager = null;
});

// Watch for data changes
watch([() => props.colonists, relationshipStrengths], updateSimulation, { deep: true });
watch([graphData, () => props.selectedColonistId], render);
watch(dimensions, render);
</script>
```

**Step 3: Run the dev server to verify visually**

Run: `bun run dev`
Open browser, navigate to colony view, verify graph renders and animates.

**Step 4: Run tests to verify no regressions**

Run: `bun test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/renderer/components/ColonistGraph/ColonistGraph.vue
git commit -m "feat: integrate ColonistSimulationManager into ColonistGraph"
```

---

## Task 5: Delete Old colonistForceLayout.ts

**Files:**
- Delete: `src/renderer/utils/colonistForceLayout.ts`
- Modify: `src/renderer/components/ColonistGraph/renderColonistGraph.ts` (update import)

**Step 1: Update renderColonistGraph.ts import**

Change the import from:
```typescript
import type { PositionedColonist } from "../../utils/colonistForceLayout";
```

To:
```typescript
import type { PositionedColonist } from "../../utils/ColonistSimulationManager";
```

**Step 2: Delete the old file**

```bash
rm src/renderer/utils/colonistForceLayout.ts
```

**Step 3: Run tests to verify**

Run: `bun test`
Expected: All tests pass (forceLayout.test.ts may need updating or removal if it tests the old file)

**Step 4: Update or remove old test file if needed**

Check if `tests/forceLayout.test.ts` tests the deleted file. If so, remove it since `ColonistSimulationManager.test.ts` covers the functionality.

```bash
rm tests/forceLayout.test.ts  # if it exists and tests old code
```

**Step 5: Run tests again**

Run: `bun test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove old colonistForceLayout in favor of ColonistSimulationManager"
```

---

## Task 6: Add Tab Visibility Handling

**Files:**
- Modify: `src/renderer/utils/ColonistSimulationManager.ts`

**Step 1: Add visibility handling to stop animation when tab is hidden**

Add to `ColonistSimulationManager.ts`:

```typescript
export class ColonistSimulationManager {
  // ... existing fields
  private visibilityHandler: (() => void) | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Pause animation when tab is hidden
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopAnimation();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
  }

  destroy(): void {
    this.stopAnimation();
    this.simulation?.stop();
    this.simulation = null;

    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
  }
}
```

**Step 2: Run tests**

Run: `bun test tests/ColonistSimulationManager.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/renderer/utils/ColonistSimulationManager.ts
git commit -m "perf: pause animation when tab is hidden"
```

---

## Task 7: Final Testing and Cleanup

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 2: Run linter**

Run: `bun run lint`
Expected: No errors

**Step 3: Run formatter**

Run: `bun run format`

**Step 4: Visual testing**

Run: `bun run dev`
- Open browser to colony view
- Verify graph renders
- Advance time (sols) and verify nodes animate smoothly instead of jumping
- Verify strong relationships cluster together
- Verify weak ties stretch across graph
- Verify new colonists animate into position

**Step 5: Final commit if any formatting changes**

```bash
git add -A
git commit -m "style: format code"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create ColonistSimulationManager | New manager + tests |
| 2 | Position persistence | Manager updates |
| 3 | Animation loop | Manager + tests |
| 4 | Vue integration | ColonistGraph.vue |
| 5 | Delete old layout | Remove colonistForceLayout.ts |
| 6 | Tab visibility | Manager perf improvement |
| 7 | Final testing | Verification |

**Parallelization:** Tasks 1-3 are sequential (building the manager). Task 4 depends on 1-3. Tasks 5-6 can run in parallel after Task 4. Task 7 is final verification.
