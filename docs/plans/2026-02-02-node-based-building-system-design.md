# Node-Based Building System Design

## Overview

A spatial building system where buildings are placed on an isometric grid and power requires physical proximity. This adds strategic depth to colony layout while keeping the core resource mechanics intact.

## Core Mechanics

### Power Network

**Connection Model**
- Buildings automatically connect to power sources within range
- Range is determined by the power source's output (larger producers reach farther)
- Technologies can extend base range (e.g., "Improved Power Grid" adds +1 range to all sources)

**Power Distribution**
- When multiple buildings compete for limited capacity, closer buildings have priority
- Buildings track their distance to their power source
- When capacity drops, farthest buildings lose power first

**Battery Backup System**
- Each building has a battery buffer measured in sols of backup power
- When disconnected from power, battery drains over time
- Default backup duration: 3 sols before shutdown
- Building power states: `powered` → `on-battery` → `low-battery` → `unpowered`
- Unpowered buildings produce nothing until reconnected

**Scope**
- Only power requires physical proximity
- Food, oxygen, water, and materials continue using the abstract pool system

## Visual System

### Isometric Grid

**Structure**
- Fixed 10x10 isometric grid (100 total cells)
- Each cell can hold one building or be empty
- Some cells contain resource deposits (water, minerals) determined at game start
- Grid does not expand; space becomes a strategic constraint as colony grows

**Rendering (D3)**
- Reuse D3 patterns from the politics/NPC graph visualization
- Each building is a node rendered at its grid position transformed to isometric coordinates
- Nodes display: building icon, building name label, power status indicator
- Power connections rendered as subtle edges between buildings and their power source

**Coordinate Transform**
```
sx = (x - y) * tileWidth / 2
sy = (x + y) * tileHeight / 2
```

### Deposit Visualization

- Empty cells with deposits show a subtle ground texture/icon (water droplet, mineral crystal)
- Deposits are visible before building, helping players plan placement
- When a building occupies a deposit cell, the deposit indicator moves to the building's stats card

### Power Status Indicators

Buildings show their power state via icons:
- ⚡ Powered (green)
- 🔋 On battery (yellow)
- 🪫 Low battery (orange)
- ⛔ Unpowered (red)

## Interaction Design

### Camera and Selection

- Grid fits within the tab viewport (no scrolling needed for 10x10)
- Hover on node: highlight and show tooltip with key stats
- Click on node: open detail stats card (slides in from side, like NPC cards)
- Click on empty cell: open context menu for building placement

### Building Placement Flow

**Context Menu**
- Click empty cell → popup menu appears anchored to that cell
- Menu header shows: coordinates, deposit type (if any), power availability
- Menu lists available buildings filtered by:
  - Tech requirements met
  - Resources available for construction
  - Deposit requirements (Water Extractor only shown on water deposits)

**Placement Hints**
Each building option shows placement suitability:
- ⚡ Power: "In range (8/10 capacity)" or "Out of range"
- 💧 Deposit: "Water deposit available" (if relevant)
- ⭐ Recommended: highlight buildings that benefit most from this location
- Buildings that can't function here are grayed out with reason shown

**Construction**
- Select building from menu → building appears on grid
- If cell has no power coverage, show warning: "This building will operate on battery until connected to power"

### Building Stats Card

Clicking an existing building opens a slide-in card showing:
- Building name and icon
- Production/consumption rates
- Power status and battery level (with bar visualization)
- Distance to power source
- Workers assigned (if applicable)
- Demolish button

## Game Start Configuration

### Deposit Generation

At game start, randomly place deposits:
- 2-3 water deposits (scattered, not adjacent)
- 2-3 mineral deposits (for future mining buildings)
- Deposits avoid the central area to create expansion incentives
- Seed-based randomization for reproducibility in simulations

### Starting Building Placement

