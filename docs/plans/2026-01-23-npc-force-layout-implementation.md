# NPC Graph Force-Directed Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace hardcoded NPC positions with a force-directed layout that minimizes edge crossings while maintaining faction grouping.

**Architecture:** D3-force simulation computes node positions using link forces (relationship strength), charge forces (node repulsion), and custom faction gravity. Positions are computed once on data change and passed to Vue Flow for static rendering.

**Tech Stack:** D3-force for physics simulation, Vue Flow for graph rendering, TypeScript

---

### Task 1: Install d3-force Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install d3-force and types**

Run:
```bash
bun add d3-force
bun add -d @types/d3-force
```

**Step 2: Verify installation**

Run: `bun install`
Expected: Clean install with no errors

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add d3-force dependency for NPC graph layout"
```

---

### Task 2: Create Force Layout Utility - Types and Basic Structure

**Files:**
- Create: `src/renderer/utils/forceLayout.ts`

**Step 1: Create utils directory and file with types**

Create `src/renderer/utils/forceLayout.ts`:

```typescript
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCenter,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { NPC, NPCFaction } from "../../core/models/NPCInfluence";

export interface LayoutInput {
  npcs: NPC[];
  relationshipMatrix: number[][];
  width: number;
  height: number;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  faction: NPCFaction;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

// Faction anchor positions (triangle layout)
const FACTION_ANCHORS: Record<NPCFaction, { x: number; y: number }> = {
  futurist: { x: 0.5, y: 0.15 },      // top center
  progressive: { x: 0.2, y: 0.75 },   // bottom left
  traditionalist: { x: 0.8, y: 0.75 }, // bottom right
};

export function computeForceLayout(input: LayoutInput): PositionedNode[] {
  const { npcs, relationshipMatrix, width, height } = input;

  if (npcs.length === 0) {
    return [];
  }

  // Create simulation nodes with initial positions at faction anchors
  const nodes: SimNode[] = npcs.map((npc) => {
    const anchor = FACTION_ANCHORS[npc.faction];
    return {
      id: npc.id,
      faction: npc.faction,
      x: anchor.x * width,
      y: anchor.y * height,
    };
  });

  // Create links from relationship matrix
  const links: SimLink[] = [];
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const weight = (relationshipMatrix[i]?.[j] ?? 0) + (relationshipMatrix[j]?.[i] ?? 0);
      if (weight > 0.1) {
        links.push({
          source: nodes[i],
          target: nodes[j],
          weight: weight / 2, // Average of bidirectional
        });
      }
    }
  }

  // Create and configure simulation
  const simulation: Simulation<SimNode, SimLink> = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .strength((link) => 0.1 + link.weight * 0.7)
        .distance(80)
    )
    .force("charge", forceManyBody().strength(-200))
    .force("center", forceCenter(width / 2, height / 2).strength(0.05))
    .force(
      "factionX",
      forceX<SimNode>((d) => FACTION_ANCHORS[d.faction].x * width).strength(0.3)
    )
    .force(
      "factionY",
      forceY<SimNode>((d) => FACTION_ANCHORS[d.faction].y * height).strength(0.3)
    )
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  // Run simulation until settled
  simulation.tick(300);
  simulation.stop();

  // Extract final positions
  return nodes.map((node) => ({
    id: node.id,
    x: node.x ?? 0,
    y: node.y ?? 0,
  }));
}
```

**Step 2: Verify TypeScript compiles**

Run: `bun run lint`
Expected: No errors in forceLayout.ts

**Step 3: Commit**

```bash
git add src/renderer/utils/forceLayout.ts
git commit -m "feat: add force layout utility for NPC graph"
```

---

### Task 3: Write Tests for Force Layout

**Files:**
- Create: `tests/forceLayout.test.ts`

**Step 1: Create test file**

Create `tests/forceLayout.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { computeForceLayout, type LayoutInput } from "../src/renderer/utils/forceLayout";
import type { NPC } from "../src/core/models/NPCInfluence";

