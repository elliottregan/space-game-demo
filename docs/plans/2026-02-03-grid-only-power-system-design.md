# Grid-Only Power System Design

## Overview

This design removes the global power strain metric (`PowerGridManager`) and makes the spatial grid (`GridManager`) the sole power system. Power becomes a purely local concern - buildings must be within range of a power source to function.

### Goals

- Simplify the mental model from two overlapping systems to one
- Make building placement more strategic and meaningful
- Create clear cause-and-effect: no power connection = building off

### Key Decisions

- Unpowered buildings are binary off (no production/consumption)
- Power allocation remains distance-priority (closest buildings served first)
- Battery backup retained (3 sols grace period)
- Grid map view becomes the primary power interface
- Events affect power sources by percentage reduction
- Subtle visual indicators for power state (no pop-ups)

### What Gets Removed

- `PowerGridManager` class and its global strain calculation
- Colony-wide efficiency penalty based on power ratio
- The "Grid Capacity" bar showing 0-100% strain
- `powerGridEfficiency` multiplier in building calculations

---

## Core Mechanics

### Power Sources

Power sources (Solar Panel Arrays, future reactors) generate power with an output value and a range. Range calculation remains unchanged:

```
Range = 2 (base) + floor(output / 20) + tech bonus (0 or 1)
```

A Solar Panel Array with 10 output has range 2. A larger source with 40 output has range 4.

### Power Allocation

Each tick, the system:

1. Identifies all active power sources
2. For each source, finds buildings within range needing power
3. Allocates power by distance (closest first)
4. Buildings not allocated power drain battery

If a source has 30 output and 4 buildings in range needing 10 each, only the 3 closest get power. The 4th goes on battery.

### Building Power States

| State | Condition | Effect |
|-------|-----------|--------|
| `POWERED` | Connected to power source | Full operation, battery charges |
| `ON_BATTERY` | Not connected, battery > 33% | Full operation, battery drains |
| `LOW_BATTERY` | Not connected, battery ≤ 33% | Full operation, warning state |
| `UNPOWERED` | Not connected, battery = 0 | **No production or consumption** |

### Battery Drain

- Full battery = 3 sols of backup
- Drain rate: 33% per sol when not connected
- Recharges instantly when reconnected to power

---

## Building Efficiency Changes

### Current System (Being Removed)

Today, building efficiency combines multiple factors:

```
efficiency = airQuality × powerGridEfficiency × staffing × workerEfficiency × teamCohesion
```

The `powerGridEfficiency` factor (0.5-1.0) penalizes all buildings colony-wide when global power is strained.

### New System

Remove `powerGridEfficiency` from the multiplier chain entirely:

```
efficiency = airQuality × staffing × workerEfficiency × teamCohesion
```

Instead, power state is checked as a **gate** before production/consumption:

```typescript
if (building.powerState === PowerState.UNPOWERED) {
  return { production: {}, consumption: {} }; // No activity
}
// Otherwise calculate normal efficiency-adjusted production
```

### Key Implications

- Buildings in `POWERED`, `ON_BATTERY`, or `LOW_BATTERY` states operate at full efficiency (subject to other factors)
- Buildings in `UNPOWERED` state produce and consume nothing
- No partial efficiency from power - it's binary
- Staffed but unpowered buildings still count workers as assigned (they wait for power)

### Edge Case: Power Sources

Power-producing buildings (solar panels) are always considered `POWERED` - they don't need external power to operate.

---

## UI Changes

### Remove: Power Grid Panel

Delete the current `PowerGridPanel.vue` component that shows:

- Grid Capacity bar (0-100% strain)
- Production/Consumption totals
- Efficiency penalty warning

### Enhance: Grid View

The spatial grid becomes the primary power interface. Add visual elements:

#### Power Coverage Overlay

- Show power range as a colored radius around each power source
- Overlap areas show combined coverage
- Unpowered zones are visually distinct (darker/grayed)

#### Building Power Indicators

- `POWERED`: Green dot or subtle glow
- `ON_BATTERY`: Yellow/amber battery icon
- `LOW_BATTERY`: Flashing red battery icon
- `UNPOWERED`: Red "no power" icon, building appears dimmed

#### Building Tooltip Enhancement

When hovering a building, show:

- Current power state
- Battery level (if applicable)
- Distance to nearest power source
- "Out of range" warning if not covered

#### Placement Preview

When placing a building, show:

- Whether position is in power range
- Which power source would serve it
- Warning if no power available at location

#### Summary Stats (Optional)

Small info line in grid view header:

- "12 buildings powered, 2 on battery, 1 unpowered"

---

## Events & Modifiers

### Event Integration

Events that affect power now apply percentage modifiers to power source output rather than flat reductions.

### Example: Dust Storm

Current behavior:

```
power: -50  // Flat reduction to global power
```

New behavior:

```typescript
{
  type: "dust_storm",
  effect: {
    powerOutputModifier: 0.5,  // 50% reduction to all solar output
    duration: 3,               // Lasts 3 sols
    affectedSources: "solar"   // Only affects solar-type buildings
  }
}
```

### Implementation

Power sources gain an `outputModifier` field (default 1.0). During events:

1. Event applies modifier to relevant power sources
2. GridManager uses modified output for range and allocation
3. Buildings at edge of range may lose power during event
4. Modifier resets when event ends

### Cascading Effects

A dust storm reducing solar output by 50%:

- Solar Panel (10 output) → 5 effective output
- Range drops from 2 to 2 (floor(5/20) = 0, so base only)
- Buildings previously in range may now be out of range
- Those buildings start draining battery
- If storm lasts 3+ sols, batteries deplete and buildings shut down

### Technology Interaction

"Improved Power Grid" tech still adds +1 range to all sources, helping maintain coverage during reduced-output events.

---

## Implementation Scope

### Files to Delete

- `src/core/systems/PowerGridManager.ts`
- `src/core/balance/PowerGridBalance.ts`
- `src/core/tick/phases/powerGrid.ts`
- `src/renderer/components/PowerGridPanel/PowerGridPanel.vue`

### Files to Modify

#### Core Systems

- `GameState.ts` - Remove PowerGridManager instantiation and state
- `BuildingManager.ts` - Remove `powerGridEfficiency` field and setter, add power state gate
- `GridManager.ts` - Add `outputModifier` support for events

#### Tick Phases

- `src/core/tick/phases/index.ts` - Remove `calculatePowerGrid` phase
- `src/core/tick/phases/grid.ts` - May need adjustment for new output modifier

#### Facades

- `PowerGridFacade.ts` - Delete or repurpose for grid-only queries
- `GridFacade.ts` - Add methods for power coverage queries

#### UI

- `GameService.ts` - Remove powerGrid state fields, add building power state tracking
- `GridView.vue` (or equivalent) - Add power coverage overlay, building indicators
- Main layout - Remove PowerGridPanel from sidebar

#### Events

- Event definitions using flat power changes need migration to percentage modifiers

### New Components

- Power coverage overlay renderer (canvas or SVG layer on grid)
- Building power state indicator component

### Tests to Update

- Any tests referencing `PowerGridManager` or `powerGridEfficiency`
- Add tests for binary off behavior when unpowered
