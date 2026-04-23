<template>
  <div class="app-root">
    <header class="app-header">
      <h1>Deck-Building Demo</h1>
      <span class="app-sub" style="color: var(--fg-dim); font-size: 12px">
        Throwaway prototype · {{ demonymLabel }}
      </span>
      <div class="spacer"></div>
      <TurnBar
        :epoch-number="epoch.epochNumber"
        :setting-name="setting.name"
        :turn="epoch.turn"
        :turn-limit="setting.rules.softTurnLimit"
        :influence="epoch.influence"
        :materials="epoch.materials"
        :dissent-count="snapshot.deckCounts.dissent"
        :dissent-fraction="dissentFraction"
        :can-purge="true"
        :ended="epoch.status.kind !== 'in-progress'"
        @end-turn="onEndTurn"
        @purge="onPurge"
        @restart="onRestart"
      />
    </header>

    <div class="app-main">
      <div class="play-area">
        <ProjectZonesPanel
          :projects="setting.megaProjects"
          :progress="snapshot.projectProgress"
          @play="onPlayMegaStructure"
        />

        <IdeologyDisplay
          :vector="snapshot.vector"
          :terrain="snapshot.campaign.terrain"
          :demonym-label="demonymLabel"
        />

        <TableauPanel
          :tableau="epoch.tableau"
          :production="landProduction"
          :retrieve-cost="retrieveCost"
          :can-retrieve="canRetrieve"
          @retrieve="onRetrieve"
        />

        <div class="hand-row">
          <HandPanel
            :hand="epoch.hand"
            :selected-index="selectedIndex"
            :influence="epoch.influence"
            :valid-slots="validSlotsForSelected"
            :discard-gain="setting.rules.discardMaterialGain"
            :get-effective-cost="getEffectiveCost"
            :get-alignment="getAlignment"
            @select-card="onSelectCard"
            @play-card="onPlayCard"
            @discard-for-material="onDiscardForMaterial"
          />
          <DeckDiscardPanel
            :draw-count="epoch.draw.length"
            :discard-count="epoch.discard.length"
            :dissent-count="snapshot.deckCounts.dissent"
            @view="onViewPile"
            @open-market="marketOpen = true"
          />
        </div>

        <div v-if="lastError" class="error-bar">{{ lastError }}</div>
      </div>

      <LegacySidebar
        :terrain="snapshot.campaign.terrain"
        :monuments="snapshot.campaign.monuments"
        :legacy-cards="snapshot.campaign.legacyCards"
        :tasks="[]"
        :counts="snapshot.deckCounts"
        :events="epoch.eventLog"
        :dissent-threshold="setting.rules.dissentLossThreshold"
      />
    </div>

    <EndOfEpochScreen
      v-if="eoe"
      :state="eoe"
      :turn="epoch.turn"
      :next-setting-name="nextSettingName"
      @advance="onAdvance"
    />

    <CardListModal
      v-if="pileView"
      :title="pileView === 'deck' ? 'Deck' : 'Discard'"
      :cards="pileView === 'deck' ? epoch.draw : epoch.discard"
      @close="pileView = null"
    />

    <MarketModal v-if="marketOpen" @close="marketOpen = false" />

    <CampaignEnd v-if="campaignEnded" @restart="onRestart" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { getGameService } from "./GameService.ts";
import TurnBar from "./components/TurnBar.vue";
import HandPanel from "./components/HandPanel.vue";
import TableauPanel from "./components/TableauPanel.vue";
import ProjectZonesPanel from "./components/ProjectZonesPanel.vue";
import IdeologyDisplay from "./components/IdeologyDisplay.vue";
import LegacySidebar from "./components/LegacySidebar.vue";
import EndOfEpochScreen from "./components/EndOfEpochScreen.vue";
import CampaignEnd from "./components/CampaignEnd.vue";
import DeckDiscardPanel from "./components/DeckDiscardPanel.vue";
import CardListModal from "./components/CardListModal.vue";
import MarketModal from "./components/MarketModal.vue";
import type { Card } from "../core/types.ts";
import { SETTING_BY_ID } from "../core/settings.ts";

const game = getGameService();

const selectedIndex = ref<number | null>(null);
const pileView = ref<"deck" | "discard" | null>(null);
const marketOpen = ref(false);

const snapshot = computed(() => game.snapshot.value);
const setting = computed(() => snapshot.value.setting);
const epoch = computed(() => snapshot.value.epoch);
const eoe = computed(() => game.endOfEpoch.value);
const lastError = computed(() => game.lastError.value);
const demonymLabel = computed(() => snapshot.value.demonymLabel);

const landProduction = computed(() => {
  let total = 0;
  for (const slot of epoch.value.tableau) {
    for (const l of slot.lands) total += landMat(l.rank);
  }
  return total;
});

function landMat(rank: number): number {
  if (rank <= 5) return 1;
  if (rank <= 7) return 2;
  return 3;
}

const dissentFraction = computed(() => {
  const counts = snapshot.value.deckCounts;
  const total = counts.hand + counts.draw + counts.discard;
  return total === 0 ? 0 : counts.dissent / total;
});

const campaignEnded = computed(
  () => !eoe.value && snapshot.value.campaign.currentSettingId === "campaign-end",
);

const nextSettingName = computed(() => {
  if (!eoe.value) return "";
  const id = eoe.value.nextSettingId;
  if (id === "campaign-end") return "End";
  return SETTING_BY_ID[id]?.name ?? id;
});

const validSlotsForSelected = computed(() => {
  if (selectedIndex.value === null) return [];
  const card = epoch.value.hand[selectedIndex.value];
  if (!card) return [];
  return game.validSlots(card.id);
});

function getEffectiveCost(card: Card): number {
  return game.getEffectiveCost(card);
}
function getAlignment(card: Card): "aligned" | "opposed" | "neutral" {
  return game.getAlignment(card);
}
function canRetrieve(slotIndex: number): boolean {
  return game.canRetrieve(slotIndex);
}
function retrieveCost(slotIndex: number): { inf: number; mat: number } | null {
  return game.retrieveCost(slotIndex);
}

function onSelectCard(index: number): void {
  selectedIndex.value = selectedIndex.value === index ? null : index;
}
function onPlayCard(handIndex: number, slotIndex: number): void {
  const card = epoch.value.hand[handIndex];
  if (!card) return;
  game.playCard(card.id, slotIndex);
  selectedIndex.value = null;
}
function onRetrieve(slotIndex: number): void {
  game.retrieve(slotIndex);
}
function onDiscardForMaterial(handIndex: number): void {
  const card = epoch.value.hand[handIndex];
  if (!card) return;
  game.discardForMaterial(card.id);
  selectedIndex.value = null;
}
function onPlayMegaStructure(projectId: string): void {
  game.playMegaStructure(projectId);
  selectedIndex.value = null;
}
function onEndTurn(): void {
  game.endTurn();
  selectedIndex.value = null;
}
function onPurge(): void {
  game.purgeDissent();
}
function onAdvance(choices: Record<string, "potency" | "pliability" | "persistence">): void {
  game.advanceEpoch(choices);
  selectedIndex.value = null;
}
function onRestart(): void {
  game.restart();
  selectedIndex.value = null;
}
function onViewPile(which: "deck" | "discard"): void {
  pileView.value = which;
}
</script>
