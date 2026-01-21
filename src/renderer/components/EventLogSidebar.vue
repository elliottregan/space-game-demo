<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";

const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const displayedEvents = computed(() => {
  return state.recentEvents.slice(-15).reverse();
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
    <h2 class="sidebar-header">Event Log</h2>
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
      <div v-if="displayedEvents.length === 0" class="no-events">
        No recent events
      </div>
    </div>
  </aside>
</template>

<style scoped>
.event-log-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 180px);
}

.sidebar-header {
  font-size: 1.2rem;
  color: #ffd460;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin: 0;
  position: sticky;
  top: 0;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 8px 8px 0 0;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.event-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid;
}

.event-item.info {
  border-color: #60a5fa;
}

.event-item.warning {
  border-color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

.event-item.critical {
  border-color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}

.event-icon {
  flex-shrink: 0;
}

.event-message {
  color: #e8e8e8;
  line-height: 1.3;
}

.no-events {
  color: #888;
  font-style: italic;
  text-align: center;
  padding: 1rem;
}
</style>
