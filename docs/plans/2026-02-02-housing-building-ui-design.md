# Housing Building UI Design

## Overview

Add inline housing building directly in the HousingSection panel and OperationsPage, removing Residential from the BuildingPanel category tabs. A shared `BuildableHousingCard` component handles the build UI in both locations.

## Components

### BuildableHousingCard.vue (new, shared)

Compact horizontal card for buildable residential buildings.

**Props:**
- `definition: BuildingDefinition` - the housing building definition
- `canBuild: boolean` - whether building is currently allowed
- `buildReason?: string` - reason why building is blocked (for tooltip)
- `pendingCount: number` - number currently in construction queue

**Displays:**
- Building name
- Capacity (e.g., "4 beds")
- Material cost
- Build button (disabled with tooltip when `!canBuild`)
- Pending indicator if any in queue

**Events:**
- `@build` - emitted when Build button clicked
- `@hover` / `@leave` - for resource highlighting

### HousingSection.vue (modified)

Add "Build New Housing" section at top of panel, before the housing layout.

```vue
<template>
  <GPanel title="Housing">
    <!-- NEW: Build section -->
    <div class="build-housing-section">
      <div class="section-header">Build New Housing</div>
      <div class="buildable-list">
        <BuildableHousingCard
          v-for="def in residentialDefinitions"
          :key="def.id"
          :definition="def"
          :can-build="canBuild(def.id)"
          :build-reason="getBuildReason(def.id)"
          :pending-count="getPendingCount(def.id)"
          @build="buildBuilding(def.id)"
          @hover="onBuildingHover(def)"
          @leave="onBuildingLeave"
        />
      </div>
    </div>

    <!-- Existing: housing controls and layout -->
    <div class="housing-controls">...</div>
    <div class="housing-layout">...</div>
  </GPanel>
</template>
```

**New computed:**
- `residentialDefinitions` - filter `buildingDefinitions` to `purpose === Residential` and tech unlocked

**New methods (same pattern as BuildingPanel):**
- `canBuild(defId)` - calls `api.buildings.canBuild()`
- `getBuildReason(defId)` - returns reason string
- `buildBuilding(defId)` - calls `api.buildings.build()`
- `getPendingCount(defId)` - count in `pendingBuildings`
- `onBuildingHover/Leave` - resource highlighting

### OperationsPage.vue (modified)

Add a Housing section using the same BuildableHousingCard component.

```vue
<template>
  <div class="operations-page">
    <BuildingPanel />

    <!-- NEW: Housing section -->
    <GPanel title="Housing" accent="amber">
      <div class="buildable-list">
        <BuildableHousingCard
          v-for="def in residentialDefinitions"
          ...
        />
      </div>
    </GPanel>

    <GPanel title="Workforce Assignment" accent="amber">
      ...
    </GPanel>
  </div>
</template>
```

### BuildingPanel.vue (modified)

Remove Residential from category tabs.

**Changes:**
- Remove `BuildingPurpose.Residential` from `countsByPurpose`
- Default `selectedCategory` stays as `Industrial`
- Filter out Residential buildings from `availableBuildings` or `filteredBuildings`

### CategoryTabs.vue (modified if needed)

May need to conditionally hide Residential tab if it has no buildings.

## Data Flow

```
Both HousingSection and OperationsPage:
  └── BuildableHousingCard
        ├── reads: buildingDefinitions (filtered to Residential)
        ├── reads: api.buildings.canBuild()
        ├── calls: api.buildings.build()
        └── calls: highlightResources() on hover
```

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/components/ColonyView/BuildableHousingCard.vue` | New component |
| `src/renderer/components/ColonyView/HousingSection.vue` | Add build section |
| `src/renderer/components/OperationsPage/OperationsPage.vue` | Add housing panel |
| `src/renderer/components/BuildingPanel/BuildingPanel.vue` | Remove Residential |
| `src/renderer/components/BuildingPanel/CategoryTabs.vue` | Hide Residential tab |

## Visual Design

BuildableHousingCard layout (compact, horizontal):

```
┌──────────────────────────────────────────────────────┐
│ Habitat Module          4 beds    50 materials [Build] │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ Advanced Habitat        8 beds   120 materials [Build] │
│                                          (1 pending)   │
└──────────────────────────────────────────────────────┘
```

When locked (tech not researched), card is dimmed with lock icon and tech name.
When can't afford, Build button disabled with tooltip showing missing resources.
