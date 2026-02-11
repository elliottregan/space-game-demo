import {
  CAPSTONE_UNLOCK_THRESHOLD,
  GRANT_MIN_SOL,
  GRANT_PANEL_SIZE,
  IDENTITY_MAX_SPEED,
  IDENTITY_MIN_SPEED,
  SPECIALIZATION_BONUS_1,
  SPECIALIZATION_BONUS_2,
  SPECIALIZATION_TIER_1,
  SPECIALIZATION_TIER_2,
} from "../balance/DistrictGrantBalance.js";
import {
  DISTRICT_GRANT_TEMPLATES,
  getDistrictGrantTemplate,
  meetsGrantAxisRequirements,
} from "../data/districtGrants.js";
import {
  DistrictGrantCategory,
  GRAND_IDENTITY_TITLES,
  IDENTITY_TITLES,
  type ActiveDistrictGrant,
  type AvailableDistrictGrant,
  type DistrictGrantId,
  type DistrictGrantTemplate,
  type DistrictIdentity,
  type GrantEligibility,
} from "../models/DistrictGrant.js";
import type { AxisPosition } from "../models/NPCInfluence.js";
import type { SeededRandom } from "../utils/random.js";
import type { GrantCompletionQueries } from "../interfaces/Queries.js";

export class DistrictGrantManager implements GrantCompletionQueries {
  private availableGrants: AvailableDistrictGrant[] = [];
  private activeGrants: ActiveDistrictGrant[] = [];
  private districtIdentities: Map<string, DistrictIdentity> = new Map();
  private completedGrantIds: Set<DistrictGrantId> = new Set();
  private axisProgress: Record<string, number> = {
    solidarity: 0,
    sovereignty: 0,
    transformation: 0,
  };
  private nextGrantId: number = 1;

  // ============ Panel ============

  getAvailableGrants(): readonly AvailableDistrictGrant[] {
    return this.availableGrants;
  }

  refreshPanel(currentSol: number, rng: SeededRandom): void {
    this.availableGrants = [];
    this.fillEmptySlots(currentSol, rng);
  }

  fillEmptySlots(currentSol: number, rng: SeededRandom): void {
    if (currentSol < GRANT_MIN_SOL) return;

    const drawPool = this.buildDrawPool(currentSol);
    if (drawPool.length === 0) return;

    const panelTemplateIds = new Set(this.availableGrants.map((g) => g.templateId));
    const activeTemplateIds = new Set(this.activeGrants.map((g) => g.templateId));
    const excluded = (t: DistrictGrantTemplate) =>
      panelTemplateIds.has(t.id) || activeTemplateIds.has(t.id);

    // Guarantee at least one identity grant on the panel for victory path progression
    const hasIdentityOnPanel = this.availableGrants.some((g) => {
      const t = getDistrictGrantTemplate(g.templateId);
      return t?.category === DistrictGrantCategory.IDENTITY;
    });

    if (!hasIdentityOnPanel && this.availableGrants.length < GRANT_PANEL_SIZE) {
      const identityPool = drawPool.filter(
        (t) => t.category === DistrictGrantCategory.IDENTITY && !excluded(t),
      );
      if (identityPool.length > 0) {
        const picked = rng.weightedPick(identityPool, (t) => t.weight);
        if (picked) {
          this.availableGrants.push({
            id: this.nextGrantId++,
            templateId: picked.id,
            drawnSol: currentSol,
          });
          panelTemplateIds.add(picked.id);
        }
      }
    }

    // Fill remaining slots from the full pool
    while (this.availableGrants.length < GRANT_PANEL_SIZE) {
      const eligible = drawPool.filter((t) => !excluded(t));
      if (eligible.length === 0) break;

      const picked = rng.weightedPick(eligible, (t) => t.weight);
      if (!picked) break;

      this.availableGrants.push({
        id: this.nextGrantId++,
        templateId: picked.id,
        drawnSol: currentSol,
      });
      panelTemplateIds.add(picked.id);
    }
  }

  private buildDrawPool(currentSol: number): DistrictGrantTemplate[] {
    return DISTRICT_GRANT_TEMPLATES.filter((t) => {
      if (t.minSol > currentSol) return false;
      if (t.isCapstone && !this.isCapstoneUnlocked(t.id)) return false;
      return true;
    });
  }

