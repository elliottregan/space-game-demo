import { describe, it, expect, beforeEach, mock } from "bun:test";
import { HeuristicStrategy } from "../../src/simulation/HeuristicStrategy";
import type { GameAPI } from "../../src/facade/GameAPI";
import type { ResourceSnapshot } from "../../src/facade/types/resources";
import type { ColonySnapshot } from "../../src/facade/types/colony";
import type { TechnologySnapshot } from "../../src/facade/types/technology";
import type { BuildingSnapshot } from "../../src/facade/types/buildings";
import type { ActiveEventSnapshot, EventChoice } from "../../src/facade/types/events";
import type { CanDoResult, Result } from "../../src/facade/types/common";

// Helper to create mock API with defaults
function createMockAPI(overrides: Partial<MockedAPI> = {}): GameAPI {
  const defaultResourceSnapshot: ResourceSnapshot = {
    current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
    production: { food: 10, oxygen: 10, water: 10, power: 10, materials: 10 },
    consumption: { food: 5, oxygen: 5, water: 5, power: 5, materials: 5 },
    netFlow: { food: 5, oxygen: 5, water: 5, power: 5, materials: 5 },
  };

  const defaultColonySnapshot: ColonySnapshot = {
    population: 50,
    health: 80,
    morale: 70,
    colonists: [],
    skillDefinitions: [],
  };

  const defaultTechSnapshot: TechnologySnapshot = {
    all: [],
    available: [],
    researched: [],
    currentResearch: null,
  };

  const allowed: CanDoResult = { allowed: true };
  const notAllowed: CanDoResult = { allowed: false, reason: "Not allowed" };

  const successResult = <T>(data: T): Result<T> => ({ success: true, data });

  return {
    resources: {
      snapshot: mock(() => overrides.resourceSnapshot ?? defaultResourceSnapshot),
      canAfford: mock(() => true),
      checkAffordability: mock(() => allowed),
    },
    buildings: {
      canBuild: mock((defId: string) => {
        if (overrides.canBuild) return overrides.canBuild(defId);
        return allowed;
      }),
      build: mock((defId: string) => {
        if (overrides.buildCalled) overrides.buildCalled(defId);
        return successResult({ id: "b1", definitionId: defId, status: "pending" as const, mode: "normal" as const, progress: 0 });
      }),
      snapshot: mock(() => overrides.buildingsSnapshot ?? {
        active: [{ id: "b0", definitionId: "oxygen_generator", status: "active" as const, mode: "normal" as const, progress: 100 }],
        pending: [],
        definitions: [],
        moraleBoost: 0,
      }),
      getById: mock(() => undefined),
      getDefinition: mock(() => undefined),
      canDo: mock(() => allowed),
      canSetMode: mock(() => allowed),
      getRecycleValue: mock(() => undefined),
      canRecycle: mock(() => allowed),
      canRepurpose: mock(() => allowed),
      getRepurposeCost: mock(() => undefined),
      setMode: mock(() => successResult(undefined)),
      recycle: mock(() => successResult(undefined)),
      rushRecycling: mock(() => successResult(undefined)),
      repurpose: mock(() => successResult(undefined)),
      linkToDeposit: mock(() => successResult(undefined)),
    },
    technology: {
      snapshot: mock(() => overrides.techSnapshot ?? defaultTechSnapshot),
      getById: mock(() => undefined),
      isResearched: mock(() => false),
      canResearch: mock((techId: string) => {
        if (overrides.canResearch) return overrides.canResearch(techId);
        return notAllowed;
      }),
      startResearch: mock((techId: string) => {
        if (overrides.researchCalled) overrides.researchCalled(techId);
        return successResult(undefined);
      }),
      cancelResearch: mock(() => successResult(undefined)),
    },
    colony: {
      snapshot: mock(() => overrides.colonySnapshot ?? defaultColonySnapshot),
      getById: mock(() => undefined),
      canTrain: mock(() => allowed),
      getByRole: mock(() => []),
      getColonistsByRole: mock(() => []),
      getInTraining: mock(() => []),
      trainColonist: mock(() => successResult(undefined)),
      cancelTraining: mock(() => successResult(undefined)),
    },
    events: {
      hasActive: mock(() => overrides.hasActiveEvent ?? false),
      getActive: mock(() => overrides.activeEvent ?? null),
      getRecent: mock(() => []),
      resolve: mock((choiceId: string) => {
        if (overrides.eventResolveCalled) overrides.eventResolveCalled(choiceId);
        return successResult([]);
      }),
    },
    politics: {
      snapshot: mock(() => ({ factions: [], averageSupport: 50, decisions: [], availableDecisions: [] })),
      getFaction: mock(() => undefined),
      canMakeDecision: mock(() => allowed),
      makeDecision: mock(() => successResult(undefined)),
    },
    operations: {
      snapshot: mock(() => ({ policies: {}, policyCooldownRemaining: 0, expeditions: [], sites: [] })),
      canChangePolicy: mock(() => allowed),
      setPolicy: mock(() => successResult(undefined)),
      canLaunchExpedition: mock(() => allowed),
      launchExpedition: mock(() => successResult(undefined)),
      canDevelopSite: mock(() => allowed),
      developSite: mock(() => successResult(undefined)),
    },
    npc: {
      snapshot: mock(() => ({ factions: [], matrix: [], activeActions: [], nextActionIn: 0 })),
      getInfluence: mock(() => 0),
      canInfluence: mock(() => allowed),
      influence: mock(() => successResult(undefined)),
    },
    game: {
      currentSol: mock(() => 0),
      advanceSol: mock(() => successResult({ events: [] })),
      advanceSols: mock(() => successResult({ solsAdvanced: 1, events: [], stopReason: undefined })),
      victoryState: mock(() => ({ status: "playing" as const, type: undefined, reason: undefined })),
      isGameOver: mock(() => false),
      save: mock(() => "{}"),
    },
    onStateChange: mock(() => () => {}),
    save: mock(() => "{}"),
    load: mock(() => successResult(undefined)),
    newGame: mock(() => {}),
  } as unknown as GameAPI;
}

