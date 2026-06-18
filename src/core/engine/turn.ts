// End-of-turn and Crisis-resolution flow.

import type {
  Campaign,
  CrisisContribution,
  CrisisOutcome,
  Epoch,
  ProjectUnlock,
  Setting,
} from "../types.ts";
import { ideologyInfluence, projectLevels, reversePatternOrder } from "../data/projects.ts";
import { IDEOLOGIES } from "../data/ideologies.ts";
import { isWon } from "./crisisTree.ts";
import { addDissent, drawToHandSize, purgeDissent, resolveEndOfTurn } from "./effects.ts";
import { dispatch } from "./dispatch.ts";
import { effectiveRules } from "./effectiveRules.ts";
import { openingTurnPhase } from "./turnPhase.ts";
import type { RNG } from "./rng.ts";

/**
 * Start-of-turn policy draw. For each ideology, draw `ideologyInfluence[I]`
 * cards from `decks[I]` into `policy.candidates`. When a deck empties mid-draw,
 * its discard reshuffles back in (rng.shuffle) and the draw continues; if both
 * are empty we simply draw fewer. Turn 1 has no unlocks → all influence is 0 →
 * nothing is drawn (the intended cold open). Exported for the turn-flow tail and
 * for tests.
 */
export function drawPolicies(epoch: Epoch, rng: RNG): void {
  const influence = ideologyInfluence(epoch.unlockedProjects);
  for (const ideology of IDEOLOGIES) {
    let need = influence[ideology];
    while (need > 0) {
      const deck = epoch.policy.decks[ideology];
      if (deck.length === 0) {
        const discard = epoch.policy.discards[ideology];
        if (discard.length === 0) break; // deck + discard both dry → draw fewer
        epoch.policy.decks[ideology] = rng.shuffle(discard);
        epoch.policy.discards[ideology] = [];
        continue;
      }
      const card = epoch.policy.decks[ideology].shift();
      if (card) epoch.policy.candidates.push(card);
      need -= 1;
    }
  }
}

export function endTurn(epoch: Epoch, _campaign: Campaign, setting: Setting, rng: RNG): void {
  if (epoch.status.kind !== "in-progress") return;
  if (epoch.phase !== "play") return;
  // A turn can only be ended from the play phase; pending policy must resolve
  // first. turnPhase is orthogonal to the lifecycle `phase` above.
  if (epoch.turnPhase !== "play") return;

  const er = effectiveRules(epoch, setting);

  // Flush any policy candidates the player did not slot back into their
  // ideology's discard pile so they cycle, then clear the candidate area.
  for (const card of epoch.policy.candidates) {
    epoch.policy.discards[card.ideology].push(card);
  }
  epoch.policy.candidates = [];

  // Resolve queued end-of-turn effects (addDissent etc.).
  resolveEndOfTurn({ epoch, rng });

  // End-of-turn hand cycle: keep the first er.endTurnKeep NON-DISSENT cards;
  // cycle everything else (including any inert Dissent) to discard without
  // triggering the per-discard Dissent rule. Carrying a Dissent across the turn
  // would waste an Archive keep slot on an unplayable card, so it is skipped.
  // (endTurnKeep is 0 by default, so this cycles the whole hand as before.)
  const kept: typeof epoch.hand = [];
  const cycled: typeof epoch.hand = [];
  for (const card of epoch.hand) {
    if (kept.length < er.endTurnKeep && !card.tags.includes("dissent")) {
      kept.push(card);
    } else {
      cycled.push(card);
    }
  }
  epoch.hand = kept;
  epoch.discard.push(...cycled);

  dispatch(epoch, { type: "turn-ended", turn: epoch.turn });
  epoch.turn += 1;

  if (epoch.turn > setting.rules.maxTurns) {
    epoch.phase = "crisis";
    return;
  }

  // Start of turn. Dissent add (a cost) then purge, then influence reset and
  // draw — all sized by the policy tableau via effectiveRules.
  addDissent(epoch, er.dissentAdd, rng);
  purgeDissent(epoch, er.dissentPurge);
  epoch.influence = er.influenceBaseline;
  drawToHandSize(epoch, er.handSize, rng);

  // Policy draw: reveal this turn's candidates, scaled by majority influence.
  drawPolicies(epoch, rng);

  // Open the new turn in the policy phase iff there are candidates to resolve;
  // otherwise straight into play. (The crisis early-return above never reaches
  // here, so a crisis turn leaves turnPhase untouched.)
  epoch.turnPhase = openingTurnPhase(epoch.policy.candidates.length > 0);
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
  const cleared = isWon(setting.crisisTree, epoch.crisisTree);
  const clearedNodeIds = cleared
    ? epoch.crisisTree.cleared.filter((id) => setting.crisisTree.nodes[id]?.terminal)
    : [];
  const outcome: CrisisOutcome = {
    totalValue: total,
    cleared,
    clearedNodeIds,
    contributingUnlocks,
    contributions,
  };
  epoch.crisis = { status: "resolved", outcome };
  epoch.status = cleared ? { kind: "won", outcome } : { kind: "lost", outcome };
  epoch.phase = "end-of-epoch";
  dispatch(epoch, { type: "crisis-resolved", outcome });
  return outcome;
}
