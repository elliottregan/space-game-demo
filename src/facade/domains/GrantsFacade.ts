import type { GameState } from "../../core/GameState";
import { getDistrictGrantTemplate } from "../../core/data/districtGrants";
import { getGrantSource } from "../../core/data/grants";
import { GRANT_REFRESH_COST } from "../../core/balance/DistrictGrantBalance";
import { DistrictGrantCategory, type GrantEligibility } from "../../core/models/DistrictGrant";
import type { AxisPosition } from "../../core/models/NPCInfluence";
import { rng } from "../../core/utils/random";
import type { Result } from "../types/common";
import { err, ok } from "../types/common";
import type {
  ActiveGrantSnapshot,
  AvailableGrantSnapshot,
  DistrictGrantsSnapshot,
} from "../types/grants";

type CommandExecutor = <T>(fn: () => Result<T>) => Result<T>;

export class GrantsFacade {
  constructor(
    private gameState: GameState,
    private executeCommand?: CommandExecutor,
  ) {}

  snapshot(): DistrictGrantsSnapshot {
    const dgm = this.gameState.districtGrants;

    const available: AvailableGrantSnapshot[] = dgm.getAvailableGrants().map((g) => {
      const template = getDistrictGrantTemplate(g.templateId);
      const source = template?.sourceId ? getGrantSource(template.sourceId) : undefined;
      return {
        id: g.id,
        templateId: g.templateId,
        name: template?.name ?? g.templateId,
        description: template?.description ?? "",
        category: template?.category ?? DistrictGrantCategory.INFRASTRUCTURE,
        cost: template?.cost ?? {},
        baseDuration: template?.baseDuration ?? 0,
        identityTag: template?.identityTag ?? "",
        sourceId: template?.sourceId,
        sourceName: source?.name,
        isCapstone: template?.isCapstone,
      };
    });

    const active: ActiveGrantSnapshot[] = dgm.getActiveGrants().map((g) => {
      const template = getDistrictGrantTemplate(g.templateId);
      return {
        id: g.id,
        templateId: g.templateId,
        districtId: g.districtId,
        name: template?.name ?? g.templateId,
        assignedSol: g.assignedSol,
        remainingSols: g.remainingSols,
        totalDuration: g.totalDuration,
      };
    });

    return {
      available,
      active,
      axisProgress: dgm.getAxisProgress(),
      completedGrantIds: [...dgm.getCompletedGrantIds()],
    };
  }

  /**
   * Check if a grant can be assigned to a district.
   */
  canAssignGrant(grantId: number, districtId: string): GrantEligibility {
    const districtIdeology = this.getDistrictIdeology(districtId);
    return this.gameState.districtGrants.canAssignGrant(grantId, districtId, districtIdeology);
  }

  /**
   * Assign a grant to a district.
   */
  assignGrant(grantId: number, districtId: string): Result<{ grantId: number }> {
    const exec = this.executeCommand ?? ((fn: () => Result<{ grantId: number }>) => fn());

    return exec(() => {
      const check = this.canAssignGrant(grantId, districtId);
      if (!check.canAssign) {
        return err({
          type: "INVALID_TARGET" as const,
          target: `grant_${grantId}`,
          reason: check.reason ?? "Cannot assign grant",
        });
      }

      // Check and deduct cost
      const template = getDistrictGrantTemplate(
        this.gameState.districtGrants.getAvailableGrants().find((g) => g.id === grantId)
          ?.templateId ?? ("" as any),
      );
      if (template?.cost) {
        if (!this.gameState.resources.canAfford(template.cost)) {
          return err({
            type: "INVALID_STATE" as const,
            current: "insufficient_resources",
            expected: "affordable",
            reason: "Cannot afford grant cost",
          });
        }
        this.gameState.resources.deduct(template.cost);
      }

      const districtIdeology = this.getDistrictIdeology(districtId);
      const activeGrant = this.gameState.districtGrants.assignGrant(
        grantId,
        districtId,
        this.gameState.currentSol,
        districtIdeology,
      );

      // Auto-fill the empty slot
      this.gameState.districtGrants.fillEmptySlots(this.gameState.currentSol, rng);

      return ok({ grantId: activeGrant.id });
    });
  }

  /**
   * Refresh all panel cards for a cost.
   */
  refreshPanel(): Result<void> {
    const cost = { materials: GRANT_REFRESH_COST };
    if (!this.gameState.resources.canAfford(cost)) {
      return err({
        type: "INSUFFICIENT_RESOURCES" as const,
        required: { materials: GRANT_REFRESH_COST },
        available: { materials: this.gameState.resources.getResources().materials },
      });
    }

    this.gameState.resources.deduct(cost);
    this.gameState.districtGrants.refreshPanel(this.gameState.currentSol, rng);
    return ok(undefined);
  }

  /**
   * Get district ideology (average of colonist ideologies in that district).
   */
  private getDistrictIdeology(districtId: string): AxisPosition {
    const colonistIds = this.gameState.districts.getDistrictColonistIds(districtId);
    const colonists = this.gameState.colony.getColonists();
    const districtColonists = colonists.filter((c) => colonistIds.includes(c.id));

    if (districtColonists.length === 0) {
      return { solidarity: 0, sovereignty: 0, transformation: 0 };
    }

    const avg: AxisPosition = { solidarity: 0, sovereignty: 0, transformation: 0 };
    for (const c of districtColonists) {
      if (c.ideology) {
        avg.solidarity += c.ideology.solidarity;
        avg.sovereignty += c.ideology.sovereignty;
        avg.transformation += c.ideology.transformation;
      }
    }
    avg.solidarity /= districtColonists.length;
    avg.sovereignty /= districtColonists.length;
    avg.transformation /= districtColonists.length;

    return avg;
  }
}
