# Technology Tree System

## Purpose

Manages technology research, prerequisites, and unlocks. Technologies gate access to buildings, improvements, and victory conditions.

## Location

`src/core/systems/TechnologyTree.ts`

## Models

```typescript
// src/core/models/Technology.ts

export interface Technology {
  id: string;
  name: string;
  description: string;
  prerequisites: string[]; // Tech IDs that must be researched first
  cost: {
    sols: number;
    resources?: ResourceDelta;
  };
  unlocks: string[]; // Building IDs, other tech IDs, etc.
  effects?: {
    type: 'research_speed' | 'construction_speed' | 'production_bonus';
    value: number;
  }[];
}

export interface TechResearch {
  techId: string;
  progress: number;      // Sols spent researching
  requiredSols: number;  // Total sols needed
}
```

## Data File

```typescript
// src/core/data/technologies.ts

import type { Technology } from '../models/Technology';

export const TECHNOLOGIES: Technology[] = [
  // EARLY TIER (Sol 30-90)
  {
    id: 'hydroponics',
    name: 'Hydroponics',
    description: 'Advanced soil-free farming techniques',
    prerequisites: [],
    cost: { sols: 60 },
    unlocks: ['greenhouse']
  },
  {
    id: 'water_recycling',
    name: 'Water Recycling',
    description: 'Closed-loop water systems',
    prerequisites: [],
    cost: { sols: 45 },
    unlocks: ['water_reclaimer'],
    effects: [
      { type: 'production_bonus', value: 0.5 } // 50% less water consumption
    ]
  },
  {
    id: 'advanced_materials',
    name: 'Advanced Materials',
    description: 'Stronger, lighter construction materials',
    prerequisites: [],
    cost: { sols: 75 },
    unlocks: ['research_lab', 'advanced_habitat']
  },
  
  // MID TIER (Sol 90-200)
  {
    id: 'robotics',
    name: 'Robotics',
    description: 'Automated labor and manufacturing',
    prerequisites: ['advanced_materials'],
    cost: { sols: 120 },
    unlocks: ['automated_factory'],
    effects: [
      { type: 'construction_speed', value: 1.2 } // 20% faster building
    ]
  },
  {
    id: 'asteroid_mining',
    name: 'Asteroid Mining',
    description: 'Extract resources from nearby asteroids',
    prerequisites: ['advanced_materials', 'robotics'],
    cost: { sols: 150, resources: { materials: 200 } },
    unlocks: ['mining_station']
  },
  {
    id: 'nuclear_fission',
    name: 'Nuclear Fission',
    description: 'Safe nuclear power generation',
    prerequisites: ['advanced_materials'],
    cost: { sols: 180 },
    unlocks: ['nuclear_reactor']
  },
  
  // LATE TIER (Sol 200-400)
  {
    id: 'genetics',
    name: 'Genetic Engineering',
    description: 'Modify organisms for Mars conditions',
    prerequisites: ['hydroponics'],
    cost: { sols: 200 },
    unlocks: ['biolab']
  },
  {
    id: 'advanced_medicine',
    name: 'Advanced Medicine',
    description: 'Extend human lifespan and health',
    prerequisites: ['genetics'],
    cost: { sols: 250 },
    unlocks: ['medical_center']
  },
  {
    id: 'life_extension',
    name: 'Life Extension',
    description: 'Double human lifespan through genetic therapy',
    prerequisites: ['genetics', 'advanced_medicine'],
    cost: { sols: 300 },
    unlocks: []
  },
  {
    id: 'cryosleep',
    name: 'Cryogenic Sleep',
    description: 'Suspend humans for long-duration travel',
    prerequisites: ['advanced_medicine'],
    cost: { sols: 250 },
    unlocks: ['cryo_facility']
  },
  
  // ENDGAME TIER (Sol 400+)
  {
    id: 'fusion_drive',
    name: 'Fusion Drive',
    description: 'Propulsion system for interstellar travel',
    prerequisites: ['nuclear_fission', 'advanced_materials'],
    cost: { sols: 400 },
    unlocks: []
  },
  {
    id: 'closed_ecosystem',
    name: 'Closed Ecosystem',
    description: 'Fully self-sustaining life support',
    prerequisites: ['hydroponics', 'water_recycling', 'genetics'],
    cost: { sols: 350 },
    unlocks: []
  },
  {
    id: 'generation_ship',
    name: 'Generation Ship',
    description: 'Massive vessel for interstellar colonization',
    prerequisites: ['fusion_drive', 'cryosleep', 'closed_ecosystem'],
    cost: { sols: 500, resources: { materials: 1000 } },
    unlocks: ['arc_ship']
  }
];
```

## Interface

```typescript
export class TechnologyTree {
  constructor(techs: Technology[]);
  
  tick(state: GameState): GameEvent[];
  
  canResearch(techId: string): boolean;
  startResearch(techId: string, state: GameState): boolean;
  cancelResearch(): void;
  
  isResearched(techId: string): boolean;
  getTech(techId: string): Technology | undefined;
  getAvailableTechs(): Technology[];
  getResearchedTechs(): Technology[];
  getCurrentResearch(): TechResearch | null;
  getResearchedCount(): number;
  
  toJSON(): any;
  static fromJSON(data: any): TechnologyTree;
}
```

