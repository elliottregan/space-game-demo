// tests/NPCInfluenceManager.test.ts

import { describe, it, expect, beforeEach } from 'bun:test';
import { NPCInfluenceManager } from '../src/core/systems/NPCInfluenceManager';
import { ResourceManager } from '../src/core/systems/ResourceManager';
import { NPCS, INITIAL_RELATIONSHIPS, PROJECTS } from '../src/core/data/npcs';
import { LOBBY_BASE_COST } from '../src/core/balance/NPCInfluenceBalance';

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
});
