<script setup lang="ts">
import { computed, ref } from "vue";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel, GButton, GSelect } from "../../ui";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";

const state = gameService.getState();

// Lobbying UI state
const selectedMemberId = ref<string | null>(null);
const selectedFaction = ref<NPCFaction>(NPCFaction.EarthLoyalists);
const lobbyBoost = ref(0.1);

// Lobby options
const lobbyOptions: SelectOption<number>[] = [
  { label: "Small (+5%)", value: 0.05 },
  { label: "Medium (+10%)", value: 0.1 },
  { label: "Large (+15%)", value: 0.15 },
  { label: "Major (+20%)", value: 0.2 },
];

const factionOptions: SelectOption<string>[] = [
  { label: "Earth Loyalists", value: NPCFaction.EarthLoyalists },
  { label: "Mars Independence", value: NPCFaction.MarsIndependence },
  { label: "Corporate Interests", value: NPCFaction.CorporateInterests },
];

// Computed values for lobbying
// oxlint-disable-next-line no-unused-vars
const lobbyCost = computed(() => {
  if (!selectedMemberId.value) return 0;
  return gameService.getCouncilLobbyCost(
    selectedMemberId.value,
    selectedFaction.value,
    lobbyBoost.value,
  );
});

// oxlint-disable-next-line no-unused-vars
const canLobby = computed(() => {
  if (!selectedMemberId.value) return false;
  return gameService.canLobbyCouncilMember(
    selectedMemberId.value,
    selectedFaction.value,
    lobbyBoost.value,
  );
});

// oxlint-disable-next-line no-unused-vars
function selectMember(colonistId: string): void {
  if (selectedMemberId.value === colonistId) {
    selectedMemberId.value = null;
  } else {
    selectedMemberId.value = colonistId;
  }
}

// oxlint-disable-next-line no-unused-vars
function handleLobby(): void {
  if (!selectedMemberId.value) return;
  gameService.lobbyCouncilMember(selectedMemberId.value, selectedFaction.value, lobbyBoost.value);
}

// Colonists with ideology data, sorted by highest affinity
// oxlint-disable-next-line no-unused-vars
const colonistsWithIdeology = computed(() => {
  return state.colonists
    .filter((c): c is typeof c & { ideology: NonNullable<typeof c.ideology> } => !!c.ideology)
    .map((c) => {
      const ideology = c.ideology;
      const maxAffinity = Math.max(
        ideology.earthLoyalist,
        ideology.marsIndependence,
        ideology.corporateInterests,
      );
      let primaryFaction: NPCFaction | null = null;
      if (maxAffinity >= 0.3) {
        if (ideology.earthLoyalist === maxAffinity) primaryFaction = NPCFaction.EarthLoyalists;
        else if (ideology.marsIndependence === maxAffinity)
          primaryFaction = NPCFaction.MarsIndependence;
        else primaryFaction = NPCFaction.CorporateInterests;
      }
      return {
        id: c.id,
        name: c.name,
        earthLoyalist: ideology.earthLoyalist,
        marsIndependence: ideology.marsIndependence,
        corporateInterests: ideology.corporateInterests,
        conviction: ideology.conviction,
        primaryFaction,
      };
    })
    .sort((a, b) => {
      // Sort by conviction (most politically active first)
      return b.conviction - a.conviction;
    });
});

// Map ideology support to display format
// oxlint-disable-next-line no-unused-vars
const factionData = computed(() => [
  {
    id: NPCFaction.EarthLoyalists,
    name: "Earth Loyalists",
    support: state.ideology.factionSupport.earthLoyalists,
    councilSeats: state.ideology.councilFactionCounts[NPCFaction.EarthLoyalists] ?? 0,
  },
  {
    id: NPCFaction.MarsIndependence,
    name: "Mars Independence",
    support: state.ideology.factionSupport.marsIndependence,
    councilSeats: state.ideology.councilFactionCounts[NPCFaction.MarsIndependence] ?? 0,
  },
  {
    id: NPCFaction.CorporateInterests,
    name: "Corporate Interests",
    support: state.ideology.factionSupport.corporateInterests,
    councilSeats: state.ideology.councilFactionCounts[NPCFaction.CorporateInterests] ?? 0,
  },
]);

