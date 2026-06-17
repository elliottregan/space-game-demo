<template>
  <div class="app-root">
    <header class="app-header">
      <h1>Deck-Building Demo</h1>
      <span class="app-sub"> Throwaway prototype · {{ demonymLabel }} </span>
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
        :dissent-count="snapshot.deckCounts.dissent"
        :ended="epoch.status.kind !== 'in-progress'"
        :effective="snapshot.effective"
        :base-hand-size="setting.rules.handSize"
        :base-influence-baseline="setting.rules.influenceBaseline"
        :base-storage-capacity="setting.rules.storageCapacity"
        @end-turn="onEndTurn"
      />
    </div>

    <div class="app-main">
      <Rail side="left" :items="leftRailItems" :active-key="leftRailActive" @toggle="toggleLeft" />

      <ProjectTreePanel :projects="setting.projects" :unlocks="epoch.unlockedProjects" />

      <div class="play-area">
        <TableauPanel
          :class="{ 'phase-locked': policyPhase }"
          :columns="epoch.columns"
          :column-buildable="snapshot.columnBuildable"
          :buildable-labels="buildableLabels"
          :get-card-from-hand="getCardFromHand"
          :selected-storage-for="selectedStorageFor"
          :can-place-stored="canPlaceStored"
          @place-card="onPlaceCard"
          @store-card="onStoreCard"
          @toggle-storage-select="onToggleStorageSelect"
          @place-from-storage="onPlaceFromStorage"
          @discard-land="onDiscardLand"
          @discard-charter="onDiscardCharter"
          @recall-influence="onRecallInfluence"
          @discard-column="onDiscardColumn"
          @build="onBuild"
        />

        <div class="hand-row" :class="{ 'phase-locked': policyPhase }">
          <DiscardPilePanel
            :discard-count="epoch.discard.length"
            @view="onViewPile('discard')"
            @drop-card="onDiscardFromHand"
          />
          <HandPanel
            :hand="epoch.hand"
            :selected-ids="selectedIds"
            :influence="epoch.influence"
            :columns="epoch.columns"
            :valid-columns-for="validColumnsFor"
            :discard-ids="discardIds"
            :storage-selection="storageSelection"
            @toggle-select="onToggleSelect"
            @clear-selection="onClearSelection"
            @place-cards="onPlaceCards"
            @commit-to-row="onCommitToRow"
          />
          <DeckPilePanel
            :draw-count="epoch.draw.length"
            :ended="epoch.status.kind !== 'in-progress' || policyPhase"
            @view="onViewPile('deck')"
            @end-turn="onEndTurn"
          />
        </div>

        <div class="policy-zone">
          <PolicyTableau :tableau="snapshot.policy.tableau" @remove="onRemovePolicy" />
          <PolicyPiles :decks="snapshot.policy.decks" :discards="snapshot.policy.discards" />
        </div>

        <PolicyHandModal
          v-if="policyPhase"
          :candidates="snapshot.policy.candidates"
          :tableau="snapshot.policy.tableau"
          :influence="snapshot.influence"
          @enact="onEnactPolicies"
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
          v-if="leftRailActive === 'crisis'"
          side="left"
          title="Crisis counter"
          @close="leftRailActive = null"
        >
          <CrisisCounterPanel
            :crisis="setting.crisis"
            :unlocks="epoch.unlockedProjects"
            :projects="setting.projects"
            :turn="epoch.turn"
            :max-turns="setting.rules.maxTurns"
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
          v-if="rightRailActive === 'monuments'"
          side="right"
          title="Monuments"
          @close="rightRailActive = null"
        >
          <MonumentsSection :monuments="snapshot.campaign.monuments" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'legacy'"
          side="right"
          title="Legacy cards"
          @close="rightRailActive = null"
        >
          <LegacyCardsSection :cards="snapshot.campaign.legacyCards" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'counts'"
          side="right"
          title="Deck counts"
          @close="rightRailActive = null"
        >
          <DeckCountsSection :counts="snapshot.deckCounts" />
        </RailFlyout>
        <RailFlyout
          v-else-if="rightRailActive === 'log'"
          side="right"
          title="Event log"
          @close="rightRailActive = null"
        >
          <EventLogSection :events="epoch.eventLog" />
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

    <CampaignEnd v-if="campaignEnded" @restart="onNewSlot" />

    <ConfirmDialog
      :open="pendingConfirm !== null"
      :title="pendingConfirm?.title ?? ''"
      :confirm-label="pendingConfirm?.confirmLabel"
      danger
      @confirm="
        () => {
          pendingConfirm?.action();
          pendingConfirm = null;
        }
      "
      @cancel="pendingConfirm = null"
      >{{ pendingConfirm?.body }}</ConfirmDialog
    >
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { getGameService } from "./GameService.ts";
import {
  CARD_FLIGHT,
  captureCard,
  flyCapturedClone,
  getPileRect,
  policyDiscardPile,
  type CapturedCard,
} from "./animation/cardFlight.ts";
import ConfirmDialog from "./components/core/ConfirmDialog.vue";
import TurnBar from "./components/shell/TurnBar.vue";
import HandPanel from "./components/game/HandPanel.vue";
import TableauPanel from "./components/game/TableauPanel.vue";
import ProjectTreePanel from "./components/game/ProjectTreePanel.vue";
import IdeologyDisplay from "./components/game/IdeologyDisplay.vue";
import CrisisScreen from "./components/game/CrisisScreen.vue";
import CampaignEnd from "./components/shell/CampaignEnd.vue";
import DeckPilePanel from "./components/game/DeckPilePanel.vue";
import DiscardPilePanel from "./components/game/DiscardPilePanel.vue";
import CardListModal from "./components/shell/CardListModal.vue";
import SaveSlotMenu from "./components/shell/SaveSlotMenu.vue";
import ThemeToggle from "./components/shell/ThemeToggle.vue";
import CrisisCounterPanel from "./components/game/CrisisCounterPanel.vue";
import PolicyHandModal from "./components/game/PolicyHandModal.vue";
import PolicyTableau from "./components/game/PolicyTableau.vue";
import PolicyPiles from "./components/game/PolicyPiles.vue";
import Rail, { type RailItem } from "./components/shell/Rail.vue";
import RailFlyout from "./components/shell/RailFlyout.vue";
import MonumentsSection from "./components/shell/sidebar/MonumentsSection.vue";
import LegacyCardsSection from "./components/shell/sidebar/LegacyCardsSection.vue";
import DeckCountsSection from "./components/shell/sidebar/DeckCountsSection.vue";
import EventLogSection from "./components/shell/sidebar/EventLogSection.vue";
import type { Card, Ideology, LegacyUpgrade } from "../core/types.ts";
import { SETTING_BY_ID } from "../core/settings/index.ts";
import { MAX_SLOTS } from "../facade/persistence.ts";
import { evaluateColumn } from "../core/engine/columnPatterns.ts";
import { patternLabel } from "./util/labels.ts";
import { canPlaceLand, canPlaceInfluence, canPlaceCharter } from "../core/engine/column.ts";

