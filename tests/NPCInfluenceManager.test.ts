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
