import { TickRunner } from "../TickRunner";

/**
 * Create a TickRunner with all standard game phases registered.
 * Phases are added incrementally as they are extracted from managers.
 */
export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // Phases will be registered here as they are implemented
  // For now, return empty runner

  runner.recomputeOrder();
  return runner;
}
