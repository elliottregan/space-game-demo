// tests/Prospecting.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { OperationsManager } from "../src/core/systems/OperationsManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { PROSPECTING_REVEAL_COST, MAX_REVEALED_SITES } from "../src/core/balance/OperationsBalance";

describe("Prospecting", () => {
  let operations: OperationsManager;
  let resources: ResourceManager;

  beforeEach(() => {
    operations = new OperationsManager();
    resources = new ResourceManager({
      food: 500, oxygen: 500, water: 500, power: 500, materials: 500,
    });
  });

  test("getSites returns all sites", () => {
    expect(operations.getSites()).toEqual([]);
  });

  test("revealSite costs materials", () => {
    // First add an unrevealed site (normally from expedition)
    operations.addUnrevealedSite();

    operations.revealSite(operations.getSites()[0]!.id, resources);
    expect(resources.getResources().materials).toBe(500 - PROSPECTING_REVEAL_COST.materials);
  });

  test("revealed site shows quality", () => {
    operations.addUnrevealedSite();
    const site = operations.getSites()[0]!;

    operations.revealSite(site.id, resources);
    expect(operations.getSites()[0]!.revealed).toBe(true);
  });

  test("cannot reveal more than MAX_REVEALED_SITES", () => {
    for (let i = 0; i < MAX_REVEALED_SITES + 1; i++) {
      operations.addUnrevealedSite();
    }

    const sites = operations.getSites();
    for (let i = 0; i < MAX_REVEALED_SITES; i++) {
      operations.revealSite(sites[i]!.id, resources);
    }

    const result = operations.revealSite(sites[MAX_REVEALED_SITES]!.id, resources);
    expect(result).toBe(false);
  });
});
