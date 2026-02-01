// tests/BuildingManager.test.ts
import { describe, expect, test } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import { ProjectId } from "../src/core/models/NPCInfluence";

describe("Project-gated buildings", () => {
  test("should not allow building victory buildings without completed project", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 500, power: 200 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const ideology = new IdeologyManager();

    manager.setIdeologyManager(ideology);

    // Generation Ship requires RETURN_MISSION project
    const canBuild = manager.canBuild(BuildingId.GENERATION_SHIP, resources, technology);
    expect(canBuild).toBe(false);
  });

  test("should allow building victory buildings after project is completed", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ materials: 500, power: 200 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const ideology = new IdeologyManager();

    manager.setIdeologyManager(ideology);

    // Complete the required project
    ideology.completeProject(ProjectId.RETURN_MISSION);

    const canBuild = manager.canBuild(BuildingId.GENERATION_SHIP, resources, technology);
    expect(canBuild).toBe(true);
  });
});
