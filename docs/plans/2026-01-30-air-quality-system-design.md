# Air Quality System Design

## Overview

Replace oxygen as a stockpilable resource with an **Air Quality** metric (0-1 scale) that reflects how breathable the colony atmosphere is. Air quality is calculated as an instant equilibrium based on oxygen production vs. consumption each tick.

## Core Mechanics

### Calculation

```
airQuality = clamp(totalProduction / totalConsumption, 0, 1)
```

- **Production**: Sum of `oxygenContribution` from all active buildings (existing field)
- **Consumption**: `population * BASE_OXYGEN_CONSUMPTION_PER_COLONIST`
- **Result**: Clamped to 0-1 range

### What Changes

| Before | After |
|--------|-------|
| Oxygen is stockpiled resource | Air quality is 0-1 metric |
| Buildings produce/consume oxygen units | Buildings have `oxygenContribution` (already exists) |
| Shortage when stockpile empty | Low air quality when production < consumption |
| Efficiency penalty when contribution negative | Efficiency penalty when air quality < 0.5 |

## Comfort Zones

### Comfortable (0.8 - 1.0)
- No penalties
- Colony operates normally
- Target state for players

### Strained (0.5 - 0.8)
- Health drain scales linearly toward 0.5
- Morale penalty (colonists worried about air)
- Visual warning in UI (yellow indicator)

### Critical (below 0.5)
- Severe health drain (accelerates toward 0)
- Large morale penalty
- Building efficiency penalty
- Death risk at very low levels (below 0.2)

## Effect Scaling

Effects scale linearly within each zone. Example values (to be tuned):

| Air Quality | Health/tick | Morale/tick | Efficiency |
|-------------|-------------|-------------|------------|
| 0.8+ | 0 | 0 | 100% |
| 0.6 | -2 | -1 | 100% |
| 0.5 | -3 | -2 | 100% |
| 0.4 | -4 | -3 | 85% |
| 0.3 | -5 | -3 | 75% |
| 0.2 | -7 | -4 | 60% |
| 0.1 | -10 | -5 | 50% |

## Implementation

### New Files

**`src/core/systems/AirQualityManager.ts`**
- Owns `airQuality` metric (0-1)
- `tick(buildings, colony)` - calculates equilibrium
- `getHealthEffect()` - returns health delta for current air quality
- `getMoraleEffect()` - returns morale delta
- `getEfficiencyMultiplier()` - returns 0-1 multiplier for building production

**`src/core/balance/AirQualityBalance.ts`**
- `BASE_OXYGEN_PER_COLONIST` - consumption per colonist
- `AIR_QUALITY_COMFORTABLE` - threshold (0.8)
- `AIR_QUALITY_CRITICAL` - threshold (0.5)
- `AIR_QUALITY_DEADLY` - threshold (0.2)
- Health/morale/efficiency scaling constants

### Modified Files

**`src/core/models/Resources.ts`**
- Remove `oxygen` from `Resources` interface
- Remove `oxygen` from `ResourceDelta` interface
- Remove `oxygen` from `RESOURCE_KEYS` array

**`src/core/data/buildings.ts`**
- Remove any `oxygen` in `production` or `consumption` fields
- Keep `oxygenContribution` field (already exists)

**`src/core/systems/ColonyManager.ts`**
- Remove oxygen shortage health penalty
- Accept air quality effects from tick caller
- Apply health/morale deltas from air quality

**`src/core/systems/BuildingManager.ts`**
- Remove `getOxygenDeficitMultiplier()` helper
- Accept efficiency multiplier from air quality system
- Apply to `getEffectiveProduction()` and `getEffectiveConsumption()`

**`src/core/GameState.ts`**
- Add `AirQualityManager` instance
- Add to tick order after Buildings, before Colony
- Pass air quality effects to ColonyManager

**`src/core/balance/EconomyBaseline.ts`**
- Remove oxygen from `STARTING_RESOURCES`
- Remove oxygen from `COLONIST_NEEDS`
- Remove oxygen from `SHORTAGE_THRESHOLDS`

### UI Changes

**Resource bar**
- Remove oxygen display

**New air quality indicator**
- Display as percentage or bar (like health/morale)
- Color coding: green (0.8+), yellow (0.5-0.8), red (<0.5)
- Tooltip showing production vs consumption breakdown

**GameService**
- Expose `airQuality` in `GameUIState`
- Expose production/consumption breakdown for tooltip

### Migration

Existing saves need handling:
- Strip `oxygen` from saved resources
- Initialize `airQuality` to 1.0 (or calculate from current state)

## Testing Strategy

1. Unit tests for `AirQualityManager` calculation
2. Unit tests for effect scaling at different levels
3. Integration tests for health/morale impact
4. Integration tests for efficiency penalty
5. Simulation runs to verify balance

## Balance Considerations

- Starting buildings should provide comfortable air quality
- Early game should have air quality buffer (habitats produce oxygen)
- Research labs and factories create air pressure
- Player must balance industrial expansion with life support
- Crisis recovery should be possible but not trivial
