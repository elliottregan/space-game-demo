<template>
  <div class="app-root">
    <header class="app-header">
      <h1>Deck-Building Demo</h1>
      <span class="app-sub" style="color: var(--text-muted); font-size: 12px">
        Throwaway prototype · {{ demonymLabel }}
      </span>
      <div class="spacer"></div>
      <SaveSlotMenu
        :slots="slots"
        :active-slot-id="activeSlotId"
        :max-slots="MAX_SLOTS"
        @switch-slot="onSwitchSlot"
        @new-slot="onNewSlot"
        @delete-slot="onDeleteSlot"
      />
      <ThemeToggle />
    </header>

    <div class="stats-bar">
      <TurnBar
        :epoch-number="epoch.epochNumber"
        :setting-name="setting.name"
        :turn="epoch.turn"
        :turn-limit="setting.rules.softTurnLimit"
        :influence="epoch.influence"
        :materials="epoch.materials"
        :dissent-count="snapshot.deckCounts.dissent"
        :dissent-fraction="dissentFraction"
        :ended="epoch.status.kind !== 'in-progress'"
        @end-turn="onEndTurn"
      />
    </div>

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
          :valid-slots-for="validSlotsFor"
          @retrieve="onRetrieve"
          @drop-card="onDropCardToSlot"
        />

        <HandPanel
          :hand="epoch.hand"
          :selected-ids="selectedIds"
          :influence="epoch.influence"
          :discard-gain="setting.rules.discardMaterialGain"
          :get-effective-cost="getEffectiveCost"
          :get-alignment="getAlignment"
          :valid-slots-for="validSlotsFor"
          @toggle-select="onToggleSelect"
          @clear-selection="onClearSelection"
          @play-to-slot="onPlayToSlot"
          @discard-selection="onDiscardSelection"
        />
        <DeckDiscardPanel
          :draw-count="epoch.draw.length"
          :discard-count="epoch.discard.length"
          :dissent-count="snapshot.deckCounts.dissent"
          :hand-count="epoch.hand.length"
          :discard-gain="setting.rules.discardMaterialGain"
          :ended="epoch.status.kind !== 'in-progress'"
          @view="onViewPile"
          @open-market="marketOpen = true"
          @end-turn="onEndTurn"
          @discard-and-end-turn="onDiscardAndEndTurn"
          @drop-card="onDropCardToDiscard"
        />

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

    <CampaignEnd v-if="campaignEnded" @restart="onNewSlot" />
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
import SaveSlotMenu from "./components/SaveSlotMenu.vue";
import ThemeToggle from "./components/ThemeToggle.vue";
import type { Card } from "../core/types.ts";
import { SETTING_BY_ID } from "../core/settings.ts";
import { MAX_SLOTS } from "../facade/persistence.ts";

const game = getGameService();

const selectedIds = ref<string[]>([]);
const pileView = ref<"deck" | "discard" | null>(null);
const marketOpen = ref(false);

const snapshot = computed(() => game.snapshot.value);
const setting = computed(() => snapshot.value.setting);
const epoch = computed(() => snapshot.value.epoch);
const eoe = computed(() => game.endOfEpoch.value);
const lastError = computed(() => game.lastError.value);
const demonymLabel = computed(() => snapshot.value.demonymLabel);
const slots = computed(() => game.slots.value);
const activeSlotId = computed(() => game.activeSlotId.value);

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
function validSlotsFor(cardId: string): number[] {
  return game.validSlots(cardId);
}

function onToggleSelect(id: string): void {
  const i = selectedIds.value.indexOf(id);
  if (i >= 0) selectedIds.value = selectedIds.value.filter((x) => x !== id);
  else selectedIds.value = [...selectedIds.value, id];
}
function onClearSelection(): void {
  selectedIds.value = [];
}
function onPlayToSlot(ids: string[], slotIndex: number): void {
  for (const id of ids) {
    // Re-check validity before each play: a prior placement can change the
    // slot state (e.g., stack size). Skip cards that no longer fit.
    if (game.validSlots(id).includes(slotIndex)) {
      game.playCard(id, slotIndex);
    }
  }
  selectedIds.value = [];
}
function onDiscardSelection(ids: string[]): void {
  for (const id of ids) game.discardForMaterial(id);
  selectedIds.value = [];
}
function onRetrieve(slotIndex: number): void {
  game.retrieve(slotIndex);
}
function onDropCardToSlot(cardId: string, slotIndex: number): void {
  game.playCard(cardId, slotIndex);
  selectedIds.value = selectedIds.value.filter((id) => id !== cardId);
}
function onDropCardToDiscard(cardId: string): void {
  game.discardForMaterial(cardId);
  selectedIds.value = selectedIds.value.filter((id) => id !== cardId);
}
function onPlayMegaStructure(projectId: string): void {
  game.playMegaStructure(projectId);
  selectedIds.value = [];
}
function onEndTurn(): void {
  game.endTurn();
  selectedIds.value = [];
}
function onDiscardAndEndTurn(): void {
  const ids = epoch.value.hand.map((c) => c.id);
  for (const id of ids) game.discardForMaterial(id);
  game.endTurn();
  selectedIds.value = [];
}
function onAdvance(choices: Record<string, "potency" | "pliability" | "persistence">): void {
  game.advanceEpoch(choices);
  selectedIds.value = [];
}
function onViewPile(which: "deck" | "discard"): void {
  pileView.value = which;
}

function onSwitchSlot(id: string): void {
  game.switchSlot(id);
  selectedIds.value = [];
}
function onNewSlot(): void {
  game.newCampaignSlot();
  selectedIds.value = [];
}
function onDeleteSlot(id: string): void {
  game.deleteSlot(id);
  selectedIds.value = [];
}
</script>
