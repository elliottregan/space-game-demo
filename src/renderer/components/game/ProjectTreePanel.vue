<template>
  <Panel class="project-tree" :title="`Projects (${builtCount}/${nodes.length})`">
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
        </div>
        <span v-if="node.buildCount > 1" class="node-count">×{{ node.buildCount }}</span>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { KeystoneProject, ProjectUnlock } from "../../../core/types.ts";
import Panel from "../core/Panel.vue";
import { buildProjectTree } from "../../util/projectTree.ts";

const props = defineProps<{
  projects: KeystoneProject[];
  unlocks: ProjectUnlock[];
}>();

const nodes = computed(() => buildProjectTree(props.projects, props.unlocks));
// Ladder reads top-down from aspiration to floor: royal-flush first.
const displayNodes = computed(() => [...nodes.value].reverse());
const builtCount = computed(() => nodes.value.filter((n) => n.built).length);
</script>

<style scoped>
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
.node-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-muted);
}
</style>
