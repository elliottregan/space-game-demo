<template>
  <div class="modal-overlay">
    <div class="modal crisis-screen">
      <h1>{{ crisis.name }}</h1>
      <p class="flavor">{{ crisis.flavor }}</p>

      <ol class="unlock-walk">
        <li v-for="(c, i) in walk" :key="c.projectId + '@' + c.turn">
          <span class="step-pattern">{{ patternLabel(c.pattern) }}</span>
          <span class="step-name"
            >{{ c.name
            }}<template v-if="c.level > 1">
              <span class="step-level">L{{ c.level }}</span></template
            ></span
          >
          <span class="step-value">+{{ c.value }}</span>
          <span class="step-running">= {{ runningTotals[i] }}</span>
        </li>
      </ol>

      <p class="verdict">
        <b>{{ outcome.cleared ? "Crisis averted" : "Crisis overwhelmed you" }}</b>
        <template v-if="clearedPath">— {{ clearedPath }}</template>
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
        @update:model-value="(u: LegacyUpgrade) => onChoose(cand.id, u)"
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
  LegacyCandidate,
  LegacyUpgrade,
} from "../../../core/types.ts";
import { IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { patternLabel } from "../../util/labels.ts";
import LegacyChoiceRow from "./LegacyChoiceRow.vue";

const props = defineProps<{
  crisis: Crisis;
  outcome: CrisisOutcome;
  candidates: LegacyCandidate[];
  breakdown: Record<Ideology, number>;
  nextSettingName: string;
}>();
defineEmits<{ advance: [choices: Record<string, LegacyUpgrade>] }>();

const choices = ref<Record<string, LegacyUpgrade>>({});

const walk = computed(() => props.outcome.contributions);
const runningTotals = computed(() => {
  const out: number[] = [];
  let acc = 0;
  for (const c of walk.value) {
    acc += c.value;
    out.push(acc);
  }
  return out;
});
const nextLabel = computed(() =>
  props.outcome.cleared ? `Continue to ${props.nextSettingName}` : "Continue",
);

// The cleared node ids carried by the outcome, joined into a readable path.
// Node names aren't on the outcome (it carries ids), so show the ids — the
// detailed tree-view (with names) is the deferred §9 UI pass.
const clearedPath = computed(() => props.outcome.clearedNodeIds.join(" → "));

function onChoose(id: string, u: LegacyUpgrade): void {
  choices.value = { ...choices.value, [id]: u };
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}
.modal.crisis-screen {
  background: var(--paper);
  box-shadow: var(--shadow-lifted);
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
}
.modal.crisis-screen .flavor {
  margin: 0;
  color: var(--ink-muted);
  font-style: italic;
}
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
  background: var(--mat);
}
.step-pattern {
  color: var(--ink-muted);
  font-size: 11px;
  align-self: center;
}
.step-value {
  color: var(--status-positive);
  font-weight: 600;
}
.step-running {
  color: var(--ink-subtle);
}
.step-level {
  color: var(--ink-subtle);
  font-size: 10px;
}
.modal.crisis-screen .primary {
  align-self: flex-end;
}
</style>
