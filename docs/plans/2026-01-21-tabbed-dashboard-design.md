# Tabbed Dashboard Design

## Problem

The current dashboard displays 8 panels simultaneously, making the interface feel cluttered and overwhelming. Players have difficulty focusing on what matters.

## Solution

Reorganize the dashboard into a tabbed interface with two tabs grouped by frequency of use, plus an always-visible EventLog sidebar.

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Header (Title, Sol, Actions)                               │
├─────────────────────────────────────────────────────────────┤
│  TabNav: [Main] [Strategy]                                  │
├───────────────────────────────────────────┬─────────────────┤
│                                           │                 │
│  <router-view>                            │  EventLog       │
│  (MainTab or StrategyTab)                 │  Sidebar        │
│                                           │  (~280px)       │
│                                           │                 │
└───────────────────────────────────────────┴─────────────────┘
```

## Tab Content

### Main Tab (`/main`)
Core gameplay panels checked frequently:
- ResourcePanel
- ColonyPanel
- BuildingPanel

Layout: 2-column grid
- Left (~40%): ResourcePanel, ColonyPanel (stacked)
- Right (~60%): BuildingPanel

### Strategy Tab (`/strategy`)
Strategic panels checked less often:
- TechnologyPanel
- PoliticsPanel
- OperationsPanel
- NPCInfluencePanel

Layout: 2-column grid, equal widths
- Left: TechnologyPanel, PoliticsPanel (stacked)
- Right: OperationsPanel, NPCInfluencePanel (stacked)

## Component Structure

```
App.vue
├── GameHeader.vue (extracted from App.vue)
├── TabNav.vue (tab bar using <router-link>)
├── <router-view>
│   ├── MainTab.vue
│   │   ├── ResourcePanel.vue
│   │   ├── ColonyPanel.vue
│   │   └── BuildingPanel.vue
│   └── StrategyTab.vue
│       ├── TechnologyPanel.vue
│       ├── PoliticsPanel.vue
│       ├── OperationsPanel.vue
│       └── NPCInfluencePanel.vue
└── EventLogSidebar.vue
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | redirect | Redirects to `/main` |
| `/main` | MainTab.vue | Resources, Colony, Buildings |
| `/strategy` | StrategyTab.vue | Tech, Politics, Operations, NPC |

## Tab Bar Behavior

- Active tab has bottom border accent (`#e94560`) and brighter text
- Inactive tabs have muted text, brighten on hover
- Default to Main tab on page load and new game
- Browser back/forward navigation works

### Optional: Notification Badges
- Small colored dot when something noteworthy happened on inactive tab
- Example: Strategy tab badge when faction relationship changes
- Badge clears when tab is clicked
- Nice-to-have for later iteration

## EventLog Sidebar

- Fixed 280px width on right side
- Full height of content area
- Independently scrollable
- Sticky "Event Log" header
- Most recent events at top

### Responsive (<1024px)
- Sidebar collapses to floating button in bottom-right
- Click opens EventLog as slide-out drawer

## Responsive Behavior

### Tablet (<1024px)
- EventLog becomes floating button / drawer
- Tab content uses full width

### Mobile (<768px)
- Single-column layout for both tabs
- MainTab stacks: Resources → Colony → Buildings
- StrategyTab stacks: Technology → Politics → Operations → NPC Influence

## Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/router.ts` | Vue Router configuration |
| `src/renderer/components/GameHeader.vue` | Header extracted from App.vue |
| `src/renderer/components/TabNav.vue` | Tab bar with router-links |
| `src/renderer/components/EventLogSidebar.vue` | Sidebar variant of EventLog |
| `src/renderer/components/MainTab.vue` | Container for main panels |
| `src/renderer/components/StrategyTab.vue` | Container for strategy panels |

## Files to Modify

| File | Changes |
|------|---------|
| `src/main.ts` | Add router to Vue app |
| `src/renderer/App.vue` | Simplify to use new components and router-view |
| `package.json` | Add vue-router dependency |

## Files Unchanged

- All existing panel components
- GameService and core game logic
- EventModal, GameOverModal

## Dependencies

```bash
bun add vue-router
```
