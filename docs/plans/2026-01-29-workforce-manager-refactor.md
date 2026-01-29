# WorkforceManager Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Break up the 1320-line WorkforceManager into smaller, focused modules with pure functions for reusable logic.

**Architecture:** Extract three domain managers (RelationshipManager, GuildManager, TrainingManager) that WorkforceManager composes. Move graph algorithms and calculations to pure utility functions. Keep WorkforceManager as a thin orchestration layer.

**Tech Stack:** TypeScript, Bun test runner

---

## Analysis of Current WorkforceManager

The file contains 6 distinct concerns mixed together:

| Concern | Lines | Description |
|---------|-------|-------------|
| Training/Experience | 132-263 | Training progression, mastery levels, experience gain |
| Relationships Graph | 315-415, 757-1050 | Adjacency list, coworker/housemate bonding, weak ties |
| Guild System | 568-755 | Guild CRUD, membership, guild bonding |
| Community Detection | 1052-1271 | Label propagation algorithm, community stats |
| Cohort System | 537-566 | Arrival cohort detection |
| Serialization | 1273-1319 | JSON save/load |

## Proposed Structure

```
src/core/systems/
├── WorkforceManager.ts          # Orchestrator (thin, ~150 lines)
├── RelationshipManager.ts       # Social graph + bonding (~400 lines)
├── GuildManager.ts              # Guild CRUD + bonding (~200 lines)
└── workforce/
    ├── types.ts                 # Shared interfaces
    ├── training.ts              # Pure training functions
    ├── mastery.ts               # Pure mastery calculations
    ├── socialGraph.ts           # Pure graph algorithms (clustering, bridging)
    ├── communityDetection.ts    # Label propagation algorithm
    └── cohort.ts                # Cohort detection utilities
```

## Key Design Decisions

1. **RelationshipManager owns the social graph** - adjacency list, relationships map, bonding logic
2. **Pure functions for algorithms** - clustering coefficient, bridging score, community detection take data as input
3. **WorkforceManager orchestrates tick()** - delegates to sub-managers, combines events
4. **Types extracted** - CoworkerRelationship, SocialNetworkPosition, SocialCommunity shared

---

## Task 1: Create Shared Types

**Files:**
- Create: `src/core/systems/workforce/types.ts`

**Step 1: Write the types file**

```typescript
// src/core/systems/workforce/types.ts

/**
 * Tracks a relationship between two colonists.
 */
export interface CoworkerRelationship {
  /** Strength of the relationship (0-1) */
  strength: number;
  /** Sol when they first worked together */
  formedAt: number;
  /** Sol when they last worked together */
  lastWorkedTogether: number;
  /** Whether this is a cohort relationship (arrived together) */
  isCohort?: boolean;
  /** Whether they share a guild */
  sharedGuildIds?: string[];
}

/**
 * Information about a colonist's social position in the network.
 */
export interface SocialNetworkPosition {
  /** Number of connections this colonist has */
  connectionCount: number;
  /** Average strength of their connections */
  averageStrength: number;
  /** Number of weak ties (bridges to other groups) */
  weakTieCount: number;
  /** Bridging score - how much they connect otherwise separate groups */
  bridgingScore: number;
}

/**
 * A detected social community (emergent group) in the colonist network.
 */
export interface SocialCommunity {
  /** Unique identifier for this community */
  id: string;
  /** IDs of colonists in this community */
  memberIds: string[];
  /** Average internal relationship strength */
  cohesion: number;
  /** Number of connections to other communities */
  externalConnections: number;
}

/**
 * Detailed social cohesion info for a single colonist.
 */
export interface ColonistSocialCohesion {
  clusteringCoefficient: number;
  connectionCount: number;
  isIsolated: boolean;
  communityStrength: number;
}

/**
 * Statistics about detected communities in the social network.
 */
export interface CommunityStats {
  communityCount: number;
  averageSize: number;
  averageCohesion: number;
  modularity: number;
}
```

**Step 2: Verify file compiles**

Run: `bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/systems/workforce/types.ts
git commit -m "refactor(workforce): extract shared types to workforce/types.ts"
```

---

## Task 2: Create Pure Cohort Functions

**Files:**
- Create: `src/core/systems/workforce/cohort.ts`
- Test: `tests/workforce/cohort.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/workforce/cohort.test.ts
import { describe, it, expect } from "bun:test";
import { areInSameCohort, getCohortBondingMultiplier } from "../../src/core/systems/workforce/cohort";
import { COHORT_WINDOW_SOLS, COHORT_BONDING_MULTIPLIER } from "../../src/core/balance/WorkforceBalance";

describe("cohort", () => {
  describe("areInSameCohort", () => {
    it("should return true for colonists arriving within window", () => {
      expect(areInSameCohort(10, 15)).toBe(true);
      expect(areInSameCohort(10, 20)).toBe(true); // exactly at window edge
    });

    it("should return false for colonists arriving outside window", () => {
      expect(areInSameCohort(10, 50)).toBe(false);
      expect(areInSameCohort(10, 21)).toBe(false); // just outside
    });

    it("should return false when either arrival is undefined", () => {
      expect(areInSameCohort(10, undefined)).toBe(false);
      expect(areInSameCohort(undefined, 10)).toBe(false);
      expect(areInSameCohort(undefined, undefined)).toBe(false);
    });
  });

  describe("getCohortBondingMultiplier", () => {
    it("should return cohort multiplier for same cohort", () => {
      expect(getCohortBondingMultiplier(10, 15)).toBe(COHORT_BONDING_MULTIPLIER);
    });

    it("should return 1.0 for different cohorts", () => {
      expect(getCohortBondingMultiplier(10, 50)).toBe(1.0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/workforce/cohort.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/core/systems/workforce/cohort.ts
import {
  COHORT_WINDOW_SOLS,
  COHORT_BONDING_MULTIPLIER,
} from "../../balance/WorkforceBalance";

/**
 * Check if two colonists are in the same cohort (arrived within COHORT_WINDOW_SOLS).
 * Pure function - no side effects.
 */
export function areInSameCohort(
  arrivalSolA: number | undefined,
  arrivalSolB: number | undefined
): boolean {
  if (arrivalSolA === undefined || arrivalSolB === undefined) {
    return false;
  }
  return Math.abs(arrivalSolA - arrivalSolB) <= COHORT_WINDOW_SOLS;
}

/**
 * Get the bonding rate multiplier for two colonists based on cohort membership.
 * Returns COHORT_BONDING_MULTIPLIER if same cohort, 1.0 otherwise.
 */
export function getCohortBondingMultiplier(
  arrivalSolA: number | undefined,
  arrivalSolB: number | undefined
): number {
  return areInSameCohort(arrivalSolA, arrivalSolB) ? COHORT_BONDING_MULTIPLIER : 1.0;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/workforce/cohort.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/cohort.ts tests/workforce/cohort.test.ts
git commit -m "refactor(workforce): extract cohort functions as pure utilities"
```

