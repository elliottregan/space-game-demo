<script setup lang="ts">
import { computed } from "vue";
import { Wind } from "lucide-vue-next";
import {
  LS_QUALITY_COMFORTABLE,
  LS_QUALITY_CRISIS,
} from "../../../core/balance/LifeSupportBalance";
import { gameService } from "../../services/GameService";
import { GMetricBar, GPanel } from "../../ui";

const state = gameService.getState();

const lifeSupportThresholds = { warning: LS_QUALITY_COMFORTABLE, critical: LS_QUALITY_CRISIS };

// oxlint-disable-next-line no-unused-vars
const hasEffects = computed(() => {
  return (
    state.lifeSupportHealthEffect !== 0 ||
    state.lifeSupportMoraleEffect !== 0 ||
    state.lifeSupportEfficiency < 1
  );
});

// oxlint-disable-next-line no-unused-vars
const efficiencyPercent = computed(() => Math.round(state.lifeSupportEfficiency * 100));

// oxlint-disable-next-line no-unused-vars
const utilizationPercent = computed(() => {
  if (state.lifeSupportCapacity <= 0) return 0;
  const totalDemand = state.lifeSupportPopulation + state.lifeSupportLoad;
  return Math.round((totalDemand / state.lifeSupportCapacity) * 100);
});
</script>

<template>
  <GPanel title="Life Support" accent="cyan">
    <div class="ls-content">
      <GMetricBar
        label="Quality"
        :value="state.lifeSupportQuality"
        :icon="Wind"
        :thresholds="lifeSupportThresholds"
      />

      <div class="ls-stats">
        <div class="stat">
          <span class="stat-label">Capacity</span>
          <span class="stat-value positive">{{ state.lifeSupportCapacity }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Population</span>
          <span class="stat-value">{{ state.lifeSupportPopulation }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Industrial</span>
          <span class="stat-value negative">{{ state.lifeSupportLoad }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Utilization</span>
          <span class="stat-value">{{ utilizationPercent }}%</span>
        </div>
      </div>

      <div v-if="hasEffects" class="effects-section">
        <div class="effects-title">Life Support Strain</div>
        <div class="effects-list">
          <div v-if="state.lifeSupportHealthEffect !== 0" class="effect">
            <span>Health</span>
            <span class="effect-value negative"
              >{{ state.lifeSupportHealthEffect.toFixed(1) }}/sol</span
            >
          </div>
          <div v-if="state.lifeSupportMoraleEffect !== 0" class="effect">
            <span>Morale</span>
            <span class="effect-value negative"
              >{{ state.lifeSupportMoraleEffect.toFixed(1) }}/sol</span
            >
          </div>
          <div v-if="state.lifeSupportEfficiency < 1" class="effect">
            <span>Efficiency</span>
            <span class="effect-value negative">{{ efficiencyPercent }}%</span>
          </div>
        </div>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.ls-content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.ls-stats {
  display: flex;
  gap: var(--g-space-md);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.stat-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.stat-value.positive {
  color: var(--g-color-positive);
}

.stat-value.negative {
  color: var(--g-color-negative);
}

.effects-section {
  background: rgba(198, 40, 40, 0.1);
  border: 1px solid var(--g-color-negative);
  padding: var(--g-space-sm);
}

.effects-title {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-negative);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

.effects-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.effect {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.effect-value {
  font-family: var(--g-font-mono);
}

.effect-value.negative {
  color: var(--g-color-negative);
}
</style>
