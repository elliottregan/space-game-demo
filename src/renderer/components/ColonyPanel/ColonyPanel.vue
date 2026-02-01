<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import { BarChart3, CircleOff, Cog, FlaskConical, Home, Sprout, User } from "lucide-vue-next";
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
    { key: "unhoused", icon: CircleOff, count: unhoused, label: "Unhoused" },
  ];
});
</script>

<template>
  <GPanel title="Colony Status" accent="olive">
    <GStatsBar :stats="colonyStats" />
    <GStatsGrid title="Workforce" :stats="workforceStats" />
    <GStatsGrid title="Housing" :stats="housingStats" />
  </GPanel>
</template>

<style scoped></style>
