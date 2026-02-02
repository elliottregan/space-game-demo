# Automatic Guild Formation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Colonists with strong relationships (≥0.7) and shared characteristics spontaneously form guilds every 10 sols.

**Architecture:** Add `processGuildFormation()` to WorkforceManager's tick cycle. Uses relationship strength graph to find eligible founder groups, determines guild type from shared traits, rolls probability accounting for existing memberships.

**Tech Stack:** TypeScript, Bun test runner

---

## Task 1: Add Balance Constants

**Files:**
- Modify: `src/core/balance/WorkforceBalance.ts:159` (after existing guild constants)

**Step 1: Add the constants**

Add after line 159 (after `GUILD_MORALE_BONUS`):

```typescript
// ============ Guild Formation System ============

/** Sols between guild formation checks */
export const GUILD_FORMATION_CHECK_INTERVAL = 10;

/** Minimum relationship strength for guild formation eligibility */
export const GUILD_FORMATION_RELATIONSHIP_THRESHOLD = 0.7;

/** Base probability of guild forming when eligible colonists found */
export const GUILD_FORMATION_BASE_PROBABILITY = 0.5;

/** Probability multiplier per existing guild membership (compounds) */
export const GUILD_FORMATION_MEMBERSHIP_PENALTY = 0.5;

/** Minimum colony population for guild formation */
export const GUILD_FORMATION_MIN_POPULATION = 4;
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add src/core/balance/WorkforceBalance.ts
git commit -m "feat(guilds): add formation balance constants"
```

---

## Task 2: Add getUsedGuildNames to GuildManager

**Files:**
- Modify: `src/core/systems/GuildManager.ts:102` (after `getGuild` method)
- Test: `tests/GuildManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/GuildManager.test.ts` before the `serialization` describe block:

```typescript
describe("getUsedGuildNames", () => {
  it("should return set of all guild names", () => {
    manager.createGuild("Alpha Guild", GuildType.SOCIAL, ["c1", "c2"], 10);
    manager.createGuild("Beta Guild", GuildType.PROFESSIONAL, ["c3", "c4"], 20);

    const names = manager.getUsedGuildNames();

    expect(names.has("Alpha Guild")).toBe(true);
    expect(names.has("Beta Guild")).toBe(true);
    expect(names.size).toBe(2);
  });

  it("should return empty set when no guilds exist", () => {
    const names = manager.getUsedGuildNames();
    expect(names.size).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GuildManager.test.ts`
Expected: FAIL with "getUsedGuildNames is not a function"

**Step 3: Write minimal implementation**

Add to `src/core/systems/GuildManager.ts` after `getGuild` method (around line 111):

```typescript
/**
 * Get all guild names currently in use.
 * Used to avoid duplicate names during guild formation.
 */
getUsedGuildNames(): Set<string> {
  const names = new Set<string>();
  for (const guild of this.guilds.values()) {
    names.add(guild.name);
  }
  return names;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GuildManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GuildManager.ts tests/GuildManager.test.ts
git commit -m "feat(guilds): add getUsedGuildNames helper"
```

---

## Task 3: Add Guild Type Determination Logic

**Files:**
- Create: `src/core/systems/workforce/guildFormation.ts`
- Test: `tests/GuildFormation.test.ts`

**Step 1: Write the failing test**

Create `tests/GuildFormation.test.ts`:

