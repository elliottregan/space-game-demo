# NPC Graph D3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Vue Flow with pure D3 for rendering the NPC relationship graph with implicit faction clustering.

**Architecture:** Force simulation computes positions using same-faction mutual attraction (not anchor points). D3-selection renders static SVG. Vue manages selection state and detail panel.

**Tech Stack:** d3-force (already installed), d3-selection (new), Vue 3, TypeScript.

---

## Task 1: Install d3-selection

**Files:**
- Modify: `package.json`

**Step 1: Add d3-selection dependency**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun add d3-selection && bun add -d @types/d3-selection
```

**Step 2: Verify installation**

Run:
```bash
grep d3-selection package.json
```

Expected: Shows `"d3-selection"` in dependencies

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add d3-selection for SVG rendering"
```

---

## Task 2: Update Force Layout for Implicit Clustering

**Files:**
- Modify: `src/renderer/utils/forceLayout.ts`
- Create: `tests/forceLayout.test.ts`

**Step 1: Write test for faction clustering**

Create `tests/forceLayout.test.ts`:

```typescript
import { describe, it, expect } from "bun:test";
import { computeForceLayout } from "../src/renderer/utils/forceLayout";
import type { NPC } from "../src/core/models/NPCInfluence";

const mockNPCs: NPC[] = [
  { id: "f1", name: "Futurist 1", faction: "futurist", influence: 1.0 },
  { id: "f2", name: "Futurist 2", faction: "futurist", influence: 1.0 },
  { id: "p1", name: "Progressive 1", faction: "progressive", influence: 1.0 },
  { id: "p2", name: "Progressive 2", faction: "progressive", influence: 1.0 },
  { id: "t1", name: "Traditionalist 1", faction: "traditionalist", influence: 1.0 },
  { id: "t2", name: "Traditionalist 2", faction: "traditionalist", influence: 1.0 },
];

// Relationship matrix where same-faction NPCs have strong connections
const mockMatrix = [
  [0, 0.8, 0.1, 0, 0, 0],   // f1: strong to f2
  [0.8, 0, 0, 0.1, 0, 0],   // f2: strong to f1
  [0.1, 0, 0, 0.8, 0, 0],   // p1: strong to p2
  [0, 0.1, 0.8, 0, 0, 0],   // p2: strong to p1
  [0, 0, 0, 0, 0, 0.8],     // t1: strong to t2
  [0, 0, 0, 0, 0.8, 0],     // t2: strong to t1
];

describe("computeForceLayout", () => {
  it("should return positions for all NPCs", () => {
    const result = computeForceLayout({
      npcs: mockNPCs,
      relationshipMatrix: mockMatrix,
      width: 600,
      height: 400,
    });

    expect(result.length).toBe(6);
    for (const node of result) {
      expect(typeof node.x).toBe("number");
      expect(typeof node.y).toBe("number");
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it("should cluster same-faction NPCs closer together", () => {
    const result = computeForceLayout({
      npcs: mockNPCs,
      relationshipMatrix: mockMatrix,
      width: 600,
      height: 400,
    });

    const positions = Object.fromEntries(result.map((n) => [n.id, n]));

    // Distance between same-faction NPCs
    const f1f2 = Math.hypot(
      positions.f1.x - positions.f2.x,
      positions.f1.y - positions.f2.y
    );
    const p1p2 = Math.hypot(
      positions.p1.x - positions.p2.x,
      positions.p1.y - positions.p2.y
    );

    // Distance between different-faction NPCs
    const f1p1 = Math.hypot(
      positions.f1.x - positions.p1.x,
      positions.f1.y - positions.p1.y
    );

    // Same-faction should be closer than different-faction
    expect(f1f2).toBeLessThan(f1p1);
    expect(p1p2).toBeLessThan(f1p1);
  });

  it("should handle empty NPC list", () => {
    const result = computeForceLayout({
      npcs: [],
      relationshipMatrix: [],
      width: 600,
      height: 400,
    });

    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify baseline passes**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun test tests/forceLayout.test.ts
```