const game = getGameService();

const selectedIds = ref<string[]>([]);
// Storage selection: cards are column-local, so at most one column's
// storage can participate in a commit at a time.
const selectedStorage = ref<{ columnIndex: number; ids: string[] } | null>(null);
const pileView = ref<"deck" | "discard" | null>(null);

// Generic pending confirmation. Set to a descriptor to show the dialog;
// clear to null on cancel or after the action fires.
const pendingConfirm = ref<{
  title: string;
  body: string;
  confirmLabel: string;
  action: () => void;
} | null>(null);

const leftRailActive = ref<string | null>(null);
const rightRailActive = ref<string | null>(null);

const leftRailItems: RailItem[] = [
  { key: "crisis", label: "Crisis counter", icon: "crisis" },
  { key: "ideology", label: "Ideology", icon: "ideology" },
];

const rightRailItems: RailItem[] = [
  { key: "monuments", label: "Monuments", icon: "monuments" },
  { key: "legacy", label: "Legacy cards", icon: "legacy" },
  { key: "counts", label: "Deck counts", icon: "counts" },
  { key: "log", label: "Event log", icon: "log" },
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
// During the policy phase the core rejects all board verbs; the UI reflects
// that by locking the building hand/tableau and suppressing End Turn until the
// drawn policies are enacted.
const policyPhase = computed(() => snapshot.value.turnPhase === "policy");
const eoe = computed(() => game.endOfEpoch.value);
const lastError = computed(() => game.lastError.value);
const demonymLabel = computed(() => snapshot.value.demonymLabel);
const slots = computed(() => game.slots.value);
const activeSlotId = computed(() => game.activeSlotId.value);

const campaignEnded = computed(
  () => !eoe.value && snapshot.value.campaign.currentSettingId === "campaign-end",
);

const nextSettingName = computed(() => {
  if (!eoe.value) return "";
  const id = eoe.value.nextSettingId;
  if (id === "campaign-end") return "End";
  return SETTING_BY_ID[id]?.name ?? id;
});

const discardIds = computed(() => epoch.value.discard.map((c) => c.id));

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
  selectedStorage.value = null;
}

