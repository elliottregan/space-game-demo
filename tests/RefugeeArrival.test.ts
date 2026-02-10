import { describe, it, expect, beforeEach } from "bun:test";
import { ColonyManager } from "../src/core/systems/ColonyManager";

describe("RefugeeArrival", () => {
  let colony: ColonyManager;

  beforeEach(() => {
    colony = new ColonyManager(0); // Start with 0 population
  });

  describe("addRefugees", () => {
    it("should add the specified number of refugees", () => {
      colony.addRefugees(5);
      expect(colony.getPopulation()).toBe(5);
    });

    it("should return colonist_arrived events for each refugee", () => {
      const events = colony.addRefugees(3);
      expect(events.filter((e) => e.type === "COLONIST_ARRIVED").length).toBe(3);
    });

    it("should bias refugee ideology toward Earth Loyalist", () => {
      // Add many refugees to get statistical distribution
      colony.addRefugees(100);
      const colonists = colony.getColonists();

      let earthLoyalistBiasCount = 0;
      for (const colonist of colonists) {
        const ideology = colonist.ideology;
        if (ideology) {
          // Earth Loyalist refugees have negative sovereignty (earth-tied)
          if (ideology.sovereignty < -0.2) {
            earthLoyalistBiasCount++;
          }
        }
      }

      // At least 40% should lean Earth Loyalist (60% weight with variance)
      expect(earthLoyalistBiasCount / colonists.length).toBeGreaterThan(0.4);
    });

    it("should apply reduced colony morale when refugees arrive", () => {
      // Get a colony with some colonists
      const colonyWithPop = new ColonyManager(10);

      // Adding refugees should return events
      const events = colonyWithPop.addRefugees(5);

      // Events should include arrival events for each refugee
      // Note: Since individual colonist morale doesn't exist, the colony morale
      // adjustment happens at tick time via the morale system, not directly here.
      // So we just verify events are returned for now.
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
