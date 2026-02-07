// src/core/data/factionDrift.ts

import type { BuildingDefinition } from "../models/Building.js";
import { BuildingId } from "../models/Building.js";
import type { AxisPosition } from "../models/NPCInfluence.js";
import type { ResourceManager } from "../systems/ResourceManager.js";
import type { ColonyManager } from "../systems/ColonyManager.js";
import type { BuildingManager } from "../systems/BuildingManager.js";
import type { TechnologyTree } from "../systems/TechnologyTree.js";
import { BUILDINGS } from "./buildings.js";

export type AxisKey = keyof AxisPosition;

export interface DriftContext {
  resources: ResourceManager;
  colony: ColonyManager;
  buildings: BuildingManager;
  technology: TechnologyTree;
}

export interface DriftTrigger {
  id: string;
  axis: AxisKey;
  /** Positive = toward +1, negative = toward -1 */
  evaluate(ctx: DriftContext): number;
}

// ============ Solidarity Axis Triggers ============
// Positive = collectivist (+1), Negative = individualist (-1)

/**
 * Resource scarcity pushes toward collectivism.
 * When food is low relative to population, colonists favor shared distribution.
 */
const resourceScarcity: DriftTrigger = {
  id: "resource_scarcity",
  axis: "solidarity",
  evaluate(ctx: DriftContext): number {
    const population = ctx.colony.getPopulation();
    if (population === 0) return 0;

    const food = ctx.resources.getResources().food;
    const foodPerCapita = food / population;

    // Below 5 food per colonist = scarcity pressure toward collectivist
    if (foodPerCapita < 5) return 0.03;
    if (foodPerCapita < 10) return 0.01;
    return 0;
  },
};

/**
 * Resource abundance pushes toward individualism.
 * When food is plentiful, colonists favor individual freedom.
 */
const resourceAbundance: DriftTrigger = {
  id: "resource_abundance",
  axis: "solidarity",
  evaluate(ctx: DriftContext): number {
    const population = ctx.colony.getPopulation();
    if (population === 0) return 0;

    const food = ctx.resources.getResources().food;
    const foodPerCapita = food / population;

    // Above 30 food per colonist = abundance pressure toward individualist
    if (foodPerCapita > 30) return -0.02;
    if (foodPerCapita > 20) return -0.01;
    return 0;
  },
};

/**
 * Housing crisis pushes toward collectivism.
 * When colonists lack housing, they demand collective solutions.
 */
const housingCrisis: DriftTrigger = {
  id: "housing_crisis",
  axis: "solidarity",
  evaluate(ctx: DriftContext): number {
    const population = ctx.colony.getPopulation();
    if (population === 0) return 0;

    const housingCapacity = ctx.colony.getHousingCapacity(ctx.buildings);
    if (housingCapacity === 0) return 0.03;

    const occupancyRate = population / housingCapacity;

    // Overcrowded (>90% occupancy) = collectivist pressure
    if (occupancyRate > 0.9) return 0.02;
    return 0;
  },
};

/**
 * Housing surplus pushes toward individualism.
 * Plentiful housing means individual choice in living arrangements.
 */
const housingSurplus: DriftTrigger = {
  id: "housing_surplus",
  axis: "solidarity",
  evaluate(ctx: DriftContext): number {
    const population = ctx.colony.getPopulation();
    if (population === 0) return 0;

    const housingCapacity = ctx.colony.getHousingCapacity(ctx.buildings);
    if (housingCapacity === 0) return 0;

    const occupancyRate = population / housingCapacity;

    // Low occupancy (<50%) = individualist pressure
    if (occupancyRate < 0.5) return -0.01;
    return 0;
  },
};

// ============ Sovereignty Axis Triggers ============
// Positive = Mars-sovereign (+1), Negative = Earth-tied (-1)

/**
 * Large colony pushes toward Mars sovereignty.
 * Self-sufficient colony sees itself as independent.
 */
const colonySelfSufficiency: DriftTrigger = {
  id: "colony_self_sufficiency",
  axis: "sovereignty",
  evaluate(ctx: DriftContext): number {
    const population = ctx.colony.getPopulation();

    if (population > 50) return 0.03;
    if (population > 30) return 0.02;
    return 0;
  },
};

/**
 * Small colony feels Earth-tied.
 * Early game dependency on Earth supply lines.
 */
const earthDependence: DriftTrigger = {
  id: "earth_dependence",
  axis: "sovereignty",
  evaluate(ctx: DriftContext): number {
    const population = ctx.colony.getPopulation();

    if (population < 10) return -0.03;
    if (population < 15) return -0.01;
    return 0;
  },
};

// ============ Transformation Axis Triggers ============
// Positive = revolutionary (+1), Negative = preservationist (-1)

/**
 * Technology breakthroughs push toward revolutionary thinking.
 * More researched techs mean the colony embraces change.
 */
const techBreakthroughs: DriftTrigger = {
  id: "tech_breakthroughs",
  axis: "transformation",
  evaluate(ctx: DriftContext): number {
    const researchedCount = ctx.technology.getResearchedCount();

    if (researchedCount > 12) return 0.03;
    if (researchedCount > 8) return 0.02;
    if (researchedCount > 4) return 0.01;
    return 0;
  },
};

/**
 * Stability (high health + morale) pushes toward preservationism.
 * When things are going well, colonists resist change.
 */
const longStability: DriftTrigger = {
  id: "long_stability",
  axis: "transformation",
  evaluate(ctx: DriftContext): number {
    const health = ctx.colony.getHealth();
    const morale = ctx.colony.getMorale();

    // Both health and morale above 80 = preservationist pressure
    if (health > 80 && morale > 80) return -0.02;
    return 0;
  },
};

// ============ Institutional Building Triggers ============

function getBuildingDef(defId: BuildingId): BuildingDefinition | undefined {
  return BUILDINGS.find((b) => b.id === defId);
}

function sumAxisPressure(ctx: DriftContext, axis: AxisKey): number {
  let total = 0;
  for (const building of ctx.buildings.getActiveBuildings()) {
    const def = getBuildingDef(building.definitionId);
    if (def?.axisPressure?.[axis]) {
      total += def.axisPressure[axis];
    }
  }
  return total;
}

/**
 * Active buildings with axisPressure.solidarity shift the solidarity axis.
 */
const institutionalSolidarity: DriftTrigger = {
  id: "institutional_solidarity",
  axis: "solidarity",
  evaluate(ctx: DriftContext): number {
    return sumAxisPressure(ctx, "solidarity");
  },
};

/**
 * Active buildings with axisPressure.sovereignty shift the sovereignty axis.
 */
const institutionalSovereignty: DriftTrigger = {
  id: "institutional_sovereignty",
  axis: "sovereignty",
  evaluate(ctx: DriftContext): number {
    return sumAxisPressure(ctx, "sovereignty");
  },
};

/**
 * Active buildings with axisPressure.transformation shift the transformation axis.
 */
const institutionalTransformation: DriftTrigger = {
  id: "institutional_transformation",
  axis: "transformation",
  evaluate(ctx: DriftContext): number {
    return sumAxisPressure(ctx, "transformation");
  },
};

/**
 * All drift triggers evaluated each sol.
 */
export const DRIFT_TRIGGERS: readonly DriftTrigger[] = [
  resourceScarcity,
  resourceAbundance,
  housingCrisis,
  housingSurplus,
  colonySelfSufficiency,
  earthDependence,
  techBreakthroughs,
  longStability,
  institutionalSolidarity,
  institutionalSovereignty,
  institutionalTransformation,
];
