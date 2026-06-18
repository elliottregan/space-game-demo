<template>
  <div class="column-footer">
    <button
      :disabled="empty"
      :title="empty ? 'Column is empty' : 'Discards every card; adds 1 Dissent per card'"
      @click="$emit('discard-column')"
    >
      Discard column
    </button>
    <button
      :disabled="!buildable"
      :title="
        buildable ? buildTooltip : 'Build needs a Land and an Influence row that form a pattern.'
      "
      @click="$emit('build')"
    >
      Build
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  empty: boolean;
  buildable: boolean;
  buildTooltip: string;
}>();
defineEmits<{ "discard-column": []; build: [] }>();
</script>
