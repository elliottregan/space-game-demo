# Colonist Graph Stability & Readability Design

## Problem

The colonist relationship graph has two issues:

1. **Instability** - Layout recomputes from scratch each sol, causing nodes to jump around unpredictably
2. **Tight clustering** - Force parameters create dense groupings that obscure relationship structure

## Solution

Persistent D3 force simulation that maintains positions between renders, with tuned parameters that emphasize relationship strength visually.

## Architecture

### Current Flow (problematic)

```
Data changes → computeColonistForceLayout() → returns new positions → render
              (starts from role-based initial positions every time)
```

### New Flow

```
Data changes → updateSimulation() → simulation animates → positions update reactively → render
              (starts from current positions, only adds/removes changed nodes)
```

### Components

**ColonistSimulationManager** - New class that owns the D3 simulation:
- Stores current positions by colonist ID
- Exposes reactive position state for Vue
- Handles incremental updates (add/remove nodes, update links)
- Manages animation lifecycle (sleep/wake/animate)

**ColonistGraph.vue** - Simplified to:
- Create manager instance on mount
- Pass data changes to manager via `watch`
- Read positions from manager's reactive state
- Destroy manager on unmount

**colonistForceLayout.ts** - Deleted, logic moves into manager

## Force Parameters

### Current (too tight)

| Force | Value |
|-------|-------|
| Link distance | 100 (fixed) |
| Link strength | 0.05 + weight × 0.4 |
| Charge | -300 |
| Collision radius | 40 |

### New (relationship-emphasis)

| Force | Value | Rationale |
|-------|-------|-----------|
| Link distance | `220 - (weight × 160)` | Strong → 60px, Weak → 200px |
| Link strength | `0.1 + weight × 0.3` | Strong relationships pull harder |
| Charge | -500 | More repulsion for spread |
| Charge distanceMax | 300 | Limit far-field for performance |
| Collision radius | 50 | Larger to prevent overlap |
| Collision strength | 0.8 | Firm but not rigid |
| Center strength | 0.05 | Gentle, doesn't fight clustering |

**Result:** Strong relationships form visible tight clusters. Weak ties stretch across the graph as bridges.

## Handling Changes

### Adding Colonists

1. Find strongest existing relationship
2. Spawn new node near that colonist (small random offset)
3. If no relationships, spawn near center
4. Wake simulation - node animates into place

### Removing Colonists

1. Fade out node over ~300ms
2. Remove from simulation after fade
3. Connected nodes drift as links disappear

### Relationship Changes

- Weight changes: update link in place, simulation adjusts distances naturally
- New relationships: add link, nodes drift closer
- Broken relationships: remove link, nodes drift apart

## Animation Lifecycle

```
SLEEPING (alpha ≈ 0)
    ↓ data changes
WARMING (alpha → 0.3, runs ~100 ticks quickly)
    ↓ positions near target
ANIMATING (alpha decays naturally, renders each frame)
    ↓ alpha < 0.001
SLEEPING
```

### Wake Triggers

- Colonist added/removed
- Relationship strength changes by > 0.1
- Window resize

### Timing

- Small changes: ~500ms to settle
- Major events (new arrivals): ~1-2s to settle

## Implementation Structure

### New File: `src/renderer/utils/ColonistSimulationManager.ts`

```typescript
class ColonistSimulationManager {
  private simulation: Simulation<SimNode, SimLink>
  private positions: Map<string, {x: number, y: number}>
  private animationFrame: number | null

  // Reactive output for Vue
  readonly positionState: Ref<PositionedColonist[]>

  constructor(width: number, height: number)

  // Called when data changes
  update(colonists: Colonist[], relationships: Map<string, number>): void

  // Resize handling
  resize(width: number, height: number): void

  // Cleanup
  destroy(): void
}
```

### Changes to ColonistGraph.vue

- Remove `layoutPositions` computed property
- Remove import of `computeColonistForceLayout`
- Add `SimulationManager` instance created in `onMounted`
- Add `watch` on props to call `manager.update()`
- Read positions from `manager.positionState`
- Call `manager.destroy()` in `onUnmounted`

### Delete: `src/renderer/utils/colonistForceLayout.ts`

Logic consolidated into `ColonistSimulationManager`.

## Rendering Updates

### renderColonistGraph.ts

- Positions update every frame via `requestAnimationFrame`
- Use D3's `.attr()` directly (simulation handles smoothness)
- New nodes: fade in `opacity: 0 → 1` over 300ms
- Removed nodes: fade out before deletion
- Use D3 enter/update/exit pattern for efficient updates

### Performance

- Only re-render changed elements
- Limit to 60fps max
- Pause when tab not visible (`document.hidden`)

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/utils/ColonistSimulationManager.ts` | Create (new) |
| `src/renderer/components/ColonistGraph/ColonistGraph.vue` | Modify |
| `src/renderer/components/ColonistGraph/renderColonistGraph.ts` | Modify |
| `src/renderer/utils/colonistForceLayout.ts` | Delete |
| `tests/colonistSimulation.test.ts` | Create (new) |

## Out of Scope

- Edge thickness varying with relationship strength
- Pulse effects on relationship changes
- Hover details panel
- "Shake" button to manually reset layout

These can be added later if desired.
