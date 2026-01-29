import {
  BASE_CONNECTION_PROBABILITY,
  BRIDGE_COLONIST_BONUS,
  COHORT_BONDING_MULTIPLIER,
  COHORT_INITIAL_BONUS,
  COHORT_WINDOW_SOLS,
  COWORKER_BONDING_RATE,
  COWORKER_RELATIONSHIP_DECAY,
  EXPERIENCE_GAIN_RATE,
  GUILD_BONDING_MULTIPLIER,
  GUILD_INITIAL_RELATIONSHIP_BONUS,
  HOUSEMATE_BONDING_RATE,
  INITIAL_COWORKER_RELATIONSHIP,
  INITIAL_HOUSEMATE_RELATIONSHIP,
  MASTER_EVENT_CHANCE,
  MASTERY_EFFICIENCY,
  MASTERY_THRESHOLDS,
  MAX_CONNECTION_PROBABILITY,
  MAX_COWORKER_RELATIONSHIP,
  MAX_GUILD_MEMBERSHIPS,
  MAX_GUILD_SIZE,
  MAX_SKILL_EFFICIENCY_BONUS,
  MAX_TEAM_COHESION_BONUS,
  MIN_COWORKER_RELATIONSHIP,
  MIN_GUILD_SIZE,
  PREFERENTIAL_ATTACHMENT_FACTOR,
  PREFERENTIAL_ATTACHMENT_THRESHOLD,
  ROLE_AFFINITY,
  TEAM_COHESION_THRESHOLD,
  WEAK_TIE_THRESHOLD,
} from "../balance/WorkforceBalance";
import { SKILLS } from "../data/skills";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { GameEvent } from "../models/GameEvent";
import { type Guild, GuildType } from "../models/Guild";
import type { BuildingManager } from "./BuildingManager";
import type { ColonyManager } from "./ColonyManager";

/**
 * Tracks a relationship between two colonists.
 */
export interface CoworkerRelationship {
  /** Strength of the relationship (0-1) */
  strength: number;
  /** Sol when they first worked together */
  formedAt: number;
  /** Sol when they last worked together */
  lastWorkedTogether: number;
  /** Whether this is a cohort relationship (arrived together) */
  isCohort?: boolean;
  /** Whether they share a guild */
  sharedGuildIds?: string[];
}

/**
 * Information about a colonist's social position in the network.
 */
export interface SocialNetworkPosition {
  /** Number of connections this colonist has */
  connectionCount: number;
  /** Average strength of their connections */
  averageStrength: number;
  /** Number of weak ties (bridges to other groups) */
  weakTieCount: number;
  /** Bridging score - how much they connect otherwise separate groups */
  bridgingScore: number;
}

export class WorkforceManager {
  /** Tracks relationships between colonists (key: "colonistId1:colonistId2" sorted alphabetically) */
  private coworkerRelationships: Map<string, CoworkerRelationship> = new Map();

  /** Guilds in the colony */
  private guilds: Map<string, Guild> = new Map();

  /** Counter for generating guild IDs */
  private nextGuildId: number = 1;

