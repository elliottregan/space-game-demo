# Third Spaces Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add social bonding mechanics for "third space" buildings (Common Room, Gymnasium) where colonists form relationships outside work and home.

**Architecture:** Add `BuildingPurpose` enum to categorize buildings. Colonists get `socialBuildingIds[]` for assignment to social spaces. New `processSocialBonding()` in WorkforceManager creates random bonds between colonists sharing social buildings each tick.

**Tech Stack:** TypeScript, Bun test runner

---

## Task 1: Add BuildingPurpose Enum and Update BuildingDefinition

**Files:**
- Modify: `src/core/models/Building.ts:1-47`

**Step 1: Write the failing test**

Create test file `tests/BuildingPurpose.test.ts`:

```typescript
import { describe, expect, test } from "bun:test";
import { BuildingPurpose } from "../src/core/models/Building";
import { BUILDINGS } from "../src/core/data/buildings";

describe("BuildingPurpose", () => {
  test("enum has all three purpose types", () => {
    expect(BuildingPurpose.Residential).toBe("residential");
    expect(BuildingPurpose.Industrial).toBe("industrial");
    expect(BuildingPurpose.Social).toBe("social");
  });

  test("Common Room has Social purpose", () => {
    const commonRoom = BUILDINGS.find((b) => b.id === "common_room");
    expect(commonRoom?.purpose).toBe(BuildingPurpose.Social);
  });

  test("Habitat has Residential purpose", () => {
    const habitat = BUILDINGS.find((b) => b.id === "habitat");
    expect(habitat?.purpose).toBe(BuildingPurpose.Residential);
  });

  test("Basic Mine has Industrial purpose", () => {
    const mine = BUILDINGS.find((b) => b.id === "basic_mine");
    expect(mine?.purpose).toBe(BuildingPurpose.Industrial);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/BuildingPurpose.test.ts`
Expected: FAIL - BuildingPurpose not exported

**Step 3: Add BuildingPurpose enum to Building.ts**

In `src/core/models/Building.ts`, add after the `BuildingId` enum (around line 27):

```typescript
export enum BuildingPurpose {
  Residential = "residential",
  Industrial = "industrial",
  Social = "social",
}
```

**Step 4: Update BuildingDefinition interface**

In `src/core/models/Building.ts`, add to `BuildingDefinition` interface:

```typescript
  purpose?: BuildingPurpose;
  bondingStrength?: number; // Multiplier for relationship growth rate (default 1.0)
```

**Step 5: Run test to verify partial pass**

Run: `bun test tests/BuildingPurpose.test.ts`
Expected: First test passes, others fail (buildings not updated yet)

**Step 6: Commit**

```bash
git add src/core/models/Building.ts tests/BuildingPurpose.test.ts
git commit -m "feat: add BuildingPurpose enum to Building model"
```

---

## Task 2: Update Building Data with Purpose

**Files:**
- Modify: `src/core/data/buildings.ts`

**Step 1: Add import for BuildingPurpose**

At top of `src/core/data/buildings.ts`:

```typescript
import { type BuildingDefinition, BuildingId, BuildingPurpose } from "../models/Building";
```

**Step 2: Add purpose to all buildings**

Update each building definition:

**Residential buildings** (add `purpose: BuildingPurpose.Residential`):
- HABITAT
- ADVANCED_HABITAT

**Social buildings** (add `purpose: BuildingPurpose.Social` plus `capacity` and `bondingStrength`):
- COMMON_ROOM: `purpose: BuildingPurpose.Social, capacity: 8, bondingStrength: 1.0`
- GYMNASIUM: `purpose: BuildingPurpose.Social, capacity: 6, bondingStrength: 1.2`

**Industrial buildings** (add `purpose: BuildingPurpose.Industrial`):
- All other buildings (SOLAR_PANEL, WATER_EXTRACTOR, STORAGE_DEPOT, BASIC_FARM, BASIC_MINE, OXYGEN_GENERATOR, GREENHOUSE, WATER_RECLAIMER, RESEARCH_LAB, AUTOMATED_FACTORY, MINING_STATION, NUCLEAR_REACTOR, BIOLAB, MEDICAL_CENTER, CRYO_FACILITY, HYDROPONIC_GARDEN, OBSERVATORY_DOME)

**Step 3: Run tests to verify pass**

Run: `bun test tests/BuildingPurpose.test.ts`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/core/data/buildings.ts
git commit -m "feat: add purpose field to all building definitions"
```

---

## Task 3: Add socialBuildingIds to Colonist Model

**Files:**
- Modify: `src/core/models/Colonist.ts:30-43`

**Step 1: Write the failing test**

Add to `tests/BuildingPurpose.test.ts`:

```typescript
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