```typescript
// tests/GuildFormation.test.ts
import { describe, it, expect } from "bun:test";
import { determineGuildType, generateGuildName } from "../src/core/systems/workforce/guildFormation";
import { GuildType } from "../src/core/models/Guild";
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

const createColonist = (overrides: Partial<Colonist> = {}): Colonist => ({
  id: "test_1",
  name: "Test Colonist",
  role: ColonistRole.UNASSIGNED,
  experience: 0,
  masteryLevel: MasteryLevel.NOVICE,
  skills: [],
  ...overrides,
});

describe("determineGuildType", () => {
  it("should return PROFESSIONAL when all founders share a role", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
      createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.PROFESSIONAL);
  });

  it("should return RESEARCH when average mastery >= SKILLED", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.SKILLED }),
      createColonist({ id: "c2", role: ColonistRole.ENGINEERING, masteryLevel: MasteryLevel.EXPERT }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.RESEARCH);
  });

  it("should return SOCIAL when founders share arrival cohort", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.NOVICE, arrivalSol: 50 }),
      createColonist({ id: "c2", role: ColonistRole.ENGINEERING, masteryLevel: MasteryLevel.NOVICE, arrivalSol: 50 }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.SOCIAL);
  });

  it("should return CIVIC as fallback", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.NOVICE, arrivalSol: 10 }),
      createColonist({ id: "c2", role: ColonistRole.ENGINEERING, masteryLevel: MasteryLevel.NOVICE, arrivalSol: 100 }),
    ];

    expect(determineGuildType(founders)).toBe(GuildType.CIVIC);
  });

  it("should not return PROFESSIONAL for UNASSIGNED role", () => {
    const founders = [
      createColonist({ id: "c1", role: ColonistRole.UNASSIGNED }),
      createColonist({ id: "c2", role: ColonistRole.UNASSIGNED }),
    ];

    expect(determineGuildType(founders)).not.toBe(GuildType.PROFESSIONAL);
  });
});

describe("generateGuildName", () => {
  it("should generate a name from suggestions", () => {
    const usedNames = new Set<string>();
    const name = generateGuildName(GuildType.SOCIAL, usedNames);

    expect(name).toBeTruthy();
    expect(typeof name).toBe("string");
  });

  it("should append suffix for duplicate names", () => {
    const usedNames = new Set(["Movie Night Club", "Board Game Society", "Fitness Group", "Music Ensemble", "Book Club", "Cooking Circle"]);
    const name = generateGuildName(GuildType.SOCIAL, usedNames);

    expect(name).toMatch(/ II$/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GuildFormation.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

Create `src/core/systems/workforce/guildFormation.ts`:

```typescript
// src/core/systems/workforce/guildFormation.ts
import type { Colonist } from "../../models/Colonist";
import { ColonistRole, MasteryLevel } from "../../models/Colonist";
import { GuildType, GUILD_NAME_SUGGESTIONS } from "../../models/Guild";
import { COHORT_WINDOW_SOLS } from "../../balance/WorkforceBalance";
import { rng } from "../../utils/random";

/**
 * Determine guild type based on founder characteristics.
 * Priority: Professional > Research > Social > Civic
 */
export function determineGuildType(founders: readonly Colonist[]): GuildType {
  // 1. Professional: all founders share the same role (excluding UNASSIGNED)
  const roles = founders.map((f) => f.role);
  const firstRole = roles[0];
  if (firstRole !== ColonistRole.UNASSIGNED && roles.every((r) => r === firstRole)) {
    return GuildType.PROFESSIONAL;
  }

  // 2. Research: average mastery >= SKILLED (1)
  const avgMastery = founders.reduce((sum, f) => sum + f.masteryLevel, 0) / founders.length;
  if (avgMastery >= MasteryLevel.SKILLED) {
    return GuildType.RESEARCH;
  }

  // 3. Social: founders share arrival cohort (within COHORT_WINDOW_SOLS)
  const arrivalSols = founders.map((f) => f.arrivalSol ?? 0);
  const minArrival = Math.min(...arrivalSols);
  const maxArrival = Math.max(...arrivalSols);
  if (maxArrival - minArrival <= COHORT_WINDOW_SOLS) {
    return GuildType.SOCIAL;
  }

  // 4. Civic: default fallback
  return GuildType.CIVIC;
}

/**
 * Generate a guild name, avoiding duplicates.
 * Appends " II", " III" etc. if all suggestions are used.
 */
export function generateGuildName(type: GuildType, usedNames: Set<string>): string {
  const suggestions = GUILD_NAME_SUGGESTIONS[type];

  // Try to find an unused name
  const shuffled = rng.shuffle([...suggestions]);
  for (const name of shuffled) {
    if (!usedNames.has(name)) {
      return name;
    }
  }

  // All names used, append suffix to first suggestion
  const baseName = suggestions[0];
  let suffix = 2;
  while (usedNames.has(`${baseName} ${toRoman(suffix)}`)) {
    suffix++;
  }
  return `${baseName} ${toRoman(suffix)}`;
}