## Implementation

```typescript
// src/core/systems/TechnologyTree.ts

import type { GameState } from '../GameState';
import type { GameEvent } from '../events/GameEvent';
import type { Technology, TechResearch } from '../models/Technology';

export class TechnologyTree {
  private technologies: Map<string, Technology> = new Map();
  private researched: Set<string> = new Set();
  private currentResearch: TechResearch | null = null;
  
  constructor(techs: Technology[]) {
    techs.forEach(t => this.technologies.set(t.id, t));
  }
  
  tick(state: GameState): GameEvent[] {
    const events: GameEvent[] = [];
    
    if (this.currentResearch) {
      // Apply research speed modifiers (from buildings, etc.)
      const speedMultiplier = this.getResearchSpeedMultiplier(state);
      this.currentResearch.progress += speedMultiplier;
      
      if (this.currentResearch.progress >= this.currentResearch.requiredSols) {
        // Research complete!
        const tech = this.technologies.get(this.currentResearch.techId)!;
        this.researched.add(this.currentResearch.techId);
        
        events.push({
          type: 'RESEARCH_COMPLETE',
          techId: this.currentResearch.techId,
          techName: tech.name
        });
        
        this.currentResearch = null;
      }
    }
    
    return events;
  }
  
  canResearch(techId: string): boolean {
    const tech = this.technologies.get(techId);
    if (!tech || this.researched.has(techId)) return false;
    
    // Check all prerequisites are researched
    return tech.prerequisites.every(prereq => this.researched.has(prereq));
  }
  
  startResearch(techId: string, state: GameState): boolean {
    if (!this.canResearch(techId)) return false;
    if (this.currentResearch) return false; // Already researching
    
    const tech = this.technologies.get(techId)!;
    
    // Check resource cost
    if (tech.cost.resources && !state.resources.canAfford(tech.cost.resources)) {
      return false;
    }
    
    // Deduct resources
    if (tech.cost.resources) {
      state.resources.deduct(tech.cost.resources);
    }
    
    this.currentResearch = {
      techId,
      progress: 0,
      requiredSols: tech.cost.sols
    };
    
    return true;
  }
  
  cancelResearch(): void {
    this.currentResearch = null;
  }
  
  isResearched(techId: string): boolean {
    return this.researched.has(techId);
  }
  
  getTech(techId: string): Technology | undefined {
    return this.technologies.get(techId);
  }
  
  getAvailableTechs(): Technology[] {
    return Array.from(this.technologies.values())
      .filter(tech => this.canResearch(tech.id));
  }
  
  getResearchedTechs(): Technology[] {
    return Array.from(this.technologies.values())
      .filter(tech => this.researched.has(tech.id));
  }
  
  getCurrentResearch(): TechResearch | null {
    return this.currentResearch ? { ...this.currentResearch } : null;
  }
  
  getResearchedCount(): number {
    return this.researched.size;
  }
  
  private getResearchSpeedMultiplier(state: GameState): number {
    // Base speed is 1 sol per tick
    let multiplier = 1.0;
    
    // Buildings can boost research speed
    // (This would be implemented by checking active buildings)
    
    return multiplier;
  }
  
  toJSON() {
    return {
      researched: Array.from(this.researched),
      currentResearch: this.currentResearch
    };
  }
  
  static fromJSON(data: any): TechnologyTree {
    const tree = new TechnologyTree([]);
    tree.researched = new Set(data.researched);
    tree.currentResearch = data.currentResearch;
    return tree;
  }
}
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';
import { TechnologyTree } from '../src/core/systems/TechnologyTree';
import { TECHNOLOGIES } from '../src/core/data/technologies';

describe('TechnologyTree', () => {
  it('should allow researching techs with no prerequisites', () => {
    const tree = new TechnologyTree(TECHNOLOGIES);
    expect(tree.canResearch('hydroponics')).toBe(true);
  });
  
  it('should not allow researching techs with unmet prerequisites', () => {
    const tree = new TechnologyTree(TECHNOLOGIES);
    expect(tree.canResearch('asteroid_mining')).toBe(false); // Requires robotics
  });
  
  it('should complete research after required sols', () => {
    const tree = new TechnologyTree(TECHNOLOGIES);
    const mockState = {
      resources: {
        canAfford: () => true,
        deduct: () => true
      }
    } as any;
    
    tree.startResearch('hydroponics', mockState);
    
    const tech = tree.getTech('hydroponics')!;
    for (let i = 0; i < tech.cost.sols; i++) {
      tree.tick(mockState);
    }
    
    expect(tree.isResearched('hydroponics')).toBe(true);
  });
});
```

## Notes

- Only one research active at a time
- Prerequisites must ALL be met to unlock a tech
- Research speed can be modified by buildings (research labs)
- Some techs have resource costs in addition to time
- Victory condition: Research "generation_ship"
