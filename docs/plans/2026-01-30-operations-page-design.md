# Operations Page Design

## Overview

A new top-level tab for managing workforce assignments to buildings. Provides a side-by-side drag-and-drop interface where players can see available colonists and buildings together, with skill match highlighting to help optimize assignments.

## Motivation

- **ColonyViewTab** shows buildings and assigned workers, but read-only
- **OperationsPanel** has a Buildings tab that's just a placeholder
- No UI exists to actually assign/unassign colonists to buildings
- Clear separation: Colony = housing/people, Operations = work assignments

## Layout

Two-panel side-by-side design:

```
┌─────────────────────────────────────────────────────────┐
│  OPERATIONS                                             │
├────────────────────────┬────────────────────────────────┤
│  AVAILABLE COLONISTS   │  BUILDINGS BY ROLE             │
│                        │                                │
│  [Colonist cards       │  ▼ FARMING (2 buildings)       │
│   showing name,        │    [Building with worker slots]│
│   skills, badges]      │    [Building with worker slots]│
│                        │                                │
│  • Drag to assign →    │  ▼ RESEARCH (1 building)       │
│  • Click to select     │    [Building with worker slots]│
│                        │                                │
│                        │  ▼ ENGINEERING (3 buildings)   │
│                        │    ...                         │
└────────────────────────┴────────────────────────────────┘
```

- **Left panel**: Unassigned colonists available for work
- **Right panel**: Buildings grouped by required worker role, collapsible sections

## Colonist Cards

Each card displays:

```
┌─────────────────────────────┐
│ Elena Rodriguez        ⚙️   │  ← Name + role icon
│ ┌─────┐ ┌─────┐            │
│ │ 🔧  │ │ 🌱  │            │  ← Skill badges
│ │Mech │ │Botny│            │
│ └─────┘ └─────┘            │
│ Apprentice                  │  ← Mastery level
└─────────────────────────────┘
```

**Interaction states:**
- **Default**: Subtle border, draggable
- **Hover**: Elevated shadow, cursor changes to grab
- **Dragging**: Semi-transparent, follows cursor
- **Selected** (clicked): Highlighted border, buildings update to show compatibility

## Building Cards & Worker Slots

Buildings grouped by role with collapsible headers:

```
▼ FARMING (2 buildings, 3/4 workers)
┌─────────────────────────────────────────────┐
│ Basic Farm #1                    ⚡ Normal  │
│ Production: +10 food/sol                    │
│ ┌─────────────┐ ┌─────────────┐            │
│ │ Chen Wei    │ │ + Empty     │            │
│ │ 🌱 Botany   │ │   Slot      │            │
│ │      ✕      │ │             │            │
│ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────┘
```

**Worker slot states:**
- **Filled**: Colonist name, relevant skill badge, ✕ button to unassign
- **Empty**: Dashed border, "+" icon, drop target for drag
- **Drop hover**: Highlighted border when valid colonist dragged over
- **Invalid drop**: Red tint if colonist's role doesn't match

**Section headers**: Show aggregate stats (total buildings, workers assigned vs total slots)

## Skill Match Highlighting

When a colonist is selected or being dragged, buildings update to show compatibility:

```
▼ FARMING (2 buildings)
┌─────────────────────────────────────────────┐
│ Basic Farm #1                 ★ +15% bonus │ ← Green highlight
│ Production: +10 food/sol                    │
│ ┌─────────────┐ ┌─────────────┐            │
│ │ Chen Wei    │ │ ✦ Drop here │            │ ← Empty slot pulses
│ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────┘

▼ RESEARCH (1 building)
┌─────────────────────────────────────────────┐
│ Research Lab #1                    Ø       │ ← Dimmed (incompatible)
└─────────────────────────────────────────────┘
```

**Visual states:**
- **Skill match**: Green border/glow, shows "+X% bonus" based on skill
- **Role match, no skill bonus**: Normal appearance, valid drop target
- **Incompatible role**: Dimmed/grayed out, not a drop target
- **Full building**: Shows "Full" badge, not a drop target

## Unassign Interaction

Two methods supported:
1. **Drag back**: Drag colonist from building slot back to the available colonists panel
2. **Click button**: Click ✕ button on filled worker slot

## Component Structure

```
src/renderer/components/OperationsPage/
├── OperationsPage.vue        # Main page container
├── ColonistPool.vue          # Left panel - available colonists
├── ColonistDragCard.vue      # Draggable colonist card
├── BuildingRoleGroup.vue     # Collapsible building section
├── BuildingWorkSlots.vue     # Building card with drop slots
└── WorkerSlot.vue            # Individual slot (filled/empty)
```

## Technical Approach

**State management:**
- Read building/colonist data from `GameService.getState()`
- Assignments via `GameService.api` facade methods
- Drag state managed locally with Vue `ref`

**Drag-and-drop:**
- Native HTML5 drag-and-drop API (no library)
- `draggable="true"` on colonist cards
- `@dragover`, `@drop` handlers on worker slots

**Navigation:**
- Add new tab to `TabNav.vue`

## Out of Scope

- Filtering/sorting colonists (can add later)
- Building mode controls (stays in BuildingPanel)
- Auto-assign feature
