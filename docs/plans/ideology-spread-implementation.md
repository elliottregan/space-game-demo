# Ideology Spread Mechanic - Implementation Plan

## Overview

Transform the political system from static NPCs to an emergent system where colonist ideology spreads through social networks, council members emerge from high-centrality colonists, and project availability is gated by faction support.

## Design Summary

| Feature | Description |
|---------|-------------|
| Colonist ideology | Each colonist has affinity (0-1) for 3 factions + conviction |
| Founding colonists | The 10 NPCs become founding colonists with preset ideologies |
| Council selection | Top N colonists by `centrality × conviction` |
| Ideology spread | Propagates through social network (like morale) |
| Project gating | Requires minimum faction support to propose |
| Project morale | Passed projects affect morale based on colonist ideology |

---

## Phase 1: Data Model Changes

### 1.1 Add Ideology to Colonist Model

**File:** `src/core/models/Colonist.ts`

```typescript
// Add new interface
export interface ColonistIdeology {
  earthLoyalist: number;      // 0-1
  marsIndependence: number;   // 0-1
  corporateInterests: number; // 0-1
  conviction: number;         // 0-1 (resistance to influence)
}

// Add to Colonist interface
export interface Colonist {
  // ...existing fields...
  ideology: ColonistIdeology;
}
```

### 1.2 Create Ideology Balance Constants

**File:** `src/core/balance/IdeologyBalance.ts` (NEW)

```typescript
// Ideology spread
export const IDEOLOGY_SPREAD_RATE = 0.005;
export const IDEOLOGY_SPREAD_INTERVAL = 5; // Every N sols
export const CONVICTION_RESISTANCE_FACTOR = 0.8;

// Neutral threshold (below this, colonist is "neutral")
export const IDEOLOGY_NEUTRAL_THRESHOLD = 0.3;

// Council
export const COUNCIL_SIZE_MIN = 5;
export const COUNCIL_SIZE_MAX = 15;
export const COUNCIL_SIZE_PER_POPULATION = 10; // 1 seat per N colonists
export const COUNCIL_UPDATE_INTERVAL = 30; // Sols between updates

// Project support requirements
export const PROJECT_SUPPORT_MINOR = 0.20;
export const PROJECT_SUPPORT_MAJOR = 0.35;
export const PROJECT_SUPPORT_VICTORY = 0.50;

// Project morale effects
export const PROJECT_MORALE_STRONG_SUPPORTER = 0.15;
export const PROJECT_MORALE_SUPPORTER = 0.05;
export const PROJECT_MORALE_OPPOSED = -0.05;
export const PROJECT_MORALE_STRONGLY_OPPOSED = -0.10;
export const PROJECT_MORALE_CONVICTION_THRESHOLD = 0.6;

// New colonist ideology
export const NEW_COLONIST_IDEOLOGY = {
  earthLoyalist: 0.33,
  marsIndependence: 0.33,
  corporateInterests: 0.33,
  conviction: 0.2,
};
```

### 1.3 Create Founding Colonists Data

**File:** `src/core/data/foundingColonists.ts` (NEW)

Transform existing NPCs into colonist data with preset ideologies:

