// Human-readable descriptions of policy cards (the M4 Policy Tableau).
// Mirrors the terse token style of util/effects.ts describeEffectSpec.
// Pure — no Vue.

import type { PolicyCard, PolicyModifier } from "../../core/types.ts";
import { IDEOLOGY_DISPLAY } from "../../core/data/ideologies.ts";

/** Compact tokens for a single modifier, in a stable display order. */
export function describeModifier(mod: PolicyModifier): string[] {
  const tokens: string[] = [];
  if (mod.handSize) tokens.push(`${signed(mod.handSize)} Hand`);
  if (mod.influence) tokens.push(`${signed(mod.influence)} Influence`);
  if (mod.storage) tokens.push(`${signed(mod.storage)} Storage`);
  if (mod.endTurnKeep) tokens.push(`Keep ${mod.endTurnKeep}`);
  if (mod.dissentPurge) tokens.push(`-${mod.dissentPurge} Dissent`);
  if (mod.dissentAdd) tokens.push(`${signed(mod.dissentAdd)} Dissent (cost)`);
  return tokens;
}

/** One-line description of a policy: base tokens, then any scale clause. */
export function describePolicy(card: PolicyCard): string {
  const parts = [describeModifier(card.base).join(", ")];
  if (card.scale) {
    const per = describeModifier(card.scale.mod).join(", ");
    const ideology = IDEOLOGY_DISPLAY[card.scale.ideology].name;
    parts.push(`${per} / ${card.scale.per} ${ideology}`);
  }
  return parts.filter(Boolean).join("  •  ");
}

/** Render a positive number with an explicit leading "+". */
function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
