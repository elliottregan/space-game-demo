<script setup lang="ts">
import { ref } from "vue";
import { CountdownTimer, GButton, GPanel, GProgress, ResourceBadge } from "../ui";

const loading = ref(false);

// biome-ignore lint/correctness/noUnusedVariables: used in template
function simulateLoading() {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 2000);
}
</script>

<template>
  <div class="showcase">
    <h1 class="showcase__title">UI Framework Showcase</h1>

    <!-- Panels -->
    <section class="showcase__section">
      <h2>GPanel</h2>
      <div class="showcase__row">
        <GPanel title="Default Panel">
          <p>Panel body content goes here.</p>
        </GPanel>
        <GPanel title="Glow Panel" glow>
          <p>Panel with glow effect for emphasis.</p>
        </GPanel>
        <GPanel>
          <template #header>Custom Header Slot</template>
          <p>Using the header slot instead of title prop.</p>
          <template #footer>
            <GButton size="sm">Footer Action</GButton>
          </template>
        </GPanel>
      </div>
    </section>

    <!-- Buttons -->
    <section class="showcase__section">
      <h2>GButton</h2>
      <div class="showcase__row">
        <GButton variant="primary">Primary</GButton>
        <GButton variant="secondary">Secondary</GButton>
        <GButton variant="danger">Danger</GButton>
        <GButton variant="ghost">Ghost</GButton>
      </div>
      <div class="showcase__row">
        <GButton variant="primary" size="sm">Small Primary</GButton>
        <GButton variant="secondary" size="sm">Small Secondary</GButton>
        <GButton disabled>Disabled</GButton>
        <GButton :loading="loading" @click="simulateLoading">
          {{ loading ? "Loading..." : "Click to Load" }}
        </GButton>
      </div>
    </section>

    <!-- Progress -->
    <section class="showcase__section">
      <h2>GProgress</h2>
      <div class="showcase__column">
        <GProgress :percent="25" showLabel />
        <GProgress :percent="50" variant="positive" showLabel />
        <GProgress :percent="75" variant="warning" showLabel />
        <GProgress :percent="90" variant="negative" showLabel />
        <GProgress :percent="60" showLabel>Custom Label</GProgress>
      </div>
    </section>

    <!-- Resource Badges -->
    <section class="showcase__section">
      <h2>ResourceBadge</h2>
      <div class="showcase__row">
        <ResourceBadge resource="food" :amount="1250" :rate="12.5" />
        <ResourceBadge resource="water" :amount="800" :rate="-5.2" />
        <ResourceBadge resource="power" :amount="500" />
        <ResourceBadge resource="oxygen" :amount="2000" :rate="0" size="sm" />
        <ResourceBadge resource="materials" :amount="350" :rate="8" size="sm" />
      </div>
    </section>

    <!-- Countdown Timer -->
    <section class="showcase__section">
      <h2>CountdownTimer</h2>
      <div class="showcase__column" style="max-width: 300px;">
        <CountdownTimer :remaining="5" :total="10" label="Research" />
        <CountdownTimer :remaining="1" :total="3" label="Construction" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.showcase {
  padding: var(--g-space-lg);
  max-width: 1200px;
}

.showcase__title {
  font-family: var(--g-font-mono);
  font-size: 1.5rem;
  color: var(--g-color-text);
  margin-bottom: var(--g-space-xl);
}

.showcase__section {
  margin-bottom: var(--g-space-xl);
}

.showcase__section h2 {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-md);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: var(--g-space-md);
  padding-bottom: var(--g-space-xs);
  border-bottom: 1px solid var(--g-color-border);
}

.showcase__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--g-space-md);
  align-items: flex-start;
}

.showcase__column {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
