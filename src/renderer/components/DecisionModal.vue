<script setup lang="ts">
import type { Decision } from "../../core/models/Politics";
import { GButton } from "../ui";

defineProps<{
  decision: Decision;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <div class="decision-modal-overlay" @click.self="emit('cancel')">
    <div class="decision-modal">
      <h3>{{ decision.name }}</h3>
      <p>{{ decision.description }}</p>

      <div class="decision-effects">
        <h4>Effects:</h4>
        <ul>
          <li v-for="(value, tag) in decision.tags" :key="tag">
            {{ tag }}: {{ value >= 0 ? '+' : '' }}{{ value }}
          </li>
        </ul>
        <div v-if="decision.effects?.resources" class="resource-effects">
          <h4>Resource Changes:</h4>
          <ul>
            <li v-for="(value, resource) in decision.effects.resources" :key="resource">
              {{ resource }}: {{ value >= 0 ? '+' : '' }}{{ value }}
            </li>
          </ul>
        </div>
      </div>

      <div class="modal-actions">
        <GButton variant="secondary" @click="emit('cancel')">Cancel</GButton>
        <GButton variant="primary" @click="emit('confirm')">Confirm</GButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.decision-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: oklch(10% 0.02 250 / 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.decision-modal {
  background: var(--g-color-bg-surface);
  border-radius: 8px;
  padding: var(--g-space-lg);
  max-width: 400px;
  width: 90%;
  border: 1px solid var(--g-color-border);
}

.decision-modal h3 {
  font-family: var(--g-font-mono);
  color: var(--g-color-warning);
  margin-bottom: var(--g-space-sm);
}

.decision-modal p {
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-md);
}

.decision-effects h4 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-info);
  margin-bottom: var(--g-space-xs);
}

.decision-effects ul {
  list-style: none;
  padding: 0;
  margin-bottom: var(--g-space-md);
}

.decision-effects li {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text);
  padding: var(--g-space-xs) 0;
}

.resource-effects {
  margin-top: var(--g-space-sm);
}

.modal-actions {
  display: flex;
  gap: var(--g-space-md);
  justify-content: flex-end;
}
</style>