Expected: Tests should pass (current implementation uses faction anchors which also clusters)

**Step 3: Update forceLayout.ts for implicit clustering**

Replace `src/renderer/utils/forceLayout.ts` with:

```typescript
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
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

// Deterministic initial positions based on faction (for consistent layouts)
function getInitialPosition(
  faction: NPCFaction,
  index: number,
  width: number,
  height: number
): { x: number; y: number } {
  const factionOffsets: Record<NPCFaction, { x: number; y: number }> = {
    futurist: { x: 0.5, y: 0.2 },
    progressive: { x: 0.25, y: 0.7 },
    traditionalist: { x: 0.75, y: 0.7 },
  };
  const offset = factionOffsets[faction];
  // Add small deterministic offset per NPC to avoid exact overlap
  const jitter = (index * 17) % 50;
  return {
    x: offset.x * width + jitter,
    y: offset.y * height + (jitter * 0.5),
  };
}

export function computeForceLayout(input: LayoutInput): PositionedNode[] {
  const { npcs, relationshipMatrix, width, height } = input;

  if (npcs.length === 0) {
    return [];
  }

  const padding = 40;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  // Create simulation nodes with deterministic initial positions
  const nodes: SimNode[] = npcs.map((npc, i) => {
    const pos = getInitialPosition(npc.faction, i, effectiveWidth, effectiveHeight);
    return {
      id: npc.id,
      faction: npc.faction,
      x: pos.x + padding,
      y: pos.y + padding,
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
          weight: weight / 2,
        });
      }
    }
  }

  // Add implicit same-faction links for clustering
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      if (npcs[i].faction === npcs[j].faction) {
        // Check if link already exists
        const exists = links.some(
          (l) =>
            (l.source === nodes[i] && l.target === nodes[j]) ||
            (l.source === nodes[j] && l.target === nodes[i])
        );
        if (!exists) {
          links.push({
            source: nodes[i],
            target: nodes[j],
            weight: 0.5, // Implicit faction attraction
          });
        }
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
        .distance(100)
    )
    .force("charge", forceManyBody().strength(-300))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(30))
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  // Run simulation until settled
  simulation.tick(300);
  simulation.stop();

  // Extract final positions, clamped to bounds
  return nodes.map((node) => ({
    id: node.id,
    x: Math.max(padding, Math.min(width - padding, node.x ?? width / 2)),
    y: Math.max(padding, Math.min(height - padding, node.y ?? height / 2)),
  }));
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun test tests/forceLayout.test.ts
```

Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add src/renderer/utils/forceLayout.ts tests/forceLayout.test.ts
git commit -m "feat: update force layout for implicit faction clustering"
```

---

## Task 3: Create renderGraph Utility

**Files:**
- Create: `src/renderer/components/NPCGraph/renderGraph.ts`
- Create: `tests/renderGraph.test.ts`

**Step 1: Write test for renderGraph**

Create `tests/renderGraph.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "bun:test";
import { JSDOM } from "jsdom";

// We'll test the data transformation logic, not actual DOM rendering
import type { GraphData, RenderOptions } from "../src/renderer/components/NPCGraph/renderGraph";

describe("renderGraph data preparation", () => {
  it("should export GraphData and RenderOptions types", async () => {
    // This test verifies the module exports correctly
    const module = await import("../src/renderer/components/NPCGraph/renderGraph");
    expect(typeof module.renderGraph).toBe("function");
  });
});
```

**Step 2: Create renderGraph.ts**

Create directory and file `src/renderer/components/NPCGraph/renderGraph.ts`:

```typescript
import { select, type Selection } from "d3-selection";
import type { NPC, NPCFaction } from "../../../core/models/NPCInfluence";
import type { PositionedNode } from "../../utils/forceLayout";

