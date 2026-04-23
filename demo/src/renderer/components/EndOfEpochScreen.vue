<template>
  <div class="eoe-overlay">
    <div class="eoe-panel">
      <h2>{{ title }}</h2>
      <div class="eoe-subtitle">
        <template v-if="state.outcome === 'win'">
          <div>Completed on turn {{ turn }}.</div>
          <div v-if="state.monument">
            Monument minted: <strong>{{ state.monument.projectName }}</strong>
            <span :class="['tier-badge', 'tier-' + state.monument.tier]">{{
              state.monument.tier
            }}</span>
          </div>
          <div>
            Next Setting: <strong>{{ nextSettingDisplay }}</strong>
          </div>
        </template>
        <template v-else>
          <div>Loss mode: {{ lossModeLabel }}.</div>
          <div>
            Next Setting: <strong>{{ nextSettingDisplay }}</strong>
          </div>
        </template>
      </div>

      <p style="margin-bottom: 8px; font-size: 12px; color: var(--fg-dim)">
        Pick an upgrade path for each Legacy Card:
      </p>

      <div v-for="cand in state.candidates" :key="cand.id" class="legacy-choice">
        <div class="legacy-choice-header">
          <div>
            <h3>{{ cand.baseCard.name }}</h3>
            <div style="font-size: 10px; color: var(--fg-dim)">
              {{ describeEffect(cand.baseCard.effect) }}
            </div>
          </div>
          <span class="legacy-choice-source">{{ cand.source }}</span>
        </div>
        <div class="upgrade-options">
          <button
            v-for="opt in cand.suggestedUpgrades"
            :key="opt"
            :class="['upgrade-option', { selected: choices[cand.id] === opt }]"
            @click="choices[cand.id] = opt"
          >
            <div class="upgrade-name">{{ opt }}</div>
            <div class="upgrade-desc">{{ upgradeDescription(opt) }}</div>
          </button>
        </div>
      </div>

      <div v-if="state.candidates.length === 0" style="color: var(--fg-dim); font-size: 12px">
        No Legacy Cards minted.
      </div>

      <div class="eoe-actions">
        <button class="primary" :disabled="!allChosen" @click="$emit('advance', choices)">
          <template v-if="state.nextSettingId === 'campaign-end'">End Campaign</template>
          <template v-else>Continue to next Epoch →</template>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import type { EndOfEpochState } from "../../core/campaign.ts";

const props = defineProps<{
  state: EndOfEpochState;
  turn: number;
  nextSettingName: string;
}>();

defineEmits<{
  advance: [choices: Record<string, "potency" | "pliability" | "persistence">];
}>();

const choices = reactive<Record<string, "potency" | "pliability" | "persistence">>({});

// Default every candidate to its first suggested upgrade.
for (const c of props.state.candidates) {
  choices[c.id] = c.suggestedUpgrades[0] ?? "potency";
}

const allChosen = computed(() => props.state.candidates.every((c) => choices[c.id] !== undefined));

const title = computed(() => (props.state.outcome === "win" ? "Epoch Complete" : "Epoch Lost"));

const lossModeLabel = computed(() => {
  return "see event log";
});

const nextSettingDisplay = computed(() =>
  props.state.nextSettingId === "campaign-end" ? "Campaign ends" : props.nextSettingName,
);

function upgradeDescription(opt: "potency" | "pliability" | "persistence"): string {
  switch (opt) {
    case "potency":
      return "Primary effect +1";
    case "pliability":
      return "Influence cost −1";
    case "persistence":
      return "Passive: +1 Mat. when top";
  }
}

function describeEffect(effect: any): string {
  switch (effect.kind) {
    case "noop":
      return "—";
    case "gainInfluence":
      return `+${effect.amount} Influence`;
    case "gainMaterials":
      return `+${effect.amount} Materials`;
    case "draw":
      return `Draw ${effect.count}`;
    case "removeDissent":
      return `Purge ${effect.amount} Dissent`;
    case "shiftIdeology":
      return `Shift ${effect.axis} ${effect.amount > 0 ? "+" : ""}${effect.amount}`;
    case "compound":
      return effect.effects.map(describeEffect).join(", ");
    default:
      return "";
  }
}
</script>