  tick(colony: ColonyManager, buildings?: BuildingManager, currentSol: number = 0): GameEvent[] {
    const events: GameEvent[] = [];
    const colonists = colony.getColonists();

    // Process coworker and housemate bonding
    if (buildings) {
      events.push(...this.processCoworkerBonding(buildings, currentSol));
      events.push(...this.processHousemateBonding(colonists, currentSol));
    }

    // Process guild bonding
    events.push(...this.processGuildBonding(colonists, currentSol));

    // Process preferential attachment (random new connections)
    events.push(...this.processPreferentialAttachment(colonists, currentSol));

    for (const colonist of colonists) {
      // Handle training
      if (colonist.trainingTarget && colonist.trainingProgress !== undefined) {
        colonist.trainingProgress++;
        const requiredTime = this.getTrainingTime(colonist.role, colonist.trainingTarget);

        if (colonist.trainingProgress >= requiredTime) {
          const oldRole = colonist.role;
          colonist.role = colonist.trainingTarget;
          colonist.trainingTarget = undefined;
          colonist.trainingProgress = undefined;
          colonist.experience = 0;
          colonist.masteryLevel = MasteryLevel.NOVICE;

          events.push({
            type: "TRAINING_COMPLETE",
            colonistId: colonist.id,
            colonistName: colonist.name,
            oldRole,
            newRole: colonist.role,
            severity: "info",
            message: `${colonist.name} is now trained as ${this.getRoleName(colonist.role)}!`,
          });
        }
      }

      // Handle experience gain for working colonists
      if (colonist.role !== ColonistRole.UNASSIGNED && !colonist.trainingTarget) {
        colonist.experience += EXPERIENCE_GAIN_RATE;

        // Check for mastery level up
        const newLevel = this.calculateMasteryLevel(colonist.experience);
        if (newLevel > colonist.masteryLevel) {
          colonist.masteryLevel = newLevel;
          events.push({
            type: "MASTERY_GAINED",
            colonistId: colonist.id,
            colonistName: colonist.name,
            role: colonist.role,
            newLevel: this.getMasteryName(newLevel),
            severity: "info",
            message: `${colonist.name} is now a ${this.getMasteryName(newLevel)} ${this.getRoleName(colonist.role)}!`,
          });
        }

        // Master event chance
        if (colonist.masteryLevel === MasteryLevel.MASTER && Math.random() < MASTER_EVENT_CHANCE) {
          events.push({
            type: "MASTER_BREAKTHROUGH",
            colonistId: colonist.id,
            colonistName: colonist.name,
            role: colonist.role,
            severity: "info",
            message: `${colonist.name} made a breakthrough in ${this.getRoleName(colonist.role)}!`,
          });
        }
      }
    }

    return events;
  }

  startTraining(colonist: Colonist, targetRole: ColonistRole): boolean {
    if (colonist.role === targetRole) return false;
    if (colonist.trainingTarget) return false;
    if (targetRole === ColonistRole.UNASSIGNED) return false;

    colonist.trainingTarget = targetRole;
    colonist.trainingProgress = 0;
    return true;
  }

  cancelTraining(colonist: Colonist): void {
    colonist.trainingTarget = undefined;
    colonist.trainingProgress = undefined;
  }

  getTrainingTime(currentRole: ColonistRole, targetRole: ColonistRole): number {
    const affinities = ROLE_AFFINITY[currentRole];
    return affinities?.[targetRole] || 10;
  }

  calculateMasteryLevel(experience: number): MasteryLevel {
    if (experience >= MASTERY_THRESHOLDS.MASTER) return MasteryLevel.MASTER;
    if (experience >= MASTERY_THRESHOLDS.EXPERT) return MasteryLevel.EXPERT;
    if (experience >= MASTERY_THRESHOLDS.SKILLED) return MasteryLevel.SKILLED;
    return MasteryLevel.NOVICE;
  }

  getRoleName(role: ColonistRole): string {
    switch (role) {
      case ColonistRole.UNASSIGNED:
        return "Unassigned";
      case ColonistRole.RESEARCH:
        return "Researcher";
      case ColonistRole.ENGINEERING:
        return "Engineer";
      case ColonistRole.CIVIL_SCIENCE:
        return "Civil Scientist";
      case ColonistRole.FARMING:
        return "Farmer";
    }
  }

  getMasteryName(level: MasteryLevel): string {
    switch (level) {
      case MasteryLevel.NOVICE:
        return "Novice";
      case MasteryLevel.SKILLED:
        return "Skilled";
      case MasteryLevel.EXPERT:
        return "Expert";
      case MasteryLevel.MASTER:
        return "Master";
    }
  }

  getWorkforceStats(colony: ColonyManager): Record<ColonistRole, number> {
    const stats: Record<ColonistRole, number> = {
      [ColonistRole.UNASSIGNED]: 0,
      [ColonistRole.RESEARCH]: 0,
      [ColonistRole.ENGINEERING]: 0,
      [ColonistRole.CIVIL_SCIENCE]: 0,
      [ColonistRole.FARMING]: 0,
    };

    for (const colonist of colony.getColonists()) {
      stats[colonist.role]++;
    }

    return stats;
  }