export interface GraphNode extends PositionedNode {
  npc: NPC;
  supportLevel: number | null;
  inCouncil: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
  inSameCouncil: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface RenderOptions {
  width: number;
  height: number;
  selectedId: string | null;
  onNodeClick: (npcId: string | null) => void;
}

const FACTION_COLORS: Record<NPCFaction, string> = {
  futurist: "#60a5fa",
  progressive: "#4ade80",
  traditionalist: "#fbbf24",
};

const NODE_RADIUS = 20;

export function renderGraph(
  container: SVGSVGElement,
  data: GraphData,
  options: RenderOptions
): void {
  const { width, height, selectedId, onNodeClick } = options;
  const svg = select(container);

  // Clear previous content
  svg.selectAll("*").remove();

  // Set dimensions
  svg
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Background click to deselect
  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .on("click", () => onNodeClick(null));

  // Create node position lookup
  const nodePositions = new Map(data.nodes.map((n) => [n.id, n]));

  // Render edges (behind nodes)
  const edgesGroup = svg.append("g").attr("class", "edges");

  for (const link of data.links) {
    const source = nodePositions.get(link.source);
    const target = nodePositions.get(link.target);
    if (!source || !target) continue;

    const strokeColor = link.inSameCouncil
      ? "rgba(134, 239, 172, 0.5)"
      : "rgba(255, 255, 255, 0.3)";
    const strokeWidth = Math.max(1, link.weight * 4);

    edgesGroup
      .append("line")
      .attr("x1", source.x)
      .attr("y1", source.y)
      .attr("x2", target.x)
      .attr("y2", target.y)
      .attr("stroke", strokeColor)
      .attr("stroke-width", strokeWidth);
  }

  // Render nodes
  const nodesGroup = svg.append("g").attr("class", "nodes");

  for (const node of data.nodes) {
    const isSelected = node.id === selectedId;
    const factionColor = FACTION_COLORS[node.npc.faction];

    const nodeGroup = nodesGroup
      .append("g")
      .attr("class", "node")
      .attr("transform", `translate(${node.x}, ${node.y})`)
      .attr("cursor", "pointer")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        onNodeClick(node.id);
      });

    // Node circle
    nodeGroup
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", "white")
      .attr("stroke", factionColor)
      .attr("stroke-width", isSelected ? 3 : 1.5);

    // Drop shadow for selected
    if (isSelected) {
      nodeGroup
        .select("circle")
        .attr("filter", "drop-shadow(0 0 4px rgba(255,255,255,0.5))");
    }

    // Council glow
    if (node.inCouncil) {
      nodeGroup
        .insert("circle", "circle")
        .attr("r", NODE_RADIUS + 4)
        .attr("fill", "none")
        .attr("stroke", "rgba(134, 239, 172, 0.4)")
        .attr("stroke-width", 2);
    }

    // NPC initials
    const initials = node.npc.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2);

    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", factionColor)
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, sans-serif")
      .text(initials);

    // NPC name label below
    const lastName = node.npc.name.split(" ").pop() ?? "";
    nodeGroup
      .append("text")
      .attr("y", NODE_RADIUS + 14)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255, 255, 255, 0.7)")
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text(lastName);
  }
}
```

**Step 3: Run test to verify module exports**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun test tests/renderGraph.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
mkdir -p src/renderer/components/NPCGraph
git add src/renderer/components/NPCGraph/renderGraph.ts tests/renderGraph.test.ts
git commit -m "feat: add D3 renderGraph utility for SVG rendering"
```

---

## Task 4: Create NPCGraph Vue Component

**Files:**
- Create: `src/renderer/components/NPCGraph/NPCGraph.vue`
- Create: `src/renderer/components/NPCGraph/index.ts`

**Step 1: Create NPCGraph.vue**

