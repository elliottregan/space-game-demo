<template>
  <section class="section">
    <h2>Event Log</h2>
    <div class="event-log">
      <div v-for="(e, i) in recent" :key="i" :class="['event-entry', e.kind ?? '']">
        <span class="turn">T{{ e.turn }}</span> {{ e.text }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EventEntry } from "../../../core/types.ts";

const props = defineProps<{ events: EventEntry[]; limit?: number }>();

const recent = computed(() => {
  const n = props.limit ?? 60;
  return props.events.slice(-n);
});
</script>

<style scoped>
.turn { color: var(--text-subtle); }
</style>