---

## Task 3: Create Pure Mastery Functions

**Files:**
- Create: `src/core/systems/workforce/mastery.ts`
- Test: `tests/workforce/mastery.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/workforce/mastery.test.ts
import { describe, it, expect } from "bun:test";
import {
  calculateMasteryLevel,
  getMasteryEfficiency,
  getMasteryName,
} from "../../src/core/systems/workforce/mastery";
import { MasteryLevel } from "../../src/core/models/Colonist";

describe("mastery", () => {
  describe("calculateMasteryLevel", () => {
    it("should return NOVICE for 0-24 experience", () => {
      expect(calculateMasteryLevel(0)).toBe(MasteryLevel.NOVICE);
      expect(calculateMasteryLevel(24)).toBe(MasteryLevel.NOVICE);
    });

    it("should return SKILLED for 25-49 experience", () => {
      expect(calculateMasteryLevel(25)).toBe(MasteryLevel.SKILLED);
      expect(calculateMasteryLevel(49)).toBe(MasteryLevel.SKILLED);
    });

    it("should return EXPERT for 50-74 experience", () => {
      expect(calculateMasteryLevel(50)).toBe(MasteryLevel.EXPERT);
      expect(calculateMasteryLevel(74)).toBe(MasteryLevel.EXPERT);
    });

    it("should return MASTER for 75+ experience", () => {
      expect(calculateMasteryLevel(75)).toBe(MasteryLevel.MASTER);
      expect(calculateMasteryLevel(100)).toBe(MasteryLevel.MASTER);
    });
  });

  describe("getMasteryEfficiency", () => {
    it("should return correct efficiency for each level", () => {
      expect(getMasteryEfficiency(MasteryLevel.NOVICE)).toBe(0.7);
      expect(getMasteryEfficiency(MasteryLevel.SKILLED)).toBe(1.0);
      expect(getMasteryEfficiency(MasteryLevel.EXPERT)).toBe(1.3);
      expect(getMasteryEfficiency(MasteryLevel.MASTER)).toBe(1.6);
    });
  });

  describe("getMasteryName", () => {
    it("should return display names", () => {
      expect(getMasteryName(MasteryLevel.NOVICE)).toBe("Novice");
      expect(getMasteryName(MasteryLevel.SKILLED)).toBe("Skilled");
      expect(getMasteryName(MasteryLevel.EXPERT)).toBe("Expert");
      expect(getMasteryName(MasteryLevel.MASTER)).toBe("Master");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/workforce/mastery.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/core/systems/workforce/mastery.ts
import { MasteryLevel } from "../../models/Colonist";
import { MASTERY_THRESHOLDS, MASTERY_EFFICIENCY } from "../../balance/WorkforceBalance";

/**
 * Calculate mastery level from experience points.
 * Pure function.
 */
export function calculateMasteryLevel(experience: number): MasteryLevel {
  if (experience >= MASTERY_THRESHOLDS.MASTER) return MasteryLevel.MASTER;
  if (experience >= MASTERY_THRESHOLDS.EXPERT) return MasteryLevel.EXPERT;
  if (experience >= MASTERY_THRESHOLDS.SKILLED) return MasteryLevel.SKILLED;
  return MasteryLevel.NOVICE;
}

/**
 * Get efficiency multiplier for a mastery level.
 * Pure function.
 */
export function getMasteryEfficiency(level: MasteryLevel): number {
  return MASTERY_EFFICIENCY[level] ?? 1.0;
}

/**
 * Get display name for a mastery level.
 * Pure function.
 */
export function getMasteryName(level: MasteryLevel): string {
  switch (level) {
    case MasteryLevel.NOVICE:
      return "Novice";
    case MasteryLevel.SKILLED:
      return "Skilled";
    case MasteryLevel.EXPERT:
      return "Expert";
    case MasteryLevel.MASTER:
      return "Master";
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/workforce/mastery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/mastery.ts tests/workforce/mastery.test.ts
git commit -m "refactor(workforce): extract mastery functions as pure utilities"
```

---

## Task 4: Create Pure Training Functions

**Files:**
- Create: `src/core/systems/workforce/training.ts`
- Test: `tests/workforce/training.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/workforce/training.test.ts
import { describe, it, expect } from "bun:test";
import { getTrainingTime, getRoleName } from "../../src/core/systems/workforce/training";
import { ColonistRole } from "../../src/core/models/Colonist";

describe("training", () => {
  describe("getTrainingTime", () => {
    it("should return affinity-based training time", () => {
      expect(getTrainingTime(ColonistRole.RESEARCH, ColonistRole.CIVIL_SCIENCE)).toBe(3);
      expect(getTrainingTime(ColonistRole.UNASSIGNED, ColonistRole.ENGINEERING)).toBe(5);
    });

    it("should return default 10 for undefined affinity", () => {
      expect(getTrainingTime(ColonistRole.RESEARCH, ColonistRole.UNASSIGNED)).toBe(10);
    });
  });

  describe("getRoleName", () => {
    it("should return display names for all roles", () => {
      expect(getRoleName(ColonistRole.UNASSIGNED)).toBe("Unassigned");
      expect(getRoleName(ColonistRole.RESEARCH)).toBe("Researcher");
      expect(getRoleName(ColonistRole.ENGINEERING)).toBe("Engineer");
      expect(getRoleName(ColonistRole.CIVIL_SCIENCE)).toBe("Civil Scientist");
      expect(getRoleName(ColonistRole.FARMING)).toBe("Farmer");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/workforce/training.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/core/systems/workforce/training.ts
import { ColonistRole } from "../../models/Colonist";
import { ROLE_AFFINITY } from "../../balance/WorkforceBalance";

/**
 * Get training time in sols to transition between roles.
 * Pure function.
 */
export function getTrainingTime(currentRole: ColonistRole, targetRole: ColonistRole): number {
  const affinities = ROLE_AFFINITY[currentRole];
  return affinities?.[targetRole] || 10;
}

/**
 * Get display name for a colonist role.
 * Pure function.
 */
export function getRoleName(role: ColonistRole): string {
  switch (role) {
    case ColonistRole.UNASSIGNED:
      return "Unassigned";
    case ColonistRole.RESEARCH:
      return "Researcher";
    case ColonistRole.ENGINEERING:
      return "Engineer";
    case ColonistRole.CIVIL_SCIENCE:
      return "Civil Scientist";
    case ColonistRole.FARMING:
      return "Farmer";
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/workforce/training.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/training.ts tests/workforce/training.test.ts
git commit -m "refactor(workforce): extract training functions as pure utilities"
```

