<template>
  <div :class="['project-zone', { satisfied: evaluation.canPlay }]">
    <div class="project-header">
      <h3>{{ project.name }}</h3>
    </div>
    <div class="project-requirement">
      {{ requirementDescription }} + {{ keystoneLabel(project.keystoneId) }}
    </div>
    <div class="project-progress">
      {{ evaluation.progress }}
    </div>
    <div class="project-slots">
      <div v-for="(_, n) in requirementSlots" :key="n" class="slotted-card empty-slot">
        <span>{{ slotLabel(n) }}</span>
      </div>
    </div>
    <button
      class="primary"
      :disabled="!evaluation.canPlay"
      @click="$emit('play', project.id)"
      style="margin-top: 4px"
    >
      Play {{ project.name }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MegaProject } from "../../core/types.ts";
import type { MegaStructureEval } from "../../core/patterns.ts";
import { describeRequirement } from "../../core/patterns.ts";
import { keystoneLabel } from "../util/labels.ts";

const props = defineProps<{
  project: MegaProject;
  evaluation: MegaStructureEval;
}>();

defineEmits<{ play: [projectId: string] }>();

const requirementDescription = computed(() => describeRequirement(props.project));

const requirementSlots = computed(() => {
  const r = props.project.requiredHand;
  const count =
    r.kind === "four-of-a-kind"
      ? r.count
      : r.kind === "flush"
        ? r.count
        : r.ranks.length;
  return count + 1; // + keystone
});

function slotLabel(index: number): string {
  const r = props.project.requiredHand;
  if (index === requirementSlots.value - 1) return "key";
  if (r.kind === "four-of-a-kind") return r.role;
  if (r.kind === "flush") return r.ideology.slice(0, 3);
  return `r${r.ranks[index] ?? ""}`;
}
</script>