```typescript
import type { ColonistIdeology } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";

export interface FoundingColonistData {
  id: string;
  name: string;
  ideology: ColonistIdeology;
  role?: ColonistRole;
  skills?: string[];
}

export const FOUNDING_COLONISTS: FoundingColonistData[] = [
  // Earth Loyalists (3)
  {
    id: "founding_chen_wei",
    name: "Dr. Chen Wei",
    ideology: { earthLoyalist: 0.9, marsIndependence: 0.2, corporateInterests: 0.3, conviction: 0.8 },
    role: ColonistRole.RESEARCH,
  },
  {
    id: "founding_nova_silva",
    name: "Nova Silva",
    ideology: { earthLoyalist: 0.8, marsIndependence: 0.3, corporateInterests: 0.2, conviction: 0.6 },
  },
  {
    id: "founding_alex_okonkwo",
    name: "Alex Okonkwo",
    ideology: { earthLoyalist: 0.85, marsIndependence: 0.25, corporateInterests: 0.2, conviction: 0.7 },
  },

  // Mars Independence (4)
  {
    id: "founding_maria_santos",
    name: "Maria Santos",
    ideology: { earthLoyalist: 0.2, marsIndependence: 0.9, corporateInterests: 0.3, conviction: 0.85 },
  },
  {
    id: "founding_james_liu",
    name: "James Liu",
    ideology: { earthLoyalist: 0.3, marsIndependence: 0.8, corporateInterests: 0.25, conviction: 0.6 },
  },
  {
    id: "founding_aisha_patel",
    name: "Aisha Patel",
    ideology: { earthLoyalist: 0.25, marsIndependence: 0.85, corporateInterests: 0.3, conviction: 0.7 },
  },
  {
    id: "founding_marcus_reed",
    name: "Marcus Reed",
    ideology: { earthLoyalist: 0.3, marsIndependence: 0.75, corporateInterests: 0.35, conviction: 0.5 },
  },

  // Corporate Interests (3)
  {
    id: "founding_elena_volkov",
    name: "Elena Volkov",
    ideology: { earthLoyalist: 0.3, marsIndependence: 0.2, corporateInterests: 0.9, conviction: 0.8 },
    role: ColonistRole.ENGINEERING,
  },
  {
    id: "founding_david_morrison",
    name: "David Morrison",
    ideology: { earthLoyalist: 0.35, marsIndependence: 0.25, corporateInterests: 0.8, conviction: 0.6 },
  },
  {
    id: "founding_sarah_chen",
    name: "Sarah Chen",
    ideology: { earthLoyalist: 0.3, marsIndependence: 0.3, corporateInterests: 0.85, conviction: 0.7 },
  },
];

// Initial relationships between founding colonists (reuse existing NPC relationships)
export const FOUNDING_RELATIONSHIPS: Record<string, number> = {
  // Earth Loyalists internal (strong)
  "founding_chen_wei:founding_nova_silva": 0.7,
  "founding_chen_wei:founding_alex_okonkwo": 0.5,
  "founding_nova_silva:founding_alex_okonkwo": 0.4,

  // Mars Independence internal (moderate)
  "founding_maria_santos:founding_james_liu": 0.6,
  "founding_maria_santos:founding_aisha_patel": 0.5,
  "founding_james_liu:founding_marcus_reed": 0.4,
  "founding_aisha_patel:founding_marcus_reed": 0.3,

  // Corporate Interests internal (strong)
  "founding_elena_volkov:founding_david_morrison": 0.7,
  "founding_elena_volkov:founding_sarah_chen": 0.5,
  "founding_david_morrison:founding_sarah_chen": 0.4,

  // Cross-faction (weak)
  "founding_chen_wei:founding_maria_santos": 0.25,
  "founding_nova_silva:founding_aisha_patel": 0.2,
  "founding_marcus_reed:founding_david_morrison": 0.25,
  "founding_james_liu:founding_sarah_chen": 0.2,
};
```

### 1.4 Update Project Model

**File:** `src/core/models/NPCInfluence.ts`

Add `requiredSupport` to Project interface:

```typescript
export interface Project {
  // ...existing fields...
  requiredSupport: number; // 0-1, faction support needed to propose
}
```

**File:** `src/core/data/npcs.ts`

Update PROJECTS array with support requirements:

```typescript
export const PROJECTS: Project[] = [
  // Earth Loyalists
  {
    id: ProjectId.GENERATION_SHIP,
    // ...existing...
    requiredSupport: 0.50, // Victory path - high requirement
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    // ...existing...
    requiredSupport: 0.20, // Minor
  },
  // ... etc
];
```

---

## Phase 2: IdeologyManager System

### 2.1 Create IdeologyManager

**File:** `src/core/systems/IdeologyManager.ts` (NEW)

