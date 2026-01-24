// tests/NPCInfluenceManager.test.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import { NPCInfluenceManager } from '../src/core/systems/NPCInfluenceManager';
import { ResourceManager } from '../src/core/systems/ResourceManager';
import { NPCS, INITIAL_RELATIONSHIPS, PROJECTS } from '../src/core/data/npcs';
import { LOBBY_BASE_COST, COUNCIL_CREATION_COST, COUNCIL_RELATIONSHIP_BOOST } from '../src/core/balance/NPCInfluenceBalance';
import type { GameEvent } from '../src/core/models/GameEvent';

describe('NPCInfluenceManager', () => {
  let manager: NPCInfluenceManager;

  beforeEach(() => {
    manager = new NPCInfluenceManager(NPCS, INITIAL_RELATIONSHIPS, PROJECTS);
  });

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

  describe('initialization', () => {
    it('should store all NPCs', () => {
      const npcs = manager.getNPCs();
      expect(npcs.length).toBe(10);
    });

    it('should store all projects', () => {
      const projects = manager.getProjects();
      expect(projects.length).toBe(8);
    });

    it('should build relationship matrix from initial data', () => {
      const matrix = manager.getRelationshipMatrix();
      expect(matrix.length).toBe(10);
      expect(matrix[0]!.length).toBe(10);
    });

    it('should have no active project initially', () => {
      expect(manager.getActiveProject()).toBeNull();
    });
  });

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
      expect(councils[0]!.name).toBe('Science Council');
      expect(councils[0]!.memberIds).toEqual(memberIds);
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
      const initialWeight = initialMatrix[elenaIdx]![chenIdx]!;

      manager.createCouncil('Science Council', ['chen_wei', 'elena_volkov'], resources);

      const newMatrix = manager.getRelationshipMatrix();
      expect(newMatrix[elenaIdx]![chenIdx]!).toBe(Math.min(1.0, initialWeight + COUNCIL_RELATIONSHIP_BOOST));
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

  describe('faction demands', () => {
    it('should generate demand when faction support drops below threshold', () => {
      // Start with no demands
      expect(manager.getActiveDemands()).toEqual([]);

      // Set support above threshold for mars_independence and corporate_interests
      // mars_independence: maria_santos, james_liu, aisha_patel, marcus_reed
      manager.adjustNPCSupport('maria_santos', 0.6);
      manager.adjustNPCSupport('james_liu', 0.6);
      manager.adjustNPCSupport('aisha_patel', 0.6);
      manager.adjustNPCSupport('marcus_reed', 0.6);
      // corporate_interests: elena_volkov, david_morrison, sarah_chen
      manager.adjustNPCSupport('elena_volkov', 0.6);
      manager.adjustNPCSupport('david_morrison', 0.6);
      manager.adjustNPCSupport('sarah_chen', 0.6);

      // Set support below threshold for earth_loyalists (threshold is 0.5)
      // earth_loyalists: chen_wei, nova_silva, alex_okonkwo
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
      // Set support above threshold for mars_independence and corporate_interests
      manager.adjustNPCSupport('maria_santos', 0.6);
      manager.adjustNPCSupport('james_liu', 0.6);
      manager.adjustNPCSupport('aisha_patel', 0.6);
      manager.adjustNPCSupport('marcus_reed', 0.6);
      manager.adjustNPCSupport('elena_volkov', 0.6);
      manager.adjustNPCSupport('david_morrison', 0.6);
      manager.adjustNPCSupport('sarah_chen', 0.6);

      // Set support below threshold for earth_loyalists
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

  describe('demand resolution', () => {
    it('should clear demand and boost support when faction project passes', () => {
      const resources = new ResourceManager({
        food: 100, oxygen: 100, water: 100, power: 100, materials: 1000,
      });

      // Set support above threshold for mars_independence and corporate_interests
      // mars_independence: maria_santos, james_liu, aisha_patel, marcus_reed
      manager.adjustNPCSupport('maria_santos', 0.6);
      manager.adjustNPCSupport('james_liu', 0.6);
      manager.adjustNPCSupport('aisha_patel', 0.6);
      manager.adjustNPCSupport('marcus_reed', 0.6);
      // corporate_interests: elena_volkov, david_morrison, sarah_chen
      manager.adjustNPCSupport('elena_volkov', 0.6);
      manager.adjustNPCSupport('david_morrison', 0.6);
      manager.adjustNPCSupport('sarah_chen', 0.6);

      // Create demand for earth_loyalists (below threshold of 0.5)
      manager.adjustNPCSupport('chen_wei', 0.4);
      manager.adjustNPCSupport('nova_silva', 0.4);
      manager.adjustNPCSupport('alex_okonkwo', 0.4);
      manager.tick(150);

      expect(manager.getActiveDemands().length).toBe(1);
      expect(manager.getActiveDemands()[0].factionId).toBe('earth_loyalists');

      // Propose an earth_loyalists project
      manager.proposeProject('earth_memorial', resources);

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
      const earthDemands = manager.getActiveDemands().filter(d => d.factionId === 'earth_loyalists');
      expect(earthDemands.length).toBe(0);

      // Support should be boosted (PROJECT_PASS_SUPPORT_BOOST is 0.3)
      const supportAfter = manager.getFactionSupport().earth_loyalists;
      expect(supportAfter).toBeGreaterThan(supportBefore);
    });
  });

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

      // Expire the deadline (60 sols + a bit more)
      for (let i = 0; i < 65; i++) {
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
});
