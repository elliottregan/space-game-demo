<script setup lang="ts">
import { computed } from "vue";
import { gameService } from "../services/GameService";
import { ColonistRole } from "../../core/models/Colonist";

const state = gameService.getState();

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
function getHealthColor(health: number): string {
  if (health >= 80) return "#4ade80";
  if (health >= 50) return "#fbbf24";
  return "#f87171";
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getMoraleColor(morale: number): string {
  if (morale >= 70) return "#4ade80";
  if (morale >= 40) return "#fbbf24";
  return "#f87171";
}
</script>

<template>
  <div class="panel colony-panel">
    <h2>Colony Status</h2>

    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Population</span>
        <span class="stat-value population">{{ state.population }}</span>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Health</span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{
              width: `${state.health}%`,
              background: getHealthColor(state.health)
            }"
          ></div>
        </div>
        <span class="stat-percent">{{ Math.floor(state.health) }}%</span>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat">
        <span class="stat-label">Morale</span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{
              width: `${state.morale}%`,
              background: getMoraleColor(state.morale)
            }"
          ></div>
        </div>
        <span class="stat-percent">{{ Math.floor(state.morale) }}%</span>
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
  </div>
</template>

<style scoped>
.colony-panel {
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
}

.stat-row {
  margin-bottom: 1rem;
}

.stat {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #888;
  min-width: 80px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-value.population {
  color: #60a5fa;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease, background 0.3s ease;
}

.stat-percent {
  font-size: 0.875rem;
  min-width: 40px;
  text-align: right;
}

.workforce-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.workforce-section h3 {
  font-size: 0.875rem;
  color: #888;
  margin-bottom: 0.75rem;
}

.workforce-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.workforce-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.875rem;
}

.role-icon {
  font-size: 1rem;
}

.role-count {
  font-weight: bold;
  min-width: 20px;
}

.role-name {
  color: #888;
  font-size: 0.75rem;
}
</style>
