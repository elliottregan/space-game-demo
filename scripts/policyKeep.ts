// Shared greedy policy-keep heuristic for the simulation scripts.
//
// A turn that drew policy cards opens in `turnPhase === "policy"`; board verbs
// and `endTurn` are core-gated until it is resolved via `enactPolicies`. These
// scripts resolve it by keeping beneficial candidates that fit the 5-slot
// tableau (stacking onto matching ids for free) and discarding the rest.
// Returns the keepIds to pass to `api.enactPolicies()`.
//
// Heuristic: prefer draw/influence/storage policies for scarce slots; keep a
// candidate when it stacks an already-kept/slotted id OR a projected distinct
// slot is still free; never spend a fresh slot on Conscription's +1 Dissent
// cost (only stack it).

import { POLICY_SLOT_CAP } from "../src/core/data/policies.ts";
import type { PolicyCard, PolicySlot } from "../src/core/types.ts";

const PRIORITY: Record<string, number> = {
  mobilize: 5,
  mandate: 5,
  stockpile: 5,
  "solidarity-forever": 5,
  "deep-reserves": 5,
  continuity: 3,
  archive: 2,
  conscription: 0,
};

export function pickPolicyKeepIds(candidates: PolicyCard[], tableau: PolicySlot[]): string[] {
  const ordered = [...candidates].sort((a, b) => (PRIORITY[b.id] ?? 0) - (PRIORITY[a.id] ?? 0));
  const slottedIds = new Set(tableau.map((t) => t.card.id));
  const keepIds: string[] = [];
  const keptNewDistinct = new Set<string>(); // distinct kept ids needing a fresh slot
  const usedSlots = tableau.length;

  for (const c of ordered) {
    const stacks = slottedIds.has(c.id) || keptNewDistinct.has(c.id);
    if (!stacks && c.id === "conscription") continue; // don't pay a slot for a downside
    const freeSlot = usedSlots + keptNewDistinct.size < POLICY_SLOT_CAP;
    if (stacks || freeSlot) {
      keepIds.push(c.id);
      if (!slottedIds.has(c.id)) keptNewDistinct.add(c.id);
    }
  }

  return keepIds;
}
