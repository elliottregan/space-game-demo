# NPC Influence System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a graph-based influence propagation system where support for player-proposed projects spreads through NPC social networks based on faction alignment and relationships.

**Architecture:** NPCs have faction alignments and relationship connections. Player proposes projects and lobbies NPCs to seed support. Each tick, support levels propagate through the network via matrix multiplication (relationship weights × faction transmission factors). Projects pass when average support exceeds threshold.

**Tech Stack:** Pure TypeScript in `src/core/`, Vue 3 components in `src/renderer/`, Bun test runner.

**Reference Spec:** `docs/plans/npc_influence_system_spec.md`

---

## Task 1: Define NPC and Project Models

**Files:**
- Create: `src/core/models/NPCInfluence.ts`

**Step 1: Write the model interfaces**

```typescript
// src/core/models/NPCInfluence.ts

export type NPCFaction = 'traditionalist' | 'progressive' | 'futurist';

export interface NPC {
  id: string;
  name: string;
  faction: NPCFaction;
  /** Base cost multiplier for lobbying this NPC (1.0 = normal, 2.0 = expensive) */
  influence: number;
}

export type ProjectType = 'traditionalist' | 'progressive' | 'futurist';

export interface Project {
  id: string;
  name: string;
  description: string;
  type: ProjectType;
  /** Resource cost to propose this project */
  proposalCost: ResourceDelta;
  /** Effects applied if project passes */
  effects?: {
    resources?: ResourceDelta;
    unlockTech?: string;
    unlockBuilding?: string;
  };
}

export interface ActiveProject {
  projectId: string;
  /** NPC id -> support level (-1 to +1) */
  supportLevels: Map<string, number>;
  /** Sols remaining before vote */
  solsRemaining: number;
}

export interface Council {
  id: string;
  name: string;
  /** NPC ids that are members */
  memberIds: string[];
  /** Relationship boost applied between members */
  relationshipBoost: number;
}
```

**Step 2: Add ResourceDelta import**

Add at top of file:
```typescript
import type { ResourceDelta } from './Resources';
```

**Step 3: Export from models index**

Modify `src/core/models/index.ts` (if exists) or create it:
```typescript
export * from './NPCInfluence';
```

**Step 4: Commit**

```bash
git add src/core/models/NPCInfluence.ts
git commit -m "feat(models): add NPC influence system interfaces"
```

---

## Task 2: Define Balance Constants

**Files:**
- Create: `src/core/balance/NPCInfluenceBalance.ts`

**Step 1: Write balance constants**

```typescript
// src/core/balance/NPCInfluenceBalance.ts

import type { NPCFaction, ProjectType } from '../models/NPCInfluence';

/** Drift rate - how quickly NPCs respond to network influence (0.1-0.5) */
export const DRIFT_RATE = 0.2;

/** Support threshold for project to pass */
export const PASS_THRESHOLD = 0.4;

/** Sols before a proposed project is voted on */
export const PROJECT_VOTE_DELAY = 10;

/** Transmission factors: how receptive target faction is to source faction for each project type */
export const TRANSMISSION_FACTORS: Record<ProjectType, Record<NPCFaction, Record<NPCFaction, number>>> = {
  futurist: {
    futurist:      { futurist: 1.0, progressive: 0.6, traditionalist: 0.2 },
    progressive:   { futurist: 0.7, progressive: 1.0, traditionalist: 0.4 },
    traditionalist:{ futurist: 0.3, progressive: 0.5, traditionalist: 1.0 },
  },
  progressive: {
    futurist:      { futurist: 1.0, progressive: 0.5, traditionalist: 0.3 },
    progressive:   { futurist: 0.6, progressive: 1.0, traditionalist: 0.6 },
    traditionalist:{ futurist: 0.3, progressive: 0.5, traditionalist: 1.0 },
  },
  traditionalist: {
    futurist:      { futurist: 1.0, progressive: 0.4, traditionalist: 0.2 },
    progressive:   { futurist: 0.5, progressive: 1.0, traditionalist: 0.6 },
    traditionalist:{ futurist: 0.3, progressive: 0.7, traditionalist: 1.0 },
  },
} as const;

/** Base lobbying cost per 0.1 support boost (in materials) */
export const LOBBY_BASE_COST = 10;

/** Cost to create a council (in materials) */
export const COUNCIL_CREATION_COST = 50;

/** Relationship boost when NPCs are in same council */
export const COUNCIL_RELATIONSHIP_BOOST = 0.2;

/** Transmission factor change on project success */
export const SUCCESS_TRANSMISSION_BOOST = 0.1;

/** Transmission factor change on project failure */
export const FAILURE_TRANSMISSION_PENALTY = -0.15;
```

**Step 2: Commit**

```bash
git add src/core/balance/NPCInfluenceBalance.ts
git commit -m "feat(balance): add NPC influence balance constants"
```

---

## Task 3: Define NPC Data

**Files:**
- Create: `src/core/data/npcs.ts`

**Step 1: Write NPC definitions**

