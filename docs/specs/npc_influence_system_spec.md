# NPC Influence Propagation System Specification

## Overview

This document describes a graph-based influence propagation system for modeling how project proposals gain or lose support among NPCs in a parliamentary/council setting. The system uses linear algebra and discrete-time dynamics to simulate how ideas spread through social networks based on faction alignment, relationship strength, and strategic player interventions.

## Core Concept

Support for projects spreads through a network of NPCs over discrete time steps. Each NPC has:
- A **faction alignment** (Traditionalist, Progressive, Futurist)
- A **support level** for each active project (ranging from -1.0 to +1.0)
- **Relationship connections** to other NPCs with varying strengths

Support flows through the relationship network, with the rate of spread influenced by faction compatibility and relationship strength.

---

## Mathematical Model

### Core Equation

The system updates support levels using a discrete-time linear dynamical system:

```
s(t+1) = s(t) + α(WTs(t) - s(t))
```

Or equivalently:
```
s(t+1) = (1-α)s(t) + αWTs(t)
```

Where:
- **s(t)** = N-dimensional vector of support levels at time t (one value per NPC)
- **W** = N×N weighted adjacency matrix (relationship strengths)
- **T** = N×N transmission factor matrix (faction compatibility)
- **α** = drift rate parameter (controls speed of influence spread, typically 0.1 to 0.5)
- **N** = number of NPCs in the system

### Support Values

- **Range:** -1.0 to +1.0
  - +1.0 = Completely supportive
  - 0.0 = Neutral
  - -1.0 = Completely opposed
- **Initial state:** All NPCs start at 0.0 (neutral) for new proposals
- **Player seeding:** Player actions can set specific NPCs to higher values (e.g., +0.7, +0.9)

---

## System Components

### 1. Relationship Matrix (W)

The weighted adjacency matrix represents social connections between NPCs.

