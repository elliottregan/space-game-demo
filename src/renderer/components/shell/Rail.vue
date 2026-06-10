<template>
  <nav :class="['rail', `rail-${side}`]" :aria-label="`${side} rail`">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      :class="['rail-icon', { active: activeKey === item.key }]"
      :title="item.label"
      :aria-label="item.label"
      :aria-pressed="activeKey === item.key"
      @click="$emit('toggle', item.key)"
    >
      <RailIcon :name="item.icon" />
    </button>
  </nav>
</template>

<script setup lang="ts">
import RailIcon, { type RailIconName } from "./RailIcon.vue";

export type RailItem = { key: string; label: string; icon: RailIconName };

defineProps<{
  side: "left" | "right";
  items: RailItem[];
  activeKey: string | null;
}>();

defineEmits<{ toggle: [key: string] }>();
</script>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) 0;
  background: var(--ground);
  border-right: 1px solid var(--rule);
  align-items: center;
}
.rail-right {
  border-right: none;
  border-left: 1px solid var(--rule);
}
.rail-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  box-shadow: none;
  color: var(--ink-muted);
  cursor: pointer;
  padding: 0;
  transition:
    color 120ms ease,
    background 120ms ease;
}
.rail-icon:hover {
  color: var(--ink);
  background: var(--mat);
}
.rail-icon.active {
  color: var(--accent-ink);
  background: var(--accent);
}
.rail-icon:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
