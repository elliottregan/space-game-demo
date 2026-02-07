# Evolving Faction Platforms Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the static three-faction affinity system with continuous ideology axes that factions drift along based on colony conditions, with dynamic project pools, faction naming, and axis-gated victory.

**Architecture:** The `ColonistIdeology` interface changes from 3 faction affinities to 3 axis positions (solidarity, sovereignty, transformation) + conviction. Factions become runtime objects with their own axis positions that drift via pressure accumulation. Projects are gated by axis thresholds instead of faction identity. Faction membership becomes "nearest faction in 3D axis space."

**Tech Stack:** TypeScript, Bun test runner, Vue 3 (renderer only)

**Design Doc:** `docs/plans/2026-02-07-evolving-faction-platforms-design.md`

---

## Phase 1: Core Data Model

### Task 1: Replace ColonistIdeology Interface

**Files:**
- Modify: `src/core/models/Colonist.ts:7-16`
- Test: `tests/IdeologyAxes.test.ts` (new)

**Step 1: Write failing tests for the new ideology interface**

Create `tests/IdeologyAxes.test.ts` with tests that import and validate the new `ColonistIdeology` shape:

```typescript
import { describe, expect, test } from "bun:test";
import type { ColonistIdeology } from "../src/core/models/Colonist";

describe("ColonistIdeology axis model", () => {
  test("has three axes and conviction", () => {
    const ideology: ColonistIdeology = {
      solidarity: 0.0,
      sovereignty: -0.5,
      transformation: 0.3,
      conviction: 0.6,
    };
    expect(ideology.solidarity).toBe(0.0);
    expect(ideology.sovereignty).toBe(-0.5);
    expect(ideology.transformation).toBe(0.3);
    expect(ideology.conviction).toBe(0.6);
  });

  test("axes range from -1 to +1", () => {
    const ideology: ColonistIdeology = {
      solidarity: -1.0,
      sovereignty: 1.0,
      transformation: 0.0,
      conviction: 0.5,
    };
    expect(ideology.solidarity).toBe(-1.0);
    expect(ideology.sovereignty).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: FAIL — properties `solidarity`, `sovereignty`, `transformation` don't exist on `ColonistIdeology`

**Step 3: Update ColonistIdeology interface**

Replace the interface in `src/core/models/Colonist.ts:3-16`:

```typescript
/**
 * Colonist political ideology - position on three independent axes.
 * Each axis ranges from -1.0 to +1.0.
 */