Create `src/renderer/components/NPCGraph/NPCGraph.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import type { NPC, NPCFaction } from "../../../core/models/NPCInfluence";
import { computeForceLayout } from "../../utils/forceLayout";
import { renderGraph, type GraphData, type GraphNode, type GraphLink } from "./renderGraph";

interface Props {
  npcs: NPC[];
  relationshipMatrix: number[][];
  councils: { id: string; memberIds: string[] }[];
  activeProjectSupport: Record<string, number> | null;
  selectedNpcId: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [npcId: string | null];
}>();

const svgRef = ref<SVGSVGElement | null>(null);

const GRAPH_WIDTH = 600;
const GRAPH_HEIGHT = 400;

// Compute force layout positions
const layoutPositions = computed(() => {
  return computeForceLayout({
    npcs: props.npcs,
    relationshipMatrix: props.relationshipMatrix,
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
  });
});

// Check if NPC is in a council
function isInCouncil(npcId: string): boolean {
  return props.councils.some((c) => c.memberIds.includes(npcId));
}

// Check if two NPCs are in the same council
function areInSameCouncil(id1: string, id2: string): boolean {
  return props.councils.some(
    (c) => c.memberIds.includes(id1) && c.memberIds.includes(id2)
  );
}

// Build graph data for rendering
const graphData = computed<GraphData>(() => {
  const positionMap = new Map(layoutPositions.value.map((p) => [p.id, p]));

  const nodes: GraphNode[] = props.npcs.map((npc) => {
    const pos = positionMap.get(npc.id) ?? { x: 0, y: 0 };
    return {
      id: npc.id,
      x: pos.x,
      y: pos.y,
      npc,
      supportLevel: props.activeProjectSupport?.[npc.id] ?? null,
      inCouncil: isInCouncil(npc.id),
    };
  });

  const links: GraphLink[] = [];
  for (let i = 0; i < props.npcs.length; i++) {
    for (let j = i + 1; j < props.npcs.length; j++) {
      const weight =
        (props.relationshipMatrix[i]?.[j] ?? 0) +
        (props.relationshipMatrix[j]?.[i] ?? 0);
      if (weight < 0.1) continue;

      links.push({
        source: props.npcs[i].id,
        target: props.npcs[j].id,
        weight: weight / 2,
        inSameCouncil: areInSameCouncil(props.npcs[i].id, props.npcs[j].id),
      });
    }
  }

  return { nodes, links };
});

// Render when data changes
function render() {
  if (!svgRef.value) return;

  renderGraph(svgRef.value, graphData.value, {
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
    selectedId: props.selectedNpcId,
    onNodeClick: (id) => emit("select", id),
  });
}

onMounted(render);

watch([graphData, () => props.selectedNpcId], render);
</script>

<template>
  <div class="npc-graph">
    <svg ref="svgRef" class="graph-svg" />

    <!-- Faction Legend -->
    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot futurist" />
        <span>Futurist</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot progressive" />
        <span>Progressive</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot traditionalist" />
        <span>Traditionalist</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.npc-graph {
  position: relative;
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  overflow: hidden;
}

.graph-svg {
  display: block;
  background: radial-gradient(
    circle at center,
    oklch(20% 0.02 280 / 0.3) 0%,
    var(--g-color-bg) 100%
  );
}

.legend {
  position: absolute;
  bottom: var(--g-space-sm);
  left: var(--g-space-sm);
  display: flex;
  gap: var(--g-space-md);
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  font-size: var(--g-font-size-xs);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.futurist {
  background: #60a5fa;
}

.legend-dot.progressive {
  background: #4ade80;
}

.legend-dot.traditionalist {
  background: #fbbf24;
}
</style>
```

**Step 2: Create index.ts barrel export**

Create `src/renderer/components/NPCGraph/index.ts`:

```typescript
export { default as NPCGraph } from "./NPCGraph.vue";
```

**Step 3: Commit**

```bash
git add src/renderer/components/NPCGraph/NPCGraph.vue src/renderer/components/NPCGraph/index.ts
git commit -m "feat: add NPCGraph Vue component with D3 rendering"
```

---

## Task 5: Create NPCDetailPanel Component

**Files:**
- Create: `src/renderer/components/NPCGraph/NPCDetailPanel.vue`

**Step 1: Create NPCDetailPanel.vue**

Create `src/renderer/components/NPCGraph/NPCDetailPanel.vue`:

