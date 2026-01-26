<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../../services/GameService";
import { ColonistRole } from "../../../core/models/Colonist";
import { getHealthVariant, getMoraleVariant, getOxygenVariant } from "../../utils/displayThresholds";
import { GPanel } from "../../ui";
import StatRow from "./StatRow.vue";
import WorkforceGrid from "./WorkforceGrid.vue";
import ColonistCard from "./ColonistCard.vue";

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
</script>

<template>
  <GPanel title="Colony Status" accent="olive">
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
    <div v-if="state.moraleBoost > 0" class="morale-bonus">
      <span class="label">Recreation Bonus:</span>
      <span class="value positive">+{{ state.moraleBoost }}</span>
    </div>

    <StatRow
      label="Air Quality"
      :value="state.totalOxygenContribution"
      :variant="getOxygenVariant(state.totalOxygenContribution)"
    />
    <div v-if="state.totalOxygenContribution < 0" class="oxygen-warning">
      Low oxygen! Building efficiency reduced by 50%
    </div>

    <WorkforceGrid :workforce-stats="workforceStats" />

    <div class="colonist-list" v-if="state.colonists.length > 0">
      <h3>Colonists</h3>
      <div class="colonist-grid">
        <ColonistCard
          v-for="colonist in state.colonists"
          :key="colonist.id"
          :colonist="colonist"
          :skill-definitions="state.skillDefinitions"
        />
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.morale-bonus {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
  color: var(--g-color-muted);
  margin-top: -0.5em;
  margin-bottom: 0.5em;
}
.morale-bonus .positive {
  color: var(--g-color-positive);
}

.oxygen-warning {
  font-size: 0.8em;
  color: var(--g-color-negative);
  background: rgba(198, 40, 40, 0.1);
  padding: var(--g-space-xs) var(--g-space-sm);
  margin-bottom: 0.5em;
}

.colonist-list {
  margin-top: var(--g-space-md);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.colonist-list h3 {
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-sm);
}

.colonist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--g-space-sm);
  max-height: 300px;
  overflow-y: auto;
}
</style>
