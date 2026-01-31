# Ideology Victory Balancing - Debugging Notes

## Problem Statement

When testing the opportunistic strategy (no target faction specified), Earth Loyalists won 100% of games. The goal was to balance victory distribution so all three ideology paths are achievable.

## Investigation

### Initial Hypothesis

Ran debug scripts tracking council composition over time:

```
Sol 0-30:  EL dominates council (2-3 seats out of 5)
Sol 30-50: Council becomes more contested
Sol 70+:   CI tends to dominate
```

The opportunistic strategy commits to whichever faction has 50%+ council seats. Since EL dominated early and commitment happened around sol 25-35, EL always won.

### Root Cause Analysis

Two factors contributed to Earth Loyalists' early dominance:

#### 1. Tie-Breaking Bias in `getPrimaryFaction`

When colonists had equal affinity for multiple factions, the code always returned the first faction checked:

```typescript
// OLD CODE - always favors EL when tied
if (earthLoyalist === max) return NPCFaction.EarthLoyalists;
if (marsIndependence === max) return NPCFaction.MarsIndependence;
if (corporateInterests === max) return NPCFaction.CorporateInterests;
```

Since many founding colonists start with neutral/equal affinities, this systematically pushed them toward EL.

#### 2. Mars Independence Weaker Relationship Bonds

Examining `foundingColonists.ts`, the relationship strengths were imbalanced:

| Faction | Strong Bonds (0.6+) | Medium Bonds (0.4-0.5) |
|---------|---------------------|------------------------|
| Earth Loyalists | 2 | 2 |
| Corporate Interests | 2 | 2 |
| Mars Independence | 1 | 2 |

MI colonists had weaker internal bonds, meaning their ideology spread less effectively through the social network.

## Solutions Implemented

### Fix 1: Random Tie-Breaking

Changed `getPrimaryFaction` to collect tied factions and randomly select:

```typescript
// NEW CODE - random selection when tied
const tiedFactions: NPCFaction[] = [];
if (earthLoyalist === max) tiedFactions.push(NPCFaction.EarthLoyalists);
if (marsIndependence === max) tiedFactions.push(NPCFaction.MarsIndependence);
if (corporateInterests === max) tiedFactions.push(NPCFaction.CorporateInterests);

return tiedFactions[rng.int(0, tiedFactions.length - 1)]!;
```

**File:** `src/core/systems/IdeologyManager.ts`

### Fix 2: Balanced Mars Independence Bonds

Increased MI colonist bond strengths to match other factions:

```typescript
// Before → After
"founding_maria_santos:founding_james_liu": 0.6 → 0.7
"founding_james_liu:founding_marcus_reed": 0.4 → 0.5
"founding_aisha_patel:founding_marcus_reed": 0.3 → 0.4
```

**File:** `src/core/data/foundingColonists.ts`

### Fix 3: Randomized Commitment Timing

Added variety to when the opportunistic strategy commits to a faction:

```typescript
// Set randomly in constructor (sol 25-50)
this.commitmentMinSol = rng.int(25, 50);
```

This creates natural variation:
- Early commitment (sol 25-35): EL tends to dominate → EL wins
- Mid commitment (sol 35-45): More contested → varied outcomes
- Late commitment (sol 45-50): CI tends to dominate → CI wins

**File:** `src/simulation/HeuristicStrategy.ts`

## Results

### Before Fixes
```
=== Opportunistic Strategy (50 runs) ===
Win rate: 100%
Victory breakdown:
  - Return Mission (EL): 50 (100%)
```

### After Fixes
```
=== Opportunistic Strategy (50 runs) ===
Win rate: 100%
Victory breakdown:
  - Acquisition (CI): 21 (42%)
  - Return Mission (EL): 18 (36%)
  - Declaration (MI): 11 (22%)
```

All three ideology victory paths are now achievable with meaningful variety.

## Key Learnings

1. **Order-dependent code creates hidden biases** - When iterating through options, the first match wins. This can systematically favor certain outcomes.

2. **Social network effects compound** - Stronger relationship bonds lead to faster ideology propagation. Small differences in bond strength have outsized effects on council composition.

3. **Timing matters for commitment** - The opportunistic strategy's success depends heavily on WHEN it commits, not just WHAT faction it commits to. Different factions dominate at different game phases.

4. **Debug by tracking state over time** - Running scripts that log council composition at each sol revealed the temporal dynamics that led to EL dominance.
