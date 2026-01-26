# Political Pressure System Design

## Problem

The game allows "coasting to victory" after early-game resource setup. Simulations show 100% win rate with most games finishing at exactly 486 sols. Once players build basic resource production (~sol 50), they can wait 300+ sols with no challenge.

The existing political systems (PoliticsEngine and NPCInfluenceManager) have no teeth - you can ignore them entirely and still win.

## Goal

Replace resource pressure with political pressure in mid-to-late game. Create a system where factions make demands that force player engagement, and ignoring them leads to political gridlock.

## Design

### 1. System Consolidation

**Remove:**
- `PoliticsEngine` class
- `src/core/data/factions.ts` (abstract factions)
- `src/core/systems/PoliticsEngine.ts`

**Keep & Modify:**
- `NPCInfluenceManager` becomes the sole political system

**Rename NPC factions:**
- `futurist` → `earth_loyalists`
- `progressive` → `mars_independence`
- `traditionalist` → `corporate_interests`

**NPC assignments:**
| NPC | New Faction |
|-----|-------------|
| Dr. Chen Wei | earth_loyalists |
| Nova Silva | earth_loyalists |
| Alex Okonkwo | earth_loyalists |
| Maria Santos | mars_independence |
| James Liu | mars_independence |
| Aisha Patel | mars_independence |
| Marcus Reed | mars_independence |
| Elena Volkov | corporate_interests |
| David Morrison | corporate_interests |
| Sarah Chen | corporate_interests |

### 2. Support Decay & Demand Mechanic

**Core loop:**
1. Each faction's average NPC support decays slowly over time (0.01/sol)
2. When faction average support drops below 50%, they issue a demand
3. Demand: "Propose one of our projects within 60 sols"
4. If you propose and pass their project → support restored (+0.3 to all faction NPCs)
5. If you ignore the demand → decay rate accelerates (3x faster)
6. Lower support = NPCs vote against your projects = political gridlock

**New state per faction:**
```typescript
interface FactionDemand {
  factionId: NPCFaction;
  demandedAt: number;      // sol when demand was issued
  deadline: number;        // sols remaining until demand expires
  projectIds: string[];    // valid projects that satisfy demand
}
```

**Balance constants:**
```typescript
FACTION_SUPPORT_DECAY_RATE = 0.01;      // per sol
DEMAND_THRESHOLD = 0.5;                  // 50% average support triggers demand
DEMAND_DEADLINE = 60;                    // sols to respond
IGNORED_DEMAND_DECAY_MULTIPLIER = 3;    // 3x decay if deadline passed
PROJECT_PASS_SUPPORT_BOOST = 0.3;       // boost to faction NPCs on success
```

### 3. Project Reassignment

**Existing projects:**
| Project | New Faction |
|---------|-------------|
| Build Generation Ship | earth_loyalists |
| AI-Assisted Governance | corporate_interests |
| Universal Housing Initiative | mars_independence |
| Healthcare Expansion | mars_independence |
| Earth Memorial | earth_loyalists |
| Heritage Archive | earth_loyalists |

**New corporate projects:**
| Project | Description | Effect |
|---------|-------------|--------|
| Mining Concession | Grant exclusive extraction rights | Unlocks efficient_mine building |
| Labor Efficiency Program | Controversial productivity initiative | +20% worker output, -10 morale |

### 4. Files to Modify

1. `src/core/models/NPCInfluence.ts` - Update `NPCFaction` type, add `FactionDemand` interface
2. `src/core/data/npcs.ts` - Rename faction types, reassign NPCs, reassign projects, add corporate projects
3. `src/core/balance/NPCInfluenceBalance.ts` - Update transmission factor keys, add demand constants
4. `src/core/systems/NPCInfluenceManager.ts` - Add demand tracking, decay logic, demand generation
5. `src/core/GameState.ts` - Remove PoliticsEngine references
6. Delete `src/core/systems/PoliticsEngine.ts`
7. Delete `src/core/data/factions.ts`
8. Update any UI components that reference PoliticsEngine

### 5. Expected Outcome

- Early game (sols 0-180): Focus on resource management and tech research
- Mid game (sols 180-350): Resources stabilize, political demands begin
- Late game (sols 350-500): Must balance multiple faction demands to maintain support
- Failure mode: Ignoring politics leads to gridlock where no projects can pass

Win rate should drop from 100% to ~70-80% as political mismanagement becomes a viable failure path.
