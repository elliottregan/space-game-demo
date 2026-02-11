import { describe, test, expect, beforeEach } from "bun:test";
import { DistrictManager } from "../src/core/systems/DistrictManager";
import { PowerStatus } from "../src/core/models/District";

describe("DistrictManager", () => {
  let dm: DistrictManager;

  beforeEach(() => {
    dm = new DistrictManager();
  });

  describe("founding", () => {
    test("creates initial district with correct defaults", () => {
      const district = dm.foundDistrict("Landing Site", 0);
      expect(district.name).toBe("Landing Site");
      expect(district.capacity).toBe(20);
      expect(district.foundedAt).toBe(0);
      expect(district.growthCap).toBeNull();
      expect(district.buildingIds).toEqual([]);
    });

    test("generates unique IDs for multiple districts", () => {
      const d1 = dm.foundDistrict("Alpha", 0);
      const d2 = dm.foundDistrict("Beta", 10);
      expect(d1.id).not.toBe(d2.id);
    });

    test("getDistricts returns all founded districts", () => {
      dm.foundDistrict("A", 0);
      dm.foundDistrict("B", 5);
      expect(dm.getDistricts()).toHaveLength(2);
    });

    test("getDistrict returns district by ID", () => {
      const d = dm.foundDistrict("Test", 0);
      expect(dm.getDistrict(d.id)).toBeDefined();
      expect(dm.getDistrict(d.id)!.name).toBe("Test");
    });

    test("getDistrict returns undefined for unknown ID", () => {
      expect(dm.getDistrict("nonexistent")).toBeUndefined();
    });

    test("getTotalCapacity sums all district capacities", () => {
      dm.foundDistrict("A", 0); // capacity 20
      dm.foundDistrict("B", 5); // capacity 20
      expect(dm.getTotalCapacity()).toBe(40);
    });

    test("getTotalCapacity returns 0 with no districts", () => {
      expect(dm.getTotalCapacity()).toBe(0);
    });
  });

  describe("building assignment", () => {
    test("assigns building to district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "building_1");
      expect(dm.getDistrict(d.id)!.buildingIds).toContain("building_1");
    });

    test("getBuildingDistrictId returns correct district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "building_1");
      expect(dm.getBuildingDistrictId("building_1")).toBe(d.id);
    });

    test("getBuildingDistrictId returns undefined for unassigned building", () => {
      expect(dm.getBuildingDistrictId("building_1")).toBeUndefined();
    });

    test("removeBuilding removes from district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "building_1");
      dm.removeBuilding("building_1");
      expect(dm.getDistrict(d.id)!.buildingIds).not.toContain("building_1");
      expect(dm.getBuildingDistrictId("building_1")).toBeUndefined();
    });
  });

  describe("colonist assignment", () => {
    test("assigns colonist to district", () => {
      const d = dm.foundDistrict("Test", 0);
      expect(dm.assignColonist(d.id, "colonist_1")).toBe(true);
      expect(dm.getColonistDistrictId("colonist_1")).toBe(d.id);
    });

    test("rejects assignment when district is at capacity", () => {
      const d = dm.foundDistrict("Test", 0);
      for (let i = 0; i < 20; i++) {
        dm.assignColonist(d.id, `colonist_${i}`);
      }
      expect(dm.assignColonist(d.id, "colonist_overflow")).toBe(false);
    });

    test("getDistrictPopulation returns count", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignColonist(d.id, "c1");
      dm.assignColonist(d.id, "c2");
      expect(dm.getDistrictPopulation(d.id)).toBe(2);
    });

    test("getDistrictColonistIds returns colonist list", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignColonist(d.id, "c1");
      dm.assignColonist(d.id, "c2");
      expect(dm.getDistrictColonistIds(d.id)).toEqual(["c1", "c2"]);
    });

    test("removeColonist removes from district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignColonist(d.id, "c1");
      dm.removeColonist("c1");
      expect(dm.getDistrictPopulation(d.id)).toBe(0);
      expect(dm.getColonistDistrictId("c1")).toBeUndefined();
    });

    test("transferColonist moves between districts", () => {
      const d1 = dm.foundDistrict("A", 0);
      const d2 = dm.foundDistrict("B", 0);
      dm.assignColonist(d1.id, "c1");
      expect(dm.transferColonist("c1", d2.id)).toBe(true);
      expect(dm.getColonistDistrictId("c1")).toBe(d2.id);
      expect(dm.getDistrictPopulation(d1.id)).toBe(0);
      expect(dm.getDistrictPopulation(d2.id)).toBe(1);
    });
  });

  describe("housing growth", () => {
    test("processGrowth increases capacity when above trigger", () => {
      const d = dm.foundDistrict("Test", 0);
      for (let i = 0; i < 17; i++) {
        dm.assignColonist(d.id, `c${i}`);
      }
      const materialsConsumed = dm.processGrowth(5);
      expect(dm.getDistrict(d.id)!.capacity).toBe(21);
      expect(materialsConsumed).toBeGreaterThan(0);
    });

    test("processGrowth does nothing below trigger threshold", () => {
      const d = dm.foundDistrict("Test", 0);
      for (let i = 0; i < 5; i++) {
        dm.assignColonist(d.id, `c${i}`);
      }
      const consumed = dm.processGrowth(5);
      expect(dm.getDistrict(d.id)!.capacity).toBe(20);
      expect(consumed).toBe(0);
    });

    test("processGrowth respects growth cap", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.setGrowthCap(d.id, 20);
      for (let i = 0; i < 17; i++) {
        dm.assignColonist(d.id, `c${i}`);
      }
      const consumed = dm.processGrowth(5);
      expect(dm.getDistrict(d.id)!.capacity).toBe(20);
      expect(consumed).toBe(0);
    });
  });

  describe("power ledger", () => {
    test("registerPowerSource tracks production", () => {
      dm.registerPowerSource("solar_1", 10);
      expect(dm.getTotalPowerProduction()).toBe(10);
    });

    test("registerPowerConsumer tracks consumption", () => {
      dm.registerPowerConsumer("farm_1", 3);
      expect(dm.getTotalPowerConsumption()).toBe(3);
    });

    test("getPowerBalance returns production minus consumption", () => {
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerConsumer("farm_1", 3);
      expect(dm.getPowerBalance()).toBe(7);
    });

    test("getPowerStatus returns SURPLUS when balanced", () => {
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerConsumer("farm_1", 3);
      expect(dm.getPowerStatus()).toBe(PowerStatus.SURPLUS);
    });

    test("getPowerStatus returns DEFICIT when consumption exceeds production", () => {
      dm.registerPowerSource("solar_1", 5);
      dm.registerPowerConsumer("farm_1", 8);
      expect(dm.getPowerStatus()).toBe(PowerStatus.DEFICIT);
    });

    test("getPowerStatus returns CRITICAL when deficit exceeds 50%", () => {
      dm.registerPowerSource("solar_1", 2);
      dm.registerPowerConsumer("farm_1", 10);
      expect(dm.getPowerStatus()).toBe(PowerStatus.CRITICAL);
    });

    test("unregisterPowerSource removes production", () => {
      dm.registerPowerSource("solar_1", 10);
      dm.unregisterPowerSource("solar_1");
      expect(dm.getTotalPowerProduction()).toBe(0);
    });

    test("unregisterPowerConsumer removes consumption", () => {
      dm.registerPowerConsumer("farm_1", 3);
      dm.unregisterPowerConsumer("farm_1");
      expect(dm.getTotalPowerConsumption()).toBe(0);
    });
  });

  describe("getDistrictPower", () => {
    test("returns correct per-district power in multi-district scenario", () => {
      const d1 = dm.foundDistrict("Alpha", 0);
      const d2 = dm.foundDistrict("Beta", 0);
      dm.assignBuilding(d1.id, "solar_1");
      dm.assignBuilding(d1.id, "farm_1");
      dm.assignBuilding(d2.id, "solar_2");
      dm.assignBuilding(d2.id, "lab_1");
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerSource("solar_2", 5);
      dm.registerPowerConsumer("farm_1", 3);
      dm.registerPowerConsumer("lab_1", 8);

      const p1 = dm.getDistrictPower(d1.id);
      expect(p1.production).toBe(10);
      expect(p1.consumption).toBe(3);

      const p2 = dm.getDistrictPower(d2.id);
      expect(p2.production).toBe(5);
      expect(p2.consumption).toBe(8);
    });

    test("returns zeros for unknown district", () => {
      const result = dm.getDistrictPower("nonexistent");
      expect(result.production).toBe(0);
      expect(result.consumption).toBe(0);
    });

    test("returns zeros for empty district", () => {
      const d = dm.foundDistrict("Empty", 0);
      const result = dm.getDistrictPower(d.id);
      expect(result.production).toBe(0);
      expect(result.consumption).toBe(0);
    });

    test("ignores power from buildings not in the district", () => {
      const d = dm.foundDistrict("Test", 0);
      dm.assignBuilding(d.id, "solar_1");
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerSource("solar_external", 20);
      dm.registerPowerConsumer("lab_external", 5);

      const result = dm.getDistrictPower(d.id);
      expect(result.production).toBe(10);
      expect(result.consumption).toBe(0);
    });
  });

  describe("serialization", () => {
    test("toJSON and fromJSON round-trip", () => {
      const d = dm.foundDistrict("Test", 5);
      dm.assignBuilding(d.id, "b1");
      dm.assignColonist(d.id, "c1");
      dm.registerPowerSource("solar_1", 10);
      dm.registerPowerConsumer("farm_1", 3);

      const json = dm.toJSON();
      const restored = DistrictManager.fromJSON(json);

      expect(restored.getDistricts()).toHaveLength(1);
      expect(restored.getDistrict(d.id)!.name).toBe("Test");
      expect(restored.getBuildingDistrictId("b1")).toBe(d.id);
      expect(restored.getColonistDistrictId("c1")).toBe(d.id);
      expect(restored.getTotalPowerProduction()).toBe(10);
      expect(restored.getTotalPowerConsumption()).toBe(3);
    });
  });
});
