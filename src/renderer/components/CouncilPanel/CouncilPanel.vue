<script setup lang="ts">
import { computed } from "vue";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GBadge, GPanel } from "../../ui";

const state = gameService.getState();

// Map faction IDs to display names
const factionNames: Record<NPCFaction | "neutral", string> = {
  [NPCFaction.EarthLoyalists]: "Earth Loyalists",
  [NPCFaction.MarsIndependence]: "Mars Independence",
  [NPCFaction.CorporateInterests]: "Corporate Interests",
  neutral: "Neutral",
};

// Get faction badge variant
function getFactionVariant(faction: NPCFaction | null): "positive" | "warning" | "info" | "muted" {
  if (!faction) return "muted";
  switch (faction) {
    case NPCFaction.EarthLoyalists:
      return "info";
    case NPCFaction.MarsIndependence:
      return "positive";
    case NPCFaction.CorporateInterests:
      return "warning";
    default:
      return "muted";
  }
}

// Sort council members by influence
const sortedCouncil = computed(() => {
  return [...state.ideology.council].sort((a, b) => b.influence - a.influence);
});

// Get faction counts
const factionCounts = computed(() => {
  const counts = state.ideology.councilFactionCounts;
  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([faction, count]) => ({
      faction: faction as NPCFaction | "neutral",
      name: factionNames[faction as NPCFaction | "neutral"],
      count,
    }))
    .sort((a, b) => b.count - a.count);
});
</script>

<template>
  <GPanel title="Colony Council" accent="slate">
    <div v-if="state.ideology.council.length === 0" class="empty-state">
      Council will form as the colony grows.
    </div>
    <template v-else>
      <!-- Faction composition -->
      <div class="faction-summary">
        <GBadge
          v-for="fc in factionCounts"
          :key="fc.faction"
          :variant="getFactionVariant(fc.faction as NPCFaction)"
        >
          {{ fc.name }}: {{ fc.count }}
        </GBadge>
      </div>

      <!-- Council members -->
      <div class="council-list">
        <div v-for="member in sortedCouncil" :key="member.colonistId" class="council-member">
          <div class="member-info">
            <span class="member-name">{{ member.name }}</span>
            <GBadge :variant="getFactionVariant(member.faction)" size="sm">
              {{ member.faction ? factionNames[member.faction] : "Neutral" }}
            </GBadge>
          </div>
          <div class="member-stats">
            <span class="stat" title="Political Influence">
              Influence: {{ member.influence.toFixed(2) }}
            </span>
            <span class="stat" title="Ideological Conviction">
              Conviction: {{ (member.conviction * 100).toFixed(0) }}%
            </span>
          </div>
        </div>
      </div>
    </template>
  </GPanel>
</template>

<style scoped>
.faction-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-xs);
  margin-bottom: var(--g-space-md);
}

.council-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.council-member {
  padding: var(--g-space-sm);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.council-member:last-child {
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-xs);
}

.member-name {
  font-weight: var(--g-font-weight-medium);
  font-size: var(--g-font-size-sm);
}

.member-stats {
  display: flex;
  gap: var(--g-space-md);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
}

.stat {
  cursor: help;
}

.empty-state {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  font-style: italic;
  padding: var(--g-space-sm) 0;
}
</style>
