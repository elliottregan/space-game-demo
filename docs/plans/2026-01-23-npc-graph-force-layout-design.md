# NPC Relationship Graph: Force-Directed Layout Design

## Problem

The current NPC Relationship Graph has significant edge clutter. All edges connect to nodes at fixed points (top/bottom), causing many crossing lines that make it hard to follow relationships. Node positions are hardcoded by faction and don't reflect actual relationship strength.

## Solution

Implement a force-directed layout using D3-force that:
1. Positions NPCs based on relationship strength (connected nodes pull together)
2. Maintains faction grouping through "faction gravity" forces
3. Uses flexible edge connection points to reduce visual clutter
4. Displays lighter-colored edges for better visibility on dark backgrounds

## Architecture

### New File Structure

```
src/renderer/
  utils/
    forceLayout.ts    # D3-force simulation logic (new)
  components/
    NPCRelationshipGraph.vue  # Updated to use force layout
```

### How It Works

1. On component mount (and when NPC data changes), run the force simulation
2. Simulation uses four forces:
   - **Link force**: Pulls connected NPCs together based on relationship strength
   - **Charge force**: Pushes all nodes apart to prevent overlap
   - **Faction gravity**: Pulls each NPC toward their faction's anchor point
   - **Center force**: Keeps graph centered in viewport
3. Run simulation for ~300 iterations until energy settles
4. Extract final positions and pass to Vue Flow as node positions
5. Vue Flow renders the pre-computed layout statically

### Why D3-force

D3-force gives fine control over custom forces (faction gravity). The built-in dagre/elk layouts in `@vue-flow/layout` are designed for hierarchical graphs, not relationship networks.

## Force Simulation Details

### API

```typescript
// src/renderer/utils/forceLayout.ts

interface LayoutInput {
  npcs: NPC[]
  relationshipMatrix: number[][]
  width: number
  height: number
}

interface PositionedNode {
  id: string
  x: number
  y: number
}

function computeForceLayout(input: LayoutInput): PositionedNode[]
```

### Force Configuration

| Force | Purpose | Strength |
|-------|---------|----------|
| Link | Pull connected nodes together | Proportional to relationship weight (0.1-0.8) |
| Charge | Repel all nodes from each other | -200 (prevents overlap) |
| Faction gravity | Pull toward faction anchor | 0.3 (moderate, can be overcome by strong links) |
| Center | Keep graph centered in viewport | 0.05 (gentle) |

### Faction Anchor Positions

Triangle layout for clear faction separation:
- **Futurist**: top center
- **Progressive**: bottom left
- **Traditionalist**: bottom right

### Simulation Settings

- Iterations: 300 (enough to settle)
- Alpha decay: 0.02 (standard cooling rate)
- Velocity decay: 0.4 (moderate damping)
- Initial positions: Seeded from faction anchors (deterministic)

Performance: <50ms for typical NPC counts (6-12 nodes).

## Component Integration

### Changes to NPCRelationshipGraph.vue

Replace hardcoded positioning with force-computed positions:

```typescript
import { computeForceLayout } from '../utils/forceLayout'

// Replace getNodePosition() with force-computed positions
const layoutPositions = computed(() => {
  return computeForceLayout({
    npcs: state.npcInfluence.npcs,
    relationshipMatrix: state.npcInfluence.relationshipMatrix,
    width: 600,
    height: 400,
  })
})

const nodes = computed<Node[]>(() =>
  state.npcInfluence.npcs.map((npc) => {
    const pos = layoutPositions.value.find(p => p.id === npc.id)
    return {
      id: npc.id,
      type: "npc",
      position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
      data: { /* same as before */ },
    }
  })
)
```

### What Stays the Same

- Edge computation logic (relationship lines)
- Node click handling and detail panel
- Legend and styling structure
- NPCNode custom component

### What Changes

- Remove hardcoded `factionPositions` object
- Remove `getNodePosition()` function
- Add import for `computeForceLayout`
- Positions now reactive to relationship data changes

## Edge Visibility Improvements

### Lighter Edge Colors

Change edge styling for better visibility on dark backgrounds:

```typescript
// Before
stroke: inSameCouncil ? "var(--g-color-positive)" : "var(--g-color-border)"

// After
stroke: inSameCouncil ? "rgba(134, 239, 172, 0.8)" : "rgba(255, 255, 255, 0.4)"
```

Council edges remain distinguishable with a brighter green tint.

### Flexible Edge Connection Points

Configure Vue Flow edges to connect at optimal points rather than fixed top/bottom:

1. **Use `smoothstep` edge type**: Routes edges with rounded corners, avoiding node overlap
2. **Dynamic handle positions**: Let Vue Flow compute best connection points based on node positions

```typescript
edges.push({
  id: `${npcs[j].id}-${npcs[i].id}`,
  source: npcs[j].id,
  target: npcs[i].id,
  type: "smoothstep",  // Changed from "default"
  // ... rest of config
})
```

If more control is needed, we can add multiple handles to NPCNode (top, bottom, left, right) and compute optimal handle selection based on relative node positions.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Single NPC in faction | Stays at faction anchor (no relationships to pull it) |
| No relationships | NPCs cluster by faction only |
| Very strong cross-faction relationship | NPCs pull toward each other but faction gravity prevents full merge |
| NPC added/removed | Layout recomputes, positions shift |

## Performance

- Simulation runs in computed property, cached until data changes
- For typical game state (6-12 NPCs), computation is <50ms
- Deterministic: seeding initial positions from faction anchors ensures consistent layouts

## Dependencies

**New dependency:** `d3-force` (~15KB minified, standalone module with no other D3 dependencies)

```bash
bun add d3-force
bun add -d @types/d3-force
```

## Implementation Checklist

1. [ ] Install d3-force dependency
2. [ ] Create `src/renderer/utils/forceLayout.ts` with force simulation logic
3. [ ] Update `NPCRelationshipGraph.vue` to use computed force layout
4. [ ] Change edge type to `smoothstep` for better routing
5. [ ] Update edge colors to lighter values
6. [ ] Test with various NPC configurations
7. [ ] Verify performance is acceptable
