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
  columnCount: number;          // replaces tableauSlots
  influenceBaseline: number;
  materialsPerLandBase: number;
  deckStartMinSize: number;
  maxTurns: number;             // turn budget; Crisis fires when exceeded
  dissentLossThreshold: number;
}

export interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;
  rules: SettingRules;
  startingDeck: string[];
  startingColumns: ColumnConfig[];   // replaces startingTableau
  projects: KeystoneProject[];       // exactly 5, one per pattern
  crisis: Crisis;
  shortTermTasks: TaskDef[];
  transitions: {
    onWin: string | "campaign-end";  // single next-setting; no per-project routing
    onLoss: string | "campaign-end";
  };
}

// -------------------------------------------------------------------------
// Runtime state
// -------------------------------------------------------------------------

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
  columns: Column[];              // replaces tableau
  unlockedProjects: ProjectUnlock[];
  eventLog: GameEvent[];          // typed event log (was EventEntry[])
  influence: number;
  materials: number;
  taskProgress: Record<string, TaskProgressState>;
  tasksRevealed: string[];
  endOfTurnQueue: EffectSpec[];
  status: EpochStatus;
  crisis: {
    status: "pending" | "resolved";
    outcome?: CrisisOutcome;
  };
}

export type EpochPhase = "play" | "crisis" | "end-of-epoch";

export type EpochStatus =
  | { kind: "in-progress" }
  | { kind: "won"; outcome: CrisisOutcome }
  | { kind: "lost"; outcome: CrisisOutcome };

// -------------------------------------------------------------------------
// Campaign
// -------------------------------------------------------------------------

export interface Monument {
  id: string;
  projectId: string;     // matches the strongest unlock that triggered it
  projectName: string;
  mintedOnEpoch: number;
  terrainDelta: Partial<IdeologyTerrain>;
  active: boolean;
}

export interface LegacyCard {
  id: string;
  baseCard: Card;
  upgradePath: "potency" | "pliability" | "persistence";
  mintedOnEpoch: number;
  mintedFrom: "unlock" | "consolation";
}

export interface EpochResult {
  epochNumber: number;
  settingId: string;
  outcome: "win" | "loss";
  totalValue: number;
  unlockCount: number;
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
  source: "unlock" | "consolation";
  suggestedUpgrades: ("potency" | "pliability" | "persistence")[];
}

// -------------------------------------------------------------------------
// Result type
// -------------------------------------------------------------------------

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T>(error: string): Result<T> => ({ ok: false, error });

// --------------------------------------------------------------------------
// Three-tier column
// --------------------------------------------------------------------------

export interface LandRow {
  cards: Card[]; // all same rank when non-empty; max 4
}

export interface InfluenceRow {
  card: Card | null; // a card with kind === "role"
}

export interface CharterRow {
  card: Card | null; // a card with kind === "charter"
}

export interface Column {
  lands: LandRow;
  influence: InfluenceRow;
  charter: CharterRow;
}

export interface ColumnConfig {
  lands: string[]; // card ids; must share rank
  influence?: string;
  charter?: string;
}

export type PatternKind =
  | "high-card"
  | "pair"
  | "three-of-a-kind"
  | "flush"
  | "four-of-a-kind";

export interface KeystoneProject {
  id: string;
  pattern: PatternKind;
  name: string;
  flavor: string;
  value: number;            // contribution to Crisis score
  unlockEffect?: EffectSpec; // semantics deferred
}

export interface ProjectUnlock {
  projectId: string;
  pattern: PatternKind;
  turn: number;
  cards: Card[]; // snapshot of the built column at Build time
}

export interface Crisis {
  id: string;
  name: string;
  flavor: string;
  difficulty: number;
}

export interface CrisisOutcome {
  totalValue: number;
  cleared: boolean;
  contributingUnlocks: ProjectUnlock[]; // ordered: four → flush → three → pair → high-card, then turn order
}

export type DiscardSource = "tableau-land" | "tableau-charter" | "column" | "hand";

export type GameEvent =
  | { type: "card-played-to-land"; card: Card; columnIndex: number }
  | { type: "card-played-to-influence"; card: Card; columnIndex: number }
  | { type: "card-played-to-charter"; card: Card; columnIndex: number }
  | { type: "card-discarded"; card: Card; source: DiscardSource }
  | { type: "card-recalled-to-hand"; card: Card; columnIndex: number }
  | { type: "column-built"; columnIndex: number; unlock: ProjectUnlock }
  | { type: "dissent-added"; variant: DissentVariant }
  | { type: "turn-ended"; turn: number }
  | { type: "crisis-resolved"; outcome: CrisisOutcome };

