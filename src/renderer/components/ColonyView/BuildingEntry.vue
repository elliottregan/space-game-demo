<script setup lang="ts">
import { computed } from "vue";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { ROLE_DISPLAY_NAMES, MASTERY_DISPLAY_NAMES } from "../../../core/models/Colonist";
import { GBadge, GProgress } from "../../ui";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  building: Building;
  definition?: BuildingDefinition;
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusVariant = computed(() => {
  switch (props.building.status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "disabled":
      return "neutral";
    case "idle":
      return "neutral";
    case "recycling":
      return "warning";
    default:
      return "neutral";
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const statusLabel = computed(() => {
  if (props.building.broken) return "Broken";
  switch (props.building.status) {
    case "active":
      return "Active";
    case "pending":
      return "Building";
    case "disabled":
      return "Disabled";
    case "idle":
      return "Idle";
    case "recycling":
      return "Recycling";
    default:
      return props.building.status;
  }
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const assignedWorkers = computed(() => {
  return props.building.assignedWorkers
    .map((id) => props.colonists.find((c) => c.id === id))
    .filter((c): c is Colonist => c !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workerSlots = computed(() => props.definition?.workerSlots || 0);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getColonistSkills(colonist: Colonist): SkillDefinition[] {
  return colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatResourceDelta(delta: Record<string, number> | undefined): string {
  if (!delta) return "";
  return Object.entries(delta)
    .filter(([_, v]) => v !== 0)
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
    .join(", ");
}
</script>

<template>
  <div class="building-entry" :class="{ broken: building.broken }">
    <div class="building-header">
      <div class="building-title">
        <span class="building-name">{{ definition?.name || building.definitionId }}</span>
        <span class="building-id">#{{ building.id.split("_").pop() }}</span>
      </div>
      <div class="building-status">
        <GBadge :variant="building.broken ? 'danger' : statusVariant">
          {{ statusLabel }}
        </GBadge>
        <span class="condition" v-if="building.status === 'active'">
          {{ Math.round(building.condition) }}%
        </span>
      </div>
    </div>

    <div class="building-stats" v-if="building.status === 'active'">
      <span v-if="definition?.production" class="production">
        Production: {{ formatResourceDelta(definition.production) }}
      </span>
      <span v-if="definition?.consumption" class="consumption">
        Consumption: {{ formatResourceDelta(definition.consumption) }}
      </span>
      <span class="efficiency">
        Efficiency: {{ building.condition >= 50 ? 100 : Math.round(building.condition * 2) }}%
      </span>
    </div>

    <div class="construction-progress" v-if="building.status === 'pending'">
      <GProgress
        :value="building.constructionProgress"
        :max="definition?.constructionTime || 10"
        variant="warning"
        show-label
      />
    </div>

    <div class="workers-section" v-if="workerSlots > 0">
      <div class="workers-header">
        Workers ({{ assignedWorkers.length }}/{{ workerSlots }}):
      </div>
      <div class="workers-list">
        <div v-for="worker in assignedWorkers" :key="worker.id" class="worker-row">
          <span class="worker-name">{{ worker.name }}</span>
          <span class="worker-role">
            {{ ROLE_DISPLAY_NAMES[worker.role] }} ({{ MASTERY_DISPLAY_NAMES[worker.masteryLevel] }})
          </span>
          <div class="worker-skills">
            <ColonistSkillBadge
              v-for="skill in getColonistSkills(worker)"
              :key="skill.id"
              :skill="skill"
              :is-active="skill.affinity.includes(worker.role)"
            />
          </div>
        </div>
        <div
          v-for="i in workerSlots - assignedWorkers.length"
          :key="'empty-' + i"
          class="worker-row empty"
        >
          <span class="empty-slot">(Empty slot)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.building-entry {
  padding: 0.75rem;
  background: var(--g-color-bg-elevated);
  border-radius: 6px;
  border: 1px solid var(--g-color-border);
}

.building-entry.broken {
  border-color: var(--color-danger);
}

.building-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.building-title {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.building-name {
  font-weight: bold;
}

.building-id {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.building-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.condition {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.building-stats {
  display: flex;
  gap: 1rem;
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.production {
  color: var(--color-positive);
}

.consumption {
  color: var(--color-negative);
}

.construction-progress {
  margin-bottom: 0.5rem;
}

.workers-section {
  border-top: 1px solid var(--g-color-border);
  padding-top: 0.5rem;
  margin-top: 0.5rem;
}

.workers-header {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: 0.5rem;
}

.workers-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.worker-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
  padding-left: 0.5rem;
  border-left: 2px solid var(--g-color-border);
}

.worker-row.empty {
  opacity: 0.5;
}

.worker-name {
  font-weight: 500;
  min-width: 120px;
}

.worker-role {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  min-width: 140px;
}

.worker-skills {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.empty-slot {
  font-style: italic;
  color: var(--g-color-text-muted);
}
</style>
