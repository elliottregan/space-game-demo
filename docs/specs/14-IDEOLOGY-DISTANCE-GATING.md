# Ideology Distance-Gating Mechanics

## Problem

Without distance gating, ideology converges to a single pocket (the majority faction absorbs everyone). Three mechanisms — organic spread, conviction support, and rally — all treated ideologically distant colonists identically to nearby ones. The rally mechanism was the worst offender: it nudged **all** colonists toward the rallying faction every 2 sols with no regard for ideological distance, collapsing distinct clusters within ~25 sols.

## Solution: Squared Distance Attenuation

All three mechanics now apply the same attenuation formula:

```
distanceFactor = max(0, 1 - dist * ATTENUATION) ^ 2
```

Where `dist` is the Euclidean distance in 3D ideology space (solidarity, sovereignty, transformation axes, each ranging -1 to +1). The squared falloff means:

| Distance | Factor (att=0.7) | Factor (att=0.5) |
|----------|------------------|-------------------|
| 0.0      | 1.00 (full)      | 1.00 (full)       |
| 0.5      | 0.77             | 0.56              |
| 1.0      | 0.09             | 0.25              |
| 1.43+    | 0.00 (cutoff)    | —                 |
| 2.0      | —                | 0.00 (cutoff)     |

If `distanceFactor` is 0, the interaction is skipped entirely.

## Helper Functions

Located in `src/core/systems/IdeologyManager.ts`:

```typescript
// Convert ColonistIdeology to AxisPosition (3D point)
function ideologyToAxis(ideology: ColonistIdeology): AxisPosition

// Euclidean distance between two positions in ideology space
function axisDistance(a: AxisPosition, b: AxisPosition): number
```

## The Three Gated Mechanics

### 1. Ideology Propagation

**File:** `src/core/systems/IdeologyManager.ts`, `propagateIdeology` method (~line 507)
**Constant:** `IDEOLOGY_DISTANCE_ATTENUATION = 0.7`

Each propagation tick, colonists' ideologies drift toward their social neighbors. Distance gating ensures like-minded neighbors have full influence while ideologically distant neighbors have near-zero influence, creating echo chambers.

**How it works:**
1. For each colonist, iterate over social connections above `IDEOLOGY_SPREAD_CONNECTION_THRESHOLD` (0.4)
2. Calculate ideology distance between colonist and neighbor
3. Compute `distanceFactor = max(0, 1 - dist * 0.7) ^ 2`
4. Skip if factor is 0
5. Multiply into the neighbor's influence weight:
   ```
   weight = relationshipStrength^2 * (centralityBonus) * neighborConviction * distanceFactor
   ```
6. Weighted-average ideology of all qualifying neighbors determines drift direction

**Effect:** Colonists in the same ideological cluster reinforce each other. Cross-cluster influence is negligible unless colonists are already close in ideology space.

### 2. Conviction Support

**File:** `src/core/systems/IdeologyManager.ts`, `calculateIdeologicalPressure` (~line 601) and `evolveConviction` (~line 714)
**Constants:**
- `IDEOLOGY_DISTANCE_ATTENUATION = 0.7` (same as propagation)
- `CONVICTION_SUPPORT_DISTANCE = 0.5` (hard cutoff for "supporting" neighbors)
- `CONVICTION_SUPPORT_THRESHOLD = 0.25` (minimum support ratio for conviction growth)

Conviction determines how resistant a colonist is to ideology change. It grows when surrounded by like-minded colonists and decays when isolated.

**How it works:**
1. For each neighbor above connection threshold:
   - Calculate ideology distance
   - Compute `distanceFactor = max(0, 1 - dist * 0.7) ^ 2`; skip if 0
   - Compute weighted contribution: `weight = relationshipStrength^2 * (centralityBonus) * neighborConviction * distanceFactor`
   - Add to `totalWeight`
   - If `dist <= CONVICTION_SUPPORT_DISTANCE` (0.5), also add to `supportWeight`
