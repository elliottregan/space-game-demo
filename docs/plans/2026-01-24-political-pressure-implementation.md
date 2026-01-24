# Political Pressure System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the dual politics systems with a unified NPC-based political pressure system that creates late-game challenge through faction demands.

**Architecture:** Consolidate PoliticsEngine into NPCInfluenceManager. Rename NPC factions to match game lore. Add decay/demand mechanics that force players to engage with the project system.

**Tech Stack:** TypeScript, Bun test runner, Vue 3 (renderer updates)

---

## Task 1: Update NPCFaction Type

**Files:**
- Modify: `src/core/models/NPCInfluence.ts:3`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('faction types', () => {
  it('should have NPCs in earth_loyalists, mars_independence, and corporate_interests factions', () => {
    const npcs = manager.getNPCs();
    const factions = new Set(npcs.map(n => n.faction));
    expect(factions.has('earth_loyalists')).toBe(true);
    expect(factions.has('mars_independence')).toBe(true);
    expect(factions.has('corporate_interests')).toBe(true);
    expect(factions.size).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction types"`
Expected: FAIL - factions are still futurist/progressive/traditionalist

**Step 3: Update the NPCFaction type**

In `src/core/models/NPCInfluence.ts`, change:

```typescript
export type NPCFaction = "earth_loyalists" | "mars_independence" | "corporate_interests";
```

Also update ProjectType to match:

```typescript
export type ProjectType = "earth_loyalists" | "mars_independence" | "corporate_interests";
```

**Step 4: Run test - still fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction types"`
Expected: FAIL - NPC data still uses old faction names

**Step 5: Commit type changes**

```bash
git add src/core/models/NPCInfluence.ts
git commit -m "refactor: rename NPCFaction types to match game lore"
```

---

## Task 2: Update NPC Data

**Files:**
- Modify: `src/core/data/npcs.ts`

**Step 1: Update NPC faction assignments**

In `src/core/data/npcs.ts`, update all NPCs:

```typescript
export const NPCS: NPC[] = [
  // Earth Loyalists (3) - formerly futurist
  { id: "chen_wei", name: "Dr. Chen Wei", faction: "earth_loyalists", influence: 1.5 },
  { id: "nova_silva", name: "Nova Silva", faction: "earth_loyalists", influence: 1.0 },
  { id: "alex_okonkwo", name: "Alex Okonkwo", faction: "earth_loyalists", influence: 1.2 },

  // Mars Independence (4) - formerly progressive
  { id: "maria_santos", name: "Maria Santos", faction: "mars_independence", influence: 1.3 },
  { id: "james_liu", name: "James Liu", faction: "mars_independence", influence: 1.0 },
  { id: "aisha_patel", name: "Aisha Patel", faction: "mars_independence", influence: 1.1 },
  { id: "marcus_reed", name: "Marcus Reed", faction: "mars_independence", influence: 0.9 },

  // Corporate Interests (3) - formerly traditionalist
  { id: "elena_volkov", name: "Elena Volkov", faction: "corporate_interests", influence: 1.4 },
  { id: "david_morrison", name: "David Morrison", faction: "corporate_interests", influence: 1.0 },
  { id: "sarah_chen", name: "Sarah Chen", faction: "corporate_interests", influence: 1.1 },
];
```

**Step 2: Run faction test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction types"`
Expected: PASS

**Step 3: Commit NPC data changes**

```bash
git add src/core/data/npcs.ts
git commit -m "refactor: reassign NPCs to renamed factions"
```

---

## Task 3: Update Project Assignments

**Files:**
- Modify: `src/core/data/npcs.ts`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('project assignments', () => {
  it('should have projects for each faction', () => {
    const projects = manager.getProjects();
    const earthProjects = projects.filter(p => p.type === 'earth_loyalists');
    const marsProjects = projects.filter(p => p.type === 'mars_independence');
    const corpProjects = projects.filter(p => p.type === 'corporate_interests');

    expect(earthProjects.length).toBeGreaterThanOrEqual(2);
    expect(marsProjects.length).toBeGreaterThanOrEqual(2);
    expect(corpProjects.length).toBeGreaterThanOrEqual(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "project assignments"`
Expected: FAIL - projects still use old faction types

**Step 3: Update project assignments**

In `src/core/data/npcs.ts`, update PROJECTS:

```typescript
export const PROJECTS: Project[] = [
  // Earth Loyalists projects
  {
    id: "generation_ship",
    name: "Build Generation Ship",
    description: "Begin construction of an interstellar colony ship.",
    type: "earth_loyalists",
    proposalCost: { materials: 100 },
    effects: { unlockBuilding: "shipyard" },
  },
  {
    id: "earth_memorial",
    name: "Earth Memorial",
    description: "Build a memorial to honor our home planet.",
    type: "earth_loyalists",
    proposalCost: { materials: 40 },
  },
  {
    id: "heritage_archive",
    name: "Heritage Archive",
    description: "Preserve Earth cultures and traditions.",
    type: "earth_loyalists",
    proposalCost: { materials: 50 },
    effects: { unlockBuilding: "archive" },
  },

  // Mars Independence projects
  {
    id: "universal_housing",
    name: "Universal Housing Initiative",
    description: "Guarantee housing for all colonists.",
    type: "mars_independence",
    proposalCost: { materials: 80 },
    effects: { unlockBuilding: "housing_complex" },
  },
  {
    id: "healthcare_expansion",
    name: "Healthcare Expansion",
    description: "Expand medical facilities and access.",
    type: "mars_independence",
    proposalCost: { materials: 60, water: 30 },
    effects: { unlockBuilding: "medical_center" },
  },

  // Corporate Interests projects
  {
    id: "ai_governance",
    name: "AI-Assisted Governance",
    description: "Implement AI systems to help with colony decision-making.",
    type: "corporate_interests",
    proposalCost: { materials: 50, power: 50 },
    effects: { unlockTech: "advanced_ai" },
  },
  {
    id: "mining_concession",
    name: "Mining Concession",
    description: "Grant exclusive extraction rights to corporate partners.",
    type: "corporate_interests",
    proposalCost: { materials: 60 },
    effects: { unlockBuilding: "efficient_mine" },
  },
  {
    id: "labor_efficiency",
    name: "Labor Efficiency Program",
    description: "Controversial productivity initiative that increases output.",
    type: "corporate_interests",
    proposalCost: { materials: 40 },
  },
];
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "project assignments"`
Expected: PASS

**Step 5: Commit project changes**

```bash
git add src/core/data/npcs.ts
git commit -m "refactor: reassign projects to renamed factions, add corporate projects"
```

---

## Task 4: Update Transmission Factors

**Files:**
- Modify: `src/core/balance/NPCInfluenceBalance.ts`

**Step 1: Update transmission factor keys**

Replace the TRANSMISSION_FACTORS constant:

```typescript
export const TRANSMISSION_FACTORS: Record<
  ProjectType,
  Record<NPCFaction, Record<NPCFaction, number>>
> = {
  earth_loyalists: {
    earth_loyalists: { earth_loyalists: 1.0, mars_independence: 0.6, corporate_interests: 0.2 },
    mars_independence: { earth_loyalists: 0.7, mars_independence: 1.0, corporate_interests: 0.4 },
    corporate_interests: { earth_loyalists: 0.3, mars_independence: 0.5, corporate_interests: 1.0 },
  },
  mars_independence: {
    earth_loyalists: { earth_loyalists: 1.0, mars_independence: 0.5, corporate_interests: 0.3 },
    mars_independence: { earth_loyalists: 0.6, mars_independence: 1.0, corporate_interests: 0.6 },
    corporate_interests: { earth_loyalists: 0.3, mars_independence: 0.5, corporate_interests: 1.0 },
  },
  corporate_interests: {
    earth_loyalists: { earth_loyalists: 1.0, mars_independence: 0.4, corporate_interests: 0.2 },
    mars_independence: { earth_loyalists: 0.5, mars_independence: 1.0, corporate_interests: 0.6 },
    corporate_interests: { earth_loyalists: 0.3, mars_independence: 0.7, corporate_interests: 1.0 },
  },
} as const;
```

**Step 2: Run all NPC tests**

Run: `bun test tests/NPCInfluenceManager.test.ts`
Expected: All tests PASS

**Step 3: Commit balance changes**

```bash
git add src/core/balance/NPCInfluenceBalance.ts
git commit -m "refactor: update transmission factors for renamed factions"
```

---

## Task 5: Add Demand Balance Constants

**Files:**
- Modify: `src/core/balance/NPCInfluenceBalance.ts`

**Step 1: Add demand constants**

Add at the end of the file:

```typescript
// ============ Faction Demand System ============

/** Rate at which faction support decays per sol (before demands) */
export const FACTION_SUPPORT_DECAY_RATE = 0.01;

/** Support threshold below which a faction issues a demand */
export const DEMAND_THRESHOLD = 0.5;

/** Sols given to respond to a faction demand */
export const DEMAND_DEADLINE = 60;

/** Decay rate multiplier when demand is ignored past deadline */
export const IGNORED_DEMAND_DECAY_MULTIPLIER = 3;

/** Support boost to all faction NPCs when their project passes */
export const PROJECT_PASS_SUPPORT_BOOST = 0.3;

/** Minimum sols before political pressure begins */
export const POLITICAL_PRESSURE_START_SOL = 100;
```

**Step 2: Commit constants**

```bash
git add src/core/balance/NPCInfluenceBalance.ts
git commit -m "feat: add faction demand balance constants"
```

---

## Task 6: Add FactionDemand Interface

**Files:**
- Modify: `src/core/models/NPCInfluence.ts`

**Step 1: Add FactionDemand interface**

Add at the end of the file:

```typescript
/**
 * Represents a demand from a faction to propose one of their projects.
 */
export interface FactionDemand {
  /** Which faction is making the demand */
  factionId: NPCFaction;
  /** Sol when the demand was issued */
  demandedAt: number;
  /** Sols remaining until demand expires (accelerated decay begins) */
  deadline: number;
  /** Project IDs that would satisfy this demand */
  projectIds: string[];
}
```

**Step 2: Commit interface**

```bash
git add src/core/models/NPCInfluence.ts
git commit -m "feat: add FactionDemand interface"
```

---

## Task 7: Add Faction Support Tracking to NPCInfluenceManager

**Files:**
- Modify: `src/core/systems/NPCInfluenceManager.ts`
- Test: `tests/NPCInfluenceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('faction support', () => {
  it('should calculate average support per faction', () => {
    const support = manager.getFactionSupport();

    expect(support.earth_loyalists).toBeDefined();
    expect(support.mars_independence).toBeDefined();
    expect(support.corporate_interests).toBeDefined();

    // Initial support should be 0 (neutral)
    expect(support.earth_loyalists).toBe(0);
    expect(support.mars_independence).toBe(0);
    expect(support.corporate_interests).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction support"`
Expected: FAIL - getFactionSupport doesn't exist

**Step 3: Add getFactionSupport method**

In `src/core/systems/NPCInfluenceManager.ts`, add:

```typescript
import type { NPCFaction, FactionDemand } from "../models/NPCInfluence";

// In the class, add a property to track base support per NPC:
private npcSupport: Map<string, number> = new Map();

// In constructor, initialize support:
for (const npc of this.npcs) {
  this.npcSupport.set(npc.id, 0); // Start neutral
}

// Add getter method:
getFactionSupport(): Record<NPCFaction, number> {
  const factions: NPCFaction[] = ['earth_loyalists', 'mars_independence', 'corporate_interests'];
  const result: Record<NPCFaction, number> = {
    earth_loyalists: 0,
    mars_independence: 0,
    corporate_interests: 0,
  };

  for (const faction of factions) {
    const factionNpcs = this.npcs.filter(n => n.faction === faction);
    if (factionNpcs.length === 0) continue;

    const totalSupport = factionNpcs.reduce(
      (sum, npc) => sum + (this.npcSupport.get(npc.id) ?? 0),
      0
    );
    result[faction] = totalSupport / factionNpcs.length;
  }

  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction support"`
Expected: PASS

**Step 5: Commit faction support tracking**

```bash
git add src/core/systems/NPCInfluenceManager.ts tests/NPCInfluenceManager.test.ts
git commit -m "feat: add faction support tracking to NPCInfluenceManager"
```

---

## Task 8: Add Support Decay Logic

**Files:**
- Modify: `src/core/systems/NPCInfluenceManager.ts`
- Test: `tests/NPCInfluenceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('support decay', () => {
  it('should decay faction support over time when no project active', () => {
    // Set initial support above 0
    manager.adjustNPCSupport('chen_wei', 0.5);
    manager.adjustNPCSupport('nova_silva', 0.5);
    manager.adjustNPCSupport('alex_okonkwo', 0.5);

    const initialSupport = manager.getFactionSupport().earth_loyalists;
    expect(initialSupport).toBe(0.5);

    // Run 10 ticks with currentSol > POLITICAL_PRESSURE_START_SOL
    for (let i = 0; i < 10; i++) {
      manager.tick(150 + i); // Pass currentSol
    }

    const finalSupport = manager.getFactionSupport().earth_loyalists;
    expect(finalSupport).toBeLessThan(initialSupport);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "support decay"`
Expected: FAIL - tick doesn't accept currentSol, adjustNPCSupport doesn't exist

**Step 3: Add adjustNPCSupport and update tick**

In `src/core/systems/NPCInfluenceManager.ts`:

```typescript
import {
  FACTION_SUPPORT_DECAY_RATE,
  POLITICAL_PRESSURE_START_SOL,
} from "../balance/NPCInfluenceBalance";

// Add method to adjust NPC support:
adjustNPCSupport(npcId: string, amount: number): void {
  const current = this.npcSupport.get(npcId) ?? 0;
  this.npcSupport.set(npcId, Math.max(-1, Math.min(1, current + amount)));
}

// Update tick signature and add decay logic:
tick(currentSol: number = 0): GameEvent[] {
  const events: GameEvent[] = [];

  // Apply support decay if past political pressure start
  if (currentSol >= POLITICAL_PRESSURE_START_SOL) {
    for (const npc of this.npcs) {
      const current = this.npcSupport.get(npc.id) ?? 0;
      const decayed = current - FACTION_SUPPORT_DECAY_RATE;
      this.npcSupport.set(npc.id, Math.max(-1, decayed));
    }
  }

  // ... rest of existing tick logic
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "support decay"`
Expected: PASS

**Step 5: Commit decay logic**

```bash
git add src/core/systems/NPCInfluenceManager.ts tests/NPCInfluenceManager.test.ts
git commit -m "feat: add support decay to NPCInfluenceManager"
```

---

## Task 9: Add Demand Generation Logic

**Files:**
- Modify: `src/core/systems/NPCInfluenceManager.ts`
- Test: `tests/NPCInfluenceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('faction demands', () => {
  it('should generate demand when faction support drops below threshold', () => {
    // Start with no demands
    expect(manager.getActiveDemands()).toEqual([]);

    // Set support below threshold for earth_loyalists
    manager.adjustNPCSupport('chen_wei', 0.4);
    manager.adjustNPCSupport('nova_silva', 0.4);
    manager.adjustNPCSupport('alex_okonkwo', 0.4);

    // Tick to trigger demand check
    manager.tick(150);

    const demands = manager.getActiveDemands();
    expect(demands.length).toBe(1);
    expect(demands[0].factionId).toBe('earth_loyalists');
    expect(demands[0].projectIds.length).toBeGreaterThan(0);
  });

  it('should not duplicate demands for same faction', () => {
    manager.adjustNPCSupport('chen_wei', 0.4);
    manager.adjustNPCSupport('nova_silva', 0.4);
    manager.adjustNPCSupport('alex_okonkwo', 0.4);

    manager.tick(150);
    manager.tick(151);
    manager.tick(152);

    const demands = manager.getActiveDemands();
    const earthDemands = demands.filter(d => d.factionId === 'earth_loyalists');
    expect(earthDemands.length).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction demands"`
Expected: FAIL - getActiveDemands doesn't exist

**Step 3: Add demand tracking and generation**

In `src/core/systems/NPCInfluenceManager.ts`:

```typescript
import {
  DEMAND_THRESHOLD,
  DEMAND_DEADLINE,
} from "../balance/NPCInfluenceBalance";

// Add property:
private activeDemands: FactionDemand[] = [];

// Add getter:
getActiveDemands(): readonly FactionDemand[] {
  return this.activeDemands;
}

// Add to tick(), after decay logic:
private checkAndGenerateDemands(currentSol: number): GameEvent[] {
  const events: GameEvent[] = [];
  const factionSupport = this.getFactionSupport();
  const factions: NPCFaction[] = ['earth_loyalists', 'mars_independence', 'corporate_interests'];

  for (const faction of factions) {
    // Skip if already has active demand
    if (this.activeDemands.some(d => d.factionId === faction)) {
      continue;
    }

    // Check if support below threshold
    if (factionSupport[faction] < DEMAND_THRESHOLD) {
      const factionProjects = Array.from(this.projects.values())
        .filter(p => p.type === faction)
        .map(p => p.id);

      if (factionProjects.length > 0) {
        const demand: FactionDemand = {
          factionId: faction,
          demandedAt: currentSol,
          deadline: DEMAND_DEADLINE,
          projectIds: factionProjects,
        };

        this.activeDemands.push(demand);

        events.push({
          type: "FACTION_DEMAND",
          severity: "warning",
          factionId: faction,
          message: `${this.getFactionDisplayName(faction)} demands you propose one of their projects!`,
        });
      }
    }
  }

  return events;
}

private getFactionDisplayName(faction: NPCFaction): string {
  const names: Record<NPCFaction, string> = {
    earth_loyalists: "Earth Loyalists",
    mars_independence: "Mars Independence",
    corporate_interests: "Corporate Interests",
  };
  return names[faction];
}
```

Update tick() to call checkAndGenerateDemands:

```typescript
tick(currentSol: number = 0): GameEvent[] {
  const events: GameEvent[] = [];

  // Apply support decay if past political pressure start
  if (currentSol >= POLITICAL_PRESSURE_START_SOL) {
    for (const npc of this.npcs) {
      const current = this.npcSupport.get(npc.id) ?? 0;
      const decayed = current - FACTION_SUPPORT_DECAY_RATE;
      this.npcSupport.set(npc.id, Math.max(-1, decayed));
    }

    // Check for new demands
    events.push(...this.checkAndGenerateDemands(currentSol));
  }

  // ... rest of existing tick logic for active projects
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "faction demands"`
Expected: PASS

**Step 5: Commit demand generation**

```bash
git add src/core/systems/NPCInfluenceManager.ts tests/NPCInfluenceManager.test.ts
git commit -m "feat: add faction demand generation"
```

---

## Task 10: Add Demand Deadline and Accelerated Decay

**Files:**
- Modify: `src/core/systems/NPCInfluenceManager.ts`
- Test: `tests/NPCInfluenceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('demand deadlines', () => {
  it('should decrement demand deadline each tick', () => {
    manager.adjustNPCSupport('chen_wei', 0.4);
    manager.adjustNPCSupport('nova_silva', 0.4);
    manager.adjustNPCSupport('alex_okonkwo', 0.4);

    manager.tick(150);
    const initialDeadline = manager.getActiveDemands()[0].deadline;

    manager.tick(151);
    const newDeadline = manager.getActiveDemands()[0].deadline;

    expect(newDeadline).toBe(initialDeadline - 1);
  });

  it('should apply accelerated decay when demand deadline expires', () => {
    manager.adjustNPCSupport('chen_wei', 0.6);
    manager.adjustNPCSupport('nova_silva', 0.6);
    manager.adjustNPCSupport('alex_okonkwo', 0.6);

    // Force a demand with low support
    manager.adjustNPCSupport('chen_wei', -0.3);
    manager.adjustNPCSupport('nova_silva', -0.3);
    manager.adjustNPCSupport('alex_okonkwo', -0.3);

    manager.tick(150); // Generate demand

    // Expire the deadline
    for (let i = 0; i < 61; i++) {
      manager.tick(151 + i);
    }

    // Demand should still exist but with deadline <= 0
    const demand = manager.getActiveDemands().find(d => d.factionId === 'earth_loyalists');
    expect(demand).toBeDefined();
    expect(demand!.deadline).toBeLessThanOrEqual(0);

    // Support should have decayed faster (3x rate after deadline)
    const support = manager.getFactionSupport().earth_loyalists;
    expect(support).toBeLessThan(0); // Should be significantly negative
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "demand deadlines"`
Expected: FAIL - deadline doesn't decrement

**Step 3: Add deadline tracking and accelerated decay**

Update tick() in `src/core/systems/NPCInfluenceManager.ts`:

```typescript
tick(currentSol: number = 0): GameEvent[] {
  const events: GameEvent[] = [];

  if (currentSol >= POLITICAL_PRESSURE_START_SOL) {
    // Decrement demand deadlines
    for (const demand of this.activeDemands) {
      demand.deadline--;
    }

    // Calculate decay rate per NPC based on their faction's demand status
    for (const npc of this.npcs) {
      const current = this.npcSupport.get(npc.id) ?? 0;

      // Check if this NPC's faction has an expired demand
      const factionDemand = this.activeDemands.find(d => d.factionId === npc.faction);
      const multiplier = (factionDemand && factionDemand.deadline <= 0)
        ? IGNORED_DEMAND_DECAY_MULTIPLIER
        : 1;

      const decayed = current - (FACTION_SUPPORT_DECAY_RATE * multiplier);
      this.npcSupport.set(npc.id, Math.max(-1, decayed));
    }

    // Check for new demands
    events.push(...this.checkAndGenerateDemands(currentSol));
  }

  // ... rest of existing tick logic for active projects
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "demand deadlines"`
Expected: PASS

**Step 5: Commit deadline logic**

```bash
git add src/core/systems/NPCInfluenceManager.ts tests/NPCInfluenceManager.test.ts
git commit -m "feat: add demand deadline tracking and accelerated decay"
```

---

## Task 11: Add Demand Resolution on Project Pass

**Files:**
- Modify: `src/core/systems/NPCInfluenceManager.ts`
- Test: `tests/NPCInfluenceManager.test.ts`

**Step 1: Write the failing test**

Add to `tests/NPCInfluenceManager.test.ts`:

```typescript
describe('demand resolution', () => {
  it('should clear demand and boost support when faction project passes', () => {
    const resources = new ResourceManager({
      food: 100, oxygen: 100, water: 100, power: 100, materials: 1000,
    });

    // Create demand for earth_loyalists
    manager.adjustNPCSupport('chen_wei', 0.4);
    manager.adjustNPCSupport('nova_silva', 0.4);
    manager.adjustNPCSupport('alex_okonkwo', 0.4);
    manager.tick(150);

    expect(manager.getActiveDemands().length).toBe(1);

    // Propose and pass an earth_loyalists project
    manager.proposeProject('earth_memorial', resources);

    // Lobby everyone to pass
    for (const npc of manager.getNPCs()) {
      manager.lobbyNPC(npc.id, 0.9, resources);
    }

    // Run until project resolves
    for (let i = 0; i < 10; i++) {
      manager.tick(160 + i);
    }

    // Demand should be cleared
    const earthDemands = manager.getActiveDemands().filter(d => d.factionId === 'earth_loyalists');
    expect(earthDemands.length).toBe(0);

    // Support should be boosted
    const support = manager.getFactionSupport().earth_loyalists;
    expect(support).toBeGreaterThan(0.4); // Started at 0.4, should be boosted
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "demand resolution"`
Expected: FAIL - demand not cleared, support not boosted

**Step 3: Add demand resolution logic**

In the project resolution section of tick(), add:

```typescript
// In the section where project passes (after averageSupport >= PASS_THRESHOLD):
if (passed) {
  // ... existing event push ...

  // Clear any demand for this project's faction
  const projectFaction = project.type;
  this.activeDemands = this.activeDemands.filter(d => d.factionId !== projectFaction);

  // Boost support for all NPCs in this faction
  for (const npc of this.npcs) {
    if (npc.faction === projectFaction) {
      const current = this.npcSupport.get(npc.id) ?? 0;
      this.npcSupport.set(npc.id, Math.min(1, current + PROJECT_PASS_SUPPORT_BOOST));
    }
  }

  // ... existing transmission factor modification ...
}
```

**Step 4: Run test to verify it passes**

Run: `bun test tests/NPCInfluenceManager.test.ts -t "demand resolution"`
Expected: PASS

**Step 5: Commit demand resolution**

```bash
git add src/core/systems/NPCInfluenceManager.ts tests/NPCInfluenceManager.test.ts
git commit -m "feat: add demand resolution on project pass"
```

---

## Task 12: Update GameState to Pass currentSol to NPCInfluenceManager

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Update the tick call**

In `src/core/GameState.ts`, update line 83:

```typescript
// Change from:
events.push(...this.npcInfluence.tick());

// To:
events.push(...this.npcInfluence.tick(this.currentSol));
```

**Step 2: Run all tests**

Run: `bun test`
Expected: All tests PASS

**Step 3: Commit GameState update**

```bash
git add src/core/GameState.ts
git commit -m "feat: pass currentSol to NPCInfluenceManager tick"
```

---

## Task 13: Remove PoliticsEngine from GameState

**Files:**
- Modify: `src/core/GameState.ts`

**Step 1: Remove PoliticsEngine import and usage**

In `src/core/GameState.ts`:

1. Remove line 7: `import { PoliticsEngine } from "./systems/PoliticsEngine";`
2. Remove line 17: `import { FACTIONS, DECISIONS } from "./data/factions";`
3. Remove line 28: `politics: PoliticsEngine;`
4. Remove line 42: `this.politics = new PoliticsEngine(FACTIONS, DECISIONS);`
5. Remove lines 79-80: `events.push(...this.politics.tick());`
6. Remove from toJSON(): `politics: this.politics.toJSON(),`
7. Remove from fromJSON(): `state.politics = PoliticsEngine.fromJSON(data.politics, DECISIONS);`

**Step 2: Run tests**

Run: `bun test`
Expected: Some tests may fail if they reference politics - that's expected

**Step 3: Commit PoliticsEngine removal**

```bash
git add src/core/GameState.ts
git commit -m "refactor: remove PoliticsEngine from GameState"
```

---

## Task 14: Delete PoliticsEngine and factions.ts

**Files:**
- Delete: `src/core/systems/PoliticsEngine.ts`
- Delete: `src/core/data/factions.ts`
- Delete: `src/core/balance/PoliticsBalance.ts`

**Step 1: Delete files**

```bash
rm src/core/systems/PoliticsEngine.ts
rm src/core/data/factions.ts
rm src/core/balance/PoliticsBalance.ts
```

**Step 2: Run tests**

Run: `bun test`
Expected: Tests should pass (any references should already be removed)

**Step 3: Commit deletions**

```bash
git add -A
git commit -m "refactor: delete PoliticsEngine, factions.ts, PoliticsBalance.ts"
```

---

## Task 15: Update Facade Layer

**Files:**
- Modify: `src/facade/domains/PoliticsFacade.ts`
- Modify: `src/facade/types/politics.ts`
- Modify: `src/facade/GameAPI.ts`

**Step 1: Update PoliticsFacade to use NPCInfluenceManager**

Replace `src/facade/domains/PoliticsFacade.ts`:

```typescript
// src/facade/domains/PoliticsFacade.ts
// Politics facade - now wraps NPCInfluenceManager

import type { GameState } from "../../core/GameState";
import type { NPCFaction, FactionDemand } from "../../core/models/NPCInfluence";

export interface FactionStatus {
  id: NPCFaction;
  name: string;
  support: number;
  activeDemand: FactionDemand | null;
}

export interface PoliticsSnapshot {
  factions: readonly FactionStatus[];
  demands: readonly FactionDemand[];
}

export class PoliticsFacade {
  constructor(private gameState: GameState) {}

  snapshot(): PoliticsSnapshot {
    const factionSupport = this.gameState.npcInfluence.getFactionSupport();
    const demands = this.gameState.npcInfluence.getActiveDemands();

    const factionNames: Record<NPCFaction, string> = {
      earth_loyalists: "Earth Loyalists",
      mars_independence: "Mars Independence",
      corporate_interests: "Corporate Interests",
    };

    const factions: FactionStatus[] = (
      ['earth_loyalists', 'mars_independence', 'corporate_interests'] as NPCFaction[]
    ).map(id => ({
      id,
      name: factionNames[id],
      support: factionSupport[id],
      activeDemand: demands.find(d => d.factionId === id) ?? null,
    }));

    return {
      factions: Object.freeze(factions),
      demands: Object.freeze([...demands]),
    };
  }
}
```

**Step 2: Update politics.ts types**

Replace `src/facade/types/politics.ts`:

```typescript
// src/facade/types/politics.ts
import type { NPCFaction, FactionDemand } from "../../core/models/NPCInfluence";

export interface FactionStatus {
  id: NPCFaction;
  name: string;
  support: number;
  activeDemand: FactionDemand | null;
}

export interface PoliticsSnapshot {
  readonly factions: readonly FactionStatus[];
  readonly demands: readonly FactionDemand[];
}

export type { NPCFaction, FactionDemand };
```

**Step 3: Remove old politics imports from facade/types/index.ts**

Update `src/facade/types/index.ts` to export new types:

```typescript
// Replace the politics types line:
export type { PoliticsSnapshot, FactionStatus, NPCFaction, FactionDemand } from "./politics";
```

**Step 4: Update GameAPI**

In `src/facade/GameAPI.ts`, update the politics getter to use the new simpler facade.

**Step 5: Commit facade updates**

```bash
git add src/facade/
git commit -m "refactor: update facade layer for consolidated politics"
```

---

## Task 16: Update GameService

**Files:**
- Modify: `src/renderer/services/GameService.ts`

**Step 1: Update GameUIState interface**

Replace factions/decisions with new politics state:

```typescript
// In GameUIState interface, replace:
factions: Faction[];
averageSupport: number;
decisions: Decision[];

// With:
politics: {
  factions: FactionStatus[];
  demands: FactionDemand[];
};
```

**Step 2: Update syncState method**

```typescript
// Replace the politics sync section:
const politics = this.facade.politics.snapshot();
this.state.politics = {
  factions: [...politics.factions],
  demands: [...politics.demands],
};
```

**Step 3: Run type check**

Run: `bun run build`
Expected: Build succeeds (may have warnings we'll fix in UI task)

**Step 4: Commit GameService updates**

```bash
git add src/renderer/services/GameService.ts
git commit -m "refactor: update GameService for new politics system"
```

---

## Task 17: Update PoliticsPanel UI

**Files:**
- Modify: `src/renderer/components/PoliticsPanel/PoliticsPanel.vue`

**Step 1: Update to display new faction/demand system**

This is a larger UI change. The panel should now show:
- Three factions with their support levels (as progress bars)
- Active demands with countdown timers
- Link to NPC tab for project proposals

For now, create a simplified version:

```vue
<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

function getSupportColor(support: number): string {
  if (support >= 0.5) return 'var(--color-positive)';
  if (support >= 0) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}
</script>

<template>
  <GPanel title="Politics">
    <div class="factions">
      <div
        v-for="faction in state.politics.factions"
        :key="faction.id"
        class="faction-card"
      >
        <div class="faction-header">
          <span class="faction-name">{{ faction.name }}</span>
          <span
            class="faction-support"
            :style="{ color: getSupportColor(faction.support) }"
          >
            {{ formatSupport(faction.support) }}
          </span>
        </div>

        <div class="support-bar">
          <div
            class="support-fill"
            :style="{
              width: `${Math.max(0, (faction.support + 1) * 50)}%`,
              backgroundColor: getSupportColor(faction.support)
            }"
          />
        </div>

        <div v-if="faction.activeDemand" class="demand-warning">
          ⚠️ Demands project! {{ faction.activeDemand.deadline }} sols remaining
        </div>
      </div>
    </div>

    <p class="hint">
      Propose projects in the NPC tab to satisfy faction demands.
    </p>
  </GPanel>
</template>

<style scoped>
.factions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.faction-card {
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 4px;
}

.faction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.faction-name {
  font-weight: 500;
}

.support-bar {
  height: 8px;
  background: var(--color-muted);
  border-radius: 4px;
  overflow: hidden;
}

.support-fill {
  height: 100%;
  transition: width 0.3s;
}

.demand-warning {
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-warning);
  color: var(--color-background);
  border-radius: 4px;
  font-size: 0.875rem;
}

.hint {
  margin-top: 1rem;
  color: var(--color-muted);
  font-size: 0.875rem;
}
</style>
```

**Step 2: Run dev server to verify**

Run: `bun run dev`
Expected: UI loads without errors, shows faction cards

**Step 3: Commit UI updates**

```bash
git add src/renderer/components/PoliticsPanel/
git commit -m "refactor: update PoliticsPanel for new faction system"
```

---

## Task 18: Update Serialization

**Files:**
- Modify: `src/core/systems/NPCInfluenceManager.ts`

**Step 1: Update toJSON to include new state**

```typescript
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
    npcSupport: Object.fromEntries(this.npcSupport),
    activeDemands: this.activeDemands,
  };
}
```

**Step 2: Update fromJSON to restore new state**

```typescript
static fromJSON(
  data: ReturnType<NPCInfluenceManager["toJSON"]>,
  npcs: NPC[],
  relationships: Record<string, number>,
  projects: Project[],
): NPCInfluenceManager {
  const manager = new NPCInfluenceManager(npcs, relationships, projects);

  manager.relationshipMatrix = data.relationshipMatrix;
  manager.councils = data.councils;
  manager.transmissionFactors = data.transmissionFactors;

  if (data.activeProject) {
    manager.activeProject = {
      projectId: data.activeProject.projectId,
      supportLevels: new Map(
        Object.entries(data.activeProject.supportLevels).map(([k, v]) => [k, Number(v)]),
      ),
      solsRemaining: data.activeProject.solsRemaining,
    };
  }

  // Restore new state
  if (data.npcSupport) {
    manager.npcSupport = new Map(Object.entries(data.npcSupport).map(([k, v]) => [k, Number(v)]));
  }

  if (data.activeDemands) {
    manager.activeDemands = data.activeDemands;
  }

  return manager;
}
```

**Step 3: Run tests**

Run: `bun test`
Expected: All tests PASS

**Step 4: Commit serialization**

```bash
git add src/core/systems/NPCInfluenceManager.ts
git commit -m "feat: update NPCInfluenceManager serialization for new state"
```

---

## Task 19: Run Full Test Suite and Fix Issues

**Step 1: Run all tests**

Run: `bun test`

**Step 2: Fix any failing tests**

Address each failure - likely candidates:
- Tests referencing old `politics` property
- Tests expecting old faction names
- GameState tests needing updates

**Step 3: Run simulation to verify**

Run: `bun run scripts/analyze-simulation.ts`
Expected: Win rate should be lower than 100% if political pressure is working

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: resolve test failures from politics refactor"
```

---

## Task 20: Final Integration Test

**Step 1: Create integration test**

Add `tests/PoliticalPressure.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { GameState } from '../src/core/GameState';

describe('Political Pressure Integration', () => {
  it('should generate demands after political pressure starts', () => {
    const game = new GameState();

    // Advance past political pressure start (sol 100)
    for (let i = 0; i < 150; i++) {
      game.tick();
    }

    const demands = game.npcInfluence.getActiveDemands();
    // After 150 sols with decay, at least one faction should have demand
    expect(demands.length).toBeGreaterThan(0);
  });

  it('should allow satisfying demands by passing projects', () => {
    const game = new GameState();

    // Build up resources
    game.resources.add({ materials: 5000 });

    // Advance to generate demands
    for (let i = 0; i < 150; i++) {
      game.tick();
    }

    const demandsBefore = game.npcInfluence.getActiveDemands();
    expect(demandsBefore.length).toBeGreaterThan(0);

    const firstDemand = demandsBefore[0];
    const projectId = firstDemand.projectIds[0];

    // Propose the demanded project
    game.npcInfluence.proposeProject(projectId, game.resources);

    // Lobby all NPCs
    for (const npc of game.npcInfluence.getNPCs()) {
      game.npcInfluence.lobbyNPC(npc.id, 0.9, game.resources);
    }

    // Advance until project resolves
    for (let i = 0; i < 15; i++) {
      game.tick();
    }

    // Demand should be cleared
    const demandsAfter = game.npcInfluence.getActiveDemands()
      .filter(d => d.factionId === firstDemand.factionId);
    expect(demandsAfter.length).toBe(0);
  });
});
```

**Step 2: Run integration test**

Run: `bun test tests/PoliticalPressure.test.ts`
Expected: PASS

**Step 3: Commit integration test**

```bash
git add tests/PoliticalPressure.test.ts
git commit -m "test: add political pressure integration tests"
```

---

Plan complete and saved to `docs/plans/2026-01-24-political-pressure-implementation.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?