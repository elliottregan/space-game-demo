<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { getSupportColor } from "../../utils/formatters";
import { GPanel } from "../../ui";

// biome-ignore lint/correctness/noUnusedVariables: used in template
const state = gameService.getState();

// biome-ignore lint/correctness/noUnusedVariables: used in template
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
  gap: var(--g-space-md);
}

.faction-card {
  padding: var(--g-space-md);
  border-top: var(--g-border-width) solid var(--g-color-border-strong);
  border-bottom: var(--g-border-width) solid var(--g-color-border-strong);
}

.faction-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--g-space-sm);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  margin-top: var(--g-space-sm);
  padding: var(--g-space-xs) var(--g-space-sm);
  background: var(--g-color-warning);
  color: var(--g-color-bg-base);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}
</style>
