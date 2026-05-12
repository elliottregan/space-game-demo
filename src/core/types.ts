// Core taxonomy and data shapes for the deck-building demo.
// REDESIGN: tableau-based building, hand-based mega-structure completion.

export type Ideology = "solidarity" | "sovereignty" | "transformation" | "heritage";

export const IDEOLOGIES: Ideology[] = ["solidarity", "sovereignty", "transformation", "heritage"];

export type Role = "agitator" | "scholar" | "preacher" | "engineer" | "architect";

export const ROLE_RANK: Record<Role, 10 | 11 | 12 | 13 | 14> = {
  agitator: 10,
  scholar: 11,
  preacher: 12,
  engineer: 13,
  architect: 14,
};

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export type CardKind = "land" | "role" | "charter" | "dissent" | "legacy";

export type CardTag = "dissent" | "charter" | "legacy" | "exclusive" | "purge" | "starter";

export type DissentVariant = "quiet" | "backlash" | "unrest";

export type CardIdeology = Ideology | "wild";

// -------------------------------------------------------------------------
// Effects — serializable DSL
// -------------------------------------------------------------------------

export type Timing = "immediate" | "end-of-turn";

export type SerializablePredicate =
  | { kind: "suit"; ideology: Ideology }
  | { kind: "role"; role: Role }
  | { kind: "rank"; min?: number; max?: number }
  | { kind: "land" }
  | { kind: "and"; predicates: SerializablePredicate[] }
  | { kind: "or"; predicates: SerializablePredicate[] };

export type EffectSpec =
  | { kind: "gainInfluence"; amount: number; timing: "immediate" }
  | { kind: "gainMaterials"; amount: number; timing: "immediate" }
  | { kind: "draw"; count: number; timing: "immediate" }
  | {
      kind: "addDissent";
      variant: DissentVariant;
      ideology?: Ideology;
      amount: number;
      timing: "end-of-turn";
    }
  | { kind: "removeDissent"; amount: number; timing: "immediate" }
  | { kind: "shiftIdeology"; axis: "axis1" | "axis2"; amount: number; timing: "immediate" }
  | {
      kind: "discount";
      predicate: SerializablePredicate;
      amount: number;
      timing: "end-of-turn";
    }
  | { kind: "peekMarket"; count: number; timing: "immediate" }
  | { kind: "nextAcquireDiscount"; amount: number; timing: "immediate" }
  | { kind: "noop"; timing: "immediate" }
  | { kind: "compound"; effects: EffectSpec[] };

// -------------------------------------------------------------------------
// Card
// -------------------------------------------------------------------------

export interface Card {
  id: string;
  name: string;
  kind: CardKind;
  rank: Rank;
  ideology: CardIdeology;
  role?: Role;
  influenceCost: number;
  marketCost: number;
  effect: EffectSpec;
  slotPassive?: EffectSpec;
  tags: CardTag[];
  flavor?: string;
}

// -------------------------------------------------------------------------
// Ideology vector + terrain (derived — not stored on Epoch)
// -------------------------------------------------------------------------

export interface IdeologyVector {
  axis1: number; // +Sovereignty / -Solidarity
  axis2: number; // +Transformation / -Heritage
}

export interface IdeologyTerrain {
  axis1: number;
  axis2: number;
}

export type Demonym = "collective" | "dominion" | "ascendancy" | "keepers" | null;

// -------------------------------------------------------------------------
// Mega-Projects — hand-based completion
// -------------------------------------------------------------------------

/** What poker-like hand is required to play the mega-structure. */
export type HandRequirement =
  | { kind: "four-of-a-kind"; role: Role; count: 4 }
  | { kind: "flush"; ideology: Ideology; count: number }
  | { kind: "straight"; ranks: number[] }; // e.g., [11, 12, 13]

export interface MegaProject {
  id: string;
  name: string;
  description: string;
  primaryAxis: "axis1" | "axis2";
  primaryDirection: "positive" | "negative";
  requiredHand: HandRequirement;
  keystoneId: string; // the keystone card required in hand (in addition to the poker hand)
  monumentEffect: { terrainDelta: Partial<IdeologyTerrain>; baseMagnitude: number };
  flavor?: string;
}

// -------------------------------------------------------------------------
// Short-term tasks (stubbed in this iteration — kept for future)
// -------------------------------------------------------------------------

