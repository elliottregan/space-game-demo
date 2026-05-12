// EffectSpec resolver. Immediate effects mutate Epoch state directly;
// end-of-turn effects are queued for resolution at end-phase.

import type { Card, EffectSpec, Epoch } from "./types.ts";
import { makeDissent } from "./cards.ts";
import type { RNG } from "./rng.ts";
import { dispatch } from "./dispatch.ts";

export interface EffectContext {
  epoch: Epoch;
  rng: RNG;
  log: (text: string) => void;
}

export function applyEffect(effect: EffectSpec, ctx: EffectContext): void {
  switch (effect.kind) {
    case "noop":
      return;

    case "gainInfluence":
      ctx.epoch.influence += effect.amount;
      return;

    case "gainMaterials":
      ctx.epoch.materials += effect.amount;
      return;

    case "draw":
      drawCards(ctx.epoch, effect.count, ctx.rng);
      return;

    case "removeDissent":
      purgeDissent(ctx.epoch, effect.amount);
      return;

    case "shiftIdeology":
      applyTransientShift(ctx.epoch, effect.axis, effect.amount);
      return;

    case "peekMarket":
      ctx.log(`Peek: top ${effect.count} of market.`);
      return;

    case "nextAcquireDiscount":
      ctx.epoch.materials += effect.amount;
      return;

    case "addDissent":
      ctx.epoch.endOfTurnQueue.push(effect);
      return;

    case "discount":
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
    switch (effect.kind) {
      case "addDissent": {
        ctx.log(`+${effect.amount} ${effect.variant} added to deck.`);
        for (let i = 0; i < effect.amount; i++) {
          dispatch(ctx.epoch, { type: "dissent-added", variant: effect.variant });
        }
        break;
      }
      default:
        break;
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
    if (top.tags.includes("dissent") && top.name === "Unrest") {
      const quiet = makeDissent("quiet");
      epoch.draw.push(quiet);
      epoch.draw = rng.shuffle(epoch.draw);
    }
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

export function purgeDissent(epoch: Epoch, count: number): number {
  let purged = 0;
  const pools: Card[][] = [epoch.discard, epoch.hand, epoch.draw];
  for (const pool of pools) {
    for (let i = pool.length - 1; i >= 0 && purged < count; i--) {
      if (pool[i]!.tags.includes("dissent")) {
        pool.splice(i, 1);
        purged++;
      }
    }
    if (purged >= count) break;
  }
  return purged;
}

function applyTransientShift(
  epoch: Epoch & { __shift?: { axis1: number; axis2: number } },
  axis: "axis1" | "axis2",
  amount: number,
): void {
  if (!epoch.__shift) epoch.__shift = { axis1: 0, axis2: 0 };
  epoch.__shift[axis] += amount;
}

export function getTransientShift(epoch: Epoch): { axis1: number; axis2: number } {
  const e = epoch as Epoch & { __shift?: { axis1: number; axis2: number } };
  return e.__shift ?? { axis1: 0, axis2: 0 };
}

export function countDissentInDeck(epoch: Epoch): { dissent: number; total: number } {
  const all = [...epoch.hand, ...epoch.draw, ...epoch.discard];
  const total = all.length;
  const dissent = all.filter((c) => c.tags.includes("dissent")).length;
  return { dissent, total };
}
