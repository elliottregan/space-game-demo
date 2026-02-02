// tests/GuildManager.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { GuildManager } from "../src/core/systems/GuildManager";
import { GuildType } from "../src/core/models/Guild";
import type { Colonist } from "../src/core/models/Colonist";
import { ColonistRole } from "../src/core/models/Colonist";

const createColonist = (overrides: Partial<Colonist> = {}): Colonist => ({
  id: "test_1",
  name: "Test Colonist",
  role: ColonistRole.UNASSIGNED,
  skills: [],
  ...overrides,
});

describe("GuildManager", () => {
  let manager: GuildManager;

  beforeEach(() => {
    manager = new GuildManager();
  });

  describe("createGuild", () => {
    it("should create a guild with founders", () => {
      const guild = manager.createGuild("Test Guild", GuildType.SOCIAL, ["c1", "c2"], 10);

      expect(guild).toBeDefined();
      expect(guild?.name).toBe("Test Guild");
      expect(guild?.memberIds).toContain("c1");
      expect(guild?.memberIds).toContain("c2");
    });

    it("should return null for too few founders", () => {
      const guild = manager.createGuild("Too Small", GuildType.SOCIAL, ["c1"], 10);
      expect(guild).toBeNull();
    });
  });

  describe("joinGuild", () => {
    it("should allow joining a guild", () => {
      const guild = manager.createGuild("Test", GuildType.SOCIAL, ["c1", "c2"], 10);
      const colonist = createColonist({ id: "c3" });

      const result = manager.joinGuild("c3", guild!.id, colonist);

      expect(result).toBe(true);
      expect(guild!.memberIds).toContain("c3");
      expect(colonist.guildIds).toContain(guild!.id);
    });
  });

  describe("leaveGuild", () => {
    it("should remove colonist from guild", () => {
      const guild = manager.createGuild("Test", GuildType.SOCIAL, ["c1", "c2", "c3"], 10);
      const colonist = createColonist({ id: "c1", guildIds: [guild!.id] });

      const result = manager.leaveGuild("c1", guild!.id, colonist);

      expect(result).toBe(true);
      expect(guild!.memberIds).not.toContain("c1");
    });

    it("should disband guild when below minimum size", () => {
      const guild = manager.createGuild("Small", GuildType.SOCIAL, ["c1", "c2"], 10);
      const colonist = createColonist({ id: "c1", guildIds: [guild!.id] });

      manager.leaveGuild("c1", guild!.id, colonist);

      expect(manager.getGuild(guild!.id)).toBeUndefined();
    });
  });

  describe("disbandGuild", () => {
    it("should clean up colonist guildIds when colonists provided", () => {
      const guild = manager.createGuild("Test", GuildType.SOCIAL, ["c1", "c2", "c3"], 10);
      const colonists = [
        createColonist({ id: "c1", guildIds: [guild!.id] }),
        createColonist({ id: "c2", guildIds: [guild!.id] }),
        createColonist({ id: "c3", guildIds: [guild!.id, "other_guild"] }),
      ];

      manager.disbandGuild(guild!.id, colonists);

      expect(colonists[0].guildIds).toEqual([]);
      expect(colonists[1].guildIds).toEqual([]);
      expect(colonists[2].guildIds).toEqual(["other_guild"]);
    });

    it("should work without colonists parameter", () => {
      const guild = manager.createGuild("Test", GuildType.SOCIAL, ["c1", "c2"], 10);

      const result = manager.disbandGuild(guild!.id);

      expect(result).toBe(true);
      expect(manager.getGuild(guild!.id)).toBeUndefined();
    });
  });

  describe("shareGuild", () => {
    it("should detect shared membership", () => {
      const guild = manager.createGuild("Shared", GuildType.SOCIAL, ["c1", "c2"], 10);
      const colonistA = createColonist({ id: "c1", guildIds: [guild!.id] });
      const colonistB = createColonist({ id: "c2", guildIds: [guild!.id] });
      const colonistC = createColonist({ id: "c3" });

      expect(manager.shareGuild(colonistA, colonistB)).toBe(true);
      expect(manager.shareGuild(colonistA, colonistC)).toBe(false);
    });
  });

  describe("getUsedGuildNames", () => {
    it("should return set of all guild names", () => {
      manager.createGuild("Alpha Guild", GuildType.SOCIAL, ["c1", "c2"], 10);
      manager.createGuild("Beta Guild", GuildType.PROFESSIONAL, ["c3", "c4"], 20);

      const names = manager.getUsedGuildNames();

      expect(names.has("Alpha Guild")).toBe(true);
      expect(names.has("Beta Guild")).toBe(true);
      expect(names.size).toBe(2);
    });

    it("should return empty set when no guilds exist", () => {
      const names = manager.getUsedGuildNames();
      expect(names.size).toBe(0);
    });
  });

  describe("serialization", () => {
    it("should serialize and deserialize correctly", () => {
      manager.createGuild("Test Guild", GuildType.PROFESSIONAL, ["c1", "c2"], 10);

      const json = manager.toJSON();
      const restored = GuildManager.fromJSON(json);

      expect(restored.getGuilds().length).toBe(1);
      expect(restored.getGuilds()[0]?.name).toBe("Test Guild");
    });
  });
});
