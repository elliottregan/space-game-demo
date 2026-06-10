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
  background: transparent;
  color: var(--ground);
  border: none;
  box-shadow: none;
  border-bottom: 2px solid var(--ground);
  padding: 6px 10px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
  justify-content: center;
}
.theme-toggle:hover {
  background: color-mix(in srgb, var(--ground) 15%, transparent);
}
</style>
