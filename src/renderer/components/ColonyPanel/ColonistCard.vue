<script setup lang="ts">
import { computed } from "vue";
import { ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import type { BuildingDefinition, Colonist, SkillDefinition } from "../../../facade";
import { gameService } from "../../services/GameService";
import GActionCard from "../../ui/composites/GActionCard.vue";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";
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

// Compute workplace from reactive state instead of calling facade directly
const workplace = computed(() => {
  for (const building of state.buildings) {
    if (building.assignedWorkers.includes(props.colonist.id)) {
      return building.id;
    }
  }
  return "";
});

function roleMatches(definition: BuildingDefinition): boolean {
  return definition.workerRole === props.colonist.role;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workplaceOptions = computed((): SelectOption[] => {
  const result: SelectOption[] = [{ value: "", label: "Unassigned (Labor Pool)" }];
  const currentWorkplace = workplace.value;

  for (const building of state.buildings) {
    const definition = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!definition) continue;
    if (!definition.workerSlots) continue;
    if (building.status !== "active") continue;

    const currentWorkers = building.assignedWorkers.length;
    const isFull = currentWorkers >= definition.workerSlots;
    const isCurrentWorkplace = building.id === currentWorkplace;

    // Include if has space OR if it's the current workplace
    if (!isFull || isCurrentWorkplace) {
      const matchIndicator = roleMatches(definition) ? "✓" : "⚠";
      result.push({
        value: building.id,
        label: `${definition.name} (${currentWorkers}/${definition.workerSlots}) ${matchIndicator}`,
        disabled: isFull && !isCurrentWorkplace,
      });
    }
  }

  return result;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function onWorkplaceChange(buildingId: string | number) {
  const id = String(buildingId);
  if (id === "") {
    gameService.api.colony.unassignFromBuilding(props.colonist.id);
  } else {
    // Unassign first if already assigned
    if (workplace.value) {
      gameService.api.colony.unassignFromBuilding(props.colonist.id);
    }
    gameService.api.colony.assignToBuilding(props.colonist.id, id);
  }
}
</script>

<template>
  <GActionCard
    :title="colonist.name"
    :description="ROLE_DISPLAY_NAMES[colonist.role]"
    :select-options="workplaceOptions"
    :select-model-value="workplace"
    @update:select-model-value="onWorkplaceChange"
  >
    <template #tag>
      <span class="colonist-role-tag">{{ ROLE_DISPLAY_NAMES[colonist.role] }}</span>
    </template>
    <div class="colonist-skills" v-if="colonistSkills.length > 0">
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="isSkillActive(skill)"
      />
    </div>
  </GActionCard>
</template>

<style scoped>
.colonist-role-tag {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  text-transform: uppercase;
}

.colonist-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
