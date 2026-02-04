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
    const resources = new ResourceManager({ food: 0, water: 0, materials: 1100 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const ideology = new IdeologyManager();

    manager.setProjectQueries(ideology);

    // Asteroid Mining Platform requires DEEP_SPACE_MINING_CHARTER project (Corporate Interests)
    const canBuild = manager.canBuild(BuildingId.ASTEROID_MINING_PLATFORM, resources, technology);
    expect(canBuild).toBe(false);
  });

  test("should allow building victory buildings after project is completed", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 1100 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const ideology = new IdeologyManager();

    manager.setProjectQueries(ideology);

    // Complete the required project
    ideology.completeProject(ProjectId.DEEP_SPACE_MINING_CHARTER);

    const canBuild = manager.canBuild(BuildingId.ASTEROID_MINING_PLATFORM, resources, technology);
    expect(canBuild).toBe(true);
  });
});
