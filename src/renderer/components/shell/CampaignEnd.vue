<template>
  <div class="eoe-overlay">
    <div class="eoe-panel" style="text-align: center">
      <h2>Campaign Complete</h2>
      <p style="color: var(--text-muted); margin-bottom: 16px">
        The planet's story closes. Restart to tell another.
      </p>
      <button class="primary" @click="$emit('restart')">New Campaign</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ restart: [] }>();
</script>
