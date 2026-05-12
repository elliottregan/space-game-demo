// End-of-turn and Crisis-resolution flow.

import type { Campaign, CrisisOutcome, Epoch, ProjectUnlock, Setting } from "../types.ts";
import { landMaterialProduction } from "../data/cards.ts";
import { reversePatternOrder } from "../data/projects.ts";
import { countDissentInDeck, drawToHandSize, resolveEndOfTurn } from "./effects.ts";
import type { EffectContext } from "./effects.ts";
import { dispatch } from "./dispatch.ts";
import type { RNG } from "./rng.ts";

export function endTurn(epoch: Epoch, _campaign: Campaign, setting: Setting, rng: RNG): void {
  if (epoch.status.kind !== "in-progress") return;
  if (epoch.phase !== "play") return;

  // Production: each Land produces materials per its rank.
  let produced = 0;
  for (const col of epoch.columns) {
    for (const l of col.lands.cards) produced += landMaterialProduction(l.rank);
  }
  epoch.materials += produced;

  // Resolve end-of-turn effects (Backlash / queued addDissent etc.).
  const ctx: EffectContext = { epoch, rng, log: () => {} };
  resolveEndOfTurn(ctx);

  // Loss-by-dissent check carries over.
  const { dissent, total } = countDissentInDeck(epoch);
  if (total > 0 && dissent / total > setting.rules.dissentLossThreshold) {
    // Force Crisis with zero contribution → guaranteed loss path.
    epoch.crisis.status = "pending";
    epoch.phase = "crisis";
    dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
    return;
  }

  // Transient ideology shift resets each turn.
  (epoch as Epoch & { __shift?: { axis1: number; axis2: number } }).__shift = {
    axis1: 0,
    axis2: 0,
  };

  // End-of-turn hand cycle: cards still in hand drop to discard without
  // triggering Dissent. The per-discard Dissent rule applies to deliberate
  // releases, not the natural turn cycle.
  if (epoch.hand.length > 0) {
    epoch.discard.push(...epoch.hand);
    epoch.hand = [];
  }

  dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
  epoch.turn += 1;

  if (epoch.turn > setting.rules.maxTurns) {
    epoch.phase = "crisis";
    return;
  }

  drawToHandSize(epoch, setting.rules.handSize, rng);
  epoch.influence = setting.rules.influenceBaseline;
}

export function resolveCrisis(epoch: Epoch, setting: Setting): CrisisOutcome {
  if (epoch.crisis.status === "resolved" && epoch.crisis.outcome) {
    return epoch.crisis.outcome;
  }
  const order = reversePatternOrder();
  const byPattern = new Map<string, ProjectUnlock[]>();
  for (const u of epoch.unlockedProjects) {
    const arr = byPattern.get(u.pattern) ?? [];
    arr.push(u);
    byPattern.set(u.pattern, arr);
  }
  const contributing: ProjectUnlock[] = [];
  let total = 0;
  for (const pattern of order) {
    const unlocks = (byPattern.get(pattern) ?? []).slice().sort((a, b) => a.turn - b.turn);
    for (const u of unlocks) {
      const project = setting.projects.find((p) => p.id === u.projectId);
      if (!project) continue;
      total += project.value;
      contributing.push(u);
    }
  }
  const cleared = total >= setting.crisis.difficulty;
  const outcome: CrisisOutcome = {
    totalValue: total,
    cleared,
    contributingUnlocks: contributing,
  };
  epoch.crisis = { status: "resolved", outcome };
  epoch.status = cleared ? { kind: "won", outcome } : { kind: "lost", outcome };
  epoch.phase = "end-of-epoch";
  dispatch(epoch, { type: "crisis-resolved", outcome });
  return outcome;
}
