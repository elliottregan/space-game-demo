import { describe, expect, test, beforeEach } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { DistrictManager } from "../src/core/systems/DistrictManager";
import type { TechnologyTree } from "../src/core/systems/TechnologyTree";
import type { DriftContext } from "../src/core/data/factionDrift";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import * as IdeologyBalance from "../src/core/balance/IdeologyBalance";
import { AXIS_KEYS } from "../src/core/models/NPCInfluence";
import { BUILDINGS } from "../src/core/data/buildings";

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

function createMockResources(food: number): ResourceManager {
  return new ResourceManager({ food, water: 100, materials: 100 });
}

function createMockDistricts(capacity: number): DistrictManager {
  const manager = new DistrictManager();
  if (capacity > 0) {
    const district = manager.foundDistrict("Central", 0);
    district.capacity = capacity;
  }
  return manager;
}

function createMockColony(population: number): ColonyManager {
  return new ColonyManager(population);
}

function createMockTechnology(researchedCount: number): TechnologyTree {
  return {
    getResearchedCount: () => researchedCount,
  } as unknown as TechnologyTree;
}

function createDriftContext(overrides: {
  food?: number;
  population?: number;
  habitatCapacity?: number;
  researchedCount?: number;
  health?: number;
  morale?: number;
}): DriftContext {
  const {
    food = 100,
    population = 20,
    habitatCapacity = 30,
    researchedCount = 0,
    health,
    morale,
  } = overrides;

  const colony = createMockColony(population);
  if (health !== undefined) colony.setHealth(health);
  if (morale !== undefined) colony.setMorale(morale);

  return {
    resources: createMockResources(food),
    colony,
    buildings: new BuildingManager(BUILDINGS),
    districts: createMockDistricts(habitatCapacity),
    technology: createMockTechnology(researchedCount),
  };
}

