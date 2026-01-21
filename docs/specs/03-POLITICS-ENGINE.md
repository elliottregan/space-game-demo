# Politics Engine System

## Purpose

Manages faction relationships, political support, and decision-making. Factions have priorities that determine how they react to player decisions.

## Location

`src/core/systems/PoliticsEngine.ts`

## Models

```typescript
// src/core/models/Politics.ts

export interface Faction {
  id: string;
  name: string;
  description: string;
  support: number; // 0-100
  priorities: FactionPriority[];
}

export interface FactionPriority {
  concern: string; // 'earth_welfare', 'mars_sovereignty', 'profit', etc.
  weight: number;  // 1 = highest priority, 2 = secondary, etc.
}

export interface Decision {
  id: string;
  name: string;
  description: string;
  requiredSupport: number; // Minimum average support needed (0-100)
  tags: Record<string, number>; // concern -> impact value
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}

export interface DecisionResult {
  success: boolean;
  impacts: FactionImpact[];
}

export interface FactionImpact {
  factionId: string;
  change: number;
  newSupport: number;
}
```

## Data File

```typescript
// src/core/data/factions.ts

import type { Faction } from '../models/Politics';

export const FACTIONS: Faction[] = [
  {
    id: 'earth_loyalists',
    name: 'Earth Loyalists',
    description: 'Believe Mars should maintain close ties with Earth and prioritize helping humanity\'s homeworld',
    support: 60, // Start sympathetic
    priorities: [
      { concern: 'earth_welfare', weight: 1 },
      { concern: 'safety', weight: 2 },
      { concern: 'tradition', weight: 3 }
    ]
  },
  {
    id: 'mars_independence',
    name: 'Mars Independence Movement',
    description: 'Advocate for Mars to chart its own course, free from Earth\'s influence',
    support: 40, // Start skeptical
    priorities: [
      { concern: 'mars_sovereignty', weight: 1 },
      { concern: 'innovation', weight: 2 },
      { concern: 'growth', weight: 3 }
    ]
  },
  {
    id: 'corporate_interests',
    name: 'Corporate Interests',
    description: 'Prioritize economic efficiency and profitability of the Mars venture',
    support: 50, // Start neutral
    priorities: [
      { concern: 'profit', weight: 1 },
      { concern: 'efficiency', weight: 2 },
      { concern: 'growth', weight: 3 }
    ]
  }
];
```

```typescript
// src/core/data/decisions.ts

import type { Decision } from '../models/Politics';

export const DECISIONS: Decision[] = [
  {
    id: 'earth_aid_major',
    name: 'Send Major Aid to Earth',
    description: 'Redirect 40% of surplus resources to Earth relief efforts',
    requiredSupport: 40,
    tags: {
      earth_welfare: 30,
      mars_sovereignty: -20,
      profit: -10
    },
    effects: {
      resources: { food: -50, materials: -80 }
    }
  },
  {
    id: 'earth_aid_token',
    name: 'Send Token Aid to Earth',
    description: 'Send symbolic support (10% of surplus)',
    requiredSupport: 20,
    tags: {
      earth_welfare: 5,
      mars_sovereignty: 10,
      profit: -5
    },
    effects: {
      resources: { food: -10, materials: -15 }
    }
  },
  {
    id: 'declare_independence',
    name: 'Declare Independence from Earth',
    description: 'Formally break ties with Earth and establish Mars as sovereign',
    requiredSupport: 60,
    tags: {
      earth_welfare: -40,
      mars_sovereignty: 40,
      tradition: -30
    }
  },
  {
    id: 'corporate_charter',
    name: 'Grant Corporate Charter',
    description: 'Allow corporations greater autonomy in exchange for investment',
    requiredSupport: 35,
    tags: {
      profit: 25,
      mars_sovereignty: -15,
      innovation: 10
    },
    effects: {
      resources: { materials: 200 }
    }
  }
];
```

## Interface

```typescript
export class PoliticsEngine {
  constructor(factions: Faction[]);
  
  /**
   * Process one sol (apply support decay)
   */
  tick(state: GameState): GameEvent[];
  
  /**
   * Player makes a political decision
   */
  makeDecision(decision: Decision): DecisionResult;
  
  /**
   * Check if player has minimum support for an action
   */
  hasMinimumSupport(threshold: number): boolean;
  
  /**
   * Get average support across all factions
   */
  getAverageSupport(): number;
  
  /**
   * Get faction by ID
   */
  getFaction(id: string): Faction | undefined;
  
  /**
   * Get all factions (readonly)
   */
  getFactions(): ReadonlyMap<string, Faction>;
  
  /**
   * Get available decisions
   */
  getAvailableDecisions(): Decision[];
  
  toJSON(): any;
  static fromJSON(data: any): PoliticsEngine;
}
```

## Implementation

