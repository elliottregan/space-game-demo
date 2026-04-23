// Legacy minting + upgrade-path application.

import type {
  Campaign,
  Card,
  CompletionTier,
  Epoch,
  IdeologyTerrain,
  LegacyCandidate,
  LegacyCard,
  LossMode,
  MegaProject,
  Monument,
} from "./types.ts";
import { legacyCandidateCount } from "./patterns.ts";
import { allTableauCards } from "./tableau.ts";

export interface MintingResult {
  candidates: LegacyCandidate[];
  monument?: Monument;
}

export function mintCandidatesOnWin(
  epoch: Epoch,
  _setting: any,
  campaign: Campaign,
  project: MegaProject,
  tier: CompletionTier,
): MintingResult {
  const candidates: LegacyCandidate[] = [];

  const mpLegacyCard = templateProjectLegacy(project);
  candidates.push({
    id: `legacy-${project.id}-${epoch.epochNumber}`,
    baseCard: mpLegacyCard,
    source: "mega-project",
    suggestedUpgrades: ["potency", "pliability", "persistence"],
  });

  const playedLegacies = pickPlayedCardLegacies(epoch, tier);
  for (let i = 0; i < playedLegacies.length; i++) {
    const c = playedLegacies[i]!;
    candidates.push({
      id: `legacy-played-${c.id}-${epoch.epochNumber}-${i}`,
      baseCard: c,
      source: "played",
      suggestedUpgrades: ["potency", "pliability", "persistence"],
    });
  }

  const monument = buildMonument(epoch, project, tier, campaign);
  return { candidates, monument };
}

export function mintCandidatesOnLoss(epoch: Epoch, _setting: any, mode: LossMode): MintingResult {
  const candidates: LegacyCandidate[] = [];
  const consolations = buildConsolationLegacies(mode);
  for (let i = 0; i < consolations.length; i++) {
    candidates.push({
      id: `legacy-consolation-${epoch.epochNumber}-${i}`,
      baseCard: consolations[i]!,
      source: "consolation",
      suggestedUpgrades: ["potency", "pliability", "persistence"],
    });
  }
  return { candidates };
}

function tierMagnitude(tier: CompletionTier, base: number): number {
  switch (tier) {
    case "bronze":
      return Math.ceil(base * 0.6);
    case "silver":
      return base;
    case "gold":
      return Math.round(base * 1.4);
    case "platinum":
      return Math.round(base * 1.8);
  }
}

function buildMonument(
  epoch: Epoch,
  project: MegaProject,
  tier: CompletionTier,
  _campaign: Campaign,
): Monument {
  const base = project.monumentEffect.baseMagnitude;
  const mag = tierMagnitude(tier, base);
  const delta: Partial<IdeologyTerrain> = {};
  const src = project.monumentEffect.terrainDelta;
  if (src.axis1 !== undefined) delta.axis1 = Math.sign(src.axis1) * mag;
  if (src.axis2 !== undefined) delta.axis2 = Math.sign(src.axis2) * mag;

  return {
    id: `monument-${project.id}-e${epoch.epochNumber}`,
    megaProjectId: project.id,
    projectName: project.name,
    tier,
    mintedOnEpoch: epoch.epochNumber,
    terrainDelta: delta,
    active: true,
  };
}

function templateProjectLegacy(project: MegaProject): Card {
  const baseName = `Logbook of ${project.name}`;
  const id = `legacy-card-${project.id}`;
  return {
    id,
    name: baseName,
    kind: "legacy",
    rank: 11,
    ideology:
      project.id === "the-commune"
        ? "solidarity"
        : project.id === "the-ark" || project.id === "the-life-support"
          ? "transformation"
          : project.id === "the-reactor"
            ? "sovereignty"
            : "heritage",
    influenceCost: 1,
    marketCost: 0,
    effect: { kind: "draw", count: 1, timing: "immediate" },
    tags: ["legacy"],
    flavor: `Minted from ${project.name}.`,
  };
}

function pickPlayedCardLegacies(epoch: Epoch, tier: CompletionTier): Card[] {
  // Weighted candidates: cards on tableau (lands + toppers), plus discard.
  const candidates = new Map<string, { card: Card; weight: number }>();
  const bump = (card: Card, w: number) => {
    if (card.tags.includes("dissent")) return;
    if (card.kind === "legacy") return;
    const existing = candidates.get(card.id);
    if (existing) existing.weight += w;
    else candidates.set(card.id, { card, weight: w });
  };
  for (const card of allTableauCards(epoch.tableau)) bump(card, 2);
  for (const c of epoch.discard) bump(c, 1);

  const sorted = [...candidates.values()].sort((a, b) => b.weight - a.weight);
  const n = legacyCandidateCount(tier) - 1;
  return sorted.slice(0, Math.max(0, n)).map((e) => e.card);
}

function buildConsolationLegacies(mode: LossMode): Card[] {
  if (mode === "populace-turned") {
    return [
      {
        id: "legacy-heretic",
        name: "The Heretic's Sermon",
        kind: "legacy",
        rank: 10,
        ideology: "solidarity",
        influenceCost: 1,
        marketCost: 0,
        effect: { kind: "removeDissent", amount: 1, timing: "immediate" },
        tags: ["legacy"],
        flavor: "Learned from the overthrow.",
      },
    ];
  }
  return [
    {
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
    },
  ];
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
      case "gainMaterials":
        return { ...e, amount: e.amount + 1 };
      case "draw":
        return { ...e, count: e.count + 1 };
      case "removeDissent":
        return { ...e, amount: e.amount + 1 };
      case "shiftIdeology":
        return { ...e, amount: e.amount + 1 };
      case "compound":
        return { ...e, effects: e.effects.map(amp) };
      default:
        return e;
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
  if (monument.terrainDelta.axis1 !== undefined)
    campaign.terrain.axis1 += monument.terrainDelta.axis1;
  if (monument.terrainDelta.axis2 !== undefined)
    campaign.terrain.axis2 += monument.terrainDelta.axis2;
}

export function applyLossTerrainScar(
  campaign: Campaign,
  mode: LossMode,
  finalVector: { axis1: number; axis2: number },
): void {
  if (mode === "populace-turned") {
    if (finalVector.axis1 <= -3) campaign.terrain.axis1 += 3;
    else if (finalVector.axis1 >= 3) campaign.terrain.axis1 -= 3;
    if (finalVector.axis2 <= -3) campaign.terrain.axis2 += 3;
    else if (finalVector.axis2 >= 3) campaign.terrain.axis2 -= 3;
  }
  if (mode === "starved-out") {
    campaign.terrain.axis1 = Math.round(campaign.terrain.axis1 * 0.8);
    campaign.terrain.axis2 = Math.round(campaign.terrain.axis2 * 0.8);
  }
}
