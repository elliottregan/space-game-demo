<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  severity: number;
  pointOfNoReturn: boolean;
}>();

const severityColor = computed(() => {
  if (props.pointOfNoReturn) return "var(--g-color-negative)";
  if (props.severity >= 75) return "var(--g-color-negative)";
  if (props.severity >= 50) return "var(--g-color-warning)";
  if (props.severity >= 25) return "#F57C00";
  return "var(--g-color-positive)";
});

const statusText = computed(() => {
  if (props.pointOfNoReturn) return "COLLAPSED";
  if (props.severity >= 75) return "Critical";
  if (props.severity >= 50) return "Severe";
  if (props.severity >= 25) return "Worsening";
  return "Stable";
});

const tooltipText = computed(() => {
  if (props.pointOfNoReturn) {
    return "Earth's climate has collapsed. Victory is no longer possible.";
  }
  return `Earth Climate Crisis: ${props.severity.toFixed(1)}% severity - ${statusText.value}`;
});
</script>

<template>
  <div class="earth-crisis-indicator" :title="tooltipText">
    <span class="earth-icon">🌍</span>
    <span class="earth-label">Earth</span>
    <div class="progress-bar">
      <div
        class="progress-fill"
        :style="{
          width: `${severity}%`,
          backgroundColor: severityColor,
        }"
      />
    </div>
    <span class="status" :style="{ color: severityColor }">
      {{ pointOfNoReturn ? "COLLAPSED" : `${severity.toFixed(0)}%` }}
    </span>
  </div>
</template>

<style scoped>
.earth-crisis-indicator {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
  padding: var(--g-space-xs) var(--g-space-sm);
  border-radius: var(--g-radius-sm);
  border: 1px solid var(--g-color-border);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.earth-icon {
  font-size: 1.1em;
}

.earth-label {
  color: var(--g-color-text-muted);
}

.progress-bar {
  width: 60px;
  height: 8px;
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition:
    width 0.3s ease,
    background-color 0.3s ease;
}

.status {
  min-width: 50px;
  text-align: right;
  font-weight: bold;
}
</style>
