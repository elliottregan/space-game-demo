# NPC Relationship Graph: Pure D3 Implementation

## Overview

Replace Vue Flow with pure D3 for rendering the NPC relationship graph. Use D3-force to compute positions with implicit faction clustering, then render a static SVG. Click-to-select interaction opens a detail panel.

## Motivation

Vue Flow abstracts away direct SVG control, limiting customization of edges and visual design. D3 provides fine-grained control over rendering, enabling the clean aesthetic of D3's force-directed tree examples.

## Architecture

### File Structure

```
src/renderer/
  components/
    NPCGraph/
      NPCGraph.vue           # Container, manages selection state
      useForceLayout.ts      # Composable: runs D3 simulation, returns positions
      renderGraph.ts         # Pure function: D3 renders SVG from positions
```

### Data Flow

1. `useForceLayout` takes NPCs + relationship matrix → runs simulation → returns `{ nodes: [{id, x, y}], links: [{source, target, weight}] }`
2. `renderGraph` takes positions + SVG element → draws circles and lines
3. Vue handles selection state and the detail panel

## Force Simulation

### Forces Applied

| Force | Purpose | Configuration |
|-------|---------|---------------|
| Link | Pull connected NPCs together | Strength proportional to relationship weight (0.1–0.8) |
| Charge | Repel all nodes to prevent overlap | -300 (stronger repulsion for clear spacing) |
| Faction attraction | Same-faction NPCs attract each other | Custom force: +0.5 strength between faction-mates |
| Center | Keep graph centered in viewport | Pulls toward (width/2, height/2) |

### Clustering Approach

Instead of pulling NPCs toward faction "anchor points" (which creates rigid triangle groupings), we use mutual attraction between same-faction NPCs. This lets clusters form organically and allows cross-faction relationships to genuinely distort the shape.

### Simulation Settings

- Run 300 iterations synchronously (no animation)
- Deterministic seeding: initial positions based on faction (ensures same layout each time)
- Result cached until NPC data or relationships change

## Visual Styling

### Nodes (NPCs)

- Circle with 20px radius
- White fill, 1.5px stroke in faction color
- Faction colors:
  - Futurist: blue (`#60a5fa`)
  - Progressive: green (`#4ade80`)
  - Traditionalist: amber (`#fbbf24`)
- Selected state: thicker stroke (3px), subtle drop shadow
- NPC name label below each node (small, muted text)

### Edges (Relationships)

- Gray lines (`rgba(255, 255, 255, 0.3)`) for standard relationships
- Stroke width proportional to relationship strength (1–4px)
- Council relationships: brighter line (`rgba(134, 239, 172, 0.5)`)
- Edges render behind nodes (drawn first)

### Layout

- SVG fills container width, fixed height (400px)
- 40px padding so nodes don't clip at edges
- Dark background inherited from game UI

## Interaction

### Click Behavior

- Click a node → that NPC becomes selected
- Click empty space → deselects current NPC
- Selected NPC emits event to parent, which shows detail panel
- No dragging, no hover effects, no animation

### Component API

```vue
<NPCGraph
  :npcs="state.npcInfluence.npcs"
  :relationship-matrix="state.npcInfluence.relationshipMatrix"
  :councils="state.npcInfluence.councils"
  :selected-npc-id="selectedNpcId"
  @select="selectedNpcId = $event"
/>
```

### Detail Panel Contents

Shown beside or below the graph when an NPC is selected:

- NPC name and faction badge
- Current support level (if project active)
- List of relationships with strength values
- "Lobby" button with cost dropdown (if project active)
- Councils they belong to

## Implementation

### Dependencies

**Add:**
- `d3-force` (~15KB)
- `d3-selection` (~10KB)

**Remove:**
- `@vue-flow/core`
- `@vue-flow/background`

### Implementation Order

1. Create `useForceLayout.ts` - pure simulation logic, easy to unit test
2. Create `renderGraph.ts` - D3 selection logic to draw SVG
3. Create `NPCGraph.vue` - ties it together, handles selection state
4. Update parent component to use new `<NPCGraph>` with detail panel
5. Remove Vue Flow dependencies from package.json

### Testing

- Unit test `useForceLayout` with mock NPC data - verify nodes cluster by faction
- Visual testing in browser for styling tweaks

## Files Changed

- Create: `src/renderer/components/NPCGraph/NPCGraph.vue`
- Create: `src/renderer/components/NPCGraph/useForceLayout.ts`
- Create: `src/renderer/components/NPCGraph/renderGraph.ts`
- Delete: `src/renderer/components/NPCRelationshipGraph.vue`
- Delete: `src/renderer/components/NPCNode.vue` (if exists)
- Modify: Parent component that imports the graph
- Modify: `package.json` (add d3-force, d3-selection; remove vue-flow)
