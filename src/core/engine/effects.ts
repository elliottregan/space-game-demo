// EffectSpec resolver. Immediate effects mutate Epoch state directly;
// end-of-turn effects are queued for resolution at end-phase.

import type { Card, EffectSpec, Epoch } from "../types.ts";
import type { RNG } from "./rng.ts";
import { dispatch } from "./dispatch.ts";

export interface EffectContext {
  epoch: Epoch;
  rng: RNG;
}

export function applyEffect(effect: EffectSpec, ctx: EffectContext): void {
  switch (effect.kind) {
    case "noop":
      return;

    case "gainInfluence":
      ctx.epoch.influence += effect.amount;
      return;

    case "draw":
      drawCards(ctx.epoch, effect.count, ctx.rng);
      return;

    case "removeDissent":
      purgeDissent(ctx.epoch, effect.amount);
      return;

    case "addDissent":
      ctx.epoch.endOfTurnQueue.push(effect);
      return;

    case "compound":
      for (const e of effect.effects) applyEffect(e, ctx);
      return;
  }
}

export function resolveEndOfTurn(ctx: EffectContext): void {
  const queue = ctx.epoch.endOfTurnQueue;
  ctx.epoch.endOfTurnQueue = [];

  for (const effect of queue) {
    if (effect.kind === "addDissent") {
      for (let i = 0; i < effect.amount; i++) {
        dispatch(ctx.epoch, { type: "dissent-added" });
      }
    }
  }
}

export function drawCards(epoch: Epoch, count: number, rng: RNG): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (epoch.draw.length === 0) {
      if (epoch.discard.length === 0) break;
      epoch.draw = rng.shuffle(epoch.discard);
      epoch.discard = [];
    }
    const top = epoch.draw.shift();
    if (!top) break;
    epoch.hand.push(top);
    drawn.push(top);
  }
  return drawn;
}

/** Draw until the hand has at least `handSize` cards (or deck+discard exhausted). */
export function drawToHandSize(epoch: Epoch, handSize: number, rng: RNG): Card[] {
  const deficit = Math.max(0, handSize - epoch.hand.length);
  if (deficit === 0) return [];
  return drawCards(epoch, deficit, rng);
}

/** Shuffle `count` fresh Dissent cards into the draw pile (start-of-turn cost).
 *  Routed through the `dissent-added` dispatch — this is NOT a discard, so it
 *  does not trigger the per-discard Dissent rule. */
export function addDissent(epoch: Epoch, count: number): void {
  for (let i = 0; i < count; i++) {
    dispatch(epoch, { type: "dissent-added" });
  }
}

export function purgeDissent(epoch: Epoch, count: number): number {
  let purged = 0;
  const pools: Card[][] = [epoch.discard, epoch.hand, epoch.draw];
  for (const pool of pools) {
    for (let i = pool.length - 1; i >= 0 && purged < count; i--) {
      if (pool[i].tags.includes("dissent")) {
        pool.splice(i, 1);
        purged++;
      }
    }
    if (purged >= count) break;
  }
  return purged;
}

export function countDissentInDeck(epoch: Epoch): { dissent: number; total: number } {
  const all = [...epoch.hand, ...epoch.draw, ...epoch.discard];
  const total = all.length;
  const dissent = all.filter((c) => c.tags.includes("dissent")).length;
  return { dissent, total };
}
