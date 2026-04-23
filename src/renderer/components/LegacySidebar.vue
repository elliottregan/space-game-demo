<template>
  <aside class="sidebar">
    <section class="section">
      <h2>Terrain (persisted)</h2>
      <div style="display: flex; justify-content: space-between; font-size: 11px">
        <span>axis1 (Sol↔Sov)</span>
        <span style="color: var(--accent)">{{ fmt(terrain.axis1) }}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px">
        <span>axis2 (Her↔Trn)</span>
        <span style="color: var(--accent)">{{ fmt(terrain.axis2) }}</span>
      </div>
    </section>

    <section class="section">
      <h2>Monuments ({{ activeMonuments.length }})</h2>
      <div v-if="monuments.length === 0" style="color: var(--fg-muted); font-size: 11px">
        None yet.
      </div>
      <div v-for="m in monuments" :key="m.id" :class="['monument-item', { echo: !m.active }]">
        <span>{{ m.projectName }}</span>
        <span>
          E{{ m.mintedOnEpoch }}
          <span :class="['tier-badge', 'tier-' + m.tier]">{{ m.tier }}</span>
        </span>
      </div>
    </section>

    <section class="section">
      <h2>Legacy Cards ({{ legacyCards.length }})</h2>
      <div v-if="legacyCards.length === 0" style="color: var(--fg-muted); font-size: 11px">
        None yet.
      </div>
      <div v-for="l in legacyCards" :key="l.id" class="legacy-item">
        <div>{{ l.baseCard.name }}</div>
        <div style="font-size: 10px; color: var(--fg-muted)">
          E{{ l.mintedOnEpoch }} · {{ l.upgradePath }} · {{ l.mintedFrom }}
        </div>
      </div>
    </section>

    <section class="section">
      <h2>Tasks (this Epoch)</h2>
      <div
        v-for="task in tasks"
        :key="task.id"
        :class="['task-item', { completed: task.completed }]"
      >
        <span>{{ task.name }}</span>
        <span>{{ task.completed ? "✓" : "·" }}</span>
      </div>
    </section>

    <section class="section">
      <h2>Deck</h2>
      <div class="deck-counts">
        <span>Hand</span><span>{{ counts.hand }}</span> <span>Draw</span
        ><span>{{ counts.draw }}</span> <span>Discard</span><span>{{ counts.discard }}</span>
        <span :class="{ danger: isDissentDanger }">Dissent</span>
        <span :class="{ danger: isDissentDanger }">{{ counts.dissent }} / {{ totalDeck }}</span>
      </div>
    </section>

    <section class="section">
      <h2>Event Log</h2>
      <div class="event-log">
        <div v-for="(e, i) in recentEvents" :key="i" :class="['event-entry', e.kind ?? '']">
          <span style="color: var(--fg-muted)">T{{ e.turn }}</span> {{ e.text }}
        </div>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { IdeologyTerrain, Monument, LegacyCard, EventEntry } from "../../core/types.ts";

const props = defineProps<{
  terrain: IdeologyTerrain;
  monuments: Monument[];
  legacyCards: LegacyCard[];
  tasks: { id: string; name: string; completed: boolean }[];
  counts: { hand: number; draw: number; discard: number; dissent: number };
  events: EventEntry[];
  dissentThreshold: number;
}>();

function fmt(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

const activeMonuments = computed(() => props.monuments.filter((m) => m.active));
const totalDeck = computed(() => props.counts.hand + props.counts.draw + props.counts.discard);
const isDissentDanger = computed(() => {
  const total = totalDeck.value;
  if (total === 0) return false;
  return props.counts.dissent / total > props.dissentThreshold * 0.8;
});

const recentEvents = computed(() => props.events.slice(-60));
</script>
