<template>
  <Panel class="unlocked-projects" :title="`Keystone Projects (${unlocks.length})`">
    <div class="project-list">
      <div v-for="u in unlocks" :key="u.projectId + '@' + u.turn" class="project-card">
        <span class="project-star">★</span>
        <span class="project-name">{{ projectName(u.projectId) }}</span>
        <span
          v-for="(count, ideology) in ideologyBreakdown(u)"
          :key="ideology"
          class="project-ideology"
        >
          {{ ideology }}: {{ count }}
        </span>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import type { Ideology, KeystoneProject, ProjectUnlock } from "../../../core/types.ts";
import { zeroIdeologyBreakdown } from "../../../core/data/ideologies.ts";
import Panel from "../core/Panel.vue";

const props = defineProps<{
  unlocks: ProjectUnlock[];
  projects: KeystoneProject[];
  breakdown: Record<Ideology, number>;
}>();

function projectName(id: string): string {
  return props.projects.find((p) => p.id === id)?.name ?? id;
}

function ideologyBreakdown(u: ProjectUnlock): Partial<Record<Ideology, number>> {
  const counts = zeroIdeologyBreakdown();
  for (const c of u.cards) {
    if (c.ideology === "wild") continue;
    counts[c.ideology] += 1;
  }
  const out: Partial<Record<Ideology, number>> = {};
  for (const [k, v] of Object.entries(counts) as [Ideology, number][]) {
    if (v > 0) out[k] = v;
  }
  return out;
}
</script>

<style scoped>
.project-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.project-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-card);
  min-width: 120px;
}

.project-star {
  font-size: 1rem;
  color: var(--accent, gold);
}

.project-name {
  font-weight: 600;
  font-size: 0.85rem;
}

.project-ideology {
  font-size: 0.75rem;
  color: var(--text-subtle);
  text-transform: capitalize;
}
</style>