  // ============ Assignment ============

  canAssignGrant(
    grantId: number,
    _districtId: string,
    districtIdeology: AxisPosition,
  ): GrantEligibility {
    const available = this.availableGrants.find((g) => g.id === grantId);
    if (!available) {
      return { canAssign: false, reason: "Grant not found or no longer available" };
    }

    const template = getDistrictGrantTemplate(available.templateId);
    if (!template) {
      return { canAssign: false, reason: "Grant template not found" };
    }

    if (
      template.category === DistrictGrantCategory.IDENTITY &&
      !meetsGrantAxisRequirements(districtIdeology, template)
    ) {
      return { canAssign: false, reason: "District ideology does not meet axis requirements" };
    }

    const duration = computeGrantDuration(template, districtIdeology);
    return { canAssign: true, estimatedDuration: duration };
  }

  assignGrant(
    grantId: number,
    districtId: string,
    currentSol: number,
    districtIdeology: AxisPosition,
  ): ActiveDistrictGrant {
    const grantIndex = this.availableGrants.findIndex((g) => g.id === grantId);
    const available = this.availableGrants[grantIndex];
    if (!available) {
      throw new Error(`Grant ${grantId} not found in panel`);
    }

    const template = getDistrictGrantTemplate(available.templateId);
    if (!template) {
      throw new Error(`Template not found for grant ${available.templateId}`);
    }

    this.availableGrants.splice(grantIndex, 1);

    const totalDuration = computeGrantDuration(template, districtIdeology);
    const activeGrant: ActiveDistrictGrant = {
      id: available.id,
      templateId: available.templateId,
      districtId,
      assignedSol: currentSol,
      remainingSols: totalDuration,
      totalDuration,
    };

    this.activeGrants.push(activeGrant);
    return activeGrant;
  }

  // ============ Processing ============

  getActiveGrants(): readonly ActiveDistrictGrant[] {
    return this.activeGrants;
  }

  getActiveGrantsForDistrict(districtId: string): readonly ActiveDistrictGrant[] {
    return this.activeGrants.filter((g) => g.districtId === districtId);
  }

  tick(): void {
    for (const grant of this.activeGrants) {
      grant.remainingSols--;
    }
  }

  getCompletedThisTick(): ActiveDistrictGrant[] {
    return this.activeGrants.filter((g) => g.remainingSols <= 0);
  }

  removeCompletedGrants(): void {
    this.activeGrants = this.activeGrants.filter((g) => g.remainingSols > 0);
  }

  // ============ Identity ============

  getDistrictIdentity(districtId: string): DistrictIdentity {
    const existing = this.districtIdentities.get(districtId);
    if (existing) return existing;

    return { completedGrantIds: [], tags: [], title: null };
  }

  addCompletedGrant(districtId: string, grantId: DistrictGrantId): void {
    let identity = this.districtIdentities.get(districtId);
    if (!identity) {
      identity = { completedGrantIds: [], tags: [], title: null };
      this.districtIdentities.set(districtId, identity);
    }

    identity.completedGrantIds.push(grantId);
    this.completedGrantIds.add(grantId);

    const template = getDistrictGrantTemplate(grantId);
    if (template) {
      identity.tags.push(template.identityTag);

      if (template.category === DistrictGrantCategory.IDENTITY) {
        this.recordVictoryProgress(template);
      }
    }

    identity.title = computeDistrictTitle(identity.tags);
  }

  getSpecializationBonus(districtId: string, tag: string): number {
    const identity = this.districtIdentities.get(districtId);
    if (!identity) return 0;

    const count = identity.tags.filter((t) => t === tag).length;

    if (count >= SPECIALIZATION_TIER_2) return SPECIALIZATION_BONUS_2;
    if (count >= SPECIALIZATION_TIER_1) return SPECIALIZATION_BONUS_1;
    return 0;
  }

  // ============ Victory ============

  getAxisProgress(): Record<string, number> {
    return { ...this.axisProgress };
  }

