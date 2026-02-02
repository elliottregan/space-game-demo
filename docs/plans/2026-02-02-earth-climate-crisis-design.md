# Earth Climate Crisis Design

## Overview

A doomsday clock mechanic that creates urgency by limiting game duration. Earth faces a climate crisis that worsens over time. Players must achieve victory before Earth collapses, or the game is marked as a loss (though play can continue).

## Core Data Model

```typescript
// Crisis severity as percentage (0-100)
interface EarthClimateCrisis {
  severity: number;           // 0-100, increases over time
  solStarted: number;         // When the crisis tracking began (sol 0)
  pointOfNoReturn: boolean;   // True when severity hits 100
}

// Flexible effect system - expandable for future effects
type CrisisEffectType =
  | "refugee_wave"
  | "political_instability"  // Scaffolded, not implemented
  // Future effects added here

interface CrisisEffect {
  type: CrisisEffectType;
  params: Record<string, unknown>;  // Type-specific parameters
}

interface CrisisThreshold {
  severity: number;           // Trigger at this percentage
  effects: CrisisEffect[];    // Effects to apply when crossed
  repeatable: boolean;        // Can trigger multiple times
  repeatInterval?: number;    // Sols between repeats (if repeatable)
}
```

## Balance Configuration

```typescript
const EARTH_CRISIS_BALANCE = {
  severityPerSol: 0.15,        // ~667 sols to reach 100%
  startingSeverity: 0,

  thresholds: [
    {
      severity: 25,
      effects: [{ type: "refugee_wave", params: { count: 2 } }],
      repeatable: true,
      repeatInterval: 100,     // Every 100 sols after 25%
    },
    {
      severity: 50,
      effects: [{ type: "refugee_wave", params: { count: 3 } }],
      repeatable: true,
      repeatInterval: 75,      // Accelerates
    },
    {
      severity: 75,
      effects: [{ type: "refugee_wave", params: { count: 4 } }],
      repeatable: true,
      repeatInterval: 50,      // Even faster
    },
    {
      severity: 100,
      effects: [],             // Earth goes dark - handled specially
      repeatable: false,
    },
  ],
};
```

**Pacing rationale:**
- At 0.15% per sol, players have ~667 sols before point of no return
- Median victory (~343 sols) finishes at ~50% severity
- Slow victories (~594 sols) finish at ~89% severity
- Refugee waves start small and accelerate as crisis worsens

## Refugee Wave Mechanic

Refugees are a mixed blessing - workforce boost but potential political disruption.

```typescript
interface RefugeeWaveParams {
  count: number;
}

function applyRefugeeWave(params: RefugeeWaveParams): GameEvent[] {
  const refugees: Colonist[] = [];

  for (let i = 0; i < params.count; i++) {
    refugees.push({
      skills: generateRandomSkills(),

      // Ideology skewed toward Earth Loyalist (fleeing Earth)
      // 60% Earth Loyalist leaning, 25% neutral, 15% other
      ideology: generateRefugeeIdeology(),

      // Lower starting morale (trauma of displacement)
      morale: BASE_MORALE * 0.7,
    });
  }

  addColonists(refugees);

  return [{
    type: "refugee_arrival",
    message: `${params.count} climate refugees arrived from Earth`,
    severity: "info",
  }];
}
```

## Point of No Return (100% Severity)

When Earth collapses:

1. **Game marked as loss** - `defeatReason: "earth_collapse"` for stats/simulation
2. **Megastructures can still be built** - No gameplay restrictions
3. **Earth supply events disabled** - No more supply ships or Earth-based events
4. **No more refugees** - Earth evacuation complete
5. **Victory never triggers** - Even if megastructure completes, it doesn't count as a win

```typescript
function applyPointOfNoReturn(): GameEvent[] {
  crisis.pointOfNoReturn = true;

  return [{
    type: "earth_collapse",
    message: "Earth's climate has collapsed. Victory is no longer possible.",
    severity: "critical",
  }];
}

function checkVictory(): boolean {
  if (crisis.pointOfNoReturn) {
    return false;  // Can't win anymore
  }
  // ... normal victory checks
}
```

## Game Loop Integration

```typescript
class EarthCrisisManager {
  private state: EarthClimateCrisis;
  private triggeredThresholds: Set<number>;
  private lastRepeatSol: Map<number, number>;

  tick(currentSol: number): GameEvent[] {
    if (this.state.pointOfNoReturn) return [];

    // Increase severity
    this.state.severity = Math.min(100,
      this.state.severity + EARTH_CRISIS_BALANCE.severityPerSol
    );

    // Check thresholds and apply effects
    const events: GameEvent[] = [];
    for (const threshold of EARTH_CRISIS_BALANCE.thresholds) {
      if (this.shouldTrigger(threshold, currentSol)) {
        events.push(...this.applyEffects(threshold.effects));
        this.markTriggered(threshold, currentSol);
      }
    }

    // Check point of no return
    if (this.state.severity >= 100 && !this.state.pointOfNoReturn) {
      events.push(...this.applyPointOfNoReturn());
    }

    return events;
  }
}
```

## UI Display

- Progress bar in resource bar area showing severity (0-100%)
- Color shifts: green → yellow → orange → red as severity increases
- Tooltip: "Earth Climate Crisis: 45% - Refugees arriving"
- At 100%: "Earth has collapsed"

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/core/models/EarthCrisis.ts` | New - types and interfaces |
| `src/core/balance/EarthCrisisBalance.ts` | New - threshold config |
| `src/core/systems/EarthCrisisManager.ts` | New - tick logic, effect application |
| `src/core/GameState.ts` | Add EarthCrisisManager to tick order |
| `src/core/systems/ColonyManager.ts` | Refugee arrival logic |
| `src/renderer/components/ResourceBar/` | Crisis severity display |
| `src/core/models/Victory.ts` | Add `earth_collapse` defeat reason |

## Future Expansion

The `CrisisEffectType` union can be extended with new effects:

- `political_instability` - Earth factions become desperate, projects harder to pass
- `communication_delay` - Events take longer to resolve
- `resource_scarcity` - Supply ship events give fewer resources
- `tech_sharing` - Earth shares desperate research breakthroughs

Each effect type has its own params interface and handler function.
