# Automatic Guild Formation Design

## Overview

Implement automatic guild formation where colonists with strong relationships and shared characteristics spontaneously form guilds.

## Formation Trigger

**When**: Every 10 sols, `WorkforceManager.tick()` calls `processGuildFormation()`

**Candidate Selection**:
1. Find all colonist pairs with relationship strength ≥ 0.7
2. Filter to pairs where both colonists have < 3 guild memberships
3. Group into potential founding groups (2-4 colonists connected by strong relationships)

**Formation Probability**:
- Base: 50%
- Multiplied by 0.5 for each existing guild membership per founder
- Example: Two founders, one with 1 guild → 50% × 0.5 × 1.0 = 25%

## Guild Type Determination

Priority evaluation (checked in order):

1. **Professional** - All founders share the same role (excluding UNASSIGNED)
2. **Research** - Average mastery level ≥ SKILLED (1.0) across founders
3. **Social** - Founders share arrival cohort (same `arrivalSol`)
4. **Civic** - Default fallback

Names selected from `GUILD_NAME_SUGGESTIONS[type]`, with "II", "III" suffix for duplicates.

## Balance Constants

New constants in `WorkforceBalance.ts`:

```typescript
GUILD_FORMATION_CHECK_INTERVAL = 10  // sols
GUILD_FORMATION_RELATIONSHIP_THRESHOLD = 0.7
GUILD_FORMATION_BASE_PROBABILITY = 0.5
GUILD_FORMATION_MEMBERSHIP_PENALTY = 0.5  // multiplier per existing membership
```

## Implementation

### Files Modified

1. **`src/core/balance/WorkforceBalance.ts`** - Add formation constants
2. **`src/core/systems/WorkforceManager.ts`** - Add `processGuildFormation()` method
3. **`src/core/systems/GuildManager.ts`** - Add `getUsedGuildNames()` helper

### WorkforceManager Changes

```typescript
private lastGuildFormationCheck: number = 0;

private processGuildFormation(
  colonists: readonly Colonist[],
  currentSol: number
): GameEvent[]
```

### Event Emitted

```typescript
{
  type: "GUILD_FORMED",
  severity: "info",
  guildId: string,
  guildName: string,
  guildType: GuildType,
  founderIds: string[],
  message: "The Engineers Union has been founded!"
}
```

### Algorithm

1. Check if 10 sols passed since last check
2. Build graph of strong relationships (≥ 0.7)
3. Find connected components of 2-4 colonists
4. For each component: roll probability, determine type, create guild
5. Update colonist `guildIds` arrays
6. Emit events

## Constraints

- Max 1 guild formed per check (prevents guild explosion)
- Skip formation if colony has < 4 colonists
- Colonists at MAX_GUILD_MEMBERSHIPS (3) cannot be founders
- Skip if potential founders already share a guild
- `lastGuildFormationCheck` persisted in serialization