  /**
   * Calculate the total efficiency multiplier for a colonist.
   * Combines mastery level bonus with skill bonuses (capped).
   */
  getColonistEfficiency(colonist: Colonist): number {
    const masteryEfficiency = MASTERY_EFFICIENCY[colonist.masteryLevel];

    let skillBonus = 0;
    for (const skillId of colonist.skills) {
      const skill = SKILLS.find((s) => s.id === skillId);
      if (skill?.affinity.includes(colonist.role)) {
        skillBonus += skill.efficiencyBonus;
      }
    }

    // Cap skill bonus
    skillBonus = Math.min(skillBonus, MAX_SKILL_EFFICIENCY_BONUS);

    return (masteryEfficiency ?? 1.0) + skillBonus;
  }

  /**
   * Find the building where a colonist is assigned to work.
   * Returns undefined if colonist is not assigned to any building.
   */
  getColonistWorkplace(colonistId: string, buildings: BuildingManager): string | undefined {
    for (const building of buildings.getBuildings()) {
      if (building.assignedWorkers.includes(colonistId)) {
        return building.id;
      }
    }
    return undefined;
  }

  // ============ Coworker Relationship System ============

  /**
   * Generate a canonical key for a pair of colonists (alphabetically sorted).
   */
  private getRelationshipKey(colonistId1: string, colonistId2: string): string {
    return colonistId1 < colonistId2
      ? `${colonistId1}:${colonistId2}`
      : `${colonistId2}:${colonistId1}`;
  }

  /**
   * Get the relationship between two colonists.
   * Returns undefined if they have never worked together.
   */
  getCoworkerRelationship(colonistId1: string, colonistId2: string): CoworkerRelationship | undefined {
    const key = this.getRelationshipKey(colonistId1, colonistId2);
    return this.coworkerRelationships.get(key);
  }

  /**
   * Get the relationship strength between two colonists (0 if no relationship).
   */
  getCoworkerRelationshipStrength(colonistId1: string, colonistId2: string): number {
    const relationship = this.getCoworkerRelationship(colonistId1, colonistId2);
    return relationship?.strength ?? 0;
  }

  /**
   * Process coworker bonding for all buildings.
   * Colonists working together in the same building develop stronger relationships.
   */
  private processCoworkerBonding(buildings: BuildingManager, currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const currentCoworkerPairs = new Set<string>();

    // For each building, bond colonists who work together
    for (const building of buildings.getBuildings()) {
      if (building.status !== "active" || building.assignedWorkers.length < 2) continue;

      // Create/strengthen bonds between all pairs of coworkers
      for (let i = 0; i < building.assignedWorkers.length; i++) {
        const colonistA = building.assignedWorkers[i];
        if (!colonistA) continue;

        for (let j = i + 1; j < building.assignedWorkers.length; j++) {
          const colonistB = building.assignedWorkers[j];
          if (!colonistB) continue;

          const key = this.getRelationshipKey(colonistA, colonistB);
          currentCoworkerPairs.add(key);

          let relationship = this.coworkerRelationships.get(key);

          if (!relationship) {
            // First time working together
            relationship = {
              strength: INITIAL_COWORKER_RELATIONSHIP,
              formedAt: currentSol,
              lastWorkedTogether: currentSol,
            };
            this.coworkerRelationships.set(key, relationship);

            events.push({
              type: "COWORKER_BOND_FORMED",
              severity: "info",
              colonistA,
              colonistB,
              buildingId: building.id,
              message: `New coworker bond formed at ${building.id}`,
            });
          } else {
            // Strengthen existing relationship
            relationship.strength = Math.min(
              MAX_COWORKER_RELATIONSHIP,
              relationship.strength + COWORKER_BONDING_RATE,
            );
            relationship.lastWorkedTogether = currentSol;
          }
        }
      }
    }

    // Decay relationships for colonists not currently working together
    for (const [key, relationship] of this.coworkerRelationships.entries()) {
      if (!currentCoworkerPairs.has(key)) {
        relationship.strength = Math.max(
          MIN_COWORKER_RELATIONSHIP,
          relationship.strength - COWORKER_RELATIONSHIP_DECAY,
        );

        // Remove very weak relationships
        if (relationship.strength <= MIN_COWORKER_RELATIONSHIP) {
          // Keep the relationship but at minimum strength
        }
      }
    }

    return events;
  }

