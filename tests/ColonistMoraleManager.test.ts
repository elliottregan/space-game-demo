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
});
