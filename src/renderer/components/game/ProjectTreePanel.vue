<template>
  <Panel class="project-tree" :title="`Projects (${builtCount}/${nodes.length})`">
    <!-- Compact per-ideology influence readout: the big-counter tally that drives policy draws. -->
    <div class="influence-readout" role="list" aria-label="Influence by ideology">
      <span
        v-for="id in IDEOLOGIES"
        :key="id"
        class="influence-chip"
        role="listitem"
        :title="`${IDEOLOGY_DISPLAY[id].name} influence`"
      >
        <span class="influence-swatch" :style="{ background: cssColorFor(id) }"></span>
        <span class="influence-abbrev">{{ IDEOLOGY_DISPLAY[id].abbrev }}</span>
        <span class="influence-value">{{ influence[id] }}</span>
      </span>
    </div>

    <div class="tree-list">
      <div
        v-for="node in displayNodes"
        :key="node.pattern"
        class="tree-node"
        :class="{ built: node.built }"
      >
        <span class="node-mark" :class="{ filled: node.built }"></span>
        <div class="node-body">
          <span class="node-name">{{ node.name }}</span>
          <span class="node-req">
            <template v-if="node.built"
              >{{ node.requirement }} · +{{ node.contributedValue }}</template
            >
            <template v-else>{{ node.requirement }} · +{{ node.value }}</template>
          </span>
          <span
            v-if="node.built && node.cardIdeologies.length > 0"
            class="node-counters"
            aria-hidden="true"
          >
            <!-- One small counter per non-wild card. -->
            <span
              v-for="(ideo, i) in node.cardIdeologies"
              :key="i"
              class="counter counter-small"
              :style="{ background: cssColorFor(ideo) }"
            ></span>
            <!-- One large counter per completed build's majority (omitted on tie / all-wild),
                 so the big-counter tally equals the influence readout for repeat builds too. -->
            <template v-for="(maj, i) in node.majorities" :key="`maj-${i}`">
              <span
                v-if="maj"
                class="counter counter-large"
                :style="{ background: cssColorFor(maj) }"
              ></span>
            </template>
          </span>
        </div>
        <span v-if="node.buildCount > 1" class="node-count">×{{ node.buildCount }}</span>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { KeystoneProject, ProjectUnlock } from "../../../core/types.ts";
import { cssColorFor, IDEOLOGY_DISPLAY, IDEOLOGIES } from "../../../core/data/ideologies.ts";
import Panel from "../core/Panel.vue";
import { buildProjectTree } from "../../util/projectTree.ts";

const props = defineProps<{
  projects: KeystoneProject[];
  unlocks: ProjectUnlock[];
}>();

const tree = computed(() => buildProjectTree(props.projects, props.unlocks));
const nodes = computed(() => tree.value.nodes);
const influence = computed(() => tree.value.influence);
// Ladder reads top-down from aspiration to floor: royal-flush first.
const displayNodes = computed(() => [...nodes.value].reverse());
const builtCount = computed(() => nodes.value.filter((n) => n.built).length);
</script>

<style scoped>
.influence-readout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-bottom: var(--space-2);
  margin-bottom: var(--space-2);
  border-bottom: 1px solid var(--rule);
}
.influence-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.75rem;
}
.influence-swatch {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
}
.influence-abbrev {
  color: var(--ink-subtle);
  font-weight: 600;
  letter-spacing: 0.02em;
}
.influence-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.tree-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  overflow-y: auto;
  min-height: 0;
}
.tree-node {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--mat-strong);
  opacity: 0.55;
}
.tree-node.built {
  opacity: 1;
  border-left: 3px solid var(--accent);
}
/* status glyph, not a container — matches the panel-mark idiom */
.node-mark {
  flex: 0 0 auto;
  width: 10px;
  height: 10px;
  background: transparent;
  border: 1px solid var(--ink-subtle);
}
.node-mark.filled {
  background: var(--accent);
  border-color: var(--accent);
}
.node-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.node-name {
  font-weight: 600;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.node-req {
  font-size: 0.75rem;
  color: var(--ink-subtle);
}
.node-counters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 2px;
}
/* flat square counters — Bauhaus, no border-radius */
.counter {
  flex: 0 0 auto;
}
.counter-small {
  width: 7px;
  height: 7px;
}
.counter-large {
  width: 12px;
  height: 12px;
  margin-left: 3px;
}
.node-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
</style>
