# District Grants System

## Purpose

Replace the current Project system (18 ideology-gated council-voted proposals in `IdeologyManager`) and Grant system (15 external grants in `GrantManager`) with a unified **District Grant** system. Players assign grants to districts, where colonists work to complete them. Completing grants develops district identity and advances victory paths.

## Discussion

[GitHub Discussion #127](https://github.com/elliottregan/space-game-demo/discussions/127)

## Replaces

- `src/core/systems/GrantManager.ts` (entire file)
- `src/core/data/grants.ts` (entire file)
- `src/core/models/Grant.ts` (entire file)
- `src/core/balance/GrantBalance.ts` (entire file)
- `src/core/data/projects.ts` (entire file)
- Project-related methods in `src/core/systems/IdeologyManager.ts`
- `src/renderer/components/ProjectsPanel/ProjectsPanel.vue` (repurposed)

## Design Decisions

These were settled through persona-based discussion analysis:

| Question | Decision | Rationale |
|----------|----------|-----------|
| Infrastructure ideology effects? | Mild ideology tint | Each infrastructure grant nudges district ideology slightly. Prevents "always-correct free lunches." |
| Identity grant approval mechanism? | Completion-based (no council vote) | Player funds the grant, colonists work on it over time. Speed scales with ideology alignment. |
| Specialization bonuses? | Reward specialization | 3+ same-axis grants give synergy bonuses. Hybrid districts work but get no extra bonus. |
| Effect scope? | District-scoped | Infrastructure grant effects apply to the assigned district only. |
| Grant sources? | Keep for infrastructure | Infrastructure grants come from named external sources. Identity grants come from the district's aligned faction. |
| UI location? | Dedicated grants panel | Shows 3 grant cards at a time. Player assigns one to a district. Completed grants appear on district cards. |
| Victory path? | Colony-wide faction progress track | All identity grants across all districts contribute to one progress bar per faction axis. |
| Panel card mix? | Mixed pool | 3 random grants drawn from both identity and infrastructure. |
| Refresh behavior? | Auto-fill on completion | Completing a grant auto-fills the empty slot. Refresh button rerolls all 3 for a resource cost. |
| District active limit? | No limit | Districts can work on as many grants as assigned. |
| Completion speed? | Ideology scales speed | Strong alignment ~20 sols, weak alignment ~60 sols. Misaligned districts can't start identity grants. |

## Core Loop

```
Panel shows 3 grant cards (mixed identity + infrastructure)
  → Player assigns a grant to a district
  → Colonists work on it (duration based on ideology alignment for identity, fixed for infrastructure)
  → Grant completes → district gains identity tag + effects
  → Empty panel slot auto-fills with new random grant
  → Player can pay resources to reroll all 3 panel cards
```

## Models

### Grant Category

```typescript
export enum DistrictGrantCategory {
  IDENTITY = "identity",
  INFRASTRUCTURE = "infrastructure",
}
```

### Grant Template

```typescript
export interface DistrictGrantTemplate {
  id: string;
  category: DistrictGrantCategory;
  name: string;
  description: string;

  // --- Identity grants only ---
  // Faction axis requirements (district's dominant ideology must match)
  axisRequirements?: Partial<Record<keyof AxisPosition, AxisRequirement>>;

  // --- Infrastructure grants only ---
  // External source providing the grant
  sourceId?: GrantSourceId;

  // --- Shared ---
  cost: ResourceDelta;                   // Resources to fund the grant
  baseDuration: number;                  // Base completion time in sols
  effect: DistrictGrantEffect;           // What happens on completion
  ideologyShift?: Partial<AxisPosition>; // Ideology nudge on completion (mild for infra)
  identityTag: string;                   // Tag conferred to district (e.g., "mining", "collectivist")
  minSol: number;                        // Earliest sol this grant can appear
  weight: number;                        // Probability weight in the draw pool

  // --- Victory path (identity grants only) ---
  isCapstone?: boolean;
  prerequisites?: string[];              // Other grant IDs that must be completed colony-wide
  victoryProgress?: number;              // Points contributed to faction progress track (default 1)
}
```

### Grant Effect

```typescript
export interface DistrictGrantEffect {
  // District-scoped effects
  capacityBoost?: number;                        // +N housing capacity in district
  productionBonus?: { resource: string; multiplier: number }; // +N resource/sol in district
  researchBonus?: number;                        // +N research/sol from district colonists
  buildingCostReduction?: number;                // -N% building costs in district
  healthBonus?: number;                          // -N% health incidents in district
  xpBonus?: number;                              // +N% XP gain for district colonists
  powerEfficiency?: number;                      // +N% power efficiency in district

  // Colony-wide effects (identity grants only)
  unlockBuilding?: string;
  unlockTech?: string;
  colonyMoraleBoost?: number;
  populationBonus?: number;
  supporterConvictionBoost?: number;
}
```

### District Identity

```typescript
export interface DistrictIdentity {
  completedGrantIds: string[];   // All grants completed in this district
  tags: string[];                // Accumulated identity tags
  title: string | null;          // Computed dominant identity title (e.g., "Mining Hub")
}
```

### Active Grant

```typescript
export interface ActiveDistrictGrant {
  id: number;                    // Unique instance ID
  templateId: string;            // Reference to DistrictGrantTemplate
  districtId: string;            // Which district is working on it
  assignedSol: number;           // Sol when player assigned it
  remainingSols: number;         // Sols until completion
  totalDuration: number;         // Original duration (after ideology scaling)
}
```

### Available Grant (Panel Card)

```typescript
export interface AvailableDistrictGrant {
  id: number;                    // Unique instance ID
  templateId: string;            // Reference to DistrictGrantTemplate
  drawnSol: number;              // Sol when this card appeared in the panel
}
```

### District Model Extension

```typescript
// Added to existing District interface
export interface District {
  // ... existing fields (id, name, foundedAt, capacity, growthCap, buildingIds)
  identity: DistrictIdentity;    // NEW
}
```

## Grant Sources (Infrastructure)

Preserved from the current system. Each source has an ideology position that determines the mild ideology shift when their grants are completed.

| Source | Solidarity | Sovereignty | Transformation |
|--------|-----------|-------------|----------------|
| Helios Mining Corp | -0.5 | 0.0 | +0.3 |
| Earth Science Council | 0.0 | -0.4 | +0.5 |
| Mars Heritage Foundation | 0.0 | +0.4 | -0.5 |
| Immigration Bureau | +0.4 | -0.4 | 0.0 |
| Autonomous Collective | +0.5 | +0.3 | 0.0 |

## Identity Grant Completion Speed

Completion duration scales with how well the district's dominant ideology aligns with the grant's axis requirements.

```
alignmentStrength = how far the district's ideology exceeds the threshold
                    (e.g., district solidarity 0.6 for a grant requiring min 0.3 → strength 0.3)

speedMultiplier = 0.5 + (alignmentStrength * 1.5)   // Range: 0.5x to 2.0x
actualDuration = baseDuration / speedMultiplier

// Examples (baseDuration = 40 sols):
// Strong alignment (strength 1.0): 40 / 2.0 = 20 sols
// Moderate alignment (strength 0.3): 40 / 0.95 = 42 sols
// Barely qualifying (strength 0.0): 40 / 0.5 = 80 sols
```

Infrastructure grants use `baseDuration` directly (no scaling).

## Victory Path

### Faction Progress Tracks

Each of the 3 ideology axes has a progress track. Identity grants contribute to the track matching their axis requirements.

```
Axis Progress = sum of victoryProgress from all completed identity grants on that axis

Example:
  - Complete "Community Kitchen" (solidarity axis, progress: 1) → Solidarity track: 1
  - Complete "Workers' Assembly" (solidarity axis, progress: 2) → Solidarity track: 3
  - Complete "Mutual Aid Network" (solidarity axis, progress: 1) → Solidarity track: 4
```

### Capstone Unlock

When a track reaches its threshold (e.g., 8 points), the capstone grant for that faction becomes available in the panel draw pool.

### Capstone to Victory Flow

```
Identity grants completed → faction progress track fills
  → track reaches threshold → capstone grant enters draw pool
  → player assigns capstone to a qualifying district
  → capstone completes → unlocks megastructure building
  → player builds megastructure → victory
```

### 4 Victory Paths (Preserved)

| Capstone | Axis Requirements | Prerequisites | Unlocks |
|----------|-------------------|---------------|---------|
| Declaration of Sovereignty | sovereignty >= 0.5 | Universal Housing, Democratic Assembly grants | United Mars Station |
| Earth Relief Compact | sovereignty <= -0.6, solidarity >= 0.5 | Earth Memorial, Heritage Archive grants | Space Elevator |
| Deep Space Mining Charter | solidarity <= -0.5, transformation >= 0.5 | Orbital Infrastructure, Asteroid Survey grants | Asteroid Mining Platform |
| Genesis Vault | transformation <= -0.6, solidarity >= 0.5 | Heritage Archive, Healthcare Expansion grants | Genesis Ark |

## District Identity

### Tag Accumulation

Each completed grant adds its `identityTag` to the district's `tags` array. Tags are strings like `"collectivist"`, `"mining"`, `"research"`, `"preservationist"`.

### Title Computation

The district's title is the most frequent tag, mapped to a display name:

```typescript
const IDENTITY_TITLES: Record<string, string> = {
  collectivist: "Workers' Quarter",
  individualist: "Free Enterprise District",
  sovereign: "Independence Quarter",
  earthtied: "Embassy District",
  preservationist: "Heritage Precinct",
  revolutionary: "Innovation Quarter",
  mining: "Mining Hub",
  research: "Research Campus",
  agriculture: "Agri-District",
  housing: "Residential Quarter",
};
```

Title updates whenever a grant completes. Ties broken by most recent tag.

### Specialization Synergy

When a district accumulates 3+ tags on the same ideology axis, it gains a synergy bonus:

| Tags | Bonus |
|------|-------|
| 3 same-axis | +10% to all same-axis grant effects in this district |
| 5 same-axis | +20% to all same-axis grant effects + title upgrade (e.g., "Grand Workers' Quarter") |

## Panel UX

### Layout

```
┌─────────────────────────────────────────────────┐
│  GRANTS                          [Refresh ⟳ 30] │
├───────────────┬───────────────┬─────────────────┤
│ ┌───────────┐ │ ┌───────────┐ │ ┌───────────┐   │
│ │ IDENTITY  │ │ │ INFRA     │ │ │ IDENTITY  │   │
│ │           │ │ │           │ │ │           │   │
│ │ Community │ │ │ Research  │ │ │ Private   │   │
│ │ Kitchen   │ │ │ Initiative│ │ │ Enterprise│   │
│ │           │ │ │           │ │ │ Zone      │   │
│ │ Cost: 80m │ │ │ Cost: 60m │ │ │ Cost: 90m │   │
│ │ ~30 sols  │ │ │ 25 sols   │ │ │ ~45 sols  │   │
│ │           │ │ │           │ │ │           │   │
│ │[Assign ▼] │ │ │[Assign ▼] │ │ │[Assign ▼] │   │
│ └───────────┘ │ └───────────┘ │ └───────────┘   │
└───────────────┴───────────────┴─────────────────┘
```

### Card Information

Each card shows:
- **Category badge:** "Identity" or "Infrastructure"
- **Name and description**
- **Cost:** Resources required to fund
- **Duration:** Estimated completion time (identity shows "~" because it depends on district alignment)
- **Source** (infrastructure only): Which organization provides it
- **Axis requirements** (identity only): Which ideology axis is needed
- **Assign button:** Dropdown of eligible districts

### Assign Flow

1. Player clicks "Assign" on a card
2. Dropdown shows all districts (identity grants gray out ineligible districts)
3. Player selects a district
4. Resources are deducted
5. Card disappears from panel, replaced by new random card
6. Grant appears as active on the district card

### Refresh

- **Auto-fill:** When a grant completes or is assigned, the empty panel slot fills with a new random draw
- **Refresh button:** Rerolls all 3 panel cards for a resource cost (e.g., 30 materials)
- Refresh button is always available (no cooldown)

## Balance Constants

```typescript
// src/core/balance/DistrictGrantBalance.ts

/** Number of grant cards shown in the panel */
export const GRANT_PANEL_SIZE = 3;

/** Resource cost to refresh all panel cards */
export const GRANT_REFRESH_COST = 30; // materials

/** Earliest sol grants can appear */
export const GRANT_MIN_SOL = 15;

/** Base duration for infrastructure grants (sols) */
export const INFRASTRUCTURE_BASE_DURATION = 25;

/** Identity grant base duration (sols, before ideology scaling) */
export const IDENTITY_BASE_DURATION = 40;

/** Minimum speed multiplier for identity grants (barely qualifying ideology) */
export const IDENTITY_MIN_SPEED = 0.5;

/** Maximum speed multiplier for identity grants (perfect ideology alignment) */
export const IDENTITY_MAX_SPEED = 2.0;

/** Per-axis ideology shift strength for infrastructure grants */
export const INFRA_IDEOLOGY_SHIFT = 0.06;

/** How much conviction resists ideology shift (0-1) */
export const GRANT_CONVICTION_RESISTANCE = 0.7;

/** Specialization synergy threshold (same-axis tags in one district) */
export const SPECIALIZATION_TIER_1 = 3;
export const SPECIALIZATION_TIER_2 = 5;

/** Specialization bonus multipliers */
export const SPECIALIZATION_BONUS_1 = 0.10; // +10%
export const SPECIALIZATION_BONUS_2 = 0.20; // +20%

/** Victory progress threshold to unlock capstone grant */
export const CAPSTONE_UNLOCK_THRESHOLD = 8;
```

## System Interface

```typescript
// src/core/systems/DistrictGrantManager.ts

export class DistrictGrantManager {
  // --- Panel ---
  getAvailableGrants(): readonly AvailableDistrictGrant[];
  refreshPanel(currentSol: number): void;

  // --- Assignment ---
  canAssignGrant(grantId: number, districtId: string, context: GrantContext): GrantEligibility;
  assignGrant(grantId: number, districtId: string, currentSol: number): ActiveDistrictGrant;

  // --- Processing ---
  tick(currentSol: number): GameEvent[];  // Process completions, auto-fill panel

  // --- Identity ---
  getDistrictIdentity(districtId: string): DistrictIdentity;
  getSpecializationBonus(districtId: string, axis: string): number;

  // --- Victory ---
  getAxisProgress(): Record<string, number>;  // Current progress per axis
  isCapstoneUnlocked(capstoneId: string): boolean;

  // --- Active grants ---
  getActiveGrants(): readonly ActiveDistrictGrant[];
  getActiveGrantsForDistrict(districtId: string): readonly ActiveDistrictGrant[];

  // --- Serialization ---
  toJSON(): DistrictGrantSaveData;
  static fromJSON(data: DistrictGrantSaveData): DistrictGrantManager;
}
```

### GrantContext

```typescript
interface GrantContext {
  districtIdeology: AxisPosition;          // District's dominant colonist ideology
  resources: ResourceState;                // Current resource levels
  completedGrantIds: readonly string[];    // Colony-wide completed grant IDs
}
```

### GrantEligibility

```typescript
interface GrantEligibility {
  canAssign: boolean;
  reason?: string;                         // "District ideology doesn't meet requirements"
  estimatedDuration?: number;              // Computed duration based on alignment
}
```

## Tick Phase

```typescript
// src/core/tick/phases/districtGrants.ts

export function processDistrictGrants(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const manager = state.districtGrants;

  // 1. Process active grants: decrement remainingSols
  for (const grant of manager.getActiveGrants()) {
    grant.remainingSols--;

    if (grant.remainingSols <= 0) {
      // Complete the grant
      const template = getDistrictGrantTemplate(grant.templateId);

      // Apply district-scoped effects
      applyDistrictEffects(state, grant.districtId, template.effect);

      // Apply colony-wide effects (identity grants)
      if (template.category === DistrictGrantCategory.IDENTITY) {
        applyColonyEffects(state, template.effect);
        addVictoryProgress(state, template);
      }

      // Apply mild ideology shift
      if (template.ideologyShift) {
        applyIdeologyShift(state, grant.districtId, template.ideologyShift);
      }

      // Update district identity
      addIdentityTag(state, grant.districtId, template.identityTag);

      // Check capstone completion
      if (template.isCapstone) {
        events.push(...checkCapstoneVictory(state, template));
      }

      events.push(createGrantCompletedEvent(grant, template));
    }
  }

  // 2. Remove completed grants from active list
  manager.removeCompletedGrants();

  // 3. Auto-fill empty panel slots
  manager.fillEmptySlots(state.currentSol);

  return events;
}
```

## Facade

```typescript
// src/facade/domains/GrantsFacade.ts (rewritten)

export class GrantsFacade {
  // Panel
  snapshot(): GrantsPanelSnapshot;
  canRefreshPanel(): { canRefresh: boolean; cost: number };
  refreshPanel(): void;

  // Assignment
  canAssignGrant(grantId: number, districtId: string): GrantEligibility;
  assignGrant(grantId: number, districtId: string): ActiveDistrictGrant;

  // Victory progress
  getAxisProgress(): Record<string, number>;
  getCapstoneStatus(): CapstoneStatus[];

  // Active grants
  getActiveGrantsForDistrict(districtId: string): readonly ActiveDistrictGrant[];
}
```

## UI State (GameService)

```typescript
// Added to GameUIState
interface GameUIState {
  // ... existing fields ...

  grants: {
    available: AvailableDistrictGrant[];    // Panel cards (max 3)
    active: ActiveDistrictGrant[];           // All active grants across districts
    axisProgress: Record<string, number>;    // Victory progress per axis
    refreshCost: number;                     // Current cost to refresh panel
  };

  // Districts already have their own state; add identity
  districts: Array<{
    // ... existing fields ...
    identity: DistrictIdentity;
    activeGrants: ActiveDistrictGrant[];
  }>;
}
```

## Migration

### Save Data

Old saves have separate `grants` (GrantManager) and `ideology.completedProjects` (IdeologyManager) data. New saves have unified `districtGrants` (DistrictGrantManager) data.

```typescript
// In GameState.fromJSON()
if (data.grants && data.ideology?.completedProjects) {
  // Old format detected — migrate
  const migrated = migrateToDistrictGrants(data);
  state.districtGrants = DistrictGrantManager.fromJSON(migrated);
} else if (data.districtGrants) {
  // New format
  state.districtGrants = DistrictGrantManager.fromJSON(data.districtGrants);
}
```

### Migration Logic

1. Convert `completedProjects` → completed district grant IDs (using a mapping table)
2. Convert `activeGrants` → active district grants (preserve district assignment and remaining duration)
3. Convert `pendingProposals` → active identity grants with remaining duration
4. Compute initial district identities from migrated completed grants
5. Initialize empty panel with 3 fresh draws

## Testing

### New Test Files

- `tests/DistrictGrantManager.test.ts` — Core manager logic
- `tests/DistrictGrantPanel.test.ts` — Panel draw, refresh, auto-fill
- `tests/DistrictGrantCompletion.test.ts` — Completion effects, identity tags
- `tests/DistrictGrantVictory.test.ts` — Victory progress tracks, capstone unlocks

### Updated Test Files

- `tests/IdeologyManager.test.ts` — Remove project-related tests
- `tests/VictoryManager.test.ts` — Update capstone checks to use grant IDs
- `tests/AxisVictory.test.ts` — Update victory path tests
- `tests/VictoryMegastructures.test.ts` — Update megastructure unlock tests

### Key Test Cases

```
Panel:
  - Panel initializes with 3 grants after GRANT_MIN_SOL
  - Assigning a grant removes it from panel and auto-fills
  - Refresh replaces all 3 cards and costs materials
  - Mixed pool draws from both identity and infrastructure

Assignment:
  - Identity grant requires district ideology to meet axis requirements
  - Infrastructure grant can be assigned to any district
  - Assignment deducts resource cost
  - Cannot assign if insufficient resources

Completion:
  - Identity grant duration scales with ideology alignment
  - Infrastructure grant uses base duration
  - Completing a grant applies district-scoped effects
  - Completing an identity grant applies colony-wide effects
  - Completing a grant adds identity tag to district
  - District title updates to most frequent tag

Specialization:
  - 3 same-axis tags give +10% bonus to same-axis grant effects
  - 5 same-axis tags give +20% bonus
  - Mixed tags give no specialization bonus

Victory:
  - Identity grants contribute to axis progress track
  - Track reaching threshold unlocks capstone in draw pool
  - Capstone completion unlocks megastructure building
  - All 4 victory paths work end-to-end

Ideology:
  - Infrastructure grants apply mild ideology shift to district colonists
  - Ideology shift is resisted by conviction
  - Identity grants don't apply ideology shift (they require alignment, not create it)
```

## Implementation Phases

### Phase 1: Data Model
- Create `DistrictGrant` model types
- Create `districtGrants.ts` data file (merge projects + grants)
- Create `DistrictGrantBalance.ts` balance constants
- Add `identity` field to `District` interface

### Phase 2: Core Logic
- Create `DistrictGrantManager`
- Update `DistrictManager` for identity tracking
- Strip project methods from `IdeologyManager`
- Update `VictoryManager` for grant-based capstones
- Create `districtGrants` tick phase

### Phase 3: Facade & UI
- Rewrite `GrantsFacade`
- Update `IdeologyFacade` (remove project methods)
- Update `DistrictFacade` (add identity)
- Update `GameService` state sync
- Build grants panel UI
- Update `DistrictCard.vue` with identity display

### Phase 4: Migration & Cleanup
- Save migration logic
- Delete obsolete files
- Update all tests
- Update simulation `HeuristicStrategy`
- Balance tuning via simulation runs
