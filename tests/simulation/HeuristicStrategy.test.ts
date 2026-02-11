import { describe, it, expect, mock } from "bun:test";
import { HeuristicStrategy } from "../../src/simulation/HeuristicStrategy";
import type { GameAPI } from "../../src/facade/GameAPI";
import type { ResourceSnapshot } from "../../src/facade/types/resources";
import type { ColonySnapshot } from "../../src/facade/types/colony";
import type { TechnologySnapshot } from "../../src/facade/types/technology";
import type { BuildingSnapshot } from "../../src/facade/types/buildings";
import type { ActiveEventSnapshot, EventChoice } from "../../src/facade/types/events";
import type { CanDoResult, Result } from "../../src/facade/types/common";
import { BuildingId } from "../../src/core/models/Building";
import { TechnologyId } from "../../src/core/models/Technology";
import { EventId } from "../../src/core/models/GameEvent";

// Helper to create mock API with defaults
function createMockAPI(overrides: Partial<MockedAPI> = {}): GameAPI {
  const defaultResourceSnapshot: ResourceSnapshot = {
    current: { food: 100, water: 100, materials: 100 },
    production: { food: 10, water: 10, materials: 10 },
    consumption: { food: 5, water: 5, materials: 5 },
    netFlow: { food: 5, water: 5, materials: 5 },
  };

  const defaultColonySnapshot: ColonySnapshot = {
    population: 50,
    health: 80,
    morale: 70,
    socialCohesion: 0.5,
    colonists: [],
    skillDefinitions: [],
    housingAssignments: {},
    unhoused: [],
    coworkerRelationships: new Map(),
    guilds: [],
    communities: [],
  };

  const defaultTechSnapshot: TechnologySnapshot = {
    all: [],
    available: [],
    researched: [],
    currentResearch: null,
    researchQueue: [],
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
        return successResult({
          id: "b1",
          definitionId: defId,
          status: "pending" as const,
          mode: "normal" as const,
          progress: 0,
        });
      }),
      snapshot: mock(
        () =>
          overrides.buildingsSnapshot ?? {
            active: [
              {
                id: "b0",
                definitionId: BuildingId.HYDROPONIC_GARDEN,
                status: "active" as const,
                mode: "normal" as const,
                progress: 100,
              },
              {
                id: "b_ss",
                definitionId: BuildingId.SCIENCE_STATION,
                status: "active" as const,
                mode: "normal" as const,
                progress: 100,
              },
            ],
            pending: [],
            upgrading: [],
            definitions: [],
            moraleBoost: 0,
            totalLifeSupportCapacity: 200,
            totalLifeSupportLoad: 0,
          },
      ),
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
      canUpgrade: mock(() => notAllowed),
      getUpgradeCost: mock(() => undefined),
      upgrade: mock(() => successResult(undefined)),
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
      snapshot: mock(() => ({ ...defaultColonySnapshot, ...overrides.colonySnapshot })),
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
      snapshot: mock(() => ({
        factions: [],
        averageSupport: 50,
        decisions: [],
        availableDecisions: [],
      })),
      getFaction: mock(() => undefined),
      canMakeDecision: mock(() => allowed),
      makeDecision: mock(() => successResult(undefined)),
    },
    operations: {
      snapshot: mock(() => ({
        expeditions: [],
        sites: [],
      })),
      canLaunchExpedition: mock(() => allowed),
      launchExpedition: mock(() => successResult(undefined)),
      canDevelopSite: mock(() => allowed),
      developSite: mock(() => successResult(undefined)),
    },
    districts: {
      snapshot: mock(
        () =>
          overrides.districtSnapshot ?? {
            districts: [
              {
                id: "d1",
                name: "Central",
                foundedAt: 0,
                population: 20,
                capacity: 30,
                buildingCount: 5,
                growthCap: null,
              },
            ],
            power: { production: 50, consumption: 30, balance: 20, status: "comfortable" },
          },
      ),
      getDistrictColonists: mock(() => []),
      setGrowthCap: mock(() => {}),
    },
    ideology: {
      snapshot: mock(
        () =>
          overrides.ideologySnapshot ?? {
            council: [],
            councilFactionCounts: {
              neutral: 0,
            },
            factionSupport: {},
            factions: [
              {
                id: "f_earth",
                name: "Earth Loyalists",
                baseId: "earth_loyalists",
                position: { solidarity: 0, sovereignty: -0.7, transformation: -0.3 },
                pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
              },
              {
                id: "f_mars",
                name: "Mars Independence",
                baseId: "mars_independence",
                position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 },
                pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
              },
              {
                id: "f_corp",
                name: "Corporate Interests",
                baseId: "corporate_interests",
                position: { solidarity: -0.6, sovereignty: 0, transformation: 0.5 },
                pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
              },
            ],
          },
      ),
      getFactions: mock(
        () =>
          overrides.factions ?? [
            {
              id: "f_earth",
              name: "Earth Loyalists",
              baseId: "earth_loyalists",
              position: { solidarity: 0, sovereignty: -0.7, transformation: -0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            {
              id: "f_mars",
              name: "Mars Independence",
              baseId: "mars_independence",
              position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            {
              id: "f_corp",
              name: "Corporate Interests",
              baseId: "corporate_interests",
              position: { solidarity: -0.6, sovereignty: 0, transformation: 0.5 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
          ],
      ),
      getActivePolicy: mock(() => overrides.activePolicy ?? null),
      declarePolicy: mock((policyId: string) => {
        if (overrides.declarePolicyCalled) overrides.declarePolicyCalled(policyId);
        return true;
      }),
      getCompletedProjects: mock(() => overrides.completedProjects ?? []),
      getFailedProposals: mock(() => overrides.failedProposals ?? []),
      getPendingProposals: mock(() => overrides.pendingProposals ?? []),
      canProposeProject: mock((projectId: string) => {
        if (overrides.canProposeProject) return overrides.canProposeProject(projectId);
        return {
          canPropose: false,
          currentSupport: 0,
          requiredSupport: 0.35,
          reason: "Not available",
        };
      }),
      proposeProject: mock((projectId: string) => {
        if (overrides.proposeProjectCalled) overrides.proposeProjectCalled(projectId);
        return successResult({ projectId, voteSol: 110 });
      }),
      getVoteProjection: mock(
        () => overrides.voteProjection ?? { votesFor: 0, votesAgainst: 5, wouldPass: false },
      ),
      clearFailedProposal: mock((projectId: string) => {
        if (overrides.clearFailedProposalCalled) overrides.clearFailedProposalCalled(projectId);
      }),
      canRally: mock(() => false),
      rallyFaction: mock(() => 0),
    },
    grants: {
      snapshot: mock(() => ({
        available: [],
        active: [],
        nextRefreshSol: 0,
      })),
      canAssignGrant: mock(() => ({ allowed: true })),
      assignGrant: mock(() => successResult({ grantId: 1, affectedColonists: 0 })),
      refreshPanel: mock(() => successResult(undefined)),
    },
    game: {
      currentSol: mock(() => overrides.currentSol ?? 100), // Default to 100 to bypass bootstrap
      advanceSol: mock(() => successResult({ events: [] })),
      advanceSols: mock(() =>
        successResult({ solsAdvanced: 1, events: [], stopReason: undefined }),
      ),
      victoryState: mock(() => ({
        status: "playing" as const,
        type: undefined,
        reason: undefined,
      })),
      isGameOver: mock(() => false),
      earthCrisisSeverity: mock(() => overrides.earthCrisisSeverity ?? 0),
      earthCrisisPointOfNoReturn: mock(() => false),
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
  districtSnapshot?: {
    districts: Array<{
      id: string;
      name: string;
      foundedAt: number;
      population: number;
      capacity: number;
      buildingCount: number;
      growthCap: number | null;
    }>;
    power: { production: number; consumption: number; balance: number; status: string };
  };
  colonySnapshot?: Partial<ColonySnapshot>;
  techSnapshot?: TechnologySnapshot;
  buildingsSnapshot?: BuildingSnapshot;
  canBuild?: (defId: string) => CanDoResult;
  buildCalled?: (defId: string) => void;
  canResearch?: (techId: string) => CanDoResult;
  researchCalled?: (techId: string) => void;
  hasActiveEvent?: boolean;
  activeEvent?: ActiveEventSnapshot | null;
  eventResolveCalled?: (choiceId: string) => void;
  currentSol?: number;
  // Ideology mocking
  ideologySnapshot?: {
    council: Array<{ colonistId: string; name: string; factionId: string | null }>;
    councilFactionCounts: Record<string, number>;
    factionSupport: Record<string, number>;
    factions: Array<{
      id: string;
      name: string;
      baseId: string;
      position: { solidarity: number; sovereignty: number; transformation: number };
      pressure: { solidarity: number; sovereignty: number; transformation: number };
    }>;
  };
  factions?: Array<{
    id: string;
    name: string;
    baseId: string;
    position: { solidarity: number; sovereignty: number; transformation: number };
    pressure: { solidarity: number; sovereignty: number; transformation: number };
  }>;
  activePolicy?: {
    policy: {
      id: string;
      name: string;
      axis: string;
      direction: number;
      strength: number;
      duration: number;
    };
    startSol: number;
  } | null;
  declarePolicyCalled?: (policyId: string) => void;
  completedProjects?: string[];
  failedProposals?: string[];
  pendingProposals?: Array<{ projectId: string }>;
  canProposeProject?: (projectId: string) => {
    canPropose: boolean;
    currentSupport: number;
    requiredSupport: number;
    reason?: string;
  };
  proposeProjectCalled?: (projectId: string) => void;
  voteProjection?: { votesFor: number; votesAgainst: number; wouldPass: boolean };
  clearFailedProposalCalled?: (projectId: string) => void;
  earthCrisisSeverity?: number;
}

describe("HeuristicStrategy", () => {
  describe("Priority 1 - Survival", () => {
    it("builds farm when food < 50", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 40, water: 100, materials: 100 },
          production: { food: 10, water: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 5, water: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Prefers greenhouse (25 food/cell) over basic farm (10 food/cell)
      const builtFood = buildCalls.some(
        (id) => id === BuildingId.GREENHOUSE || id === BuildingId.BASIC_FARM,
      );
      expect(builtFood).toBe(true);
    });

    it("builds food building when food production equals consumption", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 5, water: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 0, water: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      const builtFood = buildCalls.some(
        (id) => id === BuildingId.GREENHOUSE || id === BuildingId.BASIC_FARM,
      );
      expect(builtFood).toBe(true);
    });

    it("builds water building when water is low", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 30, materials: 100 },
          production: { food: 10, water: 2 },
          consumption: { food: 5, water: 3 },
          netFlow: { food: 5, water: -1 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      const builtWater = buildCalls.some(
        (id) => id === BuildingId.WATER_EXTRACTOR || id === BuildingId.WATER_RECLAIMER,
      );
      expect(builtWater).toBe(true);
    });

    it("does not build if cannot afford", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 40, water: 100, materials: 0 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 },
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
          definition: {
            id: EventId.DUST_STORM,
            name: "Test",
            description: "Test",
            minSol: 0,
            chance: 1,
            choices,
          },
          active: { eventId: EventId.DUST_STORM, triggeredAt: 0, resolved: false },
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
        {
          id: "pop_loss",
          text: "Lose people",
          effects: { population: -2, resources: { materials: 200 } },
        },
        { id: "safe", text: "Safe choice", effects: { resources: { materials: 50 } } },
      ];

      const api = createMockAPI({
        hasActiveEvent: true,
        activeEvent: {
          definition: {
            id: EventId.DUST_STORM,
            name: "Test",
            description: "Test",
            minSol: 0,
            chance: 1,
            choices,
          },
          active: { eventId: EventId.DUST_STORM, triggeredAt: 0, resolved: false },
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
          definition: {
            id: EventId.DUST_STORM,
            name: "Test",
            description: "Test",
            minSol: 0,
            chance: 1,
            choices,
          },
          active: { eventId: EventId.DUST_STORM, triggeredAt: 0, resolved: false },
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
          definition: {
            id: EventId.DUST_STORM,
            name: "Test",
            description: "Test",
            minSol: 0,
            chance: 1,
            choices,
          },
          active: { eventId: EventId.DUST_STORM, triggeredAt: 0, resolved: false },
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
            {
              id: TechnologyId.NUCLEAR_FISSION,
              name: "Expensive",
              description: "",
              prerequisites: [],
              cost: { sols: 100 },
              unlocks: [],
            },
            {
              id: TechnologyId.HYDROPONICS,
              name: "Cheap",
              description: "",
              prerequisites: [],
              cost: { sols: 30 },
              unlocks: [],
            },
          ],
          available: [
            {
              id: TechnologyId.NUCLEAR_FISSION,
              name: "Expensive",
              description: "",
              prerequisites: [],
              cost: { sols: 100 },
              unlocks: [],
            },
            {
              id: TechnologyId.HYDROPONICS,
              name: "Cheap",
              description: "",
              prerequisites: [],
              cost: { sols: 30 },
              unlocks: [],
            },
          ],
          researched: [],
          currentResearch: null,
          researchQueue: [],
        },
        canResearch: () => ({ allowed: true }),
        researchCalled: (techId) => researchCalls.push(techId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(researchCalls).toContain(TechnologyId.HYDROPONICS);
    });

    it("does not start research if already researching", () => {
      const researchCalls: string[] = [];
      const api = createMockAPI({
        techSnapshot: {
          all: [],
          available: [
            {
              id: TechnologyId.ROBOTICS,
              name: "Available",
              description: "",
              prerequisites: [],
              cost: { sols: 50 },
              unlocks: [],
            },
          ],
          researched: [],
          currentResearch: { techId: TechnologyId.HYDROPONICS, progress: 10, requiredSols: 50 },
          researchQueue: [],
        },
        canResearch: () => ({ allowed: true }),
        researchCalled: (techId) => researchCalls.push(techId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(researchCalls).toHaveLength(0);
    });

    it("builds solar panel when power balance is negative", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10, water: 10, materials: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 5, water: 5, materials: 10 },
        },
        districtSnapshot: {
          districts: [
            {
              id: "d1",
              name: "Central",
              foundedAt: 0,
              population: 20,
              capacity: 30,
              buildingCount: 5,
              growthCap: null,
            },
          ],
          power: { production: 10, consumption: 15, balance: -5, status: "shortage" },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.SOLAR_PANEL);
    });

    it("builds mining station when materials < 100 and tech available", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 50 },
          production: { food: 10, water: 10, materials: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 5, water: 5, materials: 10 },
        },
        canBuild: (defId) => {
          if (defId === BuildingId.MINING_STATION) return { allowed: true };
          if (defId === BuildingId.SOLAR_PANEL) return { allowed: false, reason: "Not needed" };
          return { allowed: true };
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.MINING_STATION);
    });
  });

  describe("Priority 4 - Growth", () => {
    it("builds food building when population < 80 and morale > 60 with low food surplus", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        colonySnapshot: {
          population: 50,
          health: 80,
          morale: 70,
          colonists: [],
          skillDefinitions: [],
          housingAssignments: {},
          unhoused: [],
        },
        resourceSnapshot: {
          current: { food: 70, water: 100, materials: 100 },
          production: { food: 6, water: 10, materials: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 1, water: 5, materials: 10 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      const builtFood = buildCalls.some(
        (id) => id === BuildingId.GREENHOUSE || id === BuildingId.BASIC_FARM,
      );
      expect(builtFood).toBe(true);
    });

    it("does not grow when morale <= 60", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        colonySnapshot: {
          population: 50,
          health: 80,
          morale: 55,
          colonists: [],
          skillDefinitions: [],
          housingAssignments: {},
          unhoused: [],
        },
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10, water: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 5, water: 5, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      const result = strategy.executeTick();

      // Growth handler skipped because morale is too low
      expect(result.category).not.toBe("growth");
    });

    it("does not grow when population >= 80", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        colonySnapshot: {
          population: 80,
          health: 80,
          morale: 80,
          colonists: [],
          skillDefinitions: [],
          housingAssignments: {},
          unhoused: [],
        },
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10, water: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 5, water: 5, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      const result = strategy.executeTick();

      // Growth handler skipped because population is at the threshold
      expect(result.category).not.toBe("growth");
    });
  });

  describe("Priority 6 - Ideology Victory", () => {
    it("does nothing when no council exists", () => {
      const proposedProjects: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 1000 },
          production: { food: 20 },
          consumption: { food: 10 },
          netFlow: { food: 10, materials: 10 },
        },
        colonySnapshot: {
          population: 100,
          health: 80,
          morale: 80,
          colonists: [],
          skillDefinitions: [],
          housingAssignments: {},
          unhoused: [],
        },
        ideologySnapshot: {
          council: [], // No council
          councilFactionCounts: {
            neutral: 0,
          },
          factionSupport: {},
          factions: [
            {
              id: "f_earth",
              name: "Earth Loyalists",
              baseId: "earth_loyalists",
              position: { solidarity: 0, sovereignty: -0.7, transformation: -0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            {
              id: "f_mars",
              name: "Mars Independence",
              baseId: "mars_independence",
              position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            {
              id: "f_corp",
              name: "Corporate Interests",
              baseId: "corporate_interests",
              position: { solidarity: -0.6, sovereignty: 0, transformation: 0.5 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
          ],
        },
        proposeProjectCalled: (projectId) => proposedProjects.push(projectId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(proposedProjects).toHaveLength(0);
    });

    it("commits to faction and takes action when it reaches 40%+ council seats", () => {
      const proposedProjects: string[] = [];
      const declaredPolicies: string[] = [];
      const builtBuildings: string[] = [];
      // Corporate Interests already meets all axis requirements for Deep Space Mining Charter
      // (solidarity <= -0.5, transformation >= 0.5) so no policy is needed.
      // The strategy should build institutional buildings or propose prerequisite projects.
      const marsFaction = {
        id: "f_mars",
        name: "Mars Independence",
        baseId: "mars_independence",
        position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 },
        pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
      };
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 1000 },
          production: { food: 20, water: 10 },
          consumption: { food: 10, water: 5 },
          netFlow: { food: 10, water: 5, materials: 10 },
        },
        colonySnapshot: {
          population: 100,
          health: 80,
          morale: 80,
          colonists: [],
          skillDefinitions: [],
          housingAssignments: {},
          unhoused: [],
        },
        ideologySnapshot: {
          council: [
            { colonistId: "c1", name: "Test1", factionId: "f_corp" },
            { colonistId: "c2", name: "Test2", factionId: "f_corp" },
            { colonistId: "c3", name: "Test3", factionId: "f_earth" },
          ],
          councilFactionCounts: {
            corporate_interests: 2,
            earth_loyalists: 1,
            neutral: 0,
          },
          factionSupport: {
            corporate_interests: 0.6,
            earth_loyalists: 0.3,
            mars_independence: 0.1,
          },
          factions: [
            {
              id: "f_earth",
              name: "Earth Loyalists",
              baseId: "earth_loyalists",
              position: { solidarity: 0, sovereignty: -0.7, transformation: -0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            marsFaction,
            {
              id: "f_corp",
              name: "Corporate Interests",
              baseId: "corporate_interests",
              position: { solidarity: -0.6, sovereignty: 0, transformation: 0.5 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
          ],
        },
        factions: [
          {
            id: "f_earth",
            name: "Earth Loyalists",
            baseId: "earth_loyalists",
            position: { solidarity: 0, sovereignty: -0.7, transformation: -0.3 },
            pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
          },
          marsFaction,
          {
            id: "f_corp",
            name: "Corporate Interests",
            baseId: "corporate_interests",
            position: { solidarity: -0.6, sovereignty: 0, transformation: 0.5 },
            pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
          },
        ],
        voteProjection: { votesFor: 2, votesAgainst: 1, wouldPass: true },
        canProposeProject: () => ({ canPropose: true, currentSupport: 0.6, requiredSupport: 0.35 }),
        proposeProjectCalled: (projectId) => proposedProjects.push(projectId),
        declarePolicyCalled: (policyId) => declaredPolicies.push(policyId),
        buildCalled: (buildingId) => builtBuildings.push(buildingId),
      });

      const strategy = new HeuristicStrategy(api);
      const result = strategy.executeTick();

      // Strategy should commit to Corporate Interests (easiest victory path, 66% seats)
      // and take a victory action: build institutional building, propose project, or declare policy
      expect(result.category).toBe("victory");
    });

    it("does not propose when below commitment threshold", () => {
      const proposedProjects: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 1000 },
          production: { food: 20 },
          consumption: { food: 10 },
          netFlow: { food: 10, materials: 10 },
        },
        colonySnapshot: {
          population: 100,
          health: 80,
          morale: 80,
          colonists: [],
          skillDefinitions: [],
          housingAssignments: {},
          unhoused: [],
        },
        ideologySnapshot: {
          council: [
            { colonistId: "c1", name: "Test1", factionId: "f_earth" },
            { colonistId: "c2", name: "Test2", factionId: "f_mars" },
            { colonistId: "c3", name: "Test3", factionId: "f_corp" },
          ],
          // No faction has 50% - all at 33%
          councilFactionCounts: {
            f_earth: 1,
            f_mars: 1,
            f_corp: 1,
            neutral: 0,
          },
          factionSupport: {
            f_earth: 0.33,
            f_mars: 0.33,
            f_corp: 0.33,
          },
          factions: [
            {
              id: "f_earth",
              name: "Earth Loyalists",
              baseId: "earth_loyalists",
              position: { solidarity: 0, sovereignty: -0.7, transformation: -0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            {
              id: "f_mars",
              name: "Mars Independence",
              baseId: "mars_independence",
              position: { solidarity: 0.3, sovereignty: 0.7, transformation: 0.3 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
            {
              id: "f_corp",
              name: "Corporate Interests",
              baseId: "corporate_interests",
              position: { solidarity: -0.6, sovereignty: 0, transformation: 0.5 },
              pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
            },
          ],
        },
        canProposeProject: () => ({
          canPropose: true,
          currentSupport: 0.33,
          requiredSupport: 0.35,
        }),
        proposeProjectCalled: (projectId) => proposedProjects.push(projectId),
        // Sol 10 is before commitmentMinSol range (15-30) so no commitment yet
        currentSol: 10,
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // No faction has reached 40% commitment threshold and we're before min sol, so no proposals
      expect(proposedProjects).toHaveLength(0);
    });
  });

  describe("Priority ordering", () => {
    it("handles survival before events", () => {
      const buildCalls: string[] = [];
      const resolvedChoices: string[] = [];

      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 30, water: 100, materials: 100 },
          production: { food: 10, water: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 5, water: 5 },
        },
        hasActiveEvent: true,
        activeEvent: {
          definition: {
            id: EventId.DUST_STORM,
            name: "Test",
            description: "Test",
            minSol: 0,
            chance: 1,
            choices: [{ id: "choice", text: "Choice", effects: {} }],
          },
          active: { eventId: EventId.DUST_STORM, triggeredAt: 0, resolved: false },
          choices: [{ id: "choice", text: "Choice", effects: {} }],
        },
        buildCalled: (defId) => buildCalls.push(defId),
        eventResolveCalled: (choiceId) => resolvedChoices.push(choiceId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Survival takes precedence - food building built, not event resolved
      const builtFood = buildCalls.some(
        (id) => id === BuildingId.GREENHOUSE || id === BuildingId.BASIC_FARM,
      );
      expect(builtFood).toBe(true);
      expect(resolvedChoices).toHaveLength(0);
    });

    it("handles events before infrastructure", () => {
      const buildCalls: string[] = [];
      const resolvedChoices: string[] = [];

      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10, water: 10 },
          consumption: { food: 5, water: 5 },
          netFlow: { food: 0, water: 5 },
        },
        hasActiveEvent: true,
        activeEvent: {
          definition: {
            id: EventId.DUST_STORM,
            name: "Test",
            description: "Test",
            minSol: 0,
            chance: 1,
            choices: [{ id: "choice", text: "Choice", effects: {} }],
          },
          active: { eventId: EventId.DUST_STORM, triggeredAt: 0, resolved: false },
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
