# Third Place Morale Boost Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Colonists visiting social buildings (third places) receive per-sol morale boosts.

**Architecture:** New tick phase `visitSocialBuildings` runs after workforce phases and before `propagateColonistMorale`. Reads colonist `socialBuildingIds`, applies morale boost from each active social building.

**Tech Stack:** TypeScript, existing tick phase system, ColonistMoraleManager

---

## Overview

Colonists assigned to social buildings (common room, gymnasium) receive a per-sol morale boost. This creates a direct incentive to build and staff social spaces, helping counteract morale crises.

**Phase placement:**
```
workforce phases (work, social bonding)
  ↓
visitSocialBuildings (NEW - apply morale boost)
  ↓
propagateColonistMorale (spread through network)
```

**Boost calculation:**
- Each sol, colonists with `socialBuildingIds` get morale boost
- Boost = building's `moraleBoost / SOCIAL_BUILDING_BOOST_DIVISOR`
- Common room (moraleBoost: 5): +0.5/sol
- Gymnasium (moraleBoost: 6): +0.6/sol
- Multiple buildings stack (visiting both = +1.1/sol)
- Morale capped at 100

## Implementation

### Balance Constant

In `src/core/balance/MoraleBalance.ts`:
```typescript
export const COLONIST_MORALE = {
  // ... existing constants
  SOCIAL_BUILDING_BOOST_DIVISOR: 10, // moraleBoost / this = per-sol gain
};
```

### New Tick Phase

In `src/core/tick/phases/colonistMorale.ts`:
```typescript
export const visitSocialBuildings = definePhase({
  id: "colony:visitSocialBuildings",
  name: "Visit Social Buildings",
  reads: ["colony", "buildings", "colonistMorale"],
  writes: ["colonistMorale"],
  execute(ctx: TickContext): GameEvent[] {
    const colonists = ctx.colony.getColonists();

    for (const colonist of colonists) {
      if (!colonist.socialBuildingIds?.length) continue;

      let totalBoost = 0;
      for (const buildingId of colonist.socialBuildingIds) {
        const building = ctx.buildings.getBuilding(buildingId);
        if (!building || building.status !== "active") continue;

        const def = ctx.buildings.getDefinition(building.definitionId);
        if (def?.moraleBoost) {
          totalBoost += def.moraleBoost / COLONIST_MORALE.SOCIAL_BUILDING_BOOST_DIVISOR;
        }
      }

      if (totalBoost > 0) {
        const current = ctx.colonistMorale.getMorale(colonist.id);
        ctx.colonistMorale.setMorale(colonist.id, Math.min(100, current + totalBoost));
      }
    }
    return [];
  },
});
```

### Phase Registration

In `src/core/tick/phases/index.ts`:
```typescript
runner.register(visitSocialBuildings);    // NEW
runner.register(propagateColonistMorale);
```

## Testing

Unit tests in `tests/colonistMorale.test.ts`:

1. **Colonist visiting social building gets morale boost**
   - Colonist with `socialBuildingIds: ["common-room-1"]`
   - Common room has `moraleBoost: 5`
   - After phase: morale increases by 0.5

2. **Multiple buildings stack**
   - Colonist visits common room (5) + gymnasium (6)
   - After phase: morale increases by 1.1

3. **Inactive buildings give no boost**
   - Colonist assigned to inactive common room
   - After phase: no morale change

4. **Morale caps at 100**
   - Colonist at morale 99.8, visits gymnasium (+0.6)
   - After phase: morale = 100 (not 100.4)

5. **Colonist with no social buildings unaffected**
   - Colonist with empty `socialBuildingIds`
   - After phase: morale unchanged

## Dependencies

This feature depends on the colonist centrality and morale propagation PR (#88) being merged first, as it uses:
- `ColonistMoraleManager` for `getMorale()` / `setMorale()`
- `propagateColonistMorale` phase for placement reference
- `COLONIST_MORALE` balance constants
