// tests/ColonyPolicies.test.ts
import { test, expect, describe, beforeEach } from "bun:test";
import { OperationsManager } from "../src/core/systems/OperationsManager";
import { POLICY_CHANGE_COOLDOWN_SOLS } from "../src/core/balance/OperationsBalance";

describe("Colony Policies", () => {
  let operations: OperationsManager;

  beforeEach(() => {
    operations = new OperationsManager();
  });

  test("initial policies are all standard", () => {
    const policies = operations.getPolicies();
    expect(policies.workIntensity).toBe("standard");
    expect(policies.resourcePriority).toBe("balanced");
    expect(policies.explorationStance).toBe("standard");
  });

  test("can change policy", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    expect(operations.getPolicies().workIntensity).toBe("crunch");
  });

  test("cannot change policy during cooldown", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    const result = operations.setPolicy("workIntensity", "relaxed", 5);
    expect(result).toBe(false);
    expect(operations.getPolicies().workIntensity).toBe("crunch");
  });

  test("can change policy after cooldown", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    const result = operations.setPolicy("workIntensity", "relaxed", POLICY_CHANGE_COOLDOWN_SOLS + 1);
    expect(result).toBe(true);
    expect(operations.getPolicies().workIntensity).toBe("relaxed");
  });

  test("getProductionMultiplier reflects work intensity", () => {
    operations.setPolicy("workIntensity", "crunch", 0);
    expect(operations.getProductionMultiplier()).toBe(1.2);

    operations.setPolicy("workIntensity", "relaxed", 20);
    expect(operations.getProductionMultiplier()).toBe(0.8);
  });
});