---

## Task 5: Create Pure Social Graph Functions

**Files:**
- Create: `src/core/systems/workforce/socialGraph.ts`
- Test: `tests/workforce/socialGraph.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/workforce/socialGraph.test.ts
import { describe, it, expect } from "bun:test";
import {
  getRelationshipKey,
  calculateClusteringCoefficient,
  calculateBridgingScore,
  calculateTeamCohesionMultiplier,
  isWeakTie,
} from "../../src/core/systems/workforce/socialGraph";
import type { CoworkerRelationship } from "../../src/core/systems/workforce/types";
import {
  WEAK_TIE_THRESHOLD,
  TEAM_COHESION_THRESHOLD,
  MAX_COWORKER_RELATIONSHIP,
  MAX_TEAM_COHESION_BONUS,
} from "../../src/core/balance/WorkforceBalance";

describe("socialGraph", () => {
  describe("getRelationshipKey", () => {
    it("should return alphabetically sorted key", () => {
      expect(getRelationshipKey("bob", "alice")).toBe("alice:bob");
      expect(getRelationshipKey("alice", "bob")).toBe("alice:bob");
    });
  });

  describe("isWeakTie", () => {
    it("should return true for strength below threshold", () => {
      expect(isWeakTie(0.1)).toBe(true);
      expect(isWeakTie(WEAK_TIE_THRESHOLD - 0.01)).toBe(true);
    });

    it("should return false for strength at or above threshold", () => {
      expect(isWeakTie(WEAK_TIE_THRESHOLD)).toBe(false);
      expect(isWeakTie(0.5)).toBe(false);
    });

    it("should return false for zero strength", () => {
      expect(isWeakTie(0)).toBe(false);
    });
  });

  describe("calculateClusteringCoefficient", () => {
    it("should return 0 for fewer than 2 neighbors", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b"]));
      const relationships = new Map<string, CoworkerRelationship>();

      expect(calculateClusteringCoefficient("a", adjacency, relationships)).toBe(0);
    });

    it("should return 1 for fully connected triangle", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      adjacency.set("b", new Set(["a", "c"]));
      adjacency.set("c", new Set(["a", "b"]));

      const relationships = new Map<string, CoworkerRelationship>();
      relationships.set("a:b", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("b:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });

      expect(calculateClusteringCoefficient("a", adjacency, relationships)).toBe(1);
    });
  });

  describe("calculateTeamCohesionMultiplier", () => {
    it("should return 1.0 for empty or solo team", () => {
      expect(calculateTeamCohesionMultiplier([], () => 0)).toBe(1.0);
      expect(calculateTeamCohesionMultiplier(["a"], () => 0)).toBe(1.0);
    });

    it("should return 1.0 for team below threshold", () => {
      const getStrength = () => 0.1; // Below TEAM_COHESION_THRESHOLD
      expect(calculateTeamCohesionMultiplier(["a", "b"], getStrength)).toBe(1.0);
    });

    it("should return bonus for team above threshold", () => {
      const getStrength = () => 0.5; // Above TEAM_COHESION_THRESHOLD
      const multiplier = calculateTeamCohesionMultiplier(["a", "b"], getStrength);
      expect(multiplier).toBeGreaterThan(1.0);
      expect(multiplier).toBeLessThanOrEqual(1.0 + MAX_TEAM_COHESION_BONUS);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/workforce/socialGraph.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/core/systems/workforce/socialGraph.ts
import type { CoworkerRelationship } from "./types";
import {
  WEAK_TIE_THRESHOLD,
  TEAM_COHESION_THRESHOLD,
  MAX_COWORKER_RELATIONSHIP,
  MAX_TEAM_COHESION_BONUS,
} from "../../balance/WorkforceBalance";

/**
 * Generate a canonical key for a pair of colonists (alphabetically sorted).
 * Pure function.
 */
export function getRelationshipKey(colonistId1: string, colonistId2: string): string {
  return colonistId1 < colonistId2
    ? `${colonistId1}:${colonistId2}`
    : `${colonistId2}:${colonistId1}`;
}

/**
 * Check if a relationship strength qualifies as a weak tie.
 * Weak ties are connections with strength > 0 but below WEAK_TIE_THRESHOLD.
 * Pure function.
 */
export function isWeakTie(strength: number): boolean {
  return strength > 0 && strength < WEAK_TIE_THRESHOLD;
}

/**
 * Calculate the clustering coefficient for a colonist.
 * Measures how connected their neighbors are to each other.
 *
 * Formula: C = 2 * actual_triangles / (degree * (degree - 1))
 * Range: 0 (no triangles) to 1 (all neighbors connected)
 *
 * Pure function.
 */
export function calculateClusteringCoefficient(
  colonistId: string,
  adjacencyList: Map<string, Set<string>>,
  relationships: Map<string, CoworkerRelationship>
): number {
  const neighbors = adjacencyList.get(colonistId);
  if (!neighbors || neighbors.size < 2) return 0;

  const neighborArray = [...neighbors];
  const degree = neighborArray.length;

  // Count edges between neighbors (triangles)
  let triangleEdges = 0;
  for (let i = 0; i < neighborArray.length; i++) {
    for (let j = i + 1; j < neighborArray.length; j++) {
      const key = getRelationshipKey(neighborArray[i]!, neighborArray[j]!);
      const relationship = relationships.get(key);
      if (relationship && relationship.strength > 0) {
        triangleEdges++;
      }
    }
  }

  // Maximum possible edges between neighbors
  const maxPossibleEdges = (degree * (degree - 1)) / 2;
  return triangleEdges / maxPossibleEdges;
}

/**
 * Calculate the bridging score for a colonist.
 * Higher score means they connect otherwise disconnected groups.
 * Pure function.
 */
export function calculateBridgingScore(
  colonistId: string,
  adjacencyList: Map<string, Set<string>>,
  getStrength: (id1: string, id2: string) => number
): number {
  const connections = adjacencyList.get(colonistId);
  if (!connections || connections.size < 2) return 0;

  const connectionArray = [...connections];
  let bridgingPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < connectionArray.length; i++) {
    for (let j = i + 1; j < connectionArray.length; j++) {
      totalPairs++;
      const strength = getStrength(connectionArray[i]!, connectionArray[j]!);
      if (strength < WEAK_TIE_THRESHOLD) {
        bridgingPairs++;
      }
    }
  }

  return totalPairs > 0 ? bridgingPairs / totalPairs : 0;
}

/**
 * Calculate team cohesion multiplier for a group of workers.
 * Returns 1.0 (no bonus) up to 1.0 + MAX_TEAM_COHESION_BONUS.
 * Pure function.
 */
export function calculateTeamCohesionMultiplier(
  workerIds: string[],
  getStrength: (id1: string, id2: string) => number
): number {
  if (workerIds.length < 2) return 1.0;

  let totalStrength = 0;
  let pairCount = 0;

  for (let i = 0; i < workerIds.length; i++) {
    for (let j = i + 1; j < workerIds.length; j++) {
      totalStrength += getStrength(workerIds[i]!, workerIds[j]!);
      pairCount++;
    }
  }

  if (pairCount === 0) return 1.0;

  const averageStrength = totalStrength / pairCount;
  if (averageStrength < TEAM_COHESION_THRESHOLD) return 1.0;

  const strengthAboveThreshold = averageStrength - TEAM_COHESION_THRESHOLD;
  const maxStrengthAboveThreshold = MAX_COWORKER_RELATIONSHIP - TEAM_COHESION_THRESHOLD;
  const bonusRatio = strengthAboveThreshold / maxStrengthAboveThreshold;

  return 1.0 + bonusRatio * MAX_TEAM_COHESION_BONUS;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/workforce/socialGraph.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/socialGraph.ts tests/workforce/socialGraph.test.ts
git commit -m "refactor(workforce): extract social graph functions as pure utilities"
```

