import {
  BASE_CONNECTION_PROBABILITY,
  COHORT_INITIAL_BONUS,
  COWORKER_BONDING_RATE,
  EXPERIENCE_GAIN_RATE,
  GUILD_BONDING_MULTIPLIER,
  GUILD_FORMATION_BASE_PROBABILITY,
  GUILD_FORMATION_CHECK_INTERVAL,
  GUILD_FORMATION_MEMBERSHIP_PENALTY,
  GUILD_FORMATION_MIN_POPULATION,
  GUILD_FORMATION_RELATIONSHIP_THRESHOLD,
  GUILD_INITIAL_RELATIONSHIP_BONUS,
  HOUSEMATE_BONDING_RATE,
  INITIAL_COWORKER_RELATIONSHIP,
  INITIAL_HOUSEMATE_RELATIONSHIP,
  INITIAL_SOCIAL_RELATIONSHIP,
  MASTER_EVENT_CHANCE,
  MAX_CONNECTION_PROBABILITY,
  MAX_COWORKER_RELATIONSHIP,
  MAX_SKILL_EFFICIENCY_BONUS,
  PREFERENTIAL_ATTACHMENT_FACTOR,
  PREFERENTIAL_ATTACHMENT_THRESHOLD,
  SOCIAL_BONDING_RATE,
  SOCIAL_BONDS_PER_TICK,
  SOCIAL_RELATIONSHIP_DECAY,
  WEAK_TIE_THRESHOLD,
} from "../balance/WorkforceBalance";
import { SKILLS } from "../data/skills";
import type { Colonist } from "../models/Colonist";
import { ColonistRole, MasteryLevel } from "../models/Colonist";
import type { GameEvent } from "../models/GameEvent";
import { GuildType } from "../models/Guild";
import type { Guild } from "../models/Guild";
import { rng } from "../utils/random";
import { pickRandomSubset } from "../utils/randomSubset";
import type { BuildingManager } from "./BuildingManager";
import type { ColonyManager } from "./ColonyManager";

// Import composed managers
import { RelationshipManager } from "./RelationshipManager";
import { GuildManager } from "./GuildManager";

// Import pure functions from workforce/ modules
import { areInSameCohort } from "./workforce/cohort";
import {
  determineGuildType,
  generateGuildName,
  findEligibleFounderGroups,
  calculateFormationProbability,
  canJoinGuild,
} from "./workforce/guildFormation";
import { calculateMasteryLevel, getMasteryEfficiency, getMasteryName } from "./workforce/mastery";
import { getTrainingTime } from "./workforce/training";
import { getRelationshipKey } from "./workforce/socialGraph";
import type { WorkforceQueries } from "../interfaces/Queries";

// Re-export types for backward compatibility
export type {
  CoworkerRelationship,
  SocialNetworkPosition,
  SocialCommunity,
} from "./workforce/types";

export class WorkforceManager implements WorkforceQueries {
  /** Manages colonist relationships - delegated to RelationshipManager */
  private relationshipManager: RelationshipManager = new RelationshipManager();

  /** Manages guilds - delegated to GuildManager */
  private guildManager: GuildManager = new GuildManager();

  /** Sol of last guild formation check */
  private lastGuildFormationCheck: number = 0;

  /** Set the last guild formation check sol (used for deserialization) */
  setLastGuildFormationCheck(sol: number): void {
    this.lastGuildFormationCheck = sol;
  }

  /**
   * Get the underlying RelationshipManager for direct access.
   * Used by morale propagation and other systems that need centrality data.
   */
  getRelationshipManager(): RelationshipManager {
    return this.relationshipManager;
  }

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

    // Process social building bonding (third spaces)
    events.push(...this.processSocialBonding(colonists, buildings, currentSol));

    // Process preferential attachment (random new connections)
    events.push(...this.processPreferentialAttachment(colonists, currentSol));

    // Process guild formation
    events.push(...this.processGuildFormation(colonists, currentSol));

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

