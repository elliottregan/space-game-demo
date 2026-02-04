# Victory Narrative Redesign

**Date:** 2026-02-04
**Status:** Implemented

## Overview

Redesigned the project narratives for Earth Loyalists and Corporate Interests factions to tell more coherent stories that logically connect prerequisites → capstone → megastructure.

## Changes

### Earth Loyalists Path

**Old narrative:** Vague connection between memorial/archive/immigration → "Return Mission" → Space Elevator

**New narrative:** Mars helps Earth by relieving overpopulation through mass immigration

| Step | Project | Story Beat |
|------|---------|------------|
| Prereq 1 | Earth Memorial | Honor immigrants' sacrifice in leaving home |
| Prereq 2 | Heritage Archive | Preserve their cultures so they feel welcome |
| Prereq 3 | Immigration Program | Actively welcome people from overcrowded Earth |
| Capstone | **Earth Relief Compact** | Commit to mass resettlement via treaty |
| Victory | Space Elevator | Enable migration at scale |

**Updated descriptions:**
- Earth Memorial: "Build a memorial honoring the courage of those who left everything behind to start anew on Mars."
- Heritage Archive: "Preserve Earth's diverse cultures and traditions, helping immigrants feel at home on Mars."
- Earth Relief Compact: "Sign a formal treaty committing Mars to relieve Earth's overpopulation crisis through sustained mass immigration."
- Space Elevator: "A tether to orbit enabling cheap, mass transportation between Earth and Mars. The gateway for humanity's great migration."

### Corporate Interests Path

**Old narrative:** AI governance/mining/labor efficiency → "Planetary Acquisition" (shareholders own Mars) → Generation Ship (leave for stars) — made no sense

**New narrative:** Corporations invest in Mars, build space infrastructure, then capture asteroid resources for permanent dominance

| Step | Project | Story Beat |
|------|---------|------------|
| Prereq 1 | Venture Capital Initiative | Attract Earth investment |
| Prereq 2 | Orbital Infrastructure | Build space capability |
| Prereq 3 | Asteroid Survey Program | Map valuable targets |
| Capstone | **Deep Space Mining Charter** | Authorize corporate asteroid operations |
| Victory | **Asteroid Mining Platform** | Control solar system's resources |

**New projects:**
- Venture Capital Initiative: "Establish investment channels to attract Earth capital for Martian expansion."
- Orbital Infrastructure: "Build launch facilities and orbital stations to enable space-based operations."
- Asteroid Survey Program: "Map and catalog near-Mars asteroids for their mineral wealth."
- Deep Space Mining Charter: "Secure an official charter granting corporations exclusive rights to deep space mining operations."
- Asteroid Mining Platform: "A massive orbital station that captures and processes asteroids. Infinite resources mean infinite profit and permanent corporate dominance."

### Mars Independence Path

**Unchanged** - the existing narrative already made sense:
Universal Housing → Healthcare → Democratic Assembly → Declaration of Sovereignty → United Mars Station

## Files Modified

### Core Models
- `src/core/models/NPCInfluence.ts` - Updated ProjectId enum
- `src/core/models/Building.ts` - Updated BuildingId enum (GENERATION_SHIP → ASTEROID_MINING_PLATFORM)
- `src/core/models/Project.ts` - Updated ProjectId enum (duplicate file)
- `src/core/models/Technology.ts` - Updated TechnologyId enum

### Data Files
- `src/core/data/projects.ts` - Updated all project definitions
- `src/core/data/buildings.ts` - Updated megastructure definitions
- `src/core/data/technologies.ts` - Updated Asteroid Mining Platform tech

### Simulation
- `src/simulation/types.ts` - Updated VictoryType union
- `src/simulation/MetricsCollector.ts` - Updated display names
- `src/simulation/SimulationRunner.ts` - Updated victory type mapping
- `src/simulation/simulation.worker.ts` - Updated victory type mapping
- `scripts/simulate.ts` - Updated victory type handling
- `src/simulation/HeuristicStrategy.ts` - Updated faction mappings

### Tests
- `tests/IdeologyManager.test.ts`
- `tests/VictoryManager.test.ts`
- `tests/VictoryMegastructures.test.ts`
- `tests/BuildingManager.test.ts`
- `tests/TechnologyTree.test.ts`
- `tests/simulation/MetricsCollector.test.ts`
- `tests/simulation/SimulationRunner.test.ts`
- `tests/simulation/types.test.ts`
