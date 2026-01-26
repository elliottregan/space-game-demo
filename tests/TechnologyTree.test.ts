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
  });
});
