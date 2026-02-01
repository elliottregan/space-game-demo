<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import {
  BarChart3,
  CircleOff,
  Cog,
  FlaskConical,
  Heart,
  Home,
  Smile,
  Sprout,
  User,
  Users,
} from "lucide-vue-next";
import { ColonistRole } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import type { GridStat } from "../../ui";
import { GMetricBar, GMiniStat, GPanel, GStatsGrid } from "../../ui";
import {
  COHESION_POSITIVE_THRESHOLD,
  COHESION_WARNING_THRESHOLD,
  HEALTH_POSITIVE_THRESHOLD,
  HEALTH_WARNING_THRESHOLD,
  MORALE_POSITIVE_THRESHOLD,
  MORALE_WARNING_THRESHOLD,
} from "../../utils/displayThresholds";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

const healthThresholds = {
  warning: HEALTH_POSITIVE_THRESHOLD / 100,
  critical: HEALTH_WARNING_THRESHOLD / 100,
};

// Morale is 0-100, convert to 0-1 for GMetricBar
const moraleThresholds = {
  warning: MORALE_POSITIVE_THRESHOLD / 100,
  critical: MORALE_WARNING_THRESHOLD / 100,
};

// Cohesion is already 0-1
const cohesionThresholds = {
  warning: COHESION_POSITIVE_THRESHOLD,
  critical: COHESION_WARNING_THRESHOLD,
};

const roleConfig: Record<ColonistRole, { icon: Component; label: string }> = {
  [ColonistRole.UNASSIGNED]: { icon: User, label: "Unassigned" },
  [ColonistRole.RESEARCH]: { icon: FlaskConical, label: "Researchers" },
  [ColonistRole.ENGINEERING]: { icon: Cog, label: "Engineers" },
  [ColonistRole.CIVIL_SCIENCE]: { icon: BarChart3, label: "Scientists" },
  [ColonistRole.FARMING]: { icon: Sprout, label: "Farmers" },
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workforceStats = computed<GridStat[]>(() => {
  const counts: Record<ColonistRole, number> = {
    [ColonistRole.UNASSIGNED]: 0,
    [ColonistRole.RESEARCH]: 0,
    [ColonistRole.ENGINEERING]: 0,
    [ColonistRole.CIVIL_SCIENCE]: 0,
    [ColonistRole.FARMING]: 0,
  };

  // Build map of colonist ID → assigned building's workerRole
  const colonistAssignments = new Map<string, ColonistRole>();
  for (const building of state.buildings) {
    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def?.workerRole) continue;
    for (const colonistId of building.assignedWorkers) {
      colonistAssignments.set(colonistId, def.workerRole);
    }
  }

  // Count colonists by their building assignment, not their role property
  for (const colonist of state.colonists) {
    const assignedRole = colonistAssignments.get(colonist.id);
    if (assignedRole) {
      counts[assignedRole]++;
    } else {
      counts[ColonistRole.UNASSIGNED]++;
    }
  }

  return Object.entries(counts).map(([role, count]) => ({
    key: role,
    icon: roleConfig[role as ColonistRole].icon,
    count,
    label: roleConfig[role as ColonistRole].label,
  }));
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const housingStats = computed<GridStat[]>(() => {
  let housed = 0;
  let unhoused = 0;

  for (const colonist of state.colonists) {
    if (colonist.housingId) {
      housed++;
    } else {
      unhoused++;
    }
  }

  return [
    { key: "housed", icon: Home, count: housed, label: "Housed" },
    {
      key: "unhoused",
      icon: CircleOff,
      count: unhoused,
      label: "Unhoused",
    },
  ];
});
</script>

<template>
  <GPanel title="Colony Status" accent="olive">
    <div class="metric-bars">
      <GMetricBar
        label="Health"
        :value="state.health / 100"
        :icon="Heart"
        :thresholds="healthThresholds"
      />
      <GMetricBar
        label="Morale"
        :value="state.morale / 100"
        :icon="Smile"
        :thresholds="moraleThresholds"
      />
      <GMetricBar
        label="Cohesion"
        :value="state.socialCohesion"
        :icon="Users"
        :thresholds="cohesionThresholds"
      />
    </div>
    <div class="stats-grid">
      <GMiniStat label="Population" :value="state.population" />
      <GMiniStat
        v-if="state.moraleBoost > 0"
        label="Rec Bonus"
        :value="state.moraleBoost"
        mode="difference"
      />
    </div>
    <GStatsGrid title="Workforce" :stats="workforceStats" />
    <GStatsGrid title="Housing" :stats="housingStats" />
  </GPanel>
</template>

<style scoped>
.metric-bars {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--g-space-md);
  margin-top: var(--g-space-md);
}
</style>
