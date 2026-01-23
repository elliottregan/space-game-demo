<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";
import { ColonistRole } from "../../core/models/Colonist";
import { GPanel, GProgress } from "../ui";

// Reactive state for template bindings (auto-updates when API syncs)
const state = gameService.getState();

// Domain API for commands and one-off queries (for future extensibility)
// biome-ignore lint/correctness/noUnusedVariables: reserved for future API usage
const api = gameService.api;

// biome-ignore lint/correctness/noUnusedVariables: used in template
const workforceStats = computed(() => {
  const stats: Record<ColonistRole, number> = {
    [ColonistRole.UNASSIGNED]: 0,
    [ColonistRole.RESEARCH]: 0,
    [ColonistRole.ENGINEERING]: 0,
    [ColonistRole.CIVIL_SCIENCE]: 0,
    [ColonistRole.FARMING]: 0,
  };

  for (const colonist of state.colonists) {
    stats[colonist.role]++;
  }

  return stats;
});

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

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getHealthVariant(health: number): "positive" | "warning" | "negative" {
  if (health >= 80) return "positive";
  if (health >= 50) return "warning";
  return "negative";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getMoraleVariant(morale: number): "positive" | "warning" | "negative" {
  if (morale >= 70) return "positive";
  if (morale >= 40) return "warning";
  return "negative";
}
</script>

<template>
  <GPanel title="Colony Status">
    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Population</span>
        <span class="stat-value population">{{ state.population }}</span>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Health</span>
        <GProgress
          :percent="state.health"
          :variant="getHealthVariant(state.health)"
          showLabel
        />
      </div>
    </div>

    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Morale</span>
        <GProgress
          :percent="state.morale"
          :variant="getMoraleVariant(state.morale)"
          showLabel
        />
      </div>
    </div>

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
  </GPanel>
</template>

<style scoped>
.stat-row {
  margin-bottom: var(--g-space-md);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--g-space-sm);
}

.stat-label {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  min-width: 80px;
}

.stat-value {
  font-family: var(--g-font-mono);
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-value.population {
  color: var(--g-color-info);
}

.workforce-section {
  margin-top: var(--g-space-md);
  padding-top: var(--g-space-md);
  border-top: 1px solid var(--g-color-border);
}

.workforce-section h3 {
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
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
  background: var(--g-color-bg-elevated);
  border-radius: 4px;
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
