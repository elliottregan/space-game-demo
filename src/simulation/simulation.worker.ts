// src/simulation/simulation.worker.ts
// Worker thread for running simulation batches in parallel

import { rng } from "../core/utils/random";
import { GameAPI } from "../facade/GameAPI";
import { HeuristicStrategy } from "./HeuristicStrategy";
import type {
  CrisisPoint,
  CrisisSeverity,
  CrisisType,
  DefeatReason,
  ResourceFlowSnapshot,
  ResourceSnapshot,
  RunResult,
  VictoryType,
} from "./types";

declare const self: Worker;

/**
 * Maximum sols to run before considering a game stuck.
 */
const MAX_SOLS = 5000;

/**
 * Interval at which resource snapshots are taken.
 */
const SNAPSHOT_INTERVAL = 50;

/**
 * Thresholds for detecting crisis conditions.
 */
const CRISIS_THRESHOLDS = {
  food: { warning: 30, critical: 10 },
  water: { warning: 20, critical: 5 },
  morale: { warning: 40, critical: 25 },
  cohesion: { warning: 0.15, critical: 0.08 },
} as const;

/**
 * Convert a Map to a Record object.
 */
function mapToRecord<V>(map: Map<string, V>): Record<string, V> {
  const record: Record<string, V> = {};
  for (const [key, value] of map) {
    record[key] = value;
  }
  return record;
}

/**
 * Message types for worker communication
 */
export interface WorkerInput {
  type: "run";
  seeds: number[];
  workerId: number;
}

export interface WorkerOutput {
  type: "results" | "progress";
  results?: RunResult[];
  workerId?: number;
  completed?: number;
  total?: number;
}

/**
 * Detect crisis conditions and record them.
 */
function detectCrisis(
  sol: number,
  resources: { food: number; water: number },
  morale: number,
  crisisTimeline: CrisisPoint[],
  lastCrisisOfType: Map<CrisisType, CrisisPoint>,
): void {
  const checkResource = (
    type: CrisisType,
    value: number,
    thresholds: { warning: number; critical: number },
  ) => {
    let severity: CrisisSeverity | null = null;
    let threshold = 0;

    if (value <= thresholds.critical) {
      severity = "critical";
      threshold = thresholds.critical;
    } else if (value <= thresholds.warning) {
      severity = "warning";
      threshold = thresholds.warning;
    }

    if (severity) {
      const lastCrisis = lastCrisisOfType.get(type);
      if (
        !lastCrisis ||
        lastCrisis.sol < sol - 10 ||
        (lastCrisis.severity === "warning" && severity === "critical")
      ) {
        const crisis: CrisisPoint = { sol, type, severity, value, threshold };
        crisisTimeline.push(crisis);
        lastCrisisOfType.set(type, crisis);
      }
    }
  };

  checkResource("low_food", resources.food, CRISIS_THRESHOLDS.food);
  checkResource("low_water", resources.water, CRISIS_THRESHOLDS.water);
  checkResource("low_morale", morale, CRISIS_THRESHOLDS.morale);
}

/**
 * Detect social cohesion crisis conditions.
 */
function detectCohesionCrisis(
  sol: number,
  cohesion: number,
  crisisTimeline: CrisisPoint[],
  lastCrisisOfType: Map<CrisisType, CrisisPoint>,
): void {
  let severity: CrisisSeverity | null = null;
  let threshold = 0;

  if (cohesion <= CRISIS_THRESHOLDS.cohesion.critical) {
    severity = "critical";
    threshold = CRISIS_THRESHOLDS.cohesion.critical;
  } else if (cohesion <= CRISIS_THRESHOLDS.cohesion.warning) {
    severity = "warning";
    threshold = CRISIS_THRESHOLDS.cohesion.warning;
  }

  if (severity) {
    const lastCrisis = lastCrisisOfType.get("low_cohesion");
    if (
      !lastCrisis ||
      lastCrisis.sol < sol - 10 ||
      (lastCrisis.severity === "warning" && severity === "critical")
    ) {
      const crisis: CrisisPoint = {
        sol,
        type: "low_cohesion",
        severity,
        value: cohesion,
        threshold,
      };
      crisisTimeline.push(crisis);
      lastCrisisOfType.set("low_cohesion", crisis);
    }
  }
}

/**
 * Map victory reason string to VictoryType.
 */
