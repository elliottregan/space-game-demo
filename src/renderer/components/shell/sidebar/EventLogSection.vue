<template>
  <Panel title="Event Log">
    <div class="event-log">
      <div v-for="(e, i) in recent" :key="i" class="event-entry">
        {{ formatEvent(e) }}
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { GameEvent } from "../../../../core/types.ts";
import Panel from "../../core/Panel.vue";

const props = defineProps<{ events: GameEvent[]; limit?: number }>();

const recent = computed(() => {
  const n = props.limit ?? 60;
  return props.events.slice(-n);
});

function formatEvent(e: GameEvent): string {
  switch (e.type) {
    case "card-played-to-land":
    case "card-played-to-influence":
    case "card-played-to-charter":
      return `${e.type.replace(/-/g, " ")}: ${e.card.name} → col ${e.columnIndex + 1}`;
    case "card-discarded":
      return `card discarded: ${e.card.name}`;
    case "card-recalled-to-hand":
      return `card recalled: ${e.card.name}`;
    case "column-built":
      return `column ${e.columnIndex + 1} built → ${e.unlock.projectId}`;
    case "dissent-added":
      return `dissent added (${e.variant})`;
    case "turn-ended":
      return `turn ${e.turn} ended`;
    case "crisis-resolved":
      return `crisis resolved (${e.outcome.cleared ? "cleared" : "failed"})`;
  }
}
</script>

<style scoped>
.event-entry {
  color: var(--text-subtle);
  font-size: 11px;
}
</style>
