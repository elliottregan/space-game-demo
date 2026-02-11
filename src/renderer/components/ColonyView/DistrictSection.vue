<script setup lang="ts">
import { ref } from "vue";
import { DISTRICT_FOUNDING_COST } from "../../../core/balance/DistrictBalance";
import { gameService } from "../../services/GameService";
import { GButton, GEmptyState, GInput, GPanel } from "../../ui";
import DistrictCard from "./DistrictCard.vue";

const state = gameService.getState();

const newDistrictName = ref("");

// oxlint-disable-next-line no-unused-vars
function handleFoundDistrict() {
  const name = newDistrictName.value.trim() || `District ${state.districts.length + 1}`;
  const result = gameService.api.districts.foundDistrict(name);
  if (result.success) {
    newDistrictName.value = "";
  }
}
</script>

<template>
  <GPanel title="Districts">
    <div class="found-controls">
      <GInput
        v-model="newDistrictName"
        :placeholder="`District ${state.districts.length + 1}`"
        size="sm"
        @keyup.enter="handleFoundDistrict"
      />
      <GButton
        size="sm"
        :disabled="!gameService.api.districts.canFoundDistrict().allowed"
        @click="handleFoundDistrict"
      >
        Found District ({{ DISTRICT_FOUNDING_COST }} mat)
      </GButton>
    </div>

    <GEmptyState v-if="state.districts.length === 0" message="No districts founded yet." />

    <div v-else class="district-list">
      <DistrictCard
        v-for="district in state.districts"
        :key="district.id"
        :district="district"
        :current-sol="state.currentSol"
        :buildings="state.buildings"
        :building-definitions="state.buildingDefinitions"
      />
    </div>
  </GPanel>
</template>

<style scoped>
.found-controls {
  display: flex;
  gap: var(--g-space-sm);
  align-items: center;
  margin-bottom: var(--g-space-md);
}

.found-controls .g-input {
  flex: 1;
  max-width: 200px;
}

.district-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