---

## Task 6: Create Pure Community Detection Functions

**Files:**
- Create: `src/core/systems/workforce/communityDetection.ts`
- Test: `tests/workforce/communityDetection.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/workforce/communityDetection.test.ts
import { describe, it, expect } from "bun:test";
import {
  detectCommunities,
  calculateCommunityCohesion,
} from "../../src/core/systems/workforce/communityDetection";
import type { CoworkerRelationship } from "../../src/core/systems/workforce/types";

describe("communityDetection", () => {
  describe("detectCommunities", () => {
    it("should return empty array for no colonists", () => {
      const adjacency = new Map<string, Set<string>>();
      const relationships = new Map<string, CoworkerRelationship>();

      const communities = detectCommunities([], adjacency, relationships);
      expect(communities).toEqual([]);
    });

    it("should detect single community for connected group", () => {
      const adjacency = new Map<string, Set<string>>();
      adjacency.set("a", new Set(["b", "c"]));
      adjacency.set("b", new Set(["a", "c"]));
      adjacency.set("c", new Set(["a", "b"]));

      const relationships = new Map<string, CoworkerRelationship>();
      relationships.set("a:b", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("a:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });
      relationships.set("b:c", { strength: 0.5, formedAt: 1, lastWorkedTogether: 1 });

      const communities = detectCommunities(["a", "b", "c"], adjacency, relationships);
      expect(communities.length).toBe(1);
      expect(communities[0]!.memberIds.sort()).toEqual(["a", "b", "c"]);
    });
  });

  describe("calculateCommunityCohesion", () => {
    it("should return 0 for single member", () => {
      const getStrength = () => 0.5;
      expect(calculateCommunityCohesion(["a"], getStrength)).toBe(0);
    });

    it("should return average strength for multiple members", () => {
      const getStrength = (a: string, b: string) => 0.5;
      expect(calculateCommunityCohesion(["a", "b"], getStrength)).toBe(0.5);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/workforce/communityDetection.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/core/systems/workforce/communityDetection.ts
import type { SocialCommunity, CoworkerRelationship } from "./types";
import { getRelationshipKey } from "./socialGraph";

/**
 * Calculate the internal cohesion of a community.
 * Returns average relationship strength between community members.
 * Pure function.
 */
export function calculateCommunityCohesion(
  memberIds: string[],
  getStrength: (id1: string, id2: string) => number
): number {
  if (memberIds.length < 2) return 0;

  let totalStrength = 0;
  let pairCount = 0;

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      totalStrength += getStrength(memberIds[i]!, memberIds[j]!);
      pairCount++;
    }
  }

  return pairCount > 0 ? totalStrength / pairCount : 0;
}

/**
 * Count connections from community members to colonists outside the community.
 * Pure function.
 */
export function countExternalConnections(
  memberIds: string[],
  allColonistIds: Set<string>,
  adjacencyList: Map<string, Set<string>>
): number {
  const memberSet = new Set(memberIds);
  let externalCount = 0;

  for (const memberId of memberIds) {
    const neighbors = adjacencyList.get(memberId);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      if (allColonistIds.has(neighborId) && !memberSet.has(neighborId)) {
        externalCount++;
      }
    }
  }

  return externalCount;
}

/**
 * Detect communities using weighted label propagation algorithm.
 * Each colonist adopts the most common label among their neighbors,
 * weighted by relationship strength.
 *
 * Pure function - takes all data as input.
 */
export function detectCommunities(
  colonistIds: string[],
  adjacencyList: Map<string, Set<string>>,
  relationships: Map<string, CoworkerRelationship>,
  maxIterations: number = 20,
  minCommunitySize: number = 2
): SocialCommunity[] {
  if (colonistIds.length === 0) return [];

  // Initialize: each colonist starts in their own community
  const labels = new Map<string, string>();
  for (const id of colonistIds) {
    labels.set(id, id);
  }

  const colonistSet = new Set(colonistIds);

  // Helper to get relationship strength
  const getStrength = (id1: string, id2: string): number => {
    const key = getRelationshipKey(id1, id2);
    return relationships.get(key)?.strength ?? 0;
  };

  // Iterate until convergence or max iterations
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false;

    // Process nodes in random order to avoid oscillation
    const shuffled = [...colonistIds].sort(() => Math.random() - 0.5);

    for (const colonistId of shuffled) {
      const neighbors = adjacencyList.get(colonistId);
      if (!neighbors || neighbors.size === 0) continue;

      // Count weighted votes for each label among neighbors
      const labelVotes = new Map<string, number>();

      for (const neighborId of neighbors) {
        if (!colonistSet.has(neighborId)) continue;

        const neighborLabel = labels.get(neighborId);
        if (!neighborLabel) continue;

        const weight = getStrength(colonistId, neighborId);
        labelVotes.set(neighborLabel, (labelVotes.get(neighborLabel) ?? 0) + weight);
      }

      // Find label with highest weighted vote
      let maxVotes = 0;
      let bestLabel = labels.get(colonistId)!;

      for (const [label, votes] of labelVotes) {
        if (votes > maxVotes) {
          maxVotes = votes;
          bestLabel = label;
        }
      }

      // Update label if changed
      if (labels.get(colonistId) !== bestLabel) {
        labels.set(colonistId, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Group colonists by their final labels
  const communities = new Map<string, string[]>();
  for (const [colonistId, label] of labels) {
    if (!communities.has(label)) {
      communities.set(label, []);
    }
    communities.get(label)!.push(colonistId);
  }

  // Build community objects, merging small communities
  const result: SocialCommunity[] = [];
  let communityCounter = 1;
  const smallCommunityMembers: string[] = [];

  for (const [, memberIds] of communities) {
    if (memberIds.length < minCommunitySize) {
      smallCommunityMembers.push(...memberIds);
    } else {
      result.push({
        id: `community_${communityCounter++}`,
        memberIds,
        cohesion: calculateCommunityCohesion(memberIds, getStrength),
        externalConnections: countExternalConnections(memberIds, colonistSet, adjacencyList),
      });
    }
  }

  // Add small community members as a "misc" community if any
  if (smallCommunityMembers.length > 0) {
    result.push({
      id: `community_misc`,
      memberIds: smallCommunityMembers,
      cohesion: calculateCommunityCohesion(smallCommunityMembers, getStrength),
      externalConnections: countExternalConnections(smallCommunityMembers, colonistSet, adjacencyList),
    });
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/workforce/communityDetection.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/workforce/communityDetection.ts tests/workforce/communityDetection.test.ts
git commit -m "refactor(workforce): extract community detection as pure algorithm"
```

