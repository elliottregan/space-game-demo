// src/facade/domains/BuildingsFacade.ts
// Building queries and commands facade

import type { GameState } from "../../core/GameState";
import { BuildingId } from "../../core/models/Building";
import type { NPCFaction } from "../../core/models/NPCInfluence";
import type {
  ActionChecker,
  Building,
  BuildingAction,
  BuildingDefinition,
  BuildingMode,
  BuildingSnapshot,
  Colonist,
  EntityLookup,
  Queryable,
  ResourceDelta,
} from "../types";
import { type CanDoResult, err, ok, type Result } from "../types/common";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;
type AffordabilityChecker = (cost: ResourceDelta) => CanDoResult;

/**
 * Facade for building-related queries and commands.
 *
 * Implements:
 * - Queryable<BuildingSnapshot> - for snapshot()
 * - EntityLookup<Building> - for getById()
 * - ActionChecker<[BuildingAction]> - for canDo()
 */
export class BuildingsFacade
  implements Queryable<BuildingSnapshot>, EntityLookup<Building>, ActionChecker<[BuildingAction]>
{
  constructor(
    private gameState: GameState,
    private executeCommand: CommandExecutor,
    private checkAffordability: AffordabilityChecker,
  ) {}

  // ==========================================================================
  // Queries
  // ==========================================================================

  /**
   * Get complete building state snapshot.
   */
  snapshot(): BuildingSnapshot {
    return {
      active: Object.freeze([...this.gameState.buildings.getActiveBuildings()]),
      pending: Object.freeze([...this.gameState.buildings.getPendingBuildings()]),
      upgrading: Object.freeze([...this.gameState.buildings.getUpgradingBuildings()]),
      definitions: Object.freeze([...this.gameState.buildings.getAllDefinitions()]),
      moraleBoost: this.gameState.buildings.getTotalMoraleBoost(),
      totalLifeSupportCapacity: this.gameState.buildings.getTotalLifeSupportCapacity(),
      totalLifeSupportLoad: this.gameState.buildings.getTotalLifeSupportLoad(),
    };
  }

  /**
   * Get a specific building by ID.
   */
  getById(id: string): Readonly<Building> | undefined {
    return this.gameState.buildings.getBuilding(id);
  }

  /**
   * Get a building definition by ID.
   */
  getDefinition(defId: BuildingId): Readonly<BuildingDefinition> | undefined {
    return this.gameState.buildings.getDefinition(defId);
  }

  /**
   * Unified action checker implementing ActionChecker interface.
   * Routes to the appropriate canX method based on action type.
   */
  canDo(action: BuildingAction): CanDoResult {
    switch (action.action) {
      case "build":
        return this.canBuild(action.defId);
      case "recycle":
        return this.canRecycle(action.buildingId);
      case "repurpose":
        return this.canRepurpose(action.buildingId, action.targetDefId);
    }
  }

  /**
   * Check if a building can be constructed.
   */
  canBuild(defId: BuildingId): CanDoResult {
    const def = this.gameState.buildings.getDefinition(defId);
    if (!def) {
      return { allowed: false, reason: `Building type "${defId}" not found` };
    }

    // Check tech requirements
    if (def.requiredTech && !this.gameState.technology.isResearched(def.requiredTech)) {
      const tech = this.gameState.technology.getTech(def.requiredTech);
      return {
        allowed: false,
        reason: `Requires technology: ${tech?.name ?? def.requiredTech}`,
      };
    }

    // Check grant requirements (for victory buildings)
    if (def.requiredGrant && !this.gameState.districtGrants.isGrantCompleted(def.requiredGrant)) {
      return {
        allowed: false,
        reason: `Requires capstone grant to be completed first`,
      };
    }

    // Check resource cost
    const affordability = this.checkAffordability(def.cost);
    if (!affordability.allowed) {
      return affordability;
    }

    return { allowed: true };
  }

  /**
   * Check if a building's mode can be changed.
   */
  canSetMode(buildingId: string, mode: BuildingMode): CanDoResult {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) {
      return { allowed: false, reason: "Building not found" };
    }

    if (building.status !== "active") {
      return { allowed: false, reason: `Building must be active (current: ${building.status})` };
    }

    if (building.mode === mode) {
      return { allowed: false, reason: `Building is already in ${mode} mode` };
    }

    return { allowed: true };
  }

  /**
   * Get the recycle value for a building.
   */
  getRecycleValue(buildingId: string): ResourceDelta | undefined {
    return this.gameState.buildings.getRecycleValue(buildingId);
  }

  /**
   * Check if a building can be recycled.
   */
  canRecycle(buildingId: string): CanDoResult {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) {
      return { allowed: false, reason: "Building not found" };
    }

    if (building.status === "recycling") {
      return { allowed: false, reason: "Building is already being recycled" };
    }

    if (building.status === "pending") {
      return { allowed: false, reason: "Cannot recycle a building under construction" };
    }

    return { allowed: true };
  }

  /**
   * Check if construction can be canceled for a pending building.
   */
  canCancelConstruction(buildingId: string): CanDoResult {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) {
      return { allowed: false, reason: "Building not found" };
    }

    if (building.status !== "pending") {
      return { allowed: false, reason: "Building is not under construction" };
    }

    return { allowed: true };
  }

  /**
   * Check if a building can be repurposed to a target type.
   */
  canRepurpose(buildingId: string, targetDefId: BuildingId): CanDoResult {
    const canDo = this.gameState.buildings.canRepurpose(
      buildingId,
      targetDefId,
      this.gameState.resources,
      this.gameState.technology,
    );

    if (!canDo) {
      const building = this.gameState.buildings.getBuilding(buildingId);
      if (!building) {
        return { allowed: false, reason: "Building not found" };
      }

      const sourceDef = this.gameState.buildings.getDefinition(building.definitionId);
      if (!sourceDef?.repurposeTargets?.includes(targetDefId)) {
        return { allowed: false, reason: "This building cannot be repurposed to that type" };
      }

      const targetDef = this.gameState.buildings.getDefinition(targetDefId);
      if (
        targetDef?.requiredTech &&
        !this.gameState.technology.isResearched(targetDef.requiredTech)
      ) {
        return { allowed: false, reason: `Requires technology: ${targetDef.requiredTech}` };
      }

      return {
        allowed: false,
        reason: "Cannot repurpose (insufficient resources or invalid state)",
      };
    }

    return { allowed: true };
  }

  /**
   * Get the cost to repurpose to a target building type.
   */
  getRepurposeCost(targetDefId: BuildingId): ResourceDelta | undefined {
    return this.gameState.buildings.getRepurposeCost(targetDefId);
  }

  /**
   * Check if a building can be upgraded (e.g., Basic Habitat -> Advanced Habitat, Science Station -> Research Lab).
   */
  canUpgrade(buildingId: string): CanDoResult {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) {
      return { allowed: false, reason: "Building not found" };
    }

    const canDo = this.gameState.buildings.canUpgradeHabitat(buildingId, this.gameState.resources);

    if (!canDo) {
      // Check specific reasons
      if (building.status === "upgrading") {
        return { allowed: false, reason: "Building is already being upgraded" };
      }
      if (building.status !== "active") {
        return { allowed: false, reason: "Building must be active" };
      }

      const upgradeCost = this.gameState.buildings.getUpgradeCost(building.definitionId);
      if (!upgradeCost) {
        return { allowed: false, reason: "This building cannot be upgraded" };
      }

      // Check tech requirement
      const requiredTech = this.gameState.buildings.getUpgradeRequiredTech(building.definitionId);
      if (requiredTech && !this.gameState.technology.isResearched(requiredTech)) {
        const techDef = this.gameState.technology.getTech(requiredTech);
        return {
          allowed: false,
          reason: `Requires technology: ${techDef?.name ?? requiredTech}`,
        };
      }

      const affordability = this.checkAffordability(upgradeCost);
      if (!affordability.allowed) {
        return affordability;
      }

      return { allowed: false, reason: "Cannot upgrade building" };
    }

    return { allowed: true };
  }

  /**
   * Get the upgrade cost for a building.
   */
  getUpgradeCost(buildingId: string): ResourceDelta | undefined {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) return undefined;
    return this.gameState.buildings.getUpgradeCost(building.definitionId);
  }

  /**
   * Get the upgrade time in sols for a building.
   */
  getUpgradeTime(buildingId: string): number {
    const building = this.gameState.buildings.getBuilding(buildingId);
    if (!building) return 0;
    return this.gameState.buildings.getUpgradeTime(building.definitionId);
  }

  /**
   * Get colonists who can be assigned to a building based on district.
   * Only returns unassigned colonists whose district matches the building's district.
   */
  getAssignableWorkersForBuilding(buildingId: string): readonly Colonist[] {
    const workplaceDistrict = this.gameState.districts.getBuildingDistrictId(buildingId);

    // Get unassigned colonists
    const unassigned = this.gameState.colony.getColonists().filter((c) => {
      const workplace = this.gameState.workforce.getColonistWorkplace(
        c.id,
        this.gameState.buildings,
      );
      return !workplace;
    });

    return unassigned.filter((colonist) => {
      if (!colonist.districtId) return false;
      return colonist.districtId === workplaceDistrict;
    });
  }

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Start construction of a new building, optionally in a specific district.
   */
  build(defId: BuildingId, districtId?: string): Result<Building> {
    return this.executeCommand(() => {
      const check = this.canBuild(defId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: defId,
          reason: check.reason ?? "Cannot build",
        });
      }

      const building = this.gameState.buildings.startBuilding(
        defId,
        this.gameState.resources,
        this.gameState.technology,
      );

      if (!building) {
        return err({
          type: "INVALID_TARGET",
          target: defId,
          reason: "Build operation failed",
        });
      }

      // Assign to district if specified
      const targetDistrict = districtId ?? this.gameState.districts.getDistricts()[0]?.id;
      if (targetDistrict) {
        this.gameState.districts.assignBuilding(targetDistrict, building.id);
      }

      // Register power if this is a power-producing building
      const def = this.gameState.buildings.getDefinition(defId);
      if (def?.powerProduction) {
        this.gameState.districts.registerPowerSource(building.id, def.powerProduction);
      }

      // Register power consumption
      if (def?.powerConsumption) {
        this.gameState.districts.registerPowerConsumer(building.id, def.powerConsumption);
      }

      return ok(building);
    });
  }

  /**
   * Change a building's operating mode.
   */
  setMode(buildingId: string, mode: BuildingMode): Result<void> {
    return this.executeCommand(() => {
      const check = this.canSetMode(buildingId, mode);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getById(buildingId)?.mode ?? "unknown",
          expected: mode,
          reason: check.reason ?? "Cannot change mode",
        });
      }

      const success = this.gameState.buildings.setBuildingMode(
        buildingId,
        mode,
        this.gameState.resources,
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Mode change failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Start recycling a building.
   */
  recycle(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canRecycle(buildingId);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getById(buildingId)?.status ?? "unknown",
          expected: "active",
          reason: check.reason ?? "Cannot recycle",
        });
      }

      const events = this.gameState.buildings.startRecycling(buildingId, this.gameState.resources);

      if (events.length === 0) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Recycle operation failed",
        });
      }

      // Remove from district and unregister power
      this.gameState.districts.removeBuilding(buildingId);
      this.gameState.districts.unregisterPowerSource(buildingId);
      this.gameState.districts.unregisterPowerConsumer(buildingId);

      return ok(undefined);
    });
  }

  /**
   * Cancel construction of a pending building and refund resources.
   */
  cancelConstruction(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canCancelConstruction(buildingId);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getById(buildingId)?.status ?? "unknown",
          expected: "pending",
          reason: check.reason ?? "Cannot cancel construction",
        });
      }

      // Remove from district
      this.gameState.districts.removeBuilding(buildingId);

      const success = this.gameState.buildings.cancelConstruction(
        buildingId,
        this.gameState.resources,
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Cancel construction failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Rush recycling completion.
   */
  rushRecycling(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const building = this.getById(buildingId);
      if (!building) {
        return err({
          type: "NOT_FOUND",
          entity: "building",
          id: buildingId,
        });
      }

      if (building.status !== "recycling") {
        return err({
          type: "INVALID_STATE",
          current: building.status,
          expected: "recycling",
          reason: "Building must be in recycling state",
        });
      }

      const success = this.gameState.buildings.rushRecycling(buildingId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INSUFFICIENT_RESOURCES",
          required: { materials: 10 },
          available: this.gameState.resources.getResources(),
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Start repurposing a building to a different type.
   */
  repurpose(buildingId: string, targetDefId: BuildingId): Result<void> {
    return this.executeCommand(() => {
      const check = this.canRepurpose(buildingId, targetDefId);
      if (!check.allowed) {
        return err({
          type: "PREREQUISITE_NOT_MET",
          required: targetDefId,
          reason: check.reason ?? "Cannot repurpose",
        });
      }

      const success = this.gameState.buildings.startRepurposing(
        buildingId,
        targetDefId,
        this.gameState.resources,
        this.gameState.technology,
      );

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Repurpose operation failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Link a building to a deposit for resource extraction.
   */
  linkToDeposit(buildingId: string, depositId: string): Result<void> {
    return this.executeCommand(() => {
      const building = this.getById(buildingId);
      if (!building) {
        return err({
          type: "NOT_FOUND",
          entity: "building",
          id: buildingId,
        });
      }

      const site = this.gameState.operations.getSites().find((s) => s.id === depositId);
      if (!site) {
        return err({
          type: "NOT_FOUND",
          entity: "site",
          id: depositId,
        });
      }

      if (!site.developed) {
        return err({
          type: "INVALID_STATE",
          current: "undeveloped",
          expected: "developed",
          reason: "Site must be developed before linking",
        });
      }

      const success = this.gameState.operations.linkBuildingToDeposit(buildingId, depositId);
      if (success) {
        const buildingRef = this.gameState.buildings.getBuilding(buildingId);
        if (buildingRef) {
          buildingRef.depositId = depositId;
        }
      }

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: depositId,
          reason: "Failed to link building to deposit",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Start upgrading a building (e.g., Basic Habitat -> Advanced Habitat).
   */
  upgrade(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const check = this.canUpgrade(buildingId);
      if (!check.allowed) {
        return err({
          type: "INVALID_STATE",
          current: this.getById(buildingId)?.status ?? "unknown",
          expected: "active",
          reason: check.reason ?? "Cannot upgrade",
        });
      }

      const success = this.gameState.buildings.startUpgrade(buildingId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Upgrade operation failed",
        });
      }

      return ok(undefined);
    });
  }

  /**
   * Sponsor a building with a faction.
   * Sponsored buildings prefer ideologically aligned colonists during auto-assignment
   * and nudge workers' ideology toward the sponsor faction.
   */
  sponsorBuilding(buildingId: string, factionBaseId: NPCFaction): Result<void> {
    return this.executeCommand(() => {
      const building = this.gameState.buildings.getBuilding(buildingId);
      if (!building) {
        return err({ type: "NOT_FOUND", entity: "building", id: buildingId });
      }
      if (building.status !== "active") {
        return err({
          type: "INVALID_STATE",
          current: building.status,
          expected: "active",
          reason: "Building must be active to sponsor",
        });
      }

      const success = this.gameState.buildings.sponsorBuilding(buildingId, factionBaseId);
      if (!success) {
        return err({ type: "INVALID_TARGET", target: buildingId, reason: "Sponsor failed" });
      }
      return ok(undefined);
    });
  }

  /**
   * Remove faction sponsorship from a building.
   */
  unsponsorBuilding(buildingId: string): Result<void> {
    return this.executeCommand(() => {
      const building = this.gameState.buildings.getBuilding(buildingId);
      if (!building) {
        return err({ type: "NOT_FOUND", entity: "building", id: buildingId });
      }

      const success = this.gameState.buildings.unsponsorBuilding(buildingId);
      if (!success) {
        return err({ type: "INVALID_TARGET", target: buildingId, reason: "Unsponsor failed" });
      }
      return ok(undefined);
    });
  }
}
