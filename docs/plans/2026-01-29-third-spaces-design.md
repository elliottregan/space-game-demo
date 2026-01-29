# Third Spaces: Social Building Bonding System

## Overview

Introduce "third spaces" (public spaces where people can connect, beyond home and work) to the Common Room and Gymnasium buildings. Colonists assigned to social buildings form relationships with others who frequent the same spaces.

## Data Model Changes

### BuildingPurpose Enum (new)

```typescript
export enum BuildingPurpose {
  Residential = "residential",
  Industrial = "industrial",
  Social = "social",
}
```

Added to `src/core/models/Building.ts`.

### BuildingDefinition Additions

- `purpose?: BuildingPurpose` - categorizes the building (defaults to Industrial if unset)
- `bondingStrength?: number` - multiplier for relationship growth rate (default 1.0)

Reuse existing `capacity` field for social buildings (colonist capacity for both Residential and Social).

### Colonist Addition

- `socialBuildingIds?: string[]` - assigned social buildings (array for future expansion)

### Building Data Updates

| Building | Purpose | Capacity | Bonding Strength |
|----------|---------|----------|------------------|
| Common Room | Social | 8 | 1.0 |
| Gymnasium | Social | 6 | 1.2 |
| Habitats | Residential | (existing) | - |
| Production buildings | Industrial | - | - |

## Social Bonding Mechanics

### processSocialBonding()

New method in WorkforceManager following existing bonding patterns:

1. **Group colonists by social building** - iterate each colonist's `socialBuildingIds`, group them per building
2. **Random subset selection** - for each colonist, pick 1-2 random others from the same building to bond with this tick
3. **Apply bondingStrength multiplier** - relationship growth rate = base rate × building's `bondingStrength`
4. **Track relationships** - use existing `coworkerRelationships` map
5. **Decay when not socializing** - relationships decay if colonists no longer share a social building
6. **Emit events** - `SOCIAL_BOND_FORMED` for new relationships

### Balance Constants

New constants in `WorkforceBalance.ts`:

- `INITIAL_SOCIAL_RELATIONSHIP` - starting strength when bond forms
- `SOCIAL_BONDING_RATE` - base growth per tick (before multiplier)
- `SOCIAL_RELATIONSHIP_DECAY` - decay rate when not socializing together
- `SOCIAL_BONDS_PER_TICK` - number of random bonds per colonist (1-2)

## Integration

### WorkforceManager.tick()

```typescript
// Existing calls
events.push(...this.processCoworkerBonding(buildings, currentSol));
events.push(...this.processHousemateBonding(colonists, currentSol));
events.push(...this.processGuildBonding(colonists, currentSol));

// New call
events.push(...this.processSocialBonding(colonists, buildings, currentSol));
```

### Capacity Enforcement

When assigning colonist to a social building:
- Check current assignment count vs building's `capacity`
- Add method to get colonists assigned to a social building

### GameEvent

Add `SOCIAL_BOND_FORMED` event type.

## Files to Change

**Core models**:
- `src/core/models/Building.ts` - add `BuildingPurpose` enum, add fields to `BuildingDefinition`
- `src/core/models/Colonist.ts` - add `socialBuildingIds?: string[]`
- `src/core/models/GameEvent.ts` - add `SOCIAL_BOND_FORMED` event type

**Data**:
- `src/core/data/buildings.ts` - add `purpose`, `capacity`, `bondingStrength` to all buildings

**Balance**:
- `src/core/balance/WorkforceBalance.ts` - add social bonding constants

**Systems**:
- `src/core/systems/WorkforceManager.ts` - add `processSocialBonding()`, call it in `tick()`

**Facade/API**:
- `src/facade/domains/Colony.ts` or similar - add social building assignment method

**Tests**:
- `tests/WorkforceManager.test.ts` - add tests for social bonding

## Future Expansion

The `BuildingPurpose` enum lays groundwork for purpose-based gameplay effects:
- Industrial buildings could have higher accident risk
- Residential buildings could affect morale differently
- These effects are deferred to future work
