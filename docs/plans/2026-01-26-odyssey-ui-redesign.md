# Odyssey UI Redesign

**Goal:** Transform the Mars Colony UI from a dark sci-fi theme to a 2001: A Space Odyssey inspired aesthetic - light backgrounds, monospace typography, color-coded sections, and sharp geometric panels.

**Inspiration:** 2001: A Space Odyssey interfaces (pod dashboard, vital signs charts, Logic Memory Center badge), Habita smart home UI.

---

## Design Principles

1. **Light-dominant** - White/off-white backgrounds, colored elements pop
2. **Monospace throughout** - Terminal/readout feel for data-heavy interface
3. **Multi-color coded** - Each section gets its own accent color for quick visual parsing
4. **Sharp geometry** - No border-radius anywhere, 90° corners only
5. **Solid header blocks** - Like vital signs labels, strong visual anchors
6. **Outlined content areas** - Subtle 1px borders creating grid structure

---

## Color System

### Base Palette

```css
--odyssey-bg-base: #FFFFFF;           /* Pure white background */
--odyssey-bg-surface: #F5F5F5;        /* Slight off-white for panels */
--odyssey-bg-elevated: #FAFAFA;       /* Cards/modals */

--odyssey-text: #1A1A1A;              /* Near-black text */
--odyssey-text-muted: #666666;        /* Secondary text */
--odyssey-border: #E0E0E0;            /* Subtle borders */
--odyssey-border-strong: #BDBDBD;     /* Emphasized borders */
```

### Section Accent Colors

```css
--odyssey-accent-red: #D32F2F;        /* Resources, alerts, critical systems */
--odyssey-accent-cyan: #00838F;       /* Technology, research, data */
--odyssey-accent-olive: #827717;      /* Colony, population, organic systems */
--odyssey-accent-amber: #F57C00;      /* Operations, actions, warnings */
--odyssey-accent-slate: #455A64;      /* Politics, factions, neutral info */
```

### Semantic Colors

```css
--odyssey-positive: #2E7D32;          /* Green - growth, success */
--odyssey-negative: #C62828;          /* Deep red - danger, loss */
--odyssey-warning: #EF6C00;           /* Orange - caution */
```

### Section-to-Color Mapping

| Section | Accent Color | Usage |
|---------|--------------|-------|
| Resources | `--odyssey-accent-red` | Resource panel, critical alerts |
| Buildings | `--odyssey-accent-amber` | Building panel, construction |
| Technology | `--odyssey-accent-cyan` | Research, tech tree |
| Colony | `--odyssey-accent-olive` | Colonists, population |
| Politics | `--odyssey-accent-slate` | Factions, decisions |
| Operations | `--odyssey-accent-amber` | Missions, policies |

---

## Typography

### Font Stack

```css
--odyssey-font-primary: "JetBrains Mono", "Fira Code", "SF Mono", "Consolas", monospace;
```

### Type Scale

```css
--odyssey-text-xs: 0.625rem;    /* 10px - tiny labels, badges */
--odyssey-text-sm: 0.75rem;     /* 12px - secondary info, metadata */
--odyssey-text-md: 0.875rem;    /* 14px - body text, default */
--odyssey-text-lg: 1rem;        /* 16px - panel headers */
--odyssey-text-xl: 1.25rem;     /* 20px - page titles */
--odyssey-text-2xl: 1.5rem;     /* 24px - major displays (Sol counter) */
```

### Text Treatment

| Context | Case | Letter-spacing | Weight |
|---------|------|----------------|--------|
| Headers | ALL CAPS | 0.1em | 600 |
| Labels | ALL CAPS | 0.05em | 500 |
| Body | Normal | 0.01em | 400 |
| Data/numbers | Normal | 0 (tabular) | 400 |

---

## Component Specifications

### Panel Structure

