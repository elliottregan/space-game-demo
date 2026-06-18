<template>
  <!--
    Polished, full Crisis-Tree DAG view in a modal (mirrors StatsModal on the
    shared core/Modal chrome). Renders the whole DAG: a root column on the left,
    then the three branch columns (Expansion / Doctrine / Wonder), with CSS
    connector lines fanning root → branches. Each node shows its name, branch,
    recipe with per-requirement progress (including Doctrine's policy-strength
    gate as a "policy X/Y" line) and its state: cleared (✓) / available
    (selectable, with the ideology picker for requireSameIdeology nodes) /
    locked. The active objective is highlighted; a win badge shows when won.
    The inline CrisisObjectivesPanel stays minimal — this is the rich read.
  -->
  <Modal
    :open="open"
    title="Crisis Tree"
    :description="`${crisisName} — chart a path to victory`"
    @update:open="$emit('update:open', $event)"
  >
    <template #header>
      <div class="ct-clock" :class="{ edge: turnsLeft <= 1 }">
        <span v-if="won" class="ct-win">Victory secured</span>
        <span v-else class="ct-clock-turns">{{ turnsLabel }}</span>
      </div>
    </template>

    <div class="ct-graph">
      <!-- Root column. -->
      <div class="ct-col ct-col-root">
        <span class="ct-col-head">Establish</span>
        <div v-if="rootNode" class="ct-node-wrap">
          <div class="ct-node" :class="nodeClasses(rootNode)" :data-branch="rootNode.branch">
            <component
              :is="nodeTag(rootNode)"
              class="ct-node-head"
              v-bind="nodeHeadAttrs(rootNode)"
            >
              <span class="ct-node-name">{{ rootNode.name }}</span>
              <span class="ct-node-state">{{ stateGlyph(rootNode) }}</span>
            </component>
            <span class="ct-node-branch">{{ rootNode.branch }}</span>
            <component :is="nodeRecipeAndPicker(rootNode)" />
          </div>
        </div>
      </div>

      <!-- Fan connector from root into the branch stack. -->
      <div class="ct-connector" aria-hidden="true">
        <div
          v-for="branch in BRANCH_ORDER"
          :key="branch"
          class="ct-wire"
          :class="{ lit: rootCleared }"
        ></div>
      </div>

      <!-- Branch columns, stacked vertically so each lines up with a wire. -->
      <div class="ct-branches">
        <div v-for="branch in BRANCH_ORDER" :key="branch" class="ct-branch-col">
          <span class="ct-col-head">{{ BRANCH_LABEL[branch] }}</span>
          <div v-for="node in nodesInBranch(branch)" :key="node.id" class="ct-node-wrap">
            <div class="ct-node" :class="nodeClasses(node)" :data-branch="node.branch">
              <component :is="nodeTag(node)" class="ct-node-head" v-bind="nodeHeadAttrs(node)">
                <span class="ct-node-name">{{ node.name }}</span>
                <span v-if="node.terminal" class="ct-node-flag">win</span>
                <span class="ct-node-state">{{ stateGlyph(node) }}</span>
              </component>
              <span class="ct-node-branch">{{ node.branch }}</span>
              <component :is="nodeRecipeAndPicker(node)" />
            </div>
          </div>
          <p v-if="nodesInBranch(branch).length === 0" class="ct-empty">—</p>
        </div>
      </div>
    </div>

    <template #footer>
      <p v-if="state.cleared.length" class="ct-cleared">Cleared: {{ clearedNames.join(" → ") }}</p>
      <p v-else class="ct-cleared ct-cleared-none">No objectives cleared yet.</p>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, h, reactive, type VNode } from "vue";
import type {
  CrisisTree,
  CrisisTreeState,
  Ideology,
  ObjectiveNode,
  PolicyState,
} from "../../../core/types.ts";
import { IDEOLOGIES, IDEOLOGY_DISPLAY } from "../../../core/data/ideologies.ts";
import { policyStrengthFor } from "../../../core/engine/crisisTree.ts";
import { requirementLabel } from "../../util/labels.ts";
import Modal from "../core/Modal.vue";

type Branch = "expansion" | "doctrine" | "wonder";
const BRANCH_ORDER: Branch[] = ["expansion", "doctrine", "wonder"];
const BRANCH_LABEL: Record<Branch, string> = {
  expansion: "Expansion",
  doctrine: "Doctrine",
  wonder: "Wonder",
};

