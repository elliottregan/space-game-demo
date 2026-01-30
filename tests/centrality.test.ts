// tests/centrality.test.ts
import { describe, it, expect } from "bun:test";
import { computeEigenvectorCentrality } from "../src/core/systems/workforce/centrality";

describe("computeEigenvectorCentrality", () => {
  it("returns equal centrality for isolated nodes", () => {
    const adjacencyList = new Map([
      ["a", new Set<string>()],
      ["b", new Set<string>()],
      ["c", new Set<string>()],
    ]);
    const getWeight = () => 0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    expect(result.get("a")).toBeCloseTo(1 / 3, 4);
    expect(result.get("b")).toBeCloseTo(1 / 3, 4);
    expect(result.get("c")).toBeCloseTo(1 / 3, 4);
  });

  it("identifies hub node with higher centrality", () => {
    // Graph where A bridges two clusters (B-C) and (D-E)
    // A is the central bridge node
    const adjacencyList = new Map([
      ["a", new Set(["b", "c", "d", "e"])],
      ["b", new Set(["a", "c"])],
      ["c", new Set(["a", "b"])],
      ["d", new Set(["a", "e"])],
      ["e", new Set(["a", "d"])],
    ]);
    const getWeight = () => 1.0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    // Hub A should have highest centrality (connected to all clusters)
    const hubCentrality = result.get("a")!;
    const clusterNodeCentrality = result.get("b")!;
    expect(hubCentrality).toBeGreaterThan(clusterNodeCentrality);
  });

  it("centrality sums to 1", () => {
    const adjacencyList = new Map([
      ["a", new Set(["b", "c"])],
      ["b", new Set(["a", "c"])],
      ["c", new Set(["a", "b"])],
    ]);
    const getWeight = () => 0.5;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    const sum = [...result.values()].reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it("respects edge weights", () => {
    // A strongly connected to B, weakly to C
    const adjacencyList = new Map([
      ["a", new Set(["b", "c"])],
      ["b", new Set(["a"])],
      ["c", new Set(["a"])],
    ]);
    const weights: Record<string, number> = {
      "a:b": 1.0,
      "b:a": 1.0,
      "a:c": 0.1,
      "c:a": 0.1,
    };
    const getWeight = (id1: string, id2: string) => {
      return weights[`${id1}:${id2}`] ?? weights[`${id2}:${id1}`] ?? 0;
    };

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    // B should have higher centrality than C (stronger connection to hub)
    expect(result.get("b")!).toBeGreaterThan(result.get("c")!);
  });

  it("handles empty graph", () => {
    const adjacencyList = new Map<string, Set<string>>();
    const getWeight = () => 0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    expect(result.size).toBe(0);
  });

  it("handles single node", () => {
    const adjacencyList = new Map([["a", new Set<string>()]]);
    const getWeight = () => 0;

    const result = computeEigenvectorCentrality(adjacencyList, getWeight);

    expect(result.get("a")).toBe(1.0);
  });
});
