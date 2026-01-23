<script setup lang="ts">
import { computed } from "vue";
import { GButton } from "../../ui";
import type { Expedition, ProspectingSite } from "../../../facade";

const props = defineProps<{
  activeExpeditions: Expedition[];
  prospectingSites: ProspectingSite[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  "reveal-site": [siteId: string];
  "develop-site": [siteId: string];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatExpeditionName(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const unrevealedSites = computed(() => props.prospectingSites.filter((s) => !s.revealed));
// biome-ignore lint/correctness/noUnusedVariables: used in template
const revealedSites = computed(() =>
  props.prospectingSites.filter((s) => s.revealed && !s.developed),
);
// biome-ignore lint/correctness/noUnusedVariables: used in template
const developedSites = computed(() => props.prospectingSites.filter((s) => s.developed));
</script>

<template>
  <div class="tab-content">
    <div class="missions-section">
      <h3>Active Expeditions ({{ activeExpeditions.length }}/2)</h3>
      <div v-if="activeExpeditions.length === 0" class="empty-message">
        No active expeditions
      </div>
      <div v-for="exp in activeExpeditions" :key="exp.id" class="expedition-item">
        <span class="expedition-name">{{ formatExpeditionName(exp.type) }}</span>
        <span class="expedition-time">{{ exp.solsRemaining }} sols remaining</span>
      </div>
    </div>

    <div class="missions-section">
      <h3>Prospecting Sites</h3>
      <div v-if="prospectingSites.length === 0" class="empty-message">
        Complete Survey expeditions to discover sites
      </div>

      <div v-for="site in unrevealedSites" :key="site.id" class="site-item unrevealed">
        <span>??? (Unrevealed)</span>
        <GButton size="sm" @click="emit('reveal-site', site.id)">Reveal (30 mat)</GButton>
      </div>

      <div v-for="site in revealedSites" :key="site.id" class="site-item revealed">
        <span>{{ site.resourceType }} ({{ site.quality }})</span>
        <GButton size="sm" variant="primary" @click="emit('develop-site', site.id)">Develop</GButton>
      </div>

      <div v-for="site in developedSites" :key="site.id" class="site-item developed">
        <span>{{ site.resourceType }} ({{ site.quality }}) - Active</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.missions-section {
  margin-bottom: var(--g-space-md);
}

.missions-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.empty-message {
  color: var(--g-color-text-muted);
  font-style: italic;
  font-size: var(--g-font-size-sm);
}

.expedition-item, .site-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  margin-bottom: var(--g-space-xs);
}

.expedition-name {
  font-family: var(--g-font-mono);
  font-weight: bold;
}

.expedition-time {
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
}

.site-item.developed {
  background: oklch(70% 0.17 145 / 0.1);
  border-left: 3px solid var(--g-color-positive);
}
</style>
