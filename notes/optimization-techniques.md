# Optimization Techniques for Colony Graph & State Management

This document outlines advanced techniques that could improve code quality and performance as the colony graph grows.

## Current State Summary

The codebase already implements several advanced techniques:
- **Adjacency matrix** for political influence (`NPCInfluenceManager.ts`)
- **Triadic closure** algorithm for network evolution
- **Linear dynamics** for support propagation: `s(t+1) = s(t) + α((W ⊙ T) × s(t) - s(t))`
- **Preferential attachment** for social network growth
- **Force-directed layouts** for graph visualization

---

## Graph Theory Techniques

### 1. Sparse Graph Representations

The coworker relationships use `Map<string, CoworkerRelationship>` which is good, but could benefit from an adjacency list structure for faster neighbor queries:

```typescript
// Current: O(n) to find all relationships for a colonist
// Improved: O(degree) with adjacency list
class ColonistGraph {
  private adjacency: Map<ColonistId, Map<ColonistId, CoworkerRelationship>>;

  getNeighbors(id: ColonistId): Map<ColonistId, CoworkerRelationship> {
    return this.adjacency.get(id) ?? new Map();
  }
}
```

This becomes important as colony grows beyond ~100 colonists.

### 2. Community Detection (Louvain/Label Propagation)

The guild system is manually assigned. You could auto-detect communities:

```typescript
// Label propagation for O(m) community detection
function detectCommunities(graph: AdjacencyList): Map<NodeId, CommunityId> {
  // Each node adopts the most frequent label among neighbors
  // Converges to natural community structure
}
```

This would enable emergent social groups that affect morale and productivity.

### 3. Centrality Metrics for Influence

Currently NPCs have equal structural importance. Adding centrality could identify key influencers:

- **Betweenness centrality**: Who bridges factions? (Already have weak ties detection)
- **PageRank/Eigenvector centrality**: Who has influence over influential NPCs?
- **Katz centrality**: Account for path length in influence

```typescript
// PageRank for NPC influence
function computePageRank(W: number[][], damping = 0.85): number[] {
  // Iterative: r = d * W * r + (1-d)/n
  // Converges in ~10-20 iterations for small graphs
}
```

### 4. Graph Partitioning for Faction Conflict

Use spectral clustering or min-cut algorithms to identify natural political divisions:

```typescript
// Fiedler vector (2nd eigenvector of Laplacian) partitions graph
const laplacian = computeLaplacian(adjacency);
const fiedler = secondSmallestEigenvector(laplacian);
// Sign of fiedler[i] determines partition
```

---

## Differential Equations / Continuous Dynamics

### 1. Continuous Resource Flow (ODEs)

Current system uses discrete ticks. For smoother simulation (especially at high speeds), consider ODE integration:

```typescript
// Current: resources += production - consumption (Euler method)
// Improved: RK4 integration for stability
function rk4Step(state: ResourceState, dt: number): ResourceState {
  const k1 = computeDerivatives(state);
  const k2 = computeDerivatives(add(state, scale(k1, dt/2)));
  const k3 = computeDerivatives(add(state, scale(k2, dt/2)));
  const k4 = computeDerivatives(add(state, scale(k3, dt)));
  return add(state, scale(add(k1, scale(k2, 2), scale(k3, 2), k4), dt/6));
}
```

Benefits: Handles stiff systems (rapid production changes), enables variable time-step.

### 2. Epidemic/Diffusion Models for Morale

Morale could spread through the social network using SIR-like dynamics:

```typescript
// Morale diffusion: dm_i/dt = -β*m_i + Σ_j w_ij * (m_j - m_i)
// Low morale spreads through connections, dampened by isolation
```

### 3. Lotka-Volterra for Faction Dynamics

Model faction competition as predator-prey dynamics:

```typescript
// dF1/dt = r1*F1*(1 - F1/K) - α*F1*F2  (logistic with competition)
// Creates emergent boom/bust cycles in political power
```

---

## Matrix Techniques

### 1. Matrix Exponential for Steady-State

The current support propagation uses iterative updates. For equilibrium analysis:

```typescript
// Steady state: s* = (I - α(W⊙T))^(-1) * b
// Or use matrix exponential: s(t) = exp(tA) * s(0)
function matrixExponential(A: number[][], t: number): number[][] {
  // Padé approximation or eigendecomposition
  // Useful for predicting long-term political outcomes
}
```

### 2. Eigenvalue Analysis for Stability

Analyze whether the political system is stable:

```typescript
// If max|eigenvalue(W⊙T - I)| < 1, system is stable
// Dominant eigenvalue indicates convergence rate
const eigenvalues = computeEigenvalues(effectiveMatrix);
const spectralRadius = Math.max(...eigenvalues.map(Math.abs));
```

### 3. Low-Rank Approximation (SVD)

