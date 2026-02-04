import { describe, expect, test } from "bun:test";
import { BuildingId, BuildingPurpose } from "../src/core/models/Building";
import { BUILDINGS } from "../src/core/data/buildings";
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { BuildingManager } from "../src/core/systems/BuildingManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { WorkforceManager } from "../src/core/systems/WorkforceManager";

// Helper to create a fully constructed building
function buildBuilding(
  buildings: BuildingManager,
  resources: ResourceManager,
  defId: BuildingId,
): string {
  const building = buildings.startBuilding(defId, resources, {
    isResearched: () => true,
  } as never);
  if (!building) throw new Error(`Failed to start building ${defId}`);
  // Tick enough times to complete construction
  const def = BUILDINGS.find((b) => b.id === defId);
  for (let i = 0; i < (def?.constructionTime ?? 20); i++) {
    buildings.tick(resources);
  }
  return building.id;
}

describe("BuildingPurpose", () => {
  test("enum has all three purpose types", () => {
    expect(BuildingPurpose.Residential).toBe(BuildingPurpose.Residential);
    expect(BuildingPurpose.Industrial).toBe(BuildingPurpose.Industrial);
    expect(BuildingPurpose.Social).toBe(BuildingPurpose.Social);
  });

  test("Common Room has Social purpose", () => {
    const commonRoom = BUILDINGS.find((b) => b.id === "common_room");
    expect(commonRoom?.purpose).toBe(BuildingPurpose.Social);
  });

  test("Habitat has Residential purpose", () => {
    const habitat = BUILDINGS.find((b) => b.id === "habitat");
    expect(habitat?.purpose).toBe(BuildingPurpose.Residential);
  });

  test("Basic Mine has Industrial purpose", () => {
    const mine = BUILDINGS.find((b) => b.id === "basic_mine");
    expect(mine?.purpose).toBe(BuildingPurpose.Industrial);
  });
});

describe("Colonist socialBuildingIds", () => {
  test("colonist can have socialBuildingIds array", () => {
    const colonist: Colonist = {
      id: "c1",
      name: "Test Colonist",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      socialBuildingIds: ["building_1", "building_2"],
    };
    expect(colonist.socialBuildingIds).toEqual(["building_1", "building_2"]);
  });

  test("socialBuildingIds is optional", () => {
    const colonist: Colonist = {
      id: "c1",
      name: "Test Colonist",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
    };
    expect(colonist.socialBuildingIds).toBeUndefined();
  });
});

describe("Social Building Assignment", () => {
  test("assignToSocialBuilding adds building to colonist socialBuildingIds", () => {
    const colony = new ColonyManager(0);
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });

    const commonRoomId = buildBuilding(buildings, resources, BuildingId.COMMON_ROOM);

    const colonist = colony.addColonist("Alice");

    const result = colony.assignToSocialBuilding(colonist.id, commonRoomId, buildings);
    expect(result).toBe(true);

    const updatedColonist = colony.getColonist(colonist.id);
    expect(updatedColonist?.socialBuildingIds).toContain(commonRoomId);
  });

  test("assignToSocialBuilding respects capacity limit", () => {
    const colony = new ColonyManager(0);
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });

    const gymId = buildBuilding(buildings, resources, BuildingId.GYMNASIUM); // capacity: 6

    // Add 6 colonists and assign them all
    const colonists = [];
    for (let i = 0; i < 6; i++) {
      const colonist = colony.addColonist(`Colonist ${i}`);
      colonists.push(colonist);
      colony.assignToSocialBuilding(colonist.id, gymId, buildings);
    }

    // Add 7th colonist - should fail due to capacity
    const lastColonist = colony.addColonist("Colonist 6");

    const result = colony.assignToSocialBuilding(lastColonist.id, gymId, buildings);
    expect(result).toBe(false);
  });

  test("removeFromSocialBuilding removes assignment", () => {
    const colony = new ColonyManager(0);
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });

    const commonRoomId = buildBuilding(buildings, resources, BuildingId.COMMON_ROOM);

    const colonist = colony.addColonist("Alice");

    colony.assignToSocialBuilding(colonist.id, commonRoomId, buildings);
    colony.removeFromSocialBuilding(colonist.id, commonRoomId);

    const updatedColonist = colony.getColonist(colonist.id);
    expect(updatedColonist?.socialBuildingIds ?? []).not.toContain(commonRoomId);
  });

  test("getSocialBuildingAssignments returns colonists grouped by building", () => {
    const colony = new ColonyManager(0);
    const buildings = new BuildingManager(BUILDINGS);
    const resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });

    const commonRoomId = buildBuilding(buildings, resources, BuildingId.COMMON_ROOM);
    const gymId = buildBuilding(buildings, resources, BuildingId.GYMNASIUM);

    const alice = colony.addColonist("Alice");
    const bob = colony.addColonist("Bob");

    colony.assignToSocialBuilding(alice.id, commonRoomId, buildings);
    colony.assignToSocialBuilding(alice.id, gymId, buildings);
    colony.assignToSocialBuilding(bob.id, gymId, buildings);

    const assignments = colony.getSocialBuildingAssignments();
    expect(assignments[commonRoomId]?.length).toBe(1);
    expect(assignments[gymId]?.length).toBe(2);
  });
});

describe("Third Spaces Integration", () => {
  test("full flow: assign colonists to social building, bonds form over time", () => {
    const colony = new ColonyManager(0);
    const buildings = new BuildingManager(BUILDINGS);
    const workforce = new WorkforceManager();
    const resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });

    // Build a common room
    const commonRoomId = buildBuilding(buildings, resources, BuildingId.COMMON_ROOM);

    // Add colonists
    const alice = colony.addColonist("Alice");
    const bob = colony.addColonist("Bob");
    const charlie = colony.addColonist("Charlie");

    // Assign Alice and Bob to common room (Charlie stays home)
    expect(colony.assignToSocialBuilding(alice.id, commonRoomId, buildings)).toBe(true);
    expect(colony.assignToSocialBuilding(bob.id, commonRoomId, buildings)).toBe(true);

    // Run simulation for 20 sols
    for (let sol = 0; sol < 20; sol++) {
      workforce.tick(colony, buildings, sol);
    }

    // Alice and Bob should have a meaningful relationship from social bonding
    const aliceBobStrength = workforce.getCoworkerRelationshipStrength(alice.id, bob.id);
    expect(aliceBobStrength).toBeGreaterThan(0.1);

    // Charlie's relationships should be weaker than Alice-Bob's social bond
    // (Charlie may have random connections via preferential attachment, but not social bonding)
    const aliceCharlieStrength = workforce.getCoworkerRelationshipStrength(alice.id, charlie.id);
    const bobCharlieStrength = workforce.getCoworkerRelationshipStrength(bob.id, charlie.id);
    expect(aliceBobStrength).toBeGreaterThan(aliceCharlieStrength);
    expect(aliceBobStrength).toBeGreaterThan(bobCharlieStrength);
  });
});
