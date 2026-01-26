import type { Building, BuildingDefinition } from "../models/Building";
import type { GameEvent } from "../models/GameEvent";
import type { ProspectingSite } from "../models/Operation";

export type WarningLevel = "none" | "warning" | "critical" | "depleted";

/**
 * Result of processing a single building's extraction.
 */
export interface ExtractionResult {
  events: GameEvent[];
  buildingBecameIdle: boolean;
}

/**
 * Create a warning event for a deposit threshold crossing.
 */
export function createDepositWarningEvent(
  site: ProspectingSite,
  building: Building,
  buildingName: string,
): GameEvent {
  return {
    type: "DEPOSIT_WARNING",
    depositId: site.id,
    buildingId: building.id,
    severity: "warning",
    message: `${buildingName}'s deposit is running low (~${site.estimatedReserves.max} ${site.resourceType} remaining)`,
  };
}

/**
 * Create a critical warning event for a deposit.
 */
export function createDepositCriticalEvent(
  site: ProspectingSite,
  building: Building,
  buildingName: string,
): GameEvent {
  return {
    type: "DEPOSIT_CRITICAL",
    depositId: site.id,
    buildingId: building.id,
    severity: "critical",
    message: `${buildingName}'s deposit is nearly exhausted (~${site.estimatedReserves.max} ${site.resourceType} remaining)`,
  };
}

/**
 * Create a depleted event for a deposit.
 */
export function createDepositDepletedEvent(
  site: ProspectingSite,
  building: Building,
  buildingName: string,
): GameEvent {
  return {
    type: "DEPOSIT_DEPLETED",
    depositId: site.id,
    buildingId: building.id,
    buildingName,
    severity: "critical",
    message: `${buildingName}'s deposit is exhausted. Building is now idle.`,
  };
}

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
  const events: GameEvent[] = [];

  if (warningBefore === "none" && warningAfter === "warning") {
    events.push(createDepositWarningEvent(site, building, buildingName));
  } else if (warningBefore !== "critical" && warningAfter === "critical") {
    events.push(createDepositCriticalEvent(site, building, buildingName));
  } else if (warningAfter === "depleted") {
    events.push(createDepositDepletedEvent(site, building, buildingName));
  }

  return events;
}

/**
 * Check if a building should extract from a deposit.
 */
export function canExtract(
  building: Building,
  def: BuildingDefinition | undefined,
): boolean {
  if (!def?.requiresDeposit) return false;
  if (!building.depositId) return false;
  if (building.broken) return false;
  return true;
}

/**
 * Get the base production rate for a building's linked deposit type.
 */
export function getBaseProductionForDeposit(
  def: BuildingDefinition,
  resourceType: string,
): number {
  return def.production?.[resourceType as keyof typeof def.production] ?? 0;
}