```typescript
// src/core/data/npcs.ts

import type { NPC, Project } from '../models/NPCInfluence';

export const NPCS: NPC[] = [
  // Futurists (3)
  { id: 'chen_wei', name: 'Dr. Chen Wei', faction: 'futurist', influence: 1.5 },
  { id: 'nova_silva', name: 'Nova Silva', faction: 'futurist', influence: 1.0 },
  { id: 'alex_okonkwo', name: 'Alex Okonkwo', faction: 'futurist', influence: 1.2 },

  // Progressives (4)
  { id: 'maria_santos', name: 'Maria Santos', faction: 'progressive', influence: 1.3 },
  { id: 'james_liu', name: 'James Liu', faction: 'progressive', influence: 1.0 },
  { id: 'aisha_patel', name: 'Aisha Patel', faction: 'progressive', influence: 1.1 },
  { id: 'marcus_reed', name: 'Marcus Reed', faction: 'progressive', influence: 0.9 },

  // Traditionalists (3)
  { id: 'elena_volkov', name: 'Elena Volkov', faction: 'traditionalist', influence: 1.4 },
  { id: 'david_morrison', name: 'David Morrison', faction: 'traditionalist', influence: 1.0 },
  { id: 'sarah_chen', name: 'Sarah Chen', faction: 'traditionalist', influence: 1.1 },
];

/** Initial relationship weights (asymmetric). Key format: "fromId:toId" -> weight */
export const INITIAL_RELATIONSHIPS: Record<string, number> = {
  // Futurist internal connections (strong)
  'chen_wei:nova_silva': 0.7,
  'nova_silva:chen_wei': 0.6,
  'chen_wei:alex_okonkwo': 0.5,
  'alex_okonkwo:chen_wei': 0.6,
  'nova_silva:alex_okonkwo': 0.4,
  'alex_okonkwo:nova_silva': 0.5,

  // Progressive internal connections (moderate)
  'maria_santos:james_liu': 0.6,
  'james_liu:maria_santos': 0.5,
  'maria_santos:aisha_patel': 0.5,
  'aisha_patel:maria_santos': 0.6,
  'james_liu:marcus_reed': 0.4,
  'marcus_reed:james_liu': 0.4,
  'aisha_patel:marcus_reed': 0.3,
  'marcus_reed:aisha_patel': 0.3,

  // Traditionalist internal connections (strong)
  'elena_volkov:david_morrison': 0.7,
  'david_morrison:elena_volkov': 0.6,
  'elena_volkov:sarah_chen': 0.5,
  'sarah_chen:elena_volkov': 0.6,
  'david_morrison:sarah_chen': 0.4,
  'sarah_chen:david_morrison': 0.5,

  // Cross-faction connections (weak)
  'chen_wei:maria_santos': 0.3,
  'maria_santos:chen_wei': 0.2,
  'nova_silva:aisha_patel': 0.2,
  'aisha_patel:nova_silva': 0.3,
  'marcus_reed:david_morrison': 0.3,
  'david_morrison:marcus_reed': 0.2,
  'james_liu:sarah_chen': 0.2,
  'sarah_chen:james_liu': 0.2,
};

export const PROJECTS: Project[] = [
  // Futurist projects
  {
    id: 'generation_ship',
    name: 'Build Generation Ship',
    description: 'Begin construction of an interstellar colony ship.',
    type: 'futurist',
    proposalCost: { materials: 100 },
    effects: { unlockBuilding: 'shipyard' },
  },
  {
    id: 'ai_governance',
    name: 'AI-Assisted Governance',
    description: 'Implement AI systems to help with colony decision-making.',
    type: 'futurist',
    proposalCost: { materials: 50, power: 50 },
    effects: { unlockTech: 'advanced_ai' },
  },

  // Progressive projects
  {
    id: 'universal_housing',
    name: 'Universal Housing Initiative',
    description: 'Guarantee housing for all colonists.',
    type: 'progressive',
    proposalCost: { materials: 80 },
    effects: { unlockBuilding: 'housing_complex' },
  },
  {
    id: 'healthcare_expansion',
    name: 'Healthcare Expansion',
    description: 'Expand medical facilities and access.',
    type: 'progressive',
    proposalCost: { materials: 60, water: 30 },
    effects: { unlockBuilding: 'medical_center' },
  },

  // Traditionalist projects
  {
    id: 'earth_memorial',
    name: 'Earth Memorial',
    description: 'Build a memorial to honor our home planet.',
    type: 'traditionalist',
    proposalCost: { materials: 40 },
  },
  {
    id: 'heritage_archive',
    name: 'Heritage Archive',
    description: 'Preserve Earth cultures and traditions.',
    type: 'traditionalist',
    proposalCost: { materials: 50 },
    effects: { unlockBuilding: 'archive' },
  },
];
```

**Step 2: Commit**

```bash
git add src/core/data/npcs.ts
git commit -m "feat(data): add NPC definitions and initial relationships"
```

---

## Task 4: Implement Matrix Math Utilities

**Files:**
- Create: `tests/NPCInfluenceMatrix.test.ts`
- Create: `src/core/systems/NPCInfluenceManager.ts` (partial - just matrix utils)

**Step 1: Write failing tests for matrix operations**

```typescript
// tests/NPCInfluenceMatrix.test.ts

import { describe, it, expect } from 'bun:test';
import {
  matrixMultiply,
  matrixVectorMultiply,
} from '../src/core/systems/NPCInfluenceManager';

describe('Matrix utilities', () => {
  describe('matrixMultiply', () => {
    it('should multiply two 2x2 matrices', () => {
      const A = [
        [1, 2],
        [3, 4],
      ];
      const B = [
        [5, 6],
        [7, 8],
      ];
      const result = matrixMultiply(A, B);
      expect(result).toEqual([
        [19, 22],
        [43, 50],
      ]);
    });

    it('should handle 3x3 identity matrix', () => {
      const A = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const I = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const result = matrixMultiply(A, I);
      expect(result).toEqual(A);
    });
  });

  describe('matrixVectorMultiply', () => {
    it('should multiply matrix by vector', () => {
      const M = [
        [1, 2],
        [3, 4],
      ];
      const v = [5, 6];
      const result = matrixVectorMultiply(M, v);
      expect(result).toEqual([17, 39]);
    });

    it('should handle 3x3 case', () => {
      const M = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ];
      const v = [1, 2, 3];
      const result = matrixVectorMultiply(M, v);
      expect(result).toEqual([1, 2, 3]);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceMatrix.test.ts
```

Expected: FAIL with "Cannot find module" or similar

**Step 3: Implement matrix utilities**

```typescript
// src/core/systems/NPCInfluenceManager.ts

/**
 * Multiply two matrices A × B
 * A is m×n, B is n×p, result is m×p
 */
export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;

  const result: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

/**
 * Multiply matrix M by vector v
 * M is m×n, v is n×1, result is m×1
 */
export function matrixVectorMultiply(M: number[][], v: number[]): number[] {
  const result = new Array(M.length).fill(0);

  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < v.length; j++) {
      result[i] += M[i][j] * v[j];
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceMatrix.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceMatrix.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): add matrix multiplication utilities with tests"
```

---

## Task 5: Implement Support Update Function

**Files:**
- Modify: `tests/NPCInfluenceMatrix.test.ts`
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Write failing test for updateSupport**

Add to `tests/NPCInfluenceMatrix.test.ts`:

