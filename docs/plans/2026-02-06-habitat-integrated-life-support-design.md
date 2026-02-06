# Habitat-Integrated Life Support

## Problem

Life support is tedious. When air quality drops, the answer is always "build an Oxygen Generator." There's no interesting decision — just a chore that distracts from the real game: colony dynamics and politics.

## Design Goal

Make life support mostly automatic. When it does demand attention, it surfaces as political and social decisions, not construction tasks.

## Core Mechanic

Life support is bundled into habitat buildings. No standalone Oxygen Generators or air quality buildings exist. When you build a habitat, it includes life support for its residents.

Every habitat has two capacity numbers:

- **Housing capacity** — how many colonists it shelters
- **Life support capacity** — how much life support load it can handle (always exceeds housing capacity, providing built-in headroom)

A colony with unfilled habitats has excellent quality. Quality only degrades when population and industrial load consume the headroom, or when water/power supply falters.

## Life Support Quality

Quality (0–100%) replaces the current air quality ratio. Two factors determine it:

### Factor 1: Capacity Utilization

Population plus industrial load versus total life support capacity across all habitats. This is the primary driver.

| Utilization | Quality | Feel |
|---|---|---|
| Under 60% | 95–100% | Spacious, comfortable. Early colony. |
| 60–80% | 80–95% | Healthy. Normal operating range. |
| 80–95% | 55–80% | Crowded. Factions start grumbling. |
| 95–100% | 35–55% | Strained. Political pressure events. |
| Over 100% | 0–35% | Crisis. Health and morale consequences. |

The curve is smooth, not stepped. The player feels a gradual squeeze as population grows.

### Factor 2: Resource Supply

Habitats consume water and power to run life support. Quality is multiplied by how well habitats are supplied. Fully supplied = no penalty. A water or power shortage degrades quality even with physical capacity.

### Thresholds

- **Below 80%** — Advisory: factions voice opinions, no mechanical penalty yet
- **Below 55%** — Political pressure: factions demand action, morale impact begins
- **Below 35%** — Crisis: significant health/morale penalties, urgent political events

## Building Changes

### Removed

- **Oxygen Generator** — gone entirely. Functionality absorbed into habitats.
- **`airContribution`** property on all buildings — no longer exists.

### Modified

Habitats gain life support stats:

- **Habitat Module** — houses 8, life support capacity 10 (25% headroom), consumes 2 water + 5 power for life support
- **Advanced Habitat** — houses 12, life support capacity 18 (50% headroom), consumes 3 water + 8 power, requires tech

Industrial buildings gain **life support load** — a small amount of extra capacity habitats must cover. This replaces the negative `airContribution` values. Mines, factories, and fabricators still stress the system without requiring the player to build a counteracting building.

- **Basic Mine** — life support load: 2
- **3D Fabricator** — life support load: 1
- **Automated Factory** — life support load: 1
- **Mining Station** — life support load: 1
- **Biolab** — life support load: 1
- **Research Lab** — life support load: 1

### Minor Adjustment

Hydroponic Garden loses `airContribution: +2`. Could optionally provide a small life support load reduction (plants clean the air) as a bonus, or be purely a food building.

### Tech Tree

- ADVANCED_MEDICINE and related techs unlock Advanced Habitat tier
- Tech upgrades improve habitat life support efficiency (less water/power per capacity unit)
- Medical Center becomes an upgrade module that boosts quality in existing habitats rather than a standalone building

## Political Integration

When quality drops into pressure zones, the player faces political decisions — not building prompts.

### Decision: Population Outpacing Capacity

Quality enters 80–55% zone. Factions react:

- One faction pushes to restrict immigration until habitats catch up
- Another demands rapid habitat construction at the cost of industrial progress
- A third argues the colony is fine and people are overreacting

No correct answer. The player navigates through the political system.

### Decision: Water Shortage Degrading Life Support

Resource factor drags quality down. This is a resource allocation problem — water for food versus water for life support. Do you cut food production to maintain air quality, or accept lower quality to keep people fed? Both have morale consequences through different pathways.

### Decision: Habitat Inequality

Colonists in Basic Habitats notice Advanced Habitat residents have better quality of life. Dissatisfied colonists spread discontent through social networks via the existing morale propagation system. Factions form opinions about whether inequality is acceptable.

### What Is NOT a Decision

The player never thinks "I need 3 more Oxygen Generators." Life support problems always surface as colony management problems with multiple valid responses.

## System Changes

### Removed

- Oxygen Generator building
- `airContribution` on all buildings
- Air Quality panel as a separate UI concern
- The "build this to fix the red bar" loop

### Replaced

- AirQualityManager becomes LifeSupportManager — calculates quality from capacity utilization + resource supply
- Air Quality panel content folds into colony health / habitat information
- Health panel shows life support quality as one factor, not a separate system

### Unchanged

- Grid placement matters for habitats (power adjacency)
- Morale system — quality feeds into physiological needs satisfaction as air quality does today
- Colony health mechanics — quality effects replace air quality effects
- Political pressure system — gets new trigger conditions from life support quality
