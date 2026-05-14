<template>
  <Panel
    class="unlocked-projects"
    :title="`Keystone Projects (${unlocks.length}/${PATTERNS_IN_ORDER.length})`"
  >
    <div class="project-list">
      <div
        v-for="pattern in PATTERNS_IN_ORDER"
        :key="pattern"
        class="project-card"
        :class="{ unlocked: findUnlock(pattern) }"
      >
        <span class="project-star" v-if="findUnlock(pattern)">★</span>
        <span class="project-star empty" v-else>○</span>
        <span class="project-name">{{ getProjectName(pattern) }}</span>
        <span class="project-pattern">{{ patternLabel(pattern) }}</span>
        <template v-if="findUnlock(pattern)">
          <span
            v-for="(count, ideology) in ideologyBreakdown(findUnlock(pattern)!)"
            :key="ideology"
            class="project-ideology"
          >
            {{ ideology }}: {{ count }}
          </span>
        </template>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import type { Ideology, KeystoneProject, ProjectUnlock, PatternKind } from "../../../core/types.ts";
import { PATTERNS_IN_ORDER } from "../../../core/data/projects.ts";
import { zeroIdeologyBreakdown } from "../../../core/data/ideologies.ts";
import Panel from "../core/Panel.vue";
import { patternLabel } from "../../util/labels.ts";

const props = defineProps<{
  unlocks: ProjectUnlock[];
  projects: KeystoneProject[];
  breakdown: Record<Ideology, number>;
}>();

function findUnlock(pattern: PatternKind): ProjectUnlock | undefined {
  return props.unlocks.find((u) => u.pattern === pattern);
}

function getProjectName(pattern: PatternKind): string {
  const proj = props.projects.find((p) => p.pattern === pattern);
  return proj?.name ?? pattern;
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
  opacity: 0.6;
}

.project-card.unlocked {
  opacity: 1;
  border-color: var(--accent, gold);
  background: var(--surface-3, var(--surface));
}

.project-star {
  font-size: 1rem;
  color: var(--accent, gold);
}

.project-star.empty {
  opacity: 0.3;
  color: var(--text-subtle);
}

.project-name {
  font-weight: 600;
  font-size: 0.85rem;
}

.project-pattern {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-subtle);
}

.project-ideology {
  font-size: 0.75rem;
  color: var(--text-subtle);
  text-transform: capitalize;
}
</style>