```typescript
import {
  matrixMultiply,
  matrixVectorMultiply,
  updateSupport,
} from '../src/core/systems/NPCInfluenceManager';

describe('updateSupport', () => {
  it('should propagate support through network', () => {
    // Two NPCs, one supports (+1), one neutral (0)
    const currentSupport = [1.0, 0.0];
    // Strong connection from NPC 0 to NPC 1
    const W = [
      [0, 0.5], // NPC 0 influenced by NPC 1 at 0.5
      [0.8, 0], // NPC 1 influenced by NPC 0 at 0.8
    ];
    // Full transmission (same faction)
    const T = [
      [1, 1],
      [1, 1],
    ];
    const alpha = 0.5;

    const newSupport = updateSupport(currentSupport, W, T, alpha);

    // NPC 0: starts at 1.0, target = 0*1*1 + 0.5*1*0 = 0, moves 50% toward 0 = 0.5
    // NPC 1: starts at 0.0, target = 0.8*1*1 + 0*1*0 = 0.8, moves 50% toward 0.8 = 0.4
    expect(newSupport[0]).toBeCloseTo(0.5, 2);
    expect(newSupport[1]).toBeCloseTo(0.4, 2);
  });

  it('should clamp values to [-1, 1]', () => {
    const currentSupport = [1.0, 1.0, 1.0];
    // All NPCs strongly connected
    const W = [
      [0, 0.9, 0.9],
      [0.9, 0, 0.9],
      [0.9, 0.9, 0],
    ];
    const T = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    const alpha = 1.0; // Aggressive drift

    const newSupport = updateSupport(currentSupport, W, T, alpha);

    // Values should be clamped to 1.0 max
    for (const s of newSupport) {
      expect(s).toBeLessThanOrEqual(1.0);
      expect(s).toBeGreaterThanOrEqual(-1.0);
    }
  });

  it('should preserve isolated NPC support', () => {
    const currentSupport = [0.5, 0.0, 0.0];
    // NPC 0 has no connections
    const W = [
      [0, 0, 0],
      [0, 0, 0.5],
      [0, 0.5, 0],
    ];
    const T = [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ];
    const alpha = 0.3;

    const newSupport = updateSupport(currentSupport, W, T, alpha);

    // NPC 0 should drift toward 0 (no incoming influence)
    expect(newSupport[0]).toBeCloseTo(0.35, 2); // 0.5 + 0.3*(0 - 0.5) = 0.35
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceMatrix.test.ts
```

Expected: FAIL (updateSupport not exported)

**Step 3: Implement updateSupport**

Add to `src/core/systems/NPCInfluenceManager.ts`:

```typescript
/**
 * Update support levels using discrete-time linear dynamics:
 * s(t+1) = s(t) + α(W×T×s(t) - s(t))
 *
 * @param currentSupport - Current support levels per NPC
 * @param W - Relationship weight matrix (who influences whom)
 * @param T - Transmission factor matrix (faction compatibility)
 * @param alpha - Drift rate (0.1-0.5)
 * @returns New support levels, clamped to [-1, 1]
 */
export function updateSupport(
  currentSupport: number[],
  W: number[][],
  T: number[][],
  alpha: number
): number[] {
  const N = currentSupport.length;

  // Compute effective influence matrix: W × T
  const WT = matrixMultiply(W, T);

  // Compute target support: WT × s(t)
  const target = matrixVectorMultiply(WT, currentSupport);

  // Move toward target by alpha
  const newSupport = new Array(N);
  for (let i = 0; i < N; i++) {
    newSupport[i] = currentSupport[i] + alpha * (target[i] - currentSupport[i]);
    // Clamp to valid range
    newSupport[i] = Math.max(-1.0, Math.min(1.0, newSupport[i]));
  }

  return newSupport;
}
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceMatrix.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceMatrix.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): implement support propagation with updateSupport"
```

---

## Task 6: Implement NPCInfluenceManager Class

**Files:**
- Create: `tests/NPCInfluenceManager.test.ts`
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Write failing test for manager initialization**

```typescript
// tests/NPCInfluenceManager.test.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import { NPCInfluenceManager } from '../src/core/systems/NPCInfluenceManager';
import { NPCS, INITIAL_RELATIONSHIPS, PROJECTS } from '../src/core/data/npcs';

describe('NPCInfluenceManager', () => {
  let manager: NPCInfluenceManager;

  beforeEach(() => {
    manager = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);
  });

  describe('initialization', () => {
    it('should store all NPCs', () => {
      const npcs = manager.getNPCs();
      expect(npcs.length).toBe(10);
    });

    it('should store all projects', () => {
      const projects = manager.getProjects();
      expect(projects.length).toBe(6);
    });

    it('should build relationship matrix from initial data', () => {
      const matrix = manager.getRelationshipMatrix();
      expect(matrix.length).toBe(10);
      expect(matrix[0].length).toBe(10);
    });

    it('should have no active project initially', () => {
      expect(manager.getActiveProject()).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: FAIL

**Step 3: Implement NPCInfluenceManager class structure**

Replace entire `src/core/systems/NPCInfluenceManager.ts` with:

```typescript
// src/core/systems/NPCInfluenceManager.ts

import type { GameEvent } from '../models/GameEvent';
import type { ResourceDelta } from '../models/Resources';
import type {
  NPC,
  NPCFaction,
  Project,
  ProjectType,
  ActiveProject,
  Council,
} from '../models/NPCInfluence';
import {
  DRIFT_RATE,
  PASS_THRESHOLD,
  PROJECT_VOTE_DELAY,
  TRANSMISSION_FACTORS,
} from '../balance/NPCInfluenceBalance';

// ============ Matrix Utilities ============

export function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;

  const result: number[][] = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let k = 0; k < inner; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

export function matrixVectorMultiply(M: number[][], v: number[]): number[] {
  const result = new Array(M.length).fill(0);

  for (let i = 0; i < M.length; i++) {
    for (let j = 0; j < v.length; j++) {
      result[i] += M[i][j] * v[j];
    }
  }

  return result;
}

export function updateSupport(
  currentSupport: number[],
  W: number[][],
  T: number[][],
  alpha: number
): number[] {
  const N = currentSupport.length;
  const WT = matrixMultiply(W, T);
  const target = matrixVectorMultiply(WT, currentSupport);

  const newSupport = new Array(N);
  for (let i = 0; i < N; i++) {
    newSupport[i] = currentSupport[i] + alpha * (target[i] - currentSupport[i]);
    newSupport[i] = Math.max(-1.0, Math.min(1.0, newSupport[i]));
  }

  return newSupport;
}

// ============ Manager Class ============

export class NPCInfluenceManager {
  private npcs: NPC[];
  private npcIndex: Map<string, number> = new Map();
  private projects: Map<string, Project> = new Map();
  private relationshipMatrix: number[][];
  private councils: Council[] = [];
  private activeProject: ActiveProject | null = null;

  /** Mutable transmission factors (modified by project outcomes) */
  private transmissionFactors: Record<ProjectType, Record<NPCFaction, Record<NPCFaction, number>>>;

  constructor(
    npcs: NPC[],
    relationships: Record<string, number>,
    projects: Project[]
  ) {
    this.npcs = [...npcs];

    // Build NPC index for fast lookup
    npcs.forEach((npc, i) => this.npcIndex.set(npc.id, i));

    // Store projects
    projects.forEach((p) => this.projects.set(p.id, p));

    // Build relationship matrix
    this.relationshipMatrix = this.buildRelationshipMatrix(relationships);

    // Deep copy transmission factors so we can modify them
    this.transmissionFactors = JSON.parse(JSON.stringify(TRANSMISSION_FACTORS));
  }