        // Check for mastery level up (use pure function)
        const newLevel = calculateMasteryLevel(colonist.experience);
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
        if (colonist.masteryLevel === MasteryLevel.MASTER && rng.chance(MASTER_EVENT_CHANCE)) {
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

  /** Delegate to pure function */
  getTrainingTime(currentRole: ColonistRole, targetRole: ColonistRole): number {
    return getTrainingTime(currentRole, targetRole);
  }

  /** Delegate to pure function */
  calculateMasteryLevel(experience: number): MasteryLevel {
    return calculateMasteryLevel(experience);
  }

  /** Provide backward-compatible role names (differs from ROLE_DISPLAY_NAMES) */
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

  /** Delegate to pure function */
  getMasteryName(level: MasteryLevel): string {
    return getMasteryName(level);
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
    // Use pure function for mastery efficiency
    const masteryEfficiency = getMasteryEfficiency(colonist.masteryLevel);

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
  // Delegate to RelationshipManager

  /**
   * Get the relationship between two colonists.
   * Delegates to RelationshipManager.
   */
  getCoworkerRelationship(
    colonistId1: string,
    colonistId2: string,
  ): import("./workforce/types").CoworkerRelationship | undefined {
    return this.relationshipManager.getRelationship(colonistId1, colonistId2);
  }

  /**
   * Get the relationship strength between two colonists (0 if no relationship).
   * Delegates to RelationshipManager.
   */
  getCoworkerRelationshipStrength(colonistId1: string, colonistId2: string): number {
    return this.relationshipManager.getRelationshipStrength(colonistId1, colonistId2);
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

          const key = getRelationshipKey(colonistA, colonistB);
          currentCoworkerPairs.add(key);

          const existingRelationship = this.relationshipManager.getRelationship(
            colonistA,
            colonistB,
          );

          if (!existingRelationship) {
            // First time working together - create relationship via RelationshipManager
            this.relationshipManager.createRelationship(colonistA, colonistB, currentSol, {
              initialStrength: INITIAL_COWORKER_RELATIONSHIP,
            });

            events.push({
              type: "COWORKER_BOND_FORMED",
              severity: "info",
              colonistA,
              colonistB,
              buildingId: building.id,
              message: `New coworker bond formed at ${building.id}`,
            });
          } else {
            // Strengthen existing relationship via RelationshipManager
            this.relationshipManager.strengthenRelationship(
              colonistA,
              colonistB,
              COWORKER_BONDING_RATE,
              currentSol,
            );
          }
        }
      }
    }

    // Decay relationships for colonists not currently working together
    this.relationshipManager.decayRelationships(currentCoworkerPairs);

