# Victory Progress Panel Design

## Overview

A new panel on the Politics tab showing progress toward each faction's victory path. Displays project completion, council seat status, and actionable next steps for all three factions side-by-side.

## Layout

```
┌─ Victory Progress ──────────────────────────────────────────────────────┐
│                                                                         │
│  ┌─ Earth Loyalists ─┐  ┌─ Mars Independence ─┐  ┌─ Corporate ────────┐ │
│  │                   │  │                     │  │                    │ │
│  │  [project list]   │  │   [project list]    │  │  [project list]    │ │
│  │                   │  │                     │  │                    │ │
│  │  [council bar]    │  │   [council bar]     │  │  [council bar]     │ │
│  │                   │  │                     │  │                    │ │
│  │  [next step]      │  │   [next step]       │  │  [next step]       │ │
│  │                   │  │                     │  │                    │ │
│  └───────────────────┘  └─────────────────────┘  └────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

Each faction track is a vertical card with:
1. **Header** - Faction name with its signature color (blue/green/yellow)
2. **Projects section** - 3 prerequisites + capstone at bottom
3. **Council section** - Visual bar showing seats vs 65% threshold
4. **Next step** - Single actionable callout

## Projects Section

Each prerequisite project shows its name and status. The capstone appears at the bottom, visually separated as the "goal."

**Project statuses:**
- **Passed** (✓) - Green checkmark, muted text
- **Pending** - Blue "Vote in X sols" badge, normal text
- **Available** - Can propose now, shown with current support %
- **Locked** - Grayed out, shows what's blocking (support threshold)

```
Projects (2/3)
─────────────────────────
✓ Earth Memorial
✓ Heritage Archive
○ Generation Ship
  35% support needed (current: 28%)

─────────────────────────
CAPSTONE: Return Mission
  Requires: 3/3 projects, 65% council
```

The capstone row only becomes "active" (non-grayed) when all prerequisites are passed. It shows the two requirements inline: project count and council threshold.

## Council Section

Shows current seats as a visual bar with the 65% threshold marked.

```
Council Seats
─────────────────────────
[▓▓▓░░░░░░░|░░░░░] 3/10
         ↑ 65%

Need 4 more seats for capstone
```

**Visual elements:**
- **Filled segments** - Seats this faction holds (faction color)
- **Empty segments** - Seats held by others
- **Threshold marker** - The 65% line
- **Numeric label** - "3/10" showing exact count

**Status text below the bar:**
- Below threshold: "Need X more seats for capstone"
- At/above threshold: "Council majority secured ✓"

## Next Step Callout

A single line telling the player exactly what to do next.

**Logic (in priority order):**

1. **Capstone ready** → "Propose [Capstone] to win!"
2. **Capstone pending** → "[Capstone] vote in X sols"
3. **Projects incomplete + can propose one** → "Propose [Project Name]"
4. **Projects incomplete + support too low** → "Raise support to X% to propose [Project Name]"
5. **Projects complete but seats insufficient** → "Gain X more council seats"
6. **Project pending vote** → "[Project Name] vote in X sols"

**Visual style:**
- Arrow prefix (→) to indicate action
- Uses faction color for emphasis
- Bold the project/action name

## Data Requirements

**From game state (`gameService.getState().ideology`):**
- `completedProjects` - which projects are passed
- `pendingProposals` - which are awaiting vote (with `voteSol`)
- `factionSupport` - current support levels per faction
- `council` - current council members
- `councilFactionCounts` - seats per faction

**From static data (`PROJECTS`):**
- Project definitions including `requiredSupport`, `prerequisites`, `isCapstone`, `requiredCouncilSupport`

## Computed Helpers

```typescript
type ProjectStatus = 'passed' | 'pending' | 'available' | 'locked';

function getProjectStatus(projectId: ProjectId): ProjectStatus;
function getNextStep(faction: NPCFaction): { action: string; detail?: string };
function getSeatsNeeded(faction: NPCFaction): number;
```

## Component Structure

**New files:**
- `src/renderer/components/VictoryProgressPanel/VictoryProgressPanel.vue`
- `src/renderer/components/VictoryProgressPanel/FactionTrack.vue`
- `src/renderer/components/VictoryProgressPanel/index.ts`

**Placement:**
- Added to `PoliticsTab.vue` above the existing two-column grid

## Styling

- Uses existing design system (`GPanel`, `GBadge`, CSS variables)
- Faction colors match existing Politics panel:
  - Earth Loyalists: `var(--color-info)` (blue)
  - Mars Independence: `var(--color-positive)` (green)
  - Corporate Interests: `var(--color-warning)` (yellow)
- Responsive: stacks vertically on screens < 1200px

## Faction Victory Paths

### Earth Loyalists
Prerequisites:
1. Earth Memorial (20% support)
2. Heritage Archive (35% support)
3. Generation Ship (35% support)

Capstone: Return Mission (65% council)

### Mars Independence
Prerequisites:
1. Universal Housing (35% support)
2. Healthcare Expansion (35% support)
3. Democratic Assembly (35% support)

Capstone: Declaration of Sovereignty (65% council)

### Corporate Interests
Prerequisites:
1. Labor Efficiency (20% support)
2. Mining Concession (35% support)
3. AI Governance (35% support)

Capstone: Planetary Acquisition (65% council)