---

## Task 7: Create RelationshipManager

**Files:**
- Create: `src/core/systems/RelationshipManager.ts`
- Test: `tests/RelationshipManager.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/RelationshipManager.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import {
  INITIAL_COWORKER_RELATIONSHIP,
  COWORKER_BONDING_RATE,
} from "../src/core/balance/WorkforceBalance";

describe("RelationshipManager", () => {
  let manager: RelationshipManager;

  beforeEach(() => {
    manager = new RelationshipManager();
  });

  describe("createRelationship", () => {
    it("should create a new relationship", () => {
      manager.createRelationship("a", "b", 1);

      const rel = manager.getRelationship("a", "b");
      expect(rel).toBeDefined();
      expect(rel?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP);
      expect(rel?.formedAt).toBe(1);
    });

    it("should not overwrite existing relationship", () => {
      manager.createRelationship("a", "b", 1);
      manager.createRelationship("a", "b", 2);

      const rel = manager.getRelationship("a", "b");
      expect(rel?.formedAt).toBe(1); // Still original
    });
  });

  describe("strengthenRelationship", () => {
    it("should increase relationship strength", () => {
      manager.createRelationship("a", "b", 1);
      manager.strengthenRelationship("a", "b", COWORKER_BONDING_RATE, 2);

      const rel = manager.getRelationship("a", "b");
      expect(rel?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP + COWORKER_BONDING_RATE);
      expect(rel?.lastWorkedTogether).toBe(2);
    });
  });

  describe("getNeighbors", () => {
    it("should return all connected colonist IDs", () => {
      manager.createRelationship("a", "b", 1);
      manager.createRelationship("a", "c", 1);

      const neighbors = manager.getNeighbors("a");
      expect(neighbors.has("b")).toBe(true);
      expect(neighbors.has("c")).toBe(true);
      expect(neighbors.size).toBe(2);
    });
  });

  describe("getConnectionCount", () => {
    it("should return number of connections", () => {
      expect(manager.getConnectionCount("a")).toBe(0);

      manager.createRelationship("a", "b", 1);
      expect(manager.getConnectionCount("a")).toBe(1);

      manager.createRelationship("a", "c", 1);
      expect(manager.getConnectionCount("a")).toBe(2);
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize correctly", () => {
      manager.createRelationship("a", "b", 1);
      manager.strengthenRelationship("a", "b", 0.1, 2);

      const json = manager.toJSON();
      const restored = RelationshipManager.fromJSON(json);

      expect(restored.getRelationshipStrength("a", "b")).toBe(
        manager.getRelationshipStrength("a", "b")
      );
      expect(restored.getNeighbors("a").has("b")).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/RelationshipManager.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
// src/core/systems/RelationshipManager.ts
import type { CoworkerRelationship, SocialNetworkPosition, ColonistSocialCohesion, SocialCommunity, CommunityStats } from "./workforce/types";
import {
  getRelationshipKey,
  isWeakTie,
  calculateClusteringCoefficient,
  calculateBridgingScore,
  calculateTeamCohesionMultiplier,
} from "./workforce/socialGraph";
import { detectCommunities, calculateCommunityCohesion, countExternalConnections } from "./workforce/communityDetection";
import {
  INITIAL_COWORKER_RELATIONSHIP,
  INITIAL_HOUSEMATE_RELATIONSHIP,
  MAX_COWORKER_RELATIONSHIP,
  MIN_COWORKER_RELATIONSHIP,
  COWORKER_RELATIONSHIP_DECAY,
  WEAK_TIE_THRESHOLD,
} from "../balance/WorkforceBalance";

/**
 * Manages the social relationship graph between colonists.
 * Handles relationship creation, strengthening, decay, and graph queries.
 */
export class RelationshipManager {
  /** Relationship data keyed by canonical pair key */
  private relationships: Map<string, CoworkerRelationship> = new Map();

  /** Adjacency list for O(1) neighbor lookups */
  private adjacencyList: Map<string, Set<string>> = new Map();

  // ============ Basic Relationship Operations ============

  /**
   * Create a new relationship between two colonists.
   * Does nothing if relationship already exists.
   */
  createRelationship(
    colonistId1: string,
    colonistId2: string,
    currentSol: number,
    options: {
      initialStrength?: number;
      isCohort?: boolean;
      sharedGuildIds?: string[];
    } = {}
  ): boolean {
    const key = getRelationshipKey(colonistId1, colonistId2);
    if (this.relationships.has(key)) return false;

    const relationship: CoworkerRelationship = {
      strength: options.initialStrength ?? INITIAL_COWORKER_RELATIONSHIP,
      formedAt: currentSol,
      lastWorkedTogether: currentSol,
      isCohort: options.isCohort,
      sharedGuildIds: options.sharedGuildIds,
    };

    this.relationships.set(key, relationship);
    this.addToAdjacencyList(colonistId1, colonistId2);
    return true;
  }

  /**
   * Strengthen an existing relationship.
   */
  strengthenRelationship(
    colonistId1: string,
    colonistId2: string,
    amount: number,
    currentSol: number
  ): void {
    const key = getRelationshipKey(colonistId1, colonistId2);
    const relationship = this.relationships.get(key);
    if (!relationship) return;

    relationship.strength = Math.min(MAX_COWORKER_RELATIONSHIP, relationship.strength + amount);
    relationship.lastWorkedTogether = currentSol;
  }

  /**
   * Decay relationships that weren't active this sol.
   */
  decayRelationships(activeKeys: Set<string>): void {
    for (const [key, relationship] of this.relationships.entries()) {
      if (!activeKeys.has(key)) {
        relationship.strength = Math.max(
          MIN_COWORKER_RELATIONSHIP,
          relationship.strength - COWORKER_RELATIONSHIP_DECAY
        );
      }
    }
  }

  /**
   * Get relationship between two colonists.
   */
  getRelationship(colonistId1: string, colonistId2: string): CoworkerRelationship | undefined {
    const key = getRelationshipKey(colonistId1, colonistId2);
    return this.relationships.get(key);
  }

  /**
   * Get relationship strength between two colonists.
   */
  getRelationshipStrength(colonistId1: string, colonistId2: string): number {
    return this.getRelationship(colonistId1, colonistId2)?.strength ?? 0;
  }

  /**
   * Update shared guild IDs for a relationship.
   */
  updateSharedGuilds(colonistId1: string, colonistId2: string, guildIds: string[]): void {
    const key = getRelationshipKey(colonistId1, colonistId2);
    const relationship = this.relationships.get(key);
    if (relationship) {
      relationship.sharedGuildIds = guildIds;
    }
  }

  /**
   * Get all relationships.
   */
  getAllRelationships(): ReadonlyMap<string, CoworkerRelationship> {
    return this.relationships;
  }

  // ============ Adjacency List Operations ============

  private addToAdjacencyList(colonistId1: string, colonistId2: string): void {
    if (!this.adjacencyList.has(colonistId1)) {
      this.adjacencyList.set(colonistId1, new Set());
    }
    if (!this.adjacencyList.has(colonistId2)) {
      this.adjacencyList.set(colonistId2, new Set());
    }
    this.adjacencyList.get(colonistId1)!.add(colonistId2);
    this.adjacencyList.get(colonistId2)!.add(colonistId1);
  }

  /**
   * Get neighbors of a colonist.
   */
  getNeighbors(colonistId: string): Set<string> {
    return this.adjacencyList.get(colonistId) ?? new Set();
  }

  /**
   * Get number of connections for a colonist.
   */
  getConnectionCount(colonistId: string): number {
    return this.getNeighbors(colonistId).size;
  }

  // ============ Graph Analysis ============

  /**
   * Check if a relationship is a weak tie.
   */
  isWeakTie(colonistId1: string, colonistId2: string): boolean {
    const strength = this.getRelationshipStrength(colonistId1, colonistId2);
    return isWeakTie(strength);
  }

  /**
   * Get all weak ties for a colonist.
   */
  getWeakTies(colonistId: string): string[] {
    const weakTies: string[] = [];
    for (const neighborId of this.getNeighbors(colonistId)) {
      if (this.isWeakTie(colonistId, neighborId)) {
        weakTies.push(neighborId);
      }
    }
    return weakTies;
  }

  /**
   * Calculate clustering coefficient for a colonist.
   */
  getClusteringCoefficient(colonistId: string): number {
    return calculateClusteringCoefficient(colonistId, this.adjacencyList, this.relationships);
  }

  /**
   * Calculate bridging score for a colonist.
   */
  calculateBridgingScore(colonistId: string): number {
    return calculateBridgingScore(
      colonistId,
      this.adjacencyList,
      (id1, id2) => this.getRelationshipStrength(id1, id2)
    );
  }

  /**
   * Get team cohesion multiplier.
   */
  getTeamCohesionMultiplier(workerIds: string[]): number {
    return calculateTeamCohesionMultiplier(
      workerIds,
      (id1, id2) => this.getRelationshipStrength(id1, id2)
    );
  }

  /**
   * Get social network position for a colonist.
   */
  getSocialNetworkPosition(colonistId: string): SocialNetworkPosition {
    const neighbors = this.getNeighbors(colonistId);
    let totalStrength = 0;
    let weakTieCount = 0;

    for (const neighborId of neighbors) {
      const rel = this.getRelationship(colonistId, neighborId);
      if (rel) {
        totalStrength += rel.strength;
        if (rel.strength < WEAK_TIE_THRESHOLD) {
          weakTieCount++;
        }
      }
    }

    const connectionCount = neighbors.size;
    return {
      connectionCount,
      averageStrength: connectionCount > 0 ? totalStrength / connectionCount : 0,
      weakTieCount,
      bridgingScore: this.calculateBridgingScore(colonistId),
    };
  }

  /**
   * Get detailed social cohesion info for a colonist.
   */
  getColonistSocialCohesion(colonistId: string): ColonistSocialCohesion {
    const connectionCount = this.getConnectionCount(colonistId);
    const clusteringCoefficient = this.getClusteringCoefficient(colonistId);

    let totalStrength = 0;
    for (const neighborId of this.getNeighbors(colonistId)) {
      totalStrength += this.getRelationshipStrength(colonistId, neighborId);
    }

    return {
      clusteringCoefficient,
      connectionCount,
      isIsolated: connectionCount === 0,
      communityStrength: connectionCount > 0 ? totalStrength / connectionCount : 0,
    };
  }

  /**
   * Get colony-wide social cohesion score.
   */
  getColonySocialCohesion(colonistIds: string[]): number {
    if (colonistIds.length === 0) return 0;

    let totalWeightedCohesion = 0;
    let totalWeight = 0;

    for (const colonistId of colonistIds) {
      const clustering = this.getClusteringCoefficient(colonistId);
      const connections = this.getConnectionCount(colonistId);
      const weight = Math.max(1, connections);
      totalWeightedCohesion += clustering * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalWeightedCohesion / totalWeight : 0;
  }

  /**
   * Identify isolated colonists.
   */
  getIsolatedColonists(colonistIds: string[], minConnections: number = 1): string[] {
    return colonistIds.filter((id) => this.getConnectionCount(id) < minConnections);
  }

  // ============ Community Detection ============

  /**
   * Detect communities in the social network.
   */
  detectCommunities(
    colonistIds: string[],
    maxIterations: number = 20,
    minCommunitySize: number = 2
  ): SocialCommunity[] {
    return detectCommunities(
      colonistIds,
      this.adjacencyList,
      this.relationships,
      maxIterations,
      minCommunitySize
    );
  }

  /**
   * Get community statistics.
   */
  getCommunityStats(colonistIds: string[]): CommunityStats {
    const communities = this.detectCommunities(colonistIds);

    if (communities.length === 0) {
      return { communityCount: 0, averageSize: 0, averageCohesion: 0, modularity: 0 };
    }

    const totalSize = communities.reduce((sum, c) => sum + c.memberIds.length, 0);
    const totalCohesion = communities.reduce((sum, c) => sum + c.cohesion, 0);

    // Calculate modularity
    const totalEdges = this.relationships.size;
    let modularity = 0;

    if (totalEdges > 0) {
      for (const community of communities) {
        const memberSet = new Set(community.memberIds);
        let internalEdges = 0;
        let communityDegree = 0;

        for (const memberId of community.memberIds) {
          const neighbors = this.getNeighbors(memberId);
          communityDegree += neighbors.size;

          for (const neighborId of neighbors) {
            if (memberSet.has(neighborId)) {
              internalEdges++;
            }
          }
        }

        internalEdges /= 2;
        const expected = (communityDegree / (2 * totalEdges)) ** 2 * totalEdges;
        modularity += internalEdges / totalEdges - expected / totalEdges;
      }
    }

    return {
      communityCount: communities.length,
      averageSize: totalSize / communities.length,
      averageCohesion: totalCohesion / communities.length,
      modularity: Math.max(0, Math.min(1, modularity)),
    };
  }

  // ============ Serialization ============

  toJSON() {
    return {
      relationships: Object.fromEntries(this.relationships),
    };
  }

  static fromJSON(data: ReturnType<RelationshipManager["toJSON"]>): RelationshipManager {
    const manager = new RelationshipManager();

    if (data.relationships) {
      manager.relationships = new Map(
        Object.entries(data.relationships).map(([k, v]) => [k, v as CoworkerRelationship])
      );
      manager.rebuildAdjacencyList();
    }

    return manager;
  }

  private rebuildAdjacencyList(): void {
    this.adjacencyList.clear();
    for (const key of this.relationships.keys()) {
      const [id1, id2] = key.split(":");
      if (id1 && id2) {
        this.addToAdjacencyList(id1, id2);
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/RelationshipManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/RelationshipManager.ts tests/RelationshipManager.test.ts
git commit -m "refactor(workforce): create RelationshipManager for social graph"
```

