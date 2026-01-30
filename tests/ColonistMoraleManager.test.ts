// tests/ColonistMoraleManager.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { ColonistMoraleManager } from "../src/core/systems/ColonistMoraleManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";

describe("ColonistMoraleManager", () => {
  let colonyManager: ColonyManager;
  let resourceManager: ResourceManager;
  let relationshipManager: RelationshipManager;
  let moraleManager: ColonistMoraleManager;

  beforeEach(() => {
    colonyManager = new ColonyManager(3);
    resourceManager = new ResourceManager({
      food: 100,
      water: 100,
      oxygen: 100,
      power: 100,
      materials: 100,
    });
    relationshipManager = new RelationshipManager();
    moraleManager = new ColonistMoraleManager();
  });

  describe("calculateBaseMorale", () => {
    it("returns high morale when all needs satisfied", () => {
      const colonists = colonyManager.getColonists();
      const colonist = colonists[0]!;
      colonist.housingId = "habitat_1"; // Housed

      // Create social connections
      const others = colonists.slice(1);
      for (const other of others) {
        relationshipManager.createRelationship(colonist.id, other.id, 0, {
          initialStrength: 0.6,
        });
      }

      // Positive resource flow
      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      const baseMorale = moraleManager.calculateBaseMorale(
        colonist,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(baseMorale).toBeGreaterThan(80);
    });

    it("returns low morale when physiological needs unmet", () => {
      const colonist = colonyManager.getColonists()[0]!;
      colonist.housingId = "habitat_1";

      // Negative resource flow (shortage)
      resourceManager.addConsumption({ food: 200, water: 200, oxygen: 200 });

      const baseMorale = moraleManager.calculateBaseMorale(
        colonist,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(baseMorale).toBeLessThan(60);
    });

    it("penalizes unhoused colonists", () => {
      const colonists = colonyManager.getColonists();
      const housed = colonists[0]!;
      const unhoused = colonists[1]!;
      housed.housingId = "habitat_1";
      // unhoused has no housingId

      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      const housedMorale = moraleManager.calculateBaseMorale(
        housed,
        resourceManager,
        relationshipManager,
        colonyManager,
      );
      const unhousedMorale = moraleManager.calculateBaseMorale(
        unhoused,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(housedMorale).toBeGreaterThan(unhousedMorale);
    });

    it("penalizes isolated colonists", () => {
      // Add a 4th colonist so we can give connected colonist 2+ connections
      colonyManager.addColonist();
      const colonists = colonyManager.getColonists();
      const connected = colonists[0]!;
      const isolated = colonists[1]!;

      connected.housingId = "h1";
      isolated.housingId = "h2";

      // Give connected colonist 2 friends (above isolation threshold of 1)
      relationshipManager.createRelationship(connected.id, colonists[2]!.id, 0, {
        initialStrength: 0.7,
      });
      relationshipManager.createRelationship(connected.id, colonists[3]!.id, 0, {
        initialStrength: 0.7,
      });

      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      const connectedMorale = moraleManager.calculateBaseMorale(
        connected,
        resourceManager,
        relationshipManager,
        colonyManager,
      );
      const isolatedMorale = moraleManager.calculateBaseMorale(
        isolated,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      expect(connectedMorale).toBeGreaterThan(isolatedMorale);
    });
  });

  describe("propagateMorale", () => {
    it("isolated colonist morale converges to base morale", () => {
      const colonist = colonyManager.getColonists()[0]!;
      colonist.housingId = "h1";
      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      // Set initial morale different from base
      moraleManager.setMorale(colonist.id, 30);

      // Calculate base morale
      const baseMorale = moraleManager.calculateBaseMorale(
        colonist,
        resourceManager,
        relationshipManager,
        colonyManager,
      );

      // Propagate several times
      for (let i = 0; i < 20; i++) {
        moraleManager.propagateMorale(
          colonyManager.getColonists(),
          resourceManager,
          relationshipManager,
          colonyManager,
        );
      }

      // Should converge toward base morale
      const finalMorale = moraleManager.getMorale(colonist.id);
      expect(Math.abs(finalMorale - baseMorale)).toBeLessThan(10);
    });

    it("high-centrality happy colonist raises neighbors morale", () => {
      const colonists = colonyManager.getColonists();
      const hub = colonists[0]!;
      const neighbor = colonists[1]!;

      // House everyone
      hub.housingId = "h1";
      neighbor.housingId = "h2";
      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      // Create star topology (hub connected to all)
      for (const other of colonists.slice(1)) {
        relationshipManager.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
      }

      // Calculate centrality
      relationshipManager.recalculateCentrality(0);

      // Hub is happy, neighbor starts sad
      moraleManager.setMorale(hub.id, 90);
      moraleManager.setMorale(neighbor.id, 40);

      // Propagate
      for (let i = 0; i < 10; i++) {
        moraleManager.propagateMorale(
          colonists,
          resourceManager,
          relationshipManager,
          colonyManager,
        );
      }

      // Neighbor should have increased morale
      expect(moraleManager.getMorale(neighbor.id)).toBeGreaterThan(40);
    });

    it("high-centrality unhappy colonist drags down neighbors", () => {
      const colonists = colonyManager.getColonists();
      const hub = colonists[0]!;
      const neighbor = colonists[1]!;

      hub.housingId = "h1";
      neighbor.housingId = "h2";
      resourceManager.addProduction({ food: 10, water: 10, oxygen: 10 });

      // Create connections
      for (const other of colonists.slice(1)) {
        relationshipManager.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
      }

      relationshipManager.recalculateCentrality(0);

      // Hub is sad, neighbor starts happy
      moraleManager.setMorale(hub.id, 20);
      moraleManager.setMorale(neighbor.id, 80);

      // Propagate
      for (let i = 0; i < 10; i++) {
        moraleManager.propagateMorale(
          colonists,
          resourceManager,
          relationshipManager,
          colonyManager,
        );
      }

      // Neighbor should have decreased morale
      expect(moraleManager.getMorale(neighbor.id)).toBeLessThan(80);
    });
  });

  describe("getColonyMorale", () => {
    it("returns centrality-weighted average", () => {
      const colonists = colonyManager.getColonists();

      // Create star topology - first colonist is hub
      const hub = colonists[0]!;
      for (const other of colonists.slice(1)) {
        relationshipManager.createRelationship(hub.id, other.id, 0, { initialStrength: 0.8 });
      }
      relationshipManager.recalculateCentrality(0);

      // Hub has low morale, others have high morale
      moraleManager.setMorale(hub.id, 20);
      for (const other of colonists.slice(1)) {
        moraleManager.setMorale(other.id, 80);
      }

      const colonyMorale = moraleManager.getColonyMorale(colonists, relationshipManager);

      // Simple average would be (20 + 80 + 80) / 3 = 60
      // But hub has higher centrality, so colony morale should be lower
      expect(colonyMorale).toBeLessThan(60);
    });

    it("returns simple average when no centrality calculated", () => {
      const colonists = colonyManager.getColonists();

      moraleManager.setMorale(colonists[0]!.id, 30);
      moraleManager.setMorale(colonists[1]!.id, 60);
      moraleManager.setMorale(colonists[2]!.id, 90);

      // No centrality calculation, all colonists equal weight
      const colonyMorale = moraleManager.getColonyMorale(colonists, relationshipManager);

      expect(colonyMorale).toBeCloseTo(60, 0);
    });

    it("returns 50 for empty colony", () => {
      const emptyColony = new ColonyManager(0);
      const colonyMorale = moraleManager.getColonyMorale(
        emptyColony.getColonists(),
        relationshipManager,
      );
      expect(colonyMorale).toBe(50);
    });
  });
});
