// src/core/systems/workforce/centrality.ts

/**
 * Compute eigenvector centrality for a social graph.
 * Measures recursive influence: a node is central if connected to other central nodes.
 *
 * @param adjacencyList Map of node ID to set of neighbor IDs
 * @param getWeight Function returning edge weight between two nodes (0-1)
 * @param maxIterations Maximum power iterations for convergence
 * @param tolerance Convergence threshold
 * @returns Map of node ID to centrality score (sums to 1)
 */
export function computeEigenvectorCentrality(
  adjacencyList: Map<string, Set<string>>,
  getWeight: (id1: string, id2: string) => number,
  maxIterations: number = 20,
  tolerance: number = 0.0001,
): Map<string, number> {
  const ids = [...adjacencyList.keys()];
  const n = ids.length;

  if (n === 0) return new Map();
  if (n === 1) return new Map([[ids[0]!, 1.0]]);

  // Initialize all centralities to 1/n
  let centrality = new Map(ids.map((id) => [id, 1 / n]));

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Map<string, number>();
    let maxDelta = 0;

    for (const id of ids) {
      // Sum of neighbors' centrality × edge weight
      let sum = 0;
      const neighbors = adjacencyList.get(id);
      if (neighbors) {
        for (const neighborId of neighbors) {
          const weight = getWeight(id, neighborId);
          sum += (centrality.get(neighborId) ?? 0) * weight;
        }
      }
      next.set(id, sum);
    }

    // Normalize to sum to 1
    const total = [...next.values()].reduce((a, b) => a + b, 0);

    if (total === 0) {
      // No edges - return equal distribution
      return new Map(ids.map((id) => [id, 1 / n]));
    }

    for (const [id, val] of next) {
      const normalized = val / total;
      maxDelta = Math.max(maxDelta, Math.abs(normalized - (centrality.get(id) ?? 0)));
      next.set(id, normalized);
    }

    centrality = next;
    if (maxDelta < tolerance) break;
  }

  return centrality;
}
