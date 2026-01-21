# Resource Manager System

## Purpose

Tracks resource quantities, production rates, and consumption rates. Calculates net flow and triggers warnings when resources are low or depleted.

## Location

`src/core/systems/ResourceManager.ts`

## Models

```typescript
// src/core/models/Resources.ts

export interface Resources {
  food: number;
  oxygen: number;
  water: number;
  power: number;
  materials: number;
}

export interface ResourceDelta {
  food?: number;
  oxygen?: number;
  water?: number;
  power?: number;
  materials?: number;
}
```

## Interface

```typescript
export class ResourceManager {
  constructor(initial: Resources);
  
  /**
   * Process one sol of resource production/consumption
   */
  tick(state: GameState): GameEvent[];
  
  /**
   * Add to production rate (e.g., when building activates)
   */
  addProduction(delta: ResourceDelta): void;
  
  /**
   * Remove from production rate (e.g., when building deactivates)
   */
  removeProduction(delta: ResourceDelta): void;
  
  /**
   * Add to consumption rate
   */
  addConsumption(delta: ResourceDelta): void;
  
  /**
   * Remove from consumption rate
   */
  removeConsumption(delta: ResourceDelta): void;
  
  /**
   * Check if resources are available for a one-time cost
   */
  canAfford(cost: ResourceDelta): boolean;
  
  /**
   * Deduct resources (for one-time costs like building)
   */
  deduct(cost: ResourceDelta): boolean;
  
  /**
   * Get current resource quantities (readonly)
   */
  getResources(): Readonly<Resources>;
  
  /**
   * Get current production rates
   */
  getProduction(): Readonly<ResourceDelta>;
  
  /**
   * Get current consumption rates
   */
  getConsumption(): Readonly<ResourceDelta>;
  
  /**
   * Calculate net flow (production - consumption)
   */
  getNetFlow(): ResourceDelta;
  
  /**
   * Serialize
   */
  toJSON(): any;
  static fromJSON(data: any): ResourceManager;
}
```

## Implementation

```typescript
// src/core/systems/ResourceManager.ts

import type { GameState } from '../GameState';
import type { GameEvent } from '../events/GameEvent';
import type { Resources, ResourceDelta } from '../models/Resources';

export class ResourceManager {
  private resources: Resources;
  private production: ResourceDelta = {};
  private consumption: ResourceDelta = {};
  
  constructor(initial: Resources) {
    this.resources = { ...initial };
  }
  
  tick(state: GameState): GameEvent[] {
    const events: GameEvent[] = [];
    
    // Calculate net change for each resource
    for (const resource in this.resources) {
      const key = resource as keyof Resources;
      const produced = this.production[key] || 0;
      const consumed = this.consumption[key] || 0;
      const net = produced - consumed;
      
      // Apply change
      this.resources[key] += net;
      
      // Clamp to zero (can't go negative)
      if (this.resources[key] < 0) {
        this.resources[key] = 0;
      }
      
      // Trigger warnings/critical events
      if (this.resources[key] === 0) {
        events.push({
          type: 'RESOURCE_DEPLETED',
          resource: key,
          severity: 'critical'
        });
      } else if (this.resources[key] < 20) {
        events.push({
          type: 'RESOURCE_LOW',
          resource: key,
          severity: 'warning',
          currentAmount: this.resources[key]
        });
      }
    }
    
    return events;
  }
  
  addProduction(delta: ResourceDelta): void {
    for (const [key, value] of Object.entries(delta)) {
      const resourceKey = key as keyof Resources;
      this.production[resourceKey] = (this.production[resourceKey] || 0) + value;
    }
  }
  
  removeProduction(delta: ResourceDelta): void {
    for (const [key, value] of Object.entries(delta)) {
      const resourceKey = key as keyof Resources;
      this.production[resourceKey] = Math.max(0, (this.production[resourceKey] || 0) - value);
    }
  }
  
  addConsumption(delta: ResourceDelta): void {
    for (const [key, value] of Object.entries(delta)) {
      const resourceKey = key as keyof Resources;
      this.consumption[resourceKey] = (this.consumption[resourceKey] || 0) + value;
    }
  }
  
  removeConsumption(delta: ResourceDelta): void {
    for (const [key, value] of Object.entries(delta)) {
      const resourceKey = key as keyof Resources;
      this.consumption[resourceKey] = Math.max(0, (this.consumption[resourceKey] || 0) - value);
    }
  }
  
  canAfford(cost: ResourceDelta): boolean {
    return Object.entries(cost).every(([resource, amount]) => {
      const key = resource as keyof Resources;
      return this.resources[key] >= amount;
    });
  }
  
  deduct(cost: ResourceDelta): boolean {
    if (!this.canAfford(cost)) return false;
    
    for (const [resource, amount] of Object.entries(cost)) {
      const key = resource as keyof Resources;
      this.resources[key] -= amount;
    }
    
    return true;
  }
  
  getResources(): Readonly<Resources> {
    return { ...this.resources };
  }
  
  getProduction(): Readonly<ResourceDelta> {
    return { ...this.production };
  }
  
  getConsumption(): Readonly<ResourceDelta> {
    return { ...this.consumption };
  }
  
  getNetFlow(): ResourceDelta {
    const net: ResourceDelta = {};
    
    const allKeys = new Set([
      ...Object.keys(this.production),
      ...Object.keys(this.consumption)
    ]);
    
    for (const key of allKeys) {
      const resourceKey = key as keyof Resources;
      const produced = this.production[resourceKey] || 0;
      const consumed = this.consumption[resourceKey] || 0;
      net[resourceKey] = produced - consumed;
    }
    
    return net;
  }
  
  toJSON() {
    return {
      resources: this.resources,
      production: this.production,
      consumption: this.consumption
    };
  }
  
  static fromJSON(data: any): ResourceManager {
    const manager = new ResourceManager(data.resources);
    manager.production = data.production;
    manager.consumption = data.consumption;
    return manager;
  }
}
```