function mapVictoryType(reason?: string): VictoryType {
  if (!reason) return "population";

  const lowerReason = reason.toLowerCase();

  if (lowerReason.includes("colony charter")) return "colony_charter";
  if (lowerReason.includes("generation ship")) return "generation_ship";
  if (lowerReason.includes("100 population") || lowerReason.includes("thriving")) {
    return "population";
  }

  return "population";
}

/**
 * Map defeat reason string to DefeatReason.
 */
function mapDefeatReason(reason?: string): DefeatReason {
  if (!reason) return "population_collapse";

  const lowerReason = reason.toLowerCase();

  if (lowerReason.includes("food") || lowerReason.includes("starv")) return "starvation";
  if (lowerReason.includes("oxygen") || lowerReason.includes("suffocat")) return "suffocation";
  if (lowerReason.includes("population") || lowerReason.includes("below 5")) {
    return "population_collapse";
  }

  return "population_collapse";
}

/**
 * Run a single game to completion.
 */
function runSingleGame(seed: number): RunResult {
  // Seed the global RNG for deterministic results
  rng.seed(seed);

  // Create fresh GameAPI instance
  const api = new GameAPI();

  // Create strategy for decision making
  const strategy = new HeuristicStrategy(api);

  // Initialize tracking - use lightweight snapshots to skip expensive calculations
  let peakPopulation = api.colony.snapshot({ lightweight: true }).population;
  const buildingsBuiltMap = new Map<string, number>();
  const techsResearchedSet = new Set<string>();

  // Enhanced tracking structures
  const resourceTimeline: ResourceSnapshot[] = [];
  const flowTimeline: ResourceFlowSnapshot[] = [];
  const crisisTimeline: CrisisPoint[] = [];
  const buildingFirstBuiltSol = new Map<string, number>();
  const techCompletedSol = new Map<string, number>();
  let previousPopulation = api.colony.snapshot({ lightweight: true }).population;

  // Track last crisis of each type for O(1) lookup
  const lastCrisisOfType = new Map<CrisisType, CrisisPoint>();

  // Track initial researched techs
  for (const tech of api.technology.snapshot().researched) {
    techsResearchedSet.add(tech.id);
    techCompletedSol.set(tech.id, 0);
  }

  // Track initial buildings
  for (const building of api.buildings.snapshot().active) {
    const count = buildingsBuiltMap.get(building.definitionId) ?? 0;
    buildingsBuiltMap.set(building.definitionId, count + 1);
    if (!buildingFirstBuiltSol.has(building.definitionId)) {
      buildingFirstBuiltSol.set(building.definitionId, 0);
    }
  }

  // Game loop
  let solsRun = 0;
  while (!api.game.isGameOver() && solsRun < MAX_SOLS) {
    // Execute strategy tick (make decisions)
    strategy.executeTick();

    // Advance sol
    api.game.advanceSol();
    solsRun++;

    const currentSol = api.game.currentSol();
    const colony = api.colony.snapshot({ lightweight: true });
    const resources = api.resources.snapshot();

    // Update peak population tracking
    const currentPop = colony.population;
    if (currentPop > peakPopulation) {
      peakPopulation = currentPop;
    }

    // Track population drops as crisis events
    if (currentPop < previousPopulation) {
      const drop = previousPopulation - currentPop;
      if (drop >= 3) {
        crisisTimeline.push({
          sol: currentSol,
          type: "population_drop",
          severity: drop >= 5 ? "critical" : "warning",
          value: currentPop,
          threshold: previousPopulation,
        });
      }
    }
    previousPopulation = currentPop;

    // Detect and record crisis conditions
    detectCrisis(currentSol, resources.current, colony.morale, crisisTimeline, lastCrisisOfType);

    // Detect social cohesion crisis
    detectCohesionCrisis(currentSol, colony.socialCohesion, crisisTimeline, lastCrisisOfType);

    // Take periodic snapshots
    if (currentSol % SNAPSHOT_INTERVAL === 0) {
      // Count isolated colonists
      const isolatedCount = colony.colonists.filter(
        (c) => !colony.coworkerRelationships.has(c.id),
      ).length;

      resourceTimeline.push({
        sol: currentSol,
        food: resources.current.food,
        water: resources.current.water,
        power: resources.current.power,
        materials: resources.current.materials,
        population: currentPop,
        morale: colony.morale,
        health: colony.health,
        socialCohesion: colony.socialCohesion,
        isolatedColonists: isolatedCount,
      });

      flowTimeline.push({
        sol: currentSol,
        netFood: (resources.production.food ?? 0) - (resources.consumption.food ?? 0),
        netWater: (resources.production.water ?? 0) - (resources.consumption.water ?? 0),
        netPower: (resources.production.power ?? 0) - (resources.consumption.power ?? 0),
        netMaterials:
          (resources.production.materials ?? 0) - (resources.consumption.materials ?? 0),
      });
    }

    // Track newly researched techs
    for (const tech of api.technology.snapshot().researched) {
      if (!techsResearchedSet.has(tech.id)) {
        techsResearchedSet.add(tech.id);
        techCompletedSol.set(tech.id, currentSol);
      }
    }

    // Track buildings
    const buildingSnapshot = api.buildings.snapshot();

    // Count buildings by definition ID
    const currentCounts = new Map<string, number>();
    for (const building of buildingSnapshot.active) {
      const count = currentCounts.get(building.definitionId) ?? 0;
      currentCounts.set(building.definitionId, count + 1);
    }
    for (const building of buildingSnapshot.pending) {
      const count = currentCounts.get(building.definitionId) ?? 0;
      currentCounts.set(building.definitionId, count + 1);
    }

    // Update tracking with max seen counts and first-built sol
    for (const [defId, count] of currentCounts) {
      const prevMax = buildingsBuiltMap.get(defId) ?? 0;
      if (count > prevMax) {
        buildingsBuiltMap.set(defId, count);
        if (!buildingFirstBuiltSol.has(defId)) {
          buildingFirstBuiltSol.set(defId, currentSol);
        }
      }
    }
  }

  // Determine outcome from victory state
  const victoryState = api.game.victoryState();
  const finalSol = api.game.currentSol();

  // Capture resources at death if defeated
  let resourcesAtDeath: ResourceSnapshot | undefined;
  let defeatSol: number | undefined;
  if (victoryState.status !== "victory") {
    defeatSol = finalSol;
    const resources = api.resources.snapshot();
    const colony = api.colony.snapshot({ lightweight: true });
    const isolatedCount = colony.colonists.filter(
      (c) => !colony.coworkerRelationships.has(c.id),
    ).length;
    resourcesAtDeath = {
      sol: finalSol,
      food: resources.current.food,
      water: resources.current.water,
      power: resources.current.power,
      materials: resources.current.materials,
      population: colony.population,
      morale: colony.morale,
      health: colony.health,
      socialCohesion: colony.socialCohesion,
      isolatedColonists: isolatedCount,
    };
  }

  // Get blocked decisions and events from strategy
  const blockedDecisions = strategy.getBlockedDecisions();
  const eventsOccurred = strategy.getEventsOccurred();

  const outcome = victoryState.status === "victory" ? "victory" : "defeat";
  const victoryType = outcome === "victory" ? mapVictoryType(victoryState.reason) : undefined;
  const defeatReason = outcome === "defeat" ? mapDefeatReason(victoryState.reason) : undefined;

  // Convert maps to records
  const buildingsRecord = mapToRecord(buildingsBuiltMap);
  const buildingFirstBuiltSolRecord = mapToRecord(buildingFirstBuiltSol);
  const techCompletedSolRecord = mapToRecord(techCompletedSol);

  return {
    seed,
    outcome,
    victoryType,
    defeatReason,
    finalSol,
    peakPopulation,
    techsResearched: Array.from(techsResearchedSet),
    buildingsBuilt: buildingsRecord,
    resourceTimeline,
    flowTimeline,
    crisisTimeline,
    buildingFirstBuiltSol:
      Object.keys(buildingFirstBuiltSolRecord).length > 0 ? buildingFirstBuiltSolRecord : undefined,
    techCompletedSol:
      Object.keys(techCompletedSolRecord).length > 0 ? techCompletedSolRecord : undefined,
    defeatSol,
    resourcesAtDeath,
    blockedDecisions: blockedDecisions?.length ? blockedDecisions : undefined,
    eventsOccurred: eventsOccurred?.length ? eventsOccurred : undefined,
  };
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const { type, seeds, workerId } = event.data;

  if (type === "run") {
    const results: RunResult[] = [];

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i]!;
      results.push(runSingleGame(seed));

      // Report progress every 10 runs or at the end
      if ((i + 1) % 10 === 0 || i === seeds.length - 1) {
        self.postMessage({
          type: "progress",
          workerId,
          completed: i + 1,
          total: seeds.length,
        } satisfies WorkerOutput);
      }
    }

    self.postMessage({
      type: "results",
      results,
      workerId,
    } satisfies WorkerOutput);
  }
};
