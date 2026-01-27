<script setup lang="ts">
import { computed } from "vue";
import type { Expedition, ProspectingSite } from "../../../facade";
import { GButton, GEmptyState, GSection } from "../../ui";

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
    <GSection :title="`Active Expeditions (${activeExpeditions.length}/2)`" variant="muted">
      <GEmptyState v-if="activeExpeditions.length === 0" message="No active expeditions" />
      <div v-for="exp in activeExpeditions" :key="exp.id" class="expedition-item">
        <span class="expedition-name">{{ formatExpeditionName(exp.type) }}</span>
        <span class="expedition-time">{{ exp.solsRemaining }} sols remaining</span>
      </div>
    </GSection>

    <GSection title="Prospecting Sites" variant="muted">
      <GEmptyState
        v-if="prospectingSites.length === 0"
        message="Complete Survey expeditions to discover sites"
      />

      <div v-for="site in unrevealedSites" :key="site.id" class="site-item unrevealed">
        <span>??? (Unrevealed)</span>
        <GButton size="sm" @click="emit('reveal-site', site.id)">Reveal (30 mat)</GButton>
      </div>

      <div v-for="site in revealedSites" :key="site.id" class="site-item revealed">
        <span>{{ site.resourceType }} ({{ site.quality }})</span>
        <GButton size="sm" variant="primary" @click="emit('develop-site', site.id)"
          >Develop</GButton
        >
      </div>

      <div v-for="site in developedSites" :key="site.id" class="site-item developed">
        <span>{{ site.resourceType }} ({{ site.quality }}) - Active</span>
      </div>
    </GSection>
  </div>
</template>

<style scoped>
.expedition-item,
.site-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
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
  background: rgba(76, 175, 80, 0.1);
  border-left: 3px solid var(--g-color-positive);
}
</style>