```
┌─────────────────────────────────────────┐
│ PANEL HEADER          │ solid color block, white text, 40-48px height
├─────────────────────────────────────────┤
│                                         │
│  Content area                           │
│  --odyssey-bg-base with 1px border      │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Nested card                      │   │
│  │ --odyssey-bg-surface             │   │
│  │ 1px --odyssey-border             │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

### Buttons

| Variant | Background | Text | Border |
|---------|------------|------|--------|
| Primary | Section accent | White | None |
| Secondary | White | Section accent | 1px accent |
| Danger | `--odyssey-negative` | White | None |
| Disabled | Any | 50% opacity | - |

**States:**
- Hover: `filter: brightness(0.95)`
- Active: `filter: brightness(0.9)`
- Focus: 2px outline offset

### Progress Bars

- No border-radius (square ends)
- Subtle vertical grid lines inside (every 10%)
- Fill color matches section accent
- Background: `--odyssey-bg-surface` with 1px border
- Height: 8-12px for inline, 16-24px for prominent displays

### Status Indicators

- Small squares (8x8px), not circles
- Colors: green=active, red=critical, amber=warning, gray=inactive
- Optional pulse animation for critical states

### Data Tables

- Alternating rows: white / `--odyssey-bg-surface`
- Thin horizontal dividers (1px `--odyssey-border`)
- Header row: ALL CAPS, `--odyssey-text-muted`, bottom border
- Left-aligned text, right-aligned numbers

---

## Layout Structure

### Header Bar

```
┌──────────────────────────────────────────────────────────┐
│  MARS COLONY                    SOL 247        [+1] [+10]│
│  (accent-red, ALL CAPS)         (2xl, bold)    (buttons) │
└──────────────────────────────────────────────────────────┘
```

- White background, subtle bottom border
- Logo/title in `--odyssey-accent-red`
- Sol counter prominent, monospace numerals

### Tab Navigation

- Horizontal tabs, ALL CAPS labels
- Active: 2-3px colored bottom border (section accent)
- Inactive: `--odyssey-text-muted`, no decoration
- Hover: subtle background `--odyssey-bg-surface`

### Content Grid

```
┌─────────────────────────────────────────┬────────────────┐
│                                         │                │
│  Main content area                      │  EVENT LOG     │
│  CSS Grid, 16px gap                     │  (sidebar)     │
│                                         │                │
└─────────────────────────────────────────┴────────────────┘
```

---

## Resource Display (Vital Signs Style)

```
┌──────────────┬─────────────────────────────────────┐
│   FOOD       │ ████████████░░░░░░░░  847  +12/sol │
│  (red block) │ (progress bar with grid lines)      │
├──────────────┼─────────────────────────────────────┤
│   OXYGEN     │ ██████████████████░░  1,204  +3/sol│
│  (cyan block)│                                     │
└──────────────┴─────────────────────────────────────┘
```

Each resource gets a colored label block on the left, with the progress bar and data to the right.

---

## Implementation Scope

### Phase 1: Foundation (Theme + Primitives)

1. `src/renderer/ui/tokens/theme.css` - New color system
2. `src/renderer/App.vue` - Global styles, body background
3. `src/renderer/ui/primitives/GButton.vue`
4. `src/renderer/ui/primitives/GPanel.vue`
5. `src/renderer/ui/primitives/GProgress.vue`
6. `src/renderer/ui/primitives/GBadge.vue`
7. `src/renderer/ui/primitives/GInput.vue`
8. `src/renderer/ui/primitives/GSelect.vue`

### Phase 2: Composites

1. `src/renderer/ui/composites/ResourceBadge.vue`
2. `src/renderer/ui/composites/BuildingCard.vue`
3. `src/renderer/ui/composites/GActionCard.vue`
4. `src/renderer/ui/composites/CountdownTimer.vue`

### Phase 3: Feature Components

1. `src/renderer/components/GameHeader.vue`
2. `src/renderer/components/TabNav.vue`
3. `src/renderer/components/EventLogSidebar.vue`
4. `src/renderer/components/ResourcePanel/ResourcePanel.vue`
5. Remaining ~30 feature components (most inherit from primitives)

### Phase 4: Polish

1. Modals (EventModal, GameOverModal, DecisionModal)
2. Special visualizations (TechTreeGraph, NPCGraph)
3. Responsive adjustments
4. Animation/transition refinements

---

## Visual Reference Summary

| Element | 2001 Reference |
|---------|----------------|
| Panel headers | Vital signs colored labels |
| Data displays | Vital signs waveform charts |
| Buttons/controls | Pod dashboard illuminated buttons |
| Typography | Logic Memory Center signage |
| Overall feel | Clean, technical, high-contrast |
