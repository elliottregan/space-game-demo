# Politics Rebalance Implementation Plan

## Tasks

### Task 1: Add LOBBY_SUPPORT_BOOST constant
**File:** `src/core/balance/NPCInfluenceBalance.ts`

Add new constant:
```typescript
/** Support boost per lobby action */
export const LOBBY_SUPPORT_BOOST = 0.3;
```

### Task 2: Update faction-aligned starting support
**File:** `src/core/systems/NPCInfluenceManager.ts`

In `proposeProject()`, change:
```typescript
// Current: all NPCs start at 0
for (const npc of this.npcs) {
  supportLevels.set(npc.id, 0.0);
}
```

To:
```typescript
// New: faction-aligned NPCs start at 100%
for (const npc of this.npcs) {
  supportLevels.set(npc.id, npc.faction === project.type ? 1.0 : 0.0);
}
```

### Task 3: Update lobby cost calculation
**File:** `src/core/systems/NPCInfluenceManager.ts`

In `getLobbyCost()`, change the divisor from `0.1` to use `LOBBY_SUPPORT_BOOST`:
```typescript
// Current
return Math.ceil(LOBBY_BASE_COST * npc.influence * (supportBoost / 0.1));

// New
return Math.ceil(LOBBY_BASE_COST * npc.influence * (supportBoost / LOBBY_SUPPORT_BOOST));
```

Import `LOBBY_SUPPORT_BOOST` at the top of the file.

### Task 4: Update facade default boost (if applicable)
**File:** `src/facade/domains/NPCFacade.ts`

Check if there's a hardcoded default boost value and update to use the constant or 0.3.

### Task 5: Add/update tests
**File:** `tests/NPCInfluenceManager.test.ts`

Add tests for:
1. Faction-aligned NPCs start at 100% when their faction's project is proposed
2. Non-aligned NPCs start at 0%
3. Lobby boost is 30% (or uses LOBBY_SUPPORT_BOOST constant)

## Verification

Run tests:
```bash
bun test tests/NPCInfluenceManager.test.ts
bun test
```

Manual verification in dev:
1. Propose an Earth Loyalist project
2. Verify Chen Wei, Nova Silva, Alex Okonkwo show 100% support
3. Verify other NPCs show 0% support
4. Lobby one NPC and verify +30% boost
