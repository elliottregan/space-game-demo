/**
 * Card flight animations (Web Animations API).
 *
 * Cards entering the hand fly up off the deck pile; cards leaving toward the
 * discard fly down onto it, scaling between pile size and card size along an
 * adjustable arc. The hand's <TransitionGroup> JS hooks call into here, so
 * the renderer stays declarative and all motion tuning lives in CARD_FLIGHT.
 */

export interface CardFlightConfig {
  /** Flight time per card, ms. */
  durationMs: number;
  /** CSS easing for the flight (any value valid in animation-timing-function). */
  easing: string;
  /** Delay between successive cards when several fly in one batch, ms. */
  staggerMs: number;
  /**
   * Path shape: vertical lift (px) applied at the midpoint of the flight.
   * Positive bows the path upward, negative downward, 0 is a straight line.
   */
  arcHeight: number;
  /** Fade/shrink time for cards leaving the hand to somewhere other than the discard (e.g. placed on the tableau), ms. */
  placedFadeMs: number;
}

export const CARD_FLIGHT: CardFlightConfig = {
  durationMs: 420,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  staggerMs: 55,
  arcHeight: 48,
  placedFadeMs: 160,
};

export type PileKind = "deck" | "discard";

const piles = new Map<PileKind, HTMLElement>();

/** Pile panels register their stack element so flights know where to start/land. */
export function registerPile(kind: PileKind, el: HTMLElement | null): void {
  if (el) piles.set(kind, el);
  else piles.delete(kind);
}

function pileRect(kind: PileKind): DOMRect | null {
  return piles.get(kind)?.getBoundingClientRect() ?? null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Per-batch index for staggering: counts calls within one frame, then resets. */
function batchCounter(): () => number {
  let n = 0;
  let resetQueued = false;
  return () => {
    if (!resetQueued) {
      resetQueued = true;
      requestAnimationFrame(() => {
        n = 0;
        resetQueued = false;
      });
    }
    return n++;
  };
}

const nextDrawIndex = batchCounter();
const nextDiscardIndex = batchCounter();

/** Uniform scale that fits the card into the pile's footprint. */
function pileScale(pile: DOMRect, card: DOMRect): number {
  return Math.min(pile.width / card.width, pile.height / card.height);
}

/**
 * Keyframes from the pile (offset 0) to the card's natural spot (offset 1),
 * bowed by arcHeight at the midpoint. Reverse for outbound flights.
 */
function flightFrames(dx: number, dy: number, scale: number): Keyframe[] {
  const mid = (1 + scale) / 2;
  return [
    { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
    {
      transform: `translate(${dx / 2}px, ${dy / 2 - CARD_FLIGHT.arcHeight}px) scale(${mid})`,
    },
    { transform: "translate(0, 0) scale(1)" },
  ];
}

function finish(anim: Animation, done: () => void): void {
  anim.finished.then(done, done);
}

/** Fly a freshly drawn card from the deck pile to its slot in the hand. */
export function animateDraw(el: HTMLElement, done: () => void): void {
  const from = pileRect("deck");
  if (!from || prefersReducedMotion()) return done();
  const rect = el.getBoundingClientRect();
  el.style.transformOrigin = "top left";
  const anim = el.animate(
    flightFrames(from.left - rect.left, from.top - rect.top, pileScale(from, rect)),
    {
      duration: CARD_FLIGHT.durationMs,
      easing: CARD_FLIGHT.easing,
      delay: nextDrawIndex() * CARD_FLIGHT.staggerMs,
      fill: "backwards",
    },
  );
  finish(anim, done);
}

/**
 * Take the leaving card out of flow (pinned at its current spot, so siblings
 * reflow and the move transition kicks in immediately), then fly it onto the
 * discard pile along the reverse of the draw path.
 */
export function animateDiscard(el: HTMLElement, done: () => void): void {
  const to = pileRect("discard");
  if (!to || prefersReducedMotion()) return done();
  const rect = el.getBoundingClientRect();
  pin(el, rect);
  const anim = el.animate(
    flightFrames(to.left - rect.left, to.top - rect.top, pileScale(to, rect)).reverse(),
    {
      duration: CARD_FLIGHT.durationMs,
      easing: CARD_FLIGHT.easing,
      delay: nextDiscardIndex() * CARD_FLIGHT.staggerMs,
      fill: "both",
    },
  );
  finish(anim, done);
}

/** Card left the hand but not for the discard (placed on the tableau): quick fade in place. */
export function animatePlaced(el: HTMLElement, done: () => void): void {
  if (prefersReducedMotion()) return done();
  pin(el, el.getBoundingClientRect());
  const anim = el.animate(
    [
      { opacity: 1, transform: "scale(1)" },
      { opacity: 0, transform: "scale(0.85)" },
    ],
    { duration: CARD_FLIGHT.placedFadeMs, easing: "ease-out", fill: "both" },
  );
  finish(anim, done);
}

function pin(el: HTMLElement, rect: DOMRect): void {
  Object.assign(el.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: "40",
    pointerEvents: "none",
    transformOrigin: "top left",
  });
}
