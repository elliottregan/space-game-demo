import { describe, expect, test, beforeEach } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { RelationshipManager } from "../src/core/systems/RelationshipManager";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";

function createTestColonist(id: string, name: string, ideology: ColonistIdeology): Colonist {
  return {
    id,
    name,
    role: ColonistRole.UNASSIGNED,
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
    skills: [],
    ideology,
  };
}

describe("IdeologySpread", () => {
  let ideologyManager: IdeologyManager;
  let relationshipManager: RelationshipManager;

  beforeEach(() => {
    ideologyManager = new IdeologyManager();
    relationshipManager = new RelationshipManager();
  });

  describe("Axis-based drift", () => {
    test("colonist drifts toward connected neighbor on all three axes", () => {
      const colonistA = createTestColonist("a", "Alice", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const colonistB = createTestColonist("b", "Bob", {
        solidarity: 0.8,
        sovereignty: -0.6,
        transformation: 0.4,
        conviction: 0.5,
      });

      const colonists = [colonistA, colonistB];

      relationshipManager.createRelationship("a", "b", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD + 0.3,
      });

      const initialSolidarity = colonistA.ideology!.solidarity;
      const initialSovereignty = colonistA.ideology!.sovereignty;
      const initialTransformation = colonistA.ideology!.transformation;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(colonistA.ideology!.solidarity).toBeGreaterThan(initialSolidarity);
      expect(colonistA.ideology!.sovereignty).toBeLessThan(initialSovereignty);
      expect(colonistA.ideology!.transformation).toBeGreaterThan(initialTransformation);

      expect(Math.abs(colonistA.ideology!.solidarity - colonistB.ideology!.solidarity)).toBeLessThan(
        0.8,
      );
      expect(Math.abs(colonistA.ideology!.sovereignty - colonistB.ideology!.sovereignty)).toBeLessThan(
        0.6,
      );
      expect(
        Math.abs(colonistA.ideology!.transformation - colonistB.ideology!.transformation),
      ).toBeLessThan(0.4);
    });

    test("colonist with intermediate values drifts toward extreme neighbor", () => {
      const colonistA = createTestColonist("a", "Alice", {
        solidarity: 0.3,
        sovereignty: -0.2,
        transformation: 0.1,
        conviction: 0.3,
      });

      const colonistB = createTestColonist("b", "Bob", {
        solidarity: -0.7,
        sovereignty: 0.8,
        transformation: -0.5,
        conviction: 0.6,
      });

      const colonists = [colonistA, colonistB];
      relationshipManager.createRelationship("a", "b", 0, { initialStrength: 0.8 });

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(colonistA.ideology!.solidarity).toBeLessThan(0.3);
      expect(colonistA.ideology!.sovereignty).toBeGreaterThan(-0.2);
      expect(colonistA.ideology!.transformation).toBeLessThan(0.1);
    });

    test("mutual drift between two connected colonists", () => {
      const colonistA = createTestColonist("a", "Alice", {
        solidarity: -0.4,
        sovereignty: 0.6,
        transformation: 0.3,
        conviction: 0.3,
      });

      const colonistB = createTestColonist("b", "Bob", {
        solidarity: 0.5,
        sovereignty: -0.4,
        transformation: -0.2,
        conviction: 0.3,
      });

      const colonists = [colonistA, colonistB];
      relationshipManager.createRelationship("a", "b", 0, { initialStrength: 0.7 });

      const initialDistanceSolidarity = Math.abs(
        colonistA.ideology!.solidarity - colonistB.ideology!.solidarity,
      );
      const initialDistanceSovereignty = Math.abs(
        colonistA.ideology!.sovereignty - colonistB.ideology!.sovereignty,
      );
      const initialDistanceTransformation = Math.abs(
        colonistA.ideology!.transformation - colonistB.ideology!.transformation,
      );

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      const finalDistanceSolidarity = Math.abs(
        colonistA.ideology!.solidarity - colonistB.ideology!.solidarity,
      );
      const finalDistanceSovereignty = Math.abs(
        colonistA.ideology!.sovereignty - colonistB.ideology!.sovereignty,
      );
      const finalDistanceTransformation = Math.abs(
        colonistA.ideology!.transformation - colonistB.ideology!.transformation,
      );

      expect(finalDistanceSolidarity).toBeLessThan(initialDistanceSolidarity);
      expect(finalDistanceSovereignty).toBeLessThan(initialDistanceSovereignty);
      expect(finalDistanceTransformation).toBeLessThan(initialDistanceTransformation);
    });
  });

  describe("Conviction resistance", () => {
    test("high-conviction colonist drifts less than low-conviction", () => {
      const lowConvictionColonist = createTestColonist("low", "Low", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const highConvictionColonist = createTestColonist("high", "High", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.7,
      });

      const influencer = createTestColonist("influencer", "Influencer", {
        solidarity: 0.8,
        sovereignty: 0.8,
        transformation: 0.8,
        conviction: 0.6,
      });

      const relationshipManagerLow = new RelationshipManager();
      const relationshipManagerHigh = new RelationshipManager();
      relationshipManagerLow.createRelationship("low", "influencer", 0, { initialStrength: 0.8 });
      relationshipManagerHigh.createRelationship("high", "influencer", 0, { initialStrength: 0.8 });

      const colonistsLow = [lowConvictionColonist, influencer];
      const colonistsHigh = [highConvictionColonist, influencer];

      ideologyManager.propagateIdeology(colonistsLow, relationshipManagerLow, 1);
      ideologyManager.propagateIdeology(colonistsHigh, relationshipManagerHigh, 1);

      expect(Math.abs(lowConvictionColonist.ideology!.solidarity)).toBeGreaterThan(
        Math.abs(highConvictionColonist.ideology!.solidarity),
      );
      expect(Math.abs(lowConvictionColonist.ideology!.sovereignty)).toBeGreaterThan(
        Math.abs(highConvictionColonist.ideology!.sovereignty),
      );
      expect(Math.abs(lowConvictionColonist.ideology!.transformation)).toBeGreaterThan(
        Math.abs(highConvictionColonist.ideology!.transformation),
      );
    });

    test("maximum conviction colonist resists drift almost completely", () => {
      const stubborn = createTestColonist("stubborn", "Stubborn", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: IdeologyBalance.CONVICTION_MAX,
      });

      const influencer = createTestColonist("influencer", "Influencer", {
        solidarity: 1,
        sovereignty: 1,
        transformation: 1,
        conviction: 0.6,
      });

      const colonists = [stubborn, influencer];
      relationshipManager.createRelationship("stubborn", "influencer", 0, { initialStrength: 1.0 });

      const initialSolidarity = stubborn.ideology!.solidarity;
      const initialSovereignty = stubborn.ideology!.sovereignty;
      const initialTransformation = stubborn.ideology!.transformation;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(Math.abs(stubborn.ideology!.solidarity - initialSolidarity)).toBeLessThan(0.1);
      expect(Math.abs(stubborn.ideology!.sovereignty - initialSovereignty)).toBeLessThan(0.1);
      expect(Math.abs(stubborn.ideology!.transformation - initialTransformation)).toBeLessThan(0.1);
    });
  });

  describe("Clamping", () => {
    test("axis values stay within [-1, 1] even with extreme neighbor", () => {
      const colonist = createTestColonist("colonist", "Colonist", {
        solidarity: 0.9,
        sovereignty: -0.9,
        transformation: 0.9,
        conviction: 0.2,
      });

      const extremeNeighbor = createTestColonist("extreme", "Extreme", {
        solidarity: 1.0,
        sovereignty: -1.0,
        transformation: 1.0,
        conviction: 0.8,
      });

      const colonists = [colonist, extremeNeighbor];
      relationshipManager.createRelationship("colonist", "extreme", 0, { initialStrength: 1.0 });

      for (let i = 0; i < 10; i++) {
        ideologyManager.propagateIdeology(colonists, relationshipManager, i);
      }

      expect(colonist.ideology!.solidarity).toBeGreaterThanOrEqual(-1);
      expect(colonist.ideology!.solidarity).toBeLessThanOrEqual(1);
      expect(colonist.ideology!.sovereignty).toBeGreaterThanOrEqual(-1);
      expect(colonist.ideology!.sovereignty).toBeLessThanOrEqual(1);
      expect(colonist.ideology!.transformation).toBeGreaterThanOrEqual(-1);
      expect(colonist.ideology!.transformation).toBeLessThanOrEqual(1);
    });

    test("clamping preserves independent axis movement", () => {
      const colonist = createTestColonist("colonist", "Colonist", {
        solidarity: 0.98,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const neighbor = createTestColonist("neighbor", "Neighbor", {
        solidarity: 1.0,
        sovereignty: 0.5,
        transformation: -0.3,
        conviction: 0.6,
      });

      const colonists = [colonist, neighbor];
      relationshipManager.createRelationship("colonist", "neighbor", 0, { initialStrength: 0.9 });

      for (let i = 0; i < 10; i++) {
        ideologyManager.propagateIdeology(colonists, relationshipManager, i);
      }

      expect(colonist.ideology!.solidarity).toBeCloseTo(1.0, 1);
      expect(colonist.ideology!.sovereignty).toBeGreaterThan(0);
      expect(colonist.ideology!.transformation).toBeLessThan(0);
    });
  });

  describe("Imprinting", () => {
    test("new colonist blends toward strongest neighbor on all three axes", () => {
      const newColonist = createTestColonist("new", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const strongNeighbor = createTestColonist("strong", "Strong", {
        solidarity: 0.6,
        sovereignty: -0.4,
        transformation: 0.7,
        conviction: 0.5,
      });

      const colonists = [newColonist, strongNeighbor];
      relationshipManager.createRelationship("new", "strong", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_IMPRINTING_THRESHOLD + 0.3,
      });

      IdeologyManager.imprintIdeologyFromNeighbors(
        newColonist,
        colonists,
        relationshipManager,
        IdeologyBalance.IDEOLOGY_IMPRINTING_STRENGTH,
      );

      expect(newColonist.ideology!.solidarity).toBeCloseTo(
        0.6 * IdeologyBalance.IDEOLOGY_IMPRINTING_STRENGTH,
        1,
      );
      expect(newColonist.ideology!.sovereignty).toBeCloseTo(
        -0.4 * IdeologyBalance.IDEOLOGY_IMPRINTING_STRENGTH,
        1,
      );
      expect(newColonist.ideology!.transformation).toBeCloseTo(
        0.7 * IdeologyBalance.IDEOLOGY_IMPRINTING_STRENGTH,
        1,
      );
    });

    test("imprinting chooses strongest neighbor from multiple connections", () => {
      const newColonist = createTestColonist("new", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const weakNeighbor = createTestColonist("weak", "Weak", {
        solidarity: 0.8,
        sovereignty: 0.8,
        transformation: 0.8,
        conviction: 0.4,
      });

      const strongNeighbor = createTestColonist("strong", "Strong", {
        solidarity: -0.7,
        sovereignty: -0.6,
        transformation: -0.5,
        conviction: 0.6,
      });

      const colonists = [newColonist, weakNeighbor, strongNeighbor];
      relationshipManager.createRelationship("new", "weak", 0, { initialStrength: 0.4 });
      relationshipManager.createRelationship("new", "strong", 0, { initialStrength: 0.9 });

      IdeologyManager.imprintIdeologyFromNeighbors(newColonist, colonists, relationshipManager);

      expect(newColonist.ideology!.solidarity).toBeLessThan(0);
      expect(newColonist.ideology!.sovereignty).toBeLessThan(0);
      expect(newColonist.ideology!.transformation).toBeLessThan(0);
    });

    test("imprinting preserves axis independence", () => {
      const newColonist = createTestColonist("new", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const neighbor = createTestColonist("neighbor", "Neighbor", {
        solidarity: 0.8,
        sovereignty: -0.3,
        transformation: 0.6,
        conviction: 0.5,
      });

      const colonists = [newColonist, neighbor];
      relationshipManager.createRelationship("new", "neighbor", 0, { initialStrength: 0.8 });

      IdeologyManager.imprintIdeologyFromNeighbors(newColonist, colonists, relationshipManager);

      expect(newColonist.ideology!.solidarity).toBeGreaterThan(0);
      expect(newColonist.ideology!.sovereignty).toBeLessThan(0);
      expect(newColonist.ideology!.transformation).toBeGreaterThan(0);

      const solidarityRatio = newColonist.ideology!.solidarity / neighbor.ideology!.solidarity;
      const sovereigntyRatio = newColonist.ideology!.sovereignty / neighbor.ideology!.sovereignty;
      const transformationRatio =
        newColonist.ideology!.transformation / neighbor.ideology!.transformation;

      expect(Math.abs(solidarityRatio - sovereigntyRatio)).toBeLessThan(0.1);
      expect(Math.abs(solidarityRatio - transformationRatio)).toBeLessThan(0.1);
    });
  });

  describe("Imprinting threshold", () => {
    test("weak connection below threshold does not trigger imprinting", () => {
      const newColonist = createTestColonist("new", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const neighbor = createTestColonist("neighbor", "Neighbor", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.5,
      });

      const colonists = [newColonist, neighbor];
      relationshipManager.createRelationship("new", "neighbor", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_IMPRINTING_THRESHOLD - 0.05,
      });

      const initialSolidarity = newColonist.ideology!.solidarity;
      const initialSovereignty = newColonist.ideology!.sovereignty;
      const initialTransformation = newColonist.ideology!.transformation;

      IdeologyManager.imprintIdeologyFromNeighbors(newColonist, colonists, relationshipManager);

      expect(newColonist.ideology!.solidarity).toBe(initialSolidarity);
      expect(newColonist.ideology!.sovereignty).toBe(initialSovereignty);
      expect(newColonist.ideology!.transformation).toBe(initialTransformation);
    });

    test("connection at threshold triggers imprinting", () => {
      const newColonist = createTestColonist("new", "New", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const neighbor = createTestColonist("neighbor", "Neighbor", {
        solidarity: 0.6,
        sovereignty: -0.5,
        transformation: 0.4,
        conviction: 0.5,
      });

      const colonists = [newColonist, neighbor];
      relationshipManager.createRelationship("new", "neighbor", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_IMPRINTING_THRESHOLD,
      });

      IdeologyManager.imprintIdeologyFromNeighbors(newColonist, colonists, relationshipManager);

      expect(newColonist.ideology!.solidarity).not.toBe(0);
      expect(newColonist.ideology!.sovereignty).not.toBe(0);
      expect(newColonist.ideology!.transformation).not.toBe(0);
    });
  });

  describe("Neutral colonist drift", () => {
    test("colonist at origin with low conviction drifts faster than normal spread rate", () => {
      const neutralColonist = createTestColonist("neutral", "Neutral", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const influencer = createTestColonist("influencer", "Influencer", {
        solidarity: 0.5,
        sovereignty: 0.4,
        transformation: 0.6,
        conviction: 0.7,
      });

      const colonists = [neutralColonist, influencer];
      relationshipManager.createRelationship("neutral", "influencer", 0, { initialStrength: 0.8 });

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(neutralColonist.ideology!.solidarity).toBeGreaterThan(0);
      expect(neutralColonist.ideology!.sovereignty).toBeGreaterThan(0);
      expect(neutralColonist.ideology!.transformation).toBeGreaterThan(0);

      const totalDrift =
        Math.abs(neutralColonist.ideology!.solidarity) +
        Math.abs(neutralColonist.ideology!.sovereignty) +
        Math.abs(neutralColonist.ideology!.transformation);

      expect(totalDrift).toBeGreaterThan(0.05);
    });

    test("colonist near origin but within threshold drifts faster", () => {
      const nearNeutral = createTestColonist("nearNeutral", "NearNeutral", {
        solidarity: IdeologyBalance.NEUTRAL_AXIS_THRESHOLD - 0.01,
        sovereignty: IdeologyBalance.NEUTRAL_AXIS_THRESHOLD - 0.02,
        transformation: -IdeologyBalance.NEUTRAL_AXIS_THRESHOLD + 0.01,
        conviction: 0.25,
      });

      const influencer = createTestColonist("influencer", "Influencer", {
        solidarity: 0.7,
        sovereignty: -0.6,
        transformation: 0.5,
        conviction: 0.6,
      });

      const colonists = [nearNeutral, influencer];
      relationshipManager.createRelationship("nearNeutral", "influencer", 0, {
        initialStrength: 0.7,
      });

      const initialSolidarity = nearNeutral.ideology!.solidarity;
      const initialSovereignty = nearNeutral.ideology!.sovereignty;
      const initialTransformation = nearNeutral.ideology!.transformation;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      const solidarityChange = Math.abs(nearNeutral.ideology!.solidarity - initialSolidarity);
      const sovereigntyChange = Math.abs(nearNeutral.ideology!.sovereignty - initialSovereignty);
      const transformationChange = Math.abs(
        nearNeutral.ideology!.transformation - initialTransformation,
      );

      expect(solidarityChange).toBeGreaterThan(0.01);
      expect(sovereigntyChange).toBeGreaterThan(0.01);
      expect(transformationChange).toBeGreaterThan(0.01);
    });

    test("colonist just outside neutral threshold uses normal drift rate", () => {
      const notNeutral = createTestColonist("notNeutral", "NotNeutral", {
        solidarity: IdeologyBalance.NEUTRAL_AXIS_THRESHOLD + 0.01,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const influencer = createTestColonist("influencer", "Influencer", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.6,
      });

      const colonists = [notNeutral, influencer];
      relationshipManager.createRelationship("notNeutral", "influencer", 0, {
        initialStrength: 0.8,
      });

      const initialSolidarity = notNeutral.ideology!.solidarity;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      const solidarityChange = Math.abs(notNeutral.ideology!.solidarity - initialSolidarity);

      expect(solidarityChange).toBeLessThan(0.05);
    });

    test("neutral colonist conviction decays during spread", () => {
      const neutralColonist = createTestColonist("neutral", "Neutral", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.4,
      });

      const influencer = createTestColonist("influencer", "Influencer", {
        solidarity: 0.5,
        sovereignty: 0.5,
        transformation: 0.5,
        conviction: 0.6,
      });

      const colonists = [neutralColonist, influencer];
      relationshipManager.createRelationship("neutral", "influencer", 0, { initialStrength: 0.5 });

      const initialConviction = neutralColonist.ideology!.conviction;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(neutralColonist.ideology!.conviction).toBeLessThan(initialConviction);
    });
  });

  describe("Connection threshold", () => {
    test("weak relationship below threshold does not spread ideology", () => {
      const colonistA = createTestColonist("a", "Alice", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const colonistB = createTestColonist("b", "Bob", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.5,
      });

      const colonists = [colonistA, colonistB];
      relationshipManager.createRelationship("a", "b", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD - 0.05,
      });

      const initialSolidarity = colonistA.ideology!.solidarity;
      const initialSovereignty = colonistA.ideology!.sovereignty;
      const initialTransformation = colonistA.ideology!.transformation;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(colonistA.ideology!.solidarity).toBe(initialSolidarity);
      expect(colonistA.ideology!.sovereignty).toBe(initialSovereignty);
      expect(colonistA.ideology!.transformation).toBe(initialTransformation);
    });

    test("relationship at threshold allows ideology spread", () => {
      const colonistA = createTestColonist("a", "Alice", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const colonistB = createTestColonist("b", "Bob", {
        solidarity: 0.6,
        sovereignty: -0.5,
        transformation: 0.4,
        conviction: 0.5,
      });

      const colonists = [colonistA, colonistB];
      relationshipManager.createRelationship("a", "b", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD,
      });

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(colonistA.ideology!.solidarity).toBeGreaterThan(0);
      expect(colonistA.ideology!.sovereignty).toBeLessThan(0);
      expect(colonistA.ideology!.transformation).toBeGreaterThan(0);
    });

    test("multiple weak connections do not combine to spread ideology", () => {
      const target = createTestColonist("target", "Target", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const neighbor1 = createTestColonist("n1", "Neighbor1", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.5,
      });

      const neighbor2 = createTestColonist("n2", "Neighbor2", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.5,
      });

      const colonists = [target, neighbor1, neighbor2];

      const weakStrength = IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD - 0.05;
      relationshipManager.createRelationship("target", "n1", 0, { initialStrength: weakStrength });
      relationshipManager.createRelationship("target", "n2", 0, { initialStrength: weakStrength });

      const initialSolidarity = target.ideology!.solidarity;
      const initialSovereignty = target.ideology!.sovereignty;
      const initialTransformation = target.ideology!.transformation;

      ideologyManager.propagateIdeology(colonists, relationshipManager, 1);

      expect(target.ideology!.solidarity).toBe(initialSolidarity);
      expect(target.ideology!.sovereignty).toBe(initialSovereignty);
      expect(target.ideology!.transformation).toBe(initialTransformation);
    });

    test("strong connection creates faster drift than threshold connection", () => {
      const weakTarget = createTestColonist("weak", "Weak", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const strongTarget = createTestColonist("strong", "Strong", {
        solidarity: 0,
        sovereignty: 0,
        transformation: 0,
        conviction: 0.2,
      });

      const influencerWeak = createTestColonist("influencer1", "Influencer1", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.5,
      });

      const influencerStrong = createTestColonist("influencer2", "Influencer2", {
        solidarity: 0.8,
        sovereignty: 0.7,
        transformation: 0.6,
        conviction: 0.5,
      });

      const relationshipManagerWeak = new RelationshipManager();
      const relationshipManagerStrong = new RelationshipManager();
      const ideologyManagerWeak = new IdeologyManager();
      const ideologyManagerStrong = new IdeologyManager();

      relationshipManagerWeak.createRelationship("weak", "influencer1", 0, {
        initialStrength: IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD,
      });
      relationshipManagerWeak.recalculateCentrality(0);

      relationshipManagerStrong.createRelationship("strong", "influencer2", 0, {
        initialStrength: 0.9,
      });
      relationshipManagerStrong.recalculateCentrality(0);

      const colonistsWeak = [weakTarget, influencerWeak];
      const colonistsStrong = [strongTarget, influencerStrong];

      ideologyManagerWeak.propagateIdeology(colonistsWeak, relationshipManagerWeak, 1);
      ideologyManagerStrong.propagateIdeology(colonistsStrong, relationshipManagerStrong, 1);

      expect(Math.abs(strongTarget.ideology!.solidarity)).toBeGreaterThanOrEqual(
        Math.abs(weakTarget.ideology!.solidarity),
      );
      expect(Math.abs(strongTarget.ideology!.sovereignty)).toBeGreaterThanOrEqual(
        Math.abs(weakTarget.ideology!.sovereignty),
      );
      expect(Math.abs(strongTarget.ideology!.transformation)).toBeGreaterThanOrEqual(
        Math.abs(weakTarget.ideology!.transformation),
      );

      const weakTotal =
        Math.abs(weakTarget.ideology!.solidarity) +
        Math.abs(weakTarget.ideology!.sovereignty) +
        Math.abs(weakTarget.ideology!.transformation);

      const strongTotal =
        Math.abs(strongTarget.ideology!.solidarity) +
        Math.abs(strongTarget.ideology!.sovereignty) +
        Math.abs(strongTarget.ideology!.transformation);

      expect(strongTotal).toBeGreaterThanOrEqual(weakTotal);
    });
  });
});