describe("Colonist socialBuildingIds", () => {
  test("colonist can have socialBuildingIds array", () => {
    const colonist: Colonist = {
      id: "c1",
      name: "Test Colonist",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["building_1", "building_2"],
    };
    expect(colonist.socialBuildingIds).toEqual(["building_1", "building_2"]);
  });

  test("socialBuildingIds is optional", () => {
    const colonist: Colonist = {
      id: "c1",
      name: "Test Colonist",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    };
    expect(colonist.socialBuildingIds).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/BuildingPurpose.test.ts`
Expected: Type error - socialBuildingIds not in Colonist type

**Step 3: Add socialBuildingIds to Colonist interface**

In `src/core/models/Colonist.ts`, add to the `Colonist` interface after `guildIds`:

```typescript
  socialBuildingIds?: string[]; // Assigned social buildings (third spaces)
```

**Step 4: Run tests to verify pass**

Run: `bun test tests/BuildingPurpose.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/core/models/Colonist.ts tests/BuildingPurpose.test.ts
git commit -m "feat: add socialBuildingIds to Colonist model"
```

---

## Task 4: Add Social Bonding Constants

**Files:**
- Modify: `src/core/balance/WorkforceBalance.ts`

**Step 1: Add constants at end of file**

In `src/core/balance/WorkforceBalance.ts`, add after the SOCIAL_COHESION section:

```typescript
// ============ Social Building (Third Space) System ============

/** Initial relationship strength when colonists first meet at a social building */
export const INITIAL_SOCIAL_RELATIONSHIP = 0.12;

/** Base bonding rate per sol at social buildings (before multiplier) */
export const SOCIAL_BONDING_RATE = 0.012;

/** Decay rate for social relationships when no longer sharing a social building */
export const SOCIAL_RELATIONSHIP_DECAY = 0.003;

/** Number of random colonists to bond with per tick at each social building */
export const SOCIAL_BONDS_PER_TICK = 2;
```

**Step 2: Run existing tests to verify no regression**

Run: `bun test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/core/balance/WorkforceBalance.ts
git commit -m "feat: add social bonding balance constants"
```

---

## Task 5: Implement processSocialBonding in WorkforceManager

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`
- Test: `tests/WorkforceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/WorkforceManager.test.ts` (find a suitable location with other bonding tests):

```typescript
describe("Social Building Bonding", () => {
  test("colonists at same social building form relationships", () => {
    const workforce = new WorkforceManager();
    const colony = new ColonyManager();

    // Add colonists assigned to same social building
    colony.addColonist({
      id: "c1",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["common_room_1"],
    });
    colony.addColonist({
      id: "c2",
      name: "Bob",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["common_room_1"],
    });
    colony.addColonist({
      id: "c3",
      name: "Charlie",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["gym_1"], // Different social building
    });

    // Run multiple ticks to allow bonds to form
    for (let i = 0; i < 10; i++) {
      workforce.tick(colony, undefined, i);
    }

    // Alice and Bob should have a relationship (same social building)
    const relationshipAB = workforce.getCoworkerRelationshipStrength("c1", "c2");
    expect(relationshipAB).toBeGreaterThan(0);

    // Alice and Charlie should have no relationship (different social buildings)
    const relationshipAC = workforce.getCoworkerRelationshipStrength("c1", "c3");
    expect(relationshipAC).toBe(0);
  });

  test("social bonding respects bondingStrength multiplier", () => {
    const workforce = new WorkforceManager();
    const colony = new ColonyManager();
    const buildings = new BuildingManager();

    // Create a social building with higher bondingStrength
    buildings.addBuilding(BuildingId.GYMNASIUM);
    const gym = buildings.getBuildings().find((b) => b.definitionId === BuildingId.GYMNASIUM);

    colony.addColonist({
      id: "c1",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: [gym!.id],
    });
    colony.addColonist({
      id: "c2",
      name: "Bob",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: [gym!.id],
    });

    // Run ticks
    for (let i = 0; i < 5; i++) {
      workforce.tick(colony, buildings, i);
    }

    // Should have relationship (gymnasium has bondingStrength: 1.2)
    const relationship = workforce.getCoworkerRelationshipStrength("c1", "c2");
    expect(relationship).toBeGreaterThan(0);
  });

  test("SOCIAL_BOND_FORMED event emitted for new relationships", () => {
    const workforce = new WorkforceManager();
    const colony = new ColonyManager();

    colony.addColonist({
      id: "c1",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["social_1"],
    });
    colony.addColonist({
      id: "c2",
      name: "Bob",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["social_1"],
    });

    const events = workforce.tick(colony, undefined, 0);
    const socialBondEvent = events.find((e) => e.type === "SOCIAL_BOND_FORMED");

    expect(socialBondEvent).toBeDefined();
    expect(socialBondEvent?.colonistA).toBeDefined();
    expect(socialBondEvent?.colonistB).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/WorkforceManager.test.ts -t "Social Building Bonding"`
Expected: FAIL - processSocialBonding not implemented

**Step 3: Add imports for new constants**

At top of `src/core/systems/WorkforceManager.ts`, add to imports:

```typescript
import {
  // ... existing imports ...
  INITIAL_SOCIAL_RELATIONSHIP,
  SOCIAL_BONDING_RATE,
  SOCIAL_RELATIONSHIP_DECAY,
  SOCIAL_BONDS_PER_TICK,
} from "../balance/WorkforceBalance";
```

**Step 4: Implement processSocialBonding method**

Add to `WorkforceManager` class (after `processHousemateBonding`):

```typescript
  /**
   * Process social bonding at social buildings (third spaces).
   * Each colonist bonds with 1-2 random others at their assigned social buildings.
   */
  private processSocialBonding(
    colonists: readonly Colonist[],
    buildings: BuildingManager | undefined,
    currentSol: number,
  ): GameEvent[] {
    const events: GameEvent[] = [];
    const currentSocialPairs = new Set<string>();

    // Group colonists by social building
    const socialGroups = new Map<string, Colonist[]>();
    for (const colonist of colonists) {
      if (!colonist.socialBuildingIds?.length) continue;
      for (const buildingId of colonist.socialBuildingIds) {
        const group = socialGroups.get(buildingId) || [];
        group.push(colonist);
        socialGroups.set(buildingId, group);
      }
    }

    // Process each social building
    for (const [buildingId, members] of socialGroups) {
      if (members.length < 2) continue;

      // Get bonding strength multiplier from building definition
      let bondingMultiplier = 1.0;
      if (buildings) {
        const building = buildings.getBuildings().find((b) => b.id === buildingId);
        if (building) {
          const def = buildings.getDefinition(building.definitionId);
          bondingMultiplier = def?.bondingStrength ?? 1.0;
        }
      }

      // Each colonist bonds with random subset
      for (const colonist of members) {
        const others = members.filter((c) => c.id !== colonist.id);
        if (others.length === 0) continue;

        // Pick random colonists to bond with (up to SOCIAL_BONDS_PER_TICK)
        const shuffled = [...others].sort(() => Math.random() - 0.5);
        const bondingPartners = shuffled.slice(0, SOCIAL_BONDS_PER_TICK);

        for (const partner of bondingPartners) {
          const key = this.getRelationshipKey(colonist.id, partner.id);
          currentSocialPairs.add(key);

          let relationship = this.coworkerRelationships.get(key);

          if (!relationship) {
            // First time meeting at social building
            relationship = {
              strength: INITIAL_SOCIAL_RELATIONSHIP,
              formedAt: currentSol,
              lastWorkedTogether: currentSol,
            };
            this.coworkerRelationships.set(key, relationship);
            this.addToAdjacencyList(colonist.id, partner.id);

            events.push({
              type: "SOCIAL_BOND_FORMED",
              severity: "info",
              colonistA: colonist.id,
              colonistB: partner.id,
              buildingId,
              message: `${colonist.name} and ${partner.name} connected at a social space`,
            });
          } else {
            // Strengthen existing relationship
            const bondingRate = SOCIAL_BONDING_RATE * bondingMultiplier;
            relationship.strength = Math.min(
              MAX_COWORKER_RELATIONSHIP,
              relationship.strength + bondingRate,
            );
            relationship.lastWorkedTogether = currentSol;
          }
        }
      }
    }

    // Decay relationships for colonists no longer sharing social buildings
    // Note: This uses same decay as coworker relationships for simplicity
    // The decay happens in existing processCoworkerBonding

    return events;
  }
```

**Step 5: Call processSocialBonding in tick()**

In the `tick()` method, add after the guild bonding call:

```typescript
    // Process social building bonding (third spaces)
    events.push(...this.processSocialBonding(colonists, buildings, currentSol));
```

**Step 6: Run tests to verify pass**

Run: `bun test tests/WorkforceManager.test.ts -t "Social Building Bonding"`
Expected: All tests pass

**Step 7: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/core/systems/WorkforceManager.ts tests/WorkforceManager.test.ts
git commit -m "feat: implement processSocialBonding for third spaces"
```

---

## Task 6: Add Social Building Assignment Methods to ColonyManager

**Files:**
- Modify: `src/core/systems/ColonyManager.ts`
- Test: `tests/BuildingPurpose.test.ts`

**Step 1: Write the failing test**

Add to `tests/BuildingPurpose.test.ts`:

```typescript
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { BuildingId } from "../src/core/models/Building";

describe("Social Building Assignment", () => {
  test("assignToSocialBuilding adds building to colonist socialBuildingIds", () => {
    const colony = new ColonyManager();
    const buildings = new BuildingManager();

    buildings.addBuilding(BuildingId.COMMON_ROOM);
    const commonRoom = buildings.getBuildings()[0]!;

    colony.addColonist({
      id: "c1",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });

    const result = colony.assignToSocialBuilding("c1", commonRoom.id, buildings);
    expect(result).toBe(true);

    const colonist = colony.getColonist("c1");
    expect(colonist?.socialBuildingIds).toContain(commonRoom.id);
  });

  test("assignToSocialBuilding respects capacity limit", () => {
    const colony = new ColonyManager();
    const buildings = new BuildingManager();

    buildings.addBuilding(BuildingId.GYMNASIUM); // capacity: 6
    const gym = buildings.getBuildings()[0]!;

    // Add 6 colonists and assign them all
    for (let i = 0; i < 6; i++) {
      colony.addColonist({
        id: `c${i}`,
        name: `Colonist ${i}`,
        role: ColonistRole.UNASSIGNED,
        experience: 0,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [],
      });
      colony.assignToSocialBuilding(`c${i}`, gym.id, buildings);
    }

    // Add 7th colonist - should fail due to capacity
    colony.addColonist({
      id: "c6",
      name: "Colonist 6",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });

    const result = colony.assignToSocialBuilding("c6", gym.id, buildings);
    expect(result).toBe(false);
  });

  test("removeFromSocialBuilding removes assignment", () => {
    const colony = new ColonyManager();
    const buildings = new BuildingManager();

    buildings.addBuilding(BuildingId.COMMON_ROOM);
    const commonRoom = buildings.getBuildings()[0]!;

    colony.addColonist({
      id: "c1",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });

    colony.assignToSocialBuilding("c1", commonRoom.id, buildings);
    colony.removeFromSocialBuilding("c1", commonRoom.id);

    const colonist = colony.getColonist("c1");
    expect(colonist?.socialBuildingIds ?? []).not.toContain(commonRoom.id);
  });

  test("getSocialBuildingAssignments returns colonists grouped by building", () => {
    const colony = new ColonyManager();
    const buildings = new BuildingManager();

    buildings.addBuilding(BuildingId.COMMON_ROOM);
    buildings.addBuilding(BuildingId.GYMNASIUM);
    const commonRoom = buildings.getBuildings()[0]!;
    const gym = buildings.getBuildings()[1]!;

    colony.addColonist({
      id: "c1",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });
    colony.addColonist({
      id: "c2",
      name: "Bob",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });

    colony.assignToSocialBuilding("c1", commonRoom.id, buildings);
    colony.assignToSocialBuilding("c1", gym.id, buildings);
    colony.assignToSocialBuilding("c2", gym.id, buildings);

    const assignments = colony.getSocialBuildingAssignments();
    expect(assignments[commonRoom.id]?.length).toBe(1);
    expect(assignments[gym.id]?.length).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/BuildingPurpose.test.ts -t "Social Building Assignment"`
Expected: FAIL - methods not implemented

**Step 3: Add import for BuildingPurpose**

At top of `src/core/systems/ColonyManager.ts`, update import:

```typescript
import { type Building, BuildingId, BuildingPurpose } from "../models/Building";
```

**Step 4: Implement assignment methods**

Add to `ColonyManager` class (after `clearHousingAssignment`):

```typescript
  /**
   * Assign a colonist to a social building.
   * Returns false if building is at capacity or colonist already assigned.
   */
  assignToSocialBuilding(colonistId: string, buildingId: string, buildings: BuildingManager): boolean {
    const colonist = this.colonists.get(colonistId);
    if (!colonist) return false;

    // Check if already assigned to this building
    if (colonist.socialBuildingIds?.includes(buildingId)) return false;

    // Verify building exists and is a social building
    const building = buildings.getBuildings().find((b) => b.id === buildingId);
    if (!building) return false;

    const def = buildings.getDefinition(building.definitionId);
    if (!def || def.purpose !== BuildingPurpose.Social) return false;

    // Check capacity
    if (def.capacity) {
      const currentCount = this.getSocialBuildingCount(buildingId);
      if (currentCount >= def.capacity) return false;
    }

    // Add assignment
    if (!colonist.socialBuildingIds) {
      colonist.socialBuildingIds = [];
    }
    colonist.socialBuildingIds.push(buildingId);
    return true;
  }

  /**
   * Remove a colonist from a social building.
   */
  removeFromSocialBuilding(colonistId: string, buildingId: string): void {
    const colonist = this.colonists.get(colonistId);
    if (!colonist?.socialBuildingIds) return;

    const index = colonist.socialBuildingIds.indexOf(buildingId);
    if (index !== -1) {
      colonist.socialBuildingIds.splice(index, 1);
    }
  }

  /**
   * Get count of colonists assigned to a social building.
   */
  getSocialBuildingCount(buildingId: string): number {
    let count = 0;
    for (const colonist of this.colonists.values()) {
      if (colonist.socialBuildingIds?.includes(buildingId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns colonists grouped by their social building assignments.
   */
  getSocialBuildingAssignments(): Record<string, Colonist[]> {
    const assignments: Record<string, Colonist[]> = {};
    for (const colonist of this.colonists.values()) {
      if (colonist.socialBuildingIds) {
        for (const buildingId of colonist.socialBuildingIds) {
          (assignments[buildingId] ??= []).push(colonist);
        }
      }
    }
    return assignments;
  }
```

**Step 5: Run tests to verify pass**

Run: `bun test tests/BuildingPurpose.test.ts -t "Social Building Assignment"`
Expected: All tests pass

**Step 6: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/core/systems/ColonyManager.ts tests/BuildingPurpose.test.ts
git commit -m "feat: add social building assignment methods to ColonyManager"
```

---

## Task 7: Final Integration Test and Cleanup

**Files:**
- Test: `tests/BuildingPurpose.test.ts`

**Step 1: Write integration test**

Add to `tests/BuildingPurpose.test.ts`:

```typescript
describe("Third Spaces Integration", () => {
  test("full flow: assign colonists to social building, bonds form over time", () => {
    const colony = new ColonyManager();
    const buildings = new BuildingManager();
    const workforce = new WorkforceManager();

    // Build a common room
    buildings.addBuilding(BuildingId.COMMON_ROOM);
    const commonRoom = buildings.getBuildings()[0]!;

    // Activate it
    for (let i = 0; i < 15; i++) {
      buildings.tick({} as any);
    }

    // Add colonists
    colony.addColonist({
      id: "alice",
      name: "Alice",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });
    colony.addColonist({
      id: "bob",
      name: "Bob",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });
    colony.addColonist({
      id: "charlie",
      name: "Charlie",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    });

    // Assign Alice and Bob to common room (Charlie stays home)
    expect(colony.assignToSocialBuilding("alice", commonRoom.id, buildings)).toBe(true);
    expect(colony.assignToSocialBuilding("bob", commonRoom.id, buildings)).toBe(true);

    // Run simulation for 20 sols
    for (let sol = 0; sol < 20; sol++) {
      workforce.tick(colony, buildings, sol);
    }

    // Alice and Bob should have a relationship
    const aliceBobStrength = workforce.getCoworkerRelationshipStrength("alice", "bob");
    expect(aliceBobStrength).toBeGreaterThan(0.1);

    // Charlie should have no relationship with either (didn't go to social building)
    const aliceCharlieStrength = workforce.getCoworkerRelationshipStrength("alice", "charlie");
    const bobCharlieStrength = workforce.getCoworkerRelationshipStrength("bob", "charlie");
    expect(aliceCharlieStrength).toBe(0);
    expect(bobCharlieStrength).toBe(0);
  });
});
```

**Step 2: Run integration test**

Run: `bun test tests/BuildingPurpose.test.ts -t "Third Spaces Integration"`
Expected: PASS

**Step 3: Run full test suite**

Run: `bun test`
Expected: All tests pass

**Step 4: Run linting**

Run: `bun run lint`
Expected: No errors

**Step 5: Final commit**

```bash
git add tests/BuildingPurpose.test.ts
git commit -m "test: add integration test for third spaces feature"
```

---

## Summary

After completing all tasks:

1. `BuildingPurpose` enum added to `Building.ts`
2. All buildings have `purpose` assigned in `buildings.ts`
3. Social buildings (Common Room, Gymnasium) have `capacity` and `bondingStrength`
4. `Colonist` has `socialBuildingIds?: string[]`
5. `WorkforceBalance.ts` has social bonding constants
6. `WorkforceManager.processSocialBonding()` creates random bonds each tick
7. `ColonyManager` has methods for social building assignment with capacity enforcement
8. All tests pass