```typescript
import type { Colonist, ColonistIdeology } from "../models/Colonist";
import { NPCFaction } from "../models/NPCInfluence";
import type { RelationshipManager } from "./RelationshipManager";
import type { ColonistMoraleManager } from "./ColonistMoraleManager";
import * as IdeologyBalance from "../balance/IdeologyBalance";

export interface CouncilMember {
  colonistId: string;
  name: string;
  centrality: number;
  conviction: number;
  influence: number; // centrality × conviction
  faction: NPCFaction | null;
}

export interface FactionSupport {
  earthLoyalists: number;
  marsIndependence: number;
  corporateInterests: number;
}

export class IdeologyManager {
  private council: CouncilMember[] = [];
  private lastCouncilUpdateSol: number = -1;
  private lastSpreadSol: number = -1;

  // ============ Ideology Helpers ============

  static getPrimaryFaction(ideology: ColonistIdeology): NPCFaction | null {
    const { earthLoyalist, marsIndependence, corporateInterests } = ideology;
    const max = Math.max(earthLoyalist, marsIndependence, corporateInterests);

    if (max < IdeologyBalance.IDEOLOGY_NEUTRAL_THRESHOLD) return null;

    if (earthLoyalist === max) return NPCFaction.EarthLoyalists;
    if (marsIndependence === max) return NPCFaction.MarsIndependence;
    return NPCFaction.CorporateInterests;
  }

  static factionToKey(faction: NPCFaction): keyof ColonistIdeology {
    switch (faction) {
      case NPCFaction.EarthLoyalists: return "earthLoyalist";
      case NPCFaction.MarsIndependence: return "marsIndependence";
      case NPCFaction.CorporateInterests: return "corporateInterests";
    }
  }

  static createNeutralIdeology(): ColonistIdeology {
    return { ...IdeologyBalance.NEW_COLONIST_IDEOLOGY };
  }

  // ============ Council Selection ============

  selectCouncil(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number
  ): CouncilMember[] {
    // Determine council size based on population
    const councilSize = Math.min(
      IdeologyBalance.COUNCIL_SIZE_MAX,
      Math.max(
        IdeologyBalance.COUNCIL_SIZE_MIN,
        Math.floor(colonists.length / IdeologyBalance.COUNCIL_SIZE_PER_POPULATION)
      )
    );

    // Calculate political influence for each colonist
    const candidates = colonists.map(colonist => {
      const centrality = relationshipManager.getCentrality(colonist.id);
      const conviction = colonist.ideology.conviction;
      const influence = centrality * conviction;
      const faction = IdeologyManager.getPrimaryFaction(colonist.ideology);

      return {
        colonistId: colonist.id,
        name: colonist.name,
        centrality,
        conviction,
        influence,
        faction,
      };
    });

    // Sort by influence, take top N
    this.council = candidates
      .sort((a, b) => b.influence - a.influence)
      .slice(0, councilSize);

    this.lastCouncilUpdateSol = currentSol;
    return this.council;
  }

  updateCouncilIfStale(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number
  ): void {
    if (
      this.lastCouncilUpdateSol < 0 ||
      currentSol - this.lastCouncilUpdateSol >= IdeologyBalance.COUNCIL_UPDATE_INTERVAL
    ) {
      relationshipManager.recalculateCentralityIfStale(currentSol, IdeologyBalance.COUNCIL_UPDATE_INTERVAL);
      this.selectCouncil(colonists, relationshipManager, currentSol);
    }
  }

  getCouncil(): readonly CouncilMember[] {
    return this.council;
  }

  getCouncilFactionCounts(): Record<NPCFaction | "neutral", number> {
    const counts: Record<NPCFaction | "neutral", number> = {
      [NPCFaction.EarthLoyalists]: 0,
      [NPCFaction.MarsIndependence]: 0,
      [NPCFaction.CorporateInterests]: 0,
      neutral: 0,
    };

    for (const member of this.council) {
      if (member.faction) {
        counts[member.faction]++;
      } else {
        counts.neutral++;
      }
    }

    return counts;
  }

  // ============ Faction Support Calculation ============

  calculateFactionSupport(
    colonists: Colonist[],
    relationshipManager: RelationshipManager
  ): FactionSupport {
    let totalWeight = 0;
    const factionWeights = {
      earthLoyalists: 0,
      marsIndependence: 0,
      corporateInterests: 0,
    };

    for (const colonist of colonists) {
      // Weight by centrality (influential colonists matter more) + baseline
      const weight = relationshipManager.getCentrality(colonist.id) + 0.1;
      totalWeight += weight;

      factionWeights.earthLoyalists += weight * colonist.ideology.earthLoyalist;
      factionWeights.marsIndependence += weight * colonist.ideology.marsIndependence;
      factionWeights.corporateInterests += weight * colonist.ideology.corporateInterests;
    }

    if (totalWeight === 0) {
      return { earthLoyalists: 0, marsIndependence: 0, corporateInterests: 0 };
    }

    return {
      earthLoyalists: factionWeights.earthLoyalists / totalWeight,
      marsIndependence: factionWeights.marsIndependence / totalWeight,
      corporateInterests: factionWeights.corporateInterests / totalWeight,
    };
  }

  getFactionSupportForFaction(
    faction: NPCFaction,
    colonists: Colonist[],
    relationshipManager: RelationshipManager
  ): number {
    const support = this.calculateFactionSupport(colonists, relationshipManager);
    switch (faction) {
      case NPCFaction.EarthLoyalists: return support.earthLoyalists;
      case NPCFaction.MarsIndependence: return support.marsIndependence;
      case NPCFaction.CorporateInterests: return support.corporateInterests;
    }
  }

  // ============ Ideology Spread ============

  propagateIdeology(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number
  ): void {
    // Only spread every N sols
    if (
      this.lastSpreadSol >= 0 &&
      currentSol - this.lastSpreadSol < IdeologyBalance.IDEOLOGY_SPREAD_INTERVAL
    ) {
      return;
    }

    this.lastSpreadSol = currentSol;

    // Create snapshot to avoid order-dependent updates
    const ideologySnapshot = new Map<string, ColonistIdeology>(
      colonists.map(c => [c.id, { ...c.ideology }])
    );

    for (const colonist of colonists) {
      const neighbors = relationshipManager.getNeighbors(colonist.id);
      if (neighbors.size === 0) continue;

      // Calculate weighted average of neighbor ideologies
      let totalWeight = 0;
      const avgInfluence = { earthLoyalist: 0, marsIndependence: 0, corporateInterests: 0 };

      for (const neighborId of neighbors) {
        const neighborIdeology = ideologySnapshot.get(neighborId);
        if (!neighborIdeology) continue;

        const relationshipStrength = relationshipManager.getRelationshipStrength(colonist.id, neighborId);
        const neighborCentrality = relationshipManager.getCentrality(neighborId);
        const neighborConviction = neighborIdeology.conviction;

        // Weight = relationship × (centrality + baseline) × conviction
        const weight = relationshipStrength * (neighborCentrality + 0.1) * neighborConviction;
        totalWeight += weight;

        avgInfluence.earthLoyalist += weight * neighborIdeology.earthLoyalist;
        avgInfluence.marsIndependence += weight * neighborIdeology.marsIndependence;
        avgInfluence.corporateInterests += weight * neighborIdeology.corporateInterests;
      }

      if (totalWeight === 0) continue;

      // Normalize
      avgInfluence.earthLoyalist /= totalWeight;
      avgInfluence.marsIndependence /= totalWeight;
      avgInfluence.corporateInterests /= totalWeight;

      // Resistance based on own conviction
      const resistance = colonist.ideology.conviction * IdeologyBalance.CONVICTION_RESISTANCE_FACTOR;
      const effectiveRate = IdeologyBalance.IDEOLOGY_SPREAD_RATE * (1 - resistance);

      // Drift toward neighbor average
      colonist.ideology.earthLoyalist += effectiveRate * (avgInfluence.earthLoyalist - colonist.ideology.earthLoyalist);
      colonist.ideology.marsIndependence += effectiveRate * (avgInfluence.marsIndependence - colonist.ideology.marsIndependence);
      colonist.ideology.corporateInterests += effectiveRate * (avgInfluence.corporateInterests - colonist.ideology.corporateInterests);

      // Clamp values
      colonist.ideology.earthLoyalist = Math.max(0, Math.min(1, colonist.ideology.earthLoyalist));
      colonist.ideology.marsIndependence = Math.max(0, Math.min(1, colonist.ideology.marsIndependence));
      colonist.ideology.corporateInterests = Math.max(0, Math.min(1, colonist.ideology.corporateInterests));
    }
  }

  // ============ Project Morale Effects ============

  applyProjectMoraleEffects(
    projectFaction: NPCFaction,
    colonists: Colonist[],
    moraleManager: ColonistMoraleManager
  ): void {
    const factionKey = IdeologyManager.factionToKey(projectFaction);

    for (const colonist of colonists) {
      const affinity = colonist.ideology[factionKey];
      const primaryFaction = IdeologyManager.getPrimaryFaction(colonist.ideology);

      let moraleDelta = 0;

      if (affinity >= 0.7) {
        moraleDelta = IdeologyBalance.PROJECT_MORALE_STRONG_SUPPORTER;
      } else if (affinity >= 0.4) {
        moraleDelta = IdeologyBalance.PROJECT_MORALE_SUPPORTER;
      } else if (primaryFaction && primaryFaction !== projectFaction) {
        // They belong to a different faction
        moraleDelta = colonist.ideology.conviction >= IdeologyBalance.PROJECT_MORALE_CONVICTION_THRESHOLD
          ? IdeologyBalance.PROJECT_MORALE_STRONGLY_OPPOSED
          : IdeologyBalance.PROJECT_MORALE_OPPOSED;
      }

      if (moraleDelta !== 0) {
        moraleManager.adjustColonistMorale(colonist.id, moraleDelta);
      }
    }
  }

  // ============ Serialization ============

  toJSON() {
    return {
      council: this.council,
      lastCouncilUpdateSol: this.lastCouncilUpdateSol,
      lastSpreadSol: this.lastSpreadSol,
    };
  }

  static fromJSON(data: ReturnType<IdeologyManager["toJSON"]>): IdeologyManager {
    const manager = new IdeologyManager();
    if (data.council) manager.council = data.council;
    if (data.lastCouncilUpdateSol !== undefined) manager.lastCouncilUpdateSol = data.lastCouncilUpdateSol;
    if (data.lastSpreadSol !== undefined) manager.lastSpreadSol = data.lastSpreadSol;
    return manager;
  }
}
```

