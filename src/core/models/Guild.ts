// src/core/models/Guild.ts
// Guild system for colonist group memberships

export enum GuildType {
  PROFESSIONAL = "professional", // Based on role (Engineers Guild, etc.)
  SOCIAL = "social", // Recreation/hobby based
  RESEARCH = "research", // Academic/research circles
  CIVIC = "civic", // Colony governance/civic participation
}

export interface Guild {
  id: string;
  name: string;
  type: GuildType;
  memberIds: string[]; // Colonist IDs
  foundedSol: number;
  description?: string;
}

/** Display names for guild types */
export const GUILD_TYPE_DISPLAY_NAMES: Record<GuildType, string> = {
  [GuildType.PROFESSIONAL]: "Professional Guild",
  [GuildType.SOCIAL]: "Social Club",
  [GuildType.RESEARCH]: "Research Circle",
  [GuildType.CIVIC]: "Civic Group",
};

/** Suggested guild names by type */
export const GUILD_NAME_SUGGESTIONS: Record<GuildType, string[]> = {
  [GuildType.PROFESSIONAL]: [
    "Engineers Union",
    "Farmers Collective",
    "Research Council",
    "Maintenance Crew",
  ],
  [GuildType.SOCIAL]: [
    "Movie Night Club",
    "Board Game Society",
    "Fitness Group",
    "Music Ensemble",
    "Book Club",
    "Cooking Circle",
  ],
  [GuildType.RESEARCH]: [
    "Astrobiology Society",
    "Terraforming Committee",
    "Mars History Project",
    "Innovation Lab",
  ],
  [GuildType.CIVIC]: [
    "Colony Council",
    "Safety Committee",
    "Resource Planning Board",
    "Welcome Committee",
  ],
};
