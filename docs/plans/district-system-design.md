# District System Design

## Overview

Replace the 10x10 building grid with a district-based colony model to support populations of 100-150 colonists. Districts are named population centers that provide housing, workforce routing, and social structure. This is a prerequisite for the Graph Rewriting Automata (GRA) system — districts make emergent faction dynamics legible to the player.

## Goals

- Scale population from ~28 to 100-150 colonists
- Eliminate habitat placement tedium (50% of current building actions)
- Remove the building grid and simplify power/resource systems
- Bridge physical and social topology — districts become natural social communities
- Make GRA dynamics visible: "Research Campus declared independence" not "some colonists formed a faction"

## Core Model

### What is a District?

A district is a named population center within the colony. It's the primary spatial unit — the grid is gone, replaced by a flat list of districts.

Each district has:
- **Population** — colonists who live there
- **Buildings** — production/research/social buildings assigned to it
- **Capacity** — current housing capacity, grows continuously as population fills up
- **Character** — emergent from residents' ideology and social bonds (feeds into GRA)

### District Data Model

```typescript
interface District {
  id: string;
  name: string;
  foundedAt: number;
  capacity: number;
  growthRate: number;
  growthCap: number | null;
  buildingIds: string[];
}
```

Colonist assignment is tracked via `districtId` on the colonist (replacing `housingId`).

### Founding a District

- Costs 100 materials
- Player names it or gets a generated name
- Starting capacity: 20
- Early game begins with one district ("Landing Site") with 14 colonists

### Continuous Housing Growth

- **Trigger**: occupancy exceeds 80% of capacity
- **Rate**: +1 capacity per 5 sols, consuming 2 materials/sol while growing
- **Pause**: occupancy drops below 60%, materials run out, or player-set cap is hit
- **No upper hard limit** — overcrowding soft cap creates pressure to found new districts

### Overcrowding Soft Cap: 40 Per District

| Occupancy | Effect |
|-----------|--------|
| ≤40 | No penalty |
| 40-50 | Minor morale penalty (-5), slight health risk |
| 50-60 | Moderate morale penalty (-15), faster bond decay |
| 60+ | Severe morale/health penalties, social cohesion breakdown |

Natural colony shape: 3-4 districts for 100-150 population. Player *can* cram everyone into fewer districts but it hurts. More districts means better conditions but weaker cross-district bonds and higher GRA fragmentation risk.

## Workforce Routing

Districts replace the cluster-based transit system.

- Colonists can only work at buildings in their district (same constraint as clusters, cleaner)
- **Cross-district work** possible with -20% productivity penalty (commute overhead)
- Future tech ("Transit Network") could reduce this penalty
- When constructing a building, player chooses which district it belongs to
- Buildings can be reassigned between districts (costs materials, takes time)

## Social Bridge — District to Relationship Network

This is the key integration point for GRA.

### Bonding Rates

| Context | Rate/sol | Notes |
|---------|----------|-------|
| Same workplace | 0.01 | Existing coworker rate |
| Same district | 0.005 | New neighborhood rate |
| Cross-district | 0.001 | Weak ties, colony-wide events only |
| Same district + social building | 0.012 | Existing social rate, boosted |

Creates a natural relationship density gradient: tight workplace bonds → moderate district bonds → weak cross-district ties. This is realistic social structure and ideal input for GRA pattern matching.

### How Districts Feed GRA

- **Coalition Formation**: dense district networks produce many aligned triangles
- **Ideological Schism**: weak cross-district ties decay quickly when districts diverge
- **Leader Emergence**: district-level hub colonists (common room workers, etc.) naturally form star patterns
- **Bridge Burning**: transferred colonists maintain cross-district ties, become bridges under pressure
- **Faction Split**: a fully disconnected district *is* the breakaway faction — visible and comprehensible

### New GRA Rule: District Rivalry

When two districts have high internal cohesion but low cross-district connectivity: competitive morale modifiers, colonists resist transfer to rival district, leaders gain influence faster. A cold war between neighborhoods the player can try to defuse.

## Population Flow

### Three Sources

**Natural growth** — rate scales down with population: `baseRate * (1 - population / 200)`.
- At 14 colonists: ~7% (similar to current)
- At 100: ~4%
- At 150: ~2%
- Babies born into mother's district

**Earth immigration** — periodic waves.
- Early game: every ~50 sols, 3-5 colonists
- Mid game: larger waves (5-10), less frequent as Earth Crisis progresses
- Late game: slows to trickle or stops
- New arrivals unassigned — player chooses district (strategic decision)

**Inter-district transfer** — player-initiated (morale cost) or voluntary.
- Voluntary: colonists whose ideology diverges from district average slowly migrate toward ideologically compatible districts
- Checked every 20 sols, low probability
- Creates organic demographic sorting over time

### Population Loss

- **Death** — existing mechanic (health < 20)
- **Emigration** — sustained low morale + ideological isolation → colonist leaves colony entirely
- **Faction departure** — GRA faction split + failed reconciliation → entire district leaves

