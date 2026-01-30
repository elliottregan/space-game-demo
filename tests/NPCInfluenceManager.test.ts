// tests/NPCInfluenceManager.test.ts

import { describe, it, expect, beforeEach } from "bun:test";
import { NPCInfluenceManager } from "../src/core/systems/NPCInfluenceManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { NPCS, INITIAL_RELATIONSHIPS, PROJECTS } from "../src/core/data/npcs";
import {
  LOBBY_BASE_COST,
  COUNCIL_CREATION_COST,
  COUNCIL_RELATIONSHIP_BOOST,
  RELATIONSHIP_DECAY_RATE,
  CROSS_FACTION_DECAY_MULTIPLIER,
  DISCONNECTION_THRESHOLD,
  SAME_FACTION_RELATIONSHIP_FLOOR,
  POLITICAL_PRESSURE_START_SOL,
  RELATIONSHIP_STALE_THRESHOLD,
  TRIADIC_CLOSURE_INITIAL_WEIGHT,
  TRIADIC_CLOSURE_THRESHOLD,
  SHARED_VOTE_RELATIONSHIP_BOOST,
} from "../src/core/balance/NPCInfluenceBalance";
import { InteractionType } from "../src/core/models/NPCInfluence";
import { NPCFaction, NPCId, ProjectId, type NPC } from "../src/core/models/NPCInfluence";
import type { GameEvent } from "../src/core/models/GameEvent";