// oxlint-disable-next-line no-unused-vars
function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}

// oxlint-disable-next-line no-unused-vars
function getSupportColor(support: number): string {
  if (support >= 0.5) return "var(--color-positive)";
  if (support >= 0.35) return "var(--color-info)";
  if (support >= 0.2) return "var(--color-warning)";
  return "var(--color-muted)";
}

// oxlint-disable-next-line no-unused-vars
function getFactionColor(factionId: string): string {
  switch (factionId) {
    case NPCFaction.EarthLoyalists:
      return "var(--color-info)";
    case NPCFaction.MarsIndependence:
      return "var(--color-positive)";
    case NPCFaction.CorporateInterests:
      return "var(--color-warning)";
    default:
      return "var(--color-muted)";
  }
}
</script>

<template>
  <GPanel title="Faction Support" accent="slate">
    <div class="factions">
      <div v-for="faction in factionData" :key="faction.id" class="faction-card">
        <div class="faction-header">
          <span class="faction-name" :style="{ color: getFactionColor(faction.id) }">
            {{ faction.name }}
          </span>
          <span class="faction-support" :style="{ color: getSupportColor(faction.support) }">
            {{ formatSupport(faction.support) }}
          </span>
        </div>

        <div class="support-bar">
          <div
            class="support-fill"
            :style="{
              width: `${faction.support * 100}%`,
              backgroundColor: getFactionColor(faction.id),
            }"
          />
          <!-- Threshold markers -->
          <div class="threshold-marker" style="left: 20%" title="Minor projects (20%)" />
          <div class="threshold-marker" style="left: 35%" title="Major projects (35%)" />
          <div class="threshold-marker" style="left: 50%" title="Victory projects (50%)" />
        </div>

        <div class="faction-details">
          <span class="council-seats"
            >{{ faction.councilSeats }} council seat{{
              faction.councilSeats !== 1 ? "s" : ""
            }}</span
          >
        </div>
      </div>
    </div>

    <!-- Council Members -->
    <div v-if="state.ideology.council.length > 0" class="council-section">
      <h3 class="section-title">Council Members</h3>
      <div class="council-list">
        <div
          v-for="member in state.ideology.council"
          :key="member.colonistId"
          class="council-member"
          :class="{ selected: selectedMemberId === member.colonistId }"
          :style="{
            borderLeftColor: member.faction
              ? getFactionColor(member.faction)
              : 'var(--color-muted)',
          }"
          @click="selectMember(member.colonistId)"
        >
          <span class="member-name">{{ member.name }}</span>
          <span class="member-influence" title="Influence = centrality × conviction"
            >influence: {{ (member.influence * 100).toFixed(0) }}</span
          >
        </div>
      </div>

      <!-- Lobbying Controls -->
      <div v-if="selectedMemberId" class="lobby-section">
        <h4 class="lobby-title">Lobby Council Member</h4>

        <div class="lobby-controls">
          <div class="lobby-row">
            <label class="lobby-label">Faction:</label>
            <GSelect v-model="selectedFaction" :options="factionOptions" size="sm" />
          </div>

          <div class="lobby-row">
            <label class="lobby-label">Boost:</label>
            <GSelect v-model="lobbyBoost" :options="lobbyOptions" size="sm" />
          </div>

          <div class="lobby-row">
            <span class="lobby-label">Cost:</span>
            <span class="lobby-cost">{{ lobbyCost }} materials</span>
          </div>

          <GButton size="sm" :disabled="!canLobby" @click="handleLobby"> Lobby </GButton>
        </div>

        <p class="lobby-hint">
          Lobbying increases a council member's affinity for a faction, influencing their votes.
        </p>
      </div>
    </div>

    <!-- All Colonists Ideology -->
    <div v-if="colonistsWithIdeology.length > 0" class="colonists-section">
      <h3 class="section-title">Colonist Ideologies</h3>
      <div class="colonists-table">
        <div class="table-header">
          <span class="col-name">Name</span>
          <span class="col-faction" :style="{ color: getFactionColor(NPCFaction.EarthLoyalists) }"
            >EL</span
          >
          <span class="col-faction" :style="{ color: getFactionColor(NPCFaction.MarsIndependence) }"
            >MI</span
          >
          <span
            class="col-faction"
            :style="{ color: getFactionColor(NPCFaction.CorporateInterests) }"
            >CI</span
          >
          <span class="col-conviction">Conv</span>
        </div>
        <div
          v-for="colonist in colonistsWithIdeology"
          :key="colonist.id"
          class="colonist-row"
          :style="{
            borderLeftColor: colonist.primaryFaction
              ? getFactionColor(colonist.primaryFaction)
              : 'var(--color-muted)',
          }"
        >
          <span class="col-name">{{ colonist.name }}</span>
          <span class="col-faction">{{ (colonist.earthLoyalist * 100).toFixed(0) }}</span>
          <span class="col-faction">{{ (colonist.marsIndependence * 100).toFixed(0) }}</span>
          <span class="col-faction">{{ (colonist.corporateInterests * 100).toFixed(0) }}</span>
          <span class="col-conviction">{{ (colonist.conviction * 100).toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <p class="hint">
      Colonist ideology spreads through social networks. High-influence colonists form the council.
      Click a council member to lobby them.
    </p>
  </GPanel>
</template>

<style scoped>
.factions {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.faction-card {
  padding: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--g-space-sm);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.faction-support {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.support-bar {
  position: relative;
  height: 8px;
  background: var(--g-color-text-muted);
  overflow: visible;
}

.support-fill {
  height: 100%;
  transition: width 0.3s;
}

.threshold-marker {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 12px;
  background: var(--g-color-bg-base);
  opacity: 0.5;
}

.faction-details {
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.council-seats {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.council-section {
  margin-top: var(--g-space-lg);
  padding-top: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.section-title {
  margin: 0 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.council-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.council-member {
  display: flex;
  justify-content: space-between;
  padding: var(--g-space-xs) var(--g-space-sm);
  border-left: 3px solid;
  background: var(--g-color-bg-elevated);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  cursor: pointer;
  transition: background-color var(--g-transition-fast);
}

.council-member:hover {
  background: var(--g-color-bg-surface);
}

.council-member.selected {
  background: var(--g-color-bg-surface);
  outline: 1px solid var(--g-color-border-focus);
}

.member-name {
  color: var(--g-color-text);
}

.member-influence {
  color: var(--g-color-text-muted);
}

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

/* Lobbying Section */
.lobby-section {
  margin-top: var(--g-space-md);
  padding: var(--g-space-md);
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.lobby-title {
  margin: 0 0 var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lobby-controls {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.lobby-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.lobby-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  min-width: 60px;
}

.lobby-cost {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  color: var(--color-warning);
}

.lobby-hint {
  margin: var(--g-space-sm) 0 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

/* Colonists Ideology Section */
.colonists-section {
  margin-top: var(--g-space-lg);
  padding-top: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.colonists-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
}

.table-header {
  display: flex;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--g-color-border);
  position: sticky;
  top: 0;
  background: var(--g-color-bg-base);
}

.colonist-row {
  display: flex;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg-elevated);
  border-left: 3px solid;
}

.colonist-row:hover {
  background: var(--g-color-bg-surface);
}

.col-name {
  flex: 1;
  min-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-faction {
  width: 32px;
  text-align: right;
  color: var(--g-color-text-muted);
}

.col-conviction {
  width: 36px;
  text-align: right;
  color: var(--g-color-text-muted);
}
</style>
