# Resource Depletion & Recycling System Design

## Overview

A system that makes resource acquisition dynamic and requires active management. Mining facilities extract from finite deposits that deplete over time with uncertain reserves. Players can recycle and repurpose buildings to recover materials and adapt to changing conditions.

**Core tensions**: Scarcity pressure + efficiency optimization

## Deposit Mechanics

**Deposits** are finite resource sources discovered through prospecting or events. Each deposit has:

- **Resource type**: materials, water, or rare minerals (new)
- **Total reserves**: The actual amount available (hidden from player)
- **Estimated reserves**: What the player sees, with ±30% uncertainty
- **Quality**: poor/moderate/rich - affects extraction rate, not total amount
- **Status**: undeveloped → active → depleted → (recycled)

**Extraction** works as follows:
- A mining building placed on a deposit extracts resources each sol
- Rich deposits extract faster (more per sol), but deplete sooner
- Poor deposits are slower but last longer
- The estimate updates as you mine, becoming more accurate over time

**Depletion events**:
- At 25% remaining: "Reserves running lower than expected" (or higher)
- At 10% remaining: Warning that deposit is nearly exhausted
- At 0%: Production stops, building becomes idle

**Example**: You discover a "moderate water deposit, estimated 400-600 units." You build a Water Extractor on it, producing 4/sol. After 50 sols (200 extracted), your estimate narrows to "280-350 remaining." The actual value was 520, so you have ~320 left.

## Recycling & Repurposing

**Recycling** lets you demolish structures to recover materials:

| Item | Recovery Rate |
|------|---------------|
| Standard buildings | 40% of build cost |
| Depleted mining buildings | 25% (equipment worn) |
| Active mining buildings | 50% (still functional) |
| Damaged buildings (from events) | 10-20% |

Recycling takes time - roughly 25% of the original construction time. You can rush it for reduced returns (30% less materials).

**Repurposing** converts a building to a different type without full demolition:

- Costs 30% of the new building's materials
- Takes 50% of the new building's construction time
- Only works within building "families":
  - **Extraction**: Water Extractor ↔ Mining Station
  - **Production**: Basic Farm ↔ Greenhouse (if tech unlocked)
  - **Infrastructure**: Habitat ↔ Storage Depot (new building type)
- Cannot repurpose buildings currently in use (must unassign workers first)

**Depleted mines** have special options:
- Recycle for 25% materials
- Repurpose into Storage Depot (uses the excavated space)
- Abandon (no cost, no return - just clears the slot)

## Resource Events

### Action-Triggered Discoveries (smaller, frequent)

These happen when players take exploration-related actions:

| Trigger | Possible Discovery |
|---------|-------------------|
| Completing a survey expedition | Reveal deposit (common) or rich deposit (rare) |
| Building on new terrain | 15% chance: small material cache (20-50 materials) |
| Recycling old buildings | 10% chance: salvageable components (+25% bonus materials) |
| Research milestones | Occasionally reveal "scanning data" pointing to deposits |

The exploration stance policy (cautious/standard/aggressive) affects discovery rates - aggressive finds more but with higher expedition risk.

### Random Windfalls (rare, significant)

These occur every 50-100 sols on average:

- **Meteor strike**: Dangerous event, but leaves behind rare minerals worth 200-400 materials if you send a salvage team
- **Abandoned cache**: Previous mission's supply drop found - mixed resources (food, materials, water)
- **Geological survey update**: Earth sends new data - reveals 2-3 deposits in your region
- **Equipment windfall**: Arriving colonists bring extra supplies (one-time resource boost)

Windfalls can also be negative-neutral: a meteor strike near a building might damage it but still leave salvage opportunity.

## Integration with Existing Systems

### Prospecting Sites

Current `ProspectingSite` gains new fields:
- `reserves: number` - actual amount (hidden)
- `estimatedReserves: { min: number, max: number }` - player-visible estimate
- `remainingReserves: number` - tracks depletion
- `quality` already exists - now affects extraction rate

### Building Changes

- Mining buildings (`water_extractor`, `mining_station`) require a deposit to be placed
- New property: `depositId?: string` - links to the deposit being worked
- New status: `idle` - when deposit depletes, building stops but isn't destroyed
- Idle buildings consume no power but produce nothing

### New Building: Storage Depot

- Converts from depleted mines or built standalone
- Increases resource storage caps
- Low maintenance cost
- Cost: 40 materials, 8 sols construction

### OperationsManager Changes

- `tick()` decrements deposit reserves based on extraction
- Tracks estimate accuracy, updates player-visible estimate periodically
- Fires events at 25%, 10%, and 0% thresholds

## UI Changes

### Resource Panel

- Active deposits show: "Water Deposit: ~320 remaining" (estimate)
- Estimate accuracy shown subtly: "±30%" early, "±10%" after mining a while
- Warning icons appear at 25% and 10% thresholds

### Building Panel

- Mining buildings show their linked deposit status
- Idle buildings (depleted) highlighted with options: Repurpose / Recycle / Abandon
- When placing a mining building, must select from available deposits

### New: Deposits Panel (or tab)

- List of known deposits: type, quality, status, estimate
- Undeveloped deposits show "Build Extractor" button
- Active deposits show extraction rate and time-to-depletion estimate
- Depleted deposits show salvage options

### Notifications

- "Water deposit nearly exhausted (~50 remaining)"
- "Deposit depleted - Mining Station now idle"
- "Survey expedition discovered a rich materials deposit!"
- "Meteor impact site contains salvageable materials"

## Balance Constants

### Deposit Reserves by Quality

| Quality | Materials | Water | Rare Minerals |
|---------|-----------|-------|---------------|
| Poor | 200-400 | 150-300 | 50-100 |
| Moderate | 400-800 | 300-600 | 100-200 |
| Rich | 800-1500 | 600-1000 | 200-400 |

### Extraction Rates

| Quality | Rate Multiplier |
|---------|-----------------|
| Poor | 0.5x building production |
| Moderate | 1.0x building production |
| Rich | 1.5x building production |

### Estimate Uncertainty

- Initial estimate: ±30% of actual
- After extracting 25%: ±20%
- After extracting 50%: ±10%
- After extracting 75%: ±5% (nearly accurate)

### Event Frequencies

- Action-triggered discoveries: Per trigger rates above
- Random windfalls: Average 1 per 75 sols (variance: 50-100 sols)

### Recycling Constants

- Standard building recovery: 40%
- Depleted mining recovery: 25%
- Active mining recovery: 50%
- Damaged building recovery: 10-20%
- Recycling time: 25% of construction time
- Rush recycling penalty: 30% less materials

### Repurposing Constants

- Material cost: 30% of new building
- Time: 50% of new building construction time

### Starting Conditions

- Game starts with 2-3 revealed deposits near colony
- One is pre-developed (initial extractors sit on it)
- Provides ~100-150 sols before first depletion decision