```typescript
// src/core/systems/PoliticsEngine.ts

import type { GameState } from '../GameState';
import type { GameEvent } from '../events/GameEvent';
import type { Faction, Decision, DecisionResult, FactionImpact } from '../models/Politics';

export class PoliticsEngine {
  private factions: Map<string, Faction> = new Map();
  private supportDecayRate = 0.3; // Support decays by this much per sol
  private decisions: Map<string, Decision> = new Map();
  
  constructor(factions: Faction[], decisions: Decision[] = []) {
    factions.forEach(f => this.factions.set(f.id, { ...f }));
    decisions.forEach(d => this.decisions.set(d.id, d));
  }
  
  tick(state: GameState): GameEvent[] {
    const events: GameEvent[] = [];
    
    // Natural support decay (people forget favors, want new actions)
    for (const faction of this.factions.values()) {
      faction.support = Math.max(0, faction.support - this.supportDecayRate);
      
      // Trigger unrest warnings
      if (faction.support < 20) {
        events.push({
          type: 'FACTION_UNREST',
          factionId: faction.id,
          factionName: faction.name,
          severity: 'warning',
          support: faction.support
        });
      }
      
      // Critical: faction may take hostile action
      if (faction.support < 10) {
        events.push({
          type: 'FACTION_HOSTILE',
          factionId: faction.id,
          factionName: faction.name,
          severity: 'critical',
          support: faction.support
        });
      }
    }
    
    return events;
  }
  
  makeDecision(decision: Decision): DecisionResult {
    const impacts: FactionImpact[] = [];
    
    // Calculate impact on each faction
    for (const faction of this.factions.values()) {
      const impact = this.calculateImpact(decision, faction);
      
      // Apply change
      faction.support = Math.max(0, Math.min(100, faction.support + impact));
      
      impacts.push({
        factionId: faction.id,
        change: impact,
        newSupport: faction.support
      });
    }
    
    return {
      success: this.hasMinimumSupport(decision.requiredSupport),
      impacts
    };
  }
  
  private calculateImpact(decision: Decision, faction: Faction): number {
    let impact = 0;
    
    // Each faction priority affects how much they care about decision tags
    for (const priority of faction.priorities) {
      const alignment = decision.tags[priority.concern] || 0;
      
      // Higher priority (lower weight number) = bigger impact
      const multiplier = 1 / priority.weight;
      impact += alignment * multiplier * 10; // Scale factor
    }
    
    return Math.round(impact);
  }
  
  hasMinimumSupport(threshold: number): boolean {
    return this.getAverageSupport() >= threshold;
  }
  
  getAverageSupport(): number {
    const factions = Array.from(this.factions.values());
    if (factions.length === 0) return 0;
    
    return factions.reduce((sum, f) => sum + f.support, 0) / factions.length;
  }
  
  getFaction(id: string): Faction | undefined {
    return this.factions.get(id);
  }
  
  getFactions(): ReadonlyMap<string, Faction> {
    return new Map(this.factions);
  }
  
  getAvailableDecisions(): Decision[] {
    return Array.from(this.decisions.values());
  }
  
  toJSON() {
    return {
      factions: Array.from(this.factions.values()),
      supportDecayRate: this.supportDecayRate
    };
  }
  
  static fromJSON(data: any): PoliticsEngine {
    const engine = new PoliticsEngine(data.factions);
    engine.supportDecayRate = data.supportDecayRate;
    return engine;
  }
}
```

## Event Types

```typescript
{
  type: 'FACTION_UNREST',
  factionId: string,
  factionName: string,
  severity: 'warning',
  support: number
}

{
  type: 'FACTION_HOSTILE',
  factionId: string,
  factionName: string,
  severity: 'critical',
  support: number
}
```

## Testing

```typescript
// tests/PoliticsEngine.test.ts

import { describe, it, expect } from 'vitest';
import { PoliticsEngine } from '../src/core/systems/PoliticsEngine';
import { FACTIONS } from '../src/core/data/factions';

describe('PoliticsEngine', () => {
  it('should initialize with factions', () => {
    const engine = new PoliticsEngine(FACTIONS);
    expect(engine.getFactions().size).toBe(3);
  });
  
  it('should decay support over time', () => {
    const engine = new PoliticsEngine(FACTIONS);
    const initialSupport = engine.getFaction('earth_loyalists')!.support;
    
    engine.tick({} as any);
    
    const newSupport = engine.getFaction('earth_loyalists')!.support;
    expect(newSupport).toBeLessThan(initialSupport);
  });
  
  it('should calculate decision impacts based on priorities', () => {
    const engine = new PoliticsEngine(FACTIONS);
    
    const decision = {
      id: 'test',
      name: 'Test',
      description: 'Test',
      requiredSupport: 40,
      tags: {
        earth_welfare: 20,
        mars_sovereignty: -10
      }
    };
    
    const result = engine.makeDecision(decision);
    
    // Earth Loyalists should gain support (earth_welfare is priority #1)
    const earthImpact = result.impacts.find(i => i.factionId === 'earth_loyalists');
    expect(earthImpact!.change).toBeGreaterThan(0);
    
    // Mars Independence should lose support (mars_sovereignty is priority #1)
    const marsImpact = result.impacts.find(i => i.factionId === 'mars_independence');
    expect(marsImpact!.change).toBeLessThan(0);
  });
  
  it('should check minimum support correctly', () => {
    const engine = new PoliticsEngine([
      { id: 'f1', name: 'F1', description: '', support: 60, priorities: [] },
      { id: 'f2', name: 'F2', description: '', support: 40, priorities: [] }
    ]);
    
    // Average is 50
    expect(engine.hasMinimumSupport(45)).toBe(true);
    expect(engine.hasMinimumSupport(55)).toBe(false);
  });
});
```

## Notes

- Support is 0-100 scale
- Support naturally decays over time (people want ongoing engagement)
- Decision impact = sum of (tag_value * priority_multiplier)
- Priority multiplier = 1/weight (priority 1 has 1x multiplier, priority 2 has 0.5x, etc.)
- Average support gates major decisions
- Very low support (<10) can trigger hostile faction events
- Some decisions have resource costs/benefits
