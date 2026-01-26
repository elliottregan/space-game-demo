import { describe, it, expect, beforeEach } from 'bun:test';
import { TechnologyTree } from '../src/core/systems/TechnologyTree';
import { ResourceManager } from '../src/core/systems/ResourceManager';
import { TECHNOLOGIES } from '../src/core/data/technologies';

describe('TechnologyTree', () => {
  let tree: TechnologyTree;
  let resources: ResourceManager;

  beforeEach(() => {
    tree = new TechnologyTree(TECHNOLOGIES);
    resources = new ResourceManager({
      food: 500,
      oxygen: 500,
      water: 500,
      power: 500,
      materials: 500
    });
  });

  it('should allow researching techs with no prerequisites', () => {
    expect(tree.canResearch('hydroponics')).toBe(true);
    expect(tree.canResearch('water_recycling')).toBe(true);
    expect(tree.canResearch('advanced_materials')).toBe(true);
  });

  it('should not allow researching techs with unmet prerequisites', () => {
    expect(tree.canResearch('robotics')).toBe(false);
    expect(tree.canResearch('generation_ship')).toBe(false);
  });

  it('should start research', () => {
    const result = tree.startResearch('hydroponics', resources);
    expect(result).toBe(true);
    expect(tree.getCurrentResearch()).not.toBeNull();
    expect(tree.getCurrentResearch()?.techId).toBe('hydroponics');
  });

  it('should not allow multiple simultaneous research', () => {
    tree.startResearch('hydroponics', resources);
    const result = tree.startResearch('water_recycling', resources);
    expect(result).toBe(false);
  });

  it('should complete research after required sols', () => {
    tree.startResearch('water_recycling', resources);

    const tech = tree.getTech('water_recycling')!;
    for (let i = 0; i < tech.cost.sols; i++) {
      tree.tick();
    }

    expect(tree.isResearched('water_recycling')).toBe(true);
    expect(tree.getCurrentResearch()).toBeNull();
  });

  it('should emit event on research completion', () => {
    tree.startResearch('water_recycling', resources);

    const tech = tree.getTech('water_recycling')!;
    let events: any[] = [];
    for (let i = 0; i < tech.cost.sols; i++) {
      events = tree.tick();
    }

    const completeEvent = events.find(e => e.type === 'RESEARCH_COMPLETE');
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.techId).toBe('water_recycling');
  });

  it('should allow researching dependent tech after prerequisite is complete', () => {
    tree.startResearch('advanced_materials', resources);

    const tech = tree.getTech('advanced_materials')!;
    for (let i = 0; i < tech.cost.sols; i++) {
      tree.tick();
    }

    expect(tree.canResearch('robotics')).toBe(true);
  });

  describe('Research Queue', () => {
    it('should track progress per tech in a map', () => {
      tree.startResearch('hydroponics', resources);

      // Advance 10 sols
      for (let i = 0; i < 10; i++) {
        tree.tick();
      }

      expect(tree.getResearchProgress('hydroponics')).toBe(10);
    });

    it('should increment progress in the map during tick', () => {
      tree.startResearch('hydroponics', resources);
      tree.tick();
      tree.tick();

      expect(tree.getResearchProgress('hydroponics')).toBe(2);
      expect(tree.getCurrentResearchId()).toBe('hydroponics');
    });

    it('should set currentResearchId and add to queue on startResearch', () => {
      tree.startResearch('hydroponics', resources);

      expect(tree.getCurrentResearchId()).toBe('hydroponics');
      expect(tree.getResearchQueue()).toEqual(['hydroponics']);
    });

    it('should resume progress if tech was partially researched before', () => {
      tree.startResearch('hydroponics', resources);

      // Advance 10 sols
      for (let i = 0; i < 10; i++) {
        tree.tick();
      }

      // Cancel (simulate changing target)
      tree.cancelResearch();
      expect(tree.getResearchProgress('hydroponics')).toBe(10);

      // Start again - should resume
      tree.startResearch('hydroponics', resources);
      expect(tree.getResearchProgress('hydroponics')).toBe(10);
    });

    it('should preserve progress when cancelling research', () => {
      tree.startResearch('hydroponics', resources);

      for (let i = 0; i < 20; i++) {
        tree.tick();
      }

      tree.cancelResearch();

      expect(tree.getCurrentResearchId()).toBeNull();
      expect(tree.getResearchProgress('hydroponics')).toBe(20);
      expect(tree.getResearchQueue()).toEqual([]);
    });

    it('should return prerequisite chain in topological order', () => {
      // generation_ship needs: fusion_drive, cryosleep, closed_ecosystem
      // fusion_drive needs: nuclear_fission, advanced_materials
      // cryosleep needs: advanced_medicine
      // advanced_medicine needs: genetics
      // genetics needs: hydroponics
      // closed_ecosystem needs: hydroponics, water_recycling, genetics
      // nuclear_fission needs: advanced_materials

      const chain = tree.getPrerequisiteChain('generation_ship');

      // Should include all unresearched prerequisites + target
      expect(chain).toContain('generation_ship');
      expect(chain).toContain('fusion_drive');
      expect(chain).toContain('hydroponics');

      // Prerequisites must come before dependents
      expect(chain.indexOf('hydroponics')).toBeLessThan(chain.indexOf('genetics'));
      expect(chain.indexOf('genetics')).toBeLessThan(chain.indexOf('advanced_medicine'));
      expect(chain.indexOf('advanced_materials')).toBeLessThan(chain.indexOf('fusion_drive'));
      expect(chain.indexOf('fusion_drive')).toBeLessThan(chain.indexOf('generation_ship'));
    });

    it('should exclude already researched techs from chain', () => {
      // Research hydroponics first
      tree.startResearch('hydroponics', resources);
      const tech = tree.getTech('hydroponics')!;
      for (let i = 0; i < tech.cost.sols; i++) {
        tree.tick();
      }

      const chain = tree.getPrerequisiteChain('genetics');

      expect(chain).not.toContain('hydroponics');
      expect(chain).toEqual(['genetics']);
    });

    it('should queue all prerequisites when calling queueResearch on locked tech', () => {
      // genetics needs hydroponics
      tree.queueResearch('genetics', resources);

      expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);
      expect(tree.getCurrentResearchId()).toBe('hydroponics');
    });

    it('should merge queues when changing target', () => {
      // Start with genetics (needs hydroponics)
      tree.queueResearch('genetics', resources);
      expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);

      // Advance hydroponics 10 sols
      for (let i = 0; i < 10; i++) {
        tree.tick();
      }
      expect(tree.getResearchProgress('hydroponics')).toBe(10);

      // Change to advanced_medicine (needs hydroponics, genetics, advanced_medicine)
      tree.queueResearch('advanced_medicine', resources);

      // hydroponics still in queue (shared), genetics still needed, advanced_medicine added
      expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics', 'advanced_medicine']);
      // Progress preserved
      expect(tree.getResearchProgress('hydroponics')).toBe(10);
    });

    it('should remove techs not in new chain when changing target', () => {
      // Start with robotics (needs advanced_materials)
      tree.queueResearch('robotics', resources);
      expect(tree.getResearchQueue()).toEqual(['advanced_materials', 'robotics']);

      // Change to genetics (needs hydroponics)
      tree.queueResearch('genetics', resources);

      // robotics and advanced_materials removed, new chain used
      expect(tree.getResearchQueue()).toEqual(['hydroponics', 'genetics']);
    });
  });
});
