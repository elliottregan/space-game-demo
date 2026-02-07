import { describe, it, expect } from "bun:test";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { POLICIES, getPolicy } from "../src/core/data/policies";

describe("Policy data", () => {
  it("has 6 policies covering all axes", () => {
    expect(POLICIES).toHaveLength(6);
    const axes = POLICIES.map((p) => p.axis);
    expect(axes.filter((a) => a === "solidarity")).toHaveLength(2);
    expect(axes.filter((a) => a === "sovereignty")).toHaveLength(2);
    expect(axes.filter((a) => a === "transformation")).toHaveLength(2);
  });

  it("each axis has one positive and one negative direction", () => {
    for (const axis of ["solidarity", "sovereignty", "transformation"] as const) {
      const axisPolicies = POLICIES.filter((p) => p.axis === axis);
      expect(axisPolicies.some((p) => p.direction > 0)).toBe(true);
      expect(axisPolicies.some((p) => p.direction < 0)).toBe(true);
    }
  });

  it("getPolicy returns correct policy by id", () => {
    const policy = getPolicy("rationing_protocol");
    expect(policy).toBeDefined();
    expect(policy?.name).toBe("Rationing Protocol");
  });

  it("getPolicy returns undefined for unknown id", () => {
    expect(getPolicy("nonexistent")).toBeUndefined();
  });
});

describe("IdeologyManager policy declarations", () => {
  it("declarePolicy activates a policy", () => {
    const manager = new IdeologyManager();
    const result = manager.declarePolicy("rationing_protocol", 100);
    expect(result).toBe(true);
    const active = manager.getActivePolicy();
    expect(active).not.toBeNull();
    expect(active?.policy.id).toBe("rationing_protocol");
    expect(active?.startSol).toBe(100);
  });

  it("declarePolicy returns false for unknown policy", () => {
    const manager = new IdeologyManager();
    expect(manager.declarePolicy("nonexistent", 100)).toBe(false);
    expect(manager.getActivePolicy()).toBeNull();
  });

  it("new policy replaces existing one", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("rationing_protocol", 100);
    manager.declarePolicy("free_market_decree", 110);
    const active = manager.getActivePolicy();
    expect(active?.policy.id).toBe("free_market_decree");
    expect(active?.startSol).toBe(110);
  });

  it("processActivePolicy applies pressure to all factions", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("rationing_protocol", 100);

    // Record initial pressure
    const factions = manager.getFactions();
    const initialPressures = factions.map((f) => f.pressure.solidarity);

    // Process policy
    manager.processActivePolicy(101);

    // All factions should have increased solidarity pressure
    for (let i = 0; i < factions.length; i++) {
      expect(factions[i].pressure.solidarity).toBeGreaterThan(initialPressures[i]);
    }
  });

  it("negative direction policy pushes pressure negative", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("free_market_decree", 100);
    manager.processActivePolicy(101);

    const factions = manager.getFactions();
    for (const faction of factions) {
      expect(faction.pressure.solidarity).toBeLessThan(0);
    }
  });

  it("policy expires after duration", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("rationing_protocol", 100);

    // Policy duration is 30 sols
    const events = manager.processActivePolicy(130);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("POLICY_EXPIRED");
    expect(manager.getActivePolicy()).toBeNull();
  });

  it("no events when policy is active and not expired", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("rationing_protocol", 100);
    const events = manager.processActivePolicy(110);
    expect(events).toHaveLength(0);
  });

  it("no events when no active policy", () => {
    const manager = new IdeologyManager();
    const events = manager.processActivePolicy(100);
    expect(events).toHaveLength(0);
  });

  it("cancelPolicy removes active policy", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("rationing_protocol", 100);
    manager.cancelPolicy();
    expect(manager.getActivePolicy()).toBeNull();
  });

  it("serializes and deserializes active policy", () => {
    const manager = new IdeologyManager();
    manager.declarePolicy("mars_self_sufficiency", 50);

    const json = manager.toJSON();
    const restored = IdeologyManager.fromJSON(json);

    const active = restored.getActivePolicy();
    expect(active).not.toBeNull();
    expect(active?.policy.id).toBe("mars_self_sufficiency");
    expect(active?.startSol).toBe(50);
  });
});