2. Calculate `supportRatio = supportWeight / totalWeight`
3. If `supportRatio >= CONVICTION_SUPPORT_THRESHOLD` (0.25): conviction grows
4. If below threshold: conviction decays

**Effect without gating:** Distant neighbors dilute the support ratio. A colonist surrounded by 3 like-minded allies and 5 distant enemies would have a low support ratio, causing conviction decay and eventual drift — a death spiral.

**Effect with gating:** The 5 distant enemies contribute near-zero weight. The support ratio reflects only ideologically proximate neighbors, letting small clusters maintain strong conviction.

### 3. Rally / Propaganda

**File:** `src/core/systems/IdeologyManager.ts`, `rallyFaction` method (~line 867)
**Constant:** `RALLY_DISTANCE_ATTENUATION = 0.5`

When a faction rallies, it nudges colonists' ideology toward the faction's position. This is the most powerful single mechanism for ideology change.

**How it works:**
1. For each colonist in the colony:
   - Calculate ideology distance from colonist to the rallying faction's position
   - Compute `distanceFactor = max(0, 1 - dist * 0.5) ^ 2`; skip if 0
   - Calculate susceptibility: `1 - conviction * 0.5`
   - Compute nudge strength: `RALLY_IDEOLOGY_NUDGE * susceptibility * distanceFactor`
   - Shift each ideology axis toward faction position by `diff * nudge`

**Why a separate constant:** `RALLY_DISTANCE_ATTENUATION` (0.5) is lower than `IDEOLOGY_DISTANCE_ATTENUATION` (0.7), giving rallies broader reach. This models propaganda campaigns being more persuasive than casual conversation, while still respecting large ideological gaps. The cutoff distance is ~2.0 vs ~1.43 for organic spread.

**This was the root cause of pocket collapse.** Before gating, the rally mechanism nudged Earth Loyalists (sovereignty ~ -0.6) toward Mars Independence (sovereignty ~ +0.7) at ~0.057 per rally every 2 sols, collapsing clusters before any other mechanic mattered.

## Balance Constants Reference

All constants in `src/core/balance/IdeologyBalance.ts`:

| Constant | Value | Purpose |
|----------|-------|---------|
| `IDEOLOGY_DISTANCE_ATTENUATION` | 0.7 | Attenuation for organic spread and conviction support |
| `RALLY_DISTANCE_ATTENUATION` | 0.5 | Attenuation for rally (broader reach than organic) |
| `CONVICTION_SUPPORT_DISTANCE` | 0.5 | Hard cutoff: neighbors within this distance count as "supporting" |
| `CONVICTION_SUPPORT_THRESHOLD` | 0.25 | Min support ratio needed for conviction growth |
| `IDEOLOGY_SPREAD_RATE` | 0.015 | How fast ideology drifts toward neighbors per tick |
| `IDEOLOGY_SPREAD_CONNECTION_THRESHOLD` | 0.4 | Min relationship strength for spread |
| `CONVICTION_GROWTH_RATE` | 0.035 | How fast conviction grows with support |
| `CONVICTION_DECAY_RATE` | 0.03 | How fast conviction decays without support |

## Supporting Mechanics

These aren't distance-gated but were tuned alongside to support pocket formation:

- **Weighted-blend imprinting** (`IDEOLOGY_IMPRINTING_STRENGTH = 0.7`): New colonists adopt a weighted blend of nearby neighbors' ideology instead of copying the strongest neighbor. Prevents single-neighbor capture.
- **Random ideology lean** (`NEW_COLONIST_IDEOLOGY_SPREAD = 0.5`): New colonists start with random positions in [-0.25, +0.25] per axis instead of dead center. Breaks symmetry so new arrivals don't always bridge between clusters.
- **15 founding colonists** (5 per faction): Larger initial clusters survive better than 3-4 members each.

## Simulation Results

With all three mechanics active (50-run Monte Carlo, seed 1-50):

- ~68% of runs maintain 3+ ideology pockets through the game
- Average 3.3 pockets at sol 50, ~2.8 at endgame
- Win rate ~60% (reduced from ~80% because 3 balanced factions make 65% council majority harder)
