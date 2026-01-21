# Mars Colony Roguelike - Technical Specifications

This directory contains comprehensive technical specifications for implementing the Mars Colony Roguelike game demo.

## Quick Start Guide

1. **Read these files in order:**
   - `00-PROJECT-OVERVIEW.md` - Technology stack and architecture
   - `01-GAME-STATE.md` - Central game state coordination
   - `02-RESOURCE-MANAGER.md` - Resource economy
   - `11-BALANCE-CONSTANTS.md` - All tunable values
   
2. **Implement core systems** (in this order for dependencies):
   - GameState + EventBus
   - ResourceManager
   - TechnologyTree
   - BuildingManager
   - ColonyManager
   - WorkforceManager
   - PoliticsEngine
   - EventManager
   - TurnManager
   - VictoryManager

3. **Create Vue UI:**
   - GameService (adapter layer)
   - Basic components for one system
   - Test integration
   - Expand to remaining systems

4. **Add debug tools:**
   - Debug panel
   - Balance validators
   - Automated simulator

## File Index

### Core Architecture
- **00-PROJECT-OVERVIEW.md** - Project setup, tech stack, architecture principles
- **01-GAME-STATE.md** - Central game state container and tick system

### Game Systems
- **02-RESOURCE-MANAGER.md** - Resource production, consumption, and flow
- **03-POLITICS-ENGINE.md** - Faction relationships and political decisions
- **04-TECHNOLOGY-TREE.md** - Research system with prerequisites
- **05-BUILDING-MANAGER.md** - Construction and building effects
- **06-WORKFORCE-MANAGER.md** - Colonist training and role assignments
- **07-COLONY-MANAGER.md** - Population management and colonist lifecycle
- **08-EVENT-MANAGER.md** - Random events with player choices
- **09-TURN-MANAGER.md** - Phase-based turn system
- **10-VICTORY-CONDITIONS.md** - Win/loss detection

### Balance & Debug
- **11-BALANCE-CONSTANTS.md** - All tunable gameplay values
- **12-DEBUG-VIEWS.md** - Development tools and visualizations

## Implementation Priority

### Phase 1: Core Loop (Week 1)
**Goal:** Minimal playable game with resource management

1. Setup project structure
2. Implement:
   - GameState
   - ResourceManager  
   - Simple Vue UI showing resources
   - Manual tick button
3. Validate: Resources decrease per sol, depletion triggers events

### Phase 2: Buildings (Week 2)  
**Goal:** Construction and production

1. Implement:
   - BuildingManager
   - Building data file (3-5 buildings)
   - Building UI (cards with build buttons)
2. Validate: Buildings construct over time, produce/consume resources

### Phase 3: Technology (Week 3)
**Goal:** Research unlocks buildings

1. Implement:
   - TechnologyTree
   - Tech data file (5-7 techs)
   - Research UI
2. Validate: Can't build greenhouse without hydroponics tech

### Phase 4: Population (Week 4)
**Goal:** Workforce and training

1. Implement:
   - ColonyManager
   - WorkforceManager
   - Colonist training UI
2. Validate: Trained colonists improve building efficiency

### Phase 5: Polish (Week 5)
**Goal:** Complete game loop

1. Implement:
   - PoliticsEngine
   - EventManager
   - TurnManager
   - VictoryManager
2. Add:
   - Turn summary screen
   - Event modal
   - Victory/defeat screens
3. Validate: Can win by researching Generation Ship

### Phase 6: Balance (Week 6)
**Goal:** Tuned difficulty

1. Implement debug tools
2. Run simulations
3. Adjust BALANCE_CONSTANTS
4. Playtest to Sol 200+

## Key Design Decisions

### Why Phase-Based Turns?
- Clearer decision points than real-time
- Easier to implement than continuous time
- Matches strategic planning gameplay
- Simpler to save/load

### Why Separate Core from Renderer?
- Easy to swap UI framework
- Testable game logic
- Can run headless simulations
- Clear separation of concerns

### Why Training System vs Manual Assignment?
- Less micromanagement
- Creates strategic choices (when to retrain?)
- Progression satisfaction (novice → master)
- Emergent narratives (career changes)

### Why Faction Priorities vs Fixed Responses?
- More flexible than hard-coded reactions
- Easy to tune in data files
- Clear player understanding
- Supports multiple decision types

## Common Patterns

### Adding a New Building

1. Add to `src/core/data/buildings.ts`:
```typescript
{
  id: 'solar_array',
  name: 'Solar Array',
  // ...
}
```

2. BuildingManager automatically loads it
3. UI automatically shows it (if tech unlocked)
4. No code changes needed

### Adding a New Technology

1. Add to `src/core/data/technologies.ts`
2. Set prerequisites
3. Set unlocks
4. Done - TechnologyTree handles it

### Adding a New Random Event

1. Add to `src/core/data/events.ts`
2. Define conditions, choices, outcomes
3. EventManager picks it up automatically

## Testing Strategy

### Unit Tests
Test each system independently:
```typescript
describe('ResourceManager', () => {
  it('should consume resources each tick', () => {
    // Test without GameState dependencies
  });
});
```

### Integration Tests
Test system interactions:
```typescript
describe('Building → Resources', () => {
  it('should add production when building activates', () => {
    // Test BuildingManager + ResourceManager
  });
});
```

### Simulation Tests
Test balance:
```typescript
describe('Game Balance', () => {
  it('should reach Sol 100 with basic strategy', () => {
    const result = BalanceSimulator.runSimulation(new GreedyAI(), 500);
    expect(result.victory).toBeTruthy();
  });
});
```

## Performance Considerations

### Current Scale
- 10-300 colonists
- 10-80 buildings  
- 20 technologies
- Tick rate: ~1-10 sols per second

### Optimization Points
- Use Maps for O(1) lookups
- Cache computed values (building efficiency)
- Batch UI updates (don't update per-sol, update per-turn)
- Use object pools for colonists if >1000

### When to Optimize
- Don't optimize until profiling shows issues
- Current scale should run <16ms per tick on modern hardware
- Focus on gameplay first

## Future Enhancements

### Post-Demo Features
- Save/load system
- Multiple save slots
- Undo/redo
- Procedural colonist names
- More random events
- Extended tech tree
- Additional factions
- Spatial building placement
- Canvas renderer

### Potential Optimizations
- Web Workers for simulation
- Virtual scrolling for large lists
- Lazy loading of data files
- Delta compression for saves

## Troubleshooting

### Resources not updating?
- Check ResourceManager.tick() is called
- Verify production/consumption rates
- Check GameService.syncState()

### Buildings not producing?
- Verify building is 'active' status
- Check if required workers are assigned
- Validate building definition in data file

### Research not progressing?
- Only one research allowed at a time
- Check resource costs were paid
- Verify prerequisites met

### UI not reactive?
- Ensure GameService uses `reactive()` wrapper
- Check `readonly()` exposure to components
- Verify syncState() is called after mutations

## Support

For questions or issues implementing these specs:
1. Check the relevant specification file
2. Review the testing section for examples
3. Examine the implementation section for code patterns
4. Refer to balance constants for tunable values

## License

These specifications are provided as-is for implementing the Mars Colony Roguelike game demo.
