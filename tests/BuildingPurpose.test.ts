import { describe, expect, test } from "bun:test";
import { BuildingPurpose } from "../src/core/models/Building";
import { BUILDINGS } from "../src/core/data/buildings";

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
