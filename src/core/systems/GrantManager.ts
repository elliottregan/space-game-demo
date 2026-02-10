import {
  GRANT_CONVICTION_RESISTANCE,
  GRANT_IDEOLOGY_SHIFT_BASE,
  GRANT_MIN_SOL,
  GRANT_REFRESH_INTERVAL,
  GRANTS_PER_REFRESH,
  MAX_ACTIVE_GRANTS,
  MAX_GRANTS_PER_SOURCE,
} from "../balance/GrantBalance";
import { GRANT_TEMPLATES, getGrantTemplate } from "../data/grants";
import type { ActiveGrant, AvailableGrant, GrantSourceId } from "../models/Grant";
import type { AxisPosition } from "../models/NPCInfluence";
import { AXIS_KEYS } from "../models/NPCInfluence";
import type { ColonistIdeology } from "../models/Colonist";
import type { SeededRandom } from "../utils/random";

export class GrantManager {
  private availableGrants: AvailableGrant[] = [];
  private activeGrants: ActiveGrant[] = [];
  private lastRefreshSol: number = 0;
  private nextGrantId: number = 1;

  getAvailableGrants(): readonly AvailableGrant[] {
    return this.availableGrants;
  }

  getActiveGrants(): readonly ActiveGrant[] {
    return this.activeGrants;
  }

  getLastRefreshSol(): number {
    return this.lastRefreshSol;
  }

  getNextRefreshSol(): number {
    if (this.lastRefreshSol === 0) return GRANT_MIN_SOL;
    return this.lastRefreshSol + GRANT_REFRESH_INTERVAL;
  }

  /**
   * Check if it's time to refresh available grants.
   */
  shouldRefresh(currentSol: number): boolean {
    if (currentSol < GRANT_MIN_SOL) return false;
    if (this.lastRefreshSol === 0) return true;
    return currentSol >= this.lastRefreshSol + GRANT_REFRESH_INTERVAL;
  }

  /**
   * Select new grants from weighted random pool with source diversity.
   * Replaces all currently available grants.
   */
  refreshGrants(currentSol: number, rng: SeededRandom): void {
    this.lastRefreshSol = currentSol;
    this.availableGrants = [];

    // Filter templates eligible for this sol
    const eligible = GRANT_TEMPLATES.filter((t) => currentSol >= t.minSol);
    if (eligible.length === 0) return;

    const selectedSourceIds = new Set<GrantSourceId>();

    for (let i = 0; i < GRANTS_PER_REFRESH; i++) {
      // Apply source diversity bonus: templates from unselected sources get 2x weight
      const picked = rng.weightedPick(eligible, (t) => {
        const diversityBonus = selectedSourceIds.has(t.sourceId) ? 1 : 2;
        return t.weight * diversityBonus;
      });

      if (!picked) break;

      this.availableGrants.push({
        id: this.nextGrantId++,
        templateId: picked.id,
        sourceId: picked.sourceId,
        offeredSol: currentSol,
      });
      selectedSourceIds.add(picked.sourceId);
    }
  }

  /**
   * Check whether a grant can be assigned to a district.
   */
  canAssignGrant(grantId: number, _districtId: string): { allowed: boolean; reason?: string } {
    const grant = this.availableGrants.find((g) => g.id === grantId);
    if (!grant) {
      return { allowed: false, reason: "Grant not found or no longer available" };
    }

    if (this.activeGrants.length >= MAX_ACTIVE_GRANTS) {
      return { allowed: false, reason: `Maximum active grants (${MAX_ACTIVE_GRANTS}) reached` };
    }

    const sourceCount = this.activeGrants.filter((g) => g.sourceId === grant.sourceId).length;
    if (sourceCount >= MAX_GRANTS_PER_SOURCE) {
      return {
        allowed: false,
        reason: `Maximum grants from this source (${MAX_GRANTS_PER_SOURCE}) reached`,
      };
    }

    return { allowed: true };
  }

  /**
   * Move a grant from available to active, assigning it to a district.
   * Returns the active grant, or null if validation fails.
   */
  assignGrant(grantId: number, districtId: string, currentSol: number): ActiveGrant | null {
    const check = this.canAssignGrant(grantId, districtId);
    if (!check.allowed) return null;

    const grantIndex = this.availableGrants.findIndex((g) => g.id === grantId);
    if (grantIndex === -1) return null;

    const grant = this.availableGrants[grantIndex];
    if (!grant) return null;
    this.availableGrants.splice(grantIndex, 1);

    const template = getGrantTemplate(grant.templateId);
    const activeGrant: ActiveGrant = {
      id: grant.id,
      templateId: grant.templateId,
      sourceId: grant.sourceId,
      districtId,
      assignedSol: currentSol,
      remainingSols: template?.effect.type === "timed" ? template.effect.duration : undefined,
    };

    this.activeGrants.push(activeGrant);
    return activeGrant;
  }

  /**
   * Process timed grants: decrement timers and return expired grant IDs.
   * Caller is responsible for unregistering production bonuses.
   */
  processTimedGrants(): number[] {
    const expiredIds: number[] = [];

    this.activeGrants = this.activeGrants.filter((grant) => {
      if (grant.remainingSols === undefined) return true; // Instant grants stay forever (already applied)
      grant.remainingSols--;
      if (grant.remainingSols <= 0) {
        expiredIds.push(grant.id);
        return false;
      }
      return true;
    });

    return expiredIds;
  }

  /**
   * Apply ideology shift to colonists based on a grant source's position.
   * Mirrors the rallyFaction pattern: low conviction = more susceptible.
   *
   * Formula per colonist per axis:
   *   resistance = conviction * GRANT_CONVICTION_RESISTANCE
   *   strength = GRANT_IDEOLOGY_SHIFT_BASE * magnitude * (1 - resistance)
   *   ideology[axis] += strength * sourcePosition[axis]
   *   clamp to [-1, 1]
   *
   * Returns number of colonists affected.
   */
  static applyIdeologyShift(
    colonists: { ideology?: ColonistIdeology }[],
    sourcePosition: AxisPosition,
    magnitude: number,
  ): number {
    let affected = 0;

    for (const colonist of colonists) {
      if (!colonist.ideology) continue;

      const resistance = colonist.ideology.conviction * GRANT_CONVICTION_RESISTANCE;
      const strength = GRANT_IDEOLOGY_SHIFT_BASE * magnitude * (1 - resistance);

      for (const axis of AXIS_KEYS) {
        colonist.ideology[axis] = Math.max(
          -1,
          Math.min(1, colonist.ideology[axis] + strength * sourcePosition[axis]),
        );
      }

      affected++;
    }

    return affected;
  }

  // ============ Serialization ============

  toJSON() {
    return {
      availableGrants: this.availableGrants.map((g) => ({ ...g })),
      activeGrants: this.activeGrants.map((g) => ({ ...g })),
      lastRefreshSol: this.lastRefreshSol,
      nextGrantId: this.nextGrantId,
    };
  }

  static fromJSON(data: ReturnType<GrantManager["toJSON"]>): GrantManager {
    const manager = new GrantManager();
    manager.availableGrants = data.availableGrants.map((g) => ({ ...g }));
    manager.activeGrants = data.activeGrants.map((g) => ({ ...g }));
    manager.lastRefreshSol = data.lastRefreshSol;
    manager.nextGrantId = data.nextGrantId;
    return manager;
  }
}
