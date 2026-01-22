<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { NPC } from "../../core/models/NPCInfluence";

interface Props {
  data: {
    npc: NPC;
    color: string;
    inCouncil: boolean;
    supportLevel: number | null;
  };
}

defineProps<Props>();

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
</script>

<template>
  <div class="npc-node" :class="{ 'in-council': data.inCouncil }">
    <Handle type="target" :position="Position.Top" />

    <div class="node-content" :style="{ borderColor: data.color }">
      <div class="avatar" :style="{ background: data.color }">
        {{ getInitials(data.npc.name) }}
      </div>
      <div class="name">{{ data.npc.name.split(" ").pop() }}</div>
      <div v-if="data.supportLevel !== null" class="support-indicator">
        <div
          class="support-bar"
          :class="{
            positive: data.supportLevel > 0,
            negative: data.supportLevel < 0,
          }"
          :style="{
            width: `${Math.abs(data.supportLevel) * 100}%`,
            marginLeft: data.supportLevel < 0 ? 'auto' : '50%',
            marginRight: data.supportLevel >= 0 ? 'auto' : '50%',
          }"
        />
      </div>
    </div>

    <Handle type="source" :position="Position.Bottom" />
  </div>
</template>

<style scoped>
.npc-node {
  position: relative;
}

.node-content {
  background: var(--g-color-bg-elevated);
  border: 2px solid var(--g-color-border);
  border-radius: 8px;
  padding: 6px 10px;
  min-width: 70px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.npc-node:hover .node-content {
  transform: scale(1.05);
}

.npc-node.in-council .node-content {
  box-shadow: 0 0 12px oklch(70% 0.17 145 / 0.4);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 4px;
  font-size: 11px;
  font-weight: bold;
  color: var(--g-color-bg);
}

.name {
  font-family: var(--g-font-mono);
  font-size: 10px;
  color: var(--g-color-text);
  white-space: nowrap;
}

.support-indicator {
  margin-top: 4px;
  height: 4px;
  background: var(--g-color-bg);
  border-radius: 2px;
  overflow: hidden;
  display: flex;
}

.support-bar {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
  max-width: 50%;
}

.support-bar.positive {
  background: var(--g-color-positive);
}

.support-bar.negative {
  background: var(--g-color-negative);
}

/* Handle styling */
.npc-node :deep(.vue-flow__handle) {
  width: 6px;
  height: 6px;
  background: var(--g-color-border);
  border: none;
}
</style>