const props = defineProps<{
  open: boolean;
  state: CrisisTreeState;
  availableNodes: ObjectiveNode[];
  tree: CrisisTree;
  policy: PolicyState;
  crisisName: string;
  turn: number;
  maxTurns: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "set-active": [payload: { nodeId: string; ideology?: Ideology }];
}>();

// Local, per-node ideology selection for Doctrine nodes (mirrors the inline
// panel): not bound in core until the node is activated. Keyed by node id.
const pendingIdeology = reactive<Record<string, Ideology | undefined>>({});

const rootNode = computed<ObjectiveNode | undefined>(() => props.tree.nodes[props.tree.rootId]);

const availableIds = computed(() => new Set(props.availableNodes.map((n) => n.id)));
const clearedSet = computed(() => new Set(props.state.cleared));
const rootCleared = computed(() => clearedSet.value.has(props.tree.rootId));

function nodesInBranch(branch: Branch): ObjectiveNode[] {
  return Object.values(props.tree.nodes).filter((n) => n.branch === branch);
}

// Crisis fires when turn > maxTurns; while on turn N of M, M - N + 1 turns remain.
const turnsLeft = computed(() => Math.max(0, props.maxTurns - props.turn + 1));
const turnsLabel = computed(() => {
  if (turnsLeft.value === 0) return "Crisis now";
  if (turnsLeft.value === 1)
    return "Turn " + props.turn + " / " + props.maxTurns + " · 1 turn left";
  return "Turn " + props.turn + " / " + props.maxTurns + " · " + turnsLeft.value + " turns left";
});

const won = computed(() =>
  props.state.cleared.some((id) => props.tree.nodes[id]?.terminal ?? false),
);

const clearedNames = computed(() =>
  props.state.cleared.map((id) => props.tree.nodes[id]?.name ?? id),
);

type NodeState = "cleared" | "available" | "active" | "locked";
function nodeStateOf(node: ObjectiveNode): NodeState {
  if (clearedSet.value.has(node.id)) return "cleared";
  if (node.id === props.state.activeNodeId) return "active";
  if (availableIds.value.has(node.id)) return "available";
  return "locked";
}

function nodeClasses(node: ObjectiveNode): Record<string, boolean> {
  const s = nodeStateOf(node);
  return {
    "is-cleared": s === "cleared",
    "is-available": s === "available",
    "is-active": s === "active",
    "is-locked": s === "locked",
    terminal: node.terminal,
  };
}

function stateGlyph(node: ObjectiveNode): string {
  const s = nodeStateOf(node);
  if (s === "cleared") return "✓";
  if (s === "locked") return "🔒";
  return "";
}

function progressFor(nodeId: string, reqIndex: number): number {
  return props.state.progress[nodeId]?.[reqIndex] ?? 0;
}

function selectNode(node: ObjectiveNode): void {
  // Only available (unlocked, not cleared) nodes are selectable.
  if (!availableIds.value.has(node.id)) return;
  if (node.requireSameIdeology) {
    const ideology = pendingIdeology[node.id];
    if (!ideology) return; // guarded; the head button is disabled
    emit("set-active", { nodeId: node.id, ideology });
  } else {
    emit("set-active", { nodeId: node.id });
  }
}

// --- Node head: a <button> when selectable, else an inert <span>. ---
function nodeTag(node: ObjectiveNode): "button" | "span" {
  return availableIds.value.has(node.id) ? "button" : "span";
}

function nodeHeadAttrs(node: ObjectiveNode): Record<string, unknown> {
  if (!availableIds.value.has(node.id)) return {};
  const needsPick = node.requireSameIdeology && pendingIdeology[node.id] === undefined;
  return {
    type: "button",
    disabled: needsPick,
    onClick: () => selectNode(node),
  };
}