    return events;
  }

  /**
   * Process housemate bonding for all colonists sharing housing.
   * Colonists living together develop stronger relationships.
   */
  private processHousemateBonding(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];

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

          const existingRelationship = this.relationshipManager.getRelationship(
            colonistA.id,
            colonistB.id,
          );

          if (!existingRelationship) {
            // First time living together - create via RelationshipManager
            this.relationshipManager.createRelationship(colonistA.id, colonistB.id, currentSol, {
              initialStrength: INITIAL_HOUSEMATE_RELATIONSHIP,
            });

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
            this.relationshipManager.strengthenRelationship(
              colonistA.id,
              colonistB.id,
              HOUSEMATE_BONDING_RATE,
              currentSol,
            );
          }
        }
      }
    }

    return events;
  }

  /**
   * Process social bonding at social buildings (third spaces).
   * Each colonist bonds with 1-2 random others at their assigned social buildings.
   * Relationships decay when colonists no longer share a social building.
   */
  private processSocialBonding(
    colonists: readonly Colonist[],
    buildings: BuildingManager | undefined,
    currentSol: number,
  ): GameEvent[] {
    const events: GameEvent[] = [];
    const currentSocialPairs = new Set<string>();

    // Group colonists by social building
    const socialGroups = new Map<string, Colonist[]>();
    for (const colonist of colonists) {
      if (!colonist.socialBuildingIds?.length) continue;
      for (const buildingId of colonist.socialBuildingIds) {
        const group = socialGroups.get(buildingId) || [];
        group.push(colonist);
        socialGroups.set(buildingId, group);
      }
    }

    // Process each social building
    for (const [buildingId, members] of socialGroups) {
      if (members.length < 2) continue;

      // Get bonding strength multiplier from building definition
      let bondingMultiplier = 1.0;
      if (buildings) {
        const building = buildings.getBuildings().find((b) => b.id === buildingId);
        if (building) {
          const def = buildings.getDefinition(building.definitionId);
          bondingMultiplier = def?.bondingStrength ?? 1.0;
        }
      }

      // Each colonist bonds with random subset
      for (const colonist of members) {
        const others = members.filter((c) => c.id !== colonist.id);
        if (others.length === 0) continue;

        // Pick random colonists to bond with using partial Fisher-Yates shuffle
        // Only shuffles SOCIAL_BONDS_PER_TICK elements instead of entire array
        const bondingPartners = pickRandomSubset(others, SOCIAL_BONDS_PER_TICK);

        for (const partner of bondingPartners) {
          const key = getRelationshipKey(colonist.id, partner.id);
          currentSocialPairs.add(key);

          const existingRelationship = this.relationshipManager.getRelationship(
            colonist.id,
            partner.id,
          );

          if (!existingRelationship) {
            // First time meeting at social building - create via RelationshipManager
            this.relationshipManager.createRelationship(colonist.id, partner.id, currentSol, {
              initialStrength: INITIAL_SOCIAL_RELATIONSHIP,
            });

            events.push({
              type: "SOCIAL_BOND_FORMED",
              severity: "info",
              colonistA: colonist.id,
              colonistB: partner.id,
              buildingId,
              message: `${colonist.name} and ${partner.name} connected at a social space`,
            });
          } else {
            // Strengthen existing relationship
            const bondingRate = SOCIAL_BONDING_RATE * bondingMultiplier;
            this.relationshipManager.strengthenRelationship(
              colonist.id,
              partner.id,
              bondingRate,
              currentSol,
            );
          }
        }
      }
    }

    // Decay relationships for colonists who have social buildings but don't share any
    const colonistsWithSocialBuildings = new Set<string>();
    for (const colonist of colonists) {
      if (colonist.socialBuildingIds?.length) {
        colonistsWithSocialBuildings.add(colonist.id);
      }
    }

    // Custom decay for social relationships
    for (const [key, relationship] of this.relationshipManager.getAllRelationships()) {
      if (currentSocialPairs.has(key)) continue; // Currently socializing, skip

      const [id1, id2] = key.split(":");
      if (!id1 || !id2) continue;
      // Only decay if both colonists have social building assignments (social relationship)
      if (colonistsWithSocialBuildings.has(id1) && colonistsWithSocialBuildings.has(id2)) {
        // Direct mutation since we need custom decay logic
        relationship.strength = Math.max(0, relationship.strength - SOCIAL_RELATIONSHIP_DECAY);
      }
    }

    return events;
  }

  /**
   * Calculate the team cohesion bonus for a building based on worker relationships.
   * Delegates to RelationshipManager.
   */
  getTeamCohesionMultiplier(workerIds: string[]): number {
    return this.relationshipManager.getTeamCohesionMultiplier(workerIds);
  }

  /**
   * Get all coworker relationships.
   * Delegates to RelationshipManager.
   */
  getAllCoworkerRelationships(): ReadonlyMap<
    string,
    import("./workforce/types").CoworkerRelationship
  > {
    return this.relationshipManager.getAllRelationships();
  }

  // ============ Cohort System ============

  /**
   * Check if two colonists are in the same cohort (arrived within COHORT_WINDOW_SOLS of each other).
   * Delegates to pure function.
   */
  areInSameCohort(colonistA: Colonist, colonistB: Colonist): boolean {
    return areInSameCohort(colonistA.arrivalSol, colonistB.arrivalSol);
  }

  /**
   * Get the bonding rate multiplier based on cohort and guild membership.
   */
  private getBondingMultiplier(colonistA: Colonist, colonistB: Colonist): number {
    let multiplier = 1.0;

    // Cohort bonus (use pure function)
    if (areInSameCohort(colonistA.arrivalSol, colonistB.arrivalSol)) {
      // Use the constant directly since getCohortBondingMultiplier requires arrival sols
      multiplier *= 1.5; // COHORT_BONDING_MULTIPLIER
    }

    // Guild bonus (delegate to GuildManager)
    if (this.guildManager.shareGuild(colonistA, colonistB)) {
      multiplier *= GUILD_BONDING_MULTIPLIER;
    }

    return multiplier;
  }

  // ============ Guild System ============
  // Delegate to GuildManager

  /**
   * Create a new guild.
   * Delegates to GuildManager.
   */
  createGuild(
    name: string,
    type: GuildType,
    founderIds: string[],
    currentSol: number,
    description?: string,
  ): Guild | null {
    return this.guildManager.createGuild(name, type, founderIds, currentSol, description);
  }

  /**
   * Add a colonist to a guild.
   * Validates eligibility (relationship threshold + characteristic match) before joining.
   */
  joinGuild(
    colonistId: string,
    guildId: string,
    colonist: Colonist,
    allColonists: readonly Colonist[],
  ): boolean {
    const guild = this.guildManager.getGuild(guildId);
    if (!guild) return false;

    // Get current guild members
    const members = guild.memberIds
      .map((id) => allColonists.find((c) => c.id === id))
      .filter((c): c is Colonist => c !== undefined);

    // Validate eligibility (relationship + characteristic)
    const relationships = this.relationshipManager.getAllRelationships();
    if (!canJoinGuild(colonist, guild, members, relationships)) {
      return false;
    }

    return this.guildManager.joinGuild(colonistId, guildId, colonist);
  }

  /**
   * Remove a colonist from a guild.
   * Delegates to GuildManager.
   */
  leaveGuild(colonistId: string, guildId: string, colonist: Colonist): boolean {
    return this.guildManager.leaveGuild(colonistId, guildId, colonist);
  }

  /**
   * Disband a guild.
   * Delegates to GuildManager.
   */
  disbandGuild(guildId: string): boolean {
    return this.guildManager.disbandGuild(guildId);
  }

  /**
   * Get all guilds.
   * Delegates to GuildManager.
   */
  getGuilds(): readonly Guild[] {
    return this.guildManager.getGuilds();
  }

  /**
   * Get a guild by ID.
   * Delegates to GuildManager.
   */
  getGuild(guildId: string): Guild | undefined {
    return this.guildManager.getGuild(guildId);
  }

  /**
   * Check if two colonists share a guild.
   * Delegates to GuildManager.
   */
  shareGuild(colonistA: Colonist, colonistB: Colonist): boolean {
    return this.guildManager.shareGuild(colonistA, colonistB);
  }

  /**
   * Get shared guild IDs between two colonists.
   * Delegates to GuildManager.
   */
  getSharedGuildIds(colonistA: Colonist, colonistB: Colonist): string[] {
    return this.guildManager.getSharedGuildIds(colonistA, colonistB);
  }

  /**
   * Process guild bonding - guild members develop relationships.
   */
  private processGuildBonding(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];
    const colonistMap = new Map(colonists.map((c) => [c.id, c]));

    for (const guild of this.guildManager.getGuilds()) {
      if (guild.memberIds.length < 2) continue;

      for (let i = 0; i < guild.memberIds.length; i++) {
        const colonistAId = guild.memberIds[i];
        if (!colonistAId) continue;
        const colonistA = colonistMap.get(colonistAId);
        if (!colonistA) continue;

        for (let j = i + 1; j < guild.memberIds.length; j++) {
          const colonistBId = guild.memberIds[j];
          if (!colonistBId) continue;
          const colonistB = colonistMap.get(colonistBId);
          if (!colonistB) continue;

          const existingRelationship = this.relationshipManager.getRelationship(
            colonistAId,
            colonistBId,
          );

          if (!existingRelationship) {
            // Guild members meeting for first time - create via RelationshipManager
            const initialStrength =
              INITIAL_COWORKER_RELATIONSHIP + GUILD_INITIAL_RELATIONSHIP_BONUS;
            this.relationshipManager.createRelationship(colonistAId, colonistBId, currentSol, {
              initialStrength: Math.min(MAX_COWORKER_RELATIONSHIP, initialStrength),
              sharedGuildIds: [guild.id],
            });

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
            const sharedGuildIds = this.guildManager.getSharedGuildIds(colonistA, colonistB);
            this.relationshipManager.updateSharedGuilds(colonistAId, colonistBId, sharedGuildIds);

            // Guild members bond at an accelerated rate
            const bondingRate = COWORKER_BONDING_RATE * GUILD_BONDING_MULTIPLIER * 0.5; // Half rate since passive
            this.relationshipManager.strengthenRelationship(
              colonistAId,
              colonistBId,
              bondingRate,
              currentSol,
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
   * Delegates to RelationshipManager.
   */
  getConnectionCount(colonistId: string): number {
    return this.relationshipManager.getConnectionCount(colonistId);
  }

  /**
   * Calculate connection probability based on preferential attachment.
   * Popular colonists are more likely to form new connections.
   */
  private calculateConnectionProbability(colonist: Colonist): number {
    const connectionCount = this.relationshipManager.getConnectionCount(colonist.id);

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

      if (rng.chance(probability)) {
        // Pick a random colonist they don't have a strong connection with
        const candidates = colonists.filter((c) => {
          if (c.id === colonistA.id) return false;
          const strength = this.relationshipManager.getRelationshipStrength(colonistA.id, c.id);
          return strength < WEAK_TIE_THRESHOLD;
        });

        if (candidates.length === 0) continue;

        // Prefer connecting to popular colonists (rich get richer) using weighted pick
        const selectedColonist = rng.weightedPick(
          candidates,
          (c) => 1 + this.relationshipManager.getConnectionCount(c.id),
        );

        if (!selectedColonist) continue;

        const existingRelationship = this.relationshipManager.getRelationship(
          colonistA.id,
          selectedColonist.id,
        );

        if (!existingRelationship) {
          // Check for cohort bonus (use pure function)
          const isCohort = areInSameCohort(colonistA.arrivalSol, selectedColonist.arrivalSol);
          const initialBonus = isCohort ? COHORT_INITIAL_BONUS : 0;

          // Create relationship via RelationshipManager
          this.relationshipManager.createRelationship(
            colonistA.id,
            selectedColonist.id,
            currentSol,
            {
              initialStrength: INITIAL_COWORKER_RELATIONSHIP + initialBonus,
              isCohort,
            },
          );

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
   * Delegates to RelationshipManager.
   */
  isWeakTie(colonistId1: string, colonistId2: string): boolean {
    return this.relationshipManager.isWeakTie(colonistId1, colonistId2);
  }

  /**
   * Get all weak ties for a colonist.
   * Delegates to RelationshipManager.
   */
  getWeakTies(colonistId: string): string[] {
    return this.relationshipManager.getWeakTies(colonistId);
  }

  /**
   * Calculate the bridging score for a colonist.
   * Delegates to RelationshipManager.
   */
  calculateBridgingScore(colonistId: string, _colonists: readonly Colonist[]): number {
    return this.relationshipManager.calculateBridgingScore(colonistId);
  }

  // ============ Social Cohesion System ============

  /**
   * Calculate the clustering coefficient for a colonist.
   * Delegates to RelationshipManager.
   */
  getClusteringCoefficient(colonistId: string): number {
    return this.relationshipManager.getClusteringCoefficient(colonistId);
  }

  /**
   * Calculate colony-wide social cohesion score.
   * Delegates to RelationshipManager but returns single number for backward compatibility.
   */
  getColonySocialCohesion(colonistIds: string[]): number {
    const cohesion = this.relationshipManager.getColonySocialCohesion(colonistIds);
    return cohesion.averageClusteringCoefficient;
  }

  /**
   * Identify isolated colonists (no connections or very low clustering).
   * Delegates to RelationshipManager.
   */
  getIsolatedColonists(colonistIds: string[], minConnections: number = 1): string[] {
    return this.relationshipManager.getIsolatedColonists(colonistIds, minConnections);
  }

  /**
   * Get detailed social cohesion info for a colonist.
   * Delegates to RelationshipManager.
   */
  getColonistSocialCohesion(colonistId: string): {
    clusteringCoefficient: number;
    connectionCount: number;
    isIsolated: boolean;
    communityStrength: number;
  } {
    return this.relationshipManager.getColonistSocialCohesion(colonistId);
  }

  /**
   * Get all colonist IDs connected to a given colonist.
   */
  private getConnectedColonistIds(colonistId: string): string[] {
    return [...this.relationshipManager.getNeighbors(colonistId)];
  }

  /**
   * Get all connections for a colonist (public wrapper).
   * Returns array of {colonistId, strength} for each connection.
   */
  getColonistConnections(colonistId: string): Array<{ colonistId: string; strength: number }> {
    const neighbors = this.relationshipManager.getNeighbors(colonistId);
    return [...neighbors].map((neighborId) => ({
      colonistId: neighborId,
      strength: this.relationshipManager.getRelationshipStrength(colonistId, neighborId),
    }));
  }

  /**
   * Create an initial relationship between two colonists.
   * Used for establishing bonds between starting colonists who trained together.
   */
  createInitialRelationship(colonistId1: string, colonistId2: string, strength: number): void {
    this.relationshipManager.createRelationship(colonistId1, colonistId2, 0, {
      initialStrength: strength,
    });
  }

  /**
   * Get the social network position information for a colonist.
   * Delegates to RelationshipManager.
   */
  getSocialNetworkPosition(
    colonistId: string,
    _colonists: readonly Colonist[],
  ): import("./workforce/types").SocialNetworkPosition {
    return this.relationshipManager.getSocialNetworkPosition(colonistId);
  }

  /**
   * Get colonists who are bridge connectors (high bridging score).
   */
  getBridgeColonists(colonists: readonly Colonist[], minBridgingScore: number = 0.3): Colonist[] {
    return colonists.filter(
      (c) => this.relationshipManager.calculateBridgingScore(c.id) >= minBridgingScore,
    );
  }

  // ============ Community Detection (Label Propagation) ============

  /**
   * Detect communities in the social network using weighted label propagation.
   * Delegates to RelationshipManager.
   */
  detectCommunities(
    colonistIds: string[],
    maxIterations: number = 20,
    minCommunitySize: number = 2,
  ): import("./workforce/types").SocialCommunity[] {
    return this.relationshipManager.detectCommunities(colonistIds, maxIterations, minCommunitySize);
  }

  /**
   * Get community statistics for the entire network.
   * Delegates to RelationshipManager.
   */
  getCommunityStats(colonistIds: string[]): {
    communityCount: number;
    averageSize: number;
    averageCohesion: number;
    modularity: number;
  } {
    return this.relationshipManager.getCommunityStats(colonistIds);
  }

  // ============ Guild Formation ============

  /**
   * Process spontaneous guild formation.
   * Checks every GUILD_FORMATION_CHECK_INTERVAL sols for eligible founder groups.
   */
  processGuildFormation(colonists: readonly Colonist[], currentSol: number): GameEvent[] {
    const events: GameEvent[] = [];

    // Check interval
    if (currentSol - this.lastGuildFormationCheck < GUILD_FORMATION_CHECK_INTERVAL) {
      return events;
    }
    this.lastGuildFormationCheck = currentSol;

    // Minimum population check
    if (colonists.length < GUILD_FORMATION_MIN_POPULATION) {
      return events;
    }

    // Find eligible founder groups
    const relationships = this.relationshipManager.getAllRelationships();
    const groups = findEligibleFounderGroups(
      colonists,
      relationships,
      GUILD_FORMATION_RELATIONSHIP_THRESHOLD,
    );

    if (groups.length === 0) {
      return events;
    }

    // Try to form one guild (prevent explosion)
    const founderIds = groups[0];
    const founders = founderIds
      .map((id) => colonists.find((c) => c.id === id))
      .filter((c): c is Colonist => c !== undefined);

    if (founders.length < 2) {
      return events;
    }

    // Roll probability
    const probability = calculateFormationProbability(
      founders,
      GUILD_FORMATION_BASE_PROBABILITY,
      GUILD_FORMATION_MEMBERSHIP_PENALTY,
    );

    if (!rng.chance(probability)) {
      return events;
    }

    // Determine type and name
    const guildType = determineGuildType(founders);
    const usedNames = this.guildManager.getUsedGuildNames();
    const guildName = generateGuildName(guildType, usedNames);

    // Create guild
    const guild = this.guildManager.createGuild(guildName, guildType, founderIds, currentSol);

    if (!guild) {
      return events;
    }

    // Update colonist guildIds
    for (const founder of founders) {
      if (!founder.guildIds) {
        founder.guildIds = [];
      }
      if (!founder.guildIds.includes(guild.id)) {
        founder.guildIds.push(guild.id);
      }
    }

    events.push({
      type: "GUILD_FORMED",
      severity: "info",
      guildId: guild.id,
      guildName: guild.name,
      guildType: guildType,
      founderIds: founderIds,
      message: `The ${guild.name} has been founded!`,
    });

    return events;
  }

  // ============ Serialization ============

  toJSON() {
    return {
      // Keep backward-compatible keys
      coworkerRelationships: Object.fromEntries(this.relationshipManager.getAllRelationships()),
      guilds: Object.fromEntries(this.guildManager.getGuilds().map((g) => [g.id, g])),
      nextGuildId: this.guildManager.toJSON().nextGuildId,
      lastGuildFormationCheck: this.lastGuildFormationCheck,
    };
  }

  static fromJSON(data: ReturnType<WorkforceManager["toJSON"]>): WorkforceManager {
    const manager = new WorkforceManager();

    // Restore RelationshipManager from coworkerRelationships
    if (data.coworkerRelationships) {
      // Build relationships and adjacency list
      const relationships = new Map(
        Object.entries(data.coworkerRelationships).map(([k, v]) => [
          k,
          v as import("./workforce/types").CoworkerRelationship,
        ]),
      );

      // Build adjacency list from relationships
      const adjacencyList = new Map<string, string[]>();
      for (const key of relationships.keys()) {
        const [id1, id2] = key.split(":");
        if (id1 && id2) {
          if (!adjacencyList.has(id1)) adjacencyList.set(id1, []);
          if (!adjacencyList.has(id2)) adjacencyList.set(id2, []);
          adjacencyList.get(id1)?.push(id2);
          adjacencyList.get(id2)?.push(id1);
        }
      }

      manager.relationshipManager = RelationshipManager.fromJSON({
        relationships: data.coworkerRelationships as Record<
          string,
          import("./workforce/types").CoworkerRelationship
        >,
        adjacencyList: Object.fromEntries(adjacencyList),
      });
    }

    // Restore GuildManager from guilds
    if (data.guilds) {
      manager.guildManager = GuildManager.fromJSON({
        guilds: data.guilds as Record<string, Guild>,
        nextGuildId: data.nextGuildId ?? 1,
      });
    }

    // Restore lastGuildFormationCheck
    if (data.lastGuildFormationCheck !== undefined) {
      manager.setLastGuildFormationCheck(data.lastGuildFormationCheck);
    }

    return manager;
  }
}
