<template>
  <section class="section projects-panel">
    <h2>Mega-Structures</h2>
    <div class="projects-row">
      <div
        v-for="project in projects"
        :key="project.id"
        :class="['project-zone', { satisfied: canPlay(project.id) }]"
      >
        <div class="project-header">
          <h3>{{ project.name }}</h3>
        </div>
        <div class="project-requirement">
          {{ describe(project) }} + {{ keystoneLabel(project.keystoneId) }}
        </div>
        <div class="project-progress">
          {{ evalFor(project.id)?.progress ?? "" }}
        </div>

        <div class="project-slots">
          <div v-for="(_, n) in requirementSlots(project)" :key="n" class="slotted-card empty-slot">
            <span>{{ slotLabel(project, n) }}</span>
          </div>
        </div>

        <button
          class="primary"
          :disabled="!canPlay(project.id)"
          @click="$emit('play', project.id)"
          style="margin-top: 4px"
        >
          Play {{ project.name }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { MegaProject } from "../../core/types.ts";
import { describeRequirement, type MegaStructureEval } from "../../core/patterns.ts";

const props = defineProps<{
  projects: MegaProject[];
  progress: { projectId: string; evaluation: MegaStructureEval }[];
}>();

defineEmits<{
  play: [projectId: string];
}>();

function evalFor(id: string): MegaStructureEval | undefined {
  return props.progress.find((p) => p.projectId === id)?.evaluation;
}

function canPlay(id: string): boolean {
  return evalFor(id)?.canPlay ?? false;
}

function describe(project: MegaProject): string {
  return describeRequirement(project);
}

function keystoneLabel(id: string): string {
  switch (id) {
    case "keystone-navigators-compass":
      return "Navigator's Compass";
    case "keystone-founding-charter":
      return "Founding Charter";
    case "keystone-critical-mass":
      return "Critical Mass";
    default:
      return "keystone";
  }
}

function requirementSlots(project: MegaProject): number {
  const r = project.requiredHand;
  switch (r.kind) {
    case "four-of-a-kind":
      return r.count + 1;
    case "flush":
      return r.count + 1;
    case "straight":
      return r.ranks.length + 1;
  }
}

function slotLabel(project: MegaProject, index: number): string {
  const r = project.requiredHand;
  const total = requirementSlots(project);
  if (index === total - 1) return "key";
  switch (r.kind) {
    case "four-of-a-kind":
      return r.role;
    case "flush":
      return r.ideology.slice(0, 3);
    case "straight":
      return `r${r.ranks[index] ?? ""}`;
  }
}
</script>
