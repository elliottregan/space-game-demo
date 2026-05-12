// Human-readable descriptions of the serializable EffectSpec DSL.
// Used by card rendering and end-of-epoch legacy previews.

import type { EffectSpec } from "../../core/types.ts";

export function describeEffectSpec(effect: EffectSpec): string {
  switch (effect.kind) {
    case "noop":
      return "";
    case "gainInfluence":
      return `+${effect.amount} Influence`;
    case "gainMaterials":
      return `+${effect.amount} Materials`;
    case "draw":
      return `Draw ${effect.count}`;
    case "addDissent":
      if (effect.variant === "backlash")
        return `+${effect.amount} Backlash · ${capitalize(effect.ideology ?? "")}`;
      if (effect.variant === "unrest") return `+${effect.amount} Unrest`;
      return `+${effect.amount} Quiet Dissent`;
    case "removeDissent":
      return `Purge ${effect.amount} Dissent`;
    case "shiftIdeology":
      return `Shift ${effect.axis} ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "peekMarket":
      return `Peek ${effect.count}`;
    case "nextAcquireDiscount":
      return `Next acquire −${effect.amount}`;
    case "discount":
      return `Discount ${effect.amount}`;
    case "compound":
      return effect.effects.map(describeEffectSpec).filter(Boolean).join(", ");
  }
  return "";
}

/** Flatten a compound effect into an array of leaf-effect strings. */
export function flattenEffect(effect: EffectSpec): string[] {
  if (effect.kind === "compound") {
    return effect.effects.flatMap(flattenEffect).filter((s) => s.length > 0);
  }
  const s = describeEffectSpec(effect);
  return s ? [s] : [];
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : "";
}