## Power and Resources

### Power as Colony-Wide Ledger

```
Colony Power Balance = Σ(power source output) - Σ(building consumption)
```

Three states:
- **Surplus** — everything runs normally
- **Deficit** — buildings shut down in priority order (player-configurable)
- **Critical** — deficit >50% of demand, colony-wide morale/health penalties

No batteries, no power chains, no distance-to-power.

### Resources

Unchanged. Buildings produce and consume resources per sol based on staffing efficiency. ResourceManager tracks flat flows. Deposit-extraction-from-grid-cell path removed.

### Life Support

Colony-wide balance like power. Oxygen generators contribute to colony total. Deficit means health penalties distributed to most overcrowded districts first.

## District Lifecycle

### Early Game (sols 1-100)

One district ("Landing Site"), 14 colonists, capacity ~20. Player builds production buildings within it. Housing grows passively. Feels similar to current game but without grid placement.

### Mid Game (sols 100-300)

Population hits 25-30. Overcrowding prompts founding second district. First strategic decision: what buildings go where, which colonists relocate? Two districts begin developing separate social identities.

### Late Game (sols 300+)

80-150 colonists across 3-5 districts. Each has its own social character and ideological lean. Leaders emerge per district. Cross-district bonds thin. Player manages inter-district politics — keeping colony unified enough to avoid splits while allowing diversity.

### Player Actions

1. **Found District** — 100 materials, name it, appears in district list
2. **Build [Building]** — choose type, choose district, confirm
3. **Transfer Colonist** — move between districts (morale cost, 1 sol delay)
4. **Set Growth Cap** — limit district auto-expansion to conserve materials

Four actions. No grid cells, no placement coordinates, no habitat spam.

## Removed Systems

### Removed Entirely

- `GridManager` — 10x10 cell grid, placement logic, BFS power propagation, cluster system
- `GridCell`, `BuildingPlacement`, `Cluster`, `PlacementHints` — grid model types
- `GridBalance.ts` — battery, depot range, power chain constants
- Deposit system — water/mineral grid cells
- Rover Depot building — only purpose was bridging clusters
- Power chain mechanic — replaced by colony-wide budget
- Grid-related tick phases — `processGridTick`, power connection updates

### Removed Buildings

- Habitat Module — replaced by district auto-growth
- Advanced Habitat — same
- Rover Depot — no grid to bridge

### Replacement Map

| Current | Replacement |
|---------|------------|
| Grid placement | "Build in district X" |
| Cluster transit | District-based workforce routing |
| Per-cell power propagation | Colony-wide power balance |
| Habitat buildings (x7 per game) | District auto-growth |
| `housingId` → building ID | `districtId` → district ID |
| Cluster-based worker filtering | District-based worker filtering |
| Grid serialization | District list serialization |

## Modified Systems

### Kept but Changed

- **`BuildingManager`** — drops grid methods, adds `districtId` to buildings
- **`ColonyManager`** — `assignHousing()` → `assignToDistrict()`, growth curve adjusted
- **`WorkforceManager`** — bonding scoped by district, new neighborhood bonding layer
- **`GameState`** — owns `DistrictManager` instead of `GridManager`, tick phases updated
- **`GameService`** — syncs district state instead of grid state
- **Facades** — `BuildingsFacade` drops grid placement, adds district assignment
- **`HeuristicStrategy`** — district decisions instead of grid placement for simulations
- **Building definitions** — drop Habitat/Advanced Habitat/Rover Depot, keep everything else

### Unchanged Systems

- Technology tree
- Operations/Expeditions
- Event system
- Politics/Ideology (gets better input, system unchanged)
- Victory conditions
- Worker skills/mastery/training
- Guilds
- Earth Crisis
- SimulationRunner/MetricsCollector (structurally)

## Test Impact

- ~10-15 test files directly test grid/cluster/power → **rewrite or delete**
- ~20-30 test files reference grid in setup → **update setup helpers**
- ~30-40 test files test pure logic with no grid dependency → **untouched**

## UI Changes

### Colony Overview (Main Screen)

District card view replacing the grid canvas. Each card shows:
- Name and population (e.g., "Landing Site — 34/40")
- Growth status
- Building count by category
- Mood indicator
- Ideology tendency

### District Detail View

- Colonist list with roles, skills, ideology
- Building list with staffing and production
- Social cohesion summary
- District-level modifiers
- Actions: build, transfer, set growth cap

### Colony Map (Optional, Non-Interactive)

Stylized visualization: districts as nodes, connection lines showing cross-district relationship density. Narrative aid for understanding social structure. Not load-bearing — game works fully from card/list view. Can ship as polish pass after core system.

### Removed from UI

- Grid canvas with cell selection
- Building placement drag/drop
- Power overlay
- Deposit markers
- Cluster boundaries

## Size Estimate

- **Removed**: ~1500-2000 lines of grid code, ~500 lines of grid tests
- **Added**: ~400-600 lines of district code
- **Net**: reduction in codebase size
