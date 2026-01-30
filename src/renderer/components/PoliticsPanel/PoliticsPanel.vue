<script setup lang="ts">
import { computed } from "vue";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

// Map ideology support to display format
// biome-ignore lint/correctness/noUnusedVariables: used in template
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

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportColor(support: number): string {
  if (support >= 0.5) return "var(--color-positive)";
  if (support >= 0.35) return "var(--color-info)";
  if (support >= 0.2) return "var(--color-warning)";
  return "var(--color-muted)";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
          <span class="council-seats">{{ faction.councilSeats }} council seat{{ faction.councilSeats !== 1 ? 's' : '' }}</span>
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
          :style="{ borderLeftColor: member.faction ? getFactionColor(member.faction) : 'var(--color-muted)' }"
        >
          <span class="member-name">{{ member.name }}</span>
          <span class="member-influence">{{ (member.influence * 100).toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <p class="hint">
      Colonist ideology spreads through social networks. High-influence colonists form the council.
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
</style>
