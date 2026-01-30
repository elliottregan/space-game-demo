# Colonist Centrality & Morale Propagation Design

## Overview

Add per-colonist morale with network propagation, where high-centrality colonists spread their morale state to neighbors. This creates emergent social dynamics where keeping "social hubs" happy becomes strategically important.

## Core Mechanics

### Per-Colonist Morale & Needs Hierarchy

Each colonist gets an individual morale value (0-100) derived from four need levels:

| Need | Weight | Satisfied When |
|------|--------|----------------|
| Physiological | 40% | Colony has positive food/water/oxygen flow |
| Safety | 25% | Colonist housed in a habitat |
| Social | 20% | 3+ connections with avg strength ≥ 0.5 |
| Esteem | 15% | Skill-matched work, mastery progression |

**Base morale formula:**
```
base_morale = Σ(need_satisfaction × weight) × 100
```

Each need satisfaction is 0.0-1.0. This base morale represents what the colonist would feel in isolation, before social influence.

### Eigenvector Centrality

Measures recursive influence: a colonist is central if connected to other central colonists.

```typescript
function computeEigenvectorCentrality(
  adjacencyList: Map<string, Set<string>>,
  getWeight: (id1: string, id2: string) => number,
  maxIterations: number = 20,
  tolerance: number = 0.0001
): Map<string, number> {
  const ids = [...adjacencyList.keys()];
  const n = ids.length;

  // Initialize all centralities to 1/n
  let centrality = new Map(ids.map(id => [id, 1 / n]));

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Map<string, number>();
    let maxDelta = 0;

    for (const id of ids) {
      // Sum of neighbors' centrality × edge weight
      let sum = 0;
      for (const neighborId of adjacencyList.get(id) ?? []) {
        const weight = getWeight(id, neighborId);
        sum += (centrality.get(neighborId) ?? 0) * weight;
      }
      next.set(id, sum);
    }

    // Normalize to sum to 1
    const total = [...next.values()].reduce((a, b) => a + b, 0);
    for (const [id, val] of next) {
      const normalized = total > 0 ? val / total : 1 / n;
      maxDelta = Math.max(maxDelta, Math.abs(normalized - (centrality.get(id) ?? 0)));
      next.set(id, normalized);
    }

    centrality = next;
    if (maxDelta < tolerance) break;
  }

  return centrality;
}
```

**Recalculation schedule:** Every 20 sols (configurable). Cached between recalculations.

**Output:** Map of colonist ID → centrality score (0 to 1, summing to 1 across all colonists).

### Morale Propagation

Each tick, colonist morale moves toward a blend of their base morale and their neighbors' morale, weighted by relationship strength and centrality.

```typescript
function propagateMorale(
  colonistId: string,
  baseMorale: number,
  currentMorale: number,
  neighbors: Map<string, number>, // neighborId → relationship strength
  getMorale: (id: string) => number,
  getCentrality: (id: string) => number,
  alpha: number = 0.15
): number {
  if (neighbors.size === 0) {
    // Isolated: morale drifts toward base only
    return currentMorale + alpha * (baseMorale - currentMorale);
  }

  // Weighted average of neighbors' morale
  let neighborInfluence = 0;
  let totalWeight = 0;

  for (const [neighborId, strength] of neighbors) {
    const neighborCentrality = getCentrality(neighborId);
    const weight = strength * neighborCentrality;
    neighborInfluence += getMorale(neighborId) * weight;
    totalWeight += weight;
  }

  const socialMorale = totalWeight > 0 ? neighborInfluence / totalWeight : baseMorale;

  // Blend: 70% base needs, 30% social influence
  const targetMorale = 0.7 * baseMorale + 0.3 * socialMorale;

  // Gradual drift toward target
  return currentMorale + alpha * (targetMorale - currentMorale);
}
```

**Key dynamics:**
- High-centrality neighbors pull harder on your morale
- Strong relationships transmit more influence than weak ties
- Base needs dominate (70%), but social context matters (30%)
- Isolated colonists converge purely to their base morale

### Colony Morale Aggregation

Individual morales combine using centrality-weighted averaging:

```typescript
function computeColonyMorale(
  colonistIds: string[],
  getMorale: (id: string) => number,
  getCentrality: (id: string) => number
): number {
  if (colonistIds.length === 0) return 50;

  let weightedSum = 0;
  let totalCentrality = 0;

  for (const id of colonistIds) {
    const morale = getMorale(id);
    const centrality = getCentrality(id);
    weightedSum += morale * centrality;
    totalCentrality += centrality;
  }

  return totalCentrality > 0 ? weightedSum / totalCentrality : 50;
}
```

