// Barrel: re-exports every public type from its owning module.
// Each type lives next to the concept it describes; this file just makes
// it convenient to grab a mixed handful in one import.

export type {
  Card,
  CardIdeology,
  CardKind,
  CardTag,
  EffectSpec,
  Rank,
  Role,
  Timing,
} from "./data/cards.ts";
export { ROLE_RANK } from "./data/cards.ts";

export type { Ideology, IdeologyDisplay } from "./data/ideologies.ts";
export { IDEOLOGIES, IDEOLOGY_DISPLAY, zeroIdeologyBreakdown } from "./data/ideologies.ts";

export type {
  Crisis,
  CrisisContribution,
  CrisisOutcome,
  KeystoneProject,
  PatternKind,
  ProjectLevel,
  ProjectUnlock,
} from "./data/projects.ts";

export type { Demonym, IdeologyVector } from "./engine/ideology.ts";

export type { CharterRow, Column, ColumnConfig, InfluenceRow, LandRow } from "./engine/column.ts";

export type { DiscardSource, GameEvent } from "./engine/events.ts";

export type { Epoch, EpochPhase, EpochStatus, PolicySlot, PolicyState } from "./engine/epoch.ts";

export type {
  Campaign,
  EpochResult,
  LegacyCandidate,
  LegacyCard,
  LegacyUpgrade,
  Monument,
} from "./engine/campaign.ts";

export type { Setting, SettingRules } from "./settings/index.ts";

export type { PolicyCard, PolicyModifier } from "./data/policies.ts";