function onToggleStorageSelect(columnIndex: number, cardId: string): void {
  const cur = selectedStorage.value;
  if (!cur || cur.columnIndex !== columnIndex) {
    selectedStorage.value = { columnIndex, ids: [cardId] };
    return;
  }
  const ids = cur.ids.includes(cardId) ? cur.ids.filter((x) => x !== cardId) : [...cur.ids, cardId];
  selectedStorage.value = ids.length ? { columnIndex, ids } : null;
}

function onStoreCard(cardId: string, columnIndex: number): void {
  if (policyPhase.value) return;
  // Capacity 1: replace the current occupant when full.
  const capacity = setting.value.rules.storageCapacity;
  const full = (epoch.value.columns[columnIndex]?.storage.length ?? 0) >= capacity;
  const occupant = epoch.value.columns[columnIndex]?.storage[0];

  if (full && occupant) {
    // Destructive replace path: ask for confirmation before discarding the occupant.
    const incomingName = epoch.value.hand.find((c) => c.id === cardId)?.name ?? cardId;
    const occupantName = occupant.name;
    pendingConfirm.value = {
      title: "Replace stored card?",
      body: `Storing ${incomingName} will discard ${occupantName} and add 1 Dissent.`,
      confirmLabel: "Replace",
      action: () => {
        game.storeCard(cardId, columnIndex, occupant.id);
        selectedIds.value = selectedIds.value.filter((x) => x !== cardId);
        if (selectedStorage.value?.columnIndex === columnIndex) {
          selectedStorage.value = null;
        }
      },
    };
    return;
  }

  // Empty-slot path: immediate, no confirmation needed.
  game.storeCard(cardId, columnIndex, undefined);
  selectedIds.value = selectedIds.value.filter((x) => x !== cardId);
  if (selectedStorage.value?.columnIndex === columnIndex) {
    selectedStorage.value = null;
  }
}

function onPlaceFromStorage(cardId: string, columnIndex: number): void {
  if (policyPhase.value) return;
  game.placeFromStorage(cardId, columnIndex);
  selectedStorage.value = null;
}

const storageSelection = computed(() => {
  const sel = selectedStorage.value;
  if (!sel) return null;
  const col = epoch.value.columns[sel.columnIndex];
  const cards = sel.ids.flatMap((id) => {
    const c = col?.storage.find((s) => s.id === id);
    return c ? [c] : [];
  });
  return cards.length ? { columnIndex: sel.columnIndex, cards } : null;
});

function selectedStorageFor(col: number): string[] {
  return selectedStorage.value?.columnIndex === col ? selectedStorage.value.ids : [];
}

function canPlaceStored(col: number, card: Card): boolean {
  const column = epoch.value.columns[col];
  if (!column || card.tags.includes("dissent")) return false;
  if (card.kind === "land") return canPlaceLand(column, card);
  if (card.kind === "role")
    return canPlaceInfluence(column, card) && epoch.value.influence >= card.influenceCost;
  if (card.kind === "charter")
    return canPlaceCharter(column, card) && epoch.value.influence >= card.influenceCost;
  return false;
}

