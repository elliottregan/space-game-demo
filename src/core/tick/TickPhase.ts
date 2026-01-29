import type { TickContext } from "./TickContext";
import type { GameEvent } from "../models/GameEvent";

/**
 * A named unit of computation in the game tick.
 * Declares explicit data dependencies via reads/writes.
 */
export interface TickPhase {
  /** Unique identifier, e.g., "buildings:processConstruction" */
  id: string;

  /** Human-readable name, e.g., "Process Construction" */
  name: string;

  /** Data paths this phase reads from */
  reads: readonly string[];

  /** Data paths this phase writes to */
  writes: readonly string[];

  /** Execute the phase, returning any generated events */
  execute(ctx: TickContext): GameEvent[];
}

/**
 * Helper to create a phase with proper typing.
 */
export function definePhase(phase: TickPhase): TickPhase {
  return phase;
}
