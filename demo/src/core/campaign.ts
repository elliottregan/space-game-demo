// Campaign management: new game, Epoch transitions.

import type {
  Campaign,
  Epoch,
  EpochResult,
  LegacyCandidate,
  LegacyCard,
  Setting,
} from "./types.ts";
import {
  applyUpgrade,
  addMonumentToCampaign,
  applyLossTerrainScar,
  mintCandidatesOnLoss,
  mintCandidatesOnWin,
  type MintingResult,
} from "./legacy.ts";
import { HOMEWORLD } from "./homeworld.ts";
import { currentVector, createEpoch } from "./epoch.ts";
import { getSetting } from "./settings.ts";
import { createRng, type RNG } from "./rng.ts";

export function createCampaign(seed: number): Campaign {
  return {
    id: `campaign-${Date.now().toString(36)}`,
    seed,
    currentSettingId: HOMEWORLD.id,
    legacyCards: [],
    monuments: [],
    terrain: { axis1: 0, axis2: 0 },
    epochHistory: [],
    epochCount: 0,
  };
}

export interface EndOfEpochState {
  candidates: LegacyCandidate[];
  monument?: MintingResult["monument"];
  nextSettingId: string | "campaign-end";
  outcome: "win" | "loss";
}

/**
 * Called when an Epoch ends (won or lost). Produces the end-of-epoch state:
 * legacy candidates to choose upgrades for, and the next setting id.
 *
 * Does NOT mutate campaign.legacyCards / monuments / terrain yet —
 * that happens in `finalizeEpoch` after the player picks upgrades.
 */
export function prepareEndOfEpoch(
  epoch: Epoch,
  setting: Setting,
  campaign: Campaign,
): EndOfEpochState {
  const status = epoch.status;
  if (status.kind === "won") {
    const project = setting.megaProjects.find((p) => p.id === status.projectId)!;
    const result = mintCandidatesOnWin(epoch, setting, campaign, project, status.tier);
    return {
      candidates: result.candidates,
      monument: result.monument,
      nextSettingId: setting.transitions.onWin[project.id] ?? "campaign-end",
      outcome: "win",
    };
  }
  if (status.kind === "lost") {
    const result = mintCandidatesOnLoss(epoch, setting, status.mode);
    return {
      candidates: result.candidates,
      nextSettingId: setting.transitions.onLoss,
      outcome: "loss",
    };
  }
  // in-progress: shouldn't be called; return harmless state.
  return { candidates: [], nextSettingId: "campaign-end", outcome: "loss" };
}

/**
 * Finalize an Epoch with chosen upgrade paths. Applies Monument, terrain,
 * legacy cards, epoch history. Returns the next-Epoch setup or campaign-end.
 */
export function finalizeEpoch(
  epoch: Epoch,
  setting: Setting,
  campaign: Campaign,
  state: EndOfEpochState,
  upgradeChoices: Record<string, "potency" | "pliability" | "persistence">,
): { kind: "next"; epoch: Epoch; setting: Setting } | { kind: "campaign-end" } {
  // Apply upgrades → legacy cards → campaign.
  const legacyCards: LegacyCard[] = state.candidates.map((cand) =>
    applyUpgrade(
      cand,
      upgradeChoices[cand.id] ?? cand.suggestedUpgrades[0] ?? "potency",
      epoch.epochNumber,
    ),
  );
  campaign.legacyCards.push(...legacyCards);

  // Monument + terrain (only on win).
  if (state.monument) {
    addMonumentToCampaign(campaign, state.monument);
  }
  if (epoch.status.kind === "lost") {
    const finalVector = currentVector(epoch, campaign);
    applyLossTerrainScar(campaign, epoch.status.mode, finalVector);
  }

  // Persist Epoch result.
  const result: EpochResult = {
    epochNumber: epoch.epochNumber,
    settingId: setting.id,
    outcome: state.outcome,
    completedProjectId: epoch.status.kind === "won" ? epoch.status.projectId : undefined,
    completionTier: epoch.status.kind === "won" ? epoch.status.tier : undefined,
    lossMode: epoch.status.kind === "lost" ? epoch.status.mode : undefined,
    mintedLegacyIds: legacyCards.map((l) => l.id),
    finalIdeology: currentVector(epoch, campaign),
  };
  campaign.epochHistory.push(result);
  campaign.epochCount = epoch.epochNumber;

  // Transition.
  if (state.nextSettingId === "campaign-end") {
    campaign.currentSettingId = "campaign-end";
    return { kind: "campaign-end" };
  }

  const nextSetting = getSetting(state.nextSettingId);
  campaign.currentSettingId = nextSetting.id;
  const rng = nextEpochRng(campaign);
  const nextEpoch = createEpoch(nextSetting, campaign, rng, epoch.epochNumber + 1);
  return { kind: "next", epoch: nextEpoch, setting: nextSetting };
}

function nextEpochRng(campaign: Campaign): RNG {
  return createRng(campaign.seed + campaign.epochCount + 1);
}
