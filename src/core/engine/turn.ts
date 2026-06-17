// End-of-turn and Crisis-resolution flow.

import type {
  Campaign,
  CrisisContribution,
  CrisisOutcome,
  Epoch,
  ProjectUnlock,
  Setting,
} from "../types.ts";
import { projectLevels, reversePatternOrder } from "../data/projects.ts";
import { drawToHandSize, resolveEndOfTurn } from "./effects.ts";
import { dispatch } from "./dispatch.ts";
import type { RNG } from "./rng.ts";

export function endTurn(epoch: Epoch, _campaign: Campaign, setting: Setting, rng: RNG): void {
  if (epoch.status.kind !== "in-progress") return;
  if (epoch.phase !== "play") return;

  // Resolve queued end-of-turn effects (addDissent etc.).
  resolveEndOfTurn({ epoch, rng });

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
  const contributingUnlocks: ProjectUnlock[] = [];
  const contributions: CrisisContribution[] = [];
  let total = 0;
  for (const pattern of order) {
    const unlocks = (byPattern.get(pattern) ?? []).slice().sort((a, b) => a.turn - b.turn);
    const countByProject = new Map<string, number>();
    for (const u of unlocks) {
      const project = setting.projects.find((p) => p.id === u.projectId);
      if (!project) continue;
      const idx = countByProject.get(u.projectId) ?? 0;
      const levels = projectLevels(project);
      const value = levels[Math.min(idx, levels.length - 1)].value;
      countByProject.set(u.projectId, idx + 1);
      total += value;
      contributingUnlocks.push(u);
      contributions.push({
        projectId: u.projectId,
        pattern,
        name: project.name,
        turn: u.turn,
        level: idx + 1,
        value,
      });
    }
  }
  const cleared = total >= setting.crisis.difficulty;
  const outcome: CrisisOutcome = {
    totalValue: total,
    cleared,
    contributingUnlocks,
    contributions,
  };
  epoch.crisis = { status: "resolved", outcome };
  epoch.status = cleared ? { kind: "won", outcome } : { kind: "lost", outcome };
  epoch.phase = "end-of-epoch";
  dispatch(epoch, { type: "crisis-resolved", outcome });
  return outcome;
}
