# Politics System Simplification: NPC → Colonist Lobbying

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the old NPC-based politics system with colonist-based council lobbying while preserving the projects system.

**Architecture:** Remove NPCInfluenceManager's voting/NPC mechanics. Keep projects as simple threshold-based proposals checked against IdeologyManager's faction support. Add lobbying to IdeologyManager targeting council members - lobbying boosts a colonist's faction affinity which then spreads through the social network.

**Tech Stack:** TypeScript, Vue 3, existing IdeologyManager/IdeologyFacade patterns

---

## Overview

The old NPC system had 10 named NPCs with a complex voting matrix. The new ideology system has colonist-based faction support that spreads through social networks. This plan:

1. Adds colonist lobbying to IdeologyManager (boost council member's faction affinity)
2. Moves project data/types out of NPCInfluence into a standalone Projects system
3. Updates IdeologyFacade to expose lobbying and project eligibility
4. Updates PoliticsPanel UI to show lobbying controls for council members
5. Removes NPCInfluenceManager and related dead code

## File Summary

| Action | File |
|--------|------|
| Create | `src/core/data/projects.ts` |
| Create | `src/core/models/Project.ts` |
| Modify | `src/core/balance/IdeologyBalance.ts` |
| Modify | `src/core/systems/IdeologyManager.ts` |
| Modify | `src/facade/domains/IdeologyFacade.ts` |
| Modify | `src/facade/types/ideology.ts` |
| Modify | `src/renderer/components/PoliticsPanel/PoliticsPanel.vue` |
| Modify | `src/renderer/services/GameService.ts` |
| Modify | `src/core/GameState.ts` |
| Delete | `src/core/systems/NPCInfluenceManager.ts` |
| Delete | `src/core/balance/NPCInfluenceBalance.ts` |
| Delete | `src/core/data/npcs.ts` |
| Delete | `src/facade/domains/NPCFacade.ts` |
| Delete | `src/renderer/components/NPCInfluencePanel/` (entire directory) |
| Modify | `tests/IdeologyManager.test.ts` |
| Delete | `tests/NPCInfluenceManager.test.ts` |

---

## Task 1: Add Lobbying Balance Constants

**Files:**
- Modify: `src/core/balance/IdeologyBalance.ts`

**Step 1: Add lobbying constants to IdeologyBalance.ts**

Add after the existing constants:

```typescript
// ============ Lobbying ============

/** Base cost in materials to lobby a council member */
export const LOBBY_BASE_COST = 15;

/** How much lobbying boosts the target faction affinity (0-1 scale) */
export const LOBBY_AFFINITY_BOOST = 0.15;

/** Cost multiplier based on colonist's influence (higher influence = more expensive) */
export const LOBBY_INFLUENCE_COST_MULTIPLIER = 10;

/** Minimum affinity boost option */
export const LOBBY_MIN_BOOST = 0.05;

/** Maximum affinity boost option */
export const LOBBY_MAX_BOOST = 0.25;
```

**Step 2: Run lint to verify no syntax errors**

Run: `bun run lint`
Expected: PASS (no errors in IdeologyBalance.ts)

**Step 3: Commit**

```bash
git add src/core/balance/IdeologyBalance.ts
git commit -m "feat(ideology): add lobbying balance constants"
```

---

## Task 2: Create Standalone Project Types

**Files:**
- Create: `src/core/models/Project.ts`

**Step 1: Create Project.ts with types extracted from NPCInfluence**

```typescript
// src/core/models/Project.ts

import type { ResourceDelta } from "./Resources";
import { NPCFaction } from "./NPCInfluence";

/**
 * Project identifiers for political projects.
 */
export enum ProjectId {
  // Earth Loyalists
  GENERATION_SHIP = "generation_ship",
  EARTH_MEMORIAL = "earth_memorial",
  HERITAGE_ARCHIVE = "heritage_archive",
  // Mars Independence
  UNIVERSAL_HOUSING = "universal_housing",
  HEALTHCARE_EXPANSION = "healthcare_expansion",
  // Corporate Interests
  AI_GOVERNANCE = "ai_governance",
  MINING_CONCESSION = "mining_concession",
  LABOR_EFFICIENCY = "labor_efficiency",
}

/**
 * A political project that can be proposed when faction support is sufficient.
 */
export interface Project {
  id: ProjectId;
  name: string;
  description: string;
  /** Which faction this project belongs to */
  faction: NPCFaction;
  /** Resource cost to propose the project */
  proposalCost: ResourceDelta;
  /** Minimum faction support required (0-1) */
  requiredSupport: number;
  /** Optional effects when the project passes */
  effects?: {
    unlockBuilding?: string;
    unlockTech?: string;
  };
}

/**
 * Tier of project based on required support level.
 */
export type ProjectTier = "minor" | "major" | "victory";

/**
 * Get the tier of a project based on its required support.
 */
export function getProjectTier(requiredSupport: number): ProjectTier {
  if (requiredSupport >= 0.5) return "victory";
  if (requiredSupport >= 0.35) return "major";
  return "minor";
}
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/models/Project.ts
git commit -m "feat(projects): extract project types to standalone module"
```

---

## Task 3: Create Projects Data File

**Files:**
- Create: `src/core/data/projects.ts`

**Step 1: Create projects.ts with project definitions**

```typescript
// src/core/data/projects.ts

import { NPCFaction } from "../models/NPCInfluence";
import { type Project, ProjectId } from "../models/Project";

export const PROJECTS: Project[] = [
  // Earth Loyalists projects
  {
    id: ProjectId.GENERATION_SHIP,
    name: "Build Generation Ship",
    description: "Begin construction of an interstellar colony ship.",
    faction: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 100 },
    requiredSupport: 0.5,
    effects: { unlockBuilding: "shipyard" },
  },
  {
    id: ProjectId.EARTH_MEMORIAL,
    name: "Earth Memorial",
    description: "Build a memorial to honor our home planet.",
    faction: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 40 },
    requiredSupport: 0.2,
  },
  {
    id: ProjectId.HERITAGE_ARCHIVE,
    name: "Heritage Archive",
    description: "Preserve Earth cultures and traditions.",
    faction: NPCFaction.EarthLoyalists,
    proposalCost: { materials: 50 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "archive" },
  },

  // Mars Independence projects
  {
    id: ProjectId.UNIVERSAL_HOUSING,
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    faction: NPCFaction.MarsIndependence,
    proposalCost: { materials: 80 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "housing_complex" },
  },
  {
    id: ProjectId.HEALTHCARE_EXPANSION,
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access.",
    faction: NPCFaction.MarsIndependence,
    proposalCost: { materials: 60, water: 30 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "medical_center" },
  },

  // Corporate Interests projects
  {
    id: ProjectId.AI_GOVERNANCE,
    name: "AI-Assisted Governance",
    description: "Implement AI systems to help with colony decision-making.",
    faction: NPCFaction.CorporateInterests,
    proposalCost: { materials: 50, power: 50 },
    requiredSupport: 0.35,
    effects: { unlockTech: "advanced_ai" },
  },
  {
    id: ProjectId.MINING_CONCESSION,
    name: "Mining Concession",
    description: "Grant exclusive extraction rights to corporate partners.",
    faction: NPCFaction.CorporateInterests,
    proposalCost: { materials: 60 },
    requiredSupport: 0.35,
    effects: { unlockBuilding: "efficient_mine" },
  },
  {
    id: ProjectId.LABOR_EFFICIENCY,
    name: "Labor Efficiency Program",
    description: "Controversial productivity initiative that increases output.",
    faction: NPCFaction.CorporateInterests,
    proposalCost: { materials: 40 },
    requiredSupport: 0.2,
  },
];

/**
 * Get a project by its ID.
 */
export function getProject(id: ProjectId): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

/**
 * Get all projects for a specific faction.
 */
export function getProjectsByFaction(faction: NPCFaction): Project[] {
  return PROJECTS.filter((p) => p.faction === faction);
}
```

**Step 2: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/data/projects.ts
git commit -m "feat(projects): add projects data file"
```

---

## Task 4: Add Lobbying to IdeologyManager

**Files:**
- Modify: `src/core/systems/IdeologyManager.ts`
- Test: `tests/IdeologyManager.test.ts`

**Step 1: Write failing tests for lobbying**

Add to `tests/IdeologyManager.test.ts`:

```typescript
describe("Lobbying", () => {
  it("should calculate lobby cost based on colonist influence", () => {
    const manager = new IdeologyManager();
    const colonists = createTestColonists(10);
    const relationshipManager = createTestRelationshipManager(colonists);

    // Select council first
    manager.selectCouncil(colonists, relationshipManager, 0);
    const council = manager.getCouncil();
    expect(council.length).toBeGreaterThan(0);

    const firstMember = council[0]!;
    const cost = manager.getLobbyCost(firstMember.colonistId, NPCFaction.EarthLoyalists, 0.15);

    // Cost should be positive and scale with influence
    expect(cost).toBeGreaterThan(0);
  });

  it("should boost colonist faction affinity when lobbied", () => {
    const manager = new IdeologyManager();
    const colonists = createTestColonists(10);
    const relationshipManager = createTestRelationshipManager(colonists);

    manager.selectCouncil(colonists, relationshipManager, 0);
    const council = manager.getCouncil();
    const targetMember = council[0]!;
    const targetColonist = colonists.find((c) => c.id === targetMember.colonistId)!;
    const originalAffinity = targetColonist.ideology!.earthLoyalist;

    const result = manager.lobbyColonist(
      targetMember.colonistId,
      NPCFaction.EarthLoyalists,
      0.15,
      colonists,
    );

    expect(result.success).toBe(true);
    expect(targetColonist.ideology!.earthLoyalist).toBeGreaterThan(originalAffinity);
  });

  it("should fail to lobby non-council member", () => {
    const manager = new IdeologyManager();
    const colonists = createTestColonists(10);
    const relationshipManager = createTestRelationshipManager(colonists);

    manager.selectCouncil(colonists, relationshipManager, 0);
    const council = manager.getCouncil();
    const nonMember = colonists.find((c) => !council.some((m) => m.colonistId === c.id))!;

    const result = manager.lobbyColonist(
      nonMember.id,
      NPCFaction.EarthLoyalists,
      0.15,
      colonists,
    );

    expect(result.success).toBe(false);
    expect(result.reason).toContain("council");
  });

  it("should clamp affinity to max 1.0", () => {
    const manager = new IdeologyManager();
    const colonists = createTestColonists(10);
    // Set first colonist to high affinity
    colonists[0]!.ideology!.earthLoyalist = 0.95;
    colonists[0]!.ideology!.conviction = 0.9; // High conviction for council selection
    const relationshipManager = createTestRelationshipManager(colonists);

    manager.selectCouncil(colonists, relationshipManager, 0);

    const result = manager.lobbyColonist(
      colonists[0]!.id,
      NPCFaction.EarthLoyalists,
      0.15,
      colonists,
    );

    expect(result.success).toBe(true);
    expect(colonists[0]!.ideology!.earthLoyalist).toBe(1.0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test tests/IdeologyManager.test.ts`
Expected: FAIL (lobbyColonist and getLobbyCost not defined)

**Step 3: Implement lobbying methods in IdeologyManager**

Add to `src/core/systems/IdeologyManager.ts` after the project morale effects section:

```typescript
// ============ Lobbying ============

/**
 * Result of a lobby attempt.
 */
export interface LobbyResult {
  success: boolean;
  reason?: string;
  newAffinity?: number;
}

// Add these methods to the IdeologyManager class:

/**
 * Calculate the cost in materials to lobby a council member.
 * Cost scales with the colonist's influence (centrality × conviction).
 */
getLobbyCost(colonistId: string, _faction: NPCFaction, affinityBoost: number): number {
  const member = this.council.find((m) => m.colonistId === colonistId);
  if (!member) return Infinity;

  // Base cost + influence scaling
  const influenceCost = member.influence * IdeologyBalance.LOBBY_INFLUENCE_COST_MULTIPLIER;
  const boostMultiplier = affinityBoost / IdeologyBalance.LOBBY_AFFINITY_BOOST;

  return Math.ceil(IdeologyBalance.LOBBY_BASE_COST + influenceCost * boostMultiplier);
}

/**
 * Lobby a council member to boost their affinity for a faction.
 * The boosted affinity will naturally spread through the social network.
 */
lobbyColonist(
  colonistId: string,
  faction: NPCFaction,
  affinityBoost: number,
  colonists: Colonist[],
): LobbyResult {
  // Verify target is a council member
  const member = this.council.find((m) => m.colonistId === colonistId);
  if (!member) {
    return { success: false, reason: "Target is not a council member" };
  }

  // Find the colonist
  const colonist = colonists.find((c) => c.id === colonistId);
  if (!colonist || !colonist.ideology) {
    return { success: false, reason: "Colonist not found or has no ideology" };
  }

  // Apply the affinity boost
  const factionKey = IdeologyManager.factionToKey(faction);
  const currentAffinity = colonist.ideology[factionKey];
  const newAffinity = Math.min(1.0, currentAffinity + affinityBoost);
  colonist.ideology[factionKey] = newAffinity;

  return { success: true, newAffinity };
}

/**
 * Check if a colonist can be lobbied (must be council member).
 */
canLobby(colonistId: string): { canLobby: boolean; reason?: string } {
  const member = this.council.find((m) => m.colonistId === colonistId);
  if (!member) {
    return { canLobby: false, reason: "Target is not a council member" };
  }
  return { canLobby: true };
}
```

Also add the import at the top:
```typescript
import * as IdeologyBalance from "../balance/IdeologyBalance";
```

**Step 4: Run tests to verify they pass**

Run: `bun test tests/IdeologyManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/systems/IdeologyManager.ts tests/IdeologyManager.test.ts
git commit -m "feat(ideology): add lobbying mechanics to IdeologyManager"
```

---

## Task 5: Update IdeologyFacade for Lobbying

**Files:**
- Modify: `src/facade/domains/IdeologyFacade.ts`
- Modify: `src/facade/types/ideology.ts`

**Step 1: Add lobby types to ideology.ts**

Add to `src/facade/types/ideology.ts`:

```typescript
import type { NPCFaction } from "../../core/models/NPCInfluence";
import type { Project, ProjectId, ProjectTier } from "../../core/models/Project";

// ... existing types ...

/**
 * Lobby action eligibility check result.
 */
export interface LobbyEligibility {
  canLobby: boolean;
  cost: number;
  reason?: string;
}

/**
 * Project with current eligibility status.
 */
export interface ProjectSnapshot extends Project {
  tier: ProjectTier;
  currentSupport: number;
  canPropose: boolean;
  reason?: string;
}
```

**Step 2: Update IdeologyFacade with lobbying methods**

Replace `src/facade/domains/IdeologyFacade.ts`:

```typescript
// src/facade/domains/IdeologyFacade.ts

import type { GameState } from "../../core/GameState";
import { NPCFaction } from "../../core/models/NPCInfluence";
import { type Project, ProjectId, getProjectTier } from "../../core/models/Project";
import { PROJECTS, getProject } from "../../core/data/projects";
import type { Queryable, Result } from "../types/interfaces";
import type {
  IdeologySnapshot,
  FactionSupportSnapshot,
  CouncilMemberSnapshot,
  ProjectEligibility,
  LobbyEligibility,
  ProjectSnapshot,
} from "../types/ideology";

/**
 * Facade for ideology system queries and commands.
 * Provides access to council, faction support, lobbying, and project eligibility.
 */
export class IdeologyFacade implements Queryable<IdeologySnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete ideology state snapshot.
   */
  snapshot(): IdeologySnapshot {
    const council = this.getCouncil();
    const councilFactionCounts = this.gameState.ideology.getCouncilFactionCounts();
    const factionSupport = this.getFactionSupport();

    return {
      council,
      councilFactionCounts,
      factionSupport,
    };
  }

  /**
   * Get current council members.
   */
  getCouncil(): CouncilMemberSnapshot[] {
    return [...this.gameState.ideology.getCouncil()];
  }

  /**
   * Get colony-wide faction support levels.
   */
  getFactionSupport(): FactionSupportSnapshot {
    const colonists = this.gameState.colony.getColonists();
    const relationshipManager = this.gameState.workforce.getRelationshipManager();

    return this.gameState.ideology.calculateFactionSupport(colonists, relationshipManager);
  }

  /**
   * Get support level for a specific faction.
   */
  getFactionSupportFor(faction: NPCFaction): number {
    const support = this.getFactionSupport();
    switch (faction) {
      case NPCFaction.EarthLoyalists:
        return support.earthLoyalists;
      case NPCFaction.MarsIndependence:
        return support.marsIndependence;
      case NPCFaction.CorporateInterests:
        return support.corporateInterests;
    }
  }

  // ============ Projects ============

  /**
   * Get all available projects with their current status.
   */
  getProjects(): ProjectSnapshot[] {
    return PROJECTS.map((project) => {
      const currentSupport = this.getFactionSupportFor(project.faction);
      const canAfford = this.gameState.resources.canAfford(project.proposalCost);
      const hasEnoughSupport = currentSupport >= project.requiredSupport;

      let reason: string | undefined;
      if (!canAfford) {
        reason = "Cannot afford proposal cost";
      } else if (!hasEnoughSupport) {
        reason = `Need ${Math.round(project.requiredSupport * 100)}% support (have ${Math.round(currentSupport * 100)}%)`;
      }

      return {
        ...project,
        tier: getProjectTier(project.requiredSupport),
        currentSupport,
        canPropose: canAfford && hasEnoughSupport,
        reason,
      };
    });
  }

  /**
   * Get a specific project by ID.
   */
  getProject(projectId: ProjectId): Project | undefined {
    return getProject(projectId);
  }

  /**
   * Check if a project can be proposed.
   */
  canProposeProject(projectId: ProjectId): ProjectEligibility {
    const project = getProject(projectId);
    if (!project) {
      return {
        canPropose: false,
        currentSupport: 0,
        requiredSupport: 0,
        reason: "Project not found",
      };
    }

    const currentSupport = this.getFactionSupportFor(project.faction);
    const canAfford = this.gameState.resources.canAfford(project.proposalCost);
    const hasEnoughSupport = currentSupport >= project.requiredSupport;

    let reason: string | undefined;
    if (!canAfford) {
      reason = "Cannot afford proposal cost";
    } else if (!hasEnoughSupport) {
      reason = `Need ${Math.round(project.requiredSupport * 100)}% support`;
    }

    return {
      canPropose: canAfford && hasEnoughSupport,
      currentSupport,
      requiredSupport: project.requiredSupport,
      reason,
    };
  }

  /**
   * Propose a project (deducts cost, applies effects).
   */
  proposeProject(projectId: ProjectId): Result<{ project: Project }> {
    const eligibility = this.canProposeProject(projectId);
    if (!eligibility.canPropose) {
      return { success: false, error: { type: "validation", message: eligibility.reason || "Cannot propose" } };
    }

    const project = getProject(projectId)!;
    this.gameState.resources.deduct(project.proposalCost);

    // Apply morale effects
    const colonists = this.gameState.colony.getColonists();
    this.gameState.ideology.applyProjectMoraleEffects(project.faction, colonists, this.gameState.colonistMorale);

    // TODO: Apply project effects (unlock buildings/tech)

    return { success: true, data: { project } };
  }

  // ============ Lobbying ============

  /**
   * Check if a council member can be lobbied.
   */
  canLobby(colonistId: string, faction: NPCFaction, affinityBoost: number): LobbyEligibility {
    const check = this.gameState.ideology.canLobby(colonistId);
    if (!check.canLobby) {
      return { canLobby: false, cost: Infinity, reason: check.reason };
    }

    const cost = this.gameState.ideology.getLobbyCost(colonistId, faction, affinityBoost);
    const canAfford = this.gameState.resources.canAfford({ materials: cost });

    if (!canAfford) {
      return { canLobby: false, cost, reason: "Cannot afford lobbying cost" };
    }

    return { canLobby: true, cost };
  }

  /**
   * Get the cost to lobby a council member.
   */
  getLobbyCost(colonistId: string, faction: NPCFaction, affinityBoost: number): number {
    return this.gameState.ideology.getLobbyCost(colonistId, faction, affinityBoost);
  }

  /**
   * Lobby a council member to boost their faction affinity.
   */
  lobbyCouncilMember(
    colonistId: string,
    faction: NPCFaction,
    affinityBoost: number,
  ): Result<{ newAffinity: number }> {
    const eligibility = this.canLobby(colonistId, faction, affinityBoost);
    if (!eligibility.canLobby) {
      return { success: false, error: { type: "validation", message: eligibility.reason || "Cannot lobby" } };
    }

    // Deduct cost
    this.gameState.resources.deduct({ materials: eligibility.cost });

    // Apply lobby effect
    const colonists = this.gameState.colony.getColonists();
    const result = this.gameState.ideology.lobbyColonist(colonistId, faction, affinityBoost, colonists);

    if (!result.success) {
      return { success: false, error: { type: "validation", message: result.reason || "Lobby failed" } };
    }

    return { success: true, data: { newAffinity: result.newAffinity! } };
  }
}
```

**Step 3: Run lint and type check**

Run: `bun run lint && bunx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add src/facade/domains/IdeologyFacade.ts src/facade/types/ideology.ts
git commit -m "feat(facade): add lobbying and project methods to IdeologyFacade"
```

---

## Task 6: Update GameService for Lobbying

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Add lobbying methods to GameService**

Add these methods to the GameService class (in the Legacy API section):

```typescript
// Ideology/Lobbying actions
lobbyCouncilMember(colonistId: string, faction: NPCFaction, affinityBoost: number): boolean {
  const result = this.facade.ideology.lobbyCouncilMember(colonistId, faction, affinityBoost);
  return result.success;
}

getCouncilLobbyCost(colonistId: string, faction: NPCFaction, affinityBoost: number): number {
  return this.facade.ideology.getLobbyCost(colonistId, faction, affinityBoost);
}

canLobbyCouncilMember(colonistId: string, faction: NPCFaction, affinityBoost: number): boolean {
  return this.facade.ideology.canLobby(colonistId, faction, affinityBoost).canLobby;
}
```

Also add import:
```typescript
import { NPCFaction } from "../../core/models/NPCInfluence";
```

**Step 2: Remove old NPC lobbying methods**

Remove these methods from GameService:
- `lobbyNPC`
- `getLobbyCost`
- `createCouncil`

**Step 3: Update npcInfluence state sync to remove NPC-specific data**

This will be done in Task 9 when we remove NPCInfluenceManager entirely. For now, leave the state sync as is.

**Step 4: Commit**

```bash
git add src/renderer/services/GameService.ts
git commit -m "feat(service): add lobbying methods, remove old NPC lobby methods"
```

---

## Task 7: Update PoliticsPanel with Lobbying UI

**Files:**
- Modify: `src/renderer/components/PoliticsPanel/PoliticsPanel.vue`

**Step 1: Add lobbying controls to PoliticsPanel**

Replace `src/renderer/components/PoliticsPanel/PoliticsPanel.vue`:

```vue
<script setup lang="ts">
import { computed, ref } from "vue";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel, GButton, GSelect } from "../../ui";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";

const state = gameService.getState();

// Selected council member for lobbying
const selectedMemberId = ref<string | null>(null);
const selectedFaction = ref<NPCFaction>(NPCFaction.EarthLoyalists);
const lobbyBoost = ref(0.1);

// Lobby boost options
const lobbyOptions: SelectOption[] = [
  { label: "Small (+5%)", value: 0.05 },
  { label: "Medium (+10%)", value: 0.1 },
  { label: "Large (+15%)", value: 0.15 },
  { label: "Major (+20%)", value: 0.2 },
];

// Faction options for lobbying
const factionOptions: SelectOption[] = [
  { label: "Earth Loyalists", value: NPCFaction.EarthLoyalists },
  { label: "Mars Independence", value: NPCFaction.MarsIndependence },
  { label: "Corporate Interests", value: NPCFaction.CorporateInterests },
];

// Map ideology support to display format
const factionData = computed(() => [
  {
    id: NPCFaction.EarthLoyalists,
    name: "Earth Loyalists",
    support: state.ideology.factionSupport.earthLoyalists,
    councilSeats: state.ideology.councilFactionCounts[NPCFaction.EarthLoyalists] ?? 0,
  },
  {
    id: NPCFaction.MarsIndependence,
    name: "Mars Independence",
    support: state.ideology.factionSupport.marsIndependence,
    councilSeats: state.ideology.councilFactionCounts[NPCFaction.MarsIndependence] ?? 0,
  },
  {
    id: NPCFaction.CorporateInterests,
    name: "Corporate Interests",
    support: state.ideology.factionSupport.corporateInterests,
    councilSeats: state.ideology.councilFactionCounts[NPCFaction.CorporateInterests] ?? 0,
  },
]);

const selectedMember = computed(() => {
  if (!selectedMemberId.value) return null;
  return state.ideology.council.find((m) => m.colonistId === selectedMemberId.value) ?? null;
});

const lobbyCost = computed(() => {
  if (!selectedMemberId.value) return 0;
  return gameService.getCouncilLobbyCost(selectedMemberId.value, selectedFaction.value, lobbyBoost.value);
});

const canLobby = computed(() => {
  if (!selectedMemberId.value) return false;
  return gameService.canLobbyCouncilMember(selectedMemberId.value, selectedFaction.value, lobbyBoost.value);
});

function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}

function getSupportColor(support: number): string {
  if (support >= 0.5) return "var(--color-positive)";
  if (support >= 0.35) return "var(--color-info)";
  if (support >= 0.2) return "var(--color-warning)";
  return "var(--color-muted)";
}

function getFactionColor(factionId: string): string {
  switch (factionId) {
    case NPCFaction.EarthLoyalists:
      return "var(--color-info)";
    case NPCFaction.MarsIndependence:
      return "var(--color-positive)";
    case NPCFaction.CorporateInterests:
      return "var(--color-warning)";
    default:
      return "var(--color-muted)";
  }
}

function selectMember(colonistId: string) {
  selectedMemberId.value = selectedMemberId.value === colonistId ? null : colonistId;
}

function handleLobby() {
  if (!selectedMemberId.value) return;
  const success = gameService.lobbyCouncilMember(selectedMemberId.value, selectedFaction.value, lobbyBoost.value);
  if (success) {
    // Optionally clear selection or show feedback
  }
}

function handleBoostChange(value: string | number) {
  lobbyBoost.value = Number(value);
}

function handleFactionChange(value: string | number) {
  selectedFaction.value = value as NPCFaction;
}
</script>

<template>
  <GPanel title="Faction Support" accent="slate">
    <div class="factions">
      <div v-for="faction in factionData" :key="faction.id" class="faction-card">
        <div class="faction-header">
          <span class="faction-name" :style="{ color: getFactionColor(faction.id) }">
            {{ faction.name }}
          </span>
          <span class="faction-support" :style="{ color: getSupportColor(faction.support) }">
            {{ formatSupport(faction.support) }}
          </span>
        </div>

        <div class="support-bar">
          <div
            class="support-fill"
            :style="{
              width: `${faction.support * 100}%`,
              backgroundColor: getFactionColor(faction.id),
            }"
          />
          <div class="threshold-marker" style="left: 20%" title="Minor projects (20%)" />
          <div class="threshold-marker" style="left: 35%" title="Major projects (35%)" />
          <div class="threshold-marker" style="left: 50%" title="Victory projects (50%)" />
        </div>

        <div class="faction-details">
          <span class="council-seats">{{ faction.councilSeats }} council seat{{ faction.councilSeats !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- Council Members -->
    <div v-if="state.ideology.council.length > 0" class="council-section">
      <h3 class="section-title">Council Members</h3>
      <p class="section-hint">Click a council member to lobby them</p>
      <div class="council-list">
        <div
          v-for="member in state.ideology.council"
          :key="member.colonistId"
          class="council-member"
          :class="{ selected: selectedMemberId === member.colonistId }"
          :style="{ borderLeftColor: member.faction ? getFactionColor(member.faction) : 'var(--color-muted)' }"
          @click="selectMember(member.colonistId)"
        >
          <span class="member-name">{{ member.name }}</span>
          <span class="member-influence">{{ (member.influence * 100).toFixed(0) }}</span>
        </div>
      </div>

      <!-- Lobby Controls -->
      <div v-if="selectedMember" class="lobby-section">
        <h4 class="subsection-title">Lobby {{ selectedMember.name }}</h4>
        <div class="lobby-controls">
          <div class="lobby-field">
            <label class="field-label">Faction</label>
            <GSelect
              :model-value="selectedFaction"
              :options="factionOptions"
              size="sm"
              @update:model-value="handleFactionChange"
            />
          </div>
          <div class="lobby-field">
            <label class="field-label">Boost</label>
            <GSelect
              :model-value="lobbyBoost"
              :options="lobbyOptions"
              size="sm"
              @update:model-value="handleBoostChange"
            />
          </div>
          <div class="lobby-cost">
            <span class="field-label">Cost</span>
            <span class="cost-value">{{ lobbyCost }} materials</span>
          </div>
          <GButton variant="primary" size="sm" :disabled="!canLobby" @click="handleLobby">
            Lobby
          </GButton>
        </div>
        <p class="lobby-hint">
          Lobbying increases their {{ selectedFaction.replace('_', ' ') }} affinity, which spreads through their social network.
        </p>
      </div>
    </div>

    <p class="hint">
      Colonist ideology spreads through social networks. Lobby council members to shift faction support.
    </p>
  </GPanel>
</template>

<style scoped>
.factions {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.faction-card {
  padding: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--g-space-sm);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.faction-support {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.support-bar {
  position: relative;
  height: 8px;
  background: var(--g-color-text-muted);
  overflow: visible;
}

.support-fill {
  height: 100%;
  transition: width 0.3s;
}

.threshold-marker {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  background: var(--g-color-bg-base);
  opacity: 0.5;
}

.faction-details {
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.council-seats {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.council-section {
  margin-top: var(--g-space-lg);
  padding-top: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.section-title {
  margin: 0 0 var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.section-hint {
  margin: 0 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.council-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.council-member {
  display: flex;
  justify-content: space-between;
  padding: var(--g-space-xs) var(--g-space-sm);
  border-left: 3px solid;
  background: var(--g-color-bg-elevated);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.council-member:hover {
  background: var(--g-color-bg-surface);
}

.council-member.selected {
  background: var(--g-color-bg-surface);
  outline: 1px solid var(--g-color-border-strong);
}

.member-name {
  color: var(--g-color-text);
}

.member-influence {
  color: var(--g-color-text-muted);
}

.lobby-section {
  margin-top: var(--g-space-md);
  padding: var(--g-space-md);
  background: var(--g-color-bg-surface);
}

.subsection-title {
  margin: 0 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.lobby-controls {
  display: flex;
  align-items: flex-end;
  gap: var(--g-space-md);
  flex-wrap: wrap;
}

.lobby-field {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.field-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
}

.lobby-cost {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.cost-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-warning);
}

.lobby-hint {
  margin: var(--g-space-sm) 0 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}
</style>
```

**Step 2: Run dev server and manually test**

Run: `bun run dev`
Test: Navigate to politics panel, verify council members are clickable, lobbying controls appear

**Step 3: Commit**

```bash
git add src/renderer/components/PoliticsPanel/PoliticsPanel.vue
git commit -m "feat(ui): add lobbying controls to PoliticsPanel"
```

---

## Task 8: Update GameState to Use New Projects

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Update imports to use new Project module**

Replace the import from npcs.ts:
```typescript
// Remove this:
import { INITIAL_RELATIONSHIPS, NPCS, PROJECTS } from "./data/npcs";

// Keep only what's needed for backwards compatibility during transition:
import { INITIAL_RELATIONSHIPS, NPCS } from "./data/npcs";
```

**Step 2: Update NPCInfluenceManager usage**

For now, keep NPCInfluenceManager instantiation but note it will be removed in Task 9.

**Step 3: Commit**

```bash
git add src/core/GameState.ts
git commit -m "refactor(state): prepare GameState for NPC removal"
```

---

## Task 9: Remove NPCInfluenceManager and Related Code

**Files:**
- Delete: `src/core/systems/NPCInfluenceManager.ts`
- Delete: `src/core/balance/NPCInfluenceBalance.ts`
- Delete: `src/core/data/npcs.ts`
- Delete: `src/facade/domains/NPCFacade.ts`
- Delete: `tests/NPCInfluenceManager.test.ts`
- Modify: `src/core/GameState.ts`
- Modify: `src/renderer/services/GameService.ts`
- Modify: `src/facade/GameAPI.ts`
- Modify: Various imports

**Step 1: Remove NPCInfluenceManager from GameState**

In `src/core/GameState.ts`:
- Remove `npcInfluence` property
- Remove `NPCInfluenceManager` import
- Remove `NPCS`, `INITIAL_RELATIONSHIPS`, `PROJECTS` imports from npcs.ts
- Remove `npcInfluence` from constructor
- Remove `npcInfluence` from tick context
- Remove `npcInfluence` from toJSON/fromJSON

**Step 2: Remove NPCFacade from GameAPI**

In `src/facade/GameAPI.ts`:
- Remove `npc` property and NPCFacade import
- Remove npc-related methods

**Step 3: Remove NPC state from GameService**

In `src/renderer/services/GameService.ts`:
- Remove `npcInfluence` from GameUIState interface
- Remove NPC-related methods
- Remove NPC state sync from syncState()

**Step 4: Delete files**

```bash
rm src/core/systems/NPCInfluenceManager.ts
rm src/core/balance/NPCInfluenceBalance.ts
rm src/core/data/npcs.ts
rm src/facade/domains/NPCFacade.ts
rm tests/NPCInfluenceManager.test.ts
rm -rf src/renderer/components/NPCInfluencePanel/
```

**Step 5: Fix remaining imports**

Search for any remaining imports of deleted modules and update or remove them.

**Step 6: Run lint and tests**

Run: `bun run lint && bun test`
Expected: PASS (with some tests removed)

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove NPCInfluenceManager and related NPC code

BREAKING: Removes the old NPC-based politics system in favor of
colonist-based ideology with council lobbying.

- Delete NPCInfluenceManager and NPCInfluenceBalance
- Delete NPCFacade and NPC data
- Delete NPCInfluencePanel UI components
- Clean up GameState, GameAPI, GameService
- Remove NPC tests"
```

---

## Task 10: Clean Up and Final Testing

**Step 1: Run full test suite**

Run: `bun test`
Expected: PASS

**Step 2: Run type check**

Run: `bunx tsc --noEmit`
Expected: PASS

**Step 3: Run lint**

Run: `bun run lint`
Expected: PASS

**Step 4: Manual testing**

Run: `bun run dev`
Test:
- Politics panel shows faction support
- Council members are displayed
- Can click council member to select
- Lobbying controls appear with faction/boost options
- Can lobby (if have materials)
- Faction support changes over time as ideology spreads

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues from final testing"
```

---

## Summary

This plan:
1. **Adds lobbying to IdeologyManager** - Council members can be lobbied to boost their faction affinity
2. **Extracts projects** - Project types and data moved to standalone modules
3. **Updates UI** - PoliticsPanel now shows lobbying controls for council members
4. **Removes NPC system** - NPCInfluenceManager and all related code deleted

The new system is simpler:
- Faction support comes from colonist ideology (weighted by centrality)
- Council is auto-selected from high-influence colonists
- Lobbying boosts a council member's affinity, which spreads through the social network
- Projects are threshold-based (just need enough faction support)
