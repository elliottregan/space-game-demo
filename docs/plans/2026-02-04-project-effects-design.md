# Project Effects and Requirements System

**Date:** 2026-02-04
**Status:** Design Complete

## Overview

Add a declarative system for project requirements and completion effects. Projects can require technologies, buildings, population levels, or resources before they can be proposed. When enacted, projects trigger typed effects like recurring events, production modifiers, and conviction boosts.

## Data Model

### Project Requirements

```typescript
export enum ProjectRequirementType {
  TECHNOLOGY = "technology",
  BUILDING = "building",
  POPULATION = "population",
  RESOURCE = "resource",
}

export type ProjectRequirement =
  | { type: ProjectRequirementType.TECHNOLOGY; techId: TechnologyId }
  | { type: ProjectRequirementType.BUILDING; buildingId: BuildingId; count?: number }
  | { type: ProjectRequirementType.POPULATION; min: number }
  | { type: ProjectRequirementType.RESOURCE; resource: keyof ResourceState; min: number };
```

Added to Project interface:
```typescript
export interface Project {
  // ... existing fields ...
  requirements?: ProjectRequirement[];
}
```

### Project Effect Types

```typescript
export enum ProjectEffectType {
  IMMIGRATION_IDEOLOGY_BIAS = "immigration_ideology_bias",
  RECURRING_EVENT = "recurring_event",
  PRODUCTION_MODIFIER = "production_modifier",
  CONVICTION_BOOST = "conviction_boost",
}

export interface RecurringEventParams {
  eventType: string;
  intervalSols: number;
  params?: Record<string, unknown>;
}

export interface ProductionModifierParams {
  resource: "food" | "water" | "materials" | "power";
  amount: number;
}

export interface ConvictionBoostParams {
  faction: NPCFaction;
  amount: number;
}
```

## Tech Tree Change

Rename `ADVANCED_MATERIALS` → `HABITAT_FABRICATION`:
- Same position in tree (tier-1, no prerequisites)
- Same unlocks: Research Lab, Advanced Habitat
- Same cost: 55 sols
- New description: "Prefabricated modular habitat construction techniques"
- Dependents (Robotics, Asteroid Mining) update their prerequisites

## Immigration Program Definition

```typescript
{
  id: ProjectId.IMMIGRATION_PROGRAM,
  name: "Immigration Program",
  description: "Establish formal immigration pathways to bring more settlers from Earth.",
  type: NPCFaction.EarthLoyalists,
  proposalCost: { materials: 120 },
  requiredSupport: 0.35,
  requirements: [
    { type: ProjectRequirementType.TECHNOLOGY, techId: TechnologyId.HABITAT_FABRICATION }
  ],
  effects: {
    unlockBuilding: "immigration_center",
    populationBonus: 3,
  },
  onCompletionEffects: [
    {
      type: ProjectEffectType.RECURRING_EVENT,
      name: "Immigration Wave",
      description: "New settlers arrive every 10 sols",
      params: { eventType: "immigration", intervalSols: 10 }
    },
    {
      type: ProjectEffectType.PRODUCTION_MODIFIER,
      name: "Settlement Supplies",
      description: "+5 materials/sol for housing construction",
      params: { resource: "materials", amount: 5 }
    },
    {
      type: ProjectEffectType.CONVICTION_BOOST,
      name: "Renewed Hope",
      description: "Earth Loyalists feel vindicated",
      params: { faction: NPCFaction.EarthLoyalists, amount: 0.1 }
    },
  ],
}
```

### Balance Rationale
- Habitat Module costs 50 materials, houses 6 colonists
- Immigration event every 10 sols brings ~3-5 colonists
- Materials bonus: 5/sol × 10 sols = 50 materials = 1 habitat
- Each immigration wave comes with enough materials to build housing

## Effect Processing

### RecurringEventScheduler (New System)

```typescript
interface ScheduledEvent {
  projectId: ProjectId;
  eventType: string;
  intervalSols: number;
  nextTriggerSol: number;
  params?: Record<string, unknown>;
}

class RecurringEventScheduler {
  private scheduled: ScheduledEvent[] = [];

  register(projectId: ProjectId, params: RecurringEventParams, currentSol: number): void;
  tick(currentSol: number): GameEvent[];
  toJSON(): object;
  static fromJSON(data: object): RecurringEventScheduler;
}
```

### Effect Processing Flow

1. Project passes council vote
2. `processCompletionEffects(project, gameState)` iterates `onCompletionEffects`
3. Each effect type dispatches to appropriate system:
   - `RECURRING_EVENT` → `RecurringEventScheduler.register()`
   - `PRODUCTION_MODIFIER` → `ResourceManager.addProductionBonus()`
   - `CONVICTION_BOOST` → `IdeologyManager.boostFactionConviction()`
4. Systems update their state accordingly

### Requirements Checking

`IdeologyManager.canProposeProject()` checks requirements:
- TECHNOLOGY: `TechnologyTree.isResearched(techId)`
- BUILDING: `BuildingManager.getActiveCount(buildingId) >= count`
- POPULATION: `ColonyManager.getPopulation() >= min`
- RESOURCE: `ResourceManager.getResources()[resource] >= min`

## Files to Modify

| File | Changes |
|------|---------|
| `src/core/models/NPCInfluence.ts` | Add `ProjectRequirement` types, new `ProjectEffectType` values, param interfaces |
| `src/core/models/Technology.ts` | Rename `ADVANCED_MATERIALS` → `HABITAT_FABRICATION` |
| `src/core/data/technologies.ts` | Update tech definition name/description, update dependents |
| `src/core/data/projects.ts` | Add requirements and onCompletionEffects to Immigration Program |
| `src/core/systems/IdeologyManager.ts` | Check requirements in `canProposeProject()`, process conviction boost |
| `src/core/systems/RecurringEventScheduler.ts` | **New file** - manages scheduled recurring events |
| `src/core/systems/ResourceManager.ts` | Handle production modifier effects (add bonus tracking) |
| `src/core/GameState.ts` | Integrate RecurringEventScheduler, wire up effect processing |

## Test Coverage

- Requirements checking (tech, building, population, resource)
- Each effect type processing
- RecurringEventScheduler tick behavior
- Immigration Program integration test
- Tech tree rename doesn't break existing saves