export interface ColonistIdeology {
  /** Individualist (-1) ↔ Collectivist (+1) */
  solidarity: number;
  /** Earth-tied (-1) ↔ Mars-sovereign (+1) */
  sovereignty: number;
  /** Preservationist (-1) ↔ Revolutionary (+1) */
  transformation: number;
  /** How strongly held beliefs are - resistance to influence (0-1) */
  conviction: number;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/Colonist.ts tests/IdeologyAxes.test.ts
git commit -m "feat(ideology): replace faction affinities with three-axis model"
```

> **Note:** This will break many files. The next tasks fix them systematically. Do NOT run the full test suite yet.

---

### Task 2: Add Faction Runtime Model

**Files:**
- Modify: `src/core/models/NPCInfluence.ts`
- Test: `tests/IdeologyAxes.test.ts` (extend)

**Step 1: Write failing tests for FactionState**

Add to `tests/IdeologyAxes.test.ts`:

```typescript
import type { AxisPosition, FactionState } from "../src/core/models/NPCInfluence";

describe("FactionState", () => {
  test("has axis positions and pressure", () => {
    const faction: FactionState = {
      id: "earth_loyalists",
      baseId: "earth_loyalists",
      name: "Earth Loyalists",
      position: { solidarity: 0.0, sovereignty: -0.7, transformation: -0.3 },
      pressure: { solidarity: 0.0, sovereignty: 0.0, transformation: 0.0 },
    };
    expect(faction.position.sovereignty).toBe(-0.7);
    expect(faction.pressure.solidarity).toBe(0.0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: FAIL — `AxisPosition` and `FactionState` don't exist

**Step 3: Add new types to NPCInfluence.ts**

Add after the `NPCFaction` enum (after line 20):

```typescript
/**
 * Position on the three ideology axes.
 * Each value ranges from -1.0 to +1.0.
 */
export interface AxisPosition {
  /** Individualist (-1) ↔ Collectivist (+1) */
  solidarity: number;
  /** Earth-tied (-1) ↔ Mars-sovereign (+1) */
  sovereignty: number;
  /** Preservationist (-1) ↔ Revolutionary (+1) */
  transformation: number;
}

/**
 * Runtime state of a political faction.
 * Factions drift along axes based on colony conditions.
 */
export interface FactionState {
  /** Current unique identifier (changes on faction rebirth) */
  id: string;
  /** Starting faction identity (earth_loyalists, mars_independence, corporate_interests) */
  baseId: NPCFaction;
  /** Current display name (changes when crossing axis thresholds) */
  name: string;
  /** Current axis positions (-1 to +1 per axis) */
  position: AxisPosition;
  /** Accumulated pressure from colony conditions (-1 to +1 per axis) */
  pressure: AxisPosition;
}

/** The three axis keys for iteration */
export const AXIS_KEYS: readonly (keyof AxisPosition)[] = [
  "solidarity",
  "sovereignty",
  "transformation",
] as const;
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/models/NPCInfluence.ts tests/IdeologyAxes.test.ts
git commit -m "feat(ideology): add AxisPosition and FactionState types"
```

---

### Task 3: Add Axis-Based Balance Constants

**Files:**
- Modify: `src/core/balance/IdeologyBalance.ts`
- Test: `tests/IdeologyAxes.test.ts` (extend)

**Step 1: Write failing test for new constants**

Add to `tests/IdeologyAxes.test.ts`:

```typescript
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";

describe("IdeologyBalance axis constants", () => {
  test("has faction drift rate", () => {
    expect(IdeologyBalance.FACTION_DRIFT_RATE).toBeGreaterThan(0);
    expect(IdeologyBalance.FACTION_DRIFT_RATE).toBeLessThan(0.1);
  });

  test("has starting faction positions", () => {
    expect(IdeologyBalance.STARTING_FACTION_POSITIONS).toHaveLength(3);
    expect(IdeologyBalance.STARTING_FACTION_POSITIONS[0]!.baseId).toBe("earth_loyalists");
  });

  test("has new colonist neutral ideology on axes", () => {
    expect(IdeologyBalance.NEW_COLONIST_IDEOLOGY.solidarity).toBe(0);
    expect(IdeologyBalance.NEW_COLONIST_IDEOLOGY.sovereignty).toBe(0);
    expect(IdeologyBalance.NEW_COLONIST_IDEOLOGY.transformation).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: FAIL — new constants don't exist

**Step 3: Replace balance constants**

Rewrite `src/core/balance/IdeologyBalance.ts` entirely. Keep existing spread/council/voting constants where applicable, replace faction-affinity ones with axis equivalents:

Key new constants:
- `NEW_COLONIST_IDEOLOGY = { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0.2 }`
- `FACTION_DRIFT_RATE = 0.02` — how fast faction positions track toward pressure
- `FACTION_CONVICTION_DAMPENING = 0.6` — how much avg conviction slows drift
- `FACTION_PRESSURE_DECAY = 0.005` — pressure decays toward 0 each sol without reinforcement
- `DEFECTION_DISTANCE_THRESHOLD = 0.3` — distance difference before defection pressure builds
- `FACTION_CONVERGENCE_THRESHOLD = 0.2` — distance at which merger triggers
- `FACTION_COLLAPSE_POPULATION_RATIO = 0.15` — faction collapses below this
- `FACTION_NAME_THRESHOLD_MODERATE = 0.3` — axis value for moderate name change
- `FACTION_NAME_THRESHOLD_EXTREME = 0.6` — axis value for extreme name change
- `STARTING_FACTION_POSITIONS` — array of 3 `{baseId, name, position}` objects with starting values from design doc

**Step 4: Run test to verify it passes**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/balance/IdeologyBalance.ts tests/IdeologyAxes.test.ts
git commit -m "feat(ideology): add axis-based balance constants"
```

---

### Task 4: Update Founding Colonists Data

**Files:**
- Modify: `src/core/data/foundingColonists.ts`

**Step 1: Update founding colonist ideologies to axis format**

Each colonist's ideology needs to map from the old 3-affinity model to the new 3-axis model. The mapping logic:
- High earthLoyalist → negative sovereignty (Earth-tied)
- High marsIndependence → positive sovereignty (Mars-sovereign)
- High corporateInterests → negative solidarity (Individualist)
- Conviction stays the same

Example conversions:
- Dr. Chen Wei (EL, 0.9/0.2/0.3, conv 0.8) → `{ solidarity: 0.1, sovereignty: -0.7, transformation: -0.2, conviction: 0.8 }`
- Maria Santos (MI, 0.2/0.9/0.3, conv 0.85) → `{ solidarity: 0.3, sovereignty: 0.7, transformation: 0.3, conviction: 0.85 }`
- Elena Volkov (CI, 0.3/0.2/0.9, conv 0.8) → `{ solidarity: -0.6, sovereignty: 0.0, transformation: 0.4, conviction: 0.8 }`

Convert all 10 founding colonists. Keep names, roles, relationship data unchanged.

**Step 2: Run targeted test**

Run: `bun test tests/IdeologyAxes.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/data/foundingColonists.ts
git commit -m "feat(ideology): convert founding colonists to axis-based ideology"
```

---

## Phase 2: IdeologyManager Rewrite

### Task 5: Core IdeologyManager — Axis-Based Faction Membership

**Files:**
- Modify: `src/core/systems/IdeologyManager.ts`
- Test: `tests/IdeologyManager.test.ts` (rewrite)

This is the largest task. The IdeologyManager needs substantial rewriting.

**Step 1: Rewrite test suite for axis-based faction membership**

Rewrite `tests/IdeologyManager.test.ts` starting with faction membership tests:

```typescript
describe("IdeologyManager", () => {
  describe("getNearestFaction", () => {
    test("returns faction with closest axis position", () => {
      // Colonist near Earth Loyalists starting position (0, -0.7, -0.3)
      const ideology = { solidarity: 0.1, sovereignty: -0.6, transformation: -0.2, conviction: 0.5 };
      const factions = manager.getFactions();
      const nearest = IdeologyManager.getNearestFaction(ideology, factions);
      expect(nearest?.baseId).toBe(NPCFaction.EarthLoyalists);
    });

    test("returns null for colonist equidistant from all factions", () => {
      const ideology = { solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0.1 };
      // When exactly centered, should return null (no clear allegiance)
    });
  });

  describe("createNeutralIdeology", () => {
    test("creates ideology at origin with low conviction", () => {
      const ideology = IdeologyManager.createNeutralIdeology();
      expect(ideology.solidarity).toBe(0);
      expect(ideology.sovereignty).toBe(0);
      expect(ideology.transformation).toBe(0);
      expect(ideology.conviction).toBe(0.2);
    });
  });
});
```

**Step 2: Rewrite IdeologyManager class**

Key changes to `src/core/systems/IdeologyManager.ts`:

1. **New state:** Add `private factions: FactionState[]` initialized from `STARTING_FACTION_POSITIONS`
2. **Replace `getPrimaryFaction`** with `getNearestFaction(ideology, factions)` — computes Euclidean distance in 3D axis space, returns closest faction if distance < threshold
3. **Replace `factionToKey`** — no longer needed (axes are the same for all factions)
4. **Replace `createNeutralIdeology`** — returns `{solidarity: 0, sovereignty: 0, transformation: 0, conviction: 0.2}`
5. **Update `selectCouncil`** — use `getNearestFaction` instead of `getPrimaryFaction`
6. **Update `getCouncilFactionCounts`** — key by faction id string instead of NPCFaction enum
7. **Update `calculateFactionSupport`** — calculate per-faction support based on distance (closer colonists contribute more)
8. **Add `getFactions(): readonly FactionState[]`** — expose faction runtime state
9. **Add `getFaction(id: string): FactionState | undefined`**

Keep existing: council selection logic, pending proposals, completed projects, serialization skeleton.
Remove: `factionToKey`, `getPassedProjectsForFaction` (will be replaced later), `canProposeCapstone` (replaced by axis gating).

**Step 3: Run rewritten tests**

Run: `bun test tests/IdeologyManager.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/systems/IdeologyManager.ts tests/IdeologyManager.test.ts
git commit -m "feat(ideology): rewrite IdeologyManager for axis-based factions"
```

---

### Task 6: Axis-Based Ideology Spread

**Files:**
- Modify: `src/core/systems/IdeologyManager.ts` (propagateIdeology, evolveConviction, evolveNeutralColonist, imprintIdeologyFromNeighbors)
- Test: `tests/IdeologySpread.test.ts` (new)

**Step 1: Write failing tests for axis-based spread**

Create `tests/IdeologySpread.test.ts`:

```typescript
describe("Ideology Spread (axis-based)", () => {
  test("colonist drifts toward neighbor's axis position", () => {
    // Two colonists: one at origin, one at (0.5, 0.5, 0.5)
    // After propagation, origin colonist should drift toward (0.5, 0.5, 0.5)
  });

  test("conviction resists ideology drift", () => {
    // High-conviction colonist drifts less than low-conviction
  });

  test("imprinting blends toward strongest neighbor on all three axes", () => {
    // Neutral colonist near a Mars-sovereign colonist should gain positive sovereignty
  });

  test("neutral colonist drifts faster toward neighborhood average", () => {
    // Colonist at origin with low conviction should drift at NEUTRAL_IDEOLOGY_DRIFT_RATE
  });
});
```

**Step 2: Rewrite spread methods**

Update `propagateIdeology()` to spread on 3 axes instead of 3 affinities:
- Replace `avgInfluence.earthLoyalist/marsIndependence/corporateInterests` with `avgInfluence.solidarity/sovereignty/transformation`
- Axes range [-1, 1] so clamp to that range instead of [0, 1]
- Same weight formula: `relationship² × (centrality + 0.1) × conviction`
- Same resistance formula: `conviction × CONVICTION_RESISTANCE_FACTOR`

Update `imprintIdeologyFromNeighbors()`:
- Blend on 3 axes instead of 3 affinities
- Same imprinting strength logic

Update `evolveConviction()`:
- Replace "neighbor faction pressure" with axis-distance-based support detection
- Conviction grows when neighbors are close in axis space (similar beliefs reinforce)
- Conviction decays when neighbors are distant (challenging beliefs cause doubt)

Update `evolveNeutralColonist()`:
- "Neutral" = near origin on all axes
- Stronger drift toward neighborhood average

**Step 3: Run tests**

Run: `bun test tests/IdeologySpread.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/systems/IdeologyManager.ts tests/IdeologySpread.test.ts
git commit -m "feat(ideology): axis-based ideology spread and conviction evolution"
```

---

### Task 7: Faction Drift System

**Files:**
- Modify: `src/core/systems/IdeologyManager.ts` (new methods)
- Create: `src/core/data/factionDrift.ts` (drift trigger definitions)
- Test: `tests/FactionDrift.test.ts` (new)

**Step 1: Write failing tests for faction drift**

```typescript
describe("Faction Drift", () => {
  test("resource scarcity pushes solidarity toward collectivist", () => {
    // When food < threshold, solidarity pressure increases
  });

  test("faction position drifts toward pressure", () => {
    // Set pressure to (0.5, 0, 0), position at (0, 0, 0)
    // After drift tick, position should move toward (0.5, 0, 0)
  });

  test("high average conviction dampens drift", () => {
    // Faction with high-conviction members drifts slower
  });

  test("pressure decays without reinforcement", () => {
    // Set pressure to 0.5, no triggers active
    // After tick, pressure should decrease
  });
});
```

**Step 2: Create drift trigger data**

Create `src/core/data/factionDrift.ts` with:
- `DriftTrigger` interface: `{ axis, direction, condition, strength, factionSensitivity? }`
- Array of triggers from design doc (resource scarcity → collectivist, etc.)
- Each trigger evaluates a colony condition and returns pressure delta

**Step 3: Implement drift in IdeologyManager**

Add methods:
- `updateFactionPressure(ctx)` — evaluates all triggers against current colony state, updates `faction.pressure` per axis
- `driftFactionPositions()` — applies `drift = (pressure - position) * FACTION_DRIFT_RATE * (1 - avgConviction * FACTION_CONVICTION_DAMPENING)`
- `decayFactionPressure()` — pressure decays toward 0 each sol

**Step 4: Run tests**

Run: `bun test tests/FactionDrift.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/IdeologyManager.ts src/core/data/factionDrift.ts tests/FactionDrift.test.ts
git commit -m "feat(ideology): faction drift system with pressure accumulation"
```

---

## Phase 3: Dynamic Projects & Victory

### Task 8: Axis-Gated Project Pool

**Files:**
- Modify: `src/core/models/NPCInfluence.ts` (Project interface)
- Rewrite: `src/core/data/projects.ts`
- Modify: `src/core/systems/IdeologyManager.ts` (canProposeProject)
- Test: `tests/AxisProjects.test.ts` (new)

**Step 1: Write failing tests for axis-gated projects**

```typescript
describe("Axis-gated projects", () => {
  test("project accessible when faction meets axis requirements", () => {
    // Faction at solidarity +0.4 can propose project requiring solidarity >= +0.3
  });

  test("project inaccessible when faction below threshold", () => {
    // Faction at sovereignty -0.2 cannot propose project requiring sovereignty >= +0.5
  });

  test("project requiring two axes needs both met", () => {
    // Transhuman Research needs sovereignty >= +0.3 AND transformation >= +0.5
  });

  test("faction loses access when drifting away from threshold", () => {
    // Project was accessible at solidarity +0.4, after drift to +0.2, no longer accessible
  });
});
```

**Step 2: Update Project interface**

In `src/core/models/NPCInfluence.ts`, modify `Project` interface:
- Remove: `type: ProjectType` (faction ownership)
- Add: `axisRequirements?: Partial<Record<keyof AxisPosition, { min?: number; max?: number }>>`
- Keep: `id`, `name`, `description`, `proposalCost`, `requirements`, `effects`, `onCompletionEffects`, `isCapstone`, `prerequisites`, `requiredCouncilSupport`
- Remove: `requiredSupport` (replaced by axis requirements)

**Step 3: Rewrite projects data**

Rewrite `src/core/data/projects.ts` with ~20-25 axis-gated projects from the design doc. Convert existing 12 projects to axis-gated equivalents and add new ones. Use string IDs instead of enum (replace `ProjectId` enum with string type).

Example:
```typescript
{
  id: "universal_housing",
  name: "Universal Housing Initiative",
  description: "Guarantee housing for all colonists.",
  axisRequirements: { solidarity: { min: 0.3 } },
  proposalCost: { materials: 120 },
  effects: { unlockBuilding: "housing_complex", colonyMoraleBoost: 0.08 },
}
```

**Step 4: Update canProposeProject in IdeologyManager**

Replace faction-support checks with axis-threshold checks:
- A project can be proposed by any faction that meets its axis requirements
- The proposing faction is whoever champions it (determined by player choice or AI)
- Voting still uses council majority for the proposing faction

**Step 5: Run tests**

Run: `bun test tests/AxisProjects.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/models/NPCInfluence.ts src/core/data/projects.ts src/core/systems/IdeologyManager.ts tests/AxisProjects.test.ts
git commit -m "feat(ideology): axis-gated dynamic project pool"
```

---

### Task 9: Axis-Gated Victory Conditions

**Files:**
- Modify: `src/core/systems/VictoryManager.ts`
- Modify: `src/core/systems/IdeologyManager.ts` (capstone logic)
- Modify: `src/core/data/projects.ts` (4 capstone megastructures)
- Test: `tests/AxisVictory.test.ts` (new)

**Step 1: Write failing tests for axis-gated victory**

```typescript
describe("Axis-gated victory", () => {
  test("Space Elevator requires sovereignty <= -0.6 and one other axis at extreme", () => {
    // Faction at sovereignty -0.7, solidarity +0.6 can propose
  });

  test("Genesis Vault requires transformation <= -0.6 and solidarity >= +0.5", () => {
    // Faction at transformation -0.7, solidarity +0.6 can propose
  });

  test("capstone inaccessible without extreme positions", () => {
    // Faction at sovereignty -0.4 cannot propose Space Elevator
  });
});
```

**Step 2: Define 4 capstone megastructures in projects data**

From design doc:
- Space Elevator: sovereignty ≤ -0.6, any other axis ≥ |0.5|
- United Mars Station: sovereignty ≥ +0.6, any other axis ≥ |0.5|
- Asteroid Mining Platform: solidarity ≤ -0.5, transformation ≥ +0.5
- Genesis Vault: transformation ≤ -0.6, solidarity ≥ +0.5

**Step 3: Update VictoryManager**

Update `checkCapstoneVictory()` to work with the new project system. No changes to `checkBuildingVictory()` — megastructure completion still triggers victory.

**Step 4: Run tests**

Run: `bun test tests/AxisVictory.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/VictoryManager.ts src/core/systems/IdeologyManager.ts src/core/data/projects.ts tests/AxisVictory.test.ts
git commit -m "feat(ideology): axis-gated victory with 4 megastructures"
```

---

## Phase 4: Faction Dynamics

### Task 10: Dynamic Faction Naming

**Files:**
- Create: `src/core/data/factionNames.ts`
- Modify: `src/core/systems/IdeologyManager.ts`
- Test: `tests/FactionNaming.test.ts` (new)

**Step 1: Write failing tests**

```typescript
describe("Dynamic faction naming", () => {
  test("Earth Loyalists become Terran Heritage Compact when earth-tied + collectivist + preservationist", () => {
    // position: solidarity +0.4, sovereignty -0.5, transformation -0.4
  });

  test("name changes fire colony event", () => {
    // When faction crosses threshold, event is emitted
  });

  test("faction keeps name when position stable", () => {
    // No threshold crossing = no name change
  });
});
```

**Step 2: Create faction name table**

Create `src/core/data/factionNames.ts`:
- Each starting faction has ~8-10 possible names based on axis quadrant combinations
- Name selected by checking which quadrants the faction occupies (using moderate threshold 0.3)
- Include the ~20-30 names from the design doc

**Step 3: Add name update logic to IdeologyManager**

Add `updateFactionNames()` method called after `driftFactionPositions()`. Compares current name to what the name table says it should be. If different, updates name and returns a `GameEvent`.

**Step 4: Run tests**

Run: `bun test tests/FactionNaming.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/data/factionNames.ts src/core/systems/IdeologyManager.ts tests/FactionNaming.test.ts
git commit -m "feat(ideology): dynamic faction naming based on axis positions"
```

---

### Task 11: Colonist Defection & Faction Dynamics

**Files:**
- Modify: `src/core/systems/IdeologyManager.ts`
- Test: `tests/FactionDynamics.test.ts` (new)

**Step 1: Write failing tests**

```typescript
describe("Faction dynamics", () => {
  test("colonist defects when another faction is significantly closer", () => {
    // Colonist at (0.5, 0.5, 0) with Earth Loyalists at (-0.5, -0.7, -0.3)
    // Mars Independence at (0.3, 0.7, 0.3) is much closer → defection pressure
  });

  test("high conviction colonists resist defection", () => {
    // Same distance difference but conviction 0.8 → slower defection
  });

  test("two factions within convergence threshold trigger merger", () => {
    // Factions within 0.2 distance on all axes → smaller absorbed, new faction spawns
  });

  test("faction below 15% population collapses and rebirths", () => {
    // Small faction → collapse → new faction at underrepresented position
  });

  test("always three factions exist", () => {
    // After merger or collapse, verify 3 factions
  });
});
```

**Step 2: Implement defection**

Add to IdeologyManager:
- `processDefections(colonists)` — for each colonist, compute distance to all factions. If another faction is closer by > `DEFECTION_DISTANCE_THRESHOLD`, build defection pressure. Defection happens after sustained pressure (modified by conviction).
- `checkFactionMerger()` — if two factions within `FACTION_CONVERGENCE_THRESHOLD` on all axes, merge smaller into larger, spawn new faction at underrepresented axis position
- `checkFactionCollapse(colonists)` — if faction has < `FACTION_COLLAPSE_POPULATION_RATIO` of colonists, collapse and rebirth

**Step 3: Run tests**

Run: `bun test tests/FactionDynamics.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/systems/IdeologyManager.ts tests/FactionDynamics.test.ts
git commit -m "feat(ideology): colonist defection, faction merger, and collapse/rebirth"
```

---

## Phase 5: Player Levers

### Task 12: Policy Declarations

**Files:**
- Create: `src/core/data/policies.ts`
- Modify: `src/core/systems/IdeologyManager.ts`
- Test: `tests/Policies.test.ts` (new)

**Step 1: Write failing tests**

```typescript
describe("Policy declarations", () => {
  test("active policy applies pressure to specified axis", () => {
    // "Rationing Protocol" pushes solidarity toward +1 for 30 sols
  });

  test("only one active policy at a time", () => {
    // Second policy replaces first
  });

  test("opposed factions lose morale and gain conviction", () => {
    // Factions on opposite side of the axis react negatively
  });

  test("policy expires after duration", () => {
    // After 30 sols, pressure from policy stops
  });
});
```

**Step 2: Create policy data**

Create `src/core/data/policies.ts`:
- `Policy` interface: `{ id, name, description, axis, direction, strength, duration, cost }`
- ~6-8 policies covering each axis direction:
  - "Rationing Protocol" → solidarity +, 30 sols, 50 materials
  - "Open Research Mandate" → transformation +, 30 sols, 80 materials
  - "Heritage Preservation Act" → transformation -, 30 sols, 60 materials
  - "Earth Communication Priority" → sovereignty -, 30 sols, 40 materials
  - "Mars Self-Sufficiency Program" → sovereignty +, 30 sols, 70 materials
  - "Free Market Decree" → solidarity -, 30 sols, 50 materials

**Step 3: Implement in IdeologyManager**

Add state: `activePolicy: { policy: Policy, startSol: number } | null`
Add methods:
- `declarePolicy(policyId, currentSol)` — set active policy
- `getActivePolicy()` — return current policy or null
- `processActivePolicy(currentSol)` — apply pressure, check expiry

Integrate into `updateFactionPressure()` — active policy contributes to pressure like any other trigger.

**Step 4: Run tests**

Run: `bun test tests/Policies.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/data/policies.ts src/core/systems/IdeologyManager.ts tests/Policies.test.ts
git commit -m "feat(ideology): policy declarations as player lever for axis pressure"
```

---

### Task 13: Institutional Building Pressure

**Files:**
- Modify: `src/core/data/buildings.ts` (add broadcasting station, academy, heritage museum)
- Modify: `src/core/data/factionDrift.ts` (add building-based triggers)
- Test: `tests/FactionDrift.test.ts` (extend)

**Step 1: Add institutional buildings**

Add to `buildings.ts`:
- Broadcasting Station: player-configurable sovereignty axis pressure
- Academy: slow transformation + (revolutionary) pressure
- Heritage Museum: slow transformation - (preservationist) pressure

These are regular buildings with a new property: `axisPressure?: Partial<Record<keyof AxisPosition, number>>`

**Step 2: Add building-based drift triggers**

In `factionDrift.ts`, add triggers that check for active institutional buildings and apply their axis pressure to all factions.

**Step 3: Run tests**

Run: `bun test tests/FactionDrift.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/core/data/buildings.ts src/core/data/factionDrift.ts tests/FactionDrift.test.ts
git commit -m "feat(ideology): institutional buildings apply passive axis pressure"
```

---

## Phase 6: Tick Integration & Serialization

### Task 14: Update Tick Phases

**Files:**
- Modify: `src/core/tick/phases/ideology.ts`
- Modify: `src/core/GameState.ts` (initializeFoundingColonists, toJSON, fromJSON)

**Step 1: Update ideology tick phase**

Rewrite `propagateIdeology` phase to:
1. Imprint neutral colonists (axis-based)
2. Propagate ideology through network (3 axes)
3. Update faction pressure from colony conditions
4. Drift faction positions
5. Decay faction pressure
6. Update faction names
7. Process defections
8. Check faction merger/collapse
9. Update council if stale

Rewrite `processProjectVotes` phase to work with axis-gated projects.

Update `isNeutralIdeology()` helper — check if all axes near 0 instead of 0.33.

**Step 2: Update GameState initialization**

- `initializeFoundingColonists()` already uses axis-format ideology from Task 4
- Initialize `IdeologyManager` with starting faction positions
- Update `toJSON()` / `fromJSON()` to serialize faction state (positions, pressure, names)

**Step 3: Run full test suite**

Run: `bun test`
Expected: Most tests should pass. Fix any remaining compilation errors from the model change.

**Step 4: Commit**

```bash
git add src/core/tick/phases/ideology.ts src/core/GameState.ts
git commit -m "feat(ideology): integrate axis-based ideology into tick phases and serialization"
```

---

## Phase 7: Facade & UI

### Task 15: Update Facade Types & IdeologyFacade

**Files:**
- Modify: `src/facade/types/ideology.ts`
- Modify: `src/facade/types/politics.ts`
- Modify: `src/facade/domains/IdeologyFacade.ts`
- Modify: `src/facade/domains/PoliticsFacade.ts`

**Step 1: Update facade types**

`src/facade/types/ideology.ts`:
- `CouncilMemberSnapshot.faction` → `factionId: string | null` (dynamic faction id)
- `FactionSupportSnapshot` → `Record<string, number>` keyed by faction id
- Add `FactionSnapshot`: `{ id, name, baseId, position, pressure }`
- `IdeologySnapshot` adds `factions: FactionSnapshot[]`

`src/facade/types/politics.ts`:
- `FactionStatus` → use `factionId: string` instead of `NPCFaction` enum
- Add axis positions to faction status

**Step 2: Update IdeologyFacade**

- `snapshot()` includes faction states
- `getFactionSupport()` returns support keyed by dynamic faction id
- `canProposeProject()` checks axis requirements instead of faction support
- Remove lobbying-by-faction (lobbying now pushes colonist along an axis, not toward a faction)
- Add `getFactions()` → returns current faction states

**Step 3: Update PoliticsFacade**

- `snapshot()` uses dynamic faction names and ids

**Step 4: Commit**

```bash
git add src/facade/types/ideology.ts src/facade/types/politics.ts src/facade/domains/IdeologyFacade.ts src/facade/domains/PoliticsFacade.ts
git commit -m "feat(ideology): update facade types for axis-based ideology"
```

---

### Task 16: Update GameService & UI State

**Files:**
- Modify: `src/renderer/services/GameService.ts`
- Modify: `src/renderer/utils/ideologyDisplay.ts`

**Step 1: Update GameService**

- `GameUIState.ideology` gains `factions: FactionSnapshot[]`
- `syncState()` copies faction data from facade snapshot
- Replace faction-specific lobbying methods with axis-based lobbying
- Add `declarPolicy(policyId)` method
- Update `proposeProject()` to work with string project IDs

**Step 2: Update ideologyDisplay.ts**

- Replace `FactionId` type — factions are now dynamic, use faction id strings
- Replace hardcoded `FACTION_CSS_VARS`, `FACTION_FULL_NAMES` etc with dynamic lookups from faction state
- Keep base colors (Earth=blue/teal, Mars=green, Corporate=orange) but allow them to follow faction identity changes
- Update `getDominantFaction()` to use axis-distance-based faction membership
- Update `getIdeologyColorForGraph()` for 3-axis system

**Step 3: Commit**

```bash
git add src/renderer/services/GameService.ts src/renderer/utils/ideologyDisplay.ts
git commit -m "feat(ideology): update GameService and display utils for axis system"
```

---

### Task 17: Update PoliticsPanel.vue

**Files:**
- Modify: `src/renderer/components/PoliticsPanel/PoliticsPanel.vue`

**Step 1: Redesign politics panel for axis system**

The politics panel needs to show:
1. **Faction cards** — each faction with its current name, axis positions (3 small bars from -1 to +1), and colony support %
2. **Axis visualization** — three horizontal bars showing each faction's position, or a radar/triangle chart
3. **Council** — same as before but with dynamic faction labels
4. **Active policy** — current policy declaration if any
5. **Colonist ideology** — table now shows solidarity/sovereignty/transformation instead of EL/MI/CI

Replace the hardcoded 3-faction support bars with dynamic faction display that works with renamed/merged factions.

**Step 2: Commit**

```bash
git add src/renderer/components/PoliticsPanel/PoliticsPanel.vue
git commit -m "feat(ideology): redesign PoliticsPanel for axis-based factions"
```

---

### Task 18: Update FactionTrack.vue (Victory Progress)

**Files:**
- Modify: `src/renderer/components/VictoryProgressPanel/FactionTrack.vue`

**Step 1: Update for axis-gated victory**

- Replace faction-specific project lists with axis-gated project display
- Show faction axis positions relative to capstone requirements
- Display progress toward extreme axis positions needed for megastructures
- Show which capstone megastructures are currently accessible based on axis positions

**Step 2: Commit**

```bash
git add src/renderer/components/VictoryProgressPanel/FactionTrack.vue
git commit -m "feat(ideology): update FactionTrack for axis-gated victory conditions"
```

---

## Phase 8: Simulation & Polish

### Task 19: Update Simulation Strategy

**Files:**
- Modify: `src/simulation/HeuristicStrategy.ts`

**Step 1: Update AI political decision-making**

- Replace `FACTION_MEGASTRUCTURES` and `FACTION_CAPSTONES` mappings with axis-based lookup
- `checkFactionCommitment()` → commit to whichever faction is closest to a capstone's axis requirements
- `advanceFactionVictoryWithResult()` → track faction drift toward capstone requirements, lobby to push colonists in the needed axis direction
- `tryLobbyForFaction()` → lobby colonists toward axis positions that benefit committed faction
- `tryProposeProject()` → propose projects accessible to committed faction
- `shouldReserveMaterials()` → reserve for next accessible project

**Step 2: Run simulation**

Run: `bun run simulate --runs 5 --log silent`
Expected: Simulation completes without errors. Win rate may need tuning.

**Step 3: Commit**

```bash
git add src/simulation/HeuristicStrategy.ts
git commit -m "feat(ideology): update simulation strategy for axis-based politics"
```

---

### Task 20: Fix Remaining Compilation Errors & Run Full Suite

**Files:** Various (whatever TypeScript errors remain)

**Step 1: Run typecheck**

Run: `bun run build` or typecheck commands from tsconfig

Fix any remaining references to old `ColonistIdeology` fields (`earthLoyalist`, `marsIndependence`, `corporateInterests`), old `NPCFaction` enum usage in contexts expecting dynamic faction ids, old `ProjectId` enum usage where string ids are now expected.

Key files to check for stale references:
- `src/core/systems/ColonyManager.ts` — refugee ideology generation
- `src/core/events/` — any event handlers referencing faction affinities
- `src/renderer/components/` — any component reading old ideology fields
- `src/simulation/MetricsCollector.ts` — faction tracking

**Step 2: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 3: Run lint and format**

Run: `bun run lint:fix && bun run format`

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve all compilation errors from ideology axis migration"
```

---

### Task 21: Update MANUAL.md

**Files:**
- Modify: `MANUAL.md`

Update the Politics & Ideology section to describe the new system:
- Three ideology axes instead of three faction affinities
- Dynamic faction evolution and naming
- Axis-gated project pool
- Policy declarations
- 4 megastructure victory paths
- Colonist defection and faction dynamics

**Step 1: Commit**

```bash
git add MANUAL.md
git commit -m "docs: update player manual for axis-based ideology system"
```

---

## Task Dependencies

```
Task 1 (ColonistIdeology) ──┐
Task 2 (FactionState)    ───┤
Task 3 (Balance)         ───┼─→ Task 5 (IdeologyManager core)
Task 4 (Founding data)  ───┘         │
                                     ├─→ Task 6 (Ideology spread)
                                     ├─→ Task 7 (Faction drift) ──→ Task 10 (Faction naming)
                                     ├─→ Task 8 (Project pool)  ──→ Task 9 (Victory)
                                     └─→ Task 11 (Defection)

Task 12 (Policies) ─────────────────→ Task 13 (Buildings)

Task 5-13 ──→ Task 14 (Tick integration)
Task 14   ──→ Task 15 (Facade)
Task 15   ──→ Task 16 (GameService)
Task 16   ──→ Task 17 (PoliticsPanel) ──┐
Task 16   ──→ Task 18 (FactionTrack)  ──┤
Task 14   ──→ Task 19 (Simulation)    ──┼─→ Task 20 (Fix & test)
                                        └─→ Task 21 (Manual)
```

## Parallelization Opportunities

Tasks that can run in parallel (via subagent-driven development):
- **Tasks 1-4** can all be done in one batch (model changes)
- **Tasks 6, 7, 8** can be parallelized after Task 5
- **Tasks 10, 11, 12** can be parallelized after their prerequisites
- **Tasks 17, 18, 19** can be parallelized after Task 16