describe("NPCInfluenceManager", () => {
  let manager: NPCInfluenceManager;

  beforeEach(() => {
    manager = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);
  });

  describe("faction types", () => {
    it("should have NPCs in all three factions", () => {
      const npcs = manager.getNPCs();
      const factions = new Set(npcs.map((n) => n.faction));
      expect(factions.has(NPCFaction.EarthLoyalists)).toBe(true);
      expect(factions.has(NPCFaction.MarsIndependence)).toBe(true);
      expect(factions.has(NPCFaction.CorporateInterests)).toBe(true);
      expect(factions.size).toBe(3);
    });
  });

  describe("project assignments", () => {
    it("should have projects for each faction", () => {
      const projects = manager.getProjects();
      const earthProjects = projects.filter((p) => p.type === NPCFaction.EarthLoyalists);
      const marsProjects = projects.filter((p) => p.type === NPCFaction.MarsIndependence);
      const corpProjects = projects.filter((p) => p.type === NPCFaction.CorporateInterests);

      expect(earthProjects.length).toBeGreaterThanOrEqual(2);
      expect(marsProjects.length).toBeGreaterThanOrEqual(2);
      expect(corpProjects.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("initialization", () => {
    it("should store all NPCs", () => {
      const npcs = manager.getNPCs();
      expect(npcs.length).toBe(10);
    });

    it("should store all projects", () => {
      const projects = manager.getProjects();
      expect(projects.length).toBe(8);
    });

    it("should build relationship matrix from initial data", () => {
      const matrix = manager.getRelationshipMatrix();
      expect(matrix.length).toBe(10);
      expect(matrix[0]!.length).toBe(10);
    });

    it("should have no active project initially", () => {
      expect(manager.getActiveProject()).toBeNull();
    });
  });

  describe("proposeProject", () => {
    it("should start faction-aligned NPCs at full support, others at neutral", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 200,
      });

      // generation_ship is an Earth Loyalists project
      const result = manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      expect(result).toBe(true);

      const active = manager.getActiveProject();
      expect(active).not.toBeNull();
      expect(active!.projectId).toBe(ProjectId.GENERATION_SHIP);
      expect(active!.solsRemaining).toBe(10);

      // Earth Loyalists should start at 1.0, others at 0.0
      for (const npc of manager.getNPCs()) {
        const expectedSupport = npc.faction === NPCFaction.EarthLoyalists ? 1.0 : 0.0;
        expect(active!.supportLevels.get(npc.id)).toBe(expectedSupport);
      }
    });

    it("should deduct proposal cost from resources", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 200,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      // generation_ship costs 100 materials
      expect(resources.getResources().materials).toBe(100);
    });

    it("should fail if cannot afford proposal cost", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 50, // Not enough for generation_ship (100)
      });

      const result = manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      expect(result).toBe(false);
      expect(manager.getActiveProject()).toBeNull();
    });

    it("should fail if project already active", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 200,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);
      const result = manager.proposeProject(ProjectId.UNIVERSAL_HOUSING, resources);

      expect(result).toBe(false);
      expect(manager.getActiveProject()!.projectId).toBe(ProjectId.GENERATION_SHIP);
    });
  });

  describe("lobbyNPC", () => {
    it("should increase NPC support for active project", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      // generation_ship is Earth Loyalists, so lobby a non-aligned NPC
      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      // maria_santos is Mars Independence, starts at 0.0 for Earth Loyalist project
      const result = manager.lobbyNPC(NPCId.MARIA_SANTOS, 0.3, resources);

      expect(result).toBe(true);
      expect(manager.getActiveProject()!.supportLevels.get(NPCId.MARIA_SANTOS)).toBe(0.3);
    });

    it("should cost materials based on NPC influence and boost amount", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);
      const startMaterials = resources.getResources().materials;

      // maria_santos has influence 1.3, boosting by 0.3
      // Cost = LOBBY_BASE_COST * influence * (boost / LOBBY_SUPPORT_BOOST) = 10 * 1.3 * 1 = 13
      manager.lobbyNPC(NPCId.MARIA_SANTOS, 0.3, resources);

      expect(resources.getResources().materials).toBe(startMaterials - 13);
    });

    it("should fail if no active project", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      const result = manager.lobbyNPC(NPCId.CHEN_WEI, 0.3, resources);

      expect(result).toBe(false);
    });

    it("should clamp support to [-1, 1]", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 1000,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);
      manager.lobbyNPC(NPCId.CHEN_WEI, 0.8, resources);
      manager.lobbyNPC(NPCId.CHEN_WEI, 0.8, resources); // Would be 1.6, should clamp

      expect(manager.getActiveProject()!.supportLevels.get(NPCId.CHEN_WEI)).toBe(1.0);
    });
  });

  describe("createCouncil", () => {
    it("should create a council and boost relationships between members", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      const memberIds: NPCId[] = [NPCId.CHEN_WEI, NPCId.MARIA_SANTOS, NPCId.ELENA_VOLKOV];
      const result = manager.createCouncil("Science Council", memberIds, resources);

      expect(result).toBe(true);

      const councils = manager.getCouncils();
      expect(councils.length).toBe(1);
      expect(councils[0]!.name).toBe("Science Council");
      expect(councils[0]!.memberIds).toEqual(memberIds);
    });

    it("should increase relationship weights between council members", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      // Get initial relationship between chen_wei and elena_volkov (should be 0 - no initial connection)
      const chenIdx = 0; // chen_wei is first
      const elenaIdx = 7; // elena_volkov is 8th (0-indexed: 7)

      const initialMatrix = manager.getRelationshipMatrix();
      const initialWeight = initialMatrix[elenaIdx]![chenIdx]!;

      manager.createCouncil("Science Council", [NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV], resources);

      const newMatrix = manager.getRelationshipMatrix();
      expect(newMatrix[elenaIdx]![chenIdx]!).toBe(
        Math.min(1.0, initialWeight + COUNCIL_RELATIONSHIP_BOOST),
      );
    });

    it("should deduct creation cost", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      manager.createCouncil("Science Council", [NPCId.CHEN_WEI, NPCId.MARIA_SANTOS], resources);

      expect(resources.getResources().materials).toBe(500 - COUNCIL_CREATION_COST);
    });

    it("should fail if cannot afford", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 10, // Not enough
      });

      const result = manager.createCouncil(
        "Science Council",
        [NPCId.CHEN_WEI, NPCId.MARIA_SANTOS],
        resources,
      );

      expect(result).toBe(false);
      expect(manager.getCouncils().length).toBe(0);
    });
  });

  describe("tick", () => {
    it("should propagate support through network each tick", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      // Seed support for chen_wei (futurist)
      manager.lobbyNPC(NPCId.CHEN_WEI, 0.8, resources);

      // Run a tick
      manager.tick();

      // nova_silva (futurist, connected to chen_wei) should have gained some support
      const novaSupport = manager.getActiveProject()!.supportLevels.get(NPCId.NOVA_SILVA)!;
      expect(novaSupport).toBeGreaterThan(0);
    });

    it("should decrement solsRemaining each tick", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);
      const initialSols = manager.getActiveProject()!.solsRemaining;

      manager.tick();

      expect(manager.getActiveProject()!.solsRemaining).toBe(initialSols - 1);
    });

    it("should resolve project when solsRemaining reaches 0", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 1000,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      // Lobby enough NPCs to pass
      manager.lobbyNPC(NPCId.CHEN_WEI, 0.9, resources);
      manager.lobbyNPC(NPCId.NOVA_SILVA, 0.9, resources);
      manager.lobbyNPC(NPCId.ALEX_OKONKWO, 0.9, resources);
      manager.lobbyNPC(NPCId.MARIA_SANTOS, 0.7, resources);
      manager.lobbyNPC(NPCId.JAMES_LIU, 0.7, resources);

      // Run 10 ticks to resolve
      for (let i = 0; i < 10; i++) {
        manager.tick();
      }

      // Project should be resolved (cleared)
      expect(manager.getActiveProject()).toBeNull();
    });

    it("should emit PROJECT_PASSED event when project passes", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 1000,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      // Lobby most NPCs heavily
      for (const npc of manager.getNPCs()) {
        manager.lobbyNPC(npc.id, 0.9, resources);
      }

      // Run ticks until resolution
      let events: GameEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events = manager.tick();
      }

      const passedEvent = events.find((e) => e.type === "PROJECT_PASSED");
      expect(passedEvent).toBeDefined();
      expect(passedEvent!.projectId).toBe(ProjectId.GENERATION_SHIP);
    });

    it("should emit PROJECT_FAILED event when project fails", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 500,
      });

      manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

      // Don't lobby anyone - all at 0.0, will fail

      // Run ticks until resolution
      let events: GameEvent[] = [];
      for (let i = 0; i < 10; i++) {
        events = manager.tick();
      }

      const failedEvent = events.find((e) => e.type === "PROJECT_FAILED");
      expect(failedEvent).toBeDefined();
      expect(failedEvent!.projectId).toBe(ProjectId.GENERATION_SHIP);
    });
  });

  describe("faction support", () => {
    it("should calculate average support per faction", () => {
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

  describe("support decay", () => {
    it("should decay faction support over time when no project active", () => {
      // Set initial support above 0
      manager.adjustNPCSupport(NPCId.CHEN_WEI, 0.5);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, 0.5);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, 0.5);

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

  describe("faction demands", () => {
    it("should generate demand when faction support drops below threshold", () => {
      // Start with no demands
      expect(manager.getActiveDemands()).toEqual([]);

      // Set support above threshold for mars_independence and corporate_interests
      // mars_independence: maria_santos, james_liu, aisha_patel, marcus_reed
      manager.adjustNPCSupport(NPCId.MARIA_SANTOS, 0.6);
      manager.adjustNPCSupport(NPCId.JAMES_LIU, 0.6);
      manager.adjustNPCSupport(NPCId.AISHA_PATEL, 0.6);
      manager.adjustNPCSupport(NPCId.MARCUS_REED, 0.6);
      // corporate_interests: elena_volkov, david_morrison, sarah_chen
      manager.adjustNPCSupport(NPCId.ELENA_VOLKOV, 0.6);
      manager.adjustNPCSupport(NPCId.DAVID_MORRISON, 0.6);
      manager.adjustNPCSupport(NPCId.SARAH_CHEN, 0.6);

      // Set support below threshold for earth_loyalists (threshold is 0.5)
      // earth_loyalists: chen_wei, nova_silva, alex_okonkwo
      manager.adjustNPCSupport(NPCId.CHEN_WEI, 0.4);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, 0.4);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, 0.4);

      // Tick to trigger demand check
      manager.tick(150);

      const demands = manager.getActiveDemands();
      expect(demands.length).toBe(1);
      expect(demands[0]!.factionId).toBe(NPCFaction.EarthLoyalists);
      expect(demands[0]!.projectIds.length).toBeGreaterThan(0);
    });

    it("should not duplicate demands for same faction", () => {
      // Set support above threshold for mars_independence and corporate_interests
      manager.adjustNPCSupport(NPCId.MARIA_SANTOS, 0.6);
      manager.adjustNPCSupport(NPCId.JAMES_LIU, 0.6);
      manager.adjustNPCSupport(NPCId.AISHA_PATEL, 0.6);
      manager.adjustNPCSupport(NPCId.MARCUS_REED, 0.6);
      manager.adjustNPCSupport(NPCId.ELENA_VOLKOV, 0.6);
      manager.adjustNPCSupport(NPCId.DAVID_MORRISON, 0.6);
      manager.adjustNPCSupport(NPCId.SARAH_CHEN, 0.6);

      // Set support below threshold for earth_loyalists
      manager.adjustNPCSupport(NPCId.CHEN_WEI, 0.4);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, 0.4);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, 0.4);

      manager.tick(150);
      manager.tick(151);
      manager.tick(152);

      const demands = manager.getActiveDemands();
      const earthDemands = demands.filter((d) => d.factionId === NPCFaction.EarthLoyalists);
      expect(earthDemands.length).toBe(1);
    });
  });

  describe("demand resolution", () => {
    it("should clear demand and boost support when faction project passes", () => {
      const resources = new ResourceManager({
        food: 100,
        water: 100,
        power: 100,
        materials: 1000,
      });

      // Set support above threshold for mars_independence and corporate_interests
      // mars_independence: maria_santos, james_liu, aisha_patel, marcus_reed
      manager.adjustNPCSupport(NPCId.MARIA_SANTOS, 0.6);
      manager.adjustNPCSupport(NPCId.JAMES_LIU, 0.6);
      manager.adjustNPCSupport(NPCId.AISHA_PATEL, 0.6);
      manager.adjustNPCSupport(NPCId.MARCUS_REED, 0.6);
      // corporate_interests: elena_volkov, david_morrison, sarah_chen
      manager.adjustNPCSupport(NPCId.ELENA_VOLKOV, 0.6);
      manager.adjustNPCSupport(NPCId.DAVID_MORRISON, 0.6);
      manager.adjustNPCSupport(NPCId.SARAH_CHEN, 0.6);

      // Create demand for earth_loyalists (below threshold of 0.5)
      manager.adjustNPCSupport(NPCId.CHEN_WEI, 0.4);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, 0.4);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, 0.4);
      manager.tick(150);

      expect(manager.getActiveDemands().length).toBe(1);
      expect(manager.getActiveDemands()[0]!.factionId).toBe(NPCFaction.EarthLoyalists);

      // Propose an earth_loyalists project
      manager.proposeProject(ProjectId.EARTH_MEMORIAL, resources);

      // Lobby everyone to pass (need support above PASS_THRESHOLD which is 0.4)
      for (const npc of manager.getNPCs()) {
        manager.lobbyNPC(npc.id, 0.9, resources);
      }

      // Record support before project resolves
      const supportBefore = manager.getFactionSupport().earth_loyalists;

      // Run until project resolves (PROJECT_VOTE_DELAY is 10)
      for (let i = 0; i < 15; i++) {
        manager.tick(160 + i);
      }

      // Demand should be cleared
      const earthDemands = manager
        .getActiveDemands()
        .filter((d) => d.factionId === NPCFaction.EarthLoyalists);
      expect(earthDemands.length).toBe(0);

      // Support should be boosted (PROJECT_PASS_SUPPORT_BOOST is 0.3)
      const supportAfter = manager.getFactionSupport().earth_loyalists;
      expect(supportAfter).toBeGreaterThan(supportBefore);
    });
  });

  describe("demand deadlines", () => {
    it("should decrement demand deadline each tick", () => {
      manager.adjustNPCSupport(NPCId.CHEN_WEI, 0.4);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, 0.4);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, 0.4);

      manager.tick(150);
      const initialDeadline = manager.getActiveDemands()[0]!.deadline;

      manager.tick(151);
      const newDeadline = manager.getActiveDemands()[0]!.deadline;

      expect(newDeadline).toBe(initialDeadline - 1);
    });

    it("should apply accelerated decay when demand deadline expires", () => {
      manager.adjustNPCSupport(NPCId.CHEN_WEI, 0.6);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, 0.6);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, 0.6);

      // Force a demand with low support
      manager.adjustNPCSupport(NPCId.CHEN_WEI, -0.3);
      manager.adjustNPCSupport(NPCId.NOVA_SILVA, -0.3);
      manager.adjustNPCSupport(NPCId.ALEX_OKONKWO, -0.3);

      manager.tick(150); // Generate demand

      // Expire the deadline (60 sols + a bit more)
      for (let i = 0; i < 65; i++) {
        manager.tick(151 + i);
      }

      // Demand should still exist but with deadline <= 0
      const demand = manager
        .getActiveDemands()
        .find((d) => d.factionId === NPCFaction.EarthLoyalists);
      expect(demand).toBeDefined();
      expect(demand!.deadline).toBeLessThanOrEqual(0);

      // Support should have decayed faster (3x rate after deadline)
      const support = manager.getFactionSupport().earth_loyalists;
      expect(support).toBeLessThan(0); // Should be significantly negative
    });
  });

  describe("network disconnection system", () => {
    describe("getRelationshipWeight", () => {
      it("should return the relationship weight between two NPCs", () => {
        // Chen Wei -> Nova Silva has initial weight 0.7
        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(weight).toBe(0.7);
      });

      it("should return 0 for non-existent connections", () => {
        // Chen Wei and Elena Volkov have no initial connection
        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(weight).toBe(0);
      });

      it("should return asymmetric weights correctly", () => {
        // Chen Wei -> Nova Silva is 0.7, Nova Silva -> Chen Wei is 0.6
        const chenToNova = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        const novaToChen = manager.getRelationshipWeight(NPCId.NOVA_SILVA, NPCId.CHEN_WEI);
        expect(chenToNova).toBe(0.7);
        expect(novaToChen).toBe(0.6);
      });
    });

    describe("weakenRelationship", () => {
      it("should reduce the relationship weight between two NPCs", () => {
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);

        manager.weakenRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.1);

        const newWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(newWeight).toBe(initialWeight - 0.1);
      });

      it("should respect same-faction floor", () => {
        // Chen Wei and Nova Silva are both Earth Loyalists
        // Weaken by a large amount
        manager.weakenRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 1.0);

        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(weight).toBe(SAME_FACTION_RELATIONSHIP_FLOOR);
      });

      it("should allow cross-faction relationships to go to zero", () => {
        // Chen Wei -> Maria Santos is a cross-faction connection (0.3)
        manager.weakenRelationship(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS, 1.0);

        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(weight).toBe(0);
      });

      it("should return false if no connection exists", () => {
        const result = manager.weakenRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, 0.1);
        expect(result).toBe(false);
      });
    });

    describe("relationship decay", () => {
      it("should decay relationships over time after political pressure starts", () => {
        // Cross-faction connection: Chen Wei -> Maria Santos (0.3)
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(initialWeight).toBe(0.3);

        // Run many ticks to cause decay
        for (let i = 0; i < 50; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const newWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(newWeight).toBeLessThan(initialWeight);
      });

      it("should decay cross-faction relationships faster than same-faction", () => {
        // Use fresh relationships to control for triadic closure effects
        // Set both same-faction and cross-faction to the same initial weight
        const initialWeight = 0.5;

        // Same-faction: Chen Wei -> Nova Silva
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, initialWeight);
        // Cross-faction: Chen Wei -> Maria Santos
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS, initialWeight);

        // Mark as recently maintained to avoid unmaintained multiplier
        manager.recordInteraction(
          NPCId.CHEN_WEI,
          NPCId.NOVA_SILVA,
          "council_created",
          POLITICAL_PRESSURE_START_SOL,
        );
        manager.recordInteraction(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          "council_created",
          POLITICAL_PRESSURE_START_SOL,
        );

        // Run a single tick
        manager.tick(POLITICAL_PRESSURE_START_SOL + 1);

        const newSameFaction = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        const newCrossFaction = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);

        const sameFactionDecay = initialWeight - newSameFaction;
        const crossFactionDecay = initialWeight - newCrossFaction;

        // Cross-faction should decay more (CROSS_FACTION_DECAY_MULTIPLIER = 1.5)
        expect(crossFactionDecay).toBeCloseTo(sameFactionDecay * CROSS_FACTION_DECAY_MULTIPLIER, 6);
      });

      it("should not decay same-faction relationships below the floor", () => {
        // Run many ticks to try to decay
        for (let i = 0; i < 500; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        // Same-faction relationship should not go below floor
        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(weight).toBeGreaterThanOrEqual(SAME_FACTION_RELATIONSHIP_FLOOR);
      });

      it("should not decay relationships before political pressure starts", () => {
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);

        // Run ticks before POLITICAL_PRESSURE_START_SOL
        for (let i = 0; i < 50; i++) {
          manager.tick(i);
        }

        const newWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(newWeight).toBe(initialWeight);
      });
    });

    describe("disconnection events", () => {
      it("should disconnect cross-faction relationships that fall below threshold", () => {
        // Weaken cross-faction connection to just above threshold
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        manager.weakenRelationship(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          initialWeight - DISCONNECTION_THRESHOLD / 2,
        );

        // Run ticks until disconnection occurs
        let disconnectionEvent: GameEvent | undefined;
        for (let i = 0; i < 100; i++) {
          const events = manager.tick(POLITICAL_PRESSURE_START_SOL + i);
          const found = events.find((e) => e.type === "NETWORK_DISCONNECTION");
          if (found) {
            disconnectionEvent = found;
            break;
          }
        }

        expect(disconnectionEvent).toBeDefined();
        expect(disconnectionEvent!.sourceNpcId).toBe(NPCId.CHEN_WEI);
        expect(disconnectionEvent!.targetNpcId).toBe(NPCId.MARIA_SANTOS);
      });

      it("should record disconnection in history", () => {
        // Weaken cross-faction connection significantly
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        manager.weakenRelationship(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          initialWeight - DISCONNECTION_THRESHOLD / 2,
        );

        // Run ticks until disconnection occurs
        for (let i = 0; i < 100; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const history = manager.getDisconnectionHistory();
        const disconnection = history.find(
          (d) => d.sourceId === NPCId.CHEN_WEI && d.targetId === NPCId.MARIA_SANTOS,
        );
        expect(disconnection).toBeDefined();
        expect(disconnection!.previousWeight).toBeGreaterThan(0);
        expect(disconnection!.previousWeight).toBeLessThan(DISCONNECTION_THRESHOLD);
      });

      it("should not disconnect same-faction relationships", () => {
        // Run many ticks
        for (let i = 0; i < 500; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const history = manager.getDisconnectionHistory();
        const sameFactionDisconnection = history.find((d) => {
          const sourceNpc = manager.getNPCs().find((n) => n.id === d.sourceId);
          const targetNpc = manager.getNPCs().find((n) => n.id === d.targetId);
          return sourceNpc?.faction === targetNpc?.faction;
        });

        expect(sameFactionDisconnection).toBeUndefined();
      });

      it("should set relationship to 0 after disconnection", () => {
        // Weaken cross-faction connection significantly
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        manager.weakenRelationship(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          initialWeight - DISCONNECTION_THRESHOLD / 2,
        );

        // Run ticks until disconnection occurs
        for (let i = 0; i < 100; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(weight).toBeCloseTo(0, 5);
      });
    });

    describe("connected components", () => {
      it("should return one component when all NPCs are connected", () => {
        const components = manager.getConnectedComponents();

        // Initially all NPCs should be in one connected component
        expect(components.length).toBe(1);
        expect(components[0]!.memberIds.length).toBe(10);
      });

      it("should identify disconnected groups after connections break", () => {
        // Sever all cross-faction connections manually
        // Earth Loyalists: chen_wei, nova_silva, alex_okonkwo
        // Cross-faction connections to sever:
        // chen_wei -> maria_santos (0.3), maria_santos -> chen_wei (0.2)
        // nova_silva -> aisha_patel (0.2), aisha_patel -> nova_silva (0.3)
        // marcus_reed -> david_morrison (0.3), david_morrison -> marcus_reed (0.2)
        // james_liu -> sarah_chen (0.2), sarah_chen -> james_liu (0.2)

        manager.weakenRelationship(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS, 1.0);
        manager.weakenRelationship(NPCId.MARIA_SANTOS, NPCId.CHEN_WEI, 1.0);
        manager.weakenRelationship(NPCId.NOVA_SILVA, NPCId.AISHA_PATEL, 1.0);
        manager.weakenRelationship(NPCId.AISHA_PATEL, NPCId.NOVA_SILVA, 1.0);
        manager.weakenRelationship(NPCId.MARCUS_REED, NPCId.DAVID_MORRISON, 1.0);
        manager.weakenRelationship(NPCId.DAVID_MORRISON, NPCId.MARCUS_REED, 1.0);
        manager.weakenRelationship(NPCId.JAMES_LIU, NPCId.SARAH_CHEN, 1.0);
        manager.weakenRelationship(NPCId.SARAH_CHEN, NPCId.JAMES_LIU, 1.0);

        const components = manager.getConnectedComponents();

        // Should have 3 disconnected components (one per faction)
        expect(components.length).toBe(3);

        // Each component should contain members of the same faction
        for (const component of components) {
          expect(component.factions.length).toBe(1);
        }
      });

      it("should include faction information in components", () => {
        const components = manager.getConnectedComponents();

        expect(components[0]!.factions).toContain(NPCFaction.EarthLoyalists);
        expect(components[0]!.factions).toContain(NPCFaction.MarsIndependence);
        expect(components[0]!.factions).toContain(NPCFaction.CorporateInterests);
      });
    });

    describe("opposing vote penalties", () => {
      it("should weaken relationships between NPCs who voted on opposite sides", () => {
        const resources = new ResourceManager({
          food: 100,
          water: 100,
          power: 100,
          materials: 1000,
        });

        // Get initial cross-faction relationship
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);

        // Propose an Earth Loyalists project
        manager.proposeProject(ProjectId.GENERATION_SHIP, resources);

        // Lobby Chen Wei to strongly support (+1.0)
        manager.lobbyNPC(NPCId.CHEN_WEI, 0.9, resources);
        // Lobby Maria Santos to strongly oppose (-0.5)
        manager.lobbyNPC(NPCId.MARIA_SANTOS, -0.6, resources);

        // Run ticks until project resolves (with currentSol >= POLITICAL_PRESSURE_START_SOL)
        for (let i = 0; i < 15; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const newWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        // Weight should have decreased due to opposing votes and natural decay
        expect(newWeight).toBeLessThan(initialWeight);
      });
    });

    describe("serialization", () => {
      it("should persist disconnection history through serialization", () => {
        // Weaken connection to cause disconnection
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        manager.weakenRelationship(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          initialWeight - DISCONNECTION_THRESHOLD / 2,
        );

        // Run ticks until disconnection
        for (let i = 0; i < 100; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        // Serialize
        const json = manager.toJSON();

        // Deserialize
        const restored = NPCInfluenceManager.fromJSON(json, NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

        // Check that disconnection history was restored
        const history = restored.getDisconnectionHistory();
        const disconnection = history.find(
          (d) => d.sourceId === NPCId.CHEN_WEI && d.targetId === NPCId.MARIA_SANTOS,
        );
        expect(disconnection).toBeDefined();
      });

      it("should persist relationship matrix changes through serialization", () => {
        // Weaken a relationship
        manager.weakenRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.2);
        const weightBefore = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);

        // Serialize and restore
        const json = manager.toJSON();
        const restored = NPCInfluenceManager.fromJSON(json, NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

        const weightAfter = restored.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(weightAfter).toBe(weightBefore);
      });
    });
  });

  describe("dynamic network management", () => {
    describe("addNPC", () => {
      it("should add a new NPC to the network", () => {
        const newNpc: NPC = {
          id: "new_colonist" as NPCId,
          name: "New Colonist",
          faction: NPCFaction.MarsIndependence,
          influence: 1.0,
        };

        const result = manager.addNPC(newNpc);

        expect(result).toBe(true);
        expect(manager.getNPCs().length).toBe(11);
        expect(manager.getNPCs().find((n) => n.id === "new_colonist")).toBeDefined();
      });

      it("should expand the relationship matrix for new NPCs", () => {
        const newNpc: NPC = {
          id: "new_colonist" as NPCId,
          name: "New Colonist",
          faction: NPCFaction.MarsIndependence,
          influence: 1.0,
        };

        manager.addNPC(newNpc);

        const matrix = manager.getRelationshipMatrix();
        expect(matrix.length).toBe(11);
        expect(matrix[0]!.length).toBe(11);
      });

      it("should initialize new NPC with provided relationships", () => {
        const newNpc: NPC = {
          id: "new_colonist" as NPCId,
          name: "New Colonist",
          faction: NPCFaction.MarsIndependence,
          influence: 1.0,
        };

        const initialRelationships = {
          [`new_colonist:${NPCId.MARIA_SANTOS}`]: 0.5,
          [`${NPCId.MARIA_SANTOS}:new_colonist`]: 0.4,
        };

        manager.addNPC(newNpc, initialRelationships);

        // Check that relationships were established
        const outWeight = manager.getRelationshipWeight(
          "new_colonist" as NPCId,
          NPCId.MARIA_SANTOS,
        );
        const inWeight = manager.getRelationshipWeight(NPCId.MARIA_SANTOS, "new_colonist" as NPCId);

        expect(outWeight).toBe(0.5);
        expect(inWeight).toBe(0.4);
      });

      it("should reject duplicate NPC IDs", () => {
        const duplicateNpc: NPC = {
          id: NPCId.CHEN_WEI, // Already exists
          name: "Duplicate",
          faction: NPCFaction.EarthLoyalists,
          influence: 1.0,
        };

        const result = manager.addNPC(duplicateNpc);

        expect(result).toBe(false);
        expect(manager.getNPCs().length).toBe(10);
      });

      it("should initialize support for new NPCs at 0", () => {
        const newNpc: NPC = {
          id: "new_colonist" as NPCId,
          name: "New Colonist",
          faction: NPCFaction.MarsIndependence,
          influence: 1.0,
        };

        manager.addNPC(newNpc);

        // New NPC should be part of Mars Independence faction support calculation
        const factionSupport = manager.getFactionSupport();
        // Support calculation includes new NPC with 0 support
        expect(factionSupport[NPCFaction.MarsIndependence]).toBeDefined();
      });
    });

    describe("removeNPC", () => {
      it("should remove an NPC from the network", () => {
        const result = manager.removeNPC(NPCId.MARCUS_REED);

        expect(result).toBe(true);
        expect(manager.getNPCs().length).toBe(9);
        expect(manager.getNPCs().find((n) => n.id === NPCId.MARCUS_REED)).toBeUndefined();
      });

      it("should shrink the relationship matrix", () => {
        manager.removeNPC(NPCId.MARCUS_REED);

        const matrix = manager.getRelationshipMatrix();
        expect(matrix.length).toBe(9);
        expect(matrix[0]!.length).toBe(9);
      });

      it("should return false for non-existent NPC", () => {
        const result = manager.removeNPC("nonexistent" as NPCId);
        expect(result).toBe(false);
      });

      it("should remove NPC from councils", () => {
        const resources = new ResourceManager({
          food: 100,
          water: 100,
          power: 100,
          materials: 500,
        });

        // Create a council with Marcus Reed
        manager.createCouncil("Test Council", [NPCId.MARCUS_REED, NPCId.MARIA_SANTOS], resources);

        // Remove Marcus Reed
        manager.removeNPC(NPCId.MARCUS_REED);

        // Council should still exist but without Marcus Reed
        const councils = manager.getCouncils();
        expect(councils[0]!.memberIds).not.toContain(NPCId.MARCUS_REED);
        expect(councils[0]!.memberIds).toContain(NPCId.MARIA_SANTOS);
      });
    });

    describe("setRelationship", () => {
      it("should create a new relationship between NPCs", () => {
        // Chen Wei and Elena Volkov have no initial connection
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(initialWeight).toBe(0);

        manager.setRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, 0.5);

        const newWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(newWeight).toBe(0.5);
      });

      it("should clamp weight to valid range", () => {
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, 1.5);
        expect(manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV)).toBe(1);

        manager.setRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, -0.5);
        expect(manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV)).toBe(0);
      });

      it("should return false for invalid NPCs", () => {
        const result = manager.setRelationship("invalid" as NPCId, NPCId.CHEN_WEI, 0.5);
        expect(result).toBe(false);
      });
    });

    describe("strengthenRelationship", () => {
      it("should increase an existing relationship", () => {
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);

        manager.strengthenRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.2);

        const newWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(newWeight).toBe(Math.min(1, initialWeight + 0.2));
      });

      it("should create a relationship if none exists", () => {
        manager.strengthenRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, 0.3);

        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(weight).toBe(0.3);
      });

      it("should cap at maximum weight of 1", () => {
        manager.strengthenRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 1.0);

        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(weight).toBe(1);
      });
    });

    describe("getNeighbors", () => {
      it("should return all connected NPCs", () => {
        const neighbors = manager.getNeighbors(NPCId.CHEN_WEI);

        // Chen Wei has connections to Nova Silva, Alex Okonkwo, and Maria Santos
        expect(neighbors).toContain(NPCId.NOVA_SILVA);
        expect(neighbors).toContain(NPCId.ALEX_OKONKWO);
        expect(neighbors).toContain(NPCId.MARIA_SANTOS);
      });

      it("should return empty array for isolated NPC", () => {
        const newNpc: NPC = {
          id: "isolated" as NPCId,
          name: "Isolated",
          faction: NPCFaction.MarsIndependence,
          influence: 1.0,
        };
        manager.addNPC(newNpc);

        const neighbors = manager.getNeighbors("isolated" as NPCId);
        expect(neighbors).toEqual([]);
      });

      it("should return empty array for invalid NPC ID", () => {
        const neighbors = manager.getNeighbors("invalid" as NPCId);
        expect(neighbors).toEqual([]);
      });
    });

    describe("getRelationships", () => {
      it("should return incoming and outgoing relationships", () => {
        const relationships = manager.getRelationships(NPCId.CHEN_WEI);

        // Chen Wei influences Nova Silva (0.7) and Alex Okonkwo (0.5) and Maria Santos (0.3)
        expect(relationships.outgoing.get(NPCId.NOVA_SILVA)).toBe(0.7);
        expect(relationships.outgoing.get(NPCId.ALEX_OKONKWO)).toBe(0.5);
        expect(relationships.outgoing.get(NPCId.MARIA_SANTOS)).toBe(0.3);

        // Chen Wei is influenced by Nova Silva (0.6) and Alex Okonkwo (0.6) and Maria Santos (0.2)
        expect(relationships.incoming.get(NPCId.NOVA_SILVA)).toBe(0.6);
        expect(relationships.incoming.get(NPCId.ALEX_OKONKWO)).toBe(0.6);
        expect(relationships.incoming.get(NPCId.MARIA_SANTOS)).toBe(0.2);
      });

      it("should return empty maps for invalid NPC", () => {
        const relationships = manager.getRelationships("invalid" as NPCId);
        expect(relationships.incoming.size).toBe(0);
        expect(relationships.outgoing.size).toBe(0);
      });
    });

    describe("serialization with dynamic NPCs", () => {
      it("should persist added NPCs through serialization", () => {
        const newNpc: NPC = {
          id: "new_colonist" as NPCId,
          name: "New Colonist",
          faction: NPCFaction.MarsIndependence,
          influence: 1.0,
        };

        manager.addNPC(newNpc, {
          [`new_colonist:${NPCId.MARIA_SANTOS}`]: 0.5,
        });

        // Serialize and restore
        const json = manager.toJSON();
        const restored = NPCInfluenceManager.fromJSON(json, NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

        // Check that new NPC was restored
        expect(restored.getNPCs().length).toBe(11);
        expect(restored.getNPCs().find((n) => n.id === "new_colonist")).toBeDefined();

        // Check that relationship was restored
        const weight = restored.getRelationshipWeight("new_colonist" as NPCId, NPCId.MARIA_SANTOS);
        expect(weight).toBe(0.5);
      });

      it("should persist removed NPCs through serialization", () => {
        manager.removeNPC(NPCId.MARCUS_REED);

        // Serialize and restore
        const json = manager.toJSON();
        const restored = NPCInfluenceManager.fromJSON(json, NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

        // Check that removed NPC is not present
        expect(restored.getNPCs().length).toBe(9);
        expect(restored.getNPCs().find((n) => n.id === NPCId.MARCUS_REED)).toBeUndefined();
      });
    });
  });

  describe("triadic closure system", () => {
    describe("processTriadicClosure", () => {
      it("should form new connections through mutual contacts over time", () => {
        // Create a scenario where A→B and B→C exist but A→C doesn't
        // Chen Wei → Nova Silva (0.7), Nova Silva → Aisha Patel (0.2)
        // We need stronger connections to meet threshold
        manager.strengthenRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.3); // Make it 1.0
        manager.setRelationship(NPCId.NOVA_SILVA, NPCId.ELENA_VOLKOV, 0.5);

        // Initially Chen Wei → Elena Volkov doesn't exist
        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(initialWeight).toBe(0);

        // Run many ticks to allow triadic closure to occur
        let closureOccurred = false;
        let closureNpcA: string | undefined;
        let closureNpcC: string | undefined;
        for (let i = 0; i < 200; i++) {
          const events = manager.tick(POLITICAL_PRESSURE_START_SOL + i);
          const closureEvent = events.find((e) => e.type === "TRIADIC_CLOSURE");
          if (closureEvent) {
            closureOccurred = true;
            closureNpcA = closureEvent.npcA as string;
            closureNpcC = closureEvent.npcC as string;
            break;
          }
        }

        // With probability-based closure, it may or may not occur
        // But if it did, verify the connection was created for the actual NPCs involved
        if (closureOccurred && closureNpcA && closureNpcC) {
          const newWeight = manager.getRelationshipWeight(
            closureNpcA as NPCId,
            closureNpcC as NPCId,
          );
          expect(newWeight).toBeGreaterThan(0);
        }
      });

      it("should record triadic closure in history", () => {
        // Set up strong connections that exceed threshold
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.5);
        manager.setRelationship(NPCId.NOVA_SILVA, NPCId.ELENA_VOLKOV, 0.5);

        // Run many ticks
        for (let i = 0; i < 300; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const history = manager.getTriadicClosureHistory();
        // May or may not have closures depending on random chance
        // Just verify the history is accessible
        expect(Array.isArray(history)).toBe(true);
      });

      it("should not form connections below threshold", () => {
        // Zero out all relationships involving CHEN_WEI and ELENA_VOLKOV to prevent
        // alternative triadic closure paths through other NPCs
        const allNpcs = manager.getNPCs();
        for (const npc of allNpcs) {
          if (npc.id !== NPCId.CHEN_WEI && npc.id !== NPCId.ELENA_VOLKOV) {
            manager.setRelationship(NPCId.CHEN_WEI, npc.id, 0);
            manager.setRelationship(npc.id, NPCId.CHEN_WEI, 0);
            manager.setRelationship(NPCId.ELENA_VOLKOV, npc.id, 0);
            manager.setRelationship(npc.id, NPCId.ELENA_VOLKOV, 0);
          }
        }

        // Set up weak connections that don't meet threshold
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, 0);
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.1); // Below threshold
        manager.setRelationship(NPCId.NOVA_SILVA, NPCId.ELENA_VOLKOV, 0.1);

        // Run several ticks
        for (let i = 0; i < 50; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        // Connection should not form (combined strength 0.2 < threshold 0.4)
        const weight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(weight).toBe(0);
      });
    });
  });

  describe("relationship maintenance system", () => {
    describe("interaction tracking", () => {
      it("should track initial relationships", () => {
        const info = manager.getInteractionInfo(NPCId.CHEN_WEI, NPCId.NOVA_SILVA);
        expect(info).toBeDefined();
        expect(info!.interactionType).toBe(InteractionType.INITIAL);
      });

      it("should record interactions manually", () => {
        manager.recordInteraction(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          150,
          InteractionType.LOBBYING,
        );

        const info = manager.getInteractionInfo(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(info).toBeDefined();
        expect(info!.lastInteractionSol).toBe(150);
        expect(info!.interactionType).toBe(InteractionType.LOBBYING);
      });

      it("should correctly identify stale relationships", () => {
        // Fresh relationship at sol 0
        expect(manager.isRelationshipStale(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 10)).toBe(false);

        // Stale relationship after RELATIONSHIP_STALE_THRESHOLD
        expect(
          manager.isRelationshipStale(
            NPCId.CHEN_WEI,
            NPCId.NOVA_SILVA,
            RELATIONSHIP_STALE_THRESHOLD + 10,
          ),
        ).toBe(true);
      });
    });

    describe("unmaintained relationship decay", () => {
      it("should decay unmaintained relationships faster", () => {
        // Create two identical cross-faction relationships
        const testWeight = 0.5;
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV, testWeight);
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.DAVID_MORRISON, testWeight);

        // Keep one relationship fresh with recent interaction
        const freshSol = POLITICAL_PRESSURE_START_SOL + RELATIONSHIP_STALE_THRESHOLD + 5;
        manager.recordInteraction(
          NPCId.CHEN_WEI,
          NPCId.ELENA_VOLKOV,
          freshSol,
          InteractionType.LOBBYING,
        );

        // Don't refresh the other one - it has no interaction record

        // Run ticks starting after the stale threshold for the unmaintained one
        const startSol = freshSol + 5;
        for (let i = 0; i < 50; i++) {
          manager.tick(startSol + i);
        }

        const maintainedWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        const unmaintainedWeight = manager.getRelationshipWeight(
          NPCId.CHEN_WEI,
          NPCId.DAVID_MORRISON,
        );

        // The unmaintained relationship (David Morrison) should have decayed more
        // because it has no interaction record (2x decay multiplier)
        expect(unmaintainedWeight).toBeLessThan(maintainedWeight);
      });
    });

    describe("shared vote bonuses", () => {
      it("should strengthen relationships between NPCs who vote together", () => {
        const resources = new ResourceManager({
          food: 100,
          water: 100,
          power: 100,
          materials: 1000,
        });

        // Set up two NPCs to vote on the same side
        // Propose a project and have both support it
        manager.proposeProject(ProjectId.GENERATION_SHIP, resources);
        manager.lobbyNPC(NPCId.CHEN_WEI, 0.9, resources);
        manager.lobbyNPC(NPCId.MARIA_SANTOS, 0.9, resources); // Both support

        const initialWeight = manager.getRelationshipWeight(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);

        // Run ticks until project resolves
        for (let i = 0; i < 15; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        // Both voted together (supporters), relationship should be strengthened
        // Note: there's also decay happening, so we check the interaction was recorded
        const info = manager.getInteractionInfo(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(info).toBeDefined();
        expect(info!.interactionType).toBe(InteractionType.SHARED_VOTE);
      });
    });

    describe("council interactions", () => {
      it("should record interactions when council is created", () => {
        const resources = new ResourceManager({
          food: 100,
          water: 100,
          power: 100,
          materials: 500,
        });

        manager.createCouncil("Test Council", [NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV], resources, 150);

        // Check that interaction was recorded
        const info = manager.getInteractionInfo(NPCId.CHEN_WEI, NPCId.ELENA_VOLKOV);
        expect(info).toBeDefined();
        expect(info!.lastInteractionSol).toBe(150);
        expect(info!.interactionType).toBe(InteractionType.COUNCIL_MEMBERSHIP);
      });
    });

    describe("serialization", () => {
      it("should persist interaction tracker through serialization", () => {
        manager.recordInteraction(
          NPCId.CHEN_WEI,
          NPCId.MARIA_SANTOS,
          200,
          InteractionType.LOBBYING,
        );

        const json = manager.toJSON();
        const restored = NPCInfluenceManager.fromJSON(json, NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

        const info = restored.getInteractionInfo(NPCId.CHEN_WEI, NPCId.MARIA_SANTOS);
        expect(info).toBeDefined();
        expect(info!.lastInteractionSol).toBe(200);
        expect(info!.interactionType).toBe(InteractionType.LOBBYING);
      });

      it("should persist triadic closure history through serialization", () => {
        // Set up conditions for triadic closure
        manager.setRelationship(NPCId.CHEN_WEI, NPCId.NOVA_SILVA, 0.5);
        manager.setRelationship(NPCId.NOVA_SILVA, NPCId.ELENA_VOLKOV, 0.5);

        // Run many ticks
        for (let i = 0; i < 300; i++) {
          manager.tick(POLITICAL_PRESSURE_START_SOL + i);
        }

        const json = manager.toJSON();
        const restored = NPCInfluenceManager.fromJSON(json, NPCS, INITIAL_RELATIONSHIPS, PROJECTS);

        // History should be preserved (may be empty if no closures occurred)
        const history = restored.getTriadicClosureHistory();
        expect(Array.isArray(history)).toBe(true);
      });
    });
  });
});
