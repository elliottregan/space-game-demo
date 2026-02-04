import type { Building, BuildingDefinition } from "../models/Building";
import type { GameEvent } from "../models/GameEvent";
import type { ProspectingSite } from "../models/Operation";

export type WarningLevel = "none" | "warning" | "critical" | "depleted";

const DEPOSIT_EVENT_CONFIG = {
  warning: {
    type: "DEPOSIT_WARNING" as const,
    severity: "warning" as const,
    getMessage: (name: string, site: ProspectingSite) =>
      `${name}'s deposit is running low (~${site.estimatedReserves.max} ${site.resourceType} remaining)`,
  },
  critical: {
    type: "DEPOSIT_CRITICAL" as const,
    severity: "critical" as const,
    getMessage: (name: string, site: ProspectingSite) =>
      `${name}'s deposit is nearly exhausted (~${site.estimatedReserves.max} ${site.resourceType} remaining)`,
  },
  depleted: {
    type: "DEPOSIT_DEPLETED" as const,
    severity: "critical" as const,
    getMessage: (name: string) => `${name}'s deposit is exhausted. Building is now idle.`,
    includeBuildingName: true,
  },
};

function createDepositEvent(
  level: "warning" | "critical" | "depleted",
  site: ProspectingSite,
  building: Building,
  buildingName: string,
): GameEvent {
  const config = DEPOSIT_EVENT_CONFIG[level];
  return {
    type: config.type,
    depositId: site.id,
    buildingId: building.id,
    ...("includeBuildingName" in config && config.includeBuildingName && { buildingName }),
    severity: config.severity,
    message: config.getMessage(buildingName, site),
  };
}

// Exported for API compatibility with tests
export const createDepositWarningEvent = (s: ProspectingSite, b: Building, n: string) =>
  createDepositEvent("warning", s, b, n);
export const createDepositCriticalEvent = (s: ProspectingSite, b: Building, n: string) =>
  createDepositEvent("critical", s, b, n);
export const createDepositDepletedEvent = (s: ProspectingSite, b: Building, n: string) =>
  createDepositEvent("depleted", s, b, n);

/**
 * Determine which events to emit based on warning level transitions.
 */
export function getDepletionEvents(
  warningBefore: WarningLevel,
  warningAfter: WarningLevel,
  site: ProspectingSite,
  building: Building,
  buildingName: string,
): GameEvent[] {
  if (warningBefore === "none" && warningAfter === "warning") {
    return [createDepositEvent("warning", site, building, buildingName)];
  }
  if (warningBefore !== "critical" && warningAfter === "critical") {
    return [createDepositEvent("critical", site, building, buildingName)];
  }
  if (warningAfter === "depleted") {
    return [createDepositEvent("depleted", site, building, buildingName)];
  }
  return [];
}

/**
 * Check if a building should extract from a deposit.
 */
export function canExtract(building: Building, def: BuildingDefinition | undefined): boolean {
  if (!def?.requiresDeposit) return false;
  if (!building.depositId) return false;
  if (building.broken) return false;
  return true;
}

/**
 * Get the base production rate for a building's linked deposit type.
 */
export function getBaseProductionForDeposit(def: BuildingDefinition, resourceType: string): number {
  return def.production?.[resourceType as keyof typeof def.production] ?? 0;
}