  /**
   * Process housemate bonding for all colonists sharing housing.
   * Colonists living together develop stronger relationships.
   */
  private processHousemateBonding(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const currentHousematePairs = new Set<string>();

    // Group colonists by housing
    const housingGroups = new Map<string, Colonist[]>();
    for (const colonist of colonists) {
      if (colonist.housingId) {
        const group = housingGroups.get(colonist.housingId) || [];
        group.push(colonist);
        housingGroups.set(colonist.housingId, group);
      }
    }

    // Bond colonists who share housing
    for (const [housingId, housemates] of housingGroups) {
      if (housemates.length < 2) continue;

      for (let i = 0; i < housemates.length; i++) {
        const colonistA = housemates[i];
        if (!colonistA) continue;

        for (let j = i + 1; j < housemates.length; j++) {
          const colonistB = housemates[j];
          if (!colonistB) continue;

          const key = this.getRelationshipKey(colonistA.id, colonistB.id);
          currentHousematePairs.add(key);

          let relationship = this.coworkerRelationships.get(key);

          if (!relationship) {
            // First time living together
            relationship = {
              strength: INITIAL_HOUSEMATE_RELATIONSHIP,
              formedAt: currentSol,
              lastWorkedTogether: currentSol,
            };
            this.coworkerRelationships.set(key, relationship);

            events.push({
              type: "HOUSEMATE_BOND_FORMED",
              severity: "info",
              colonistA: colonistA.id,
              colonistB: colonistB.id,
              housingId,
              message: `${colonistA.name} and ${colonistB.name} are now housemates`,
            });
          } else {
            // Strengthen existing relationship (housemates bond faster)
            relationship.strength = Math.min(
              MAX_COWORKER_RELATIONSHIP,
              relationship.strength + HOUSEMATE_BONDING_RATE,
            );
            relationship.lastWorkedTogether = currentSol;
          }
        }
      }
    }

    return events;
  }

  /**
   * Calculate the team cohesion bonus for a building based on worker relationships.
   * Returns a multiplier (1.0 = no bonus, up to 1.0 + MAX_TEAM_COHESION_BONUS).
   */
  getTeamCohesionMultiplier(workerIds: string[]): number {
    if (workerIds.length < 2) {
      return 1.0; // No team bonus for solo workers
    }

    // Calculate average relationship strength between all pairs
    let totalStrength = 0;
    let pairCount = 0;

    for (let i = 0; i < workerIds.length; i++) {
      const workerA = workerIds[i];
      if (!workerA) continue;

      for (let j = i + 1; j < workerIds.length; j++) {
        const workerB = workerIds[j];
        if (!workerB) continue;

        totalStrength += this.getCoworkerRelationshipStrength(workerA, workerB);
        pairCount++;
      }
    }

    if (pairCount === 0) {
      return 1.0;
    }

    const averageStrength = totalStrength / pairCount;

    // No bonus if average strength is below threshold
    if (averageStrength < TEAM_COHESION_THRESHOLD) {
      return 1.0;
    }

    // Scale bonus from 0 to MAX_TEAM_COHESION_BONUS based on strength above threshold
    const strengthAboveThreshold = averageStrength - TEAM_COHESION_THRESHOLD;
    const maxStrengthAboveThreshold = MAX_COWORKER_RELATIONSHIP - TEAM_COHESION_THRESHOLD;
    const bonusRatio = strengthAboveThreshold / maxStrengthAboveThreshold;

    return 1.0 + bonusRatio * MAX_TEAM_COHESION_BONUS;
  }

  /**
   * Get all coworker relationships.
   */
  getAllCoworkerRelationships(): ReadonlyMap<string, CoworkerRelationship> {
    return this.coworkerRelationships;
  }

  // ============ Cohort System ============

  /**
   * Check if two colonists are in the same cohort (arrived within COHORT_WINDOW_SOLS of each other).
   */
  areInSameCohort(colonistA: Colonist, colonistB: Colonist): boolean {
    if (colonistA.arrivalSol === undefined || colonistB.arrivalSol === undefined) {
      return false;
    }
    return Math.abs(colonistA.arrivalSol - colonistB.arrivalSol) <= COHORT_WINDOW_SOLS;
  }

  /**
   * Get the bonding rate multiplier based on cohort and guild membership.
   */
  private getBondingMultiplier(colonistA: Colonist, colonistB: Colonist): number {
    let multiplier = 1.0;

    // Cohort bonus
    if (this.areInSameCohort(colonistA, colonistB)) {
      multiplier *= COHORT_BONDING_MULTIPLIER;
    }

    // Guild bonus
    if (this.shareGuild(colonistA, colonistB)) {
      multiplier *= GUILD_BONDING_MULTIPLIER;
    }

    return multiplier;
  }