  isCapstoneUnlocked(capstoneId: DistrictGrantId): boolean {
    const template = getDistrictGrantTemplate(capstoneId);
    if (!template || !template.isCapstone) return false;

    const prerequisites = template.prerequisites ?? [];
    for (const prereq of prerequisites) {
      if (!this.completedGrantIds.has(prereq)) return false;
    }

    if (template.axisRequirements) {
      for (const axis of Object.keys(template.axisRequirements)) {
        if ((this.axisProgress[axis] ?? 0) < CAPSTONE_UNLOCK_THRESHOLD) return false;
      }
    }

    return true;
  }

  getCompletedGrantIds(): readonly DistrictGrantId[] {
    return [...this.completedGrantIds];
  }

  isGrantCompleted(grantId: DistrictGrantId): boolean {
    return this.completedGrantIds.has(grantId);
  }

  private recordVictoryProgress(template: DistrictGrantTemplate): void {
    const progress = template.victoryProgress ?? 1;
    if (progress === 0) return;
    if (!template.axisRequirements) return;

    for (const axis of Object.keys(template.axisRequirements)) {
      this.axisProgress[axis] = (this.axisProgress[axis] ?? 0) + progress;
    }
  }

  // ============ Serialization ============

  toJSON(): {
    availableGrants: AvailableDistrictGrant[];
    activeGrants: ActiveDistrictGrant[];
    districtIdentities: [string, DistrictIdentity][];
    completedGrantIds: DistrictGrantId[];
    axisProgress: Record<string, number>;
    nextGrantId: number;
  } {
    return {
      availableGrants: this.availableGrants.map((g) => ({ ...g })),
      activeGrants: this.activeGrants.map((g) => ({ ...g })),
      districtIdentities: [...this.districtIdentities.entries()],
      completedGrantIds: [...this.completedGrantIds],
      axisProgress: { ...this.axisProgress },
      nextGrantId: this.nextGrantId,
    };
  }

  static fromJSON(data: ReturnType<DistrictGrantManager["toJSON"]>): DistrictGrantManager {
    const manager = new DistrictGrantManager();
    manager.availableGrants = data.availableGrants.map((g) => ({ ...g }));
    manager.activeGrants = data.activeGrants.map((g) => ({ ...g }));
    manager.districtIdentities = new Map(data.districtIdentities);
    manager.completedGrantIds = new Set(data.completedGrantIds);
    manager.axisProgress = { ...data.axisProgress };
    manager.nextGrantId = data.nextGrantId;
    return manager;
  }
}

// ============ Pure Helpers ============

function computeGrantDuration(
  template: DistrictGrantTemplate,
  districtIdeology: AxisPosition,
): number {
  if (template.category !== DistrictGrantCategory.IDENTITY) {
    return template.baseDuration;
  }

  if (!template.axisRequirements) {
    return template.baseDuration;
  }

  let maxAlignmentStrength = 0;

  for (const [axis, req] of Object.entries(template.axisRequirements)) {
    const value = districtIdeology[axis as keyof AxisPosition];

    if (req.min !== undefined) {
      maxAlignmentStrength = Math.max(maxAlignmentStrength, value - req.min);
    }
    if (req.max !== undefined) {
      maxAlignmentStrength = Math.max(maxAlignmentStrength, req.max - value);
    }
  }

  const speedMultiplier = Math.max(
    IDENTITY_MIN_SPEED,
    Math.min(IDENTITY_MAX_SPEED, 0.5 + maxAlignmentStrength * 1.5),
  );

  return Math.ceil(template.baseDuration / speedMultiplier);
}

function computeDistrictTitle(tags: string[]): string | null {
  if (tags.length === 0) return null;

  const tagCounts = new Map<string, number>();
  for (const tag of tags) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  let dominantTag = "";
  let maxCount = 0;
  for (const [tag, count] of tagCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantTag = tag;
    }
  }

  if (maxCount >= SPECIALIZATION_TIER_2 && dominantTag in GRAND_IDENTITY_TITLES) {
    return GRAND_IDENTITY_TITLES[dominantTag] ?? null;
  }

  if (maxCount >= SPECIALIZATION_TIER_1 && dominantTag in IDENTITY_TITLES) {
    return IDENTITY_TITLES[dominantTag] ?? null;
  }

  return null;
}