  private buildRelationshipMatrix(relationships: Record<string, number>): number[][] {
    const N = this.npcs.length;
    const matrix: number[][] = Array(N)
      .fill(0)
      .map(() => Array(N).fill(0));

    for (const [key, weight] of Object.entries(relationships)) {
      const [fromId, toId] = key.split(':');
      const fromIdx = this.npcIndex.get(fromId);
      const toIdx = this.npcIndex.get(toId);

      if (fromIdx !== undefined && toIdx !== undefined) {
        // W[i][j] = influence from j to i
        // So if "fromId:toId" means fromId influences toId, we set W[toIdx][fromIdx]
        matrix[toIdx][fromIdx] = weight;
      }
    }

    return matrix;
  }

  // ============ Getters ============

  getNPCs(): readonly NPC[] {
    return this.npcs;
  }

  getProjects(): Project[] {
    return Array.from(this.projects.values());
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getRelationshipMatrix(): readonly number[][] {
    return this.relationshipMatrix;
  }

  getActiveProject(): ActiveProject | null {
    return this.activeProject;
  }

  getCouncils(): readonly Council[] {
    return this.councils;
  }

  // ============ Serialization ============

  toJSON() {
    return {
      relationshipMatrix: this.relationshipMatrix,
      councils: this.councils,
      activeProject: this.activeProject
        ? {
            projectId: this.activeProject.projectId,
            supportLevels: Object.fromEntries(this.activeProject.supportLevels),
            solsRemaining: this.activeProject.solsRemaining,
          }
        : null,
      transmissionFactors: this.transmissionFactors,
    };
  }

  static fromJSON(
    data: ReturnType<NPCInfluenceManager['toJSON']>,
    npcs: NPC[],
    relationships: Record<string, number>,
    projects: Project[]
  ): NPCInfluenceManager {
    const manager = new NPCInfluenceManager(npcs, relationships, projects);

    manager.relationshipMatrix = data.relationshipMatrix;
    manager.councils = data.councils;
    manager.transmissionFactors = data.transmissionFactors;

    if (data.activeProject) {
      manager.activeProject = {
        projectId: data.activeProject.projectId,
        supportLevels: new Map(Object.entries(data.activeProject.supportLevels)),
        solsRemaining: data.activeProject.solsRemaining,
      };
    }

    return manager;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceManager.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): implement NPCInfluenceManager class with initialization"
```

---

## Task 7: Implement Project Proposal

**Files:**
- Modify: `tests/NPCInfluenceManager.test.ts`
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Write failing test for proposeProject**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
import { ResourceManager } from '../src/core/systems/ResourceManager';

describe('proposeProject', () => {
  it('should start a project with all NPCs at neutral support', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 200,
    });

    const result = manager.proposeProject('generation_ship', resources);

    expect(result).toBe(true);

    const active = manager.getActiveProject();
    expect(active).not.toBeNull();
    expect(active!.projectId).toBe('generation_ship');
    expect(active!.solsRemaining).toBe(10);

    // All NPCs should start at 0.0 support
    for (const npc of manager.getNPCs()) {
      expect(active!.supportLevels.get(npc.id)).toBe(0.0);
    }
  });

  it('should deduct proposal cost from resources', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 200,
    });

    manager.proposeProject('generation_ship', resources);

    // generation_ship costs 100 materials
    expect(resources.getResources().materials).toBe(100);
  });

  it('should fail if cannot afford proposal cost', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 50, // Not enough for generation_ship (100)
    });

    const result = manager.proposeProject('generation_ship', resources);

    expect(result).toBe(false);
    expect(manager.getActiveProject()).toBeNull();
  });

  it('should fail if project already active', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 200,
    });

    manager.proposeProject('generation_ship', resources);
    const result = manager.proposeProject('universal_housing', resources);

    expect(result).toBe(false);
    expect(manager.getActiveProject()!.projectId).toBe('generation_ship');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: FAIL

**Step 3: Implement proposeProject**

Add to `NPCInfluenceManager` class in `src/core/systems/NPCInfluenceManager.ts`:

```typescript
import type { ResourceManager } from './ResourceManager';

// Add to class:

  /**
   * Propose a project for NPC consideration.
   * @returns true if proposal succeeded, false if cannot afford or project already active
   */
  proposeProject(projectId: string, resources: ResourceManager): boolean {
    // Cannot propose if project already active
    if (this.activeProject) {
      return false;
    }

    const project = this.projects.get(projectId);
    if (!project) {
      return false;
    }

    // Check if can afford proposal cost
    if (!resources.canAfford(project.proposalCost)) {
      return false;
    }

    // Deduct cost
    resources.deduct(project.proposalCost);

    // Initialize project with all NPCs at neutral support
    const supportLevels = new Map<string, number>();
    for (const npc of this.npcs) {
      supportLevels.set(npc.id, 0.0);
    }

    this.activeProject = {
      projectId,
      supportLevels,
      solsRemaining: PROJECT_VOTE_DELAY,
    };

    return true;
  }
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceManager.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): implement project proposal with cost deduction"
```

---

## Task 8: Implement Lobbying

**Files:**
- Modify: `tests/NPCInfluenceManager.test.ts`
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Write failing test for lobbyNPC**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
import { LOBBY_BASE_COST } from '../src/core/balance/NPCInfluenceBalance';

describe('lobbyNPC', () => {
  it('should increase NPC support for active project', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    manager.proposeProject('generation_ship', resources);

    const result = manager.lobbyNPC('chen_wei', 0.3, resources);

    expect(result).toBe(true);
    expect(manager.getActiveProject()!.supportLevels.get('chen_wei')).toBe(0.3);
  });

  it('should cost materials based on NPC influence and boost amount', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    manager.proposeProject('generation_ship', resources);
    const startMaterials = resources.getResources().materials;

    // chen_wei has influence 1.5, boosting by 0.3
    // Cost = LOBBY_BASE_COST * influence * (boost / 0.1) = 10 * 1.5 * 3 = 45
    manager.lobbyNPC('chen_wei', 0.3, resources);

    expect(resources.getResources().materials).toBe(startMaterials - 45);
  });

  it('should fail if no active project', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    const result = manager.lobbyNPC('chen_wei', 0.3, resources);

    expect(result).toBe(false);
  });

  it('should clamp support to [-1, 1]', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 1000,
    });

    manager.proposeProject('generation_ship', resources);
    manager.lobbyNPC('chen_wei', 0.8, resources);
    manager.lobbyNPC('chen_wei', 0.8, resources); // Would be 1.6, should clamp

    expect(manager.getActiveProject()!.supportLevels.get('chen_wei')).toBe(1.0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: FAIL

**Step 3: Implement lobbyNPC**

Add to `NPCInfluenceManager` class:

```typescript
import { LOBBY_BASE_COST } from '../balance/NPCInfluenceBalance';

// Add to class:

