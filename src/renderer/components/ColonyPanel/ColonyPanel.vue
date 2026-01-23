<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../../services/GameService";
import { ColonistRole } from "../../../core/models/Colonist";
import { GPanel } from "../../ui";
import StatRow from "./StatRow.vue";
import WorkforceGrid from "./WorkforceGrid.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workforceStats = computed(() => {
  const stats: Record<ColonistRole, number> = {
    [ColonistRole.UNASSIGNED]: 0,
    [ColonistRole.RESEARCH]: 0,
    [ColonistRole.ENGINEERING]: 0,
    [ColonistRole.CIVIL_SCIENCE]: 0,
    [ColonistRole.FARMING]: 0,
  };

  for (const colonist of state.colonists) {
    stats[colonist.role]++;
  }

  return stats;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getHealthVariant(health: number): "positive" | "warning" | "negative" {
  if (health >= 80) return "positive";
  if (health >= 50) return "warning";
  return "negative";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getMoraleVariant(morale: number): "positive" | "warning" | "negative" {
  if (morale >= 70) return "positive";
  if (morale >= 40) return "warning";
  return "negative";
}
</script>

<template>
  <GPanel title="Colony Status">
    <StatRow label="Population" :value="state.population" variant="info" />
    <StatRow
      label="Health"
      :progress="state.health"
      :variant="getHealthVariant(state.health)"
      show-progress-label
    />
    <StatRow
      label="Morale"
      :progress="state.morale"
      :variant="getMoraleVariant(state.morale)"
      show-progress-label
    />

    <WorkforceGrid :workforce-stats="workforceStats" />
  </GPanel>
</template>
