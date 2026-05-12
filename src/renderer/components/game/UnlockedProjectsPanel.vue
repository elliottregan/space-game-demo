<template>
  <section class="section unlocked-projects">
    <h2>Keystone Projects ({{ unlocks.length }})</h2>
    <div class="ideology-aggregate">
      <span><b>S</b> {{ breakdown.solidarity }}</span>
      <span><b>V</b> {{ breakdown.sovereignty }}</span>
      <span><b>T</b> {{ breakdown.transformation }}</span>
      <span><b>H</b> {{ breakdown.heritage }}</span>
    </div>
    <div v-for="group in grouped" :key="group.pattern" class="pattern-group">
      <div class="pattern-header">
        {{ patternLabel(group.pattern) }} · {{ group.unlocks.length }} unlocked · value
        {{ group.totalValue }}
      </div>
      <div v-for="u in group.unlocks" :key="u.projectId + '@' + u.turn" class="unlock-entry">
        <span class="project-name">{{ projectName(u.projectId) }}</span>
        <span class="entry-ideology">{{ entryIdeology(u) }}</span>
        <span class="entry-turn">T{{ u.turn }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Ideology, KeystoneProject, PatternKind, ProjectUnlock } from "../../../core/types.ts";
import { PATTERNS_IN_ORDER } from "../../../core/data/projects.ts";

const props = defineProps<{
  unlocks: ProjectUnlock[];
  projects: KeystoneProject[];
  breakdown: Record<Ideology, number>;
}>();

const grouped = computed(() => {
  return [...PATTERNS_IN_ORDER]
    .reverse()
    .map((pattern) => {
      const unlocks = props.unlocks.filter((u) => u.pattern === pattern);
      let totalValue = 0;
      for (const u of unlocks) {
        const p = props.projects.find((p) => p.id === u.projectId);
        if (p) totalValue += p.value;
      }
      return { pattern, unlocks, totalValue };
    })
    .filter((g) => g.unlocks.length > 0);
});

function patternLabel(p: PatternKind): string {
  switch (p) {
    case "four-of-a-kind":
      return "Four of a Kind";
    case "flush":
      return "Flush";
    case "three-of-a-kind":
      return "Three of a Kind";
    case "pair":
      return "Pair";
    case "high-card":
      return "High Card";
  }
}
function projectName(id: string): string {
  return props.projects.find((p) => p.id === id)?.name ?? id;
}
function entryIdeology(u: ProjectUnlock): string {
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
  const parts: string[] = [];
  if (counts.solidarity) parts.push(`S${counts.solidarity}`);
  if (counts.sovereignty) parts.push(`V${counts.sovereignty}`);
  if (counts.transformation) parts.push(`T${counts.transformation}`);
  if (counts.heritage) parts.push(`H${counts.heritage}`);
  return parts.join(" · ");
}
</script>