```vue
<script setup lang="ts">
import { computed } from "vue";
import type { NPC } from "../../../core/models/NPCInfluence";

interface Props {
  npc: NPC;
  supportLevel: number | null;
  relationships: { npc: NPC; influenceFrom: number; influenceTo: number }[];
  councils: { id: string; name: string; memberIds: string[] }[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
}>();

const npcCouncils = computed(() =>
  props.councils.filter((c) => c.memberIds.includes(props.npc.id))
);

function formatPercent(value: number): string {
  const pct = (value * 100).toFixed(0);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}
</script>

<template>
  <div class="npc-detail-panel">
    <div class="panel-header">
      <h3>{{ npc.name }}</h3>
      <button class="close-btn" @click="emit('close')">×</button>
    </div>

    <div class="npc-meta">
      <div class="meta-row">
        <span class="label">Faction:</span>
        <span class="value faction" :class="npc.faction">
          {{ npc.faction }}
        </span>
      </div>
      <div class="meta-row">
        <span class="label">Influence:</span>
        <span class="value">{{ npc.influence.toFixed(1) }}×</span>
      </div>
      <div v-if="supportLevel !== null" class="meta-row">
        <span class="label">Support:</span>
        <span
          class="value"
          :class="{
            positive: supportLevel > 0,
            negative: supportLevel < 0,
          }"
        >
          {{ formatPercent(supportLevel) }}
        </span>
      </div>
    </div>

    <div v-if="npcCouncils.length > 0" class="councils-section">
      <h4>Councils</h4>
      <div v-for="council in npcCouncils" :key="council.id" class="council-badge">
        {{ council.name }}
      </div>
    </div>

    <div v-if="relationships.length > 0" class="relationships-section">
      <h4>Relationships</h4>
      <div class="relationship-list">
        <div
          v-for="rel in relationships"
          :key="rel.npc.id"
          class="relationship-item"
        >
          <span class="rel-name">{{ rel.npc.name }}</span>
          <div class="rel-bars">
            <div class="rel-bar">
              <span class="rel-label">From</span>
              <div class="bar-track">
                <div
                  class="bar-fill from"
                  :style="{ width: `${rel.influenceFrom * 100}%` }"
                />
              </div>
              <span class="rel-value">{{ (rel.influenceFrom * 100).toFixed(0) }}%</span>
            </div>
            <div class="rel-bar">
              <span class="rel-label">To</span>
              <div class="bar-track">
                <div
                  class="bar-fill to"
                  :style="{ width: `${rel.influenceTo * 100}%` }"
                />
              </div>
              <span class="rel-value">{{ (rel.influenceTo * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.npc-detail-panel {
  width: 260px;
  background: var(--g-color-bg-elevated);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  padding: var(--g-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
}

.close-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  cursor: pointer;
  font-size: 1.4rem;
  padding: 0 var(--g-space-xs);
  line-height: 1;
}

.close-btn:hover {
  color: var(--g-color-text);
}

.npc-meta {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.label {
  color: var(--g-color-text-muted);
}

.value.faction {
  text-transform: capitalize;
}

.value.faction.futurist {
  color: #60a5fa;
}

.value.faction.progressive {
  color: #4ade80;
}

.value.faction.traditionalist {
  color: #fbbf24;
}

.value.positive {
  color: var(--g-color-positive);
}

.value.negative {
  color: var(--g-color-negative);
}

.councils-section,
.relationships-section {
  margin-top: var(--g-space-sm);
}

.councils-section h4,
.relationships-section h4 {
  margin: 0 0 var(--g-space-xs);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  border-bottom: 1px solid var(--g-color-border);
  padding-bottom: var(--g-space-xs);
}

.council-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(134, 239, 172, 0.2);
  border: 1px solid rgba(134, 239, 172, 0.4);
  border-radius: 4px;
  font-size: var(--g-font-size-xs);
  margin-right: var(--g-space-xs);
}

.relationship-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.relationship-item {
  font-size: var(--g-font-size-xs);
}

.rel-name {
  font-weight: 500;
  display: block;
  margin-bottom: 2px;
}

.rel-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rel-bar {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.rel-label {
  width: 30px;
  color: var(--g-color-text-muted);
}

.bar-track {
  flex: 1;
  height: 6px;
  background: var(--g-color-bg);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
}

.bar-fill.from {
  background: #60a5fa;
}

.bar-fill.to {
  background: #4ade80;
}

.rel-value {
  width: 35px;
  text-align: right;
  color: var(--g-color-text-muted);
}
</style>
```