---

## Task 8: Create GuildManager

**Files:**
- Create: `src/core/systems/GuildManager.ts`
- Test: `tests/GuildManager.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/GuildManager.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { GuildManager } from "../src/core/systems/GuildManager";
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

describe("GuildManager", () => {
  let manager: GuildManager;

  beforeEach(() => {
    manager = new GuildManager();
  });

  describe("createGuild", () => {
    it("should create a guild with founders", () => {
      const guild = manager.createGuild("Test Guild", GuildType.SOCIAL, ["c1", "c2"], 10);

      expect(guild).toBeDefined();
      expect(guild?.name).toBe("Test Guild");
      expect(guild?.memberIds).toContain("c1");
      expect(guild?.memberIds).toContain("c2");
    });

    it("should return null for too few founders", () => {
      const guild = manager.createGuild("Too Small", GuildType.SOCIAL, ["c1"], 10);
      expect(guild).toBeNull();
    });
  });

  describe("joinGuild", () => {
    it("should allow joining a guild", () => {
      const guild = manager.createGuild("Test", GuildType.SOCIAL, ["c1", "c2"], 10);
      const colonist = createColonist({ id: "c3" });

      const result = manager.joinGuild("c3", guild!.id, colonist);

      expect(result).toBe(true);
      expect(guild!.memberIds).toContain("c3");
      expect(colonist.guildIds).toContain(guild!.id);
    });
  });

  describe("leaveGuild", () => {
    it("should remove colonist from guild", () => {
      const guild = manager.createGuild("Test", GuildType.SOCIAL, ["c1", "c2", "c3"], 10);
      const colonist = createColonist({ id: "c1", guildIds: [guild!.id] });

      const result = manager.leaveGuild("c1", guild!.id, colonist);

      expect(result).toBe(true);
      expect(guild!.memberIds).not.toContain("c1");
    });

    it("should disband guild when below minimum size", () => {
      const guild = manager.createGuild("Small", GuildType.SOCIAL, ["c1", "c2"], 10);
      const colonist = createColonist({ id: "c1", guildIds: [guild!.id] });

      manager.leaveGuild("c1", guild!.id, colonist);

      expect(manager.getGuild(guild!.id)).toBeUndefined();
    });
  });

  describe("shareGuild", () => {
    it("should detect shared membership", () => {
      const guild = manager.createGuild("Shared", GuildType.SOCIAL, ["c1", "c2"], 10);
      const colonistA = createColonist({ id: "c1", guildIds: [guild!.id] });
      const colonistB = createColonist({ id: "c2", guildIds: [guild!.id] });
      const colonistC = createColonist({ id: "c3" });

      expect(manager.shareGuild(colonistA, colonistB)).toBe(true);
      expect(manager.shareGuild(colonistA, colonistC)).toBe(false);
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize correctly", () => {
      manager.createGuild("Test Guild", GuildType.PROFESSIONAL, ["c1", "c2"], 10);

      const json = manager.toJSON();
      const restored = GuildManager.fromJSON(json);

      expect(restored.getGuilds().length).toBe(1);
      expect(restored.getGuilds()[0]?.name).toBe("Test Guild");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/GuildManager.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write implementation**

```typescript
// src/core/systems/GuildManager.ts
import type { Guild } from "../models/Guild";
import { GuildType } from "../models/Guild";
import type { Colonist } from "../models/Colonist";
import {
  MIN_GUILD_SIZE,
  MAX_GUILD_SIZE,
  MAX_GUILD_MEMBERSHIPS,
} from "../balance/WorkforceBalance";