  /**
   * Calculate the cost to lobby an NPC for a given support boost.
   */
  getLobbyCost(npcId: string, supportBoost: number): number {
    const npcIdx = this.npcIndex.get(npcId);
    if (npcIdx === undefined) return Infinity;

    const npc = this.npcs[npcIdx];
    // Cost scales with NPC influence and boost amount
    return Math.ceil(LOBBY_BASE_COST * npc.influence * (supportBoost / 0.1));
  }

  /**
   * Lobby an NPC to increase their support for the active project.
   * @returns true if lobbying succeeded
   */
  lobbyNPC(npcId: string, supportBoost: number, resources: ResourceManager): boolean {
    if (!this.activeProject) {
      return false;
    }

    const npcIdx = this.npcIndex.get(npcId);
    if (npcIdx === undefined) {
      return false;
    }

    const cost: ResourceDelta = { materials: this.getLobbyCost(npcId, supportBoost) };

    if (!resources.canAfford(cost)) {
      return false;
    }

    resources.deduct(cost);

    const currentSupport = this.activeProject.supportLevels.get(npcId) || 0;
    const newSupport = Math.max(-1.0, Math.min(1.0, currentSupport + supportBoost));
    this.activeProject.supportLevels.set(npcId, newSupport);

    return true;
  }
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceManager.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): implement NPC lobbying with resource costs"
```

---

## Task 9: Implement Council Creation

**Files:**
- Modify: `tests/NPCInfluenceManager.test.ts`
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Write failing test for createCouncil**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
import { COUNCIL_CREATION_COST, COUNCIL_RELATIONSHIP_BOOST } from '../src/core/balance/NPCInfluenceBalance';

describe('createCouncil', () => {
  it('should create a council and boost relationships between members', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    const memberIds = ['chen_wei', 'maria_santos', 'elena_volkov'];
    const result = manager.createCouncil('Science Council', memberIds, resources);

    expect(result).toBe(true);

    const councils = manager.getCouncils();
    expect(councils.length).toBe(1);
    expect(councils[0].name).toBe('Science Council');
    expect(councils[0].memberIds).toEqual(memberIds);
  });

  it('should increase relationship weights between council members', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    // Get initial relationship between chen_wei and elena_volkov (should be 0 - no initial connection)
    const chenIdx = 0; // chen_wei is first
    const elenaIdx = 7; // elena_volkov is 8th (0-indexed: 7)

    const initialMatrix = manager.getRelationshipMatrix();
    const initialWeight = initialMatrix[elenaIdx][chenIdx];

    manager.createCouncil('Science Council', ['chen_wei', 'elena_volkov'], resources);

    const newMatrix = manager.getRelationshipMatrix();
    expect(newMatrix[elenaIdx][chenIdx]).toBe(Math.min(1.0, initialWeight + COUNCIL_RELATIONSHIP_BOOST));
  });

  it('should deduct creation cost', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    manager.createCouncil('Science Council', ['chen_wei', 'maria_santos'], resources);

    expect(resources.getResources().materials).toBe(500 - COUNCIL_CREATION_COST);
  });

  it('should fail if cannot afford', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 10, // Not enough
    });

    const result = manager.createCouncil('Science Council', ['chen_wei', 'maria_santos'], resources);

    expect(result).toBe(false);
    expect(manager.getCouncils().length).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: FAIL

**Step 3: Implement createCouncil**

Add to `NPCInfluenceManager` class:

```typescript
import { COUNCIL_CREATION_COST, COUNCIL_RELATIONSHIP_BOOST } from '../balance/NPCInfluenceBalance';