**Gameplay implications:**
- Keeping social hubs happy is strategic priority
- Losing a happy hub hits harder than losing a loner
- Players can identify "mood risks" by finding unhappy central colonists

## Architecture

### RelationshipManager (extended)

- Add `computeEigenvectorCentrality()` method
- Add `centralityCache: Map<string, number>` with `lastComputedSol`
- Add `getCentrality(colonistId): number` returning cached value
- Add `recalculateCentralityIfStale(currentSol)` called during tick

### New: ColonistMoraleManager

```
src/core/systems/ColonistMoraleManager.ts
```

- Owns per-colonist morale state: `Map<string, number>`
- `calculateBaseMorale(colonist, resources, relationships)` → needs hierarchy
- `propagateMorale(currentSol)` → network propagation
- `getColonyMorale()` → centrality-weighted aggregation
- Injected with ResourceManager, RelationshipManager, ColonyManager

### ColonyManager (simplified)

- Remove `morale` field (computed by ColonistMoraleManager)
- `getMorale()` delegates to ColonistMoraleManager
- `applySocialCohesionEffects()` removed (superseded)

### Tick Order

```
Resources → Buildings → Workforce → Relationships → ColonistMorale → Colony → ...
```

## UI & Visibility

**Colony View enhancements:**
- Colonist list shows individual morale bar (green/yellow/red)
- Badge for high centrality (e.g., ★ for top 20%)
- Tooltip: "Physiological ✓ | Safety ✓ | Social ⚠ | Esteem ✓"

**Colonist Graph (D3):**
- Node size scaled by centrality
- Node color reflects individual morale (green → red)
- Hover tooltip: "Alex Chen — Morale: 72 | Centrality: High | 6 connections"

**Event log:**
- "Alex Chen's low morale is affecting their social circle" (high-centrality below threshold)
- "Social dynamics shifting — Morgan Kim has become a key connector" (centrality changes)

## Balance Constants

```typescript
// src/core/balance/MoraleBalance.ts

export const COLONIST_MORALE = {
  // Needs hierarchy weights (sum to 1.0)
  NEEDS_WEIGHTS: {
    physiological: 0.40,
    safety: 0.25,
    social: 0.20,
    esteem: 0.15,
  },

  // Social need thresholds
  SOCIAL_ISOLATED_THRESHOLD: 1,
  SOCIAL_SATISFIED_CONNECTIONS: 3,
  SOCIAL_SATISFIED_STRENGTH: 0.5,

  // Propagation parameters
  PROPAGATION_ALPHA: 0.15,
  BASE_MORALE_WEIGHT: 0.70,
  SOCIAL_INFLUENCE_WEIGHT: 0.30,

  // Centrality recalculation
  CENTRALITY_RECALC_INTERVAL: 20,
  CENTRALITY_MAX_ITERATIONS: 20,
  CENTRALITY_TOLERANCE: 0.0001,

  // Event thresholds
  HIGH_CENTRALITY_THRESHOLD: 0.15,
  LOW_MORALE_SPREAD_WARNING: 40,
};
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Single colonist | Centrality = 1.0, morale = base morale only |
| All isolated | Each converges to base morale, colony = simple average |
| Disconnected components | Each component has internal influence |
| New colonist | Centrality = 0 until next recalc; morale starts at base |
| Colonist death | Remove from cache; trigger recalc if high-centrality |
| Save/load | Serialize per-colonist morale and centrality cache |

## Testing

**Unit tests:**
- `ColonistMoraleManager.test.ts`
  - Isolated colonist morale converges to base
  - High-centrality happy colonist raises neighbors
  - High-centrality unhappy colonist drags down neighbors
  - Colony morale weights by centrality correctly
  - Centrality recalculates after interval

- `RelationshipManager.test.ts` (additions)
  - Eigenvector centrality converges for simple graph
  - Eigenvector centrality identifies hub correctly
  - Centrality cache invalidates after interval

**Simulation targets:**
- Morale stabilizes within 30-50 sols after disruption
- High-centrality death causes 10-20% colony morale drop
- Isolated colonists trend toward base morale within 10 sols
