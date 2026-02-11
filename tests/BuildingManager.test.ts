// tests/BuildingManager.test.ts
import { describe, expect, test } from "bun:test";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { DistrictGrantManager } from "../src/core/systems/DistrictGrantManager";
import { BUILDINGS } from "../src/core/data/buildings";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { BuildingId } from "../src/core/models/Building";
import { DistrictGrantId } from "../src/core/models/DistrictGrant";

describe("Grant-gated buildings", () => {
  test("should not allow building victory buildings without completed grant", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 1100 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const grantManager = new DistrictGrantManager();

    manager.setGrantQueries(grantManager);

    // Asteroid Mining Platform requires DEEP_SPACE_MINING_CHARTER grant
    const canBuild = manager.canBuild(BuildingId.ASTEROID_MINING_PLATFORM, resources, technology);
    expect(canBuild).toBe(false);
  });

  test("should allow building victory buildings after grant is completed", () => {
    const manager = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({ food: 0, water: 0, materials: 1100 });
    const technology = new TechnologyTree(TECHNOLOGIES);
    const grantManager = new DistrictGrantManager();

    manager.setGrantQueries(grantManager);

    // Complete the required grant
    grantManager.addCompletedGrant("district-1", DistrictGrantId.DEEP_SPACE_MINING_CHARTER);

    const canBuild = manager.canBuild(BuildingId.ASTEROID_MINING_PLATFORM, resources, technology);
    expect(canBuild).toBe(true);
  });
});