// Add to class:

  /**
   * Create a council that permanently boosts relationships between members.
   * @returns true if council created successfully
   */
  createCouncil(name: string, memberIds: string[], resources: ResourceManager): boolean {
    const cost: ResourceDelta = { materials: COUNCIL_CREATION_COST };

    if (!resources.canAfford(cost)) {
      return false;
    }

    // Verify all members exist
    for (const id of memberIds) {
      if (!this.npcIndex.has(id)) {
        return false;
      }
    }

    resources.deduct(cost);

    // Boost relationships between all members (both directions)
    for (const id1 of memberIds) {
      for (const id2 of memberIds) {
        if (id1 !== id2) {
          const idx1 = this.npcIndex.get(id1)!;
          const idx2 = this.npcIndex.get(id2)!;

          // W[i][j] = influence from j to i
          this.relationshipMatrix[idx1][idx2] = Math.min(
            1.0,
            this.relationshipMatrix[idx1][idx2] + COUNCIL_RELATIONSHIP_BOOST
          );
        }
      }
    }

    const council: Council = {
      id: `council_${this.councils.length + 1}`,
      name,
      memberIds,
      relationshipBoost: COUNCIL_RELATIONSHIP_BOOST,
    };

    this.councils.push(council);

    return true;
  }
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceManager.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): implement council creation with relationship boosts"
```

---

## Task 10: Implement tick() and Project Resolution

**Files:**
- Modify: `tests/NPCInfluenceManager.test.ts`
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Write failing test for tick**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('tick', () => {
  it('should propagate support through network each tick', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    manager.proposeProject('generation_ship', resources);

    // Seed support for chen_wei (futurist)
    manager.lobbyNPC('chen_wei', 0.8, resources);

    // Run a tick
    manager.tick();

    // nova_silva (futurist, connected to chen_wei) should have gained some support
    const novaSupport = manager.getActiveProject()!.supportLevels.get('nova_silva')!;
    expect(novaSupport).toBeGreaterThan(0);
  });

  it('should decrement solsRemaining each tick', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    manager.proposeProject('generation_ship', resources);
    const initialSols = manager.getActiveProject()!.solsRemaining;

    manager.tick();

    expect(manager.getActiveProject()!.solsRemaining).toBe(initialSols - 1);
  });

  it('should resolve project when solsRemaining reaches 0', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 1000,
    });

    manager.proposeProject('generation_ship', resources);

    // Lobby enough NPCs to pass
    manager.lobbyNPC('chen_wei', 0.9, resources);
    manager.lobbyNPC('nova_silva', 0.9, resources);
    manager.lobbyNPC('alex_okonkwo', 0.9, resources);
    manager.lobbyNPC('maria_santos', 0.7, resources);
    manager.lobbyNPC('james_liu', 0.7, resources);

    // Run 10 ticks to resolve
    for (let i = 0; i < 10; i++) {
      manager.tick();
    }

    // Project should be resolved (cleared)
    expect(manager.getActiveProject()).toBeNull();
  });

  it('should emit PROJECT_PASSED event when project passes', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 1000,
    });

    manager.proposeProject('generation_ship', resources);

    // Lobby most NPCs heavily
    for (const npc of manager.getNPCs()) {
      manager.lobbyNPC(npc.id, 0.9, resources);
    }

    // Run ticks until resolution
    let events: GameEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events = manager.tick();
    }

    const passedEvent = events.find((e) => e.type === 'PROJECT_PASSED');
    expect(passedEvent).toBeDefined();
    expect(passedEvent!.projectId).toBe('generation_ship');
  });

  it('should emit PROJECT_FAILED event when project fails', () => {
    const resources = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 500,
    });

    manager.proposeProject('generation_ship', resources);

    // Don't lobby anyone - all at 0.0, will fail

    // Run ticks until resolution
    let events: GameEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events = manager.tick();
    }

    const failedEvent = events.find((e) => e.type === 'PROJECT_FAILED');
    expect(failedEvent).toBeDefined();
    expect(failedEvent!.projectId).toBe('generation_ship');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: FAIL

**Step 3: Implement tick and project resolution**

Add to `NPCInfluenceManager` class:

```typescript
// Add to class:

  /**
   * Build the transmission matrix T for a given project type.
   * T[i][j] = how receptive NPC i is to influence from NPC j
   */
  private buildTransmissionMatrix(projectType: ProjectType): number[][] {
    const N = this.npcs.length;
    const T: number[][] = Array(N)
      .fill(0)
      .map(() => Array(N).fill(0));

    const factors = this.transmissionFactors[projectType];

    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const targetFaction = this.npcs[i].faction;
        const sourceFaction = this.npcs[j].faction;
        T[i][j] = factors[targetFaction][sourceFaction];
      }
    }

    return T;
  }

  /**
   * Calculate average support across all NPCs for the active project.
   */
  getAverageSupport(): number {
    if (!this.activeProject) return 0;

    let sum = 0;
    for (const support of this.activeProject.supportLevels.values()) {
      sum += support;
    }
    return sum / this.npcs.length;
  }

  /**
   * Modify transmission factors after project success/failure.
   */
  private modifyTransmissionFactors(projectType: ProjectType, delta: number): void {
    for (const pType of Object.keys(this.transmissionFactors) as ProjectType[]) {
      for (const targetFaction of Object.keys(this.transmissionFactors[pType]) as NPCFaction[]) {
        // Modify how receptive everyone is to the project's faction
        const current = this.transmissionFactors[pType][targetFaction][projectType];
        this.transmissionFactors[pType][targetFaction][projectType] = Math.max(
          0,
          Math.min(1, current + delta)
        );
      }
    }
  }

  /**
   * Process one game tick. Propagates influence and resolves projects.
   */
  tick(): GameEvent[] {
    const events: GameEvent[] = [];

    if (!this.activeProject) {
      return events;
    }

    const project = this.projects.get(this.activeProject.projectId);
    if (!project) {
      return events;
    }

    // Build current support vector
    const currentSupport: number[] = this.npcs.map(
      (npc) => this.activeProject!.supportLevels.get(npc.id) || 0
    );

    // Build transmission matrix for this project type
    const T = this.buildTransmissionMatrix(project.type);

    // Update support levels
    const newSupport = updateSupport(
      currentSupport,
      this.relationshipMatrix,
      T,
      DRIFT_RATE
    );

    // Store updated support
    for (let i = 0; i < this.npcs.length; i++) {
      this.activeProject.supportLevels.set(this.npcs[i].id, newSupport[i]);
    }

    // Decrement sols remaining
    this.activeProject.solsRemaining--;

    // Check for resolution
    if (this.activeProject.solsRemaining <= 0) {
      const averageSupport = this.getAverageSupport();
      const passed = averageSupport >= PASS_THRESHOLD;

      if (passed) {
        events.push({
          type: 'PROJECT_PASSED',
          severity: 'info',
          projectId: project.id,
          projectName: project.name,
          averageSupport,
          message: `Project "${project.name}" passed with ${(averageSupport * 100).toFixed(0)}% average support`,
        });

        // Boost transmission factors for this project type
        this.modifyTransmissionFactors(project.type, SUCCESS_TRANSMISSION_BOOST);
      } else {
        events.push({
          type: 'PROJECT_FAILED',
          severity: 'warning',
          projectId: project.id,
          projectName: project.name,
          averageSupport,
          message: `Project "${project.name}" failed with only ${(averageSupport * 100).toFixed(0)}% average support`,
        });

        // Penalize transmission factors for this project type
        this.modifyTransmissionFactors(project.type, FAILURE_TRANSMISSION_PENALTY);
      }

      // Clear active project
      this.activeProject = null;
    }

    return events;
  }
```

Also add at the top of the file:

```typescript
import {
  DRIFT_RATE,
  PASS_THRESHOLD,
  PROJECT_VOTE_DELAY,
  TRANSMISSION_FACTORS,
  LOBBY_BASE_COST,
  COUNCIL_CREATION_COST,
  COUNCIL_RELATIONSHIP_BOOST,
  SUCCESS_TRANSMISSION_BOOST,
  FAILURE_TRANSMISSION_PENALTY,
} from '../balance/NPCInfluenceBalance';
```

**Step 4: Run test to verify it passes**

```bash
bun test tests/NPCInfluenceManager.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/NPCInfluenceManager.test.ts src/core/systems/NPCInfluenceManager.ts
git commit -m "feat(influence): implement tick() with support propagation and project resolution"
```

---

## Task 11: Integrate with GameState

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Add NPCInfluenceManager to GameState**

In `src/core/GameState.ts`, add:

```typescript
import { NPCInfluenceManager } from './systems/NPCInfluenceManager';
import { NPCS, INITIAL_RELATIONSHIPS, PROJECTS } from './data/npcs';
```

Add to class properties:

```typescript
npcInfluence: NPCInfluenceManager;
```

In constructor, after other system initializations:

```typescript
this.npcInfluence = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);
```

In `tick()` method, add after politics tick (around line where politics.tick() is called):

```typescript
events.push(...this.npcInfluence.tick());
```

In `toJSON()` method:

```typescript
npcInfluence: this.npcInfluence.toJSON(),
```

In `fromJSON()` static method:

```typescript
if (data.npcInfluence) {
  state.npcInfluence = NPCInfluenceManager.fromJSON(
    data.npcInfluence,
    NPCS,
    INITIAL_RELATIONSHIPS,
    PROJECTS
  );
}
```

**Step 2: Run all tests to verify no regressions**

```bash
bun test
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/core/GameState.ts
git commit -m "feat(gamestate): integrate NPCInfluenceManager into game loop"
```

---

## Task 12: Add UI State to GameService

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Add NPC influence state to GameUIState interface**

Find the `GameUIState` interface and add:

```typescript
npcInfluence: {
  npcs: NPC[];
  projects: Project[];
  activeProject: {
    projectId: string;
    supportLevels: Record<string, number>;
    solsRemaining: number;
    averageSupport: number;
  } | null;
  councils: Council[];
};
```

**Step 2: Update syncState() to populate npcInfluence**

In `syncState()` method, add:

```typescript
// NPC Influence
const activeProject = this.game.npcInfluence.getActiveProject();
this.state.npcInfluence = {
  npcs: [...this.game.npcInfluence.getNPCs()],
  projects: this.game.npcInfluence.getProjects(),
  activeProject: activeProject
    ? {
        projectId: activeProject.projectId,
        supportLevels: Object.fromEntries(activeProject.supportLevels),
        solsRemaining: activeProject.solsRemaining,
        averageSupport: this.game.npcInfluence.getAverageSupport(),
      }
    : null,
  councils: [...this.game.npcInfluence.getCouncils()],
};
```

**Step 3: Add action methods**

```typescript
proposeProject(projectId: string): boolean {
  const result = this.game.npcInfluence.proposeProject(projectId, this.game.resources);
  this.syncState();
  return result;
}

