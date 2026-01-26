<script setup lang="ts">
import { computed } from "vue";
import { ColonistRole } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import type { Stat } from "../../ui";
import { GPanel, GStatsBar } from "../../ui";
import {
  getHealthVariant,
  getMoraleVariant,
  getOxygenVariant,
} from "../../utils/displayThresholds";
import WorkforceGrid from "./WorkforceGrid.vue";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonyStats = computed<Stat[]>(() => {
  const stats: Stat[] = [
    { label: "Population", value: state.population },
    { label: "Health", progress: state.health, variant: getHealthVariant(state.health) },
    { label: "Morale", progress: state.morale, variant: getMoraleVariant(state.morale) },
  ];

  if (state.moraleBoost > 0) {
    stats.push({
      label: "Recreation Bonus",
      value: state.moraleBoost,
      variant: "positive",
      prefix: "+",
    });
  }

  return stats;
});

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
</script>

<template>
  <GPanel title="Colony Status" accent="olive">
    <GStatsBar :stats="colonyStats" />

    <div v-if="state.totalOxygenContribution < 0" class="oxygen-warning">
      Low oxygen! Building efficiency reduced by 50%
    </div>

    <WorkforceGrid :workforce-stats="workforceStats" />
  </GPanel>
</template>

<style scoped>
.oxygen-warning {
  font-size: 0.8em;
  color: var(--g-color-negative);
  background: rgba(198, 40, 40, 0.1);
  padding: var(--g-space-xs) var(--g-space-sm);
  margin: var(--g-space-md) 0;
}
</style>