---

## Phase 3: Integration

### 3.1 Update ColonyManager

**File:** `src/core/systems/ColonyManager.ts`

Modify `addColonist()` to include ideology:

```typescript
import { IdeologyManager } from "./IdeologyManager";

// In addColonist():
addColonist(name?: string, ideology?: ColonistIdeology): Colonist {
  const colonist: Colonist = {
    // ...existing fields...
    ideology: ideology ?? IdeologyManager.createNeutralIdeology(),
  };
  // ...
}
```

Add method to initialize founding colonists:

```typescript
initializeFoundingColonists(
  foundingData: FoundingColonistData[],
  relationshipManager: RelationshipManager,
  currentSol: number
): void {
  for (const data of foundingData) {
    const colonist = this.addColonist(data.name, data.ideology);
    // Override the auto-generated ID with the founding ID
    this.colonists.delete(colonist.id);
    colonist.id = data.id;
    if (data.role) colonist.role = data.role;
    this.colonists.set(colonist.id, colonist);
  }
}
```

### 3.2 Update GameState

**File:** `src/core/GameState.ts`

```typescript
import { IdeologyManager } from "./systems/IdeologyManager";
import { FOUNDING_COLONISTS, FOUNDING_RELATIONSHIPS } from "./data/foundingColonists";

export class GameState {
  // Add new manager
  ideology: IdeologyManager;

  constructor(startingConditionId?: string) {
    // ... existing initialization ...

    this.ideology = new IdeologyManager();

    // Initialize founding colonists instead of random colonists
    this.initializeFoundingColonists();
  }

  private initializeFoundingColonists(): void {
    // Clear any auto-generated colonists
    // Add founding colonists with preset ideologies
    // Create relationships between them
  }
}
```

