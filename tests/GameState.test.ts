import { describe, it, expect, beforeEach } from 'bun:test';
import { GameState } from '../src/core/GameState';

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  it('should initialize with sol 0', () => {
    expect(gameState.currentSol).toBe(0);
  });

  it('should increment sol on tick', () => {
    gameState.tick();
    expect(gameState.currentSol).toBe(1);
  });

  it('should have starting resources', () => {
    const resources = gameState.resources.getResources();
    expect(resources.food).toBe(280);
    expect(resources.oxygen).toBe(140);
    expect(resources.water).toBe(100);
    expect(resources.power).toBe(500);
    expect(resources.materials).toBe(500);
  });

  it('should have starting population', () => {
    expect(gameState.colony.getPopulation()).toBe(10);
  });

  it('should serialize and deserialize', () => {
    gameState.tick();
    gameState.tick();

    const saved = gameState.toJSON();
    const restored = GameState.fromJSON(saved);

    expect(restored.currentSol).toBe(2);
  });

  it('should trigger system ticks', () => {
    const events = gameState.tick();
    expect(Array.isArray(events)).toBe(true);
  });

  it('should advance multiple sols', () => {
    const events = gameState.advanceTurn(10);
    expect(gameState.currentSol).toBe(10);
    expect(Array.isArray(events)).toBe(true);
  });
});