/** Convert number to Roman numeral (simple version for II, III, IV, V) */
function toRoman(n: number): string {
  const numerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return numerals[n] ?? n.toString();
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GuildFormation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/guildFormation.ts tests/GuildFormation.test.ts
git commit -m "feat(guilds): add type determination and name generation"
```

---

## Task 4: Add Founder Group Detection

**Files:**
- Modify: `src/core/systems/workforce/guildFormation.ts`
- Modify: `tests/GuildFormation.test.ts`

**Step 1: Write the failing test**

Add to `tests/GuildFormation.test.ts`:

```typescript
import { findEligibleFounderGroups } from "../src/core/systems/workforce/guildFormation";
import type { CoworkerRelationship } from "../src/core/systems/workforce/types";

describe("findEligibleFounderGroups", () => {
  const createRelationship = (strength: number): CoworkerRelationship => ({
    strength,
    formedAt: 0,
    lastWorkedTogether: 0,
  });

  it("should find a group of connected colonists above threshold", () => {
    const colonists = [
      createColonist({ id: "c1" }),
      createColonist({ id: "c2" }),
      createColonist({ id: "c3" }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
      ["c1:c3", createRelationship(0.75)],
      ["c2:c3", createRelationship(0.9)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0].length).toBe(3);
  });

  it("should exclude colonists at max guild memberships", () => {
    const colonists = [
      createColonist({ id: "c1", guildIds: ["g1", "g2", "g3"] }), // at max
      createColonist({ id: "c2" }),
      createColonist({ id: "c3" }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
      ["c2:c3", createRelationship(0.9)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    // c1 excluded, so only c2-c3 pair possible
    expect(groups.length).toBe(1);
    expect(groups[0]).not.toContain("c1");
  });

  it("should exclude pairs that already share a guild", () => {
    const colonists = [
      createColonist({ id: "c1", guildIds: ["shared_guild"] }),
      createColonist({ id: "c2", guildIds: ["shared_guild"] }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups.length).toBe(0);
  });

  it("should return empty when no relationships above threshold", () => {
    const colonists = [
      createColonist({ id: "c1" }),
      createColonist({ id: "c2" }),
    ];
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.5)], // below 0.7
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups.length).toBe(0);
  });

  it("should cap group size at 4", () => {
    const colonists = [
      createColonist({ id: "c1" }),
      createColonist({ id: "c2" }),
      createColonist({ id: "c3" }),
      createColonist({ id: "c4" }),
      createColonist({ id: "c5" }),
    ];
    // All strongly connected
    const relationships = new Map<string, CoworkerRelationship>([
      ["c1:c2", createRelationship(0.8)],
      ["c1:c3", createRelationship(0.8)],
      ["c1:c4", createRelationship(0.8)],
      ["c1:c5", createRelationship(0.8)],
      ["c2:c3", createRelationship(0.8)],
      ["c2:c4", createRelationship(0.8)],
      ["c2:c5", createRelationship(0.8)],
      ["c3:c4", createRelationship(0.8)],
      ["c3:c5", createRelationship(0.8)],
      ["c4:c5", createRelationship(0.8)],
    ]);

    const groups = findEligibleFounderGroups(colonists, relationships, 0.7);

    expect(groups[0].length).toBeLessThanOrEqual(4);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GuildFormation.test.ts`
Expected: FAIL with "findEligibleFounderGroups is not a function"

**Step 3: Write minimal implementation**

Add to `src/core/systems/workforce/guildFormation.ts`:

```typescript
import { MAX_GUILD_MEMBERSHIPS } from "../../balance/WorkforceBalance";
import type { CoworkerRelationship } from "./types";
import { getRelationshipKey } from "./socialGraph";

/**
 * Find groups of colonists eligible to form a guild.
 * Returns array of colonist ID arrays (founder groups).
 */
export function findEligibleFounderGroups(
  colonists: readonly Colonist[],
  relationships: Map<string, CoworkerRelationship>,
  threshold: number,
): string[][] {
  // Filter to eligible colonists (not at max memberships)
  const eligible = colonists.filter((c) => (c.guildIds?.length ?? 0) < MAX_GUILD_MEMBERSHIPS);

  if (eligible.length < 2) return [];

  // Build adjacency list of strong relationships
  const strongEdges = new Map<string, Set<string>>();

  for (const colonist of eligible) {
    strongEdges.set(colonist.id, new Set());
  }

  for (const [key, rel] of relationships) {
    if (rel.strength < threshold) continue;

    const [id1, id2] = key.split(":");
    if (!id1 || !id2) continue;

    // Both must be eligible
    const c1 = eligible.find((c) => c.id === id1);
    const c2 = eligible.find((c) => c.id === id2);
    if (!c1 || !c2) continue;

    // Skip if they already share a guild
    if (sharesGuild(c1, c2)) continue;

    strongEdges.get(id1)?.add(id2);
    strongEdges.get(id2)?.add(id1);
  }

  // Find connected components using BFS
  const visited = new Set<string>();
  const groups: string[][] = [];

  for (const colonist of eligible) {
    if (visited.has(colonist.id)) continue;

    const neighbors = strongEdges.get(colonist.id);
    if (!neighbors || neighbors.size === 0) continue;

    // BFS to find connected component
    const component: string[] = [];
    const queue = [colonist.id];

    while (queue.length > 0 && component.length < 4) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      component.push(current);

      const currentNeighbors = strongEdges.get(current);
      if (currentNeighbors) {
        for (const neighbor of currentNeighbors) {
          if (!visited.has(neighbor) && component.length < 4) {
            queue.push(neighbor);
          }
        }
      }
    }

    if (component.length >= 2) {
      groups.push(component);
    }
  }

  return groups;
}

/** Check if two colonists share any guild */
function sharesGuild(c1: Colonist, c2: Colonist): boolean {
  if (!c1.guildIds?.length || !c2.guildIds?.length) return false;
  return c1.guildIds.some((gId) => c2.guildIds?.includes(gId));
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GuildFormation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/guildFormation.ts tests/GuildFormation.test.ts
git commit -m "feat(guilds): add founder group detection"
```

---

## Task 5: Add Formation Probability Calculation

**Files:**
- Modify: `src/core/systems/workforce/guildFormation.ts`
- Modify: `tests/GuildFormation.test.ts`

**Step 1: Write the failing test**

Add to `tests/GuildFormation.test.ts`:

```typescript
import { calculateFormationProbability } from "../src/core/systems/workforce/guildFormation";

describe("calculateFormationProbability", () => {
  it("should return base probability for founders with no guilds", () => {
    const founders = [
      createColonist({ id: "c1" }),
      createColonist({ id: "c2" }),
    ];

    const prob = calculateFormationProbability(founders, 0.5, 0.5);

    expect(prob).toBe(0.5);
  });

  it("should apply penalty for each existing membership", () => {
    const founders = [
      createColonist({ id: "c1", guildIds: ["g1"] }), // 1 guild
      createColonist({ id: "c2" }), // 0 guilds
    ];

    const prob = calculateFormationProbability(founders, 0.5, 0.5);

    // 0.5 * 0.5 (c1's penalty) * 1.0 (c2 no penalty) = 0.25
    expect(prob).toBe(0.25);
  });

  it("should compound penalties for multiple memberships", () => {
    const founders = [
      createColonist({ id: "c1", guildIds: ["g1", "g2"] }), // 2 guilds
      createColonist({ id: "c2", guildIds: ["g3"] }), // 1 guild
    ];

    const prob = calculateFormationProbability(founders, 0.5, 0.5);

    // 0.5 * (0.5^2) * (0.5^1) = 0.5 * 0.25 * 0.5 = 0.0625
    expect(prob).toBeCloseTo(0.0625);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GuildFormation.test.ts`
Expected: FAIL with "calculateFormationProbability is not a function"

**Step 3: Write minimal implementation**

Add to `src/core/systems/workforce/guildFormation.ts`:

```typescript
/**
 * Calculate probability of guild formation based on founder memberships.
 * Each existing membership multiplies probability by penalty factor.
 */
export function calculateFormationProbability(
  founders: readonly Colonist[],
  baseProbability: number,
  membershipPenalty: number,
): number {
  let probability = baseProbability;

  for (const founder of founders) {
    const membershipCount = founder.guildIds?.length ?? 0;
    probability *= Math.pow(membershipPenalty, membershipCount);
  }

  return probability;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GuildFormation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/guildFormation.ts tests/GuildFormation.test.ts
git commit -m "feat(guilds): add formation probability calculation"
```

---

## Task 6: Add processGuildFormation to WorkforceManager

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`
- Modify: `tests/WorkforceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/WorkforceManager.test.ts` (find the workforce manager describe block and add inside):

```typescript
describe("guild formation", () => {
  it("should form guild when eligible colonists have strong relationships", () => {
    const manager = new WorkforceManager();
    const colonists: Colonist[] = [
      { id: "c1", name: "Alice", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c2", name: "Bob", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c3", name: "Carol", role: ColonistRole.FARMING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c4", name: "Dave", role: ColonistRole.RESEARCH, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
    ];

    // Create strong relationships between c1 and c2
    manager.createInitialRelationship("c1", "c2", 0.8);

    // Mock RNG to always succeed
    const originalChance = rng.chance;
    rng.chance = () => true;

    // Process at sol 10 (first check interval)
    const events = manager.processGuildFormation(colonists, 10);

    rng.chance = originalChance;

    expect(events.length).toBe(1);
    expect(events[0].type).toBe("GUILD_FORMED");
    expect(manager.getGuilds().length).toBe(1);
  });

  it("should not form guild before check interval", () => {
    const manager = new WorkforceManager();
    const colonists: Colonist[] = [
      { id: "c1", name: "Alice", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c2", name: "Bob", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c3", name: "Carol", role: ColonistRole.FARMING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c4", name: "Dave", role: ColonistRole.RESEARCH, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
    ];

    manager.createInitialRelationship("c1", "c2", 0.8);

    // Process at sol 5 (before interval)
    const events = manager.processGuildFormation(colonists, 5);

    expect(events.length).toBe(0);
  });

  it("should skip if population below minimum", () => {
    const manager = new WorkforceManager();
    const colonists: Colonist[] = [
      { id: "c1", name: "Alice", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c2", name: "Bob", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
    ];

    manager.createInitialRelationship("c1", "c2", 0.8);

    const events = manager.processGuildFormation(colonists, 10);

    expect(events.length).toBe(0);
  });

  it("should update colonist guildIds when guild forms", () => {
    const manager = new WorkforceManager();
    const colonists: Colonist[] = [
      { id: "c1", name: "Alice", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c2", name: "Bob", role: ColonistRole.ENGINEERING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c3", name: "Carol", role: ColonistRole.FARMING, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
      { id: "c4", name: "Dave", role: ColonistRole.RESEARCH, experience: 0, masteryLevel: MasteryLevel.NOVICE, skills: [] },
    ];

    manager.createInitialRelationship("c1", "c2", 0.8);

    const originalChance = rng.chance;
    rng.chance = () => true;

    manager.processGuildFormation(colonists, 10);

    rng.chance = originalChance;

    expect(colonists[0].guildIds?.length).toBe(1);
    expect(colonists[1].guildIds?.length).toBe(1);
    expect(colonists[0].guildIds?.[0]).toBe(colonists[1].guildIds?.[0]);
  });
});
```

You'll also need to add imports at the top of the test file:

```typescript
import { rng } from "../src/core/utils/random";
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/WorkforceManager.test.ts -t "guild formation"`
Expected: FAIL with "processGuildFormation is not a function"

**Step 3: Write minimal implementation**

Add imports to top of `src/core/systems/WorkforceManager.ts`:

```typescript
import {
  GUILD_FORMATION_CHECK_INTERVAL,
  GUILD_FORMATION_RELATIONSHIP_THRESHOLD,
  GUILD_FORMATION_BASE_PROBABILITY,
  GUILD_FORMATION_MEMBERSHIP_PENALTY,
  GUILD_FORMATION_MIN_POPULATION,
} from "../balance/WorkforceBalance";
import {
  determineGuildType,
  generateGuildName,
  findEligibleFounderGroups,
  calculateFormationProbability,
} from "./workforce/guildFormation";
```

Add private field after `guildManager` declaration:

```typescript
/** Sol of last guild formation check */
private lastGuildFormationCheck: number = 0;
```

Add method before serialization section (around line 920):

```typescript
/**
 * Process spontaneous guild formation.
 * Checks every GUILD_FORMATION_CHECK_INTERVAL sols for eligible founder groups.
 */
processGuildFormation(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
  const events: GameEvent[] = [];

  // Check interval
  if (currentSol - this.lastGuildFormationCheck < GUILD_FORMATION_CHECK_INTERVAL) {
    return events;
  }
  this.lastGuildFormationCheck = currentSol;

  // Minimum population check
  if (colonists.length < GUILD_FORMATION_MIN_POPULATION) {
    return events;
  }

  // Find eligible founder groups
  const relationships = this.relationshipManager.getAllRelationships();
  const groups = findEligibleFounderGroups(
    colonists,
    relationships,
    GUILD_FORMATION_RELATIONSHIP_THRESHOLD,
  );

  if (groups.length === 0) {
    return events;
  }

  // Try to form one guild (prevent explosion)
  const founderIds = groups[0];
  const founders = founderIds
    .map((id) => colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => c !== undefined);

  if (founders.length < 2) {
    return events;
  }

  // Roll probability
  const probability = calculateFormationProbability(
    founders,
    GUILD_FORMATION_BASE_PROBABILITY,
    GUILD_FORMATION_MEMBERSHIP_PENALTY,
  );

  if (!rng.chance(probability)) {
    return events;
  }

  // Determine type and name
  const guildType = determineGuildType(founders);
  const usedNames = this.guildManager.getUsedGuildNames();
  const guildName = generateGuildName(guildType, usedNames);

  // Create guild
  const guild = this.guildManager.createGuild(guildName, guildType, founderIds, currentSol);

  if (!guild) {
    return events;
  }

  // Update colonist guildIds
  for (const founder of founders) {
    if (!founder.guildIds) {
      founder.guildIds = [];
    }
    if (!founder.guildIds.includes(guild.id)) {
      founder.guildIds.push(guild.id);
    }
  }

  events.push({
    type: "GUILD_FORMED",
    severity: "info",
    guildId: guild.id,
    guildName: guild.name,
    guildType: guildType,
    founderIds: founderIds,
    message: `The ${guild.name} has been founded!`,
  });

  return events;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/WorkforceManager.test.ts -t "guild formation"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/WorkforceManager.ts tests/WorkforceManager.test.ts
git commit -m "feat(guilds): add processGuildFormation to WorkforceManager"
```

---

## Task 7: Integrate into Tick and Update Serialization

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`

**Step 1: Add to tick method**

In `WorkforceManager.tick()`, add after `processPreferentialAttachment` call (around line 83):

```typescript
// Process guild formation
events.push(...this.processGuildFormation(colonists, currentSol));
```

**Step 2: Update toJSON**

Modify `toJSON()` method to include `lastGuildFormationCheck`:

```typescript
toJSON() {
  return {
    // Keep backward-compatible keys
    coworkerRelationships: Object.fromEntries(this.relationshipManager.getAllRelationships()),
    guilds: Object.fromEntries(this.guildManager.getGuilds().map((g) => [g.id, g])),
    nextGuildId: this.guildManager.toJSON().nextGuildId,
    lastGuildFormationCheck: this.lastGuildFormationCheck,
  };
}
```

**Step 3: Update fromJSON**

In `fromJSON()`, restore the field (add after guild restoration):

```typescript
// Restore lastGuildFormationCheck
if (data.lastGuildFormationCheck !== undefined) {
  manager.lastGuildFormationCheck = data.lastGuildFormationCheck;
}
```

**Step 4: Run all tests**

Run: `bun test`
Expected: PASS (839 pass, same as before)

**Step 5: Commit**

```bash
git add src/core/systems/WorkforceManager.ts
git commit -m "feat(guilds): integrate formation into tick and serialization"
```

---

## Task 8: Final Verification

**Step 1: Run full test suite**

Run: `bun test`
Expected: All tests pass (same baseline as before)

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Run a quick simulation to verify no crashes**

Run: `bun run simulate --runs 5 --log silent`
Expected: Simulation completes without errors

**Step 4: Final commit if any cleanup needed**

If all passes, the feature is complete.
