// src/core/systems/IdeologyManager.ts

import type { Colonist, ColonistIdeology } from "../models/Colonist";
import {
  ProjectRequirementType,
  type AxisPosition,
  type FactionState,
  type Project,
  type ProjectId,
  AXIS_KEYS,
} from "../models/NPCInfluence";
import type { TechnologyTree } from "./TechnologyTree";
import type { BuildingManager } from "./BuildingManager";
import type { ColonyManager } from "./ColonyManager";
import type { ResourceManager } from "./ResourceManager";
import type { RelationshipManager } from "./RelationshipManager";
import * as IdeologyBalance from "../balance/IdeologyBalance";
import { DRIFT_TRIGGERS, type DriftContext } from "../data/factionDrift";
import { getFactionName } from "../data/factionNames";
import { type Policy, getPolicy } from "../data/policies";
import { getProject } from "../data/projects";
import type { ProjectQueries } from "../interfaces/Queries";
import type { GameEvent } from "../models/GameEvent";

/**
 * A council member selected from high-influence colonists.
 */
export interface CouncilMember {
  colonistId: string;
  name: string;
  centrality: number;
  conviction: number;
  /** Political influence score = centrality x conviction */
  influence: number;
  /** Nearest faction id (or null if neutral) */
  factionId: string | null;
}

/**
 * A project proposal awaiting council vote.
 */
export interface PendingProposal {
  projectId: ProjectId;
  factionId: string;
  proposedSol: number;
  voteSol: number;
}

/**
 * Result of a council vote on a project.
 */
export interface VoteResult {
  projectId: ProjectId;
  passed: boolean;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
}

/**
 * Compute Euclidean distance in 3D axis space.
 */
function axisDistance(a: AxisPosition, b: AxisPosition): number {
  const ds = a.solidarity - b.solidarity;
  const dv = a.sovereignty - b.sovereignty;
  const dt = a.transformation - b.transformation;
  return Math.sqrt(ds * ds + dv * dv + dt * dt);
}

/**
 * Extract the axis position from a colonist ideology.
 */
function ideologyToAxis(ideology: ColonistIdeology): AxisPosition {
  return {
    solidarity: ideology.solidarity,
    sovereignty: ideology.sovereignty,
    transformation: ideology.transformation,
  };
}

/**
 * Check whether a colonist is ideologically neutral (near the origin on all axes).
 */
function isNeutral(ideology: ColonistIdeology): boolean {
  return AXIS_KEYS.every(
    (axis) => Math.abs(ideology[axis]) <= IdeologyBalance.NEUTRAL_AXIS_THRESHOLD,
  );
}

/**
 * Manages colonist ideology, council selection, and faction support.
 * Ideology spreads through the social network similar to morale.
 */
export class IdeologyManager implements ProjectQueries {
  private council: CouncilMember[] = [];
  private lastCouncilUpdateSol: number = -1;
  private lastSpreadSol: number = -1;
  private completedProjects: Set<ProjectId> = new Set();
  private pendingProposals: Map<ProjectId, PendingProposal> = new Map();
  private failedProposals: Set<ProjectId> = new Set();
  private factions: FactionState[] = [];
  private activePolicy: { policy: Policy; startSol: number } | null = null;

  constructor() {
    this.factions = IdeologyBalance.STARTING_FACTION_POSITIONS.map((f) => ({
      id: f.baseId,
      baseId: f.baseId,
      name: f.name,
      position: { ...f.position },
      pressure: { solidarity: 0, sovereignty: 0, transformation: 0 },
    }));
  }

  // ============ Static Helpers ============

  /**
   * Find the faction nearest to a colonist's ideology in 3D axis space.
   * Returns null if the factions array is empty.
   */
  static getNearestFaction(
    ideology: ColonistIdeology,
    factions: readonly FactionState[],
  ): FactionState | null {
    if (factions.length === 0) return null;

    const pos = ideologyToAxis(ideology);
    let nearest: FactionState | null = null;
    let bestDist = Infinity;

    for (const faction of factions) {
      const dist = axisDistance(pos, faction.position);
      if (dist < bestDist) {
        bestDist = dist;
        nearest = faction;
      }
    }

    return nearest;
  }

  /**
   * Create a neutral ideology for new colonists.
   */
  static createNeutralIdeology(): ColonistIdeology {
    return { ...IdeologyBalance.NEW_COLONIST_IDEOLOGY };
  }

