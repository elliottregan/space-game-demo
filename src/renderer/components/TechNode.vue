<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import type { Technology } from "../../core/models/Technology";

interface Props {
  data: {
    tech: Technology;
    status: "researched" | "in_progress" | "available" | "locked";
    progress: number;
  };
}

defineProps<Props>();
</script>

<template>
  <div class="tech-node" :class="data.status">
    <Handle type="target" :position="Position.Top" :connectable="false" />

    <div class="node-content">
      <div class="node-icon">
        <span v-if="data.status === 'researched'">&#10003;</span>
        <span v-else-if="data.status === 'in_progress'" class="spinner">&#9696;</span>
        <span v-else-if="data.status === 'available'">&#9733;</span>
        <span v-else>&#128274;</span>
      </div>
      <div class="node-name">{{ data.tech.name }}</div>
      <div class="node-cost">{{ data.tech.cost.sols }}s</div>
    </div>

    <div v-if="data.status === 'in_progress'" class="progress-ring">
      <svg viewBox="0 0 36 36">
        <path
          class="progress-bg"
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <path
          class="progress-fill"
          :stroke-dasharray="`${data.progress}, 100`"
          d="M18 2.0845
            a 15.9155 15.9155 0 0 1 0 31.831
            a 15.9155 15.9155 0 0 1 0 -31.831"
        />
      </svg>
    </div>

    <Handle type="source" :position="Position.Bottom" :connectable="false" />
  </div>
</template>

<style scoped>
.tech-node {
  position: relative;
  background: var(--g-color-bg-elevated);
  border: 2px solid var(--g-color-border);
  border-radius: 8px;
  padding: 8px 12px;
  min-width: 100px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tech-node:hover {
  transform: scale(1.05);
}

.tech-node.researched {
  border-color: var(--g-color-positive);
  background: oklch(70% 0.17 145 / 0.1);
}

.tech-node.researched:hover {
  box-shadow: 0 0 12px oklch(70% 0.17 145 / 0.4);
}

.tech-node.in_progress {
  border-color: var(--g-color-info);
  background: oklch(65% 0.15 250 / 0.1);
  animation: pulse 2s infinite;
}

.tech-node.available {
  border-color: var(--g-color-warning);
  background: oklch(75% 0.15 85 / 0.1);
}

.tech-node.available:hover {
  box-shadow: 0 0 12px oklch(75% 0.15 85 / 0.5);
  border-color: var(--g-color-warning);
}

.tech-node.locked {
  opacity: 0.5;
  border-color: var(--g-color-border);
}

.tech-node.locked:hover {
  opacity: 0.7;
}

.node-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.node-icon {
  font-size: 14px;
  line-height: 1;
}

.tech-node.researched .node-icon {
  color: var(--g-color-positive);
}

.tech-node.in_progress .node-icon {
  color: var(--g-color-info);
}

.tech-node.available .node-icon {
  color: var(--g-color-warning);
}

.tech-node.locked .node-icon {
  color: var(--g-color-text-muted);
}

.spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 8px oklch(65% 0.15 250 / 0.3); }
  50% { box-shadow: 0 0 16px oklch(65% 0.15 250 / 0.6); }
}

.node-name {
  font-family: var(--g-font-mono);
  font-size: 11px;
  font-weight: bold;
  text-align: center;
  color: var(--g-color-text);
  max-width: 90px;
  line-height: 1.2;
}

.node-cost {
  font-size: 9px;
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
}

.tech-node.researched .node-name {
  color: var(--g-color-positive);
}

.tech-node.in_progress .node-name {
  color: var(--g-color-info);
}

.tech-node.available .node-name {
  color: var(--g-color-warning);
}

.progress-ring {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 24px;
  height: 24px;
}

.progress-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-bg {
  fill: none;
  stroke: var(--g-color-bg);
  stroke-width: 3;
}

.progress-fill {
  fill: none;
  stroke: var(--g-color-info);
  stroke-width: 3;
  stroke-linecap: round;
  transition: stroke-dasharray 0.3s ease;
}

/* Handle styling */
.tech-node :deep(.vue-flow__handle) {
  width: 8px;
  height: 8px;
  background: var(--g-color-border);
  border: none;
}

.tech-node.researched :deep(.vue-flow__handle) {
  background: var(--g-color-positive);
}

.tech-node.in_progress :deep(.vue-flow__handle) {
  background: var(--g-color-info);
}

.tech-node.available :deep(.vue-flow__handle) {
  background: var(--g-color-warning);
}
</style>
