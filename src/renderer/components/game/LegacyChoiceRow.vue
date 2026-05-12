<template>
  <div class="legacy-choice">
    <div class="legacy-choice-header">
      <div>
        <h3>{{ candidate.baseCard.name }}</h3>
        <div class="effect-preview">{{ effectText }}</div>
      </div>
      <span class="legacy-choice-source">{{ candidate.source }}</span>
    </div>
    <div class="upgrade-options">
      <button
        v-for="opt in candidate.suggestedUpgrades"
        :key="opt"
        :class="['upgrade-option', { selected: modelValue === opt }]"
        @click="$emit('update:modelValue', opt)"
      >
        <div class="upgrade-name">{{ opt }}</div>
        <div class="upgrade-desc">{{ upgradeDescription(opt) }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LegacyCandidate } from "../../../core/types.ts";
import { describeEffectSpec } from "../../util/effects.ts";

const props = defineProps<{
  candidate: LegacyCandidate;
  modelValue: "potency" | "pliability" | "persistence";
}>();

defineEmits<{
  "update:modelValue": [value: "potency" | "pliability" | "persistence"];
}>();

const effectText = computed(() => describeEffectSpec(props.candidate.baseCard.effect));

function upgradeDescription(opt: "potency" | "pliability" | "persistence"): string {
  switch (opt) {
    case "potency":
      return "Primary effect +1";
    case "pliability":
      return "Influence cost −1";
    case "persistence":
      return "Passive: +1 Mat. when top";
  }
}
</script>

<style scoped>
.effect-preview {
  font-size: 10px;
  color: var(--text-muted);
}
</style>
