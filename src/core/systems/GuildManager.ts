// src/core/systems/GuildManager.ts
import type { Guild } from "../models/Guild";
import { GuildType } from "../models/Guild";
import type { Colonist } from "../models/Colonist";
import { MIN_GUILD_SIZE, MAX_GUILD_SIZE, MAX_GUILD_MEMBERSHIPS } from "../balance/WorkforceBalance";

/**
 * Manages guild creation, membership, and queries.
 */
export class GuildManager {
  private guilds: Map<string, Guild> = new Map();
  private nextGuildId: number = 1;

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

    if (guild.memberIds.length >= MAX_GUILD_SIZE) return false;

    const membershipCount = colonist.guildIds?.length ?? 0;
    if (membershipCount >= MAX_GUILD_MEMBERSHIPS) return false;

    if (guild.memberIds.includes(colonistId)) return false;

    guild.memberIds.push(colonistId);

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

    if (colonist.guildIds) {
      const guildIndex = colonist.guildIds.indexOf(guildId);
      if (guildIndex !== -1) {
        colonist.guildIds.splice(guildIndex, 1);
      }
    }

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
   * Get all guild names currently in use.
   * Used to avoid duplicate names during guild formation.
   */
  getUsedGuildNames(): Set<string> {
    const names = new Set<string>();
    for (const guild of this.guilds.values()) {
      names.add(guild.name);
    }
    return names;
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

  // ============ Serialization ============

  toJSON() {
    return {
      guilds: Object.fromEntries(this.guilds),
      nextGuildId: this.nextGuildId,
    };
  }

  static fromJSON(data: ReturnType<GuildManager["toJSON"]>): GuildManager {
    const manager = new GuildManager();

    if (data.guilds) {
      manager.guilds = new Map(Object.entries(data.guilds).map(([k, v]) => [k, v as Guild]));
    }

    if (data.nextGuildId) {
      manager.nextGuildId = data.nextGuildId;
    }

    return manager;
  }
}
