// src/core/systems/workforce/socialGraph.ts
import type { CoworkerRelationship } from "./types";
import {
  WEAK_TIE_THRESHOLD,
  TEAM_COHESION_THRESHOLD,
  MAX_COWORKER_RELATIONSHIP,
  MAX_TEAM_COHESION_BONUS,
} from "../../balance/WorkforceBalance";

/**
 * Generate a canonical key for a pair of colonists (alphabetically sorted).
 * Pure function.
 */
export function getRelationshipKey(colonistId1: string, colonistId2: string): string {
  return colonistId1 < colonistId2
    ? `${colonistId1}:${colonistId2}`
    : `${colonistId2}:${colonistId1}`;
}

/**
 * Check if a relationship strength qualifies as a weak tie.
 * Weak ties are connections with strength > 0 but below WEAK_TIE_THRESHOLD.
 * Pure function.
 */
export function isWeakTie(strength: number): boolean {
  return strength > 0 && strength < WEAK_TIE_THRESHOLD;
}

/**
 * Calculate the clustering coefficient for a colonist.
 * Measures how connected their neighbors are to each other.
 *
 * Formula: C = 2 * actual_triangles / (degree * (degree - 1))
 * Range: 0 (no triangles) to 1 (all neighbors connected)
 *
 * Pure function.
 */
export function calculateClusteringCoefficient(
  colonistId: string,
  adjacencyList: Map<string, Set<string>>,
  relationships: Map<string, CoworkerRelationship>,
): number {
  const neighbors = adjacencyList.get(colonistId);
  if (!neighbors || neighbors.size < 2) return 0;

  const neighborArray = [...neighbors];
  const degree = neighborArray.length;

  // Count edges between neighbors (triangles)
  let triangleEdges = 0;
  for (let i = 0; i < neighborArray.length; i++) {
    for (let j = i + 1; j < neighborArray.length; j++) {
      const neighbor1 = neighborArray[i];
      const neighbor2 = neighborArray[j];
      if (neighbor1 === undefined || neighbor2 === undefined) continue;
      const key = getRelationshipKey(neighbor1, neighbor2);
      const relationship = relationships.get(key);
      if (relationship && relationship.strength > 0) {
        triangleEdges++;
      }
    }
  }

  // Maximum possible edges between neighbors
  const maxPossibleEdges = (degree * (degree - 1)) / 2;
  return triangleEdges / maxPossibleEdges;
}

/**
 * Calculate the bridging score for a colonist.
 * Higher score means they connect otherwise disconnected groups.
 * Pure function.
 */
export function calculateBridgingScore(
  colonistId: string,
  adjacencyList: Map<string, Set<string>>,
  getStrength: (id1: string, id2: string) => number,
): number {
  const connections = adjacencyList.get(colonistId);
  if (!connections || connections.size < 2) return 0;

  const connectionArray = [...connections];
  let bridgingPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < connectionArray.length; i++) {
    for (let j = i + 1; j < connectionArray.length; j++) {
      const conn1 = connectionArray[i];
      const conn2 = connectionArray[j];
      if (conn1 === undefined || conn2 === undefined) continue;
      totalPairs++;
      const strength = getStrength(conn1, conn2);
      if (strength < WEAK_TIE_THRESHOLD) {
        bridgingPairs++;
      }
    }
  }

  return totalPairs > 0 ? bridgingPairs / totalPairs : 0;
}

/**
 * Calculate team cohesion multiplier for a group of workers.
 * Returns 1.0 (no bonus) up to 1.0 + MAX_TEAM_COHESION_BONUS.
 * Pure function.
 */
export function calculateTeamCohesionMultiplier(
  workerIds: string[],
  getStrength: (id1: string, id2: string) => number,
): number {
  if (workerIds.length < 2) return 1.0;

  let totalStrength = 0;
  let pairCount = 0;

  for (let i = 0; i < workerIds.length; i++) {
    for (let j = i + 1; j < workerIds.length; j++) {
      const worker1 = workerIds[i];
      const worker2 = workerIds[j];
      if (worker1 === undefined || worker2 === undefined) continue;
      totalStrength += getStrength(worker1, worker2);
      pairCount++;
    }
  }

  if (pairCount === 0) return 1.0;

  const averageStrength = totalStrength / pairCount;
  if (averageStrength < TEAM_COHESION_THRESHOLD) return 1.0;

  const strengthAboveThreshold = averageStrength - TEAM_COHESION_THRESHOLD;
  const maxStrengthAboveThreshold = MAX_COWORKER_RELATIONSHIP - TEAM_COHESION_THRESHOLD;
  const bonusRatio = strengthAboveThreshold / maxStrengthAboveThreshold;

  return 1.0 + bonusRatio * MAX_TEAM_COHESION_BONUS;
}
