import type { GameEvent } from "../models/GameEvent";
import type { TickContext } from "./TickContext";
import type { TickPhase } from "./TickPhase";

/**
 * Orchestrates phase execution during a game tick.
 * Automatically orders phases based on their read/write dependencies.
 */
export class TickRunner {
  private phases: Map<string, TickPhase> = new Map();
  private executionOrder: string[] = [];
  private dirty: boolean = true;

  /**
   * Register a phase. Call recomputeOrder() after all phases are registered.
   */
  register(phase: TickPhase): void {
    if (this.phases.has(phase.id)) {
      throw new Error(`Phase with id "${phase.id}" already registered`);
    }
    this.phases.set(phase.id, phase);
    this.dirty = true;
  }

  /**
   * Build execution order from dependency graph using topological sort.
   * A phase must run after any phase that writes to something it reads.
   */
  recomputeOrder(): void {
    // Build a map of data path -> phase id that writes it
    const writers = new Map<string, string>();
    for (const [id, phase] of this.phases) {
      for (const path of phase.writes) {
        writers.set(path, id);
      }
    }

    // Build dependency graph: phase id -> set of phase ids that must run before it
    const deps = new Map<string, Set<string>>();
    for (const [id, phase] of this.phases) {
      deps.set(id, new Set());
      for (const path of phase.reads) {
        const writerId = writers.get(path);
        if (writerId && writerId !== id) {
          deps.get(id)?.add(writerId);
        }
      }
    }

    // Kahn's algorithm for topological sort
    const inDegree = new Map<string, number>();
    for (const id of this.phases.keys()) {
      inDegree.set(id, deps.get(id)?.size ?? 0);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      result.push(id);

      // Find phases that depend on this one
      for (const [depId, depSet] of deps) {
        if (depSet.has(id)) {
          const currentDegree = inDegree.get(depId) ?? 0;
          const newDegree = currentDegree - 1;
          inDegree.set(depId, newDegree);
          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      }
    }

    if (result.length !== this.phases.size) {
      throw new Error("Cycle detected in phase dependencies");
    }

    this.executionOrder = result;
    this.dirty = false;
  }

  /**
   * Execute all phases in order, returning collected events.
   */
  tick(ctx: TickContext): GameEvent[] {
    if (this.dirty) {
      this.recomputeOrder();
    }

    const events: GameEvent[] = [];

    for (const phaseId of this.executionOrder) {
      const phase = this.phases.get(phaseId);
      if (!phase) continue;
      const phaseEvents = phase.execute(ctx);
      events.push(...phaseEvents);
    }

    return events;
  }

  /**
   * Get the computed execution order (for debugging/display).
   */
  getExecutionOrder(): Array<{ id: string; name: string }> {
    if (this.dirty) {
      this.recomputeOrder();
    }

    return this.executionOrder.map((id) => ({
      id,
      name: this.phases.get(id)?.name ?? id,
    }));
  }

  /**
   * Get a registered phase by id.
   */
  getPhase(id: string): TickPhase | undefined {
    return this.phases.get(id);
  }

  /**
   * Get all registered phases.
   */
  getAllPhases(): TickPhase[] {
    return Array.from(this.phases.values());
  }
}
