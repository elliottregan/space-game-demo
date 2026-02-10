<script setup lang="ts">
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";
import DistrictCard from "./DistrictCard.vue";

const state = gameService.getState();
</script>

<template>
  <GPanel title="Districts">
    <div class="district-list">
      <DistrictCard
        v-for="district in state.districts"
        :key="district.id"
        :district="district"
        :buildings="state.buildings"
        :building-definitions="state.buildingDefinitions"
      />
    </div>
  </GPanel>
</template>

<style scoped>
.district-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-md);
}
</style>
