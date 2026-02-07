<script setup lang="ts">
import { computed, ref } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

// Faction colors by base faction id
const FACTION_COLORS: Record<string, string> = {
  earth_loyalists: "var(--color-info)",
  mars_independence: "var(--color-positive)",
  corporate_interests: "var(--color-warning)",
};

// Map faction data from ideology state
// oxlint-disable-next-line no-unused-vars
const factionData = computed(() =>
  state.ideology.factions.map((faction) => ({
    id: faction.id,
    name: faction.name,
    baseId: faction.baseId,
    support: state.ideology.factionSupport[faction.id] ?? 0,
    councilSeats: state.ideology.councilFactionCounts[faction.baseId] ?? 0,
    position: faction.position,
  })),
);

// Colonists with ideology data, sorted by highest conviction
// oxlint-disable-next-line no-unused-vars
const colonistsWithIdeology = computed(() => {
  return state.colonists
    .filter((c): c is typeof c & { ideology: NonNullable<typeof c.ideology> } => !!c.ideology)
    .map((c) => {
      const ideology = c.ideology;
      // Find nearest faction for this colonist
      let nearestFactionBaseId: string | null = null;
      if (state.ideology.factions.length > 0) {
        let bestDist = Infinity;
        for (const faction of state.ideology.factions) {
          const ds = ideology.solidarity - faction.position.solidarity;
          const dv = ideology.sovereignty - faction.position.sovereignty;
          const dt = ideology.transformation - faction.position.transformation;
          const dist = Math.sqrt(ds * ds + dv * dv + dt * dt);
          if (dist < bestDist) {
            bestDist = dist;
            nearestFactionBaseId = faction.baseId;
          }
        }
      }
      return {
        id: c.id,
        name: c.name,
        solidarity: ideology.solidarity,
        sovereignty: ideology.sovereignty,
        transformation: ideology.transformation,
        conviction: ideology.conviction,
        nearestFactionBaseId,
      };
    })
    .sort((a, b) => b.conviction - a.conviction);
});

// Selected council member for details
const selectedMemberId = ref<string | null>(null);

// oxlint-disable-next-line no-unused-vars
function selectMember(colonistId: string): void {
  if (selectedMemberId.value === colonistId) {
    selectedMemberId.value = null;
  } else {
    selectedMemberId.value = colonistId;
  }
}

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
function getFactionColor(baseId: string): string {
  return FACTION_COLORS[baseId] ?? "var(--color-muted)";
}

// oxlint-disable-next-line no-unused-vars
function formatAxis(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(0)}`;
}
</script>

<template>
  <GPanel title="Faction Support" accent="slate">
    <div class="factions">
      <div v-for="faction in factionData" :key="faction.id" class="faction-card">
        <div class="faction-header">
          <span class="faction-name" :style="{ color: getFactionColor(faction.baseId) }">
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
              backgroundColor: getFactionColor(faction.baseId),
            }"
          />
        </div>

        <div class="faction-details">
          <span class="council-seats"
            >{{ faction.councilSeats }} council seat{{
              faction.councilSeats !== 1 ? "s" : ""
            }}</span
          >
          <span class="axis-values">
            Sol {{ formatAxis(faction.position.solidarity) }} | Sov
            {{ formatAxis(faction.position.sovereignty) }} | Trf
            {{ formatAxis(faction.position.transformation) }}
          </span>
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
            borderLeftColor: member.factionId
              ? getFactionColor(member.factionId)
              : 'var(--color-muted)',
          }"
          @click="selectMember(member.colonistId)"
        >
          <span class="member-name">{{ member.name }}</span>
          <span class="member-influence" title="Influence = centrality x conviction"
            >influence: {{ (member.influence * 100).toFixed(0) }}</span
          >
        </div>
      </div>
    </div>

    <!-- All Colonists Ideology -->
    <div v-if="colonistsWithIdeology.length > 0" class="colonists-section">
      <h3 class="section-title">Colonist Ideologies</h3>
      <div class="colonists-table">
        <div class="table-header">
          <span class="col-name">Name</span>
          <span class="col-axis">Sol</span>
          <span class="col-axis">Sov</span>
          <span class="col-axis">Trf</span>
          <span class="col-conviction">Conv</span>
        </div>
        <div
          v-for="colonist in colonistsWithIdeology"
          :key="colonist.id"
          class="colonist-row"
          :style="{
            borderLeftColor: colonist.nearestFactionBaseId
              ? getFactionColor(colonist.nearestFactionBaseId)
              : 'var(--color-muted)',
          }"
        >
          <span class="col-name">{{ colonist.name }}</span>
          <span class="col-axis">{{ formatAxis(colonist.solidarity) }}</span>
          <span class="col-axis">{{ formatAxis(colonist.sovereignty) }}</span>
          <span class="col-axis">{{ formatAxis(colonist.transformation) }}</span>
          <span class="col-conviction">{{ (colonist.conviction * 100).toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <p class="hint">
      Colonist ideology spreads through social networks. High-influence colonists form the council.
      Factions drift along ideology axes based on colony conditions.
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

.faction-details {
  display: flex;
  justify-content: space-between;
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.council-seats {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.axis-values {
  letter-spacing: 0.02em;
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

.col-axis {
  width: 36px;
  text-align: right;
  color: var(--g-color-text-muted);
}

.col-conviction {
  width: 36px;
  text-align: right;
  color: var(--g-color-text-muted);
}
</style>
