<template>
  <section class="section projects-panel">
    <h2>Mega-Structures</h2>
    <div class="projects-row">
      <ProjectZone
        v-for="project in projects"
        :key="project.id"
        :project="project"
        :evaluation="evalFor(project.id)"
        @play="$emit('play', $event)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MegaProject } from "../../core/types.ts";
import type { MegaStructureEval } from "../../core/patterns.ts";
import ProjectZone from "./ProjectZone.vue";

const props = defineProps<{
  projects: MegaProject[];
  progress: { projectId: string; evaluation: MegaStructureEval }[];
}>();

defineEmits<{ play: [projectId: string] }>();

const emptyEval: MegaStructureEval = { canPlay: false, progress: "", consumableCards: [] };

function evalFor(id: string): MegaStructureEval {
  return props.progress.find((p) => p.projectId === id)?.evaluation ?? emptyEval;
}
</script>
