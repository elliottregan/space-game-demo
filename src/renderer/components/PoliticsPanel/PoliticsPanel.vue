<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { getSupportColor } from "../../utils/formatters";
import { GPanel } from "../../ui";

const state = gameService.getState();

function formatSupport(support: number): string {
  return `${(support * 100).toFixed(0)}%`;
}
</script>

<template>
  <GPanel title="Politics" accent="slate">
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
  background: var(--g-color-bg-surface);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.faction-name {
  font-family: var(--g-font-mono);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.support-bar {
  height: 8px;
  background: var(--g-color-text-muted);
  overflow: hidden;
}

.support-fill {
  height: 100%;
  transition: width 0.3s;
}

.demand-warning {
  margin-top: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--g-color-warning);
  color: var(--g-color-bg);
  font-family: var(--g-font-mono);
  font-size: 0.875rem;
}

.hint {
  margin-top: 1rem;
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: 0.875rem;
}
</style>