// --- Recipe + ideology picker rendered together as a render-function VNode.
// Building it imperatively keeps the template flat and avoids duplicating the
// list/picker markup for the root vs. branch columns. ---
function nodeRecipeAndPicker(node: ObjectiveNode) {
  return (): VNode => {
    const children: VNode[] = [];

    // Doctrine ideology picker (only available, requireSameIdeology nodes).
    if (node.requireSameIdeology && nodeStateOf(node) === "available") {
      children.push(
        h(
          "div",
          { class: "ct-pick" },
          IDEOLOGIES.map((id) =>
            h(
              "button",
              {
                key: id,
                type: "button",
                class: ["ct-chip", { chosen: pendingIdeology[node.id] === id }],
                onClick: () => (pendingIdeology[node.id] = id),
              },
              IDEOLOGY_DISPLAY[id].abbrev,
            ),
          ),
        ),
      );
    }

    // Recipe: per-requirement progress + the Doctrine policy-strength gate.
    const items: VNode[] = node.requirements.map((req, i) => {
      const have = progressFor(node.id, i);
      const done = have >= req.count;
      return h("li", { key: "r" + i, class: { done } }, [
        h("span", { class: "ct-req-pattern" }, [
          requirementLabel(req.pattern),
          req.upgrade ? h("span", { class: "ct-req-upgrade" }, " (upgrade)") : null,
        ]),
        h("span", { class: "ct-req-count" }, have + "/" + req.count),
      ]);
    });

    if (node.policyStrength !== undefined) {
      // Bound ideology drives the live policy strength; before activation we
      // show 0/N against the pending pick (or just the requirement).
      const bound = props.state.boundIdeology[node.id] ?? pendingIdeology[node.id];
      const have = bound ? policyStrengthFor(props.policy, bound) : 0;
      const done = have >= node.policyStrength;
      items.push(
        h("li", { key: "policy", class: { done } }, [
          h("span", { class: "ct-req-pattern" }, [
            "policy",
            bound
              ? h("span", { class: "ct-req-upgrade" }, " (" + IDEOLOGY_DISPLAY[bound].abbrev + ")")
              : null,
          ]),
          h("span", { class: "ct-req-count" }, have + "/" + node.policyStrength),
        ]),
      );
    }

    children.push(h("ul", { class: "ct-recipe" }, items));
    return h("div", { class: "ct-node-body" }, children);
  };
}
</script>

<style scoped>
.ct-clock {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 12px;
}
.ct-clock-turns {
  font-weight: 800;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.ct-clock.edge .ct-clock-turns {
  color: var(--status-negative);
}
.ct-win {
  padding: 2px var(--space-2);
  background: var(--status-positive);
  color: var(--paper);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* DAG layout: root column | fan connector | stacked branch columns. */
.ct-graph {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) 28px minmax(180px, 1.4fr);
  align-items: stretch;
  gap: var(--space-2);
}
.ct-col,
.ct-branches {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ct-col-root {
  justify-content: center;
}
.ct-branch-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.ct-col-head {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-subtle);
}
.ct-branches .ct-branch-col + .ct-branch-col {
  margin-top: var(--space-1);
}

/* Connector: a vertical column of wires that fan toward each branch. CSS-only
   so it stays light; "lit" once the root is cleared (branches unlocked). */
.ct-connector {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 20px 0;
}
.ct-wire {
  height: 2px;
  background: var(--mat-strong);
  margin: auto 0;
}
.ct-wire.lit {
  background: var(--accent);
}

.ct-node-wrap {
  display: flex;
  flex-direction: column;
}
.ct-node {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--mat);
  border-left: 3px solid var(--mat-strong);
}
.ct-node.is-locked {
  opacity: 0.55;
}
.ct-node.is-available {
  border-left-color: var(--accent);
}
.ct-node.is-active {
  outline: 2px solid var(--accent);
  border-left-color: var(--accent);
}
.ct-node.is-cleared {
  border-left-color: var(--status-positive);
}

.ct-node-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
}
button.ct-node-head {
  cursor: pointer;
}
button.ct-node-head:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}
.ct-node-name {
  font-weight: 700;
  color: var(--ink);
}
.ct-node-flag {
  font-size: 10px;
  font-weight: 700;
  color: var(--status-warning);
  text-transform: uppercase;
}
.ct-node-state {
  margin-left: auto;
  font-size: 12px;
  color: var(--status-positive);
}
.ct-node-branch {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-subtle);
}

.ct-node-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.ct-pick {
  display: flex;
  gap: var(--space-1);
}
.ct-chip {
  font-size: 10px;
  font-weight: 700;
  padding: 1px var(--space-1);
  background: var(--mat-strong);
  border: 0;
  cursor: pointer;
  color: var(--ink-muted);
}
.ct-chip.chosen {
  background: var(--accent);
  color: var(--paper);
}

.ct-recipe {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
}
.ct-recipe li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--ink-muted);
}
.ct-recipe li.done {
  color: var(--status-positive);
  font-weight: 600;
}
.ct-req-upgrade {
  color: var(--ink-subtle);
}
.ct-req-count {
  font-variant-numeric: tabular-nums;
}

.ct-empty {
  margin: 0;
  font-size: 11px;
  color: var(--ink-subtle);
}
.ct-cleared {
  margin: 0;
  font-size: 11px;
  color: var(--ink-muted);
}
.ct-cleared-none {
  color: var(--ink-subtle);
}
</style>
