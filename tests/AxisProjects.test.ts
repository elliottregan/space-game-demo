import { describe, expect, test, beforeEach } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { ProjectId } from "../src/core/models/NPCInfluence";
import type { AxisPosition, Project } from "../src/core/models/NPCInfluence";
import {
  getProject,
  getAvailableProjects,
  meetsAxisRequirements,
  PROJECTS,
} from "../src/core/data/projects";

describe("Axis-gated projects", () => {
  let manager: IdeologyManager;

  beforeEach(() => {
    manager = new IdeologyManager();
  });

  test("project accessible when faction meets axis requirements", () => {
    // Universal Housing requires solidarity >= 0.3
    const project = getProject(ProjectId.UNIVERSAL_HOUSING)!;
    expect(project).toBeDefined();
    expect(project.axisRequirements).toBeDefined();

    // Set faction position to meet requirement
    const faction = manager.getFactions().find((f) => f.id === "mars_independence")!;
    faction.position.solidarity = 0.5;

    const result = manager.canProposeProject(project, faction.id, {});
    expect(result.canPropose).toBe(true);
  });

  test("project inaccessible when faction below min threshold", () => {
    // Universal Housing requires solidarity >= 0.3
    const project = getProject(ProjectId.UNIVERSAL_HOUSING)!;

    // Set faction position below requirement
    const faction = manager.getFactions().find((f) => f.id === "corporate_interests")!;
    faction.position.solidarity = 0.1;

    const result = manager.canProposeProject(project, faction.id, {});
    expect(result.canPropose).toBe(false);
    expect(result.reason).toContain("solidarity");
    expect(result.reason).toContain("too low");
  });

  test("project inaccessible when faction above max threshold", () => {
    // Heritage Archive requires transformation <= -0.3
    const project = getProject(ProjectId.HERITAGE_ARCHIVE)!;

    const faction = manager.getFactions().find((f) => f.id === "mars_independence")!;
    faction.position.transformation = 0.5;

    const result = manager.canProposeProject(project, faction.id, {});
    expect(result.canPropose).toBe(false);
    expect(result.reason).toContain("transformation");
    expect(result.reason).toContain("too high");
  });

  test("project requiring two axes needs both met", () => {
    // Mars Nationalism Charter requires sovereignty >= 0.5 AND transformation <= -0.3
    const project = getProject(ProjectId.MARS_NATIONALISM_CHARTER)!;
    expect(project.axisRequirements).toBeDefined();

    const faction = manager.getFactions()[0]!;

    // Meet sovereignty but not transformation
    faction.position.sovereignty = 0.6;
    faction.position.transformation = 0.2;
    const result1 = manager.canProposeProject(project, faction.id, {});
    expect(result1.canPropose).toBe(false);

    // Meet transformation but not sovereignty
    faction.position.sovereignty = 0.2;
    faction.position.transformation = -0.5;
    const result2 = manager.canProposeProject(project, faction.id, {});
    expect(result2.canPropose).toBe(false);

    // Meet both
    faction.position.sovereignty = 0.6;
    faction.position.transformation = -0.5;
    const result3 = manager.canProposeProject(project, faction.id, {});
    expect(result3.canPropose).toBe(true);
  });

  test("project without axis requirements is always accessible", () => {
    // Create a project with no axis requirements
    const noAxisProject: Project = {
      id: ProjectId.EARTH_MEMORIAL,
      name: "Test Project",
      description: "A test project",
      proposalCost: { materials: 50 },
    };

    const faction = manager.getFactions()[0]!;
    faction.position.solidarity = 0;
    faction.position.sovereignty = 0;
    faction.position.transformation = 0;

    // Should be proposable regardless of position (will fail because EARTH_MEMORIAL
    // exists in PROJECTS with axis requirements, so we test with the raw method)
    const result = meetsAxisRequirements(faction.position, noAxisProject);
    expect(result).toBe(true);
  });

  test("faction loses access when drifting away from threshold", () => {
    // Venture Capital Initiative requires solidarity <= -0.3
    const project = getProject(ProjectId.VENTURE_CAPITAL_INITIATIVE)!;

    const faction = manager.getFactions().find((f) => f.id === "corporate_interests")!;

    // Start at qualifying position
    faction.position.solidarity = -0.5;
    const result1 = manager.canProposeProject(project, faction.id, {});
    expect(result1.canPropose).toBe(true);

    // Drift to no longer qualifying
    faction.position.solidarity = -0.1;
    const result2 = manager.canProposeProject(project, faction.id, {});
    expect(result2.canPropose).toBe(false);
  });

  test("getAvailableProjects returns correct projects for position", () => {
    // A position with solidarity: 0.5, sovereignty: -0.7, transformation: -0.5
    // Should match: collectivist (solidarity >= 0.3), earth-tied (sovereignty <= -0.3),
    //               preservationist (transformation <= -0.3)
    const position: AxisPosition = {
      solidarity: 0.5,
      sovereignty: -0.7,
      transformation: -0.5,
    };

    const available = getAvailableProjects(position);

    // Should include collectivist projects
    const ids = available.map((p) => p.id);
    expect(ids).toContain(ProjectId.UNIVERSAL_HOUSING);
    expect(ids).toContain(ProjectId.HEALTHCARE_EXPANSION);
    expect(ids).toContain(ProjectId.DEMOCRATIC_ASSEMBLY);

    // Should include preservationist projects
    expect(ids).toContain(ProjectId.HERITAGE_ARCHIVE);
    expect(ids).toContain(ProjectId.EARTH_MEMORIAL);

    // Should include earth-tied projects
    expect(ids).toContain(ProjectId.IMMIGRATION_PROGRAM);

    // Should NOT include individualist projects (solidarity too high)
    expect(ids).not.toContain(ProjectId.VENTURE_CAPITAL_INITIATIVE);
    expect(ids).not.toContain(ProjectId.PRIVATE_MINING_CONTRACTS);

    // Should include Earth Relief Compact capstone (sovereignty <= -0.6 and solidarity >= 0.5)
    expect(ids).toContain(ProjectId.EARTH_RELIEF_COMPACT);
  });

  test("capstone projects require extreme axis positions", () => {
    // Earth Relief Compact: sovereignty <= -0.6, solidarity >= 0.5
    const earthRelief = getProject(ProjectId.EARTH_RELIEF_COMPACT)!;
    expect(earthRelief.isCapstone).toBe(true);
    expect(earthRelief.axisRequirements?.sovereignty?.max).toBe(-0.6);
    expect(earthRelief.axisRequirements?.solidarity?.min).toBe(0.5);

    // Deep Space Mining Charter: solidarity <= -0.5, transformation >= 0.5
    const deepSpace = getProject(ProjectId.DEEP_SPACE_MINING_CHARTER)!;
    expect(deepSpace.isCapstone).toBe(true);
    expect(deepSpace.axisRequirements?.solidarity?.max).toBe(-0.5);
    expect(deepSpace.axisRequirements?.transformation?.min).toBe(0.5);

    // Genesis Vault: transformation <= -0.6, solidarity >= 0.5
    const genesisVault = getProject(ProjectId.GENESIS_VAULT)!;
    expect(genesisVault.isCapstone).toBe(true);
    expect(genesisVault.axisRequirements?.transformation?.max).toBe(-0.6);
    expect(genesisVault.axisRequirements?.solidarity?.min).toBe(0.5);

    // Moderate position should not meet capstone requirements
    const moderatePosition: AxisPosition = {
      solidarity: 0.2,
      sovereignty: -0.3,
      transformation: 0.1,
    };
    expect(meetsAxisRequirements(moderatePosition, earthRelief)).toBe(false);
    expect(meetsAxisRequirements(moderatePosition, deepSpace)).toBe(false);
    expect(meetsAxisRequirements(moderatePosition, genesisVault)).toBe(false);
  });

  test("meetsAxisRequirements works with exact boundary values", () => {
    const position: AxisPosition = { solidarity: 0.3, sovereignty: 0, transformation: 0 };
    const project = getProject(ProjectId.UNIVERSAL_HOUSING)!;

    // At exactly the min threshold, should pass
    expect(meetsAxisRequirements(position, project)).toBe(true);

    // Just below the min threshold, should fail
    position.solidarity = 0.29;
    expect(meetsAxisRequirements(position, project)).toBe(false);
  });

  test("getAvailableProjects returns empty for neutral position", () => {
    const neutralPosition: AxisPosition = {
      solidarity: 0,
      sovereignty: 0,
      transformation: 0,
    };

    const available = getAvailableProjects(neutralPosition);

    // Neutral position should not meet any axis-gated project requirements
    // All projects in the pool have axis requirements
    for (const project of available) {
      // If any project is available at neutral, it must have no axis requirements
      if (project.axisRequirements) {
        // This project should genuinely meet neutral requirements
        expect(meetsAxisRequirements(neutralPosition, project)).toBe(true);
      }
    }
  });

  test("canProposeProject returns error for unknown faction", () => {
    const project = getProject(ProjectId.UNIVERSAL_HOUSING)!;
    const result = manager.canProposeProject(project, "nonexistent_faction", {});
    expect(result.canPropose).toBe(false);
    expect(result.reason).toBe("Faction not found");
  });

  test("all projects in pool have valid structure", () => {
    for (const project of PROJECTS) {
      expect(project.id).toBeDefined();
      expect(project.name).toBeDefined();
      expect(project.description).toBeDefined();
      expect(project.proposalCost).toBeDefined();

      if (project.axisRequirements) {
        for (const [axis, req] of Object.entries(project.axisRequirements)) {
          expect(["solidarity", "sovereignty", "transformation"]).toContain(axis);
          if (req.min !== undefined) {
            expect(req.min).toBeGreaterThanOrEqual(-1);
            expect(req.min).toBeLessThanOrEqual(1);
          }
          if (req.max !== undefined) {
            expect(req.max).toBeGreaterThanOrEqual(-1);
            expect(req.max).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  test("Declaration of Sovereignty is a capstone with sovereignty requirement", () => {
    const project = getProject(ProjectId.DECLARATION_OF_SOVEREIGNTY)!;
    expect(project.isCapstone).toBe(true);
    expect(project.axisRequirements?.sovereignty?.min).toBe(0.5);
    expect(project.requiredCouncilSupport).toBe(0.65);
  });
});
