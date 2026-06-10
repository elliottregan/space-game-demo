// Legacy minting — adapted for CrisisOutcome.

import type {
  Campaign,
  Card,
  CrisisOutcome,
  Epoch,
  LegacyCandidate,
  LegacyCard,
  Monument,
  Setting,
} from "../types.ts";
import { reversePatternOrder } from "../data/projects.ts";

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
      suggestedUpgrades: ["potency", "pliability"],
    });
  }

  const monument = buildMonument(epoch, outcome, setting);
  return { candidates, monument };
}

export function mintCandidatesOnLoss(
  epoch: Epoch,
  _setting: Setting,
  _outcome: CrisisOutcome,
): MintingResult {
  const candidates: LegacyCandidate[] = [];
  const consolation = buildConsolationLegacy();
  candidates.push({
    id: `legacy-consolation-${epoch.epochNumber}`,
    baseCard: consolation,
    source: "consolation",
    suggestedUpgrades: ["potency", "pliability"],
  });
  return { candidates };
}

// A Monument is a pure record of the strongest project built in a won Epoch.
function buildMonument(
  epoch: Epoch,
  outcome: CrisisOutcome,
  setting: Setting,
): Monument | undefined {
  if (outcome.contributingUnlocks.length === 0) return undefined;
  const strongest = outcome.contributingUnlocks[0]; // first is highest-pattern, earliest turn
  const project = setting.projects.find((p) => p.id === strongest.projectId);
  if (!project) return undefined;
  return {
    id: `monument-${project.id}-e${epoch.epochNumber}`,
    projectId: project.id,
    projectName: project.name,
    mintedOnEpoch: epoch.epochNumber,
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
    effect: { kind: "draw", count: 1, timing: "immediate" },
    tags: ["legacy"],
    flavor: "What survived is counted, twice.",
  };
}

export function applyUpgrade(
  candidate: LegacyCandidate,
  upgrade: "potency" | "pliability",
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
      case "removeDissent":
        return { ...e, amount: e.amount + 1 };
      case "draw":
        return { ...e, count: e.count + 1 };
      case "compound":
        return { ...e, effects: e.effects.map(amp) };
      default:
        return e;
    }
  };
  return amp(effect);
}
