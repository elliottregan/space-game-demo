import { describe, it, expect, beforeEach, mock } from "bun:test";
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
    colonists: [],
    skillDefinitions: [],
    housingAssignments: {},
    unhoused: [],
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
      buildAtPosition: mock((defId: string, _position: { x: number; y: number }) => {
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
            ],
            pending: [],
            definitions: [],
            moraleBoost: 0,
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
    grid: {
      snapshot: mock(() => ({
        size: 10,
        deposits: overrides.gridAvailableDeposits ?? [],
        powerSources: [],
        occupiedCells: [],
      })),
      getEmptyCells: mock(() => {
        // Return all cells as empty by default
        const cells: { x: number; y: number }[] = [];
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            cells.push({ x, y });
          }
        }
        return cells;
      }),
      getDeposits: mock(() => overrides.gridAvailableDeposits ?? []),
      getAvailableDeposits: mock((type: string) => {
        if (overrides.gridAvailableDeposits) {
          return overrides.gridAvailableDeposits.filter((d) => d.type === type && !d.isOccupied);
        }
        return [];
      }),
      getCellsInPowerRange: mock(() => {
        // Return center cells as powered by default
        const cells: { x: number; y: number }[] = [];
        for (let y = 3; y <= 6; y++) {
          for (let x = 3; x <= 6; x++) {
            cells.push({ x, y });
          }
        }
        return cells;
      }),
      getPlacementHints: mock(() => ({
        position: { x: 5, y: 5 },
        isOccupied: false,
        hasPower: true,
        powerCapacityAvailable: 10,
        distanceToNearestPower: 0,
      })),
      hasDeposit: mock(() => false),
      getDepositAt: mock(() => undefined),
      isEmpty: mock(() => true),
      calculateDistance: mock((a: { x: number; y: number }, b: { x: number; y: number }) => {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      }),
    },
    npc: {
      snapshot: mock(() => ({ factions: [], matrix: [], activeActions: [], nextActionIn: 0 })),
      getInfluence: mock(() => 0),
      canInfluence: mock(() => allowed),
      influence: mock(() => successResult(undefined)),
    },
    powerGrid: {
      snapshot: mock(
        () =>
          overrides.powerGridSnapshot ?? {
            totalProduction: 20,
            totalConsumption: 10,
            buildingCounts: {
              powered: 5,
              onBattery: 0,
              lowBattery: 0,
              unpowered: 0,
            },
          },
      ),
    },
    ideology: {
      snapshot: mock(
        () =>
          overrides.ideologySnapshot ?? {
            council: [],
            councilFactionCounts: {
              earth_loyalists: 0,
              mars_independence: 0,
              corporate_interests: 0,
              neutral: 0,
            },
            factionSupport: { earthLoyalists: 0, marsIndependence: 0, corporateInterests: 0 },
          },
      ),
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
      canLobby: mock((colonistId: string, faction: string, boost: number) => {
        if (overrides.canLobby) return overrides.canLobby(colonistId, faction, boost);
        return { canLobby: false, cost: 100, reason: "Cannot lobby" };
      }),
      lobbyCouncilMember: mock((colonistId: string, faction: string, boost: number) => {
        if (overrides.lobbyCouncilMemberCalled)
          overrides.lobbyCouncilMemberCalled(colonistId, faction, boost);
        return successResult({ newAffinity: 0.5 });
      }),
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
  powerGridSnapshot?: {
    totalProduction: number;
    totalConsumption: number;
    buildingCounts: {
      powered: number;
      onBattery: number;
      lowBattery: number;
      unpowered: number;
    };
  };
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
  currentSol?: number;
  // Ideology mocking
  ideologySnapshot?: {
    council: Array<{ colonistId: string; name: string; faction: string | null }>;
    councilFactionCounts: Record<string, number>;
    factionSupport: {
      earthLoyalists: number;
      marsIndependence: number;
      corporateInterests: number;
    };
  };
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
  canLobby?: (
    colonistId: string,
    faction: string,
    boost: number,
  ) => {
    canLobby: boolean;
    cost: number;
    reason?: string;
  };
  lobbyCouncilMemberCalled?: (colonistId: string, faction: string, boost: number) => void;
  // Grid mocking
  gridAvailableDeposits?: Array<{
    position: { x: number; y: number };
    type: string;
    isOccupied: boolean;
  }>;
}

