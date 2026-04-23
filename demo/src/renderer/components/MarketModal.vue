<template>
  <div class="eoe-overlay" @click.self="$emit('close')">
    <div class="card-list-panel">
      <div class="card-list-header">
        <h2>Market</h2>
        <button @click="$emit('close')">Close</button>
      </div>
      <div class="card-list-empty" style="padding: 60px 40px">
        <div style="font-size: 16px; margin-bottom: 12px">Not stocked yet.</div>
        <div style="color: var(--fg-muted); font-size: 12px">
          Future feature: spend Materials to acquire cards.
        </div>
        <div style="color: var(--fg-muted); font-size: 12px; margin-top: 12px">
          For now, every card is in your starting deck.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ close: [] }>();
</script>
