import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";
import type { GameEvent } from "../../models/GameEvent";

/**
 * Process Buildings Tick Phase (Combined)
 *
 * Handles all building processing including construction progress,
 * repairs, recycling, and maintenance decay. This is a transitional
 * combined phase that will be split into finer-grained phases later.
 */
export const processBuildingsTick = definePhase({
  id: "buildings:processBuildingsTick",
  name: "Process Buildings Tick",
  reads: ["buildings", "resources", "currentSol"],
  writes: ["buildings", "resources", "events"],
  execute(ctx: TickContext): GameEvent[] {
    return ctx.buildings.tick(ctx.resources, ctx.currentSol);
  },
});

// Stub phases for future fine-grained implementation

/**
 * Process Construction Phase (Stub)
 *
 * Will handle construction progress for pending buildings.
 * Currently a no-op - use processBuildingsTick instead.
 */
export const processConstruction = definePhase({
  id: "buildings:processConstruction",
  name: "Process Construction",
  reads: ["buildings", "resources"],
  writes: ["buildings", "resources", "events"],
  execute(_ctx: TickContext): GameEvent[] {
    // Stub - logic handled by processBuildingsTick
    return [];
  },
});

/**
 * Process Repairs Phase (Stub)
 *
 * Will handle repair progress for broken buildings.
 * Currently a no-op - use processBuildingsTick instead.
 */
export const processRepairs = definePhase({
  id: "buildings:processRepairs",
  name: "Process Repairs",
  reads: ["buildings", "resources"],
  writes: ["buildings", "resources", "events"],
  execute(_ctx: TickContext): GameEvent[] {
    // Stub - logic handled by processBuildingsTick
    return [];
  },
});

/**
 * Process Recycling Phase (Stub)
 *
 * Will handle recycling progress and building removal.
 * Currently a no-op - use processBuildingsTick instead.
 */
export const processRecycling = definePhase({
  id: "buildings:processRecycling",
  name: "Process Recycling",
  reads: ["buildings", "resources"],
  writes: ["buildings", "resources", "events"],
  execute(_ctx: TickContext): GameEvent[] {
    // Stub - logic handled by processBuildingsTick
    return [];
  },
});

/**
 * Process Maintenance Decay Phase (Stub)
 *
 * Will handle building condition decay over time.
 * Currently a no-op - use processBuildingsTick instead.
 */
export const processMaintenanceDecay = definePhase({
  id: "buildings:processMaintenanceDecay",
  name: "Process Maintenance Decay",
  reads: ["buildings", "currentSol"],
  writes: ["buildings", "resources", "events"],
  execute(_ctx: TickContext): GameEvent[] {
    // Stub - logic handled by processBuildingsTick
    return [];
  },
});
