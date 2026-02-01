# Ideology Victory Projects Design

## Overview

Replace the current victory system with ideology-driven capstone projects. Each faction has a unique victory path achieved by passing prerequisite projects, gaining political dominance, and winning a capstone vote.

## Victory Paths

| Path | Type | Requirements |
|------|------|--------------|
| Colony Charter | Neutral | 50 pop, 60 morale, 3 techs, 100 sustained sols |
| Return Mission | Earth Loyalists | Pass 3 projects → 65% council → capstone vote |
| Declaration of Sovereignty | Mars Independence | Pass 3 projects → 65% council → capstone vote |
| Planetary Acquisition | Corporate Interests | Pass 3 projects → 65% council → capstone vote |

## Capstone Projects

### Return Mission (Earth Loyalists)

- **Description:** Launch a crewed mission back to Earth, proving Mars can sustain true interplanetary civilization.
- **Prerequisites:** Earth Memorial, Heritage Archive, Generation Ship
- **Proposal requirement:** 65% Earth Loyalist council support
- **On pass:** Immediate victory

### Declaration of Sovereignty (Mars Independence)

- **Description:** Formally declare Mars an independent nation, free from Earth jurisdiction.
- **Prerequisites:** Universal Housing Initiative, Healthcare Expansion, Democratic Assembly
- **Proposal requirement:** 65% Mars Independence council support
- **On pass:** Immediate victory

### Planetary Acquisition (Corporate Interests)

- **Description:** Take the colony public. Shareholders on Earth now own Mars.
- **Prerequisites:** Labor Efficiency Program, Mining Concession, AI-Assisted Governance
- **Proposal requirement:** 65% Corporate Interests council support
- **On pass:** Immediate victory

## New Content

### Democratic Assembly (Mars Independence prerequisite)

- **ID:** `DEMOCRATIC_ASSEMBLY`
- **Description:** Establish a formal democratic assembly where all colonists have a voice in governance.
- **Proposal cost:** 70 materials
- **Required support:** 35%
- **Effect:** Unlocks Assembly Hall building

### Assembly Hall (Building)

- **Type:** Social building
- **Effect:** Boosts morale for Mars Independence-aligned colonists
- **Unlocked by:** Democratic Assembly project

## Removed Victory Conditions

- Generation Ship tech victory
- 100 population victory

## System Changes

### IdeologyManager

- Track which projects have passed per faction
- `canProposeCapstone(faction)`: Returns true if all prerequisites passed AND faction has ≥65% council seats
- `getPassedProjects(faction)`: Returns list of passed project IDs
- Store capstone proposal state (proposed, voting, passed)

### VictoryManager

- Remove Generation Ship tech victory check
- Remove 100 population victory check
- Add listener for capstone project pass events
- When a capstone passes, trigger victory with faction-specific message

### Project Model

- Add `isCapstone: boolean` flag to Project interface
- Add `prerequisites: ProjectId[]` to capstone projects

### UI

- Politics panel shows capstone unlock progress (e.g., "2/3 projects passed")
- Capstone project visually distinct (different color/icon)
- Victory screen shows which ideology won

## Files to Modify

- `src/core/data/projects.ts` - Add 4 new projects, isCapstone flag, prerequisites field
- `src/core/models/NPCInfluence.ts` - Add new ProjectId enum values
- `src/core/systems/IdeologyManager.ts` - Capstone tracking and proposal logic
- `src/core/systems/VictoryManager.ts` - Remove old victories, add capstone victory triggers
- `src/core/data/buildings.ts` - Add Assembly Hall building
- Politics panel components - Capstone progress display