/**
 * Manages guild creation, membership, and queries.
 */
export class GuildManager {
  private guilds: Map<string, Guild> = new Map();
  private nextGuildId: number = 1;

  /**
   * Create a new guild.
   */
  createGuild(
    name: string,
    type: GuildType,
    founderIds: string[],
    currentSol: number,
    description?: string
  ): Guild | null {
    if (founderIds.length < MIN_GUILD_SIZE) {
      return null;
    }

    const id = `guild_${this.nextGuildId++}`;
    const guild: Guild = {
      id,
      name,
      type,
      memberIds: founderIds.slice(0, MAX_GUILD_SIZE),
      foundedSol: currentSol,
      description,
    };

    this.guilds.set(id, guild);
    return guild;
  }

  /**
   * Add a colonist to a guild.
   */
  joinGuild(colonistId: string, guildId: string, colonist: Colonist): boolean {
    const guild = this.guilds.get(guildId);
    if (!guild) return false;

    if (guild.memberIds.length >= MAX_GUILD_SIZE) return false;

    const membershipCount = colonist.guildIds?.length ?? 0;
    if (membershipCount >= MAX_GUILD_MEMBERSHIPS) return false;

    if (guild.memberIds.includes(colonistId)) return false;

    guild.memberIds.push(colonistId);

    if (!colonist.guildIds) {
      colonist.guildIds = [];
    }
    colonist.guildIds.push(guildId);

    return true;
  }

