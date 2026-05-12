// Campaign management: new game, Epoch transitions.

import type {
  Campaign,
  CrisisOutcome,
  Epoch,
  EpochResult,
  Ideology,
  LegacyCandidate,
  LegacyCard,
  Setting,
} from "../types.ts";
import {
  applyUpgrade,
  addMonumentToCampaign,
  applyLossTerrainScar,
  mintCandidatesOnLoss,
  mintCandidatesOnWin,
  type MintingResult,
} from "./legacy.ts";
import { unlockedIdeologyBreakdown } from "../data/projects.ts";
import { HOMEWORLD } from "../settings/homeworld.ts";
import { currentVector, createEpoch } from "./epoch.ts";
import { getSetting } from "../settings/index.ts";
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
  crisis: CrisisOutcome;
  ideologyBreakdown: Record<Ideology, number>;
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
  if (status.kind !== "won" && status.kind !== "lost") {
    return {
      candidates: [],
      nextSettingId: "campaign-end",
      outcome: "loss",
      crisis: { totalValue: 0, cleared: false, contributingUnlocks: [] },
      ideologyBreakdown: { solidarity: 0, sovereignty: 0, transformation: 0, heritage: 0 },
    };
  }
  const result =
    status.kind === "won"
      ? mintCandidatesOnWin(epoch, setting, campaign, status.outcome)
      : mintCandidatesOnLoss(epoch, setting, status.outcome);
  return {
    candidates: result.candidates,
    monument: result.monument,
    nextSettingId: status.kind === "won" ? setting.transitions.onWin : setting.transitions.onLoss,
    outcome: status.kind === "won" ? "win" : "loss",
    crisis: status.outcome,
    ideologyBreakdown: unlockedIdeologyBreakdown(epoch.unlockedProjects),
  };
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
  const legacyCards: LegacyCard[] = state.candidates.map((cand) =>
    applyUpgrade(
      cand,
      upgradeChoices[cand.id] ?? cand.suggestedUpgrades[0] ?? "potency",
      epoch.epochNumber,
    ),
  );
  campaign.legacyCards.push(...legacyCards);
  if (state.monument) addMonumentToCampaign(campaign, state.monument);
  if (state.outcome === "loss") {
    applyLossTerrainScar(campaign, state.crisis, currentVector(epoch, campaign));
  }

  const result: EpochResult = {
    epochNumber: epoch.epochNumber,
    settingId: setting.id,
    outcome: state.outcome,
    totalValue: state.crisis.totalValue,
    unlockCount: epoch.unlockedProjects.length,
    mintedLegacyIds: legacyCards.map((l) => l.id),
    finalIdeology: currentVector(epoch, campaign),
  };
  campaign.epochHistory.push(result);
  campaign.epochCount = epoch.epochNumber;

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