describe("HeuristicStrategy", () => {
  describe("Priority 1 - Survival", () => {
    it("builds farm when food < 50", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 40, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.BASIC_FARM);
    });

    it("builds oxygen generator when oxygen contribution < 6", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 },
        },
        buildingsSnapshot: {
          active: [],
          pending: [],
          definitions: [],
          moraleBoost: 0,
          totalAirContribution: 2, // Low oxygen contribution
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.OXYGEN_GENERATOR);
    });

    it("builds farm when food production <= consumption", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 5 },
          consumption: { food: 5 },
          netFlow: { food: 0 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.BASIC_FARM);
    });

    it("builds oxygen generator when oxygen contribution is negative", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 },
        },
        buildingsSnapshot: {
          active: [],
          pending: [],
          definitions: [],
          moraleBoost: 0,
          totalAirContribution: -2, // Negative oxygen contribution
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.OXYGEN_GENERATOR);
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

    it("builds solar panel when power production is low", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 },
        },
        powerGridSnapshot: {
          totalProduction: 10,
          totalConsumption: 15, // Production < consumption, ratio < 1.0
          buildingCounts: {
            powered: 3,
            onBattery: 0,
            lowBattery: 0,
            unpowered: 1, // Has unpowered buildings
          },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Has unpowered buildings, so should build solar panel
      expect(buildCalls).toContain(BuildingId.SOLAR_PANEL);
    });

    it("builds mining station when materials < 100 and tech available", () => {
      const buildCalls: string[] = [];
      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 50 },
          // Has materials production already, so handleMaterialsProduction won't trigger
          production: { food: 10, materials: 5 },
          consumption: { food: 5 },
          netFlow: { food: 5, materials: 5 },
        },
        canBuild: (defId) => {
          if (defId === BuildingId.MINING_STATION) return { allowed: true };
          if (defId === BuildingId.SOLAR_PANEL) return { allowed: false, reason: "Not needed" };
          return { allowed: true };
        },
        buildCalled: (defId) => buildCalls.push(defId),
        // Provide an available mineral deposit for the mining station
        gridAvailableDeposits: [{ position: { x: 2, y: 2 }, type: "mineral", isOccupied: false }],
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.MINING_STATION);
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
          housingAssignments: {},
          unhoused: [],
        },
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).toContain(BuildingId.HABITAT);
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
          housingAssignments: {},
          unhoused: [],
        },
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).not.toContain(BuildingId.HABITAT);
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
          housingAssignments: {},
          unhoused: [],
        },
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5, materials: 5 },
        },
        buildCalled: (defId) => buildCalls.push(defId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(buildCalls).not.toContain(BuildingId.HABITAT);
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
            earth_loyalists: 0,
            mars_independence: 0,
            corporate_interests: 0,
            neutral: 0,
          },
          factionSupport: { earthLoyalists: 0, marsIndependence: 0, corporateInterests: 0 },
        },
        proposeProjectCalled: (projectId) => proposedProjects.push(projectId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      expect(proposedProjects).toHaveLength(0);
    });

    it("commits to faction when it reaches 50% council seats", () => {
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
            { colonistId: "c1", name: "Test1", faction: "earth_loyalists" },
            { colonistId: "c2", name: "Test2", faction: "earth_loyalists" },
            { colonistId: "c3", name: "Test3", faction: "mars_independence" },
          ],
          councilFactionCounts: {
            earth_loyalists: 2,
            mars_independence: 1,
            corporate_interests: 0,
            neutral: 0,
          },
          factionSupport: { earthLoyalists: 0.6, marsIndependence: 0.3, corporateInterests: 0.1 },
        },
        voteProjection: { votesFor: 2, votesAgainst: 1, wouldPass: true },
        canProposeProject: () => ({ canPropose: true, currentSupport: 0.6, requiredSupport: 0.35 }),
        proposeProjectCalled: (projectId) => proposedProjects.push(projectId),
      });

      const strategy = new HeuristicStrategy(api);
      strategy.executeTick();

      // Should propose an Earth Loyalists project since they have majority
      expect(proposedProjects.length).toBeGreaterThan(0);
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
            { colonistId: "c1", name: "Test1", faction: "earth_loyalists" },
            { colonistId: "c2", name: "Test2", faction: "mars_independence" },
            { colonistId: "c3", name: "Test3", faction: "corporate_interests" },
          ],
          // No faction has 50% - all at 33%
          councilFactionCounts: {
            earth_loyalists: 1,
            mars_independence: 1,
            corporate_interests: 1,
            neutral: 0,
          },
          factionSupport: {
            earthLoyalists: 0.33,
            marsIndependence: 0.33,
            corporateInterests: 0.33,
          },
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
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 },
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

      // Survival takes precedence, so farm should be built, not event resolved
      expect(buildCalls).toContain(BuildingId.BASIC_FARM);
      expect(resolvedChoices).toHaveLength(0);
    });

    it("handles events before infrastructure", () => {
      const buildCalls: string[] = [];
      const resolvedChoices: string[] = [];

      const api = createMockAPI({
        resourceSnapshot: {
          current: { food: 100, water: 100, materials: 100 },
          production: { food: 10 },
          consumption: { food: 5 },
          netFlow: { food: 5 - 5 },
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