As the relationship matrix grows, use SVD for compression:

```typescript
// W ≈ U * Σ * V^T with k singular values
// Reduces O(n²) storage to O(nk) for k << n
function lowRankApprox(W: number[][], k: number): LowRankMatrix {
  const { U, S, V } = svd(W);
  return { U: U.slice(0, k), S: S.slice(0, k), V: V.slice(0, k) };
}
```

---

## Other CS Techniques

### 1. Event Sourcing for State Management

Instead of mutating state directly, record all changes as events:

```typescript
interface StateEvent {
  type: 'RESOURCE_PRODUCED' | 'COLONIST_ASSIGNED' | ...;
  payload: unknown;
  timestamp: number;
}

class EventSourcedState {
  private events: StateEvent[] = [];
  private snapshot: GameState;

  apply(event: StateEvent) {
    this.events.push(event);
    this.snapshot = reduce(this.snapshot, event);
  }

  // Time travel debugging, replay, undo
  replayTo(timestamp: number): GameState { ... }
}
```

### 2. Incremental Computation (Differential Dataflow)

Avoid recomputing everything each tick:

```typescript
// Current: recalculate all resource flows each tick
// Improved: only recompute what changed
class IncrementalResourceFlow {
  private cache: Map<BuildingId, ResourceDelta>;

  onBuildingChanged(id: BuildingId) {
    // Only update affected flows
    this.invalidate(id);
    this.propagate(this.getDependents(id));
  }
}
```

### 3. Spatial Indexing (Quadtree/R-tree)

If buildings have spatial positions, use spatial indexing for proximity queries:

```typescript
class SpatialIndex {
  private quadtree: Quadtree<Building>;

  findNearby(pos: Position, radius: number): Building[] {
    // O(log n + k) instead of O(n)
  }
}
```

### 4. Memoization with Dependency Tracking

The facade layer could use computed properties with automatic invalidation:

```typescript
class MemoizedFacade {
  @computed(['buildings', 'workforce'])
  get totalProductivity(): number {
    // Only recomputes when dependencies change
  }
}
```

---

## Game Development State Management

### 1. ECS (Entity-Component-System) Pattern

Current system uses manager classes per domain. ECS separates data from behavior:

```typescript
// Components are pure data
interface PositionComponent { x: number; y: number; }
interface HealthComponent { current: number; max: number; }

// Systems process entities with specific components
class MovementSystem {
  update(entities: Entity[], dt: number) {
    for (const e of entities.with(Position, Velocity)) {
      e.position.x += e.velocity.x * dt;
    }
  }
}
```

Benefits: Cache-friendly iteration, easy to add new behaviors, parallelizable.

### 2. Immutable State + Structural Sharing

For better Vue reactivity and time-travel:

```typescript
import { produce } from 'immer';

// Immutable updates with structural sharing
const newState = produce(state, draft => {
  draft.resources.food += 10;
});
// Only changed branches are new objects
```

### 3. Command Pattern for Actions

Wrap all mutations in command objects:

```typescript
interface Command {
  execute(state: GameState): Result<GameEvent[]>;
  undo(state: GameState): void;
}

class AssignColonistCommand implements Command {
  constructor(private colonistId: string, private buildingId: string) {}

  execute(state) {
    // Store previous assignment for undo
    this.previousAssignment = state.workforce.getAssignment(this.colonistId);
    return state.workforce.assign(this.colonistId, this.buildingId);
  }

  undo(state) {
    state.workforce.assign(this.colonistId, this.previousAssignment);
  }
}
```

### 4. Reactive State with Signals

Vue's reactivity is good, but for core logic, consider fine-grained signals:

```typescript
import { signal, computed, effect } from '@preact/signals-core';

const food = signal(100);
const population = signal(10);
const foodPerCapita = computed(() => food.value / population.value);

effect(() => {
  if (foodPerCapita.value < 1) triggerFoodWarning();
});
```

---

## Recommended Priority Order

| Technique | Impact | Complexity | When to Implement |
|-----------|--------|------------|-------------------|
| Adjacency list for colonists | High | Low | When colony > 50 |
| Incremental computation | High | Medium | When tick time > 16ms |
| Community detection | Medium | Low | For emergent gameplay |
| Centrality metrics | Medium | Low | For political depth |
| ODE integration | Medium | Medium | For smooth time-warp |
| Event sourcing | High | High | For save/replay systems |
| ECS refactor | High | High | Major version rewrite |

---

## References

- [Louvain Algorithm](https://en.wikipedia.org/wiki/Louvain_method) - Community detection
- [PageRank](https://en.wikipedia.org/wiki/PageRank) - Centrality metrics
- [Runge-Kutta Methods](https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods) - ODE integration
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) - State management pattern
- [ECS Architecture](https://en.wikipedia.org/wiki/Entity_component_system) - Game development pattern
