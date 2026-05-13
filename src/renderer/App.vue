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
        :max-turns="setting.rules.maxTurns"
        :influence="epoch.influence"
        :materials="epoch.materials"
        :dissent-count="snapshot.deckCounts.dissent"
        :dissent-fraction="dissentFraction"
        :ended="epoch.status.kind !== 'in-progress'"
        @end-turn="onEndTurn"
      />
    </div>

    <div class="app-main">
      <Rail side="left" :items="leftRailItems" :active-key="leftRailActive" @toggle="toggleLeft" />

      <div class="play-area">
        <TableauPanel
          :columns="epoch.columns"
          :production="landProduction"
          :column-buildable="snapshot.columnBuildable"
          :buildable-labels="buildableLabels"
          :get-card-from-hand="getCardFromHand"
          @place-card="onPlaceCard"
          @discard-land="onDiscardLand"
          @discard-charter="onDiscardCharter"
          @recall-influence="onRecallInfluence"
          @discard-column="onDiscardColumn"
          @build="onBuild"
        />

        <HandPanel
          :hand="epoch.hand"
          :selected-ids="selectedIds"
          :influence="epoch.influence"
          :columns="epoch.columns"
          :valid-columns-for="validColumnsFor"
          @toggle-select="onToggleSelect"
          @clear-selection="onClearSelection"
          @place-cards="onPlaceCards"
          @discard-from-hand="onDiscardFromHand"
          @commit-to-row="onCommitToRow"
        />

        <button
          v-if="!eoe && epoch.phase === 'crisis'"
          class="primary resolve-crisis"
          @click="onResolveCrisis"
        >
          Resolve Crisis
        </button>

        <div v-if="lastError" class="error-bar">{{ lastError }}</div>

        <RailFlyout
          v-if="leftRailActive === 'projects'"
          side="left"
          title="Keystone Projects"
          @close="leftRailActive = null"
        >
          <UnlockedProjectsPanel
            :unlocks="epoch.unlockedProjects"
            :projects="setting.projects"
            :breakdown="snapshot.ideologyBreakdown"
          />
        </RailFlyout>
        <RailFlyout
          v-else-if="leftRailActive === 'crisis'"
          side="left"
          title="Crisis"
          @close="leftRailActive = null"
        >
          <CrisisCounterPanel
            :crisis="setting.crisis"
            :unlocks="epoch.unlockedProjects"
            :projects="setting.projects"
          />
        </RailFlyout>
        <RailFlyout
          v-else-if="leftRailActive === 'ideology'"
          side="left"
          title="Ideology"
          @close="leftRailActive = null"
        >
          <IdeologyDisplay :vector="snapshot.vector" />
        </RailFlyout>

        <RailFlyout
          v-if="rightRailActive === 'terrain'"
          side="right"
          title="Terrain"
          @close="rightRailActive = null"
        >
          <TerrainSection :terrain="snapshot.campaign.terrain" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'monuments'"
          side="right"
          title="Monuments"
          @close="rightRailActive = null"
        >
          <MonumentsSection :monuments="snapshot.campaign.monuments" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'legacy'"
          side="right"
          title="Legacy Cards"
          @close="rightRailActive = null"
        >
          <LegacyCardsSection :cards="snapshot.campaign.legacyCards" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'counts'"
          side="right"
          title="Deck Counts"
          @close="rightRailActive = null"
        >
          <DeckCountsSection
            :counts="snapshot.deckCounts"
            :dissent-threshold="setting.rules.dissentLossThreshold"
          />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'log'"
          side="right"
          title="Event Log"
          @close="rightRailActive = null"
        >
          <EventLogSection :events="epoch.eventLog" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'piles'"
          side="right"
          title="Deck & Discard"
          @close="rightRailActive = null"
        >
          <DeckDiscardPanel
            :draw-count="epoch.draw.length"
            :discard-count="epoch.discard.length"
            :ended="epoch.status.kind !== 'in-progress'"
            @view="onViewPile"
            @open-market="marketOpen = true"
            @end-turn="onEndTurn"
            @drop-card="onDiscardFromHand"
          />
        </RailFlyout>
      </div>

      <Rail
        side="right"
        :items="rightRailItems"
        :active-key="rightRailActive"
        @toggle="toggleRight"
      />
    </div>

    <CrisisScreen
      v-if="eoe"
      :crisis="setting.crisis"
      :outcome="eoe.crisis"
      :projects="setting.projects"
      :candidates="eoe.candidates"
      :breakdown="eoe.ideologyBreakdown"
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
import TurnBar from "./components/shell/TurnBar.vue";
import HandPanel from "./components/game/HandPanel.vue";
import TableauPanel from "./components/game/TableauPanel.vue";
import UnlockedProjectsPanel from "./components/game/UnlockedProjectsPanel.vue";
import IdeologyDisplay from "./components/game/IdeologyDisplay.vue";
import CrisisScreen from "./components/game/CrisisScreen.vue";
import CampaignEnd from "./components/shell/CampaignEnd.vue";
import DeckDiscardPanel from "./components/game/DeckDiscardPanel.vue";
import CardListModal from "./components/shell/CardListModal.vue";
import MarketModal from "./components/shell/MarketModal.vue";
import SaveSlotMenu from "./components/shell/SaveSlotMenu.vue";
import ThemeToggle from "./components/shell/ThemeToggle.vue";
import CrisisCounterPanel from "./components/game/CrisisCounterPanel.vue";
import Rail, { type RailItem } from "./components/shell/Rail.vue";
import RailFlyout from "./components/shell/RailFlyout.vue";
import TerrainSection from "./components/shell/sidebar/TerrainSection.vue";
import MonumentsSection from "./components/shell/sidebar/MonumentsSection.vue";
import LegacyCardsSection from "./components/shell/sidebar/LegacyCardsSection.vue";
import DeckCountsSection from "./components/shell/sidebar/DeckCountsSection.vue";
import EventLogSection from "./components/shell/sidebar/EventLogSection.vue";
import type { Card } from "../core/types.ts";
import { SETTING_BY_ID } from "../core/settings/index.ts";
import { MAX_SLOTS } from "../facade/persistence.ts";
import { evaluateColumn } from "../core/engine/columnPatterns.ts";

