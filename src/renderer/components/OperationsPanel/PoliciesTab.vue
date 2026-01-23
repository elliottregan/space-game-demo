<script setup lang="ts">
import { GButton } from "../../ui";
import type { Policies, PolicyType } from "../../../facade";

defineProps<{
  policies: Policies;
  policyCooldownRemaining: number;
  policyOptions: {
    workIntensity: Array<"relaxed" | "standard" | "crunch">;
    resourcePriority: Array<"stockpile" | "balanced" | "burn">;
    explorationStance: Array<"cautious" | "standard" | "aggressive">;
  };
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  "set-policy": [type: PolicyType, value: string];
}>();
</script>

<template>
  <div class="tab-content">
    <div class="policy-group">
      <div class="policy-label">Work Intensity</div>
      <div class="policy-buttons">
        <GButton
          v-for="option in policyOptions.workIntensity"
          :key="option"
          :variant="policies.workIntensity === option ? 'primary' : 'secondary'"
          size="sm"
          :disabled="policyCooldownRemaining > 0 && policies.workIntensity !== option"
          @click="emit('set-policy', 'workIntensity', option)"
        >
          {{ option }}
        </GButton>
      </div>
    </div>

    <div class="policy-group">
      <div class="policy-label">Resource Priority</div>
      <div class="policy-buttons">
        <GButton
          v-for="option in policyOptions.resourcePriority"
          :key="option"
          :variant="policies.resourcePriority === option ? 'primary' : 'secondary'"
          size="sm"
          :disabled="policyCooldownRemaining > 0 && policies.resourcePriority !== option"
          @click="emit('set-policy', 'resourcePriority', option)"
        >
          {{ option }}
        </GButton>
      </div>
    </div>

    <div class="policy-group">
      <div class="policy-label">Exploration Stance</div>
      <div class="policy-buttons">
        <GButton
          v-for="option in policyOptions.explorationStance"
          :key="option"
          :variant="policies.explorationStance === option ? 'primary' : 'secondary'"
          size="sm"
          :disabled="policyCooldownRemaining > 0 && policies.explorationStance !== option"
          @click="emit('set-policy', 'explorationStance', option)"
        >
          {{ option }}
        </GButton>
      </div>
    </div>

    <div v-if="policyCooldownRemaining > 0" class="cooldown-notice">
      Policy change available in: {{ policyCooldownRemaining }} sols
    </div>
  </div>
</template>

<style scoped>
.policy-group {
  margin-bottom: var(--g-space-md);
}

.policy-label {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

.policy-buttons {
  display: flex;
  gap: var(--g-space-xs);
}

.policy-buttons :deep(.g-button) {
  flex: 1;
  text-transform: capitalize;
}

.cooldown-notice {
  margin-top: var(--g-space-md);
  padding: var(--g-space-sm);
  background: oklch(75% 0.15 70 / 0.1);
  border-radius: 4px;
  color: var(--g-color-warning);
  font-size: var(--g-font-size-sm);
  text-align: center;
}
</style>
