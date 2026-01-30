<script setup lang="ts">
import { computed } from "vue";
import { ColonistRole } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import type { GridStat, Stat } from "../../ui";
import { GPanel, GStatsBar, GStatsGrid } from "../../ui";
import {
  getCohesionVariant,
  getHealthVariant,
  getMoraleVariant,
} from "../../utils/displayThresholds";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonyStats = computed<Stat[]>(() => {
  const stats: Stat[] = [
    { label: "Population", value: state.population },
    { label: "Health", progress: state.health, variant: getHealthVariant(state.health) },
    { label: "Morale", progress: state.morale, variant: getMoraleVariant(state.morale) },
    {
      label: "Cohesion",
      progress: Math.round(state.socialCohesion * 100),
      variant: getCohesionVariant(state.socialCohesion),
    },
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

const roleConfig: Record<ColonistRole, { icon: string; label: string }> = {
  [ColonistRole.UNASSIGNED]: { icon: "👤", label: "Unassigned" },
  [ColonistRole.RESEARCH]: { icon: "🔬", label: "Researchers" },
  [ColonistRole.ENGINEERING]: { icon: "⚙️", label: "Engineers" },
  [ColonistRole.CIVIL_SCIENCE]: { icon: "📊", label: "Scientists" },
  [ColonistRole.FARMING]: { icon: "🌱", label: "Farmers" },
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
    { key: "housed", icon: "🏠", count: housed, label: "Housed" },
    { key: "unhoused", icon: "🚫", count: unhoused, label: "Unhoused" },
  ];
});
</script>

<template>
  <GPanel title="Colony Status" accent="olive">
    <GStatsBar :stats="colonyStats" />

    <div v-if="state.totalOxygenContribution < 0" class="oxygen-warning">
      Low oxygen! Building efficiency reduced by 50%
    </div>

    <GStatsGrid title="Workforce" :stats="workforceStats" />
    <GStatsGrid title="Housing" :stats="housingStats" />
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
