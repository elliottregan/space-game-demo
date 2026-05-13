<template>
  <section class="section unlocked-projects">
    <h2>Keystone Projects ({{ unlocks.length }})</h2>
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
  </section>
</template>

<script setup lang="ts">
import type { Ideology, KeystoneProject, ProjectUnlock } from "../../../core/types.ts";

const props = defineProps<{
  unlocks: ProjectUnlock[];
  projects: KeystoneProject[];
  breakdown: Record<Ideology, number>;
}>();

function projectName(id: string): string {
  return props.projects.find((p) => p.id === id)?.name ?? id;
}

function ideologyBreakdown(u: ProjectUnlock): Partial<Record<Ideology, number>> {
  const counts: Record<Ideology, number> = {
    solidarity: 0,
    sovereignty: 0,
    transformation: 0,
    heritage: 0,
  };
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
  gap: 8px;
}

.project-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-2, var(--surface));
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
