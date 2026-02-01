<script setup lang="ts">
import { computed } from "vue";
import { MASTERY_DISPLAY_NAMES, ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import type { Building, BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { GEntityHeader } from "../../ui";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  building: Building;
  definition?: BuildingDefinition;
  colonists: Colonist[];
  skillDefinitions: SkillDefinition[];
}>();

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
    <GEntityHeader
      :name="definition?.name || building.definitionId"
      :instance-id="building.id.split('_').pop() || ''"
      :status="building.status"
      :is-broken="building.broken"
      :condition="building.condition"
      :construction-progress="building.constructionProgress"
      :construction-max="definition?.constructionTime || 10"
    >
      <template #progress-label>
        {{ Math.ceil((definition?.constructionTime || 10) - building.constructionProgress) }} sols
      </template>
    </GEntityHeader>

    <div class="building-stats" v-if="building.status === 'active'">
      <span v-if="definition?.moraleBoost" class="morale-boost">
        +{{ definition.moraleBoost }} Morale
      </span>
      <span v-if="definition?.production" class="production">
        {{ formatResourceDelta(definition.production) }}
      </span>
      <span v-if="definition?.consumption" class="consumption">
        {{ formatResourceDelta(definition.consumption) }}
      </span>
      <span class="efficiency">
        Efficiency: {{ building.condition >= 50 ? 100 : Math.round(building.condition * 2) }}%
      </span>
    </div>

    <div class="workers-section" v-if="workerSlots > 0">
      <div class="workers-header">Workers ({{ assignedWorkers.length }}/{{ workerSlots }}):</div>
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
  padding: var(--g-space-md);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
  font-family: var(--g-font-mono);
}

.building-entry.broken {
  border-color: var(--g-color-negative);
}

.building-stats {
  display: flex;
  gap: var(--g-space-md);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
  flex-wrap: wrap;
}

.morale-boost {
  color: var(--g-color-positive);
}

.production {
  color: var(--g-color-positive);
}

.consumption {
  color: var(--g-color-negative);
}

.workers-section {
  border-top: 1px solid var(--g-color-border);
  padding-top: var(--g-space-sm);
  margin-top: var(--g-space-sm);
}

.workers-header {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.workers-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.worker-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-md);
  padding: var(--g-space-xs) 0;
  padding-left: var(--g-space-sm);
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