describe("computeForceLayout", () => {
  const createNPC = (id: string, faction: "futurist" | "progressive" | "traditionalist"): NPC => ({
    id,
    name: `NPC ${id}`,
    faction,
    influence: 1.0,
  });

  it("returns empty array for empty input", () => {
    const input: LayoutInput = {
      npcs: [],
      relationshipMatrix: [],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);

    expect(result).toEqual([]);
  });

  it("positions single NPC near faction anchor", () => {
    const input: LayoutInput = {
      npcs: [createNPC("npc1", "futurist")],
      relationshipMatrix: [[0]],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("npc1");
    // Futurist anchor is at (0.5, 0.15) = (300, 60) for 600x400
    // With center force, should be pulled somewhat toward center
    expect(result[0].x).toBeGreaterThan(200);
    expect(result[0].x).toBeLessThan(400);
    expect(result[0].y).toBeGreaterThan(0);
    expect(result[0].y).toBeLessThan(250);
  });

  it("positions NPCs from same faction near each other", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("npc1", "progressive"),
        createNPC("npc2", "progressive"),
      ],
      relationshipMatrix: [
        [0, 0.5],
        [0.5, 0],
      ],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);

    expect(result).toHaveLength(2);
    const pos1 = result.find((p) => p.id === "npc1")!;
    const pos2 = result.find((p) => p.id === "npc2")!;

    // Both should be in bottom-left quadrant (progressive faction)
    expect(pos1.x).toBeLessThan(350);
    expect(pos1.y).toBeGreaterThan(150);
    expect(pos2.x).toBeLessThan(350);
    expect(pos2.y).toBeGreaterThan(150);
  });

  it("pulls strongly connected cross-faction NPCs closer together", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("futurist1", "futurist"),
        createNPC("trad1", "traditionalist"),
      ],
      relationshipMatrix: [
        [0, 0.9], // Strong connection
        [0.9, 0],
      ],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);
    const futurist = result.find((p) => p.id === "futurist1")!;
    const trad = result.find((p) => p.id === "trad1")!;

    // Calculate distance between them
    const distance = Math.sqrt((futurist.x - trad.x) ** 2 + (futurist.y - trad.y) ** 2);

    // Strong relationship should pull them closer than faction anchors would suggest
    // Faction anchors are (300, 60) and (480, 300) = ~300px apart
    // With strong link, should be noticeably closer
    expect(distance).toBeLessThan(250);
  });

  it("keeps weakly connected cross-faction NPCs near their factions", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("futurist1", "futurist"),
        createNPC("trad1", "traditionalist"),
      ],
      relationshipMatrix: [
        [0, 0.05], // Very weak connection
        [0.05, 0],
      ],
      width: 600,
      height: 400,
    };

    const result = computeForceLayout(input);
    const futurist = result.find((p) => p.id === "futurist1")!;
    const trad = result.find((p) => p.id === "trad1")!;

    // Futurist should be in top half
    expect(futurist.y).toBeLessThan(250);
    // Traditionalist should be in bottom-right area
    expect(trad.x).toBeGreaterThan(300);
    expect(trad.y).toBeGreaterThan(200);
  });

  it("returns deterministic positions for same input", () => {
    const input: LayoutInput = {
      npcs: [
        createNPC("npc1", "futurist"),
        createNPC("npc2", "progressive"),
        createNPC("npc3", "traditionalist"),
      ],
      relationshipMatrix: [
        [0, 0.3, 0.2],
        [0.3, 0, 0.4],
        [0.2, 0.4, 0],
      ],
      width: 600,
      height: 400,
    };

    const result1 = computeForceLayout(input);
    const result2 = computeForceLayout(input);

    // Positions should be identical across runs
    expect(result1).toEqual(result2);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `bun test tests/forceLayout.test.ts`
Expected: All 6 tests pass

**Step 3: Commit**

```bash
git add tests/forceLayout.test.ts
git commit -m "test: add unit tests for force layout utility"
```

---

### Task 4: Update NPCRelationshipGraph to Use Force Layout

**Files:**
- Modify: `src/renderer/components/NPCRelationshipGraph.vue`

**Step 1: Import and use force layout**

Replace the positioning logic in `NPCRelationshipGraph.vue`. Update the `<script setup>` section:

```typescript
<script setup lang="ts">
import { computed, ref } from "vue";
import { VueFlow, type Node, type Edge } from "@vue-flow/core";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import { gameService } from "../services/GameService";
import type { NPC, NPCFaction } from "../../core/models/NPCInfluence";
import NPCNode from "./NPCNode.vue";
import { computeForceLayout } from "../utils/forceLayout";

const state = gameService.getState();

const selectedNPC = ref<NPC | null>(null);

// Faction colors
const factionColors: Record<NPCFaction, string> = {
  futurist: "var(--g-color-info)",
  progressive: "var(--g-color-positive)",
  traditionalist: "var(--g-color-warning)",
};

// Layout dimensions
const GRAPH_WIDTH = 600;
const GRAPH_HEIGHT = 400;

// Compute force-directed layout positions
const layoutPositions = computed(() => {
  return computeForceLayout({
    npcs: state.npcInfluence.npcs,
    relationshipMatrix: state.npcInfluence.relationshipMatrix,
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
  });
});

// Check if NPC is in a council
function isInCouncil(npcId: string): boolean {
  return state.npcInfluence.councils.some((c) => c.memberIds.includes(npcId));
}

// Get support level for active project
function getSupportLevel(npcId: string): number | null {
  if (!state.npcInfluence.activeProject) return null;
  return state.npcInfluence.activeProject.supportLevels[npcId] ?? null;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const nodes = computed<Node[]>(() =>
  state.npcInfluence.npcs.map((npc) => {
    const pos = layoutPositions.value.find((p) => p.id === npc.id);
    return {
      id: npc.id,
      type: "npc",
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
      data: {
        npc,
        color: factionColors[npc.faction],
        inCouncil: isInCouncil(npc.id),
        supportLevel: getSupportLevel(npc.id),
      },
    };
  })
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
const edges = computed<Edge[]>(() => {
  const result: Edge[] = [];
  const npcs = state.npcInfluence.npcs;
  const matrix = state.npcInfluence.relationshipMatrix;

  for (let i = 0; i < npcs.length; i++) {
    for (let j = 0; j < npcs.length; j++) {
      if (i === j) continue;

      const weight = matrix[i]?.[j] ?? 0;
      if (weight < 0.1) continue; // Skip very weak relationships

      // Check if both are in the same council
      const inSameCouncil = state.npcInfluence.councils.some(
        (c) => c.memberIds.includes(npcs[i].id) && c.memberIds.includes(npcs[j].id)
      );

      result.push({
        id: `${npcs[j].id}-${npcs[i].id}`,
        source: npcs[j].id,
        target: npcs[i].id,
        type: "smoothstep",
        animated: inSameCouncil,
        style: {
          stroke: inSameCouncil ? "rgba(134, 239, 172, 0.8)" : "rgba(255, 255, 255, 0.4)",
          strokeWidth: Math.max(1, weight * 4),
        },
        markerEnd: {
          type: "arrowclosed",
          color: inSameCouncil ? "rgba(134, 239, 172, 0.8)" : "rgba(255, 255, 255, 0.5)",
        },
      });
    }
  }
  return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onNodeClick(_event: MouseEvent, node: Node) {
  selectedNPC.value = node.data.npc;
}

// Get relationships for selected NPC
// biome-ignore lint/correctness/noUnusedVariables: used in template
const selectedRelationships = computed(() => {
  if (!selectedNPC.value) return [];

  const npcs = state.npcInfluence.npcs;
  const matrix = state.npcInfluence.relationshipMatrix;
  const selectedIndex = npcs.findIndex((n) => n.id === selectedNPC.value?.id);

  if (selectedIndex === -1) return [];

  const relationships: { npc: NPC; influenceFrom: number; influenceTo: number }[] = [];

  for (let i = 0; i < npcs.length; i++) {
    if (i === selectedIndex) continue;

    const influenceFrom = matrix[selectedIndex]?.[i] ?? 0;
    const influenceTo = matrix[i]?.[selectedIndex] ?? 0;

    if (influenceFrom > 0.05 || influenceTo > 0.05) {
      relationships.push({
        npc: npcs[i],
        influenceFrom,
        influenceTo,
      });
    }
  }

  return relationships.sort(
    (a, b) => b.influenceFrom + b.influenceTo - (a.influenceFrom + a.influenceTo)
  );
});
</script>
```

**Step 2: Run lint to verify**

Run: `bun run lint`
Expected: No errors

**Step 3: Run all tests**

Run: `bun test`
Expected: All tests pass (including new forceLayout tests)

**Step 4: Commit**

```bash
git add src/renderer/components/NPCRelationshipGraph.vue
git commit -m "feat: integrate force-directed layout into NPC graph"
```

---

### Task 5: Update NPCNode for Flexible Handles

**Files:**
- Modify: `src/renderer/components/NPCNode.vue`

**Step 1: Add handles on all four sides**

Update the template section in `NPCNode.vue` to add handles on all sides:

```vue
<template>
  <div class="npc-node" :class="{ 'in-council': data.inCouncil }">
    <Handle id="top" type="target" :position="Position.Top" />
    <Handle id="right" type="target" :position="Position.Right" />
    <Handle id="bottom" type="source" :position="Position.Bottom" />
    <Handle id="left" type="source" :position="Position.Left" />

    <div class="node-content" :style="{ borderColor: data.color }">
      <div class="avatar" :style="{ background: data.color }">
        {{ getInitials(data.npc.name) }}
      </div>
      <div class="name">{{ data.npc.name.split(" ").pop() }}</div>
      <div v-if="data.supportLevel !== null" class="support-indicator">
        <div
          class="support-bar"
          :class="{
            positive: data.supportLevel > 0,
            negative: data.supportLevel < 0,
          }"
          :style="{
            width: `${Math.abs(data.supportLevel) * 100}%`,
            marginLeft: data.supportLevel < 0 ? 'auto' : '50%',
            marginRight: data.supportLevel >= 0 ? 'auto' : '50%',
          }"
        />
      </div>
    </div>
  </div>
</template>
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer/components/NPCNode.vue
git commit -m "feat: add handles on all sides of NPC nodes for flexible edge routing"
```

---

### Task 6: Manual Visual Testing

**Files:** None (visual verification only)

**Step 1: Start dev server**

Run: `bun run dev`

**Step 2: Navigate to Politics tab and verify:**

- [ ] NPCs are positioned in faction groups (Futurist top, Progressive bottom-left, Traditionalist bottom-right)
- [ ] Strongly connected NPCs appear closer together
- [ ] Edges are light-colored and visible against dark background
- [ ] Edges use smooth curves instead of hard angles
- [ ] Edge crossings are reduced compared to before
- [ ] Clicking an NPC still shows the detail panel

**Step 3: Stop dev server**

Press Ctrl+C

**Step 4: Commit any final tweaks if needed**

---

### Task 7: Final Cleanup and PR Prep

**Files:**
- Possibly: `docs/plans/2026-01-23-npc-graph-force-layout-design.md` (mark complete)

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Review all changes**

Run: `git log --oneline main..HEAD`
Expected: See 5-6 commits for this feature

**Step 4: Ready for PR or merge**

Feature is complete and ready for review.