  // ============ Guild System ============

  /**
   * Create a new guild.
   */
  createGuild(
    name: string,
    type: GuildType,
    founderIds: string[],
    currentSol: number,
    description?: string,
  ): Guild | null {
    if (founderIds.length < MIN_GUILD_SIZE) {
      return null;
    }

    const id = `guild_${this.nextGuildId++}`;
    const guild: Guild = {
      id,
      name,
      type,
      memberIds: founderIds.slice(0, MAX_GUILD_SIZE),
      foundedSol: currentSol,
      description,
    };

    this.guilds.set(id, guild);
    return guild;
  }

  /**
   * Add a colonist to a guild.
   */
  joinGuild(colonistId: string, guildId: string, colonist: Colonist): boolean {
    const guild = this.guilds.get(guildId);
    if (!guild) return false;

    // Check guild size limit
    if (guild.memberIds.length >= MAX_GUILD_SIZE) return false;

    // Check colonist's guild membership limit
    const membershipCount = colonist.guildIds?.length ?? 0;
    if (membershipCount >= MAX_GUILD_MEMBERSHIPS) return false;

    // Check if already a member
    if (guild.memberIds.includes(colonistId)) return false;

    guild.memberIds.push(colonistId);

    // Update colonist's guild list
    if (!colonist.guildIds) {
      colonist.guildIds = [];
    }
    colonist.guildIds.push(guildId);

    return true;
  }

  /**
   * Remove a colonist from a guild.
   */
  leaveGuild(colonistId: string, guildId: string, colonist: Colonist): boolean {
    const guild = this.guilds.get(guildId);
    if (!guild) return false;

    const memberIndex = guild.memberIds.indexOf(colonistId);
    if (memberIndex === -1) return false;

    guild.memberIds.splice(memberIndex, 1);

    // Update colonist's guild list
    if (colonist.guildIds) {
      const guildIndex = colonist.guildIds.indexOf(guildId);
      if (guildIndex !== -1) {
        colonist.guildIds.splice(guildIndex, 1);
      }
    }

    // Disband guild if too few members
    if (guild.memberIds.length < MIN_GUILD_SIZE) {
      this.disbandGuild(guildId);
    }

    return true;
  }

  /**
   * Disband a guild.
   */
  disbandGuild(guildId: string): boolean {
    return this.guilds.delete(guildId);
  }

  /**
   * Get all guilds.
   */
  getGuilds(): readonly Guild[] {
    return [...this.guilds.values()];
  }

  /**
   * Get a guild by ID.
   */
  getGuild(guildId: string): Guild | undefined {
    return this.guilds.get(guildId);
  }

  /**
   * Check if two colonists share a guild.
   */
  shareGuild(colonistA: Colonist, colonistB: Colonist): boolean {
    if (!colonistA.guildIds?.length || !colonistB.guildIds?.length) {
      return false;
    }
    return colonistA.guildIds.some((gId) => colonistB.guildIds?.includes(gId));
  }

  /**
   * Get shared guild IDs between two colonists.
   */
  getSharedGuildIds(colonistA: Colonist, colonistB: Colonist): string[] {
    if (!colonistA.guildIds?.length || !colonistB.guildIds?.length) {
      return [];
    }
    return colonistA.guildIds.filter((gId) => colonistB.guildIds?.includes(gId));
  }

