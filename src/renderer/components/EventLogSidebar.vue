<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";
import { GPanel, GEmptyState } from "../ui";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const displayedEvents = computed(() => {
  return [...state.recentEvents].reverse();
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSeverityClass(severity: string): string {
  switch (severity) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    default:
      return "info";
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getIcon(type: string): string {
  if (type.includes("RESOURCE")) return "📦";
  if (type.includes("BUILDING")) return "🏗️";
  if (type.includes("RESEARCH")) return "🔬";
  if (type.includes("COLONIST") || type.includes("POPULATION")) return "👥";
  if (type.includes("FACTION")) return "🏛️";
  if (type.includes("VICTORY")) return "🎉";
  if (type.includes("DEFEAT")) return "💀";
  if (type.includes("EVENT")) return "⚠️";
  if (type.includes("TRAINING")) return "📚";
  if (type.includes("MASTERY")) return "⭐";
  return "📌";
}
</script>

<template>
  <aside class="event-log-sidebar">
    <GPanel title="Event Log" accent="slate">
      <div class="event-list">
        <div
          v-for="(event, index) in displayedEvents"
          :key="index"
          class="event-item"
          :class="getSeverityClass(event.severity)"
        >
          <span class="event-icon">{{ getIcon(event.type) }}</span>
          <span class="event-message">{{ event.message || event.type }}</span>
        </div>
        <GEmptyState v-if="displayedEvents.length === 0" message="No events" />
      </div>
    </GPanel>
  </aside>
</template>

<style scoped>
.event-log-sidebar {
  width: 280px;
  flex-shrink: 0;
  max-height: calc(100vh - 180px);
}

.event-log-sidebar :deep(.g-panel) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-log-sidebar :deep(.g-panel__body) {
  flex: 1;
  overflow-y: auto;
  padding: var(--g-space-sm);
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.event-item {
  display: flex;
  align-items: flex-start;
  gap: var(--g-space-xs);
  padding: var(--g-space-xs);
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg-surface);
  border-left: 3px solid;
}

.event-item.info {
  border-color: var(--g-color-info);
}

.event-item.warning {
  border-color: var(--g-color-warning);
  background: rgba(239, 108, 0, 0.08);
}

.event-item.critical {
  border-color: var(--g-color-negative);
  background: rgba(198, 40, 40, 0.08);
}

.event-icon {
  flex-shrink: 0;
}

.event-message {
  color: var(--g-color-text);
  line-height: 1.3;
}</style>
