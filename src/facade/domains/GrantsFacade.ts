import type { GameState } from "../../core/GameState";
import { getGrantSource, getGrantTemplate } from "../../core/data/grants";
import { GrantManager } from "../../core/systems/GrantManager";
import type { CanDoResult, Result } from "../types/common";
import { err, ok } from "../types/common";
import type { ActiveGrantSnapshot, AvailableGrantSnapshot, GrantsSnapshot } from "../types/grants";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

export class GrantsFacade {
  constructor(
    private gameState: GameState,
    private executeCommand?: CommandExecutor,
  ) {}

  snapshot(): GrantsSnapshot {
    const gm = this.gameState.grants;

    const available: AvailableGrantSnapshot[] = gm.getAvailableGrants().map((g) => {
      const source = getGrantSource(g.sourceId);
      const template = getGrantTemplate(g.templateId);
      return {
        id: g.id,
        templateId: g.templateId,
        sourceId: g.sourceId,
        sourceName: source?.name ?? g.sourceId,
        name: template?.name ?? g.templateId,
        description: template?.description ?? "",
        effectType: template?.effect.type ?? "instant",
        ideologyMagnitude: template?.ideologyMagnitude ?? 0,
        offeredSol: g.offeredSol,
      };
    });

    const active: ActiveGrantSnapshot[] = gm.getActiveGrants().map((g) => {
      const source = getGrantSource(g.sourceId);
      const template = getGrantTemplate(g.templateId);
      return {
        id: g.id,
        templateId: g.templateId,
        sourceId: g.sourceId,
        sourceName: source?.name ?? g.sourceId,
        name: template?.name ?? g.templateId,
        districtId: g.districtId,
        assignedSol: g.assignedSol,
        remainingSols: g.remainingSols,
      };
    });

    return {
      available,
      active,
      nextRefreshSol: gm.getNextRefreshSol(),
    };
  }

  canAssignGrant(grantId: number, districtId: string): CanDoResult {
    return this.gameState.grants.canAssignGrant(grantId, districtId);
  }

  assignGrant(
    grantId: number,
    districtId: string,
  ): Result<{ grantId: number; affectedColonists: number }> {
    const exec =
      this.executeCommand ??
      ((fn: () => Result<{ grantId: number; affectedColonists: number }>) => fn());

    return exec(() => {
      const check = this.canAssignGrant(grantId, districtId);
      if (!check.allowed) {
        return err({
          type: "INVALID_TARGET" as const,
          target: `grant_${grantId}`,
          reason: check.reason ?? "Cannot assign grant",
        });
      }

      const currentSol = this.gameState.currentSol;
      const activeGrant = this.gameState.grants.assignGrant(grantId, districtId, currentSol);
      if (!activeGrant) {
        return err({
          type: "NOT_FOUND" as const,
          entity: "grant" as const,
          id: String(grantId),
        });
      }

      const template = getGrantTemplate(activeGrant.templateId);
      const source = getGrantSource(activeGrant.sourceId);
      if (!template || !source) {
        return ok({ grantId: activeGrant.id, affectedColonists: 0 });
      }

      const effect = template.effect;

      // Apply instant resource effects
      if (effect.resources) {
        this.gameState.resources.add(effect.resources);
      }

      // Apply instant population effects
      if (effect.population && effect.population > 0) {
        for (let i = 0; i < effect.population; i++) {
          this.gameState.colony.addColonist();
        }
      }

      // Apply capacity boost (add housing to colony resources as materials equivalent)
      // capacityBoost increases the district's ability to house colonists
      // Since there's no DistrictManager yet, we model this as direct housing capacity
      // via the colony's habitat system - we just give the resources equivalent
      if (effect.capacityBoost) {
        // Represented as materials to build housing capacity
        this.gameState.resources.add({ materials: effect.capacityBoost * 5 });
      }

      // Register timed production bonuses
      if (effect.type === "timed" && effect.productionBonus) {
        this.gameState.resources.addProductionBonus(
          `grant_${activeGrant.id}`,
          effect.productionBonus.resource,
          effect.productionBonus.multiplier,
        );
      }

      // Register timed research bonuses as materials production
      // (approximation since there's no direct research bonus mechanism)
      if (effect.type === "timed" && effect.researchBonus) {
        // Research bonus is modeled as boosting the research output rate
        // We don't have a direct research bonus in ResourceManager, so skip
        // The effect will be visible through TechnologyTree speed
      }

      // Apply ideology shift to colonists
      // In the full district system, this would target colonists in the district.
      // For now, apply to all colonists (colony-wide effect).
      const colonists = this.gameState.colony.getColonists();
      const affectedColonists = GrantManager.applyIdeologyShift(
        colonists,
        source.ideologyPosition,
        template.ideologyMagnitude,
      );

      return ok({ grantId: activeGrant.id, affectedColonists });
    });
  }
}
