<script setup lang="ts">
import { computed } from "vue";
import type { NPC } from "../../../core/models/NPCInfluence";

interface Props {
  npc: NPC;
  supportLevel: number | null;
  relationships: { npc: NPC; influenceFrom: number; influenceTo: number }[];
  councils: { id: string; name: string; memberIds: string[] }[];
}

const props = defineProps<Props>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const emit = defineEmits<{
  close: [];
}>();

// biome-ignore lint/correctness/noUnusedVariables: used in template
const npcCouncils = computed(() =>
  props.councils.filter((c) => c.memberIds.includes(props.npc.id))
);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatPercent(value: number): string {
  const pct = (value * 100).toFixed(0);
  return value >= 0 ? `+${pct}%` : `${pct}%`;
}
</script>

<template>
  <div class="npc-detail-panel">
    <div class="panel-header">
      <h3>{{ npc.name }}</h3>
      <button class="close-btn" @click="emit('close')">×</button>
    </div>

    <div class="npc-meta">
      <div class="meta-row">
        <span class="label">Faction:</span>
        <span class="value faction" :class="npc.faction">
          {{ npc.faction }}
        </span>
      </div>
      <div class="meta-row">
        <span class="label">Influence:</span>
        <span class="value">{{ npc.influence.toFixed(1) }}×</span>
      </div>
      <div v-if="supportLevel !== null" class="meta-row">
        <span class="label">Support:</span>
        <span
          class="value"
          :class="{
            positive: supportLevel > 0,
            negative: supportLevel < 0,
          }"
        >
          {{ formatPercent(supportLevel) }}
        </span>
      </div>
    </div>

    <div v-if="npcCouncils.length > 0" class="councils-section">
      <h4>Councils</h4>
      <div v-for="council in npcCouncils" :key="council.id" class="council-badge">
        {{ council.name }}
      </div>
    </div>

    <div v-if="relationships.length > 0" class="relationships-section">
      <h4>Relationships</h4>
      <div class="relationship-list">
        <div
          v-for="rel in relationships"
          :key="rel.npc.id"
          class="relationship-item"
        >
          <span class="rel-name">{{ rel.npc.name }}</span>
          <div class="rel-bars">
            <div class="rel-bar">
              <span class="rel-label">From</span>
              <div class="bar-track">
                <div
                  class="bar-fill from"
                  :style="{ width: `${rel.influenceFrom * 100}%` }"
                />
              </div>
              <span class="rel-value">{{ (rel.influenceFrom * 100).toFixed(0) }}%</span>
            </div>
            <div class="rel-bar">
              <span class="rel-label">To</span>
              <div class="bar-track">
                <div
                  class="bar-fill to"
                  :style="{ width: `${rel.influenceTo * 100}%` }"
                />
              </div>
              <span class="rel-value">{{ (rel.influenceTo * 100).toFixed(0) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.npc-detail-panel {
  width: 260px;
  background: var(--g-color-bg-elevated);
  border: 1px solid var(--g-color-border);
  border-radius: 4px;
  padding: var(--g-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  overflow-y: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
}

.close-btn {
  background: none;
  border: none;
  color: var(--g-color-text-muted);
  cursor: pointer;
  font-size: 1.4rem;
  padding: 0 var(--g-space-xs);
  line-height: 1;
}

.close-btn:hover {
  color: var(--g-color-text);
}

.npc-meta {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--g-font-size-sm);
}

.label {
  color: var(--g-color-text-muted);
}

.value.faction {
  text-transform: capitalize;
}

.value.faction.futurist {
  color: #60a5fa;
}

.value.faction.progressive {
  color: #4ade80;
}

.value.faction.traditionalist {
  color: #fbbf24;
}

.value.positive {
  color: var(--g-color-positive);
}

.value.negative {
  color: var(--g-color-negative);
}

.councils-section,
.relationships-section {
  margin-top: var(--g-space-sm);
}

.councils-section h4,
.relationships-section h4 {
  margin: 0 0 var(--g-space-xs);
  font-size: var(--g-font-size-sm);
  color: var(--g-color-text-muted);
  border-bottom: 1px solid var(--g-color-border);
  padding-bottom: var(--g-space-xs);
}

.council-badge {
  display: inline-block;
  padding: 2px 8px;
  background: rgba(134, 239, 172, 0.2);
  border: 1px solid rgba(134, 239, 172, 0.4);
  border-radius: 4px;
  font-size: var(--g-font-size-xs);
  margin-right: var(--g-space-xs);
}

.relationship-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.relationship-item {
  font-size: var(--g-font-size-xs);
}

.rel-name {
  font-weight: 500;
  display: block;
  margin-bottom: 2px;
}

.rel-bars {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rel-bar {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
}

.rel-label {
  width: 30px;
  color: var(--g-color-text-muted);
}

.bar-track {
  flex: 1;
  height: 6px;
  background: var(--g-color-bg);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
}

.bar-fill.from {
  background: #60a5fa;
}

.bar-fill.to {
  background: #4ade80;
}

.rel-value {
  width: 35px;
  text-align: right;
  color: var(--g-color-text-muted);
}
</style>
