// Human-readable descriptions of the serializable EffectSpec DSL.
// Used by card rendering and end-of-epoch legacy previews.

import type { EffectSpec } from "../../core/types.ts";

export function describeEffectSpec(effect: EffectSpec): string {
  switch (effect.kind) {
    case "noop":
      return "";
    case "gainInfluence":
      return `+${effect.amount} Influence`;
    case "draw":
      return `Draw ${effect.count}`;
    case "addDissent":
      return `+${effect.amount} Dissent`;
    case "removeDissent":
      return `Purge ${effect.amount} Dissent`;
    case "compound":
      return effect.effects.map(describeEffectSpec).filter(Boolean).join(", ");
  }
}

/** Flatten a compound effect into an array of leaf-effect strings. */
export function flattenEffect(effect: EffectSpec): string[] {
  if (effect.kind === "compound") {
    return effect.effects.flatMap(flattenEffect).filter((s) => s.length > 0);
  }
  const s = describeEffectSpec(effect);
  return s ? [s] : [];
}
