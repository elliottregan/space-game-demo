<script setup lang="ts">
import { computed } from "vue";
import type { Colonist, SkillDefinition } from "../../../facade";
import { ROLE_DISPLAY_NAMES, MASTERY_DISPLAY_NAMES } from "../../../core/models/Colonist";
import { gameService } from "../../services/GameService";
import ColonistSkillBadge from "../ColonyPanel/ColonistSkillBadge.vue";

const props = defineProps<{
  colonist: Colonist;
  skillDefinitions: SkillDefinition[];
  showWorkplace?: boolean;
}>();

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const colonistSkills = computed(() => {
  return props.colonist.skills
    .map((skillId) => props.skillDefinitions.find((s) => s.id === skillId))
    .filter((s): s is SkillDefinition => s !== undefined);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workplace = computed(() => {
  if (!props.showWorkplace) return null;

  // Find building where this colonist works
  for (const building of state.buildings) {
    if (building.assignedWorkers.includes(props.colonist.id)) {
      const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
      return {
        building,
        definition: def,
        name: def ? `${def.name} #${building.id.split("_").pop()}` : building.id,
      };
    }
  }
  return null;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function isSkillActive(skill: SkillDefinition): boolean {
  return skill.affinity.includes(props.colonist.role);
}
</script>

<template>
  <div class="colonist-row">
    <div class="colonist-main">
      <span class="colonist-name">{{ colonist.name }}</span>
      <div class="colonist-details">
        <span class="colonist-role">
          {{ ROLE_DISPLAY_NAMES[colonist.role] }}
          ({{ MASTERY_DISPLAY_NAMES[colonist.masteryLevel] }})
        </span>
        <span v-if="showWorkplace && workplace" class="workplace">
          → Works at: {{ workplace.name }}
        </span>
        <span
          v-else-if="showWorkplace && colonist.role === 'unassigned'"
          class="unassigned"
        >
          Unassigned
        </span>
      </div>
    </div>
    <div class="colonist-skills">
      <span class="skills-label">Skills:</span>
      <ColonistSkillBadge
        v-for="skill in colonistSkills"
        :key="skill.id"
        :skill="skill"
        :is-active="isSkillActive(skill)"
      />
    </div>
  </div>
</template>

<style scoped>
.colonist-row {
  padding: var(--g-space-sm);
  padding-left: var(--g-space-md);
  border-left: 2px solid var(--g-color-border);
  background: var(--g-color-bg-base);
  font-family: var(--g-font-mono);
}

.colonist-main {
  margin-bottom: var(--g-space-xs);
}

.colonist-name {
  font-weight: bold;
  display: block;
  margin-bottom: var(--g-space-xs);
}

.colonist-details {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
}

.colonist-role {
  margin-right: var(--g-space-sm);
}

.workplace {
  color: var(--g-color-info);
}

.unassigned {
  font-style: italic;
}

.colonist-skills {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: var(--g-space-xs);
}

.skills-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-right: 4px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
</style>
