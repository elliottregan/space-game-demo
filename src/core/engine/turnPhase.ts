// Turn-phase model — the ordered sub-phases a turn moves through while the
// Epoch lifecycle `phase` is "play". Orthogonal to EpochPhase: `turnPhase` is
// only meaningful while `epoch.phase === "play"`.
//
// Kept deliberately pure — no CmdResult / command dependency. Rejection of
// out-of-phase commands lives in commands.ts.

import type { Epoch } from "./epoch.ts";

export type TurnPhase = "policy" | "play";

/** Ordered list of turn sub-phases. Future phases extend here. */
export const TURN_PHASE_ORDER: TurnPhase[] = ["policy", "play"];

/** The phase a turn opens in: policy if there are candidates to resolve,
 *  otherwise straight into play. */
export function openingTurnPhase(hasPolicyCandidates: boolean): TurnPhase {
  return hasPolicyCandidates ? "policy" : "play";
}

export function isPlayPhase(epoch: Epoch): boolean {
  return epoch.turnPhase === "play";
}

export function isPolicyPhase(epoch: Epoch): boolean {
  return epoch.turnPhase === "policy";
}
