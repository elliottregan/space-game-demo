// The single layer where policy effects apply to a Setting's base rules.
// Every consumer (start-of-turn influence reset, hand draw, storage capacity,
// end-of-turn cycle, dissent add/purge) reads its knob from here instead of
// from setting.rules directly, so policy power has exactly one source of truth.

import { ideologyInfluence } from "../data/projects.ts";
import type { PolicyModifier } from "../data/policies.ts";
import type { Setting } from "../settings/index.ts";
import type { Epoch } from "./epoch.ts";

/** Setting rules with every slotted policy's numeric effects folded in. */
export interface EffectiveRules {
  handSize: number;
  influenceBaseline: number;
  storageCapacity: number;
  endTurnKeep: number;
  dissentPurge: number;
  dissentAdd: number;
}

/** Fold a PolicyModifier into the accumulator `times` times. */
function applyModifier(acc: EffectiveRules, mod: PolicyModifier, times: number): void {
  if (times === 0) return;
  if (mod.handSize) acc.handSize += mod.handSize * times;
  if (mod.influence) acc.influenceBaseline += mod.influence * times;
  if (mod.storage) acc.storageCapacity += mod.storage * times;
  if (mod.endTurnKeep) acc.endTurnKeep += mod.endTurnKeep * times;
  if (mod.dissentPurge) acc.dissentPurge += mod.dissentPurge * times;
  if (mod.dissentAdd) acc.dissentAdd += mod.dissentAdd * times;
}

/** Resolve the Setting's base rules through the epoch's policy tableau. */
export function effectiveRules(epoch: Epoch, setting: Setting): EffectiveRules {
  const acc: EffectiveRules = {
    handSize: setting.rules.baseHandSize,
    influenceBaseline: setting.rules.baseInfluenceBaseline,
    storageCapacity: setting.rules.baseStorageCapacity,
    endTurnKeep: 0,
    dissentPurge: 0,
    dissentAdd: 0,
  };

  const influence = ideologyInfluence(epoch.unlockedProjects);

  for (const { card, stacks } of epoch.policy.tableau) {
    applyModifier(acc, card.base, stacks);
    if (card.scale) {
      const steps = Math.floor(influence[card.scale.ideology] / card.scale.per);
      applyModifier(acc, card.scale.mod, steps * stacks);
    }
  }

  return acc;
}
