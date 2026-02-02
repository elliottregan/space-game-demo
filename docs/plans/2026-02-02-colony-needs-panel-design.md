# Colony Needs Panel Design

## Overview

A left sidebar panel on the Base tab that displays critical colony needs requiring immediate building action. When all needs are met, it shows a positive "Colony stable" state.

## Specification

### Location & Visibility

- **Position:** Left side of the grid, fixed width (200px)
- **Visibility:** Always visible — shows needs or "all good" state
- **Layout:** Flex sibling of grid container

### Needs Detection

The panel tracks 5 critical needs, sorted by priority:

| Priority | Need | Trigger | Recommended Building |
|----------|------|---------|---------------------|
| 1 | Housing | Unhoused colonists > 0 | Habitat |
| 2 | Air | Air contribution < population × 0.5 | Oxygen Generator |
| 3 | Food | Food production ≤ food consumption | Basic Farm |
| 4 | Water | Water production ≤ water consumption | Water Extractor |
| 5 | Power | Grid strain ≥ 90% | Solar Panel |

Housing and air are highest priority since they directly cause colonist death.

### Display Format

Each need shows:
- Icon + label (e.g., "🏠 Housing")
- Brief reason (e.g., "3 unhoused")
- Recommended building (e.g., "→ Build Habitat")

### States

**Needs present:**
```
┌─────────────────────┐
│ NEEDS               │
├─────────────────────┤
│ 🏠 Housing          │
│ 3 unhoused          │
│ → Build Habitat     │
├─────────────────────┤
│ 🌬️ Air Quality      │
│ Contribution low    │
│ → Build O₂ Gen      │
└─────────────────────┘
```

**All needs met:**
```
┌─────────────────────┐
│ NEEDS               │
├─────────────────────┤
│ ✓ Colony stable     │
│ No immediate needs  │
└─────────────────────┘
```

### Styling

- Surface background with border (matches existing panels)
- Warning items: subtle left border accent using `--color-warning`
- "All good" state: uses `--color-positive` for checkmark

### Interaction

v1: Display only, no click actions.

Future consideration: Clicking a need could highlight the recommended building in the context menu.

## Implementation

### New Files

- `src/renderer/components/BaseGrid/ColonyNeedsPanel.vue`

### Modified Files

- `src/renderer/components/BaseTab.vue` — import panel, add to layout

### Data Flow

Computed properties derive needs from existing `gameService.getState()`:

```typescript
// Housing
const unhoused = state.colonists.length - totalHousingCapacity;
const needsHousing = unhoused > 0;

// Air
const airContribution = state.buildings.totalAirContribution;
const needsAir = airContribution < state.population * 0.5;

// Food
const needsFood = state.resourceProduction.food <= state.resourceConsumption.food;

// Water
const needsWater = state.resourceProduction.water <= state.resourceConsumption.water;

// Power
const needsPower = state.powerGrid.gridStrain >= 0.9;
```

### Layout Change in BaseTab.vue

```vue
<template>
  <div class="base-tab">
    <header>...</header>

    <div class="base-content">
      <ColonyNeedsPanel :needs="colonyNeeds" />
      <div class="grid-container">
        <BaseGrid ... />
      </div>
    </div>
  </div>
</template>

<style>
.base-content {
  display: flex;
  flex: 1;
  gap: var(--g-space-md);
  overflow: hidden;
}
</style>
```

## Out of Scope

- Click-to-build interaction
- "Nice to have" suggestions (morale, unused deposits)
- Dismissable/collapsible panel
- Sound/animation alerts
