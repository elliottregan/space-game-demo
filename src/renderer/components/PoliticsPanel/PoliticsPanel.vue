<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

function getSupportColor(support: number): string {
  if (support >= 0.5) return 'var(--color-positive)';
  if (support >= 0) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}
</script>

<template>
  <GPanel title="Politics">
    <div class="factions">
      <div
        v-for="faction in state.politics.factions"
        :key="faction.id"
        class="faction-card"
      >
        <div class="faction-header">
          <span class="faction-name">{{ faction.name }}</span>
          <span
            class="faction-support"
            :style="{ color: getSupportColor(faction.support) }"
          >
            {{ formatSupport(faction.support) }}
          </span>
        </div>

        <div class="support-bar">
          <div
            class="support-fill"
            :style="{
              width: `${Math.max(0, (faction.support + 1) * 50)}%`,
              backgroundColor: getSupportColor(faction.support)
            }"
          />
        </div>

        <div v-if="faction.activeDemand" class="demand-warning">
          ⚠️ Demands project! {{ faction.activeDemand.deadline }} sols remaining
        </div>
      </div>
    </div>

    <p class="hint">
      Propose projects in the NPC tab to satisfy faction demands.
    </p>
  </GPanel>
</template>

<style scoped>
.factions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.faction-card {
  padding: 0.75rem;
  background: var(--color-surface);
  border-radius: 4px;
}

.faction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.faction-name {
  font-weight: 500;
}

.support-bar {
  height: 8px;
  background: var(--color-muted);
  border-radius: 4px;
  overflow: hidden;
}

.support-fill {
  height: 100%;
  transition: width 0.3s;
}

.demand-warning {
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-warning);
  color: var(--color-background);
  border-radius: 4px;
  font-size: 0.875rem;
}

.hint {
  margin-top: 1rem;
  color: var(--color-muted);
  font-size: 0.875rem;
}
</style>
