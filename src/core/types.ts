// Barrel: re-exports every public type from its owning module.
// Each type lives next to the concept it describes; this file just makes
// it convenient to grab a mixed handful in one import.

export type {
  Card,
  CardIdeology,
  CardKind,
  CardTag,
  DissentVariant,
  EffectSpec,
  Rank,
  Role,
  SerializablePredicate,
  Timing,
} from "./data/cards.ts";
export { ROLE_RANK } from "./data/cards.ts";

export type { Ideology, IdeologyDisplay } from "./data/ideologies.ts";
export { IDEOLOGIES, IDEOLOGY_DISPLAY, zeroIdeologyBreakdown } from "./data/ideologies.ts";

export type {
  Crisis,
  CrisisOutcome,
  KeystoneProject,
  PatternKind,
  ProjectUnlock,
} from "./data/projects.ts";

export type { Demonym, IdeologyTerrain, IdeologyVector } from "./engine/ideology.ts";

export type { CharterRow, Column, ColumnConfig, InfluenceRow, LandRow } from "./engine/column.ts";

export type { DiscardSource, GameEvent } from "./engine/events.ts";

export type { Epoch, EpochPhase, EpochStatus } from "./engine/epoch.ts";

export type {
  Campaign,
  EpochResult,
  LegacyCandidate,
  LegacyCard,
  Monument,
} from "./engine/campaign.ts";

export type { Setting, SettingRules } from "./settings/index.ts";