Initial buildings auto-placed in a sensible cluster:
- Solar Panel Array at center (acts as power hub)
- Habitat Module adjacent to solar panel
- Basic Farm within power range
- Water Extractor on nearest water deposit
- Storage Depot near habitat

Starting layout ensures all buildings are powered and leaves room for expansion.

## UI Integration

### New "Base" Tab

- Add "Base" tab to main navigation alongside Colony, Operations, Politics
- Primary place for building construction and colony layout
- Tab icon: grid or building icon from lucide-vue-next

### Relationship with Existing Panels

| Tab | Purpose | Building Construction |
|-----|---------|----------------------|
| Base | Grid view, building placement, power management | ✅ Yes |
| Colony | Population, colonists, morale | ❌ No |
| Operations | Expeditions, projects | ❌ No |

### Power Network Summary

Add power status to Base tab header:
- Total power production
- Total power consumption
- Buildings on battery (count)
- Buildings unpowered (count)

## Technical Implementation

### Data Model

```typescript
interface GridCell {
  x: number;
  y: number;
  deposit?: 'water' | 'mineral';
  buildingId?: string;
}

interface BuildingPlacement {
  buildingId: string;
  position: { x: number; y: number };
  powerSourceId?: string;
  batteryLevel: number; // 0-1, represents sols remaining / max backup
  powerState: 'powered' | 'on-battery' | 'low-battery' | 'unpowered';
}

interface PowerSource {
  buildingId: string;
  output: number;
  baseRange: number;
  techBonusRange: number;
}
```

### GridManager

New manager in `src/core/systems/GridManager.ts`:

**State**
- 10x10 grid of cells
- Map of building placements
- Power network connections

**Methods**
- `placeBuilding(buildingType, position)`: Place building on grid
- `removeBuilding(position)`: Demolish building
- `getPowerStatus(position)`: Get power availability at cell
- `getPlacementHints(position)`: Get recommendations for a cell
- `tick()`: Update power connections and battery levels

**Tick Logic**
1. Recalculate power connections (buildings may have been added/removed)
2. Distribute power capacity by distance priority
3. Drain batteries for disconnected buildings
4. Charge batteries for connected buildings (if below max)
5. Update power state for each building
6. Mark unpowered buildings as non-operational

### Integration with GameState

```typescript
// In GameState.tick()
this.gridManager.tick();
// BuildingManager checks gridManager for operational status
```

### Vue Components

**BasePanel.vue**
- New component in `src/renderer/components/`
- Uses D3 for isometric grid rendering
- Pattern similar to ColonistGraph.vue
- Manages: node selection, context menu state, stats card visibility

**BuildingStatsCard.vue**
- Slide-in card component (reuse pattern from NPC cards)
- Shows building details, power status, actions

**BuildingContextMenu.vue**
- Popup menu for empty cell building selection
- Shows placement hints and available buildings

### Power Range Calculation

```typescript
function calculateRange(powerSource: PowerSource, techManager: TechnologyTree): number {
  const baseRange = powerSource.baseRange;
  const outputBonus = Math.floor(powerSource.output / 20); // +1 range per 20 power
  const techBonus = techManager.hastech('improved-power-grid') ? 1 : 0;
  return baseRange + outputBonus + techBonus;
}
```

### Default Power Ranges

| Building | Output | Base Range | Effective Range |
|----------|--------|------------|-----------------|
| Solar Panel Array | 10 | 2 | 2 |
| Advanced Solar | 25 | 3 | 4 |
| Nuclear Reactor | 50 | 4 | 6 |
| Fusion Reactor | 100 | 5 | 10 |

## Future Extensions

These are explicitly out of scope for initial implementation but the design accommodates them:

- **Other resource networks**: Water pipes, oxygen distribution (add more connection types)
- **Grid expansion**: Unlock additional grid sections through tech or milestones
- **Building upgrades**: Upgrade buildings in place to improve stats
- **Adjacency bonuses**: Buildings benefit from neighbors (farms near water, labs near habitats)
