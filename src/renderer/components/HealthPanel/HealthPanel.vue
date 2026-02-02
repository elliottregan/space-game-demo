<script setup lang="ts">
import { computed } from "vue";
import { HeartPulse } from "lucide-vue-next";
import {
  COLONY_HEALTH,
  COLONY_MORALE,
  SHORTAGE_THRESHOLDS,
} from "../../../core/balance/EconomyBaseline";
import { gameService } from "../../services/GameService";
import { GBreakdownList, GMetricBar, GPanel } from "../../ui";
import type { BreakdownItem } from "../../ui";

const state = gameService.getState();

const healthThresholds = {
  warning: COLONY_HEALTH.GROWTH_REQUIREMENT / 100,
  critical: COLONY_HEALTH.LOW_WARNING_THRESHOLD / 100,
};

// Calculate if conditions for base recovery are met
const hasPositiveFlow = computed(() => {
  const netFlow = state.netFlow;
  return (netFlow.food || 0) > 0 && (netFlow.water || 0) > 0;
});

// Calculate if food shortage is active
const hasFoodShortage = computed(() => {
  return state.resources.food < state.population * SHORTAGE_THRESHOLDS.FOOD_MULTIPLIER;
});

// Health change contributions
// oxlint-disable-next-line no-unused-vars
const breakdownItems = computed<BreakdownItem[]>(() => {
  const items: BreakdownItem[] = [];

  // Base recovery (only when food/water positive)
  if (hasPositiveFlow.value) {
    items.push({
      key: "base-recovery",
      name: "Base Recovery",
      value: `+${COLONY_MORALE.HEALTH_RECOVERY.toFixed(1)}/sol`,
      variant: "positive",
    });
  }

  // Air quality effect
  if (state.airQualityHealthEffect !== 0) {
    items.push({
      key: "air-quality",
      name: "Air Quality",
      value: `${state.airQualityHealthEffect.toFixed(1)}/sol`,
      variant: "negative",
    });
  }

  // Food shortage effect
  if (hasFoodShortage.value) {
    items.push({
      key: "food-shortage",
      name: "Food Shortage",
      value: `-${SHORTAGE_THRESHOLDS.FOOD_HEALTH_PENALTY}/sol`,
      variant: "negative",
    });
  }

  // If no effects active, show stable status
  if (items.length === 0) {
    items.push({
      key: "stable",
      name: "Status",
      value: "Stable",
      variant: "neutral",
    });
  }

  return items;
});

// Calculate net health change per sol
// oxlint-disable-next-line no-unused-vars
const netHealthChange = computed(() => {
  let change = 0;

  if (hasPositiveFlow.value) {
    change += COLONY_MORALE.HEALTH_RECOVERY;
  }

  change += state.airQualityHealthEffect;

  if (hasFoodShortage.value) {
    change -= SHORTAGE_THRESHOLDS.FOOD_HEALTH_PENALTY;
  }

  return change;
});

// Determine if we have any negative effects
// oxlint-disable-next-line no-unused-vars
const hasEffects = computed(() => {
  return (
    state.airQualityHealthEffect !== 0 ||
    hasFoodShortage.value ||
    state.health < COLONY_HEALTH.LOW_WARNING_THRESHOLD
  );
});
</script>

<template>
  <GPanel title="Health" accent="rose">
    <div class="health-content">
      <GMetricBar
        label="Colony Health"
        :value="state.health / 100"
        :icon="HeartPulse"
        :thresholds="healthThresholds"
      />

      <div class="health-stats">
        <div class="stat">
          <span class="stat-label">Current</span>
          <span class="stat-value">{{ Math.floor(state.health) }}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Change</span>
          <span
            class="stat-value"
            :class="{
              positive: netHealthChange > 0,
              negative: netHealthChange < 0,
            }"
          >
            {{ netHealthChange >= 0 ? "+" : "" }}{{ netHealthChange.toFixed(1) }}/sol
          </span>
        </div>
      </div>

      <GBreakdownList title="Contributors" :items="breakdownItems" :show-sign="false" />

      <div v-if="hasEffects" class="effects-section">
        <div class="effects-title">Health Status</div>
        <div class="effects-list">
          <div v-if="state.health < COLONY_HEALTH.DEATH_RISK_THRESHOLD" class="effect">
            <span>Death Risk</span>
            <span class="effect-value negative">Active</span>
          </div>
          <div v-else-if="state.health < COLONY_HEALTH.LOW_WARNING_THRESHOLD" class="effect">
            <span>Status</span>
            <span class="effect-value warning">Declining</span>
          </div>
          <div v-else-if="state.health < COLONY_HEALTH.GROWTH_REQUIREMENT" class="effect">
            <span>Population Growth</span>
            <span class="effect-value warning">Blocked</span>
          </div>
        </div>
      </div>
    </div>
  </GPanel>
</template>

<style scoped>
.health-content {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.health-stats {
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

.effect-value.warning {
  color: var(--g-color-warning);
}
</style>
