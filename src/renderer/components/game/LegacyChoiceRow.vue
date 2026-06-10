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
import type { LegacyCandidate, LegacyUpgrade } from "../../../core/types.ts";
import { describeEffectSpec } from "../../util/effects.ts";

const props = defineProps<{
  candidate: LegacyCandidate;
  modelValue: LegacyUpgrade;
}>();

defineEmits<{
  "update:modelValue": [value: LegacyUpgrade];
}>();

const effectText = computed(() => describeEffectSpec(props.candidate.baseCard.effect));

function upgradeDescription(opt: LegacyUpgrade): string {
  switch (opt) {
    case "potency":
      return "Primary effect +1";
    case "pliability":
      return "Influence cost −1";
  }
}
</script>

<style scoped>
.effect-preview {
  font-size: 10px;
  color: var(--ink-muted);
}
</style>
