// Legacy minting + upgrade-path application — adapted for CrisisOutcome.

import type {
  Campaign,
  Card,
  CrisisOutcome,
  Epoch,
  IdeologyTerrain,
  LegacyCandidate,
  LegacyCard,
  Monument,
  ProjectUnlock,
  Setting,
} from "./types.ts";
import { reversePatternOrder } from "./projects.ts";

export interface MintingResult {
  candidates: LegacyCandidate[];
  monument?: Monument;
}

export function mintCandidatesOnWin(
  epoch: Epoch,
  setting: Setting,
  _campaign: Campaign,
  outcome: CrisisOutcome,
): MintingResult {
  const candidates: LegacyCandidate[] = [];

  // One candidate per pattern that contributed, drawn from its highest-rank unlock.
  const order = reversePatternOrder();
  for (const pattern of order) {
    const u = outcome.contributingUnlocks.find((x) => x.pattern === pattern);
    if (!u) continue;
    const project = setting.projects.find((p) => p.id === u.projectId);
    if (!project) continue;
    candidates.push({
      id: `legacy-${project.id}-${epoch.epochNumber}`,
      baseCard: templateProjectLegacy(project.name, project.id),
      source: "unlock",
      suggestedUpgrades: ["potency", "pliability", "persistence"],
    });
  }

  const monument = buildMonument(epoch, outcome, setting);
  return { candidates, monument };
}

export function mintCandidatesOnLoss(epoch: Epoch, _setting: Setting, _outcome: CrisisOutcome): MintingResult {
  const candidates: LegacyCandidate[] = [];
  const consolation = buildConsolationLegacy();
  candidates.push({
    id: `legacy-consolation-${epoch.epochNumber}`,
    baseCard: consolation,
    source: "consolation",
    suggestedUpgrades: ["potency", "pliability", "persistence"],
  });
  return { candidates };
}

function buildMonument(epoch: Epoch, outcome: CrisisOutcome, setting: Setting): Monument | undefined {
  if (outcome.contributingUnlocks.length === 0) return undefined;
  const strongest = outcome.contributingUnlocks[0]!; // first is highest-pattern, earliest turn
  const project = setting.projects.find((p) => p.id === strongest.projectId);
  if (!project) return undefined;
  // Terrain effect: positive sovereignty/transformation for high patterns, otherwise no shift.
  const mag = Math.max(1, Math.floor(outcome.totalValue / 5));
  const delta: Partial<IdeologyTerrain> = {};
  // Use net ideology of contributing unlocks: solidarity vs sovereignty drives axis1.
  let axis1 = 0, axis2 = 0;
  for (const u of outcome.contributingUnlocks) {
    for (const c of u.cards) {
      if (c.ideology === "wild") continue;
      if (c.ideology === "solidarity") axis1 -= 1;
      if (c.ideology === "sovereignty") axis1 += 1;
      if (c.ideology === "transformation") axis2 += 1;
      if (c.ideology === "heritage") axis2 -= 1;
    }
  }
  if (axis1 !== 0) delta.axis1 = Math.sign(axis1) * mag;
  if (axis2 !== 0) delta.axis2 = Math.sign(axis2) * mag;
  return {
    id: `monument-${project.id}-e${epoch.epochNumber}`,
    projectId: project.id,
    projectName: project.name,
    mintedOnEpoch: epoch.epochNumber,
    terrainDelta: delta,
    active: true,
  };
}

function templateProjectLegacy(name: string, projectId: string): Card {
  return {
    id: `legacy-card-${projectId}`,
    name: `Logbook of ${name}`,
    kind: "legacy",
    rank: 11,
    ideology: "heritage",
    influenceCost: 1,
    marketCost: 0,
    effect: { kind: "draw", count: 1, timing: "immediate" },
    tags: ["legacy"],
    flavor: `Minted from ${name}.`,
  };
}

function buildConsolationLegacy(): Card {
  return {
    id: "legacy-ration",
    name: "The Ration Ledger",
    kind: "legacy",
    rank: 10,
    ideology: "heritage",
    influenceCost: 0,
    marketCost: 0,
    effect: { kind: "gainMaterials", amount: 2, timing: "immediate" },
    tags: ["legacy"],
    flavor: "What survived is counted, twice.",
  };
}

export function applyUpgrade(
  candidate: LegacyCandidate,
  upgrade: "potency" | "pliability" | "persistence",
  epochNumber: number,
): LegacyCard {
  const base = candidate.baseCard;
  const upgraded: Card = { ...base };
  switch (upgrade) {
    case "potency":
      upgraded.effect = amplifyEffect(base.effect);
      upgraded.name = base.name + " ◆";
      break;
    case "pliability":
      upgraded.influenceCost = Math.max(0, base.influenceCost - 1);
      upgraded.name = base.name + " ◇";
      break;
    case "persistence":
      upgraded.slotPassive = { kind: "gainMaterials", amount: 1, timing: "immediate" };
      upgraded.name = base.name + " ◉";
      break;
  }
  return {
    id: candidate.id,
    baseCard: upgraded,
    upgradePath: upgrade,
    mintedOnEpoch: epochNumber,
    mintedFrom: candidate.source,
  };
}

function amplifyEffect(effect: Card["effect"]): Card["effect"] {
  const amp = (e: Card["effect"]): Card["effect"] => {
    switch (e.kind) {
      case "gainInfluence":
      case "gainMaterials":   return { ...e, amount: e.amount + 1 };
      case "draw":            return { ...e, count: e.count + 1 };
      case "removeDissent":   return { ...e, amount: e.amount + 1 };
      case "shiftIdeology":   return { ...e, amount: e.amount + 1 };
      case "compound":        return { ...e, effects: e.effects.map(amp) };
      default: return e;
    }
  };
  return amp(effect);
}

export const MONUMENT_CAP = 3;

export function addMonumentToCampaign(campaign: Campaign, monument: Monument): void {
  campaign.monuments.push(monument);
  const active = campaign.monuments.filter((m) => m.active);
  while (active.length > MONUMENT_CAP) {
    const oldest = active.shift();
    if (oldest) oldest.active = false;
  }
  if (monument.terrainDelta.axis1 !== undefined) campaign.terrain.axis1 += monument.terrainDelta.axis1;
  if (monument.terrainDelta.axis2 !== undefined) campaign.terrain.axis2 += monument.terrainDelta.axis2;
}

export function applyLossTerrainScar(
  campaign: Campaign,
  outcome: CrisisOutcome,
  finalVector: { axis1: number; axis2: number },
): void {
  // Mild scar on loss: erode terrain toward neutral, plus a small bump opposite the ideology
  // breakdown of unlocks. Tuning placeholder.
  campaign.terrain.axis1 = Math.round(campaign.terrain.axis1 * 0.8);
  campaign.terrain.axis2 = Math.round(campaign.terrain.axis2 * 0.8);
  if (finalVector.axis1 >= 3) campaign.terrain.axis1 -= 1;
  if (finalVector.axis1 <= -3) campaign.terrain.axis1 += 1;
  if (finalVector.axis2 >= 3) campaign.terrain.axis2 -= 1;
  if (finalVector.axis2 <= -3) campaign.terrain.axis2 += 1;
  void outcome; // currently unused; signature kept for future tuning
}