interface MockedAPI {
  resourceSnapshot?: ResourceSnapshot;
  colonySnapshot?: ColonySnapshot;
  techSnapshot?: TechnologySnapshot;
  buildingsSnapshot?: BuildingSnapshot;
  canBuild?: (defId: string) => CanDoResult;
  buildCalled?: (defId: string) => void;
  canResearch?: (techId: string) => CanDoResult;
  researchCalled?: (techId: string) => void;
  hasActiveEvent?: boolean;
  activeEvent?: ActiveEventSnapshot | null;
  eventResolveCalled?: (choiceId: string) => void;
}

describe("HeuristicStrategy", () => {
  describe("Priority 1 - Survival", () => {
    it("builds farm when food < 50", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 40, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10 },
          consumption: { food: 5, oxygen: 5 },
          netFlow: { food: 5, oxygen: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain("basic_farm");
    });

    it("builds oxygen generator when oxygen < 50", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 30, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10 },
          consumption: { food: 5, oxygen: 5 },
          netFlow: { food: 5, oxygen: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain("oxygen_generator");
    });

    it("builds farm when food production <= consumption", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 5, oxygen: 10 },
          consumption: { food: 5, oxygen: 5 },
          netFlow: { food: 0, oxygen: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain("basic_farm");
    });

    it("builds oxygen generator when oxygen production <= consumption", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 3 },
          consumption: { food: 5, oxygen: 5 },
          netFlow: { food: 5, oxygen: -2 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain("oxygen_generator");
    });

    it("does not build if cannot afford", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 40, oxygen: 100, water: 100, power: 100, materials: 0 },
          production: { food: 10, oxygen: 10 },
          consumption: { food: 5, oxygen: 5 },
          netFlow: { food: 5, oxygen: 5 },
        },
        canBuild: () => ({ allowed: false, reason: "Insufficient resources" }),
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toHaveLength(0);
    });
  });

  describe("Priority 2 - Event Resolution", () => {
    it("resolves active event by selecting best choice", () => {
      const resolvedChoices: string[] = [];
      const choices: EventChoice[] = [
        { id: "bad", text: "Bad choice", effects: { population: -5 } },
        { id: "good", text: "Good choice", effects: { resources: { materials: 100 } } },
      ];

      const api = createMockAPI({
        hasActiveEvent: true,
        activeEvent: {
          definition: { id: "test", name: "Test", description: "Test", minSol: 0, chance: 1, choices },
          active: { eventId: "test", triggeredAt: 0, resolved: false },
          choices,
        },
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(resolvedChoices).toContain("good");
    });

    it("avoids choices that cause population loss", () => {
      const resolvedChoices: string[] = [];
      const choices: EventChoice[] = [
        { id: "pop_loss", text: "Lose people", effects: { population: -2, resources: { materials: 200 } } },
        { id: "safe", text: "Safe choice", effects: { resources: { materials: 50 } } },
      ];

      const api = createMockAPI({
        hasActiveEvent: true,
        activeEvent: {
          definition: { id: "test", name: "Test", description: "Test", minSol: 0, chance: 1, choices },
          active: { eventId: "test", triggeredAt: 0, resolved: false },
          choices,
        },
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Should pick safe choice despite lower resource gain because population loss is heavily penalized
      expect(resolvedChoices).toContain("safe");
    });

    it("picks first choice as fallback when all equal", () => {
      const resolvedChoices: string[] = [];
      const choices: EventChoice[] = [
        { id: "first", text: "First", effects: {} },
        { id: "second", text: "Second", effects: {} },
      ];

      const api = createMockAPI({
        hasActiveEvent: true,
        activeEvent: {
          definition: { id: "test", name: "Test", description: "Test", minSol: 0, chance: 1, choices },
          active: { eventId: "test", triggeredAt: 0, resolved: false },
          choices,
        },
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(resolvedChoices).toContain("first");
    });

    it("prefers population gain over resources", () => {
      const resolvedChoices: string[] = [];
      const choices: EventChoice[] = [
        { id: "resources", text: "Get resources", effects: { resources: { materials: 100 } } },
        { id: "population", text: "Get people", effects: { population: 2 } },
      ];

      const api = createMockAPI({
        hasActiveEvent: true,
        activeEvent: {
          definition: { id: "test", name: "Test", description: "Test", minSol: 0, chance: 1, choices },
          active: { eventId: "test", triggeredAt: 0, resolved: false },
          choices,
        },
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Population gain (2 * 100 = 200) > materials (100)
      expect(resolvedChoices).toContain("population");
    });
  });

  describe("Priority 3 - Infrastructure", () => {
    it("starts cheapest available research when none active", () => {
      const researchCalls: string[] = [];
      const api = createMockAPI({
        techSnapshot: {
          all: [
            { id: "expensive", name: "Expensive", description: "", prerequisites: [], cost: { sols: 100 }, unlocks: [] },
            { id: "cheap", name: "Cheap", description: "", prerequisites: [], cost: { sols: 30 }, unlocks: [] },
          ],
          available: [
            { id: "expensive", name: "Expensive", description: "", prerequisites: [], cost: { sols: 100 }, unlocks: [] },
            { id: "cheap", name: "Cheap", description: "", prerequisites: [], cost: { sols: 30 }, unlocks: [] },
          ],
          researched: [],
          currentResearch: null,
        },
        canResearch: () => ({ allowed: true }),
        researchCalled: (techId) => researchCalls.push(techId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(researchCalls).toContain("cheap");
    });

    it("does not start research if already researching", () => {
      const researchCalls: string[] = [];
      const api = createMockAPI({
        techSnapshot: {
          all: [],
          available: [
            { id: "available", name: "Available", description: "", prerequisites: [], cost: { sols: 50 }, unlocks: [] },
          ],
          researched: [],
          currentResearch: { techId: "current", progress: 10, totalSols: 50 },
        },
        canResearch: () => ({ allowed: true }),
        researchCalled: (techId) => researchCalls.push(techId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(researchCalls).toHaveLength(0);
    });

    it("builds solar panel when power production < consumption + 20", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10, power: 15 },
          consumption: { food: 5, oxygen: 5, power: 10 },
          netFlow: { food: 5, oxygen: 5, power: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // power production (15) < consumption (10) + 20 = 30, so should build
      expect(buildCalls).toContain("solar_panel");
    });

    it("builds mining station when materials < 100 and tech available", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 50 },
          production: { food: 10, oxygen: 10, power: 50 },
          consumption: { food: 5, oxygen: 5, power: 10 },
          netFlow: { food: 5, oxygen: 5, power: 40, materials: 0 },
        },
        canBuild: (defId) => {
          if (defId === "mining_station") return { allowed: true };
          if (defId === "solar_panel") return { allowed: false, reason: "Not needed" };
          return { allowed: true };
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain("mining_station");
    });
  });

  describe("Priority 4 - Growth", () => {
    it("builds habitat when population < 100 and morale > 60", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        colonySnapshot: {
          population: 50,
          health: 80,
          morale: 70,
          colonists: [],
          skillDefinitions: [],
        },
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10, power: 50 },
          consumption: { food: 5, oxygen: 5, power: 10 },
          netFlow: { food: 5, oxygen: 5, power: 40, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain("habitat");
    });

    it("does not build habitat when morale <= 60", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        colonySnapshot: {
          population: 50,
          health: 80,
          morale: 55,
          colonists: [],
          skillDefinitions: [],
        },
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10, power: 50 },
          consumption: { food: 5, oxygen: 5, power: 10 },
          netFlow: { food: 5, oxygen: 5, power: 40, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).not.toContain("habitat");
    });

    it("does not build habitat when population >= 100", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        colonySnapshot: {
          population: 100,
          health: 80,
          morale: 80,
          colonists: [],
          skillDefinitions: [],
        },
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10, power: 50 },
          consumption: { food: 5, oxygen: 5, power: 10 },
          netFlow: { food: 5, oxygen: 5, power: 40, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).not.toContain("habitat");
    });
  });

  describe("Priority 5 - Victory Push", () => {
    it("researches generation_ship when available", () => {
      const researchCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 1000 },
          production: { food: 20, oxygen: 20, power: 100 },
          consumption: { food: 10, oxygen: 10, power: 30 },
          netFlow: { food: 10, oxygen: 10, power: 70, materials: 10 },
        },
        // Simulate late game: population at 100, so Growth doesn't trigger
        colonySnapshot: {
          population: 100,
          health: 80,
          morale: 80,
          colonists: [],
          skillDefinitions: [],
        },
        techSnapshot: {
          all: [],
          available: [],
          researched: [],
          currentResearch: null,
        },
        canResearch: (techId) => {
          if (techId === "generation_ship") return { allowed: true };
          return { allowed: false, reason: "Not available" };
        },
        researchCalled: (techId) => researchCalls.push(techId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(researchCalls).toContain("generation_ship");
    });
  });

  describe("Priority ordering", () => {
    it("handles survival before events", () => {
      const buildCalls: string[] = [];
      const resolvedChoices: string[] = [];

      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 30, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10 },
          consumption: { food: 5, oxygen: 5 },
          netFlow: { food: 5, oxygen: 5 },
        },
        hasActiveEvent: true,
        activeEvent: {
          definition: { id: "test", name: "Test", description: "Test", minSol: 0, chance: 1, choices: [{ id: "choice", text: "Choice", effects: {} }] },
          active: { eventId: "test", triggeredAt: 0, resolved: false },
          choices: [{ id: "choice", text: "Choice", effects: {} }],
        },
        buildCalled: (defId) => buildCalls.push(defId),
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Survival takes precedence, so farm should be built, not event resolved
      expect(buildCalls).toContain("basic_farm");
      expect(resolvedChoices).toHaveLength(0);
    });

    it("handles events before infrastructure", () => {
      const buildCalls: string[] = [];
      const resolvedChoices: string[] = [];

      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, oxygen: 100, water: 100, power: 100, materials: 100 },
          production: { food: 10, oxygen: 10, power: 5 },
          consumption: { food: 5, oxygen: 5, power: 10 },
          netFlow: { food: 5, oxygen: 5, power: -5 },
        },
        hasActiveEvent: true,
        activeEvent: {
          definition: { id: "test", name: "Test", description: "Test", minSol: 0, chance: 1, choices: [{ id: "choice", text: "Choice", effects: {} }] },
          active: { eventId: "test", triggeredAt: 0, resolved: false },
          choices: [{ id: "choice", text: "Choice", effects: {} }],
        },
        buildCalled: (defId) => buildCalls.push(defId),
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Event resolution takes precedence over building solar panel
      expect(resolvedChoices).toContain("choice");
      expect(buildCalls).toHaveLength(0);
    });
  });

  describe("Integration with real GameAPI", () => {
    it("executes without errors with real API", () => {
      // Import real GameAPI
      const { GameAPI } = require("../../src/facade/GameAPI");
      const realApi = new GameAPI();
      const strategy = new HeuristicStrategy(realApi);

      // Should not throw
      expect(() => strategy.executeTick()).not.toThrow();
    });

    it("can run multiple ticks without errors", () => {
      const { GameAPI } = require("../../src/facade/GameAPI");
      const realApi = new GameAPI();
      const strategy = new HeuristicStrategy(realApi);

      // Run multiple ticks
      for (let i = 0; i < 10; i++) {
        expect(() => {
          strategy.executeTick();
          realApi.game.advanceSol();
        }).not.toThrow();
      }
    });
  });
});
