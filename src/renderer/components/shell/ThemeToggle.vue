<template>
  <button
    class="theme-toggle"
    :title="`Theme: ${themeLabel(themePref)} (click to cycle)`"
    @click="cycleTheme"
  >
    {{ icon }} {{ themeLabel(themePref) }}
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { themePref, cycleTheme, themeLabel } from "../../util/theme.ts";

const icon = computed(() => {
  if (themePref.value === "dark") return "◐";
  if (themePref.value === "light") return "◑";
  return "◒";
});
</script>

<style scoped>
.theme-toggle {
  background: var(--surface-card);
  color: var(--text);
  border: 1px solid var(--border-strong);
  padding: 6px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
  justify-content: center;
}
.theme-toggle:hover {
  background: var(--surface-card-hover);
}
</style>