const game = getGameService();

const selectedIds = ref<string[]>([]);
const pileView = ref<"deck" | "discard" | null>(null);
const marketOpen = ref(false);

const leftRailActive = ref<string | null>(null);
const rightRailActive = ref<string | null>(null);

const leftRailItems: RailItem[] = [
  { key: "projects", label: "Keystone Projects", icon: "projects" },
  { key: "crisis", label: "Crisis Counter", icon: "crisis" },
  { key: "ideology", label: "Ideology", icon: "ideology" },
];

const rightRailItems: RailItem[] = [
  { key: "terrain", label: "Terrain", icon: "terrain" },
  { key: "monuments", label: "Monuments", icon: "monuments" },
  { key: "legacy", label: "Legacy Cards", icon: "legacy" },
  { key: "counts", label: "Deck Counts", icon: "counts" },
  { key: "log", label: "Event Log", icon: "log" },
  { key: "piles", label: "Deck & Discard", icon: "piles" },
];

function toggleLeft(key: string): void {
  leftRailActive.value = leftRailActive.value === key ? null : key;
}
function toggleRight(key: string): void {
  rightRailActive.value = rightRailActive.value === key ? null : key;
}

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
  for (const col of epoch.value.columns) {
    for (const l of col.lands.cards) total += landMat(l.rank);
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

const buildableLabels = computed(() => {
  return epoch.value.columns.map((col) => {
    const m = evaluateColumn(col, setting.value.projects);
    if (!m) return "";
    const p = setting.value.projects.find((p) => p.id === m.projectId);
    return p ? `${patternLabel(m.kind)} → ${p.name} (+${p.value})` : "";
  });
});

function getCardFromHand(cardId: string): Card | null {
  return epoch.value.hand.find((c) => c.id === cardId) ?? null;
}

function patternLabel(p: string): string {
  const labels: Record<string, string> = {
    "high-card": "High Card",
    pair: "Pair",
    "two-pair": "Two Pair",
    "three-of-a-kind": "Three of a Kind",
    straight: "Straight",
    flush: "Flush",
    "full-house": "Full House",
    "four-of-a-kind": "Four of a Kind",
    "straight-flush": "Straight Flush",
    "royal-flush": "Royal Flush",
  };
  return labels[p] || p;
}

function validColumnsFor(cardId: string): number[] {
  return game.validColumns(cardId);
}

function onToggleSelect(id: string): void {
  const i = selectedIds.value.indexOf(id);
  if (i >= 0) selectedIds.value = selectedIds.value.filter((x) => x !== id);
  else selectedIds.value = [...selectedIds.value, id];
}
function onClearSelection(): void {
  selectedIds.value = [];
}
function onPlaceCard(cardId: string, i: number): void {
  game.placeCard(cardId, i);
}
function onPlaceCards(ids: string[], i: number): void {
  for (const id of ids) {
    if (game.validColumns(id).includes(i)) game.placeCard(id, i);
  }
  selectedIds.value = [];
}
function onCommitToRow(columnIndex: number, row: "land" | "influence"): void {
  // Sync the service's commitBuffer with the current selection, then commit.
  game.commitBuffer.value = [...selectedIds.value];
  game.commitToRow(columnIndex, row);
  // commitToRow calls clearBuffer on success; mirror that in selectedIds.
  if (game.commitBuffer.value.length === 0) {
    selectedIds.value = [];
  }
}
function onDiscardLand(i: number): void {
  game.discardLand(i);
}
function onDiscardCharter(i: number): void {
  game.discardCharter(i);
}
function onRecallInfluence(i: number): void {
  game.recallInfluence(i);
}
function onDiscardColumn(i: number): void {
  game.discardColumn(i);
}
function onBuild(i: number): void {
  game.buildColumn(i);
}
function onDiscardFromHand(idOrIds: string | string[]): void {
  const ids = typeof idOrIds === "string" ? [idOrIds] : idOrIds;
  for (const id of ids) game.discardFromHand(id);
  selectedIds.value = [];
}
function onResolveCrisis(): void {
  game.resolveCrisis();
}
function onEndTurn(): void {
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
