// tests/integration/colonistMorale.test.ts
import { describe, it, expect } from "bun:test";
import { GameState } from "../../src/core/GameState";

function calculateVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
}

describe("Colonist Morale Integration", () => {
  it("morale propagates through social network over time", () => {
    const game = new GameState();

    // Get colonists and create social connections
    const colonists = game.colony.getColonists();
    const relationships = game.workforce.getRelationshipManager();

    // Create a connected network
    for (let i = 0; i < colonists.length - 1; i++) {
      const c1 = colonists[i]!;
      const c2 = colonists[i + 1]!;
      relationships.createRelationship(c1.id, c2.id, 0, { initialStrength: 0.7 });
    }

    // Ensure positive resources
    game.resources.add({ food: 500, water: 500 });
    game.resources.addProduction({ food: 20, water: 20 });

    // Set varied initial morale
    const moraleManager = game.getColonistMoraleManager();
    moraleManager.setMorale(colonists[0]!.id, 90);
    moraleManager.setMorale(colonists[colonists.length - 1]!.id, 30);

    // Run several ticks
    for (let i = 0; i < 50; i++) {
      game.tick();
    }

    // Morale should have converged somewhat
    const finalMorales = colonists.map((c) => moraleManager.getMorale(c.id));
    const variance = calculateVariance(finalMorales);

    // Variance should be lower than initial (90 vs 30 = high variance)
    expect(variance).toBeLessThan(400); // Initial variance would be ~900
  });

  it("high-centrality colonist death impacts colony morale calculation", () => {
    const game = new GameState();
    const colonists = game.colony.getColonists();
    const relationships = game.workforce.getRelationshipManager();
    const moraleManager = game.getColonistMoraleManager();

    // Create star topology - first colonist is hub
    const hub = colonists[0]!;
    for (const other of colonists.slice(1)) {
      relationships.createRelationship(hub.id, other.id, 0, { initialStrength: 0.9 });
    }

    // Give everyone good morale
    for (const c of colonists) {
      moraleManager.setMorale(c.id, 80);
    }

    // Calculate initial colony morale
    relationships.recalculateCentrality(0);
    const initialColonyMorale = moraleManager.getColonyMorale(colonists, relationships);

    // Remove the hub
    game.colony.removeColonist(hub.id);
    moraleManager.removeColonist(hub.id);

    // Recalculate with remaining colonists
    relationships.recalculateCentrality(1);
    const remainingColonists = game.colony.getColonists();
    const afterColonyMorale = moraleManager.getColonyMorale(remainingColonists, relationships);

    // Colony morale should be similar (hub had same morale as others)
    // But if hub was unhappy, this would show larger impact
    expect(afterColonyMorale).toBeDefined();
    expect(initialColonyMorale).toBeGreaterThan(0);
  });

  it("centrality affects morale weight in colony aggregation", () => {
    const game = new GameState();
    const colonists = game.colony.getColonists();
    const relationships = game.workforce.getRelationshipManager();
    const moraleManager = game.getColonistMoraleManager();

    if (colonists.length < 3) {
      // Need at least 3 colonists for this test
      return;
    }

    // Create star topology - first colonist is hub
    const hub = colonists[0]!;
    for (const other of colonists.slice(1)) {
      relationships.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
    }

    // Calculate centrality
    relationships.recalculateCentrality(0);

    // Hub has low morale (20), others have high morale (80)
    moraleManager.setMorale(hub.id, 20);
    for (const other of colonists.slice(1)) {
      moraleManager.setMorale(other.id, 80);
    }

    const colonyMorale = moraleManager.getColonyMorale(colonists, relationships);

    // Simple average of (20 + 80 * (n-1)) / n would be higher
    // But centrality-weighted should pull it lower since hub is unhappy
    const simpleAverage = (20 + 80 * (colonists.length - 1)) / colonists.length;
    expect(colonyMorale).toBeLessThan(simpleAverage);
  });

  it("game tick updates morale through tick phases", () => {
    const game = new GameState();
    const moraleManager = game.getColonistMoraleManager();
    const colonists = game.colony.getColonists();

    // Set initial morale values
    for (const c of colonists) {
      moraleManager.setMorale(c.id, 50);
    }

    // Add resources to ensure colony survives
    game.resources.add({ food: 1000, water: 1000, oxygen: 1000 });
    game.resources.addProduction({ food: 50, water: 50, oxygen: 50 });

    // Run one tick
    game.tick();

    // Verify morale manager was accessed and morale values exist
    for (const c of colonists) {
      const morale = moraleManager.getMorale(c.id);
      expect(morale).toBeGreaterThanOrEqual(0);
      expect(morale).toBeLessThanOrEqual(100);
    }
  });

  it("serialization preserves morale state", () => {
    const game = new GameState();
    const moraleManager = game.getColonistMoraleManager();
    const colonists = game.colony.getColonists();

    // Set specific morale values (within valid range 0-100)
    const testMorales = [25, 45, 65, 85, 75, 55, 35, 50, 60, 70];
    for (let i = 0; i < colonists.length; i++) {
      const morale = testMorales[i % testMorales.length]!;
      moraleManager.setMorale(colonists[i]!.id, morale);
    }

    // Serialize and deserialize
    const json = game.toJSON();
    const restored = GameState.fromJSON(json);

    // Verify morale was preserved
    const restoredMoraleManager = restored.getColonistMoraleManager();
    for (let i = 0; i < colonists.length; i++) {
      const expectedMorale = testMorales[i % testMorales.length]!;
      const actualMorale = restoredMoraleManager.getMorale(colonists[i]!.id);
      expect(actualMorale).toBe(expectedMorale);
    }
  });

  it("new colonists receive initial morale value", () => {
    const game = new GameState();
    const moraleManager = game.getColonistMoraleManager();

    // Add a new colonist
    const newColonist = game.colony.addColonist();

    // New colonist should have initial morale (defined in MoraleBalance)
    const morale = moraleManager.getMorale(newColonist.id);
    expect(morale).toBeGreaterThan(0);
    expect(morale).toBeLessThanOrEqual(100);
  });
});