function onPlaceCard(cardId: string, i: number): void {
  if (policyPhase.value) return;
  game.placeCard(cardId, i);
}
function onPlaceCards(ids: string[], i: number): void {
  if (policyPhase.value) return;
  for (const id of ids) {
    if (game.validColumns(id).includes(i)) game.placeCard(id, i);
  }
  selectedIds.value = [];
}
function onCommitToRow(columnIndex: number, row: "land" | "influence"): void {
  if (policyPhase.value) return;
  // Sync the service's commitBuffer with the current selection, then commit.
  game.commitBuffer.value = [...selectedIds.value];
  const sel = storageSelection.value;
  const fromStorage = sel && sel.columnIndex === columnIndex ? sel.cards.map((c) => c.id) : [];
  game.commitToRow(columnIndex, row, fromStorage);
  // commitToRow calls clearBuffer on success; mirror that in selectedIds.
  if (game.commitBuffer.value.length === 0) {
    selectedIds.value = [];
    selectedStorage.value = null;
  }
}
function onDiscardLand(i: number): void {
  if (policyPhase.value) return;
  game.discardLand(i);
}
function onDiscardCharter(i: number): void {
  if (policyPhase.value) return;
  game.discardCharter(i);
}
function onRecallInfluence(i: number): void {
  if (policyPhase.value) return;
  game.recallInfluence(i);
}
function onDiscardColumn(i: number): void {
  if (policyPhase.value) return;
  game.discardColumn(i);
}
function onBuild(i: number): void {
  if (policyPhase.value) return;
  game.buildColumn(i);
}
function onDiscardFromHand(idOrIds: string | string[]): void {
  if (policyPhase.value) return;
  const ids = typeof idOrIds === "string" ? [idOrIds] : idOrIds;
  for (const id of ids) game.discardFromHand(id);
  selectedIds.value = [];
}
function onResolveCrisis(): void {
  game.resolveCrisis();
}
/**
 * Enact choreography. The policy modal unmounts the instant `enactPolicies`
 * flips the phase to "play", so we snapshot each drawn card (clone + rect) from
 * the modal DOM *before* the state change, then — once the new tableau row and
 * discard tiles have rendered — fly the kept clones into their tableau slots and
 * the unkept clones onto their ideology discard tiles.
 */
function onEnactPolicies(keepIds: string[]): void {
  const kept = new Set(keepIds);
  const captures: { id: string; ideology: Ideology; keep: boolean; card: CapturedCard }[] = [];

  const scrim = document.querySelector(".policy-modal-scrim");
  if (scrim) {
    for (const slot of scrim.querySelectorAll<HTMLElement>("[data-candidate-index]")) {
      const id = slot.dataset.candidateId;
      const ideology = slot.dataset.candidateIdeology as Ideology | undefined;
      const cardEl = slot.querySelector<HTMLElement>(".policy-card");
      if (!id || !ideology || !cardEl) continue;
      captures.push({ id, ideology, keep: kept.has(id), card: captureCard(cardEl) });
    }
  }

  // Advance state (clears candidates, updates tableau/discards, unmounts modal).
  game.enactPolicies(keepIds);

  if (captures.length === 0) return;

  // Destinations only exist after the snapshot re-renders.
  void nextTick(() => {
    // Stagger kept and unkept independently so each wave reads as a group.
    let keptN = 0;
    let discardN = 0;
    for (const c of captures) {
      if (c.keep) {
        const target = document.querySelector<HTMLElement>(
          `[data-policy-id="${CSS.escape(c.id)}"]`,
        );
        const toRect = target?.getBoundingClientRect() ?? null;
        // `target` IS the `.policy-card` element: PolicyTableau binds
        // `data-policy-id` directly on <PolicyCard>, whose single root carries
        // `class="policy-card …"` and (no inheritAttrs:false) absorbs the attr.
        // `querySelector(".policy-card")` would search descendants only and
        // always return null, so hide the destination card itself.
        const hideEl = target;
        if (hideEl && toRect) hideEl.style.visibility = "hidden";
        flyCapturedClone(
          c.card,
          toRect,
          () => {
            if (hideEl) hideEl.style.visibility = "";
          },
          { delay: keptN++ * CARD_FLIGHT.staggerMs },
        );
      } else {
        flyCapturedClone(c.card, getPileRect(policyDiscardPile(c.ideology)), () => {}, {
          flip: true,
          delay: discardN++ * CARD_FLIGHT.staggerMs,
        });
      }
    }
  });
}
function onRemovePolicy(slotIndex: number): void {
  if (policyPhase.value) return;
  game.removePolicy(slotIndex);
}
function onEndTurn(): void {
  if (policyPhase.value) return;
  game.endTurn();
  selectedIds.value = [];
  selectedStorage.value = null;
}
function onAdvance(choices: Record<string, LegacyUpgrade>): void {
  game.advanceEpoch(choices);
  selectedIds.value = [];
  selectedStorage.value = null;
}
function onViewPile(which: "deck" | "discard"): void {
  pileView.value = which;
}

function onSwitchSlot(id: string): void {
  game.switchSlot(id);
  selectedIds.value = [];
  selectedStorage.value = null;
}
function onNewSlot(): void {
  game.newCampaignSlot();
  selectedIds.value = [];
  selectedStorage.value = null;
}
function onDeleteSlot(id: string): void {
  game.deleteSlot(id);
  selectedIds.value = [];
  selectedStorage.value = null;
}
</script>