  /**
   * Process guild bonding - guild members develop relationships.
   */
  private processGuildBonding(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const colonistMap = new Map(colonists.map((c) => [c.id, c]));

    for (const guild of this.guilds.values()) {
      if (guild.memberIds.length < 2) continue;

      for (let i = 0; i < guild.memberIds.length; i++) {
        const colonistAId = guild.memberIds[i];
        const colonistA = colonistMap.get(colonistAId!);
        if (!colonistA) continue;

        for (let j = i + 1; j < guild.memberIds.length; j++) {
          const colonistBId = guild.memberIds[j];
          const colonistB = colonistMap.get(colonistBId!);
          if (!colonistB) continue;

          const key = this.getRelationshipKey(colonistAId!, colonistBId!);
          let relationship = this.coworkerRelationships.get(key);

          if (!relationship) {
            // Guild members meeting for first time
            const initialStrength = INITIAL_COWORKER_RELATIONSHIP + GUILD_INITIAL_RELATIONSHIP_BONUS;
            relationship = {
              strength: Math.min(MAX_COWORKER_RELATIONSHIP, initialStrength),
              formedAt: currentSol,
              lastWorkedTogether: currentSol,
              sharedGuildIds: [guild.id],
            };
            this.coworkerRelationships.set(key, relationship);

            events.push({
              type: "GUILD_BOND_FORMED",
              severity: "info",
              colonistA: colonistAId,
              colonistB: colonistBId,
              guildId: guild.id,
              guildName: guild.name,
              message: `${colonistA.name} and ${colonistB.name} bonded through ${guild.name}`,
            });
          } else {
            // Update shared guild tracking
            relationship.sharedGuildIds = this.getSharedGuildIds(colonistA, colonistB);

            // Guild members bond at an accelerated rate
            const bondingRate = COWORKER_BONDING_RATE * GUILD_BONDING_MULTIPLIER * 0.5; // Half rate since passive
            relationship.strength = Math.min(
              MAX_COWORKER_RELATIONSHIP,
              relationship.strength + bondingRate,
            );
          }
        }
      }
    }

    return events;
  }

  // ============ Preferential Attachment System ============

