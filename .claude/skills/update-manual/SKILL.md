---
name: update-manual
description: Update the player manual (MANUAL.md) when new game features are created or existing features are modified
---

# Update Manual

## Overview

Updates the player manual (MANUAL.md) to reflect new game features, balance changes, or mechanic modifications. Ensures documentation stays synchronized with the codebase.

**Announce at start:** "I'm using update-manual to synchronize the player manual with recent changes."

## When to Use

- After implementing a new game feature (building, technology, event, etc.)
- After modifying game balance (resource rates, costs, timings)
- After changing victory/defeat conditions
- After adding new game systems (policies, operations, etc.)
- After modifying existing mechanics
- When the user says "update the manual" or "document this feature"
- Proactively after completing feature implementation

## Workflow

### Step 1: Identify Changes

Determine what has changed by checking one or more sources:

```bash
# Check recent commits for feature changes
git log --oneline -20

# Check unstaged changes
git diff --stat

# Check staged changes
git diff --cached --stat
```

If the user specifies what changed, use that information directly.

### Step 2: Gather Feature Details

Read the relevant source files to understand the new/modified feature:

**For new buildings:**
- Read `src/core/data/buildings.ts` for building definitions
- Check cost, production, consumption, workers, capacity, requirements

**For new technologies:**
- Read `src/core/data/technologies.ts` for tech tree
- Check research time, prerequisites, unlocks, bonuses

**For new events:**
- Read `src/core/data/events.ts` for event definitions
- Check triggers, choices, outcomes

**For balance changes:**
- Read `src/core/balance/` for constants
- Check resource rates, colonist consumption, timings

**For new systems:**
- Read relevant files in `src/core/systems/`
- Understand mechanics, interactions, player actions

**For political changes:**
- Read `src/core/data/factions.ts` for faction data
- Read `src/core/data/npcs.ts` for NPC information

### Step 3: Read Current Manual

```
Read /workspace/MANUAL.md
```

Understand the current structure and find where updates belong.

### Step 4: Update Manual Sections

Edit MANUAL.md to incorporate changes. Follow these guidelines:

**Maintain Consistency:**
- Match existing formatting (tables, headers, bullet points)
- Keep the same tone (engaging but informative)
- Use consistent terminology

**Section Mapping:**

| Change Type | Manual Section(s) to Update |
|-------------|----------------------------|
| New building | Buildings > appropriate category |
| New technology | Technology > appropriate tier |
| New event | Events > appropriate type |
| Balance change | Relevant section + Quick Reference if applicable |
| New resource | Resources section |
| New policy | Operations > Colony Policies |
| New expedition type | Operations > Expeditions |
| Victory/defeat change | Victory & Defeat section |
| New colonist role | Workforce & Colonists > Roles |
| New skill | Workforce & Colonists > Skills |
| Political changes | Politics section |

**Update Strategy Guide if needed:**
- If the change affects early/mid/late game strategy
- If the change introduces new player decisions
- If the change modifies recommended approaches

**Update Quick Reference if needed:**
- Key thresholds
- Important numbers players need to remember
- Consumption/production rates

### Step 5: Verify Accuracy

After editing, verify the manual is accurate:

1. Cross-reference numbers with source code
2. Ensure all new features are documented
3. Check that removed features are no longer mentioned
4. Verify technology prerequisites match the tech tree
5. Confirm building costs and effects are correct

## Example: Adding a New Building

If a new building "Oxygen Generator" was added:

1. **Read the building data:**
   ```
   Read src/core/data/buildings.ts
   ```
   Find: `{ id: 'oxygen_generator', cost: 80, production: { oxygen: 15 }, requires: 'atmospheric_processing' }`

2. **Read current manual:**
   ```
   Read /workspace/MANUAL.md
   ```

3. **Edit the appropriate section:**
   - Add to "Advanced Buildings" table if it requires technology
   - Add technology to Tech Tree if new
   - Update Strategy Guide if it changes optimal play

4. **Verify numbers match source code**

## Example: Balance Change

If colonist food consumption changed from 0.5 to 0.4:

1. **Update "Resources" section** - colonist consumption description
2. **Update "Colony Management" section** - consumption list
3. **Update "Quick Reference"** - Colonist Consumption table
4. **Update "Getting Started"** - initial consumption calculations
5. **Update "Strategy Guide"** - if it affects early game math

## Output

After completing updates, summarize:

```
## Manual Updated

**Changes made:**
- Added [feature] to [section]
- Updated [values] in [section]
- Modified [strategy advice] in Strategy Guide

**Sections modified:**
- [List of sections]

**Verification:**
- All numbers cross-referenced with source code
- No orphaned references to removed features
```

## Important Notes

- Always read the source code to get accurate values - never guess
- Keep the manual player-friendly, not developer-focused
- Preserve the existing structure unless a major reorganization is needed
- Include new features in the Table of Contents if adding new sections
- Test that markdown renders correctly (tables, headers, lists)
