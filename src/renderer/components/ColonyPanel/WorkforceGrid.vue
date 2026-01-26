<script setup lang="ts">
import { ColonistRole } from "../../../core/models/Colonist";

defineProps<{
  workforceStats: Record<ColonistRole, number>;
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const roleNames: Record<ColonistRole, string> = {
  [ColonistRole.UNASSIGNED]: "Unassigned",
  [ColonistRole.RESEARCH]: "Researchers",
  [ColonistRole.ENGINEERING]: "Engineers",
  [ColonistRole.CIVIL_SCIENCE]: "Scientists",
  [ColonistRole.FARMING]: "Farmers",
};

// biome-ignore lint/correctness/noUnusedVariables: used in template
const roleIcons: Record<ColonistRole, string> = {
  [ColonistRole.UNASSIGNED]: "👤",
  [ColonistRole.RESEARCH]: "🔬",
  [ColonistRole.ENGINEERING]: "⚙️",
  [ColonistRole.CIVIL_SCIENCE]: "📊",
  [ColonistRole.FARMING]: "🌱",
};
</script>

<template>
  <div class="workforce-section">
    <h3>Workforce</h3>
    <div class="workforce-grid">
      <div
        v-for="(count, role) in workforceStats"
        :key="role"
        class="workforce-item"
      >
        <span class="role-icon">{{ roleIcons[role as ColonistRole] }}</span>
        <span class="role-count">{{ count }}</span>
        <span class="role-name">{{ roleNames[role as ColonistRole] }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workforce-section {
  margin-top: var(--g-space-md);
  padding-top: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
}

.workforce-section h3 {
  font-size: var(--g-font-size-sm);
  font-family: var(--g-font-mono);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-sm);
}

.workforce-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--g-space-xs);
}

.workforce-item {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-sm);
  font-size: var(--g-font-size-sm);
}

.role-icon {
  font-size: 1rem;
}

.role-count {
  font-family: var(--g-font-mono);
  font-weight: bold;
  min-width: 20px;
}

.role-name {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-xs);
}
</style>