### 3.3 Update NPCInfluenceManager

**File:** `src/core/systems/NPCInfluenceManager.ts`

Add project support checking:

```typescript
canProposeProject(
  projectId: ProjectId,
  factionSupport: number,
  resources: ResourceManager
): { canPropose: boolean; reason?: string } {
  const project = this.projects.get(projectId);
  if (!project) {
    return { canPropose: false, reason: "Project not found" };
  }

  if (this.activeProject) {
    return { canPropose: false, reason: "Another project is already active" };
  }

  if (!resources.canAfford(project.proposalCost)) {
    return { canPropose: false, reason: "Cannot afford proposal cost" };
  }

  if (factionSupport < project.requiredSupport) {
    return {
      canPropose: false,
      reason: `Insufficient support (${Math.round(factionSupport * 100)}% < ${Math.round(project.requiredSupport * 100)}%)`,
    };
  }

  return { canPropose: true };
}
```

### 3.4 Add Tick Phase for Ideology

**File:** `src/core/tick/phases.ts`

Add ideology spread to the tick runner:

```typescript
// After politics phase, before events
{
  name: "ideology",
  execute: (ctx) => {
    ctx.gameState.ideology.propagateIdeology(
      ctx.gameState.colony.getColonists(),
      ctx.gameState.workforce.getRelationshipManager(),
      ctx.gameState.currentSol
    );
    ctx.gameState.ideology.updateCouncilIfStale(
      ctx.gameState.colony.getColonists(),
      ctx.gameState.workforce.getRelationshipManager(),
      ctx.gameState.currentSol
    );
    return [];
  },
},
```