export type TaskPredicate =
  | { kind: "acquire-rank"; min: number }
  | { kind: "acquire-role"; count: number }
  | { kind: "axis-reach"; axis: "axis1" | "axis2"; min: number }
  | { kind: "purge-dissent"; count: number };

export interface TaskDef {
  id: string;
  name: string;
  description: string;
  predicate: TaskPredicate;
  reward: EffectSpec;
}

// -------------------------------------------------------------------------
// Settings
// -------------------------------------------------------------------------

export interface SettingRules {
  handSize: number;
  tableauSlots: number;
  influenceBaseline: number;
  materialsPerLandBase: number;
  deckStartMinSize: number;
  softTurnLimit: number;
  dissentLossThreshold: number;
  retrieveInfluenceCost: number;
  retrieveLandMaterialCost: number; // extra Material cost when retrieving a Land
  discardMaterialGain: number; // Material gained when discarding a hand card
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  rules: SettingRules;
  startingDeck: string[];
  startingTableau: TableauSlotConfig[];
  megaProjects: MegaProject[];
  shortTermTasks: TaskDef[];
  transitions: {
    onWin: Record<string, string | "campaign-end">;
    onLoss: string | "campaign-end";
  };
}

export interface TableauSlotConfig {
  lands: string[]; // card ids (must share rank if multiple)
  topper?: string; // card id of a Role/Keystone topper
}

// -------------------------------------------------------------------------
// Runtime state
// -------------------------------------------------------------------------

export interface TableauSlot {
  lands: Card[]; // stack of matching-rank Lands (1..4)
  topper: Card | null; // Role or Keystone (requires improved slot, i.e., lands.length >= 2)
}

export interface TaskProgressState {
  taskId: string;
  completed: boolean;
  completedOnTurn?: number;
}

export interface Epoch {
  epochNumber: number;
  settingId: string;
  turn: number;
  phase: EpochPhase;
  hand: Card[];
  draw: Card[];
  discard: Card[];
  tableau: TableauSlot[];
  influence: number;
  materials: number;
  taskProgress: Record<string, TaskProgressState>;
  tasksRevealed: string[];
  endOfTurnQueue: EffectSpec[];
  eventLog: EventEntry[];
  status: EpochStatus;
}

export type EpochPhase = "draw" | "main" | "upkeep" | "end" | "ended";

export type EpochStatus =
  | { kind: "in-progress" }
  | { kind: "won"; projectId: string; tier: CompletionTier; score: number }
  | { kind: "lost"; mode: LossMode };

export type LossMode = "populace-turned" | "starved-out";

export type CompletionTier = "bronze" | "silver" | "gold" | "platinum";

export interface EventEntry {
  turn: number;
  text: string;
  kind?: "info" | "warn" | "danger";
}

// -------------------------------------------------------------------------
// Campaign
// -------------------------------------------------------------------------

export interface Monument {
  id: string;
  megaProjectId: string;
  projectName: string;
  tier: CompletionTier;
  mintedOnEpoch: number;
  terrainDelta: Partial<IdeologyTerrain>;
  active: boolean;
}

export interface LegacyCard {
  id: string;
  baseCard: Card;
  upgradePath: "potency" | "pliability" | "persistence";
  mintedOnEpoch: number;
  mintedFrom: "mega-project" | "played" | "consolation";
}

export interface EpochResult {
  epochNumber: number;
  settingId: string;
  outcome: "win" | "loss";
  completedProjectId?: string;
  completionTier?: CompletionTier;
  lossMode?: LossMode;
  mintedLegacyIds: string[];
  finalIdeology: IdeologyVector;
}

export interface Campaign {
  id: string;
  seed: number;
  currentSettingId: string;
  legacyCards: LegacyCard[];
  monuments: Monument[];
  terrain: IdeologyTerrain;
  epochHistory: EpochResult[];
  epochCount: number;
}

export interface LegacyCandidate {
  id: string;
  baseCard: Card;
  source: "mega-project" | "played" | "consolation";
  suggestedUpgrades: ("potency" | "pliability" | "persistence")[];
}

// -------------------------------------------------------------------------
// Result type
// -------------------------------------------------------------------------

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T>(error: string): Result<T> => ({ ok: false, error });
