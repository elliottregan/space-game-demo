import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { DistrictManager } from "../src/core/systems/DistrictManager";

describe("Housing Assignment", () => {
  let colonyManager: ColonyManager;
  let districtManager: DistrictManager;

  beforeEach(() => {
    colonyManager = new ColonyManager(0);
    districtManager = new DistrictManager();
  });

  it("assigns new colonist to available district", () => {
    const district = districtManager.foundDistrict("Alpha", 1);

    const colonist = colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);

    expect(colonist.districtId).toBeDefined();
    expect(colonist.districtId).toBe(district.id);
  });

  it("returns unhoused colonists when no districts exist", () => {
    colonyManager.addColonist();
    colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(2);
  });

  it("respects district capacity limits", () => {
    const district = districtManager.foundDistrict("Alpha", 1);
    district.capacity = 6;

    for (let i = 0; i < 8; i++) {
      colonyManager.addColonist();
    }
    colonyManager.assignToDistrict(districtManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(2);

    const housed = colonyManager.getColonists().filter((c) => c.districtId);
    expect(housed.length).toBe(6);
  });

  it("getHousingAssignments returns colonists grouped by district", () => {
    const district = districtManager.foundDistrict("Alpha", 1);

    colonyManager.addColonist();
    colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);

    const assignments = colonyManager.getHousingAssignments();
    expect(Object.keys(assignments).length).toBeGreaterThan(0);
    expect(assignments[district.id]?.length).toBe(2);
  });

  it("does not reassign already housed colonists", () => {
    districtManager.foundDistrict("Alpha", 1);

    const colonist = colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);

    const originalDistrictId = colonist.districtId;

    // Add another colonist and reassign
    colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);

    // Original colonist should still have the same district
    expect(colonist.districtId).toBe(originalDistrictId);
  });

  it("clearHousingAssignment removes housing from colonist", () => {
    districtManager.foundDistrict("Alpha", 1);

    const colonist = colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);
    expect(colonist.districtId).toBeDefined();

    colonyManager.clearHousingAssignment(colonist.id);
    expect(colonist.districtId).toBeUndefined();
  });

  it("assigns across multiple districts", () => {
    const district1 = districtManager.foundDistrict("Alpha", 1);
    district1.capacity = 4;
    const district2 = districtManager.foundDistrict("Beta", 1);
    district2.capacity = 4;

    for (let i = 0; i < 6; i++) {
      colonyManager.addColonist();
    }
    colonyManager.assignToDistrict(districtManager);

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(0);

    const assignments = colonyManager.getHousingAssignments();
    const totalHoused =
      (assignments[district1.id]?.length || 0) + (assignments[district2.id]?.length || 0);
    expect(totalHoused).toBe(6);
  });

  it("clears housing when district is removed", () => {
    const district = districtManager.foundDistrict("Alpha", 1);

    const colonist = colonyManager.addColonist();
    colonyManager.assignToDistrict(districtManager);
    expect(colonist.districtId).toBeDefined();

    // Clear the colonist's district assignment to simulate district removal
    colonyManager.clearHousingAssignment(colonist.id);
    expect(colonist.districtId).toBeUndefined();

    const unhoused = colonyManager.getUnhousedColonists();
    expect(unhoused.length).toBe(1);
  });
});
