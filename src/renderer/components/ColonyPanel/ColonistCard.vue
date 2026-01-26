<script setup lang="ts">
import { computed } from "vue";
import { MASTERY_DISPLAY_NAMES, ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import type { Colonist, SkillDefinition, Building, BuildingDefinition } from "../../../facade";
import { gameService } from "../../services/GameService";
import ColonistSkillBadge from "./ColonistSkillBadge.vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
}>();

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isSkillActive(skill: SkillDefinition): boolean {
  return skill.affinity.includes(props.colonist.role);
}

const workplace = computed(() => {
  return gameService.api.colony.getWorkplace(props.colonist.id);
});

interface WorkplaceOption {
  building: Building;
  definition: BuildingDefinition;
  workers: number;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const availableWorkplaces = computed((): WorkplaceOption[] => {
  const result: WorkplaceOption[] = [];

  for (const building of state.buildings) {
    const definition = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!definition) continue;
    if (!definition.workerSlots) continue;
    if (building.status !== "active") continue; // Only active buildings

    const currentWorkers = building.assignedWorkers.length;
    // Include if has space OR if it's the current workplace
    if (currentWorkers < definition.workerSlots || building.id === workplace.value) {
      result.push({
        building,
        definition,
        workers: currentWorkers,
      });
    }
  }

  return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function assignToBuilding(colonistId: string, buildingId: string) {
  if (buildingId === "") {
    gameService.api.colony.unassignFromBuilding(colonistId);
  } else {
    // Unassign first if already assigned
    const currentWorkplace = gameService.api.colony.getWorkplace(colonistId);
    if (currentWorkplace) {
      gameService.api.colony.unassignFromBuilding(colonistId);
    }
    gameService.api.colony.assignToBuilding(colonistId, buildingId);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function roleMatches(definition: BuildingDefinition): boolean {
  return definition.workerRole === props.colonist.role;
}
</script>

<template>
  <div class="colonist-card">
    <div class="colonist-header">
      <span class="colonist-name">{{ colonist.name }}</span>
      <span class="colonist-role">{{ ROLE_DISPLAY_NAMES[colonist.role] }}</span>
    </div>
    <div class="colonist-mastery">{{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }}</div>
    <div class="colonist-skills" v-if="colonistSkills.length > 0">
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="isSkillActive(skill)"
      />
    </div>
    <div class="colonist-workplace">
      <label class="workplace-label">Workplace:</label>
      <select
        class="workplace-select"
        :value="workplace ?? ''"
        @change="assignToBuilding(colonist.id, ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Unassigned (Labor Pool)</option>
        <option
          v-for="wp in availableWorkplaces"
          :key="wp.building.id"
          :value="wp.building.id"
          :disabled="wp.building.id !== workplace && wp.workers >= (wp.definition.workerSlots ?? 0)"
        >
          {{ wp.definition.name }} ({{ wp.workers }}/{{ wp.definition.workerSlots }})
          {{ roleMatches(wp.definition) ? '✓' : '⚠' }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.colonist-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-surface);
  border: 1px solid var(--g-color-border);
}

.colonist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.colonist-name {
  font-weight: bold;
  font-size: var(--g-font-size-sm);
}

.colonist-role {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.colonist-mastery {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-xs);
}

.colonist-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: var(--g-space-xs);
}

.colonist-workplace {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  margin-top: var(--g-space-xs);
  padding-top: var(--g-space-xs);
  border-top: 1px solid var(--g-color-border);
}

.workplace-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.workplace-select {
  flex: 1;
  font-size: var(--g-font-size-xs);
  padding: 2px 4px;
  background: var(--g-color-bg);
  border: 1px solid var(--g-color-border);
  color: var(--g-color-text);
}
</style>
