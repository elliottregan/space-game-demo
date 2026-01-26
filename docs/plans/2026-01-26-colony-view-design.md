# Colony View Design

A text-based dashboard providing a comprehensive view of all buildings, their workers, and colonist housing assignments.

## Overview

New "Colony View" tab displaying:
- Colony stats bar (population, health, morale)
- Housing section with habitats and residents
- Building sections grouped by category with full stats
- Unhoused colonists warning section

## Data Model Changes

### Colonist Model

Add housing assignment tracking:

```typescript
interface Colonist {
  // ... existing fields
  housingId?: string;  // Building ID of assigned habitat
}
```

### Building Definition

Add generic capacity field:

```typescript
interface BuildingDefinition {
  // ... existing fields
  capacity?: number;  // Housing capacity for habitats
}
```

## Automatic Housing Logic

Implemented in `ColonyManager`:

- **On colonist join**: Assign to first habitat with available capacity
- **On habitat built**: Reassign any unhoused colonists
- **On habitat destroyed**: Reassign displaced colonists to other habitats
- **No capacity available**: Colonist has no `housingId`, shown in "Unhoused" section

## Page Layout

```
┌─────────────────────────────────────────────┐
│ COLONY VIEW                                 │
├─────────────────────────────────────────────┤
│ Colony Stats Bar                            │
│ Population: 24 | Health: 85% | Morale: 72%  │
├─────────────────────────────────────────────┤
│ HOUSING                                     │
│ ├─ Habitat #1 (3/4)        [Active]        │
│ │   └─ Alex Chen, Jordan Kim...            │
│ ├─ Habitat #2 (4/4)        [Active]        │
│ │   └─ ...                                 │
│ └─ Unhoused (2 colonists)                  │
├─────────────────────────────────────────────┤
│ PRODUCTION                                  │
│ ├─ Basic Farm #1           [Active]        │
│ └─ ...                                     │
├─────────────────────────────────────────────┤
│ INFRASTRUCTURE                              │
│ ├─ Solar Panel #1          [Active]        │
│ └─ ...                                     │
├─────────────────────────────────────────────┤
│ RECREATION                                  │
│ └─ ...                                     │
└─────────────────────────────────────────────┘
```

### Building Categories

- **Housing** - Habitats (special handling with residents)
- **Production** - Farms, water extractors, oxygen generators
- **Infrastructure** - Solar panels, mining stations
- **Recreation** - Buildings with `moraleBoost`
- **Research** - Labs

## Building Entry Details

Each building displays:

```
┌─────────────────────────────────────────────────────────┐
│ Basic Farm #1                        [Active] ⚙️ 92%    │
│ Production: +3 food/sol  |  Consumption: -1 water/sol  │
│ Efficiency: 100%  |  Condition: 92%                    │
├─────────────────────────────────────────────────────────┤
│ Workers (2/3):                                         │
│  • Alex Chen      Farmer (Skilled)    🌱 Botany        │
│  • Jordan Kim     Engineer (Novice)   🔧 Mechanics     │
└─────────────────────────────────────────────────────────┘
```

### Status Badges

- `[Active]` - green
- `[Under Construction]` - yellow with progress bar
- `[Disabled]` - gray
- `[Broken]` - red
- `[Recycling]` - orange

### Worker Row Content

- Colonist name
- Current role + mastery level
- Relevant skills matching building's work type
- Empty slots shown as `• (Empty slot)`

## Habitat Entry Details

Habitats show residents instead of workers:

```
┌─────────────────────────────────────────────────────────┐
│ Habitat #1                           [Active] ⚙️ 100%   │
│ Residents: 3/4                                         │
├─────────────────────────────────────────────────────────┤
│  • Alex Chen                                           │
│    Farmer (Skilled) → Works at: Basic Farm #1          │
│    Skills: 🌱 Botany, 🔬 Chemistry                      │
│                                                        │
│  • Jordan Kim                                          │
│    Engineer (Novice) → Works at: Solar Panel #2        │
│    Skills: 🔧 Mechanics, ⚡ Electronics                 │
│                                                        │
│  • Casey Okafor                                        │
│    Unassigned                                          │
│    Skills: 🔬 Chemistry, 📊 Analytics                   │
└─────────────────────────────────────────────────────────┘
```

## Unhoused Section

Displayed when population exceeds habitat capacity:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ Unhoused (2 colonists)                               │
├─────────────────────────────────────────────────────────┤
│  • Riley Martinez                                      │
│    Researcher (Expert) → Works at: Research Lab #1     │
│    Skills: 🔬 Chemistry, 🧬 Genetics                    │
└─────────────────────────────────────────────────────────┘
```

## Implementation Structure

### New Files

```
src/renderer/components/ColonyView/
├── ColonyViewTab.vue       # Main tab container
├── ColonyStatsBar.vue      # Top stats bar
├── BuildingSection.vue     # Collapsible category section
├── BuildingEntry.vue       # Individual building card
├── HabitatEntry.vue        # Habitat card with residents
├── ColonistRow.vue         # Colonist info row (reusable)
└── UnhousedSection.vue     # Warning section
```

### Core Changes

```
src/core/models/Colonist.ts
  - Add housingId?: string

src/core/models/Building.ts
  - Add capacity?: number to BuildingDefinition

src/core/systems/ColonyManager.ts
  - Add assignHousing() method
  - Add getUnhousedColonists() method
  - Update addColonist() to auto-assign housing
  - Add reassignHousing() for habitat changes

src/core/data/buildings.ts
  - Add capacity values to habitat definitions
```

### Tab Registration

Add "Colony View" to `TabNav.vue`.

## Out of Scope

- Morale/health penalties for unhoused colonists (future task)
- Manual housing reassignment by player
- Per-colonist health/morale tracking
