import { describe, expect, test } from "bun:test";
import { BuildingPurpose } from "../src/core/models/Building";
import { BUILDINGS } from "../src/core/data/buildings";
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

describe("BuildingPurpose", () => {
  test("enum has all three purpose types", () => {
    expect(BuildingPurpose.Residential).toBe("residential");
    expect(BuildingPurpose.Industrial).toBe("industrial");
    expect(BuildingPurpose.Social).toBe("social");
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