---

## Phase 4: UI Updates

### 4.1 Colony Panel - Faction Support Display

**File:** `src/renderer/components/ColonyPanel.vue`

Add faction support indicators showing current support levels and which projects are available.

### 4.2 Politics Panel - Council Display

**File:** `src/renderer/components/PoliticsPanel.vue`

- Show council members (colonist names, factions, influence)
- Show faction support percentages
- Gate project proposals with support requirements

### 4.3 Colonist Details - Ideology Display

**File:** `src/renderer/components/ColonistDetails.vue`

Show colonist ideology breakdown (3 faction affinities + conviction).

---

## Phase 5: Testing

### 5.1 Unit Tests

**File:** `tests/IdeologyManager.test.ts` (NEW)

- `getPrimaryFaction()` returns correct faction
- `selectCouncil()` picks highest influence colonists
- `calculateFactionSupport()` weights by centrality
- `propagateIdeology()` shifts ideologies toward neighbors
- `applyProjectMoraleEffects()` adjusts morale correctly

### 5.2 Integration Tests

**File:** `tests/IdeologyIntegration.test.ts` (NEW)

- Founding colonists have correct preset ideologies
- Project proposals blocked when insufficient support
- Project pass affects colonist morale
- Council updates when centrality changes

### 5.3 Simulation Updates

Update `HeuristicStrategy.ts` to account for ideology when making political decisions.

---

## File Change Summary

| File | Action |
|------|--------|
| `src/core/models/Colonist.ts` | Modify - add ColonistIdeology |
| `src/core/balance/IdeologyBalance.ts` | Create |
| `src/core/data/foundingColonists.ts` | Create |
| `src/core/data/npcs.ts` | Modify - add requiredSupport to projects |
| `src/core/models/NPCInfluence.ts` | Modify - add requiredSupport to Project |
| `src/core/systems/IdeologyManager.ts` | Create |
| `src/core/systems/ColonyManager.ts` | Modify - ideology in addColonist |
| `src/core/systems/NPCInfluenceManager.ts` | Modify - canProposeProject |
| `src/core/GameState.ts` | Modify - add IdeologyManager |
| `src/core/tick/phases.ts` | Modify - add ideology phase |
| `src/renderer/components/ColonyPanel.vue` | Modify - faction support |
| `src/renderer/components/PoliticsPanel.vue` | Modify - council, gating |
| `tests/IdeologyManager.test.ts` | Create |
| `tests/IdeologyIntegration.test.ts` | Create |

---

## Implementation Order

1. **Phase 1.1-1.2**: Data models and balance constants (no breaking changes)
2. **Phase 1.3**: Founding colonists data
3. **Phase 2.1**: IdeologyManager system
4. **Phase 3.1-3.2**: ColonyManager and GameState integration
5. **Phase 3.3**: NPCInfluenceManager project gating
6. **Phase 3.4**: Tick phase
7. **Phase 5.1-5.2**: Tests
8. **Phase 4**: UI updates

---

## Open Questions

1. Should conviction change over time? (e.g., increase when surrounded by same-ideology)
2. Should there be events that shift ideology colony-wide?
3. How should the simulation AI handle ideology in decision-making?