describe("Faction Drift", () => {
  let ideologyManager: IdeologyManager;

  beforeEach(() => {
    ideologyManager = new IdeologyManager();
  });

  describe("pressure from conditions", () => {
    test("resource scarcity pushes solidarity toward collectivist", () => {
      // Very low food per capita (food=20, population=20 => 1 per capita)
      const ctx = createDriftContext({ food: 20, population: 20 });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        expect(faction.pressure.solidarity).toBeGreaterThan(0);
      }
    });

    test("resource abundance pushes solidarity toward individualist", () => {
      // High food per capita (food=800, population=20 => 40 per capita)
      const ctx = createDriftContext({ food: 800, population: 20 });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        expect(faction.pressure.solidarity).toBeLessThan(0);
      }
    });

    test("housing crisis pushes solidarity toward collectivist", () => {
      // Overcrowded: population 25, capacity 25 => 100% occupancy
      const ctx = createDriftContext({
        food: 300,
        population: 25,
        habitatCapacity: 25,
      });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        // Should have collectivist pressure from housing crisis
        expect(faction.pressure.solidarity).toBeGreaterThan(0);
      }
    });

    test("large population pushes sovereignty toward Mars-sovereign", () => {
      const ctx = createDriftContext({
        population: 35,
        habitatCapacity: 50,
        food: 500,
      });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        expect(faction.pressure.sovereignty).toBeGreaterThan(0);
      }
    });

    test("small population pushes sovereignty toward Earth-tied", () => {
      const ctx = createDriftContext({
        population: 8,
        habitatCapacity: 20,
        food: 200,
      });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        expect(faction.pressure.sovereignty).toBeLessThan(0);
      }
    });

    test("many techs researched pushes transformation toward revolutionary", () => {
      const ctx = createDriftContext({
        researchedCount: 10,
        food: 300,
        population: 20,
      });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        expect(faction.pressure.transformation).toBeGreaterThan(0);
      }
    });

    test("high stability pushes transformation toward preservationist", () => {
      const ctx = createDriftContext({
        health: 90,
        morale: 90,
        food: 300,
        population: 20,
      });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        expect(faction.pressure.transformation).toBeLessThan(0);
      }
    });

    test("pressure is clamped to [-1, 1]", () => {
      // Apply extreme conditions many times
      const ctx = createDriftContext({ food: 5, population: 20 });

      for (let i = 0; i < 200; i++) {
        ideologyManager.updateFactionPressure(ctx);
      }

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        for (const axis of AXIS_KEYS) {
          expect(faction.pressure[axis]).toBeGreaterThanOrEqual(-1);
          expect(faction.pressure[axis]).toBeLessThanOrEqual(1);
        }
      }
    });

    test("neutral conditions produce no pressure", () => {
      // Moderate everything: 15 food per capita, 67% occupancy, no techs
      const ctx = createDriftContext({
        food: 300,
        population: 20,
        habitatCapacity: 30,
        researchedCount: 0,
        health: 70,
        morale: 70,
      });

      ideologyManager.updateFactionPressure(ctx);

      const factions = ideologyManager.getFactions();
      for (const faction of factions) {
        // Solidarity: 15 food/capita is between 10 and 20 => no pressure
        // Sovereignty: population 20 is between 15 and 30 => no pressure
        // Transformation: 0 techs and health/morale < 80 => no pressure
        for (const axis of AXIS_KEYS) {
          expect(faction.pressure[axis]).toBe(0);
        }
      }
    });
  });

  describe("position drift", () => {
    test("faction position drifts toward pressure", () => {
      const factions = ideologyManager.getFactions();

      // Manually set pressure on a faction
      const faction = factions[0]!;
      faction.pressure.solidarity = 0.5;

      const initialPosition = faction.position.solidarity;

      // Create colonists with low conviction near this faction
      const colonists = [
        createTestColonist("c1", "Col1", {
          ...faction.position,
          conviction: IdeologyBalance.CONVICTION_MIN,
        }),
      ];

      ideologyManager.driftFactionPositions(colonists);

      // Position should move toward pressure
      if (faction.pressure.solidarity > initialPosition) {
        expect(faction.position.solidarity).toBeGreaterThan(initialPosition);
      } else {
        expect(faction.position.solidarity).toBeLessThan(initialPosition);
      }
    });

    test("high average conviction dampens drift", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      // Set same pressure for two runs
      const pressureValue = 0.8;

      // Run 1: Low conviction colonists
      faction.pressure.solidarity = pressureValue;
      const startPos1 = faction.position.solidarity;

      const lowConvictionColonists = Array.from({ length: 5 }, (_, i) =>
        createTestColonist(`low_${i}`, `Low${i}`, {
          ...faction.position,
          conviction: IdeologyBalance.CONVICTION_MIN,
        }),
      );

      ideologyManager.driftFactionPositions(lowConvictionColonists);
      const drift1 = Math.abs(faction.position.solidarity - startPos1);

      // Reset position for run 2
      faction.position.solidarity = startPos1;
      faction.pressure.solidarity = pressureValue;

      // Run 2: High conviction colonists
      const highConvictionColonists = Array.from({ length: 5 }, (_, i) =>
        createTestColonist(`high_${i}`, `High${i}`, {
          ...faction.position,
          conviction: IdeologyBalance.CONVICTION_MAX,
        }),
      );

      ideologyManager.driftFactionPositions(highConvictionColonists);
      const drift2 = Math.abs(faction.position.solidarity - startPos1);

      // Low conviction should drift more than high conviction
      expect(drift1).toBeGreaterThan(drift2);
    });

    test("position is clamped to [-1, 1]", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      // Push position to extreme
      faction.position.solidarity = 0.99;
      faction.pressure.solidarity = 1.0;

      const colonists = [
        createTestColonist("c1", "Col1", {
          ...faction.position,
          conviction: IdeologyBalance.CONVICTION_MIN,
        }),
      ];

      // Drift many times
      for (let i = 0; i < 100; i++) {
        ideologyManager.driftFactionPositions(colonists);
      }

      for (const axis of AXIS_KEYS) {
        expect(faction.position[axis]).toBeGreaterThanOrEqual(-1);
        expect(faction.position[axis]).toBeLessThanOrEqual(1);
      }
    });

    test("faction with no members still drifts (0 conviction = no dampening)", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      faction.pressure.solidarity = 0.8;
      const initialPosition = faction.position.solidarity;

      // No colonists near this faction
      ideologyManager.driftFactionPositions([]);

      // Should still drift since 0 avg conviction means full drift rate
      const drift = Math.abs(faction.position.solidarity - initialPosition);
      expect(drift).toBeGreaterThan(0);
    });
  });

  describe("pressure decay", () => {
    test("pressure decays toward zero without reinforcement", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      faction.pressure.solidarity = 0.5;
      faction.pressure.sovereignty = -0.3;

      ideologyManager.decayFactionPressure();

      expect(faction.pressure.solidarity).toBeLessThan(0.5);
      expect(faction.pressure.solidarity).toBeGreaterThan(0);

      expect(faction.pressure.sovereignty).toBeGreaterThan(-0.3);
      expect(faction.pressure.sovereignty).toBeLessThan(0);
    });

    test("pressure doesn't overshoot zero", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      // Set pressure smaller than decay rate
      const smallPressure = IdeologyBalance.FACTION_PRESSURE_DECAY / 2;
      faction.pressure.solidarity = smallPressure;
      faction.pressure.sovereignty = -smallPressure;

      ideologyManager.decayFactionPressure();

      expect(faction.pressure.solidarity).toBe(0);
      expect(faction.pressure.sovereignty).toBe(0);
    });

    test("pressure at zero stays at zero", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      faction.pressure.solidarity = 0;
      faction.pressure.sovereignty = 0;
      faction.pressure.transformation = 0;

      ideologyManager.decayFactionPressure();

      expect(faction.pressure.solidarity).toBe(0);
      expect(faction.pressure.sovereignty).toBe(0);
      expect(faction.pressure.transformation).toBe(0);
    });

    test("large pressure decays gradually", () => {
      const factions = ideologyManager.getFactions();
      const faction = factions[0]!;

      faction.pressure.solidarity = 1.0;

      ideologyManager.decayFactionPressure();

      expect(faction.pressure.solidarity).toBe(1.0 - IdeologyBalance.FACTION_PRESSURE_DECAY);
    });
  });

  describe("integration", () => {
    test("full cycle: conditions -> pressure -> drift -> decay", () => {
      // Scarcity conditions
      const ctx = createDriftContext({ food: 20, population: 20 });

      const factions = ideologyManager.getFactions();
      const initialPositions = factions.map((f) => ({ ...f.position }));

      // Step 1: Apply pressure from conditions
      ideologyManager.updateFactionPressure(ctx);

      // Verify pressure was applied
      for (const faction of factions) {
        expect(faction.pressure.solidarity).toBeGreaterThan(0);
      }

      // Step 2: Drift positions toward pressure
      const colonists = factions.flatMap((f, i) =>
        Array.from({ length: 3 }, (_, j) =>
          createTestColonist(`c${i}_${j}`, `Col${i}_${j}`, {
            ...f.position,
            conviction: 0.3,
          }),
        ),
      );

      ideologyManager.driftFactionPositions(colonists);

      // Step 3: Decay pressure
      ideologyManager.decayFactionPressure();

      // Verify pressure decayed
      for (const faction of factions) {
        // Pressure should be less than what was accumulated (decayed)
        const hasSomePressure = AXIS_KEYS.some((axis) => Math.abs(faction.pressure[axis]) > 0);
        expect(hasSomePressure).toBe(true);
      }

      // Verify positions changed
      for (let i = 0; i < factions.length; i++) {
        const positionsChanged = AXIS_KEYS.some(
          (axis) => factions[i]!.position[axis] !== initialPositions[i]![axis],
        );
        expect(positionsChanged).toBe(true);
      }
    });
  });
});