  /**
   * Get the number of connections a colonist has.
   */
  getConnectionCount(colonistId: string): number {
    let count = 0;
    for (const key of this.coworkerRelationships.keys()) {
      if (key.includes(colonistId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Calculate connection probability based on preferential attachment.
   * Popular colonists are more likely to form new connections.
   */
  private calculateConnectionProbability(colonist: Colonist): number {
    const connectionCount = this.getConnectionCount(colonist.id);

    if (connectionCount < PREFERENTIAL_ATTACHMENT_THRESHOLD) {
      return BASE_CONNECTION_PROBABILITY;
    }

    const attachmentBonus =
      (connectionCount - PREFERENTIAL_ATTACHMENT_THRESHOLD) * PREFERENTIAL_ATTACHMENT_FACTOR;

    return Math.min(MAX_CONNECTION_PROBABILITY, BASE_CONNECTION_PROBABILITY + attachmentBonus);
  }

  /**
   * Process preferential attachment - random new connections form.
   */
  private processPreferentialAttachment(
    colonists: readonly Colonist[],
    currentSol: number,
  ): GameEvent[] {
    const events: GameEvent[] = [];

    if (colonists.length < 2) return events;

    // Each tick, there's a chance for new random connections to form
    for (const colonistA of colonists) {
      const probability = this.calculateConnectionProbability(colonistA);

      if (Math.random() < probability) {
        // Pick a random colonist they don't have a strong connection with
        const candidates = colonists.filter((c) => {
          if (c.id === colonistA.id) return false;
          const strength = this.getCoworkerRelationshipStrength(colonistA.id, c.id);
          return strength < WEAK_TIE_THRESHOLD;
        });

        if (candidates.length === 0) continue;

        // Prefer connecting to popular colonists (rich get richer)
        const weights = candidates.map((c) => 1 + this.getConnectionCount(c.id));
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        let random = Math.random() * totalWeight;
        let selectedColonist: Colonist | null = null;

        for (let i = 0; i < candidates.length; i++) {
          random -= weights[i]!;
          if (random <= 0) {
            selectedColonist = candidates[i]!;
            break;
          }
        }

        if (!selectedColonist) continue;

        const key = this.getRelationshipKey(colonistA.id, selectedColonist.id);
        let relationship = this.coworkerRelationships.get(key);

        if (!relationship) {
          // Check for cohort bonus
          const isCohort = this.areInSameCohort(colonistA, selectedColonist);
          const initialBonus = isCohort ? COHORT_INITIAL_BONUS : 0;

          relationship = {
            strength: INITIAL_COWORKER_RELATIONSHIP + initialBonus,
            formedAt: currentSol,
            lastWorkedTogether: currentSol,
            isCohort,
          };
          this.coworkerRelationships.set(key, relationship);

          events.push({
            type: "SOCIAL_BOND_FORMED",
            severity: "info",
            colonistA: colonistA.id,
            colonistB: selectedColonist.id,
            isCohort,
            message: `${colonistA.name} and ${selectedColonist.name} became acquainted`,
          });
        }
      }
    }

    return events;
  }

  // ============ Weak Ties (Granovetter) System ============

  /**
   * Check if a relationship is a weak tie.
   */
  isWeakTie(colonistId1: string, colonistId2: string): boolean {
    const strength = this.getCoworkerRelationshipStrength(colonistId1, colonistId2);
    return strength > 0 && strength < WEAK_TIE_THRESHOLD;
  }

  /**
   * Get all weak ties for a colonist.
   */
  getWeakTies(colonistId: string): string[] {
    const weakTies: string[] = [];

    for (const [key, rel] of this.coworkerRelationships) {
      if (rel.strength > 0 && rel.strength < WEAK_TIE_THRESHOLD) {
        const [id1, id2] = key.split(":");
        if (id1 === colonistId) {
          weakTies.push(id2!);
        } else if (id2 === colonistId) {
          weakTies.push(id1!);
        }
      }
    }

    return weakTies;
  }

  /**
   * Calculate the bridging score for a colonist.
   * Higher score means they connect otherwise disconnected groups.
   */
  calculateBridgingScore(colonistId: string, colonists: readonly Colonist[]): number {
    const connections = this.getConnectedColonistIds(colonistId);
    if (connections.length < 2) return 0;

    // Check how many of their connections are NOT connected to each other
    let bridgingPairs = 0;
    let totalPairs = 0;

    for (let i = 0; i < connections.length; i++) {
      for (let j = i + 1; j < connections.length; j++) {
        totalPairs++;
        const strength = this.getCoworkerRelationshipStrength(connections[i]!, connections[j]!);
        if (strength < WEAK_TIE_THRESHOLD) {
          bridgingPairs++;
        }
      }
    }

    return totalPairs > 0 ? bridgingPairs / totalPairs : 0;
  }

  /**
   * Get all colonist IDs connected to a given colonist.
   */
  private getConnectedColonistIds(colonistId: string): string[] {
    const connected: string[] = [];

    for (const key of this.coworkerRelationships.keys()) {
      const [id1, id2] = key.split(":");
      if (id1 === colonistId && id2) {
        connected.push(id2);
      } else if (id2 === colonistId && id1) {
        connected.push(id1);
      }
    }

    return connected;
  }

  /**
   * Get the social network position information for a colonist.
   */
  getSocialNetworkPosition(colonistId: string, colonists: readonly Colonist[]): SocialNetworkPosition {
    let totalStrength = 0;
    let connectionCount = 0;
    let weakTieCount = 0;

    for (const [key, rel] of this.coworkerRelationships) {
      if (key.includes(colonistId)) {
        connectionCount++;
        totalStrength += rel.strength;
        if (rel.strength < WEAK_TIE_THRESHOLD) {
          weakTieCount++;
        }
      }
    }

    return {
      connectionCount,
      averageStrength: connectionCount > 0 ? totalStrength / connectionCount : 0,
      weakTieCount,
      bridgingScore: this.calculateBridgingScore(colonistId, colonists),
    };
  }

  /**
   * Get colonists who are bridge connectors (high bridging score).
   */
  getBridgeColonists(colonists: readonly Colonist[], minBridgingScore: number = 0.3): Colonist[] {
    return colonists.filter((c) => this.calculateBridgingScore(c.id, colonists) >= minBridgingScore);
  }

  // ============ Serialization ============

  toJSON() {
    return {
      coworkerRelationships: Object.fromEntries(this.coworkerRelationships),
      guilds: Object.fromEntries(this.guilds),
      nextGuildId: this.nextGuildId,
    };
  }

  static fromJSON(data: ReturnType<WorkforceManager["toJSON"]>): WorkforceManager {
    const manager = new WorkforceManager();

    if (data.coworkerRelationships) {
      manager.coworkerRelationships = new Map(
        Object.entries(data.coworkerRelationships).map(([k, v]) => [k, v as CoworkerRelationship]),
      );
    }

    if (data.guilds) {
      manager.guilds = new Map(
        Object.entries(data.guilds).map(([k, v]) => [k, v as Guild]),
      );
    }

    if (data.nextGuildId) {
      manager.nextGuildId = data.nextGuildId;
    }

    return manager;
  }
}