**Structure:**
- N×N matrix where W[i][j] represents the relationship strength from NPC j to NPC i
- Values range from 0.0 (no relationship) to 1.0 (very strong relationship)
- Can be asymmetric (NPC A's influence on B ≠ B's influence on A)
- Diagonal should typically be 0 (NPCs don't influence themselves)

**Example (3 NPCs):**
```
     Alice  Bob  Carol
Alice [  0   0.5   0.2 ]
Bob   [ 0.6   0   0.3 ]
Carol [ 0.3  0.8   0  ]
```

This means:
- Bob has 0.5 relationship weight with Alice (Alice influences Bob at 0.5 strength)
- Bob has 0.8 relationship weight with Carol
- The relationship is not symmetric (Bob→Alice is 0.6, Alice→Bob is 0.5)

**Design notes:**
- Normalize rows so they sum to ≤ 1.0 to prevent runaway amplification
- Player action "create space council" = increase W[i][j] values between specific NPCs

### 2. Transmission Factor Matrix (T)

The transmission factor matrix represents how receptive each NPC is to influence from other NPCs based on faction alignment and project type.

**Structure:**
- N×N matrix where T[i][j] represents how receptive NPC i is to influence from NPC j
- Values range from 0.0 (completely resistant) to 1.0 (completely receptive)
- **Project-specific:** T changes based on what project is being considered
- Diagonal should be 1.0 (NPCs are fully receptive to their own current opinion)

**Calculation:**
```
T[i][j] = base_transmission_factor(faction[i], faction[j], project_type)
```

**Example transmission factors for "Build Generation Ship" project:**

| From ↓ / To → | Futurist | Progressive | Traditionalist |
|---------------|----------|-------------|----------------|
| Futurist      | 1.0      | 0.7         | 0.3            |
| Progressive   | 0.6      | 1.0         | 0.5            |
| Traditionalist| 0.2      | 0.4         | 1.0            |

**Interpretation:**
- Futurist → Futurist: 1.0 (highly receptive to other futurists on this project)
- Futurist → Progressive: 0.7 (progressives are fairly receptive to futurist ideas)
- Traditionalist → Futurist: 0.2 (futurists largely ignore traditionalist opposition)

**Design notes:**
- These values should be tuned per project type
- Can be modified by game events (successful futurist project = increase futurist transmission factors)
- Higher values = faster spread between those factions

### 3. Drift Rate (α)

Controls how quickly NPCs respond to influence from their neighbors.

**Typical range:** 0.1 to 0.5
- **Low values (0.1-0.2):** Slow, realistic drift over many time steps
- **High values (0.4-0.5):** Faster convergence, more dramatic swings

**Effect:**
- α = 0.3 means NPCs move 30% of the way toward their "target" support level each time step
- Lower α gives player more time to intervene
- Higher α makes influence spread feel more viral

**Design recommendation:** Start with α = 0.2 and tune based on gameplay feel.

---

## Implementation Details

### Data Structures

```typescript
interface NPC {
  id: string;
  name: string;
  faction: 'traditionalist' | 'progressive' | 'futurist';
}

interface Project {
  id: string;
  name: string;
  type: 'futurist' | 'progressive' | 'traditionalist'; // primary alignment
  supportLevels: Map<string, number>; // NPC id -> support level (-1 to +1)
}

interface InfluenceSystem {
  npcs: NPC[];
  relationshipMatrix: number[][]; // W matrix
  transmissionFactors: Map<string, number[][]>; // project type -> T matrix
  driftRate: number; // α parameter
  projects: Project[];
}
```

### Algorithm: Single Time Step Update

```typescript
function updateSupport(
  currentSupport: number[],  // s(t)
  W: number[][],              // relationship matrix
  T: number[][],              // transmission matrix
  alpha: number               // drift rate
): number[] {
  const N = currentSupport.length;
  const newSupport = new Array(N);
  
  // Compute target support: W * T * s(t)
  // This is matrix multiplication of (W×T) times vector s(t)
  const WT = matrixMultiply(W, T);  // combine relationship and transmission
  const target = matrixVectorMultiply(WT, currentSupport);
  
  // Move partway toward target
  for (let i = 0; i < N; i++) {
    newSupport[i] = currentSupport[i] + alpha * (target[i] - currentSupport[i]);
    
    // Clamp to valid range
    newSupport[i] = Math.max(-1.0, Math.min(1.0, newSupport[i]));
  }
  
  return newSupport;
}
```

### Matrix Multiplication Helpers

```typescript
function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;
  
  const result: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));
  
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }
  
  return result;
}

function matrixVectorMultiply(M: number[][], v: number[]): number[] {
  const result = new Array(M.length).fill(0);
  
  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < v.length; j++) {
      result[i] += M[i][j] * v[j];
    }
  }
  
  return result;
}
```

---

## Player Actions

### 1. Direct Lobbying (Seed Support)

**Mechanic:** Player spends resources to directly increase an NPC's support level.

**Implementation:**
```typescript
function lobbyNPC(
  project: Project,
  npcId: string,
  supportBoost: number, // e.g., +0.3, +0.5
  cost: Resources
): void {
  const currentSupport = project.supportLevels.get(npcId) || 0;
  const newSupport = Math.max(-1.0, Math.min(1.0, currentSupport + supportBoost));
  project.supportLevels.set(npcId, newSupport);
  
  // Deduct resources from player
  player.resources -= cost;
}
```

**Design notes:**
- More influential NPCs (high centrality in network) should cost more to lobby
- Lobbying NPCs aligned with the project (faction match) should be more effective
- Consider diminishing returns (harder to push from +0.8 to +1.0 than from 0 to +0.2)

### 2. Grant Money / Favors

**Mechanic:** Similar to lobbying but framed as resource investment.

**Implementation:** Same as lobbying, but may have different cost curves or targeting rules.

### 3. Create Councils / Modify Network Structure

**Mechanic:** Player creates new institutional structures that increase relationship weights between specific NPCs.

**Implementation:**
```typescript
function createCouncil(
  councilName: string,
  memberIds: string[],
  relationshipBoost: number // e.g., +0.2
): void {
  // Increase relationship weights between all council members
  for (const id1 of memberIds) {
    for (const id2 of memberIds) {
      if (id1 !== id2) {
        const i = npcIdToIndex(id1);
        const j = npcIdToIndex(id2);
        W[i][j] = Math.min(1.0, W[i][j] + relationshipBoost);
      }
    }
  }
}
```

**Design notes:**
- This is a permanent structural change (persists across projects)
- Creates "echo chambers" that amplify influence within groups
- Strategic depth: player must identify which NPCs to connect

### 4. Trigger Events (Modify Transmission Factors)

**Mechanic:** Successful/failed projects modify faction receptivity.

**Implementation:**
```typescript
function onProjectSuccess(project: Project): void {
  const faction = project.type;
  
  // Successful futurist project makes everyone more receptive to futurist ideas
  modifyTransmissionFactors(faction, +0.1);
}

function onProjectFailure(project: Project): void {
  const faction = project.type;
  
  // Failed futurist project makes everyone less receptive to futurist ideas
  modifyTransmissionFactors(faction, -0.15);
}

function modifyTransmissionFactors(
  sourceFaction: Faction,
  delta: number
): void {
  for (const projectType in transmissionFactors) {
    const T = transmissionFactors[projectType];
    
    for (let i = 0; i < npcs.length; i++) {
      for (let j = 0; j < npcs.length; j++) {
        if (npcs[j].faction === sourceFaction) {
          T[i][j] = Math.max(0, Math.min(1, T[i][j] + delta));
        }
      }
    }
  }
}
```

---

## Simulation Flow

### Initialization

1. Create NPCs with faction assignments
2. Build relationship matrix W (can be random, or hand-crafted)
3. Define transmission factor matrices T for each project type
4. Set drift rate α

### Per-Project Lifecycle

1. **Project proposed:** Initialize all NPCs to support level 0.0
2. **Player seeds support:** Use lobbying actions to set key NPCs to positive values
3. **Simulation runs:** Call `updateSupport()` each game tick/turn
4. **Check threshold:** If average support > threshold (e.g., +0.5), project passes
5. **Apply consequences:** Modify transmission factors based on success/failure

### Example Turn Sequence

```
Turn 1: Player proposes "Build Generation Ship"
  - All NPCs start at support = 0.0
  
Turn 2: Player lobbies 2 key futurists
  - Alice (futurist): 0.0 → +0.8
  - Bob (futurist): 0.0 → +0.7
  
Turn 3-10: Simulation runs
  - updateSupport() called each turn
  - Support spreads through network
  - Futurists quickly converge to positive values
  - Progressives slowly drift positive
  - Traditionalists drift negative
  
Turn 11: Check if project passes
  - Calculate average support across all NPCs
  - If avg > +0.4, project approved
  - Apply success/failure modifiers to transmission factors
```

---

## Configuration & Tuning

### Recommended Starting Values

**Drift rate (α):**
- Start with: 0.2
- Tune based on desired pacing

**Relationship weights (W):**
- Random baseline: 0.1 to 0.4
- Close connections: 0.6 to 0.9
- Normalize rows to sum ≤ 1.0

**Transmission factors (T) for "Futurist" projects:**
```
          Futurist  Progressive  Traditionalist
Futurist      1.0        0.7           0.3
Progressive   0.6        1.0           0.5
Traditionalist 0.2       0.4           1.0
```

**Transmission factors (T) for "Traditionalist" projects:**
```
          Futurist  Progressive  Traditionalist
Futurist      1.0        0.4           0.2
Progressive   0.5        1.0           0.6
Traditionalist 0.3       0.7           1.0
```

### Balance Considerations

**Too slow spread:**
- Increase α
- Increase transmission factors
- Increase relationship weights

**Too fast spread:**
- Decrease α
- Decrease transmission factors
- More heterogeneous faction distribution

**Stagnation (no convergence):**
- Check that W rows sum to ~1.0
- Ensure T diagonal is 1.0
- Verify α > 0

**Runaway values (exceeding [-1, +1]):**
- Add clamping in update function
- Normalize W matrix rows
- Reduce α

---

## Advanced Features (Future)

### Option C: Separate Support/Opposition Metrics

Instead of a single support value, track two separate values:
- `support_level`: 0.0 to 1.0
- `opposition_level`: 0.0 to 1.0

NPCs can be conflicted (high support AND high opposition). Requires two separate spreading processes:

```typescript
interface NPCProjectState {
  support: number;      // 0 to 1
  opposition: number;   // 0 to 1
}

// Run two separate updates
newSupport = updateSupport(currentSupport, W, T_support, alpha);
newOpposition = updateSupport(currentOpposition, W, T_opposition, alpha);
```

Benefits:
- More psychologically realistic
- Can represent internal conflict
- Richer strategic space

Costs:
- Double the computation
- More complex UI/presentation
- Harder to balance

---

## Visualization & Debugging

### Recommended Debug Views

1. **Network graph:** Show NPCs as nodes, relationships as edges, color by faction
2. **Support heatmap:** Color-code NPCs by current support level
3. **Timeline chart:** Plot average support over time steps
4. **Influence flow:** Highlight which NPCs are driving support changes

### Key Metrics to Track

- **Average support:** `mean(s(t))`
- **Support variance:** `variance(s(t))` (convergence indicator)
- **Faction polarization:** Difference between faction means
- **Key influencers:** NPCs with highest weighted degree centrality

### Testing Scenarios

1. **Single seed, homogeneous network:** Should spread uniformly
2. **Opposing seeds:** Should create polarized clusters
3. **Isolated NPC:** Should remain at initial value
4. **High α vs low α:** Verify convergence speed differences

---

## Implementation Checklist

- [ ] Define NPC and Project data structures
- [ ] Implement matrix multiplication helpers
- [ ] Build relationship matrix (W) generator
- [ ] Define transmission factor matrices (T) for each project type
- [ ] Implement `updateSupport()` function with clamping
- [ ] Create player action functions (lobby, create council, etc.)
- [ ] Build simulation loop that calls `updateSupport()` each turn
- [ ] Add success/failure threshold checking
- [ ] Implement transmission factor modification on project outcomes
- [ ] Create debug visualization for support levels
- [ ] Tune α, W, and T parameters for desired gameplay feel
- [ ] Add UI for player to view current support levels
- [ ] Test edge cases (isolated NPCs, opposing seeds, convergence)

---

## References

This system is based on:
- **SIR/SIRS epidemiological models** adapted for opinion dynamics
- **PageRank-style influence propagation** on weighted graphs
- **Linear dynamical systems** on networks
- **Voter models** and threshold models from network science

Key concepts:
- Discrete-time update: `x(t+1) = f(x(t))`
- Weighted graph diffusion: `s_new = W × s_old`
- Faction-aware transmission: `effective_influence = W × T`
- Gradual drift: `s(t+1) = (1-α)s(t) + α × target(t)`

---

## Contact & Questions

For questions about this specification, refer to the original design conversation or consult references on:
- Graph theory and adjacency matrices
- Linear dynamical systems
- Opinion dynamics on networks
- Epidemiological spreading models (SIR/SIRS)
