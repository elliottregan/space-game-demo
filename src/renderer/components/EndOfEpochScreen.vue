<template>
  <div class="eoe-overlay">
    <div class="eoe-panel">
      <h2>{{ title }}</h2>
      <div class="eoe-subtitle">
        <template v-if="state.outcome === 'win'">
          <div>Completed on turn {{ turn }}.</div>
          <div v-if="state.monument">
            Monument minted: <strong>{{ state.monument.projectName }}</strong>
            <span :class="['tier-badge', 'tier-' + state.monument.tier]">
              {{ state.monument.tier }}
            </span>
          </div>
          <div>Next Setting: <strong>{{ nextSettingDisplay }}</strong></div>
        </template>
        <template v-else>
          <div>Loss mode: see event log.</div>
          <div>Next Setting: <strong>{{ nextSettingDisplay }}</strong></div>
        </template>
      </div>

      <p class="eoe-instructions">Pick an upgrade path for each Legacy Card:</p>

      <LegacyChoiceRow
        v-for="cand in state.candidates"
        :key="cand.id"
        :candidate="cand"
        :model-value="choices[cand.id] ?? cand.suggestedUpgrades[0] ?? 'potency'"
        @update:model-value="choices[cand.id] = $event"
      />

      <div v-if="state.candidates.length === 0" class="empty">No Legacy Cards minted.</div>

      <div class="eoe-actions">
        <button class="primary" :disabled="!allChosen" @click="$emit('advance', choices)">
          <template v-if="state.nextSettingId === 'campaign-end'">End Campaign</template>
          <template v-else>Continue to next Epoch →</template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import type { EndOfEpochState } from "../../core/campaign.ts";
import LegacyChoiceRow from "./LegacyChoiceRow.vue";

const props = defineProps<{
  state: EndOfEpochState;
  turn: number;
  nextSettingName: string;
}>();

defineEmits<{
  advance: [choices: Record<string, "potency" | "pliability" | "persistence">];
}>();

const choices = reactive<Record<string, "potency" | "pliability" | "persistence">>({});
for (const c of props.state.candidates) {
  choices[c.id] = c.suggestedUpgrades[0] ?? "potency";
}

const allChosen = computed(() => props.state.candidates.every((c) => choices[c.id] !== undefined));

const title = computed(() => (props.state.outcome === "win" ? "Epoch Complete" : "Epoch Lost"));

const nextSettingDisplay = computed(() =>
  props.state.nextSettingId === "campaign-end" ? "Campaign ends" : props.nextSettingName,
);
</script>

<style scoped>
.eoe-instructions {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--fg-dim);
}
.empty {
  color: var(--fg-dim);
  font-size: 12px;
}
</style>