**Step 2: Update index.ts to export NPCDetailPanel**

Update `src/renderer/components/NPCGraph/index.ts`:

```typescript
export { default as NPCGraph } from "./NPCGraph.vue";
export { default as NPCDetailPanel } from "./NPCDetailPanel.vue";
```

**Step 3: Commit**

```bash
git add src/renderer/components/NPCGraph/NPCDetailPanel.vue src/renderer/components/NPCGraph/index.ts
git commit -m "feat: add NPCDetailPanel component for selected NPC info"
```

---

## Task 6: Integrate NPCGraph into PoliticsTab

**Files:**
- Modify: `src/renderer/components/PoliticsTab.vue`

**Step 1: Read current PoliticsTab.vue**

First, read the current file to understand its structure.

**Step 2: Update PoliticsTab.vue to use NPCGraph**

Replace the Vue Flow graph usage with the new NPCGraph component. The integration should:

1. Import `NPCGraph` and `NPCDetailPanel` from `./NPCGraph`
2. Replace `<NPCRelationshipGraph />` with `<NPCGraph />` and `<NPCDetailPanel />`
3. Add selection state management
4. Compute relationships for selected NPC

**Step 3: Run dev server to verify**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun run dev
```

Open browser, navigate to Politics tab, verify graph renders.

**Step 4: Commit**

```bash
git add src/renderer/components/PoliticsTab.vue
git commit -m "feat: integrate NPCGraph component into PoliticsTab"
```

---

## Task 7: Remove Vue Flow Dependencies

**Files:**
- Delete: `src/renderer/components/NPCRelationshipGraph.vue`
- Delete: `src/renderer/components/NPCNode.vue`
- Modify: `package.json`

**Step 1: Delete old Vue Flow components**

```bash
cd /workspace/.worktrees/npc-graph-d3
rm src/renderer/components/NPCRelationshipGraph.vue
rm src/renderer/components/NPCNode.vue
```

**Step 2: Remove Vue Flow from package.json**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun remove @vue-flow/core
```

**Step 3: Run build to verify no broken imports**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun run build
```

Expected: Build succeeds

**Step 4: Run all tests**

Run:
```bash
cd /workspace/.worktrees/npc-graph-d3 && bun test
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove Vue Flow dependency and old graph components"
```

---

## Task 8: Final Verification

**Step 1: Run linter**

```bash
cd /workspace/.worktrees/npc-graph-d3 && bun run lint
```

Fix any issues.

**Step 2: Run full test suite**

```bash
cd /workspace/.worktrees/npc-graph-d3 && bun test
```

Expected: All tests pass

**Step 3: Run production build**

```bash
cd /workspace/.worktrees/npc-graph-d3 && bun run build
```

Expected: Build succeeds

**Step 4: Manual testing**

Run dev server and verify:
- Graph renders with NPCs clustered by faction
- Clicking an NPC shows the detail panel
- Clicking empty space deselects
- Relationships display correctly in detail panel
- Councils shown in detail panel
- Legend displays correctly

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore: fix lint issues and finalize implementation"
```

---

## Summary

This plan implements the NPC Graph D3 replacement in 8 tasks:

1. **Task 1**: Install d3-selection dependency
2. **Task 2**: Update force layout for implicit faction clustering
3. **Task 3**: Create renderGraph D3 utility
4. **Task 4**: Create NPCGraph Vue component
5. **Task 5**: Create NPCDetailPanel component
6. **Task 6**: Integrate into PoliticsTab
7. **Task 7**: Remove Vue Flow dependencies
8. **Task 8**: Final verification

Each task follows TDD where applicable and produces incremental, working code with commits.
