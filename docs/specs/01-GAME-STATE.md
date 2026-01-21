# GameState System

## Purpose

Central container for all game state. Coordinates all subsystems and provides the main game loop tick mechanism.

## Location

`src/core/GameState.ts`

## Dependencies

```typescript
import { ResourceManager } from './systems/ResourceManager';
import { PoliticsEngine } from './systems/PoliticsEngine';
import { TechnologyTree } from './systems/TechnologyTree';
import { BuildingManager } from './systems/BuildingManager';
import { ColonyManager } from './systems/ColonyManager';
import { WorkforceManager } from './systems/WorkforceManager';
import { EventManager } from './systems/EventManager';
import { VictoryManager } from './systems/VictoryManager';
import { GameEvent } from './events/GameEvent';
```

## Interface

```typescript
export class GameState {
  // Current game time
  currentSol: number;
  
  // All subsystems
  resources: ResourceManager;
  politics: PoliticsEngine;
  technology: TechnologyTree;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  events: EventManager;
  victory: VictoryManager;
  
  constructor();
  
  /**
   * Advance game by one sol
   * Returns all events that occurred this sol
   */
  tick(): GameEvent[];
  
  /**
   * Serialize entire game state to JSON
   * Used for save/load
   */
  toJSON(): SaveData;
  
  /**
   * Restore game state from JSON
   */
  static fromJSON(data: SaveData): GameState;
}

export interface SaveData {
  currentSol: number;
  resources: any; // Each system defines its own save format
  politics: any;
  technology: any;
  buildings: any;
  colony: any;
  workforce: any;
  events: any;
}
```

## Implementation

```typescript
// src/core/GameState.ts

import { ResourceManager } from './systems/ResourceManager';
import { PoliticsEngine } from './systems/PoliticsEngine';
import { TechnologyTree } from './systems/TechnologyTree';
import { BuildingManager } from './systems/BuildingManager';
import { ColonyManager } from './systems/ColonyManager';
import { WorkforceManager } from './systems/WorkforceManager';
import { EventManager } from './systems/EventManager';
import { VictoryManager } from './systems/VictoryManager';
import { GameEvent } from './events/GameEvent';
import { STARTING_RESOURCES, STARTING_POPULATION } from './balance/EconomyBaseline';
import { BUILDINGS } from './data/buildings';
import { TECHNOLOGIES } from './data/technologies';
import { RANDOM_EVENTS } from './data/events';
import { FACTIONS } from './data/factions';

export class GameState {
  currentSol: number = 0;
  
  resources: ResourceManager;
  politics: PoliticsEngine;
  technology: TechnologyTree;
  buildings: BuildingManager;
  colony: ColonyManager;
  workforce: WorkforceManager;
  events: EventManager;
  victory: VictoryManager;
  
  constructor() {
    // Initialize all subsystems
    this.resources = new ResourceManager(STARTING_RESOURCES);
    this.politics = new PoliticsEngine(FACTIONS);
    this.technology = new TechnologyTree(TECHNOLOGIES);
    this.buildings = new BuildingManager(BUILDINGS);
    this.colony = new ColonyManager(STARTING_POPULATION);
    this.workforce = new WorkforceManager();
    this.events = new EventManager(RANDOM_EVENTS);
    this.victory = new VictoryManager();
  }
  
  /**
   * Main game loop - advance one sol
   */
  tick(): GameEvent[] {
    this.currentSol++;
    
    const events: GameEvent[] = [];
    
    // Order matters! Some systems depend on others
    
    // 1. Resources tick first (calculates production/consumption)
    events.push(...this.resources.tick(this));
    
    // 2. Buildings tick (construction progress, apply effects)
    events.push(...this.buildings.tick(this));
    
    // 3. Workforce (training, experience gain, master events)
    events.push(...this.workforce.tick(this));
    
    // 4. Colony (health, morale, population changes)
    events.push(...this.colony.tick(this));
    
    // 5. Technology (research progress)
    events.push(...this.technology.tick(this));
    
    // 6. Politics (support decay, faction events)
    events.push(...this.politics.tick(this));
    
    // 7. Random events (check for triggers)
    events.push(...this.events.tick(this));
    
    return events;
  }
  
  toJSON(): SaveData {
    return {
      currentSol: this.currentSol,
      resources: this.resources.toJSON(),
      politics: this.politics.toJSON(),
      technology: this.technology.toJSON(),
      buildings: this.buildings.toJSON(),
      colony: this.colony.toJSON(),
      workforce: this.workforce.toJSON(),
      events: this.events.toJSON()
    };
  }
  
  static fromJSON(data: SaveData): GameState {
    const state = new GameState();
    
    state.currentSol = data.currentSol;
    state.resources = ResourceManager.fromJSON(data.resources);
    state.politics = PoliticsEngine.fromJSON(data.politics);
    state.technology = TechnologyTree.fromJSON(data.technology);
    state.buildings = BuildingManager.fromJSON(data.buildings);
    state.colony = ColonyManager.fromJSON(data.colony);
    state.workforce = WorkforceManager.fromJSON(data.workforce);
    state.events = EventManager.fromJSON(data.events);
    
    return state;
  }
}

export interface SaveData {
  currentSol: number;
  resources: any;
  politics: any;
  technology: any;
  buildings: any;
  colony: any;
  workforce: any;
  events: any;
}
```

## Usage in Vue Service

```typescript
// src/renderer/services/GameService.ts

import { reactive, readonly } from 'vue';
import { GameState } from '@/core/GameState';

class GameService {
  private gameState: GameState;
  private state = reactive({
    currentSol: 0,
    // ... mirror relevant state for UI
  });
  
  constructor() {
    this.gameState = new GameState();
    this.syncState();
  }
  
  tick(): void {
    const events = this.gameState.tick();
    this.syncState();
    // Process events...
  }
  
  private syncState(): void {
    this.state.currentSol = this.gameState.currentSol;
    // ... sync other state
  }
  
  getState() {
    return readonly(this.state);
  }
  
  getGameState(): GameState {
    return this.gameState;
  }
}

export const gameService = new GameService();
```

## Testing

```typescript
// tests/GameState.test.ts

import { describe, it, expect } from 'vitest';
import { GameState } from '../src/core/GameState';

describe('GameState', () => {
  it('should initialize with sol 0', () => {
    const state = new GameState();
    expect(state.currentSol).toBe(0);
  });
  
  it('should increment sol on tick', () => {
    const state = new GameState();
    state.tick();
    expect(state.currentSol).toBe(1);
  });
  
  it('should serialize and deserialize', () => {
    const state = new GameState();
    state.tick();
    state.tick();
    
    const saved = state.toJSON();
    const restored = GameState.fromJSON(saved);
    
    expect(restored.currentSol).toBe(2);
  });
  
  it('should trigger system ticks', () => {
    const state = new GameState();
    const events = state.tick();
    
    // Should return array of events
    expect(Array.isArray(events)).toBe(true);
  });
});
```

## Notes

- GameState does NOT contain game logic - it only coordinates subsystems
- Each subsystem is independent and testable
- Tick order is important - resources before buildings, workforce before colony, etc.
- Save/load must preserve exact game state including RNG seeds (future enhancement)
- All mutations happen through this class - subsystems don't modify each other directly
