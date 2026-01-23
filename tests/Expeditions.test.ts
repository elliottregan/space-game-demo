// tests/Expeditions.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { OperationsManager } from "../src/core/systems/OperationsManager";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { ColonyManager } from "../src/core/systems/ColonyManager";
import { EXPEDITIONS, MAX_CONCURRENT_EXPEDITIONS } from "../src/core/balance/OperationsBalance";

describe("Expeditions", () => {
  let operations: OperationsManager;
  let resources: ResourceManager;
  let colony: ColonyManager;

  beforeEach(() => {
    operations = new OperationsManager();
    resources = new ResourceManager({
      food: 500, oxygen: 500, water: 500, power: 500, materials: 500,
    });
    colony = new ColonyManager(10);
  });

  test("canStartExpedition checks resources and crew", () => {
    expect(operations.canStartExpedition("survey", resources, colony)).toBe(true);
  });

  test("canStartExpedition fails with insufficient materials", () => {
    resources = new ResourceManager({
      food: 500, oxygen: 500, water: 500, power: 500, materials: 10,
    });
    expect(operations.canStartExpedition("survey", resources, colony)).toBe(false);
  });

  test("startExpedition deducts resources", () => {
    const crewIds = colony.getColonists().slice(0, 2).map(c => c.id);
    operations.startExpedition("survey", crewIds, resources, colony, 0);

    const remaining = resources.getResources();
    expect(remaining.materials).toBe(500 - EXPEDITIONS.survey.materials);
  });

  test("cannot exceed MAX_CONCURRENT_EXPEDITIONS", () => {
    const colonists = colony.getColonists();

    // Start first expedition
    operations.startExpedition("survey", [colonists[0]!.id, colonists[1]!.id], resources, colony, 0);

    // Start second expedition
    operations.startExpedition("survey", [colonists[2]!.id, colonists[3]!.id], resources, colony, 0);

    // Third should fail
    const result = operations.startExpedition("survey", [colonists[4]!.id, colonists[5]!.id], resources, colony, 0);
    expect(result).toBe(false);
  });

  test("expedition resolves after duration", () => {
    const crewIds = colony.getColonists().slice(0, 2).map(c => c.id);
    operations.startExpedition("survey", crewIds, resources, colony, 0);

    // Tick for duration
    for (let sol = 1; sol <= EXPEDITIONS.survey.duration; sol++) {
      operations.tick(sol, resources, colony);
    }

    expect(operations.getActiveExpeditions().length).toBe(0);
  });
});