  /**
   * Imprint ideology on a new colonist based on their strongest connections.
   * This creates ideological clustering - new colonists adopt the beliefs
   * of whoever they're closest to (typically housemates/coworkers).
   */
  static imprintIdeologyFromNeighbors(
    colonist: Colonist,
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    imprinting: number = IdeologyBalance.IDEOLOGY_IMPRINTING_STRENGTH,
  ): void {
    if (!colonist.ideology) return;

    const neighbors = relationshipManager.getNeighbors(colonist.id);
    if (neighbors.size === 0) return;

    const colonistMap = new Map(colonists.map((c) => [c.id, c]));

    // Find the strongest connection with ideology
    let strongestNeighbor: Colonist | null = null;
    let strongestStrength = 0;

    for (const neighborId of neighbors) {
      const neighbor = colonistMap.get(neighborId);
      if (!neighbor?.ideology) continue;

      const strength = relationshipManager.getRelationshipStrength(colonist.id, neighborId);
      if (strength > strongestStrength) {
        strongestStrength = strength;
        strongestNeighbor = neighbor;
      }
    }

    if (
      !strongestNeighbor?.ideology ||
      strongestStrength < IdeologyBalance.IDEOLOGY_IMPRINTING_THRESHOLD
    ) {
      return;
    }

    const sourceIdeology = strongestNeighbor.ideology;

    // Blend toward the neighbor's ideology on all axes
    for (const axis of AXIS_KEYS) {
      colonist.ideology[axis] =
        colonist.ideology[axis] * (1 - imprinting) + sourceIdeology[axis] * imprinting;
      colonist.ideology[axis] = Math.max(-1, Math.min(1, colonist.ideology[axis]));
    }
  }

  // ============ Faction Access ============

  /**
   * Get all current factions.
   */
  getFactions(): readonly FactionState[] {
    return this.factions;
  }

  /**
   * Get a specific faction by id.
   */
  getFaction(id: string): FactionState | undefined {
    return this.factions.find((f) => f.id === id);
  }

  // ============ Faction Drift ============

  /**
   * Update faction pressure based on colony conditions.
   * Evaluates all drift triggers and applies to each faction's pressure.
   */
  updateFactionPressure(ctx: DriftContext): void {
    for (const trigger of DRIFT_TRIGGERS) {
      const delta = trigger.evaluate(ctx);
      if (delta === 0) continue;

      for (const faction of this.factions) {
        faction.pressure[trigger.axis] = Math.max(
          -1,
          Math.min(1, faction.pressure[trigger.axis] + delta),
        );
      }
    }
  }

  /**
   * Drift faction positions toward their accumulated pressure.
   * High average conviction among faction members dampens drift,
   * representing ideological inertia from committed supporters.
   */
  driftFactionPositions(colonists: Colonist[]): void {
    for (const faction of this.factions) {
      const avgConviction = this.getAverageFactionConviction(faction, colonists);
      const dampening = 1 - avgConviction * IdeologyBalance.FACTION_CONVICTION_DAMPENING;

      for (const axis of AXIS_KEYS) {
        const drift =
          (faction.pressure[axis] - faction.position[axis]) *
          IdeologyBalance.FACTION_DRIFT_RATE *
          dampening;

        faction.position[axis] = Math.max(-1, Math.min(1, faction.position[axis] + drift));
      }
    }
  }

  /**
   * Decay faction pressure toward zero.
   * Without reinforcement from colony conditions, pressure fades.
   */
  decayFactionPressure(): void {
    for (const faction of this.factions) {
      for (const axis of AXIS_KEYS) {
        const pressure = faction.pressure[axis];
        if (pressure > 0) {
          faction.pressure[axis] = Math.max(0, pressure - IdeologyBalance.FACTION_PRESSURE_DECAY);
        } else if (pressure < 0) {
          faction.pressure[axis] = Math.min(0, pressure + IdeologyBalance.FACTION_PRESSURE_DECAY);
        }
      }
    }
  }

  /**
   * Calculate average conviction of colonists nearest to a faction.
   */
  private getAverageFactionConviction(faction: FactionState, colonists: Colonist[]): number {
    let totalConviction = 0;
    let count = 0;

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const nearest = IdeologyManager.getNearestFaction(colonist.ideology, this.factions);
      if (nearest?.id === faction.id) {
        totalConviction += colonist.ideology.conviction;
        count++;
      }
    }

