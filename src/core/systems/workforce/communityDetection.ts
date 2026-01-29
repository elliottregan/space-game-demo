// src/core/systems/workforce/communityDetection.ts
import { rng } from "../../utils/random";
import type { SocialCommunity, CoworkerRelationship } from "./types";
import { getRelationshipKey } from "./socialGraph";

/**
 * Calculate the internal cohesion of a community.
 * Returns average relationship strength between community members.
 * Pure function.
 */
export function calculateCommunityCohesion(
  memberIds: string[],
  getStrength: (id1: string, id2: string) => number,
): number {
  if (memberIds.length < 2) return 0;

  let totalStrength = 0;
  let pairCount = 0;

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const member1 = memberIds[i];
      const member2 = memberIds[j];
      if (member1 === undefined || member2 === undefined) continue;
      totalStrength += getStrength(member1, member2);
      pairCount++;
    }
  }

  return pairCount > 0 ? totalStrength / pairCount : 0;
}

/**
 * Count connections from community members to colonists outside the community.
 * Pure function.
 */
export function countExternalConnections(
  memberIds: string[],
  allColonistIds: Set<string>,
  adjacencyList: Map<string, Set<string>>,
): number {
  const memberSet = new Set(memberIds);
  let externalCount = 0;

  for (const memberId of memberIds) {
    const neighbors = adjacencyList.get(memberId);
    if (!neighbors) continue;

    for (const neighborId of neighbors) {
      if (allColonistIds.has(neighborId) && !memberSet.has(neighborId)) {
        externalCount++;
      }
    }
  }

  return externalCount;
}

/**
 * Detect communities using weighted label propagation algorithm.
 * Each colonist adopts the most common label among their neighbors,
 * weighted by relationship strength.
 *
 * Pure function - takes all data as input.
 */
export function detectCommunities(
  colonistIds: string[],
  adjacencyList: Map<string, Set<string>>,
  relationships: Map<string, CoworkerRelationship>,
  maxIterations: number = 20,
  minCommunitySize: number = 2,
): SocialCommunity[] {
  if (colonistIds.length === 0) return [];

  // Initialize: each colonist starts in their own community
  const labels = new Map<string, string>();
  for (const id of colonistIds) {
    labels.set(id, id);
  }

  const colonistSet = new Set(colonistIds);

  // Helper to get relationship strength
  const getStrength = (id1: string, id2: string): number => {
    const key = getRelationshipKey(id1, id2);
    return relationships.get(key)?.strength ?? 0;
  };

  // Iterate until convergence or max iterations
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    let changed = false;

    // Process nodes in random order to avoid oscillation
    const shuffled = rng.shuffled(colonistIds);

    for (const colonistId of shuffled) {
      const neighbors = adjacencyList.get(colonistId);
      if (!neighbors || neighbors.size === 0) continue;

      // Count weighted votes for each label among neighbors
      const labelVotes = new Map<string, number>();

      for (const neighborId of neighbors) {
        if (!colonistSet.has(neighborId)) continue;

        const neighborLabel = labels.get(neighborId);
        if (!neighborLabel) continue;

        const weight = getStrength(colonistId, neighborId);
        labelVotes.set(neighborLabel, (labelVotes.get(neighborLabel) ?? 0) + weight);
      }

      // Find label with highest weighted vote
      let maxVotes = 0;
      let bestLabel = labels.get(colonistId) ?? colonistId;

      for (const [label, votes] of labelVotes) {
        if (votes > maxVotes) {
          maxVotes = votes;
          bestLabel = label;
        }
      }

      // Update label if changed
      if (labels.get(colonistId) !== bestLabel) {
        labels.set(colonistId, bestLabel);
        changed = true;
      }
    }

    if (!changed) break;
  }

  // Group colonists by their final labels
  const communities = new Map<string, string[]>();
  for (const [colonistId, label] of labels) {
    if (!communities.has(label)) {
      communities.set(label, []);
    }
    const community = communities.get(label);
    if (community) {
      community.push(colonistId);
    }
  }

  // Build community objects, merging small communities
  const result: SocialCommunity[] = [];
  let communityCounter = 1;
  const smallCommunityMembers: string[] = [];

  for (const [, memberIds] of communities) {
    if (memberIds.length < minCommunitySize) {
      smallCommunityMembers.push(...memberIds);
    } else {
      result.push({
        id: `community_${communityCounter++}`,
        memberIds,
        cohesion: calculateCommunityCohesion(memberIds, getStrength),
        externalConnections: countExternalConnections(memberIds, colonistSet, adjacencyList),
      });
    }
  }

  // Add small community members as a "misc" community if any
  if (smallCommunityMembers.length > 0) {
    result.push({
      id: `community_misc`,
      memberIds: smallCommunityMembers,
      cohesion: calculateCommunityCohesion(smallCommunityMembers, getStrength),
      externalConnections: countExternalConnections(
        smallCommunityMembers,
        colonistSet,
        adjacencyList,
      ),
    });
  }

  return result;
}
