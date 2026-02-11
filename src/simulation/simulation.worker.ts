// src/simulation/simulation.worker.ts
// Worker thread for running simulation batches in parallel

import { NPCFaction } from "../core/models/NPCInfluence";
import { rng } from "../core/utils/random";
import { GameAPI } from "../facade/GameAPI";
import { HeuristicStrategy } from "./HeuristicStrategy";
import {
  detectIdeologyPockets,
  type CrisisPoint,
  type CrisisSeverity,
  type CrisisType,
  type DefeatReason,
  type IdeologySnapshot,
  type ResourceFlowSnapshot,
  type ResourceSnapshot,
  type RunResult,
  type VictoryType,
} from "./types";
import type { ColonistIdeology } from "../core/models/Colonist";

declare const self: Worker;

/**
 * Maximum sols to run before considering a game stuck.
 */
const MAX_SOLS = 5000;

/**
 * Factions available for strategy targeting.
 * Used to distribute simulation runs across victory paths.
 */
const ALL_FACTIONS = [
  NPCFaction.EarthLoyalists,
  NPCFaction.MarsIndependence,
  NPCFaction.CorporateInterests,
] as const;

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
 * Compute power grid ratio from production and consumption.
 * Returns a value where 1.0 = production >= consumption.
 */
function computePowerRatio(production: number, consumption: number): number {
  if (consumption <= 0) {
    return production > 0 ? 1.0 : 0;
  }
  return Math.min(1.0, production / consumption);
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
 * Victory is achieved by building megastructures after completing capstone projects.
 */
function mapVictoryType(reason?: string): VictoryType {
  if (!reason) return "earth_relief_compact"; // Default fallback

  const lowerReason = reason.toLowerCase();

  // Capstone project victories (legacy - before megastructures were required)
  if (lowerReason.includes("earth relief compact")) return "earth_relief_compact";
  if (lowerReason.includes("declaration of sovereignty")) return "declaration_of_sovereignty";
  if (lowerReason.includes("deep space mining charter")) return "deep_space_mining_charter";

  // Megastructure victories (new victory condition)
  if (lowerReason.includes("space elevator")) return "earth_relief_compact";
  if (lowerReason.includes("united mars station")) return "declaration_of_sovereignty";
  if (lowerReason.includes("asteroid mining platform")) return "deep_space_mining_charter";

  return "earth_relief_compact"; // Default fallback
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
  if (lowerReason.includes("earth") && lowerReason.includes("climate")) {
    return "earth_collapse";
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

  // Select target faction based on seed for balanced victory distribution
  // This ensures ~1/3 of runs target each faction while remaining deterministic
  const targetFaction = ALL_FACTIONS[seed % ALL_FACTIONS.length];

  // Create strategy for decision making with target faction
  const strategy = new HeuristicStrategy(api, { targetFaction });

  // Initialize tracking - use lightweight snapshots to skip expensive calculations
  let peakPopulation = api.colony.snapshot({ lightweight: true }).population;
  const buildingsBuiltMap = new Map<string, number>();
  const techsResearchedSet = new Set<string>();

  // Enhanced tracking structures
  const resourceTimeline: ResourceSnapshot[] = [];
  const flowTimeline: ResourceFlowSnapshot[] = [];
  const crisisTimeline: CrisisPoint[] = [];
  const ideologyTimeline: IdeologySnapshot[] = [];
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
    // Execute strategy tick (make decisions) and record the action taken
    const tickResult = strategy.executeTick();
    strategy.recordAction(tickResult);

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

      const power = api.districts.snapshot().power;
      resourceTimeline.push({
        sol: currentSol,
        food: resources.current.food,
        water: resources.current.water,
        powerGrid: computePowerRatio(power.production, power.consumption),
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
        netMaterials:
          (resources.production.materials ?? 0) - (resources.consumption.materials ?? 0),
      });

      // Capture ideology snapshot
      ideologyTimeline.push(captureIdeologySnapshot(currentSol, colony.colonists));
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
    const pgPower = api.districts.snapshot().power;
    resourcesAtDeath = {
      sol: finalSol,
      food: resources.current.food,
      water: resources.current.water,
      powerGrid: computePowerRatio(pgPower.production, pgPower.consumption),
      materials: resources.current.materials,
      population: colony.population,
      morale: colony.morale,
      health: colony.health,
      socialCohesion: colony.socialCohesion,
      isolatedColonists: isolatedCount,
    };
  }

  // Get blocked decisions, events, and executed actions from strategy
  const blockedDecisions = strategy.getBlockedDecisions();
  const eventsOccurred = strategy.getEventsOccurred();
  const actionsExecuted = strategy.getExecutedActions();

  // Capture earth crisis severity at game end
  const earthCrisisSeverity = api.game.earthCrisisSeverity();

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
    ideologyTimeline: ideologyTimeline.length > 0 ? ideologyTimeline : undefined,
    earthCrisisSeverity,
    actionsExecuted: actionsExecuted?.length ? actionsExecuted : undefined,
  };
}

/**
 * Capture ideology distribution snapshot at a given sol.
 */
function captureIdeologySnapshot(
  sol: number,
  colonists: readonly { ideology?: ColonistIdeology }[],
): IdeologySnapshot {
  let sumEarth = 0;
  let sumMars = 0;
  let sumCorp = 0;
  let sumConviction = 0;
  let sumSpread = 0;
  let dominantCount = 0;
  let count = 0;

  for (const colonist of colonists) {
    if (!colonist.ideology) continue;

    const { solidarity, sovereignty, transformation, conviction } = colonist.ideology;
    sumEarth += solidarity;
    sumMars += sovereignty;
    sumCorp += transformation;
    sumConviction += conviction;

    // Calculate spread (max - min affinity)
    const max = Math.max(solidarity, sovereignty, transformation);
    const min = Math.min(solidarity, sovereignty, transformation);
    sumSpread += max - min;

    // Check for dominant faction (threshold of 0.15 difference)
    const values = [solidarity, sovereignty, transformation].sort((a, b) => b - a);
    const highest = values[0] ?? 0;
    const second = values[1] ?? 0;
    if (highest >= 0.1 && highest - second >= 0.15) {
      dominantCount++;
    }

    count++;
  }

  return {
    sol,
    avgEarthLoyalist: count > 0 ? sumEarth / count : 0.33,
    avgMarsIndependence: count > 0 ? sumMars / count : 0.33,
    avgCorporateInterests: count > 0 ? sumCorp / count : 0.33,
    avgConviction: count > 0 ? sumConviction / count : 0,
    avgIdeologySpread: count > 0 ? sumSpread / count : 0,
    colonistsWithDominant: dominantCount,
    totalColonists: count,
    dominantFactionPct: count > 0 ? dominantCount / count : 0,
    pockets: detectIdeologyPockets(colonists),
  };
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerInput>) => {
  const { type, seeds, workerId } = event.data;

  if (type === "run") {
    const results: RunResult[] = [];

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i];
      if (seed === undefined) continue;
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
