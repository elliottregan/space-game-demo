# Simulation Ideology Strategy Design

## Overview

Update the simulation strategy to pursue the new ideology victory conditions. The AI will opportunistically commit to a faction once it gains council majority, then work toward passing prerequisite projects and the capstone victory.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Faction selection | Hybrid (opportunistic → commit at 50%) | Let natural ideology spread determine momentum |
| Lobbying vs proposals | Projects first | More resource-efficient; lobby only if needed |
| Failed proposal retry | Wait for council shift | Avoid wasting resources on doomed proposals |
| Priority placement | Replace Priority 6 | Ideology is late-game; keep survival priorities intact |
| Metrics tracking | Minimal (VictoryType only) | Get core working first; extend later if needed |

## Victory Types

Update `VictoryType` enum:

```typescript
export type VictoryType =
  | "colony_charter"
  | "return_mission"
  | "declaration_of_sovereignty"
  | "planetary_acquisition";
```

Removed: `population`, `generation_ship` (no longer victory conditions)

## Strategy Behavior

### Commitment Phase

1. Monitor council faction composition each tick
2. Stay opportunistic until a faction reaches ≥50% of council seats
3. Once threshold reached, commit to that faction for the rest of the game

### Advancement Phase (after commitment)

1. Clear failed proposals that now have favorable vote projection
2. Propose next incomplete prerequisite (if vote would pass)
3. Propose capstone when all prerequisites complete and ≥65% council support

### What We're NOT Doing

- Active lobbying (rely on natural ideology spread)
- Extended metrics tracking
- Configurable faction targeting
- Multiple faction pursuit

## Files to Modify

| File | Changes |
|------|---------|
| `src/simulation/types.ts` | Update `VictoryType` enum |
| `src/simulation/SimulationRunner.ts` | Update `mapVictoryType()` |
| `src/simulation/HeuristicStrategy.ts` | Replace `handleVictoryPush()` with ideology logic |

## New Methods in HeuristicStrategy

- `handleIdeologyVictory()` - Main Priority 6 handler
- `checkFactionCommitment()` - Determine when to commit
- `advanceFactionVictory()` - Progress toward capstone
- `tryProposeProject()` - Propose if vote would pass
- `tryProposeCapstone()` - Propose capstone when ready
- `clearRetryableProposals()` - Clear failed proposals with favorable projection

## State

```typescript
private committedFaction: NPCFaction | null = null;
private readonly COMMITMENT_THRESHOLD = 0.5;
```

## Testing

Run simulations after implementation to verify:
- Win rate remains healthy (80-95%)
- Ideology victories occur alongside Colony Charter
- No regressions in survival/defeat rates