## Event Types

```typescript
// Emitted by ResourceManager

{
  type: 'RESOURCE_DEPLETED',
  resource: 'food' | 'oxygen' | 'water' | 'power' | 'materials',
  severity: 'critical'
}

{
  type: 'RESOURCE_LOW',
  resource: string,
  severity: 'warning',
  currentAmount: number
}
```

## Usage Examples

```typescript
// Buildings add production when activated
state.resources.addProduction({ food: 15 }); // Greenhouse comes online

// Buildings add consumption when activated
state.resources.addConsumption({ power: 5, water: 2 }); // Greenhouse needs power/water

// Population adds consumption
const foodNeeded = population * COLONIST_NEEDS.food;
state.resources.addConsumption({ food: foodNeeded });

// One-time costs
if (state.resources.canAfford({ materials: 100, power: 10 })) {
  state.resources.deduct({ materials: 100, power: 10 });
  // Start building construction
}

// Check net flow
const netFlow = state.resources.getNetFlow();
if (netFlow.food < 0) {
  // Warning: food consumption exceeds production!
}
```

## Testing

```typescript
// tests/ResourceManager.test.ts

import { describe, it, expect } from 'vitest';
import { ResourceManager } from '../src/core/systems/ResourceManager';

describe('ResourceManager', () => {
  it('should initialize with starting resources', () => {
    const manager = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 100
    });
    
    const resources = manager.getResources();
    expect(resources.food).toBe(100);
  });
  
  it('should consume resources each tick', () => {
    const manager = new ResourceManager({ food: 100, oxygen: 100, water: 100, power: 100, materials: 100 });
    manager.addConsumption({ food: 5 });
    
    manager.tick({} as any);
    
    expect(manager.getResources().food).toBe(95);
  });
  
  it('should produce resources each tick', () => {
    const manager = new ResourceManager({ food: 100, oxygen: 100, water: 100, power: 100, materials: 100 });
    manager.addProduction({ food: 10 });
    
    manager.tick({} as any);
    
    expect(manager.getResources().food).toBe(110);
  });
  
  it('should emit warning when resource is low', () => {
    const manager = new ResourceManager({ food: 15, oxygen: 100, water: 100, power: 100, materials: 100 });
    
    const events = manager.tick({} as any);
    
    const warning = events.find(e => e.type === 'RESOURCE_LOW');
    expect(warning).toBeDefined();
    expect(warning?.resource).toBe('food');
  });
  
  it('should not go below zero', () => {
    const manager = new ResourceManager({ food: 5, oxygen: 100, water: 100, power: 100, materials: 100 });
    manager.addConsumption({ food: 10 });
    
    manager.tick({} as any);
    
    expect(manager.getResources().food).toBe(0);
  });
  
  it('should check affordability correctly', () => {
    const manager = new ResourceManager({ food: 50, oxygen: 100, water: 100, power: 100, materials: 100 });
    
    expect(manager.canAfford({ food: 30 })).toBe(true);
    expect(manager.canAfford({ food: 60 })).toBe(false);
  });
  
  it('should deduct resources on purchase', () => {
    const manager = new ResourceManager({ food: 100, oxygen: 100, water: 100, power: 100, materials: 100 });
    
    manager.deduct({ materials: 50, power: 10 });
    
    const resources = manager.getResources();
    expect(resources.materials).toBe(50);
    expect(resources.power).toBe(90);
  });
});
```

## Notes

- Resources cannot go negative (clamped to 0)
- Production/consumption are rates (per sol), not one-time amounts
- Buildings modify production/consumption when they activate/deactivate
- Population modifies consumption based on colonist needs
- Low resource warnings give player chance to react before depletion
- Depleted critical resources (food, oxygen) trigger defeat conditions
