# Politics System Rebalance Design

## Problem

1. **Lobbying is too weak** - The +10% support boost per lobby action doesn't move the needle enough to influence project outcomes
2. **Starting support is unintuitive** - All NPCs start at 0% support regardless of faction alignment, making it harder than expected to pass faction-aligned projects

## Changes

### 1. Faction-Aligned Starting Support

When a project is proposed, NPCs whose faction matches the project type start at **100% support** instead of 0%.

**Example - Earth Loyalist project:**
| NPC | Faction | Starting Support |
|-----|---------|------------------|
| Dr. Chen Wei | Earth Loyalists | 100% |
| Nova Silva | Earth Loyalists | 100% |
| Alex Okonkwo | Earth Loyalists | 100% |
| Maria Santos | Mars Independence | 0% |
| James Liu | Mars Independence | 0% |
| Aisha Patel | Mars Independence | 0% |
| Marcus Reed | Mars Independence | 0% |
| Elena Volkov | Corporate Interests | 0% |
| David Morrison | Corporate Interests | 0% |
| Sarah Chen | Corporate Interests | 0% |

**Starting averages by project type:**
- Earth Loyalist projects: 30% (3/10 NPCs aligned)
- Mars Independence projects: 40% (4/10 NPCs aligned)
- Corporate Interests projects: 30% (3/10 NPCs aligned)

This means Mars Independence projects start at the pass threshold (40%), while others need some lobbying or natural influence spread.

**Implementation:** Modify `proposeProject()` in `NPCInfluenceManager.ts`:
```typescript
// Initialize project with faction-aligned NPCs at full support
const supportLevels = new Map<string, number>();
for (const npc of this.npcs) {
  supportLevels.set(npc.id, npc.faction === project.type ? 1.0 : 0.0);
}
```

### 2. Triple Lobbying Effectiveness

| Stat | Current | New |
|------|---------|-----|
| Support boost per lobby | +10% (0.1) | +30% (0.3) |
| Base cost | 10 materials | 10 materials |
| Cost-effectiveness | 1 material per 1% | 1 material per 3% |

This makes lobbying 3x more cost-effective. A single lobby action can meaningfully shift an NPC's position.

**Implementation:** Update `NPCInfluenceBalance.ts`:
```typescript
// Change the boost divisor from 0.1 to 0.3
// This affects the cost calculation in getLobbyCost()
```

And update the default lobby boost amount where `lobbyNPC()` is called.

## Files to Modify

1. `src/core/systems/NPCInfluenceManager.ts`
   - `proposeProject()`: Initialize faction-aligned NPCs at 1.0 support
   - `getLobbyCost()`: Update divisor from 0.1 to 0.3

2. `src/core/balance/NPCInfluenceBalance.ts`
   - Add `LOBBY_SUPPORT_BOOST = 0.3` constant

3. `src/facade/domains/NPCFacade.ts` (if it has a default boost value)
   - Update default lobby boost to 0.3