    if (count === 0) return 0;
    return totalConviction / count;
  }

  // ============ Faction Naming ============

  /**
   * Update faction names based on current axis positions.
   * Returns events for any name changes.
   */
  updateFactionNames(): GameEvent[] {
    const events: GameEvent[] = [];
    for (const faction of this.factions) {
      const newName = getFactionName(faction.baseId, faction.position);
      if (newName !== faction.name) {
        const oldName = faction.name;
        faction.name = newName;
        events.push({
          type: "FACTION_RENAMED",
          severity: "info",
          message: `${oldName} have reorganized as the ${newName}.`,
        });
      }
    }
    return events;
  }

  // ============ Council Selection ============

  /**
   * Select council members from colonists with highest political influence.
   * Political influence = centrality x conviction.
   */
  selectCouncil(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number,
  ): CouncilMember[] {
    const councilSize = Math.min(
      IdeologyBalance.COUNCIL_SIZE_MAX,
      Math.max(
        IdeologyBalance.COUNCIL_SIZE_MIN,
        Math.floor(colonists.length / IdeologyBalance.COUNCIL_SIZE_PER_POPULATION),
      ),
    );

    const candidates = colonists
      .filter((c): c is Colonist & { ideology: ColonistIdeology } => !!c.ideology)
      .map((colonist) => {
        const centrality = relationshipManager.getCentrality(colonist.id);
        const conviction = colonist.ideology.conviction;
        const influence = centrality * conviction;
        const nearest = IdeologyManager.getNearestFaction(colonist.ideology, this.factions);

        return {
          colonistId: colonist.id,
          name: colonist.name,
          centrality,
          conviction,
          influence,
          factionId: nearest?.baseId ?? null,
        };
      });

    this.council = candidates.sort((a, b) => b.influence - a.influence).slice(0, councilSize);
    this.lastCouncilUpdateSol = currentSol;
    return this.council;
  }

  /**
   * Update council if enough time has passed since last update.
   */
  updateCouncilIfStale(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number,
  ): void {
    if (
      this.lastCouncilUpdateSol < 0 ||
      currentSol - this.lastCouncilUpdateSol >= IdeologyBalance.COUNCIL_UPDATE_INTERVAL
    ) {
      relationshipManager.recalculateCentralityIfStale(
        currentSol,
        IdeologyBalance.COUNCIL_UPDATE_INTERVAL,
      );
      this.selectCouncil(colonists, relationshipManager, currentSol);
    }
  }

  /**
   * Get the current council members.
   */
  getCouncil(): readonly CouncilMember[] {
    return this.council;
  }

  /**
   * Get count of council seats by faction baseId.
   */
  getCouncilFactionCounts(): Record<string, number> {
    const counts: Record<string, number> = { neutral: 0 };

    for (const faction of this.factions) {
      counts[faction.baseId] = 0;
    }

    for (const member of this.council) {
      if (member.factionId) {
        counts[member.factionId] = (counts[member.factionId] ?? 0) + 1;
      } else {
        counts["neutral"] = (counts["neutral"] ?? 0) + 1;
      }
    }

    return counts;
  }

  // ============ Faction Support Calculation ============

  /**
   * Calculate colony-wide faction support levels based on axis-space distance.
   * Closer colonists contribute more support. Support is normalized to sum to 1.
   */
  calculateFactionSupport(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
  ): Record<string, number> {
    if (this.factions.length === 0) {
      return {};
    }

    const factionCloseness: Record<string, number> = {};
    for (const faction of this.factions) {
      factionCloseness[faction.id] = 0;
    }

    let totalCloseness = 0;

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const weight = relationshipManager.getCentrality(colonist.id) + 0.1;
      const pos = ideologyToAxis(colonist.ideology);

      for (const faction of this.factions) {
        const dist = axisDistance(pos, faction.position);
        const closeness = weight / (1 + dist);
        factionCloseness[faction.id] = (factionCloseness[faction.id] ?? 0) + closeness;
        totalCloseness += closeness;
      }
    }

    if (totalCloseness === 0) {
      const result: Record<string, number> = {};
      for (const faction of this.factions) {
        result[faction.id] = 0;
      }
      return result;
    }

    const result: Record<string, number> = {};
    for (const faction of this.factions) {
      result[faction.id] = (factionCloseness[faction.id] ?? 0) / totalCloseness;
    }
    return result;
  }

  // ============ Ideology Spread ============

  /**
   * Propagate ideology through the social network.
   * Each colonist's ideology drifts toward their neighbors' weighted average.
   */
  propagateIdeology(
    colonists: Colonist[],
    relationshipManager: RelationshipManager,
    currentSol: number,
  ): void {
    if (
      this.lastSpreadSol >= 0 &&
      currentSol - this.lastSpreadSol < IdeologyBalance.IDEOLOGY_SPREAD_INTERVAL
    ) {
      return;
    }

    this.lastSpreadSol = currentSol;

    const ideologicalColonists = colonists.filter(
      (c): c is Colonist & { ideology: ColonistIdeology } => !!c.ideology,
    );
    if (ideologicalColonists.length === 0) return;

    // Create snapshot to avoid order-dependent updates
    const ideologySnapshot = new Map<string, ColonistIdeology>(
      ideologicalColonists.map((c) => [c.id, { ...c.ideology }]),
    );

    for (const colonist of ideologicalColonists) {
      const ideology = colonist.ideology;
      const neighbors = relationshipManager.getNeighbors(colonist.id);
      if (neighbors.size === 0) continue;

      // Calculate weighted average of neighbor ideologies on each axis
      let totalWeight = 0;
      const avgInfluence: AxisPosition = { solidarity: 0, sovereignty: 0, transformation: 0 };

      for (const neighborId of neighbors) {
        const neighborIdeology = ideologySnapshot.get(neighborId);
        if (!neighborIdeology) continue;

        const relationshipStrength = relationshipManager.getRelationshipStrength(
          colonist.id,
          neighborId,
        );

        if (relationshipStrength < IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD) {
          continue;
        }

        const neighborCentrality = relationshipManager.getCentrality(neighborId);
        const neighborConviction = neighborIdeology.conviction;

        const weight = relationshipStrength ** 2 * (neighborCentrality + 0.1) * neighborConviction;
        totalWeight += weight;

        for (const axis of AXIS_KEYS) {
          avgInfluence[axis] += weight * neighborIdeology[axis];
        }
      }

      if (totalWeight === 0) continue;

      for (const axis of AXIS_KEYS) {
        avgInfluence[axis] /= totalWeight;
      }

      // Resistance based on own conviction
      const resistance = ideology.conviction * IdeologyBalance.CONVICTION_RESISTANCE_FACTOR;
      const effectiveRate = IdeologyBalance.IDEOLOGY_SPREAD_RATE * (1 - resistance);

      // Drift toward neighbor average
      for (const axis of AXIS_KEYS) {
        ideology[axis] += effectiveRate * (avgInfluence[axis] - ideology[axis]);
        ideology[axis] = Math.max(-1, Math.min(1, ideology[axis]));
      }
    }

    // Evolve conviction after ideology spread
    this.evolveConviction(ideologicalColonists, relationshipManager);
  }

  /**
   * Evolve conviction based on ideology pressure from neighbors.
   * Conviction grows when neighbors are close in axis space (within CONVICTION_SUPPORT_DISTANCE)
   * and decays when neighbors are distant.
   */
  private evolveConviction(colonists: Colonist[], relationshipManager: RelationshipManager): void {
    const colonistMap = new Map(colonists.map((c) => [c.id, c]));

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      // Natural decay applies to all colonists
      colonist.ideology.conviction = Math.max(
        IdeologyBalance.CONVICTION_MIN,
        colonist.ideology.conviction - IdeologyBalance.CONVICTION_NATURAL_DECAY,
      );

      const colonistIsNeutral = isNeutral(colonist.ideology);
      if (colonistIsNeutral) {
        this.evolveNeutralColonist(
          colonist as Colonist & { ideology: ColonistIdeology },
          colonistMap,
          relationshipManager,
        );
        continue;
      }

      const neighbors = relationshipManager.getNeighbors(colonist.id);
      if (neighbors.size === 0) {
        colonist.ideology.conviction = Math.max(
          IdeologyBalance.CONVICTION_MIN,
          colonist.ideology.conviction - IdeologyBalance.CONVICTION_DECAY_RATE,
        );
        continue;
      }

      // Calculate how many strong neighbors are close in axis space
      let totalWeight = 0;
      let supportWeight = 0;

      const colonistPos = ideologyToAxis(colonist.ideology);

      for (const neighborId of neighbors) {
        const relationshipStrength = relationshipManager.getRelationshipStrength(
          colonist.id,
          neighborId,
        );
        if (relationshipStrength < IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD) {
          continue;
        }

        const neighbor = colonistMap.get(neighborId);
        if (!neighbor?.ideology) continue;

        const neighborCentrality = relationshipManager.getCentrality(neighborId);
        const neighborConviction = neighbor.ideology.conviction;
        const weight = relationshipStrength ** 2 * (neighborCentrality + 0.1) * neighborConviction;
        totalWeight += weight;

        // Check proximity in axis space
        const neighborPos = ideologyToAxis(neighbor.ideology);
        const dist = axisDistance(colonistPos, neighborPos);
        if (dist <= IdeologyBalance.CONVICTION_SUPPORT_DISTANCE) {
          supportWeight += weight;
        }
      }

      if (totalWeight === 0) {
        colonist.ideology.conviction = Math.max(
          IdeologyBalance.CONVICTION_MIN,
          colonist.ideology.conviction - IdeologyBalance.CONVICTION_DECAY_RATE,
        );
        continue;
      }

      // Conviction grows when neighbors are close, decays when distant
      const supportRatio = supportWeight / totalWeight;
      const supportThreshold = 0.35;

      if (supportRatio >= supportThreshold) {
        const supportStrength = supportRatio - supportThreshold;
        const growth = IdeologyBalance.CONVICTION_GROWTH_RATE * (supportStrength * 2 + 0.2);
        colonist.ideology.conviction = Math.min(
          IdeologyBalance.CONVICTION_MAX,
          colonist.ideology.conviction + growth,
        );
      } else {
        const oppositionStrength = supportThreshold - supportRatio;
        const decay = IdeologyBalance.CONVICTION_DECAY_RATE + oppositionStrength * 0.1;
        colonist.ideology.conviction = Math.max(
          IdeologyBalance.CONVICTION_MIN,
          colonist.ideology.conviction - decay,
        );
      }
    }
  }

  /**
   * Neutral colonists (near origin on all axes) experience:
   * 1. Conviction decay - they become more open to influence over time
   * 2. Stronger ideology drift toward the dominant neighborhood faction
   */
  private evolveNeutralColonist(
    colonist: Colonist & { ideology: ColonistIdeology },
    colonistMap: Map<string, Colonist>,
    relationshipManager: RelationshipManager,
  ): void {
    colonist.ideology.conviction = Math.max(
      IdeologyBalance.CONVICTION_MIN,
      colonist.ideology.conviction - IdeologyBalance.CONVICTION_DECAY_RATE,
    );

    const neighbors = relationshipManager.getNeighbors(colonist.id);
    if (neighbors.size === 0) return;

    let totalWeight = 0;
    const avgNeighborIdeology: AxisPosition = { solidarity: 0, sovereignty: 0, transformation: 0 };

    for (const neighborId of neighbors) {
      const relationshipStrength = relationshipManager.getRelationshipStrength(
        colonist.id,
        neighborId,
      );
      if (relationshipStrength < IdeologyBalance.IDEOLOGY_SPREAD_CONNECTION_THRESHOLD) continue;

      const neighbor = colonistMap.get(neighborId);
      if (!neighbor?.ideology) continue;

      const neighborConviction = neighbor.ideology.conviction;
      const weight = relationshipStrength ** 2 * neighborConviction;
      totalWeight += weight;

      for (const axis of AXIS_KEYS) {
        avgNeighborIdeology[axis] += weight * neighbor.ideology[axis];
      }
    }

    if (totalWeight === 0) return;

    for (const axis of AXIS_KEYS) {
      avgNeighborIdeology[axis] /= totalWeight;
    }

    const driftRate = IdeologyBalance.NEUTRAL_IDEOLOGY_DRIFT_RATE;

    for (const axis of AXIS_KEYS) {
      colonist.ideology[axis] += driftRate * (avgNeighborIdeology[axis] - colonist.ideology[axis]);
      colonist.ideology[axis] = Math.max(-1, Math.min(1, colonist.ideology[axis]));
    }
  }

  // ============ Faction Rally ============

  /** Sol of last rally action */
  private lastRallySol = -Infinity;

  /**
   * Rally a faction: two effects that mirror old lobbying behavior.
   *
   * 1. Conviction boost: aligned colonists (nearest faction matches) get
   *    conviction boosted, making them more likely to become council members.
   * 2. Ideology nudge: ALL colonists get their ideology nudged slightly
   *    toward the target faction's position. Low-conviction colonists are
   *    more susceptible (inversely proportional to conviction).
   *    This converts uncommitted colonists over time, like political campaigning.
   *
   * Cooldown: RALLY_COOLDOWN_SOLS between rallies.
   * Returns the number of colonists affected.
   */
  rallyFaction(
    factionId: string,
    colonists: readonly { ideology?: ColonistIdeology }[],
    currentSol: number,
  ): number {
    const RALLY_COOLDOWN_SOLS = 2;
    const RALLY_CONVICTION_BOOST = 0.05;
    const RALLY_IDEOLOGY_NUDGE = 0.08; // per-axis nudge toward faction position

    if (currentSol - this.lastRallySol < RALLY_COOLDOWN_SOLS) return 0;
    this.lastRallySol = currentSol;

    const faction = this.factions.find((f) => f.id === factionId || f.baseId === factionId);
    if (!faction) return 0;

    let affected = 0;
    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      // Effect 1: Conviction boost for already-aligned colonists
      const nearest = IdeologyManager.getNearestFaction(colonist.ideology, this.factions);
      if (nearest?.id === factionId || nearest?.baseId === factionId) {
        colonist.ideology.conviction = Math.min(
          IdeologyBalance.CONVICTION_MAX,
          colonist.ideology.conviction + RALLY_CONVICTION_BOOST,
        );
      }

      // Effect 2: Nudge ALL colonists' ideology toward faction position.
      // Low-conviction colonists are more susceptible (1 - conviction * 0.5).
      const susceptibility = 1 - colonist.ideology.conviction * 0.5;
      const nudge = RALLY_IDEOLOGY_NUDGE * susceptibility;
      for (const axis of AXIS_KEYS) {
        const diff = faction.position[axis] - colonist.ideology[axis];
        colonist.ideology[axis] = Math.max(-1, Math.min(1, colonist.ideology[axis] + diff * nudge));
      }

      affected++;
    }
    return affected;
  }

  /**
   * Check if a rally action is available (not on cooldown).
   */
  canRally(currentSol: number): boolean {
    const RALLY_COOLDOWN_SOLS = 2;
    return currentSol - this.lastRallySol >= RALLY_COOLDOWN_SOLS;
  }

  // ============ Policy Declarations ============

  /**
   * Declare a policy, replacing any existing one.
   * Returns false if policy not found.
   */
  declarePolicy(policyId: string, currentSol: number): boolean {
    const policy = getPolicy(policyId);
    if (!policy) return false;
    this.activePolicy = { policy, startSol: currentSol };
    return true;
  }

  /**
   * Get the currently active policy, or null.
   */
  getActivePolicy(): { policy: Policy; startSol: number } | null {
    return this.activePolicy;
  }

  /**
   * Process active policy effects: apply pressure and check expiry.
   * Returns events for policy expiry.
   */
  processActivePolicy(
    currentSol: number,
    colonists?: readonly { ideology?: ColonistIdeology }[],
  ): GameEvent[] {
    if (!this.activePolicy) return [];

    const { policy, startSol } = this.activePolicy;
    const elapsed = currentSol - startSol;

    // Check expiry
    if (elapsed >= policy.duration) {
      this.activePolicy = null;
      return [
        {
          type: "POLICY_EXPIRED",
          severity: "info",
          message: `Policy "${policy.name}" has expired after ${policy.duration} sols.`,
        },
      ];
    }

    // Apply pressure: the policy pushes the specified axis in the specified direction
    const pressureDelta = policy.strength * policy.direction;
    for (const faction of this.factions) {
      faction.pressure[policy.axis] = Math.max(
        -1,
        Math.min(1, faction.pressure[policy.axis] + pressureDelta),
      );
    }

    // Active policies also rally conviction: colonists aligned with the policy's
    // direction get a small conviction boost. This simulates the policy creating
    // political engagement and strengthening aligned colonists' council presence.
    if (colonists) {
      const POLICY_CONVICTION_BOOST = 0.005;
      for (const colonist of colonists) {
        if (!colonist.ideology) continue;
        // Check if colonist's axis value aligns with the policy direction
        const colonistValue = colonist.ideology[policy.axis];
        const aligns = policy.direction > 0 ? colonistValue > 0 : colonistValue < 0;
        if (aligns) {
          colonist.ideology.conviction = Math.min(
            IdeologyBalance.CONVICTION_MAX,
            colonist.ideology.conviction + POLICY_CONVICTION_BOOST,
          );
        }
      }
    }

    return [];
  }

  /**
   * Cancel the active policy.
   */
  cancelPolicy(): void {
    this.activePolicy = null;
  }

  // ============ Projects ============

  /**
   * Check if a project has been completed.
   */
  isProjectCompleted(projectId: ProjectId): boolean {
    return this.completedProjects.has(projectId);
  }

  /**
   * Mark a project as completed.
   * Returns a PROJECT_COMPLETED event.
   */
  completeProject(projectId: ProjectId): GameEvent[] {
    this.completedProjects.add(projectId);
    const project = getProject(projectId);
    return [
      {
        type: "PROJECT_COMPLETED",
        projectId,
        projectName: project?.name ?? projectId,
        severity: "info",
        message: `Project completed: ${project?.name ?? projectId}`,
      },
    ];
  }

  /**
   * Get list of completed project IDs.
   */
  getCompletedProjects(): readonly ProjectId[] {
    return [...this.completedProjects];
  }

  /**
   * Submit a project proposal for council vote.
   */
  submitProposal(projectId: ProjectId, factionId: string, currentSol: number): boolean {
    if (
      this.pendingProposals.has(projectId) ||
      this.completedProjects.has(projectId) ||
      this.failedProposals.has(projectId)
    ) {
      return false;
    }

    this.pendingProposals.set(projectId, {
      projectId,
      factionId,
      proposedSol: currentSol,
      voteSol: currentSol + IdeologyBalance.PROJECT_VOTING_PERIOD,
    });

    return true;
  }

  /**
   * Check if a project is pending vote.
   */
  isPendingProposal(projectId: ProjectId): boolean {
    return this.pendingProposals.has(projectId);
  }

  /**
   * Check if a project has failed a vote.
   */
  isFailedProposal(projectId: ProjectId): boolean {
    return this.failedProposals.has(projectId);
  }

  /**
   * Get all pending proposals.
   */
  getPendingProposals(): readonly PendingProposal[] {
    return [...this.pendingProposals.values()];
  }

  /**
   * Get a specific pending proposal.
   */
  getPendingProposal(projectId: ProjectId): PendingProposal | undefined {
    return this.pendingProposals.get(projectId);
  }

  /**
   * Preview what the vote outcome would be for a faction.
   * Counts council members whose nearest faction matches the given factionId.
   */
  getVoteProjection(factionId: string): {
    votesFor: number;
    votesAgainst: number;
    wouldPass: boolean;
  } {
    const counts = this.getCouncilFactionCounts();
    const votesFor = counts[factionId] ?? 0;
    const totalVotes = this.council.length;
    const votesAgainst = totalVotes - votesFor;
    const wouldPass = votesFor > votesAgainst;

    return { votesFor, votesAgainst, wouldPass };
  }

  /**
   * Process votes for proposals that have reached their vote sol.
   */
  processVotes(currentSol: number): VoteResult[] {
    const results: VoteResult[] = [];

    for (const [projectId, proposal] of this.pendingProposals) {
      if (currentSol >= proposal.voteSol) {
        const projection = this.getVoteProjection(proposal.factionId);

        const result: VoteResult = {
          projectId,
          passed: projection.wouldPass,
          votesFor: projection.votesFor,
          votesAgainst: projection.votesAgainst,
          totalVotes: this.council.length,
        };

        results.push(result);
        this.pendingProposals.delete(projectId);

        if (result.passed) {
          this.completedProjects.add(projectId);
        } else {
          this.failedProposals.add(projectId);
        }
      }
    }

    return results;
  }

  /**
   * Clear a failed proposal so it can be proposed again.
   */
  clearFailedProposal(projectId: ProjectId): void {
    this.failedProposals.delete(projectId);
  }

  /**
   * Get list of failed project IDs.
   */
  getFailedProposals(): readonly ProjectId[] {
    return [...this.failedProposals];
  }

  /**
   * Check if a project can be proposed based on its requirements and axis gating.
   */
  canProposeProject(
    project: Project,
    factionId: string,
    context: {
      technology?: TechnologyTree;
      buildings?: BuildingManager;
      colony?: ColonyManager;
      resources?: ResourceManager;
    },
  ): { canPropose: boolean; reason?: string } {
    if (this.completedProjects.has(project.id)) {
      return { canPropose: false, reason: "Project already completed" };
    }
    if (this.pendingProposals.has(project.id)) {
      return { canPropose: false, reason: "Project already pending vote" };
    }
    if (this.failedProposals.has(project.id)) {
      return { canPropose: false, reason: "Project previously failed (must clear first)" };
    }

    // Check axis requirements against proposing faction's position
    if (project.axisRequirements) {
      const faction = this.getFaction(factionId);
      if (!faction) {
        return { canPropose: false, reason: "Faction not found" };
      }

      for (const [axis, req] of Object.entries(project.axisRequirements)) {
        const value = faction.position[axis as keyof AxisPosition];
        if (req.min !== undefined && value < req.min) {
          return {
            canPropose: false,
            reason: `${axis} position too low (${value.toFixed(2)} < ${req.min})`,
          };
        }
        if (req.max !== undefined && value > req.max) {
          return {
            canPropose: false,
            reason: `${axis} position too high (${value.toFixed(2)} > ${req.max})`,
          };
        }
      }
    }

    const prerequisites = project.prerequisites ?? [];
    for (const prereq of prerequisites) {
      if (!this.completedProjects.has(prereq)) {
        return { canPropose: false, reason: `Prerequisite project not completed: ${prereq}` };
      }
    }

    const requirements = project.requirements ?? [];
    for (const req of requirements) {
      switch (req.type) {
        case ProjectRequirementType.TECHNOLOGY: {
          if (!context.technology) {
            return { canPropose: false, reason: "Cannot verify technology requirements" };
          }
          if (!context.technology.isResearched(req.techId)) {
            return { canPropose: false, reason: `Technology not researched: ${req.techId}` };
          }
          break;
        }
        case ProjectRequirementType.BUILDING: {
          if (!context.buildings) {
            return { canPropose: false, reason: "Cannot verify building requirements" };
          }
          const buildingCount = context.buildings.getBuildingsByDefinition(req.buildingId).length;
          const requiredCount = req.count ?? 1;
          if (buildingCount < requiredCount) {
            return {
              canPropose: false,
              reason: `Insufficient buildings: need ${requiredCount} ${req.buildingId}, have ${buildingCount}`,
            };
          }
          break;
        }
        case ProjectRequirementType.POPULATION: {
          if (!context.colony) {
            return { canPropose: false, reason: "Cannot verify population requirements" };
          }
          const population = context.colony.getPopulation();
          if (population < req.min) {
            return {
              canPropose: false,
              reason: `Insufficient population: need ${req.min}, have ${population}`,
            };
          }
          break;
        }
        case ProjectRequirementType.RESOURCE: {
          if (!context.resources) {
            return { canPropose: false, reason: "Cannot verify resource requirements" };
          }
          const resourceAmount = context.resources.getResources()[req.resource];
          if (resourceAmount < req.min) {
            return {
              canPropose: false,
              reason: `Insufficient ${req.resource}: need ${req.min}, have ${resourceAmount}`,
            };
          }
          break;
        }
      }
    }

    return { canPropose: true };
  }

  // ============ Capstone Projects ============

  /**
   * Check if a project is a capstone victory project.
   */
  isCapstoneProject(projectId: ProjectId): boolean {
    const project = getProject(projectId);
    return project?.isCapstone === true;
  }

  // ============ Faction Dynamics ============

  /**
   * Detect colonist defections: a colonist "defects" when a non-nearest faction
   * is nearly as close as the nearest faction. Specifically, defection triggers
   * when the distance gap (otherDist - nearestDist) is less than the threshold.
   * High conviction resists defection by multiplying the gap by (1 + conviction),
   * requiring closer proximity to trigger.
   */
  processDefections(colonists: Colonist[]): GameEvent[] {
    const events: GameEvent[] = [];

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const pos = ideologyToAxis(colonist.ideology);
      const nearest = IdeologyManager.getNearestFaction(colonist.ideology, this.factions);
      if (!nearest) continue;

      const nearestDist = axisDistance(pos, nearest.position);
      const convictionMultiplier = 1 + colonist.ideology.conviction;

      for (const faction of this.factions) {
        if (faction.id === nearest.id) continue;

        const otherDist = axisDistance(pos, faction.position);
        const gap = (otherDist - nearestDist) * convictionMultiplier;

        if (gap < IdeologyBalance.DEFECTION_DISTANCE_THRESHOLD) {
          events.push({
            type: "COLONIST_DEFECTION",
            severity: "warning",
            message: `${colonist.name} is drifting toward ${faction.name}.`,
            colonistId: colonist.id,
            fromFactionId: nearest.id,
            toFactionId: faction.id,
          });
          break;
        }
      }
    }

    return events;
  }

  /**
   * If two factions converge within FACTION_CONVERGENCE_THRESHOLD on all axes,
   * merge the smaller into the larger. The smaller faction is reborn at an
   * underrepresented position in axis space to maintain exactly 3 factions.
   */
  checkFactionMerger(): GameEvent[] {
    const events: GameEvent[] = [];

    for (let i = 0; i < this.factions.length; i++) {
      for (let j = i + 1; j < this.factions.length; j++) {
        const a = this.factions[i]!;
        const b = this.factions[j]!;
        const dist = axisDistance(a.position, b.position);

        if (dist >= IdeologyBalance.FACTION_CONVERGENCE_THRESHOLD) continue;

        // Determine which faction is smaller (by index position as proxy;
        // actual member count requires colonists, so we pick 'b' as the
        // one to rebirth since it appears later). Callers needing member-count
        // based ordering should pass colonists; for now we rebirth the second.
        const survivor = a;
        const absorbed = b;

        events.push({
          type: "FACTION_MERGER",
          severity: "warning",
          message: `${absorbed.name} has been absorbed into ${survivor.name}.`,
          survivorId: survivor.id,
          absorbedId: absorbed.id,
        });

        this.rebirthFaction(absorbed);

        events.push({
          type: "FACTION_REBIRTH",
          severity: "info",
          message: `A new movement emerges: ${absorbed.name}.`,
          factionId: absorbed.id,
          baseId: absorbed.baseId,
        });

        return events;
      }
    }

    return events;
  }

  /**
   * If any faction has fewer than FACTION_COLLAPSE_POPULATION_RATIO of total
   * colonists as nearest supporters, collapse and rebirth it.
   * Always maintains exactly 3 factions.
   */
  checkFactionCollapse(colonists: Colonist[]): GameEvent[] {
    const events: GameEvent[] = [];
    const totalWithIdeology = colonists.filter((c) => c.ideology).length;
    if (totalWithIdeology === 0) return events;

    const factionCounts = new Map<string, number>();
    for (const faction of this.factions) {
      factionCounts.set(faction.id, 0);
    }

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;
      const nearest = IdeologyManager.getNearestFaction(colonist.ideology, this.factions);
      if (nearest) {
        factionCounts.set(nearest.id, (factionCounts.get(nearest.id) ?? 0) + 1);
      }
    }

    for (const faction of this.factions) {
      const count = factionCounts.get(faction.id) ?? 0;
      const ratio = count / totalWithIdeology;

      if (ratio >= IdeologyBalance.FACTION_COLLAPSE_POPULATION_RATIO) continue;

      events.push({
        type: "FACTION_COLLAPSE",
        severity: "warning",
        message: `${faction.name} has collapsed due to lack of support.`,
        factionId: faction.id,
        baseId: faction.baseId,
      });

      this.rebirthFaction(faction);

      events.push({
        type: "FACTION_REBIRTH",
        severity: "info",
        message: `A new movement emerges: ${faction.name}.`,
        factionId: faction.id,
        baseId: faction.baseId,
      });
    }

    return events;
  }

  /**
   * Rebirth a faction at an underrepresented position in axis space.
   * Generates a new unique id, resets pressure, and assigns a new name.
   */
  private rebirthFaction(faction: FactionState): void {
    faction.id = `${faction.baseId}_v${Date.now()}`;
    faction.position = this.findUnderrepresentedPosition();
    faction.pressure = { solidarity: 0, sovereignty: 0, transformation: 0 };
    faction.name = getFactionName(faction.baseId, faction.position);
  }

  /**
   * Find a position in axis space that maximizes minimum distance to all
   * existing factions. Evaluates a grid of candidate positions in [-1, 1]^3.
   */
  private findUnderrepresentedPosition(): AxisPosition {
    const steps = 5;
    let bestPosition: AxisPosition = { solidarity: 0, sovereignty: 0, transformation: 0 };
    let bestMinDist = -Infinity;

    for (let si = 0; si <= steps; si++) {
      for (let vi = 0; vi <= steps; vi++) {
        for (let ti = 0; ti <= steps; ti++) {
          const candidate: AxisPosition = {
            solidarity: -1 + (2 * si) / steps,
            sovereignty: -1 + (2 * vi) / steps,
            transformation: -1 + (2 * ti) / steps,
          };

          let minDist = Infinity;
          for (const faction of this.factions) {
            const dist = axisDistance(candidate, faction.position);
            if (dist < minDist) {
              minDist = dist;
            }
          }

          if (minDist > bestMinDist) {
            bestMinDist = minDist;
            bestPosition = candidate;
          }
        }
      }
    }

    return bestPosition;
  }

  // ============ Serialization ============

  toJSON(): {
    council: CouncilMember[];
    lastCouncilUpdateSol: number;
    lastSpreadSol: number;
    completedProjects: ProjectId[];
    pendingProposals: PendingProposal[];
    failedProposals: ProjectId[];
    factions: FactionState[];
    activePolicy: { policy: Policy; startSol: number } | null;
  } {
    return {
      council: this.council,
      lastCouncilUpdateSol: this.lastCouncilUpdateSol,
      lastSpreadSol: this.lastSpreadSol,
      completedProjects: [...this.completedProjects],
      pendingProposals: [...this.pendingProposals.values()],
      failedProposals: [...this.failedProposals],
      factions: this.factions,
      activePolicy: this.activePolicy,
    };
  }

  static fromJSON(data: ReturnType<IdeologyManager["toJSON"]>): IdeologyManager {
    const manager = new IdeologyManager();
    if (data.council) manager.council = data.council;
    if (data.lastCouncilUpdateSol !== undefined)
      manager.lastCouncilUpdateSol = data.lastCouncilUpdateSol;
    if (data.lastSpreadSol !== undefined) manager.lastSpreadSol = data.lastSpreadSol;
    if (data.completedProjects) {
      manager.completedProjects = new Set(data.completedProjects);
    }
    if (data.pendingProposals) {
      manager.pendingProposals = new Map(data.pendingProposals.map((p) => [p.projectId, p]));
    }
    if (data.failedProposals) {
      manager.failedProposals = new Set(data.failedProposals);
    }
    if (data.factions) {
      manager.factions = data.factions;
    }
    if (data.activePolicy) {
      manager.activePolicy = data.activePolicy;
    }
    return manager;
  }
}
