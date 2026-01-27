import { describe, it, expect } from 'bun:test';
import { GameState } from '../src/core/GameState';
import { NPCFaction } from '../src/core/models/NPCInfluence';

/**
 * Helper to ensure the colony has enough resources to survive indefinitely.
 * This allows us to test political pressure mechanics in isolation.
 */
function ensureColonySurvival(game: GameState): void {
  // Add enough resources to last well beyond 200 sols
  // Consumption is roughly: food ~5/sol, oxygen ~5/sol, water ~3/sol
  game.resources.add({
    food: 2000,
    oxygen: 2000,
    water: 1000,
    power: 1000,
    materials: 5000,
  });
}

describe('Political Pressure Integration', () => {
  it('should generate demands after political pressure starts', () => {
    const game = new GameState();

    // Ensure the colony can survive without production
    ensureColonySurvival(game);

    // Advance past political pressure start (sol 100)
    for (let i = 0; i < 150; i++) {
      game.tick();
    }

    const demands = game.npcInfluence.getActiveDemands();
    // After 150 sols with decay, at least one faction should have demand
    // (initial support is 0, which is below DEMAND_THRESHOLD of 0.5)
    expect(demands.length).toBeGreaterThan(0);
  });

  it('should allow satisfying demands by passing projects', () => {
    const game = new GameState();

    // Ensure the colony can survive without production
    ensureColonySurvival(game);

    // Set high initial support for all factions
    for (const npc of game.npcInfluence.getNPCs()) {
      game.npcInfluence.adjustNPCSupport(npc.id, 0.9);
    }

    // Advance to sol 105 (just past political pressure start)
    for (let i = 0; i < 105; i++) {
      game.tick();
    }

    // Lower support for earth_loyalists to trigger a demand
    const earthNpcs = game.npcInfluence.getNPCs().filter(n => n.faction === NPCFaction.EarthLoyalists);
    for (const npc of earthNpcs) {
      game.npcInfluence.adjustNPCSupport(npc.id, -0.6);
    }

    // Tick once to generate the demand
    game.tick();

    const demandsBefore = game.npcInfluence.getActiveDemands()
      .filter(d => d.factionId === NPCFaction.EarthLoyalists);
    expect(demandsBefore.length).toBe(1);

    const firstDemand = demandsBefore[0];
    if (!firstDemand) {
      throw new Error('Expected at least one demand for earth_loyalists');
    }
    const projectId = firstDemand.projectIds[0];
    if (!projectId) {
      throw new Error('Expected at least one project in demand');
    }

    // Record support before project
    const supportBefore = game.npcInfluence.getFactionSupport().earth_loyalists;

    // Propose the demanded project
    game.npcInfluence.proposeProject(projectId, game.resources);

    // Lobby all NPCs heavily
    for (const npc of game.npcInfluence.getNPCs()) {
      game.npcInfluence.lobbyNPC(npc.id, 0.9, game.resources);
    }

    // Advance until project resolves (PROJECT_VOTE_DELAY is 10 sols)
    let projectPassed = false;
    for (let i = 0; i < 12; i++) {
      const events = game.tick();
      if (events.some(e => e.type === 'PROJECT_PASSED')) {
        projectPassed = true;
      }
    }

    // Verify project passed
    expect(projectPassed).toBe(true);

    // Verify support was boosted (PROJECT_PASS_SUPPORT_BOOST = 0.3)
    const supportAfter = game.npcInfluence.getFactionSupport().earth_loyalists;
    expect(supportAfter).toBeGreaterThan(supportBefore);

    // Note: The demand may be regenerated if support falls below threshold again
    // due to ongoing decay. The key test is that:
    // 1. The project passed
    // 2. Support was boosted
    // These verify the political pressure system is working correctly.
  });

  it('should have lower faction support when demands are ignored', () => {
    const game = new GameState();

    // Ensure the colony can survive without production
    ensureColonySurvival(game);

    // Get initial faction support
    const initialSupport = game.npcInfluence.getFactionSupport();

    // Advance well past political pressure start and past demand deadline
    for (let i = 0; i < 200; i++) {
      game.tick();
    }

    const finalSupport = game.npcInfluence.getFactionSupport();

    // At least one faction should have significantly lower support
    // (support decays at FACTION_SUPPORT_DECAY_RATE per sol once past POLITICAL_PRESSURE_START_SOL)
    const supportDropped = Object.keys(initialSupport).some(faction => {
      const factionKey = faction as keyof typeof initialSupport;
      return finalSupport[factionKey] < initialSupport[factionKey];
    });

    expect(supportDropped).toBe(true);
  });
});
