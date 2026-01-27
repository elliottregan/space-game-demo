<script setup lang="ts"></script>

<template>
  <div class="tab-content">
    <p class="hint">Building modes are set on individual buildings in the Building panel.</p>
    <div class="mode-legend">
      <div><strong>Conservation:</strong> 50% production, 40% consumption</div>
      <div><strong>Normal:</strong> 100% production, 100% consumption</div>
      <div><strong>Overdrive:</strong> 150% production, 200% consumption, breakdown risk</div>
    </div>
  </div>
</template>

<style scoped>
.hint {
  color: var(--g-color-text-muted);
  font-size: var(--g-font-size-sm);
  margin-bottom: var(--g-space-md);
}

.mode-legend {
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  display: flex;
  flex-direction: column;
  gap: var(--g-space-xs);
}
</style>
