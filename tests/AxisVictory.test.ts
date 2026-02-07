import { describe, expect, test, beforeEach } from "bun:test";
import { VictoryManager } from "../src/core/systems/VictoryManager";
import { IdeologyManager, type CouncilMember } from "../src/core/systems/IdeologyManager";
import { ProjectId, NPCFaction } from "../src/core/models/NPCInfluence";
import type { Colonist } from "../src/core/models/Colonist";

describe("Axis-gated victory", () => {
  let victoryManager: VictoryManager;
  let ideologyManager: IdeologyManager;

  beforeEach(() => {
    victoryManager = new VictoryManager();
    ideologyManager = new IdeologyManager();
  });

  test("capstone proposable when faction meets axis requirements and council support", () => {
    // Get the Earth Loyalists faction and move it to meet Earth Relief Compact requirements
    // Requirements: sovereignty <= -0.6, solidarity >= +0.5
    const factions = ideologyManager.getFactions();
    const earthLoyalists = factions.find((f) => f.baseId === NPCFaction.EarthLoyalists);
    expect(earthLoyalists).toBeDefined();

    if (earthLoyalists) {
      earthLoyalists.position.sovereignty = -0.7;
      earthLoyalists.position.solidarity = 0.6;
    }

    // Complete all prerequisites for Earth Relief Compact
    ideologyManager.completeProject(ProjectId.EARTH_MEMORIAL);
    ideologyManager.completeProject(ProjectId.HERITAGE_ARCHIVE);
    ideologyManager.completeProject(ProjectId.IMMIGRATION_PROGRAM);

    // Create a council with 65%+ Earth Loyalists support
    const mockCouncil: CouncilMember[] = [
      {
        colonistId: "1",
        name: "Colonist 1",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
      {
        colonistId: "2",
        name: "Colonist 2",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
      {
        colonistId: "3",
        name: "Colonist 3",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
      {
        colonistId: "4",
        name: "Colonist 4",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.MarsIndependence,
      },
    ];

    // Set council using fromJSON to inject mock council
    const managerData = ideologyManager.toJSON();
    managerData.council = mockCouncil;
    ideologyManager = IdeologyManager.fromJSON(managerData);

    // Check if capstone is proposable
    const result = victoryManager.checkCapstoneProposability(ideologyManager);

    expect(result.canProposeAny).toBe(true);
    expect(result.proposableCapstones.length).toBeGreaterThan(0);
    expect(result.proposableCapstones.some((c) => c.projectId === ProjectId.EARTH_RELIEF_COMPACT))
      .toBe(true);
  });

  test("capstone not proposable when axis requirements not met", () => {
    // Get the Earth Loyalists faction but keep it at starting position
    // It won't meet sovereignty <= -0.6 or solidarity >= +0.5
    const factions = ideologyManager.getFactions();
    const earthLoyalists = factions.find((f) => f.baseId === NPCFaction.EarthLoyalists);
    expect(earthLoyalists).toBeDefined();

    // Complete all prerequisites
    ideologyManager.completeProject(ProjectId.EARTH_MEMORIAL);
    ideologyManager.completeProject(ProjectId.HERITAGE_ARCHIVE);
    ideologyManager.completeProject(ProjectId.IMMIGRATION_PROGRAM);

    // Create a council with 100% Earth Loyalists support
    const mockCouncil: CouncilMember[] = [
      {
        colonistId: "1",
        name: "Colonist 1",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
      {
        colonistId: "2",
        name: "Colonist 2",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
    ];

    const managerData = ideologyManager.toJSON();
    managerData.council = mockCouncil;
    ideologyManager = IdeologyManager.fromJSON(managerData);

    // Check if capstone is proposable
    const result = victoryManager.checkCapstoneProposability(ideologyManager);

    // Should not be proposable because axis requirements are not met
    expect(
      result.proposableCapstones.some((c) => c.projectId === ProjectId.EARTH_RELIEF_COMPACT),
    ).toBe(false);
  });

  test("capstone not proposable when council support insufficient", () => {
    // Get the Earth Loyalists faction and set it to meet axis requirements
    const factions = ideologyManager.getFactions();
    const earthLoyalists = factions.find((f) => f.baseId === NPCFaction.EarthLoyalists);
    expect(earthLoyalists).toBeDefined();

    if (earthLoyalists) {
      earthLoyalists.position.sovereignty = -0.7;
      earthLoyalists.position.solidarity = 0.6;
    }

    // Complete all prerequisites
    ideologyManager.completeProject(ProjectId.EARTH_MEMORIAL);
    ideologyManager.completeProject(ProjectId.HERITAGE_ARCHIVE);
    ideologyManager.completeProject(ProjectId.IMMIGRATION_PROGRAM);

    // Create a council with only 50% Earth Loyalists support (below 65% requirement)
    const mockCouncil: CouncilMember[] = [
      {
        colonistId: "1",
        name: "Colonist 1",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
      {
        colonistId: "2",
        name: "Colonist 2",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.MarsIndependence,
      },
    ];

    const managerData = ideologyManager.toJSON();
    managerData.council = mockCouncil;
    ideologyManager = IdeologyManager.fromJSON(managerData);

    // Check if capstone is proposable
    const result = victoryManager.checkCapstoneProposability(ideologyManager);

    // Should not be proposable because council support is insufficient
    expect(
      result.proposableCapstones.some((c) => c.projectId === ProjectId.EARTH_RELIEF_COMPACT),
    ).toBe(false);
  });

  test("capstone not proposable when prerequisites not met", () => {
    // Get the Earth Loyalists faction and set it to meet axis requirements
    const factions = ideologyManager.getFactions();
    const earthLoyalists = factions.find((f) => f.baseId === NPCFaction.EarthLoyalists);
    expect(earthLoyalists).toBeDefined();

    if (earthLoyalists) {
      earthLoyalists.position.sovereignty = -0.7;
      earthLoyalists.position.solidarity = 0.6;
    }

    // Only complete some prerequisites (not all)
    ideologyManager.completeProject(ProjectId.EARTH_MEMORIAL);
    // Missing: HERITAGE_ARCHIVE and IMMIGRATION_PROGRAM

    // Create a council with 100% Earth Loyalists support
    const mockCouncil: CouncilMember[] = [
      {
        colonistId: "1",
        name: "Colonist 1",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
      {
        colonistId: "2",
        name: "Colonist 2",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
    ];

    const managerData = ideologyManager.toJSON();
    managerData.council = mockCouncil;
    ideologyManager = IdeologyManager.fromJSON(managerData);

    // Check if capstone is proposable
    const result = victoryManager.checkCapstoneProposability(ideologyManager);

    // Should not be proposable because prerequisites are not met
    expect(
      result.proposableCapstones.some((c) => c.projectId === ProjectId.EARTH_RELIEF_COMPACT),
    ).toBe(false);
  });

  test("Declaration of Sovereignty capstone requires correct axis position", () => {
    // Declaration of Sovereignty requires: sovereignty >= +0.5
    const factions = ideologyManager.getFactions();
    const marsFirst = factions.find((f) => f.baseId === NPCFaction.MarsIndependence);
    expect(marsFirst).toBeDefined();

    if (marsFirst) {
      marsFirst.position.sovereignty = 0.6;
    }

    // Complete all prerequisites
    ideologyManager.completeProject(ProjectId.UNIVERSAL_HOUSING);
    ideologyManager.completeProject(ProjectId.HEALTHCARE_EXPANSION);
    ideologyManager.completeProject(ProjectId.DEMOCRATIC_ASSEMBLY);

    // Create a council with 70% Mars First support
    const mockCouncil: CouncilMember[] = [
      {
        colonistId: "1",
        name: "Colonist 1",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.MarsIndependence,
      },
      {
        colonistId: "2",
        name: "Colonist 2",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.MarsIndependence,
      },
      {
        colonistId: "3",
        name: "Colonist 3",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.MarsIndependence,
      },
      {
        colonistId: "4",
        name: "Colonist 4",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.EarthLoyalists,
      },
    ];

    const managerData = ideologyManager.toJSON();
    managerData.council = mockCouncil;
    ideologyManager = IdeologyManager.fromJSON(managerData);

    // Check if capstone is proposable
    const result = victoryManager.checkCapstoneProposability(ideologyManager);

    expect(result.canProposeAny).toBe(true);
    expect(
      result.proposableCapstones.some((c) => c.projectId === ProjectId.DECLARATION_OF_SOVEREIGNTY),
    ).toBe(true);
  });

  test("Deep Space Mining Charter requires multi-axis position", () => {
    // Deep Space Mining Charter requires: solidarity <= -0.5, transformation >= +0.5
    const factions = ideologyManager.getFactions();
    const corporatists = factions.find((f) => f.baseId === NPCFaction.CorporateInterests);
    expect(corporatists).toBeDefined();

    if (corporatists) {
      corporatists.position.solidarity = -0.6;
      corporatists.position.transformation = 0.6;
    }

    // Complete all prerequisites
    ideologyManager.completeProject(ProjectId.VENTURE_CAPITAL_INITIATIVE);
    ideologyManager.completeProject(ProjectId.ORBITAL_INFRASTRUCTURE);
    ideologyManager.completeProject(ProjectId.ASTEROID_SURVEY_PROGRAM);

    // Create a council with 70% Corporatists support
    const mockCouncil: CouncilMember[] = [
      {
        colonistId: "1",
        name: "Colonist 1",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.CorporateInterests,
      },
      {
        colonistId: "2",
        name: "Colonist 2",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.CorporateInterests,
      },
      {
        colonistId: "3",
        name: "Colonist 3",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.CorporateInterests,
      },
      {
        colonistId: "4",
        name: "Colonist 4",
        centrality: 0.5,
        conviction: 0.8,
        influence: 0.4,
        factionId: NPCFaction.MarsIndependence,
      },
    ];

    const managerData = ideologyManager.toJSON();
    managerData.council = mockCouncil;
    ideologyManager = IdeologyManager.fromJSON(managerData);

    // Check if capstone is proposable
    const result = victoryManager.checkCapstoneProposability(ideologyManager);

    expect(result.canProposeAny).toBe(true);
    expect(
      result.proposableCapstones.some((c) => c.projectId === ProjectId.DEEP_SPACE_MINING_CHARTER),
    ).toBe(true);
  });
});