lobbyNPC(npcId: string, supportBoost: number): boolean {
  const result = this.game.npcInfluence.lobbyNPC(npcId, supportBoost, this.game.resources);
  this.syncState();
  return result;
}

createCouncil(name: string, memberIds: string[]): boolean {
  const result = this.game.npcInfluence.createCouncil(name, memberIds, this.game.resources);
  this.syncState();
  return result;
}

getLobbyCost(npcId: string, supportBoost: number): number {
  return this.game.npcInfluence.getLobbyCost(npcId, supportBoost);
}
```

**Step 4: Initialize npcInfluence in state object**

Find where state is initialized and add default value:

```typescript
npcInfluence: {
  npcs: [],
  projects: [],
  activeProject: null,
  councils: [],
},
```

**Step 5: Verify dev server still works**

```bash
bun run dev
```

Check browser console for errors.

**Step 6: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat(ui): add NPC influence state and actions to GameService"
```

---

## Task 13: Create NPCInfluencePanel Component

**Files:**
- Create: `src/renderer/components/NPCInfluencePanel.vue`

**Step 1: Create the component**

```vue
<!-- src/renderer/components/NPCInfluencePanel.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { gameService } from '../services/GameService';
import type { NPC, Project } from '../../core/models/NPCInfluence';

const state = gameService.getState();

const selectedProject = ref<string | null>(null);
const selectedNPCForLobby = ref<string | null>(null);
const lobbyAmount = ref(0.3);
const councilName = ref('');
const selectedCouncilMembers = ref<string[]>([]);

const canProposeProject = computed(() => {
  if (!selectedProject.value || state.npcInfluence.activeProject) return false;
  const project = state.npcInfluence.projects.find(p => p.id === selectedProject.value);
  if (!project) return false;
  return gameService.getGame().resources.canAfford(project.proposalCost);
});

const lobbyCost = computed(() => {
  if (!selectedNPCForLobby.value) return 0;
  return gameService.getLobbyCost(selectedNPCForLobby.value, lobbyAmount.value);
});

const canLobby = computed(() => {
  if (!state.npcInfluence.activeProject || !selectedNPCForLobby.value) return false;
  return state.resources.materials >= lobbyCost.value;
});

const canCreateCouncil = computed(() => {
  return selectedCouncilMembers.value.length >= 2 &&
         councilName.value.trim() !== '' &&
         state.resources.materials >= 50;
});

function proposeProject() {
  if (selectedProject.value) {
    gameService.proposeProject(selectedProject.value);
    selectedProject.value = null;
  }
}

function lobbyNPC() {
  if (selectedNPCForLobby.value) {
    gameService.lobbyNPC(selectedNPCForLobby.value, lobbyAmount.value);
  }
}

function createCouncil() {
  if (councilName.value && selectedCouncilMembers.value.length >= 2) {
    gameService.createCouncil(councilName.value, selectedCouncilMembers.value);
    councilName.value = '';
    selectedCouncilMembers.value = [];
  }
}

function toggleCouncilMember(npcId: string) {
  const idx = selectedCouncilMembers.value.indexOf(npcId);
  if (idx === -1) {
    selectedCouncilMembers.value.push(npcId);
  } else {
    selectedCouncilMembers.value.splice(idx, 1);
  }
}

function getFactionColor(faction: string): string {
  switch (faction) {
    case 'futurist': return 'var(--color-info)';
    case 'progressive': return 'var(--color-positive)';
    case 'traditionalist': return 'var(--color-warning)';
    default: return 'var(--color-muted)';
  }
}

function getSupportColor(support: number): string {
  if (support > 0.3) return 'var(--color-positive)';
  if (support < -0.3) return 'var(--color-danger)';
  return 'var(--color-muted)';
}

function formatSupport(support: number): string {
  const pct = (support * 100).toFixed(0);
  return support >= 0 ? `+${pct}%` : `${pct}%`;
}
</script>

<template>
  <div class="npc-influence-panel">
    <h2>Council Politics</h2>

    <!-- Active Project Status -->
    <section v-if="state.npcInfluence.activeProject" class="active-project">
      <h3>Active Proposal</h3>
      <div class="project-status">
        <strong>{{ state.npcInfluence.projects.find(p => p.id === state.npcInfluence.activeProject?.projectId)?.name }}</strong>
        <div class="status-row">
          <span>Average Support:
            <span :style="{ color: getSupportColor(state.npcInfluence.activeProject.averageSupport) }">
              {{ formatSupport(state.npcInfluence.activeProject.averageSupport) }}
            </span>
          </span>
          <span>Sols until vote: {{ state.npcInfluence.activeProject.solsRemaining }}</span>
        </div>
        <div class="threshold-bar">
          <div
            class="threshold-fill"
            :style="{
              width: `${Math.max(0, (state.npcInfluence.activeProject.averageSupport + 1) / 2 * 100)}%`,
              backgroundColor: getSupportColor(state.npcInfluence.activeProject.averageSupport)
            }"
          ></div>
          <div class="threshold-marker" style="left: 70%"></div>
        </div>
        <small>Need 40% average support to pass</small>
      </div>

      <!-- NPC Support List -->
      <h4>Council Members</h4>
      <div class="npc-list">
        <div
          v-for="npc in state.npcInfluence.npcs"
          :key="npc.id"
          class="npc-row"
          :class="{ selected: selectedNPCForLobby === npc.id }"
          @click="selectedNPCForLobby = npc.id"
        >
          <span class="npc-name">{{ npc.name }}</span>
          <span class="faction-badge" :style="{ backgroundColor: getFactionColor(npc.faction) }">
            {{ npc.faction }}
          </span>
          <span class="support-value" :style="{ color: getSupportColor(state.npcInfluence.activeProject.supportLevels[npc.id] || 0) }">
            {{ formatSupport(state.npcInfluence.activeProject.supportLevels[npc.id] || 0) }}
          </span>
        </div>
      </div>

      <!-- Lobbying Controls -->
      <div v-if="selectedNPCForLobby" class="lobby-controls">
        <h4>Lobby {{ state.npcInfluence.npcs.find(n => n.id === selectedNPCForLobby)?.name }}</h4>
        <div class="lobby-row">
          <label>
            Boost:
            <select v-model.number="lobbyAmount">
              <option :value="0.1">+10%</option>
              <option :value="0.2">+20%</option>
              <option :value="0.3">+30%</option>
              <option :value="0.5">+50%</option>
            </select>
          </label>
          <span>Cost: {{ lobbyCost }} materials</span>
          <button @click="lobbyNPC" :disabled="!canLobby">Lobby</button>
        </div>
      </div>
    </section>

    <!-- Propose New Project -->
    <section v-else class="propose-project">
      <h3>Propose a Project</h3>
      <div class="project-list">
        <div
          v-for="project in state.npcInfluence.projects"
          :key="project.id"
          class="project-option"
          :class="{ selected: selectedProject === project.id }"
          @click="selectedProject = project.id"
        >
          <strong>{{ project.name }}</strong>
          <span class="faction-badge" :style="{ backgroundColor: getFactionColor(project.type) }">
            {{ project.type }}
          </span>
          <p>{{ project.description }}</p>
          <small>Cost: {{ Object.entries(project.proposalCost).map(([k,v]) => `${v} ${k}`).join(', ') }}</small>
        </div>
      </div>
      <button @click="proposeProject" :disabled="!canProposeProject">
        Propose Selected Project
      </button>
    </section>

    <!-- Councils -->
    <section class="councils">
      <h3>Councils</h3>
      <div v-if="state.npcInfluence.councils.length === 0" class="empty-state">
        No councils formed yet.
      </div>
      <div v-else class="council-list">
        <div v-for="council in state.npcInfluence.councils" :key="council.id" class="council-item">
          <strong>{{ council.name }}</strong>
          <span>{{ council.memberIds.length }} members</span>
        </div>
      </div>

      <h4>Form New Council</h4>
      <input v-model="councilName" placeholder="Council name" />
      <div class="council-member-select">
        <div
          v-for="npc in state.npcInfluence.npcs"
          :key="npc.id"
          class="council-member-option"
          :class="{ selected: selectedCouncilMembers.includes(npc.id) }"
          @click="toggleCouncilMember(npc.id)"
        >
          {{ npc.name }}
        </div>
      </div>
      <button @click="createCouncil" :disabled="!canCreateCouncil">
        Create Council (50 materials)
      </button>
    </section>
  </div>
</template>

<style scoped>
.npc-influence-panel {
  padding: 1rem;
}

h2, h3, h4 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.active-project, .propose-project, .councils {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--color-muted);
  border-radius: 4px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  margin: 0.5rem 0;
}

.threshold-bar {
  position: relative;
  height: 20px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.threshold-fill {
  height: 100%;
  transition: width 0.3s;
}

.threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: white;
}

.npc-list, .project-list, .council-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.npc-row, .project-option, .council-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--color-muted);
  border-radius: 4px;
  cursor: pointer;
}

.npc-row:hover, .project-option:hover {
  background: rgba(255,255,255,0.05);
}

.npc-row.selected, .project-option.selected {
  border-color: var(--color-info);
}

.npc-name {
  flex: 1;
}

.faction-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.support-value {
  font-weight: bold;
  min-width: 50px;
  text-align: right;
}

.lobby-controls, .councils {
  margin-top: 1rem;
}

.lobby-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.council-member-select {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.council-member-option {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-muted);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.875rem;
}

.council-member-option.selected {
  border-color: var(--color-positive);
  background: rgba(0,255,0,0.1);
}

.project-option p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

button {
  margin-top: 0.5rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  color: var(--color-muted);
  font-style: italic;
}

input {
  padding: 0.5rem;
  margin: 0.5rem 0;
  width: 100%;
  box-sizing: border-box;
}
</style>
```

