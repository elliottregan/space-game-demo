import { describe, it, expect, beforeEach } from 'bun:test';
import { ResourceManager } from '../src/core/systems/ResourceManager';

describe('ResourceManager', () => {
  let manager: ResourceManager;

  beforeEach(() => {
    manager = new ResourceManager({
      food: 100,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 100
    });
  });

  it('should initialize with starting resources', () => {
    const resources = manager.getResources();
    expect(resources.food).toBe(100);
    expect(resources.oxygen).toBe(100);
  });

  it('should consume resources each tick', () => {
    manager.addConsumption({ food: 5 });
    manager.tick();
    expect(manager.getResources().food).toBe(95);
  });

  it('should produce resources each tick', () => {
    manager.addProduction({ food: 10 });
    manager.tick();
    expect(manager.getResources().food).toBe(110);
  });

  it('should emit warning when resource is low', () => {
    const lowManager = new ResourceManager({
      food: 15,
      oxygen: 100,
      water: 100,
      power: 100,
      materials: 100
    });

    const events = lowManager.tick();
    const warning = events.find(e => e.type === 'RESOURCE_LOW');
    expect(warning).toBeDefined();
    expect(warning?.resource).toBe('food');
  });

  it('should not go below zero', () => {
    manager.addConsumption({ food: 200 });
    manager.tick();
    expect(manager.getResources().food).toBe(0);
  });

  it('should check affordability correctly', () => {
    expect(manager.canAfford({ food: 30 })).toBe(true);
    expect(manager.canAfford({ food: 150 })).toBe(false);
  });

  it('should deduct resources on purchase', () => {
    manager.deduct({ materials: 50, power: 10 });
    const resources = manager.getResources();
    expect(resources.materials).toBe(50);
    expect(resources.power).toBe(90);
  });

  it('should calculate net flow correctly', () => {
    manager.addProduction({ food: 10 });
    manager.addConsumption({ food: 5 });
    const netFlow = manager.getNetFlow();
    expect(netFlow.food).toBe(5);
  });
});
