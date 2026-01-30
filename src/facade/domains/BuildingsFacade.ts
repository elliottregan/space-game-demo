// src/facade/domains/BuildingsFacade.ts
// Building queries and commands facade

import type { GameState } from "../../core/GameState";
import { BuildingId } from "../../core/models/Building";
import type {
  ActionChecker,
  Building,
  BuildingAction,
  BuildingDefinition,
  BuildingMode,
  BuildingSnapshot,
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
      definitions: Object.freeze([...this.gameState.buildings.getAllDefinitions()]),
      moraleBoost: this.gameState.buildings.getTotalMoraleBoost(),
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

  // ==========================================================================
  // Commands
  // ==========================================================================

  /**
   * Start construction of a new building.
   */
  build(defId: BuildingId): Result<Building> {
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

      const success = this.gameState.buildings.startRecycling(buildingId, this.gameState.resources);

      if (!success) {
        return err({
          type: "INVALID_TARGET",
          target: buildingId,
          reason: "Recycle operation failed",
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
}
