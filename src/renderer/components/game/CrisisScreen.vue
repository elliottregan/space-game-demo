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
        Ideology:
        <template v-for="(id, i) in IDEOLOGIES" :key="id">
          <span v-if="i > 0"> · </span>{{ IDEOLOGY_DISPLAY[id].code }}{{ breakdown[id] }}
        </template>
      </p>

      <LegacyChoiceRow
        v-for="cand in candidates"
        :key="cand.id"
        :candidate="cand"
        :model-value="choices[cand.id] ?? cand.suggestedUpgrades[0] ?? 'potency'"
        @update:model-value="(u: 'potency' | 'pliability' | 'persistence') => onChoose(cand.id, u)"
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
} from "../../../core/types.ts";
import { IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { patternLabel } from "../../util/labels.ts";
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

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--shadow-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}
.modal.crisis-screen {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elev-3);
  padding: var(--space-5);
  max-width: 640px;
  max-height: 90vh;
  width: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.modal.crisis-screen h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 0.04em;
}
.modal.crisis-screen .flavor {
  margin: 0;
  color: var(--text-muted);
  font-style: italic;
}
.modal.crisis-screen .difficulty,
.modal.crisis-screen .verdict,
.modal.crisis-screen .ideology {
  margin: 0;
}
.unlock-walk {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 12px;
}
.unlock-walk li {
  display: grid;
  grid-template-columns: 60px 1fr auto auto;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--surface-card);
}
.step-pattern {
  color: var(--text-muted);
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.06em;
  align-self: center;
}
.step-value {
  color: var(--accent);
  font-weight: 600;
}
.step-running {
  color: var(--text-subtle);
}
.modal.crisis-screen .primary {
  align-self: flex-end;
}
</style>
