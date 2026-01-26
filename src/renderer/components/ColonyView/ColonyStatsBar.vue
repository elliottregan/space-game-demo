<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../../services/GameService";
import { GPanel, GStatsBar } from "../../ui";
import type { Stat } from "../../ui";
import { getHealthVariant, getMoraleVariant } from "../../utils/displayThresholds";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonyStats = computed<Stat[]>(() => {
  const stats: Stat[] = [
    { label: "Population", value: state.population },
    { label: "Health", progress: state.health, variant: getHealthVariant(state.health) },
    { label: "Morale", progress: state.morale, variant: getMoraleVariant(state.morale) },
  ];

  if (state.moraleBoost > 0) {
    stats.push({ label: "Recreation Bonus", value: state.moraleBoost, variant: "positive", prefix: "+" });
  }

  return stats;
});
</script>

<template>
  <GPanel title="Colony Overview">
    <GStatsBar :stats="colonyStats" />
  </GPanel>
</template>
