<template>
  <div class="modal-overlay">
    <div class="modal crisis-screen">
      <h1>{{ crisis.name }}</h1>
      <p class="flavor">{{ crisis.flavor }}</p>
      <p class="difficulty">
        Difficulty: <b>{{ crisis.difficulty }}</b>
      </p>

      <ol class="unlock-walk">
        <li v-for="(u, i) in walk" :key="u.projectId + '@' + u.turn">
          <span class="step-pattern">{{ patternLabel(u.pattern) }}</span>
          <span class="step-name">{{ projectName(u.projectId) }}</span>
          <span class="step-value">+{{ projectValue(u.projectId) }}</span>
          <span class="step-running">= {{ runningTotals[i] }}</span>
        </li>
      </ol>

      <p class="verdict">
        Total {{ outcome.totalValue }} / {{ crisis.difficulty }} —
        <b>{{ outcome.cleared ? "Cleared" : "Failed" }}</b>
      </p>

      <p class="ideology">
        Ideology: S{{ breakdown.solidarity }} · V{{ breakdown.sovereignty }} · T{{
          breakdown.transformation
        }}
        · H{{ breakdown.heritage }}
      </p>

      <LegacyChoiceRow
        v-for="cand in candidates"
        :key="cand.id"
        :candidate="cand"
        :chosen="choices[cand.id]"
        @choose="(u) => onChoose(cand.id, u)"
      />

      <button class="primary" @click="$emit('advance', choices)">
        {{ nextLabel }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  Crisis,
  CrisisOutcome,
  Ideology,
  KeystoneProject,
  LegacyCandidate,
  PatternKind,
  ProjectUnlock,
} from "../../core/types.ts";
import LegacyChoiceRow from "./LegacyChoiceRow.vue";

const props = defineProps<{
  crisis: Crisis;
  outcome: CrisisOutcome;
  projects: KeystoneProject[];
  candidates: LegacyCandidate[];
  breakdown: Record<Ideology, number>;
  nextSettingName: string;
}>();
defineEmits<{ advance: [choices: Record<string, "potency" | "pliability" | "persistence">] }>();

const choices = ref<Record<string, "potency" | "pliability" | "persistence">>({});

const walk = computed(() => props.outcome.contributingUnlocks);
const runningTotals = computed(() => {
  const out: number[] = [];
  let acc = 0;
  for (const u of walk.value) {
    acc += projectValue(u.projectId);
    out.push(acc);
  }
  return out;
});
const nextLabel = computed(() =>
  props.outcome.cleared ? `Continue to ${props.nextSettingName}` : "Continue",
);

function patternLabel(p: PatternKind): string {
  switch (p) {
    case "four-of-a-kind":
      return "Four";
    case "flush":
      return "Flush";
    case "three-of-a-kind":
      return "Three";
    case "pair":
      return "Pair";
    case "high-card":
      return "High";
  }
}
function projectName(id: string): string {
  return props.projects.find((p) => p.id === id)?.name ?? id;
}
function projectValue(id: string): number {
  return props.projects.find((p) => p.id === id)?.value ?? 0;
}
function onChoose(id: string, u: "potency" | "pliability" | "persistence"): void {
  choices.value = { ...choices.value, [id]: u };
}
</script>