  /**
   * Remove a colonist from a guild.
   */
  leaveGuild(colonistId: string, guildId: string, colonist: Colonist): boolean {
    const guild = this.guilds.get(guildId);
    if (!guild) return false;

    const memberIndex = guild.memberIds.indexOf(colonistId);
    if (memberIndex === -1) return false;

    guild.memberIds.splice(memberIndex, 1);

    if (colonist.guildIds) {
      const guildIndex = colonist.guildIds.indexOf(guildId);
      if (guildIndex !== -1) {
        colonist.guildIds.splice(guildIndex, 1);
      }
    }

    if (guild.memberIds.length < MIN_GUILD_SIZE) {
      this.disbandGuild(guildId);
    }

    return true;
  }

  /**
   * Disband a guild.
   */
  disbandGuild(guildId: string): boolean {
    return this.guilds.delete(guildId);
  }

  /**
   * Get all guilds.
   */
  getGuilds(): readonly Guild[] {
    return [...this.guilds.values()];
  }

  /**
   * Get a guild by ID.
   */
  getGuild(guildId: string): Guild | undefined {
    return this.guilds.get(guildId);
  }

  /**
   * Check if two colonists share a guild.
   */
  shareGuild(colonistA: Colonist, colonistB: Colonist): boolean {
    if (!colonistA.guildIds?.length || !colonistB.guildIds?.length) {
      return false;
    }
    return colonistA.guildIds.some((gId) => colonistB.guildIds?.includes(gId));
  }

  /**
   * Get shared guild IDs between two colonists.
   */
  getSharedGuildIds(colonistA: Colonist, colonistB: Colonist): string[] {
    if (!colonistA.guildIds?.length || !colonistB.guildIds?.length) {
      return [];
    }
    return colonistA.guildIds.filter((gId) => colonistB.guildIds?.includes(gId));
  }

  // ============ Serialization ============

  toJSON() {
    return {
      guilds: Object.fromEntries(this.guilds),
      nextGuildId: this.nextGuildId,
    };
  }

  static fromJSON(data: ReturnType<GuildManager["toJSON"]>): GuildManager {
    const manager = new GuildManager();

    if (data.guilds) {
      manager.guilds = new Map(
        Object.entries(data.guilds).map(([k, v]) => [k, v as Guild])
      );
    }

    if (data.nextGuildId) {
      manager.nextGuildId = data.nextGuildId;
    }

    return manager;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/GuildManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/GuildManager.ts tests/GuildManager.test.ts
git commit -m "refactor(workforce): create GuildManager for guild system"
```

---

## Task 9: Refactor WorkforceManager to Use New Modules

**Files:**
- Modify: `src/core/systems/WorkforceManager.ts`
- Modify: `tests/WorkforceManager.test.ts` (update imports only)

**Step 1: Update WorkforceManager to compose the new managers**

The refactored WorkforceManager should:
1. Compose RelationshipManager and GuildManager
2. Delegate relationship/guild operations to them
3. Use pure functions from workforce/ utilities
4. Keep tick() orchestration logic
5. Maintain backward-compatible public API by re-exporting types and delegating methods

**Implementation approach:**
- Replace inline relationship storage with RelationshipManager instance
- Replace inline guild storage with GuildManager instance
- Import and use pure functions from workforce/ modules
- Re-export types for backward compatibility
- Delegate public methods to appropriate sub-managers

**Step 2: Verify all existing tests still pass**

Run: `bun test tests/WorkforceManager.test.ts`
Expected: All tests PASS (API unchanged)

**Step 3: Commit**

```bash
git add src/core/systems/WorkforceManager.ts
git commit -m "refactor(workforce): compose RelationshipManager and GuildManager"
```

---

## Task 10: Add Barrel Export

**Files:**
- Create: `src/core/systems/workforce/index.ts`

**Step 1: Create barrel export**

```typescript
// src/core/systems/workforce/index.ts
export * from "./types";
export * from "./cohort";
export * from "./mastery";
export * from "./training";
export * from "./socialGraph";
export * from "./communityDetection";
```

**Step 2: Verify imports work**

Run: `bun run build`
Expected: No errors

**Step 3: Commit**

```bash
git add src/core/systems/workforce/index.ts
git commit -m "refactor(workforce): add barrel export for pure utilities"
```

---

## Task 11: Final Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 2: Run lint**

Run: `bun run lint`
Expected: No errors

**Step 3: Run build**

Run: `bun run build`
Expected: No errors

**Step 4: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "refactor(workforce): complete WorkforceManager modularization"
```

---

## Summary of Changes

| Before | After |
|--------|-------|
| 1 file, 1320 lines | 10 files, ~1400 lines total |
| Mixed concerns | Clear separation of concerns |
| Stateful methods | Pure functions + stateful managers |
| Monolithic class | Composable modules |

**New Structure:**
```
src/core/systems/
├── WorkforceManager.ts          # Orchestrator (~200 lines)
├── RelationshipManager.ts       # Social graph (~300 lines)
├── GuildManager.ts              # Guild CRUD (~150 lines)
└── workforce/
    ├── index.ts                 # Barrel export
    ├── types.ts                 # Shared interfaces (~60 lines)
    ├── cohort.ts                # Pure cohort functions (~25 lines)
    ├── mastery.ts               # Pure mastery functions (~35 lines)
    ├── training.ts              # Pure training functions (~30 lines)
    ├── socialGraph.ts           # Pure graph algorithms (~100 lines)
    └── communityDetection.ts    # Label propagation (~120 lines)
```

**Benefits:**
1. Each module has a single responsibility
2. Pure functions are testable in isolation
3. RelationshipManager can be reused for other relationship types
4. GuildManager encapsulates all guild logic
5. WorkforceManager is thin orchestration layer
6. Easier to understand and maintain