**Step 2: Run dev server and verify component renders**

```bash
bun run dev
```

Check browser for errors.

**Step 3: Commit**

```bash
git add src/renderer/components/NPCInfluencePanel.vue
git commit -m "feat(ui): create NPCInfluencePanel component"
```

---

## Task 14: Add Panel to Main Layout

**Files:**
- Modify: `src/renderer/App.vue` (or main layout component)

**Step 1: Import and add NPCInfluencePanel**

Find where other panels are imported and add:

```typescript
import NPCInfluencePanel from './components/NPCInfluencePanel.vue';
```

Add the component to the template where other panels are rendered:

```vue
<NPCInfluencePanel />
```

**Step 2: Run dev server and verify panel appears**

```bash
bun run dev
```

**Step 3: Commit**

```bash
git add src/renderer/App.vue
git commit -m "feat(ui): add NPCInfluencePanel to main layout"
```

---

## Task 15: Run Full Test Suite and Verify Build

**Step 1: Run all tests**

```bash
bun test
```

Expected: All tests PASS

**Step 2: Run linter**

```bash
bun run lint
```

Fix any issues.

**Step 3: Build production bundle**

```bash
bun run build
```

Expected: Build succeeds with no errors.

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore: fix lint issues and verify build"
```

---

## Summary

This plan implements the NPC Influence System in 15 tasks:

1. **Tasks 1-3**: Define models, balance constants, and NPC data
2. **Tasks 4-5**: Implement matrix math and support propagation
3. **Tasks 6-10**: Build NPCInfluenceManager with proposal, lobbying, councils, and tick
4. **Task 11**: Integrate with GameState game loop
5. **Tasks 12-14**: Add UI state, component, and panel integration
6. **Task 15**: Final verification

Each task follows TDD (write failing test → implement → verify → commit) and produces incremental, working code.
