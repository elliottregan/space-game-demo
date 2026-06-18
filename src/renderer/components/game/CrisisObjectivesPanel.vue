<template>
  <Panel title="Crisis">
    <!-- Turn clock: turns remaining before the Crisis resolves. -->
    <div class="clock" :class="{ edge: turnsLeft <= 1 }">
      <span class="clock-name">{{ crisisName }}</span>
      <span class="clock-turns">{{ turnsLabel }}</span>
    </div>

    <div v-if="won" class="win-badge">Victory secured</div>

    <!-- Available objectives: selectable, marks the active one. -->
    <div class="nodes">
      <div
        v-for="node in availableNodes"
        :key="node.id"
        class="node"
        :class="{ active: node.id === state.activeNodeId, terminal: node.terminal }"
      >
        <button
          class="node-select"
          :disabled="node.requireSameIdeology && pendingIdeology[node.id] === undefined"
          @click="selectNode(node)"
        >
          <span class="node-name">{{ node.name }}</span>
          <span class="node-branch">{{ node.branch }}</span>
          <span v-if="node.terminal" class="node-flag">win</span>
        </button>

        <!-- Doctrine: bind the counted color before activating. -->
        <div v-if="node.requireSameIdeology" class="ideology-pick">
          <button
            v-for="id in IDEOLOGIES"
            :key="id"
            class="ideology-chip"
            :class="{ chosen: pendingIdeology[node.id] === id }"
            @click="pendingIdeology[node.id] = id"
          >
            {{ IDEOLOGY_DISPLAY[id].abbrev }}
          </button>
        </div>

        <!-- Recipe with per-requirement progress, shown for the active node. -->
        <ul v-if="node.id === state.activeNodeId" class="recipe">
          <li
            v-for="(req, i) in node.requirements"
            :key="i"
            :class="{ done: progressFor(node.id, i) >= req.count }"
          >
            <span class="req-pattern"
              >{{ requirementLabel(req.pattern)
              }}<span v-if="req.upgrade" class="req-upgrade"> (upgrade)</span></span
            >
            <span class="req-count">{{ progressFor(node.id, i) }}/{{ req.count }}</span>
          </li>
        </ul>
      </div>

      <p v-if="availableNodes.length === 0" class="empty">No objectives available.</p>
    </div>

    <!-- Cleared path summary. -->
    <p v-if="state.cleared.length" class="cleared">Cleared: {{ clearedNames.join(" → ") }}</p>
  </Panel>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import type { CrisisTree, CrisisTreeState, Ideology, ObjectiveNode } from "../../../core/types.ts";
import { IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { requirementLabel } from "../../util/labels.ts";
import Panel from "../core/Panel.vue";

const props = defineProps<{
  state: CrisisTreeState;
  availableNodes: ObjectiveNode[];
  tree: CrisisTree;
  crisisName: string;
  turn: number;
  maxTurns: number;
}>();

const emit = defineEmits<{ "set-active": [payload: { nodeId: string; ideology?: Ideology }] }>();

// Local, per-node ideology selection for Doctrine nodes (not yet bound in core
// until the node is activated). Reset is unnecessary — keyed by node id.
const pendingIdeology = reactive<Record<string, Ideology | undefined>>({});

// Crisis fires when turn > maxTurns; while on turn N of M, M - N + 1 turns remain.
const turnsLeft = computed(() => Math.max(0, props.maxTurns - props.turn + 1));
const turnsLabel = computed(() => {
  if (turnsLeft.value === 0) return "Crisis now";
  if (turnsLeft.value === 1) return "1 turn left";
  return `${turnsLeft.value} turns left`;
});

const won = computed(() =>
  props.state.cleared.some((id) => props.tree.nodes[id]?.terminal ?? false),
);

function progressFor(nodeId: string, reqIndex: number): number {
  return props.state.progress[nodeId]?.[reqIndex] ?? 0;
}

const clearedNames = computed(() =>
  props.state.cleared.map((id) => props.tree.nodes[id]?.name ?? id),
);

function selectNode(node: ObjectiveNode): void {
  if (node.requireSameIdeology) {
    const ideology = pendingIdeology[node.id];
    if (!ideology) return; // button is disabled, but guard anyway
    emit("set-active", { nodeId: node.id, ideology });
  } else {
    emit("set-active", { nodeId: node.id });
  }
}
</script>

<style scoped>
.clock {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 12px;
}
.clock-name {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
}
.clock-turns {
  font-weight: 800;
  color: var(--ink);
}
.clock.edge .clock-turns {
  color: var(--status-negative);
}
.win-badge {
  align-self: flex-start;
  padding: 2px var(--space-2);
  background: var(--status-positive);
  color: var(--paper);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
.nodes {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.node {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--mat);
}
.node.active {
  outline: 2px solid var(--accent);
}
.node-select {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.node-select:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.node-name {
  font-weight: 700;
  color: var(--ink);
}
.node-branch {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-subtle);
}
.node-flag {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  color: var(--status-warning);
  text-transform: uppercase;
}
.ideology-pick {
  display: flex;
  gap: var(--space-1);
}
.ideology-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 1px var(--space-1);
  background: var(--mat-strong);
  border: 0;
  cursor: pointer;
  color: var(--ink-muted);
}
.ideology-chip.chosen {
  background: var(--accent);
  color: var(--paper);
}
.recipe {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}
.recipe li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--ink-muted);
}
.recipe li.done {
  color: var(--status-positive);
  font-weight: 600;
}
.req-upgrade {
  color: var(--ink-subtle);
}
.req-count {
  font-variant-numeric: tabular-nums;
}
.empty,
.cleared {
  margin: 0;
  font-size: 11px;
  color: var(--ink-subtle);
}
</style>
