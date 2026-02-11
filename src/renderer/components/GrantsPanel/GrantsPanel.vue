<script setup lang="ts">
import { computed, ref } from "vue";
import { GRANT_REFRESH_COST } from "../../../core/balance/DistrictGrantBalance";
import { gameService } from "../../services/GameService";
import { GBadge, GButton, GEmptyState, GPanel, GProgress, GSection } from "../../ui";
import GSelect from "../../ui/primitives/GSelect.vue";
import type { SelectOption } from "../../ui/primitives/GSelect.vue";

const state = gameService.getState();

// Per-grant selected district
const selectedDistricts = ref<Record<number, string>>({});

// oxlint-disable-next-line no-unused-vars
const districtOptions = computed((): SelectOption[] => {
  return state.districts.map((d) => ({
    value: d.id,
    label: d.name,
  }));
});

// oxlint-disable-next-line no-unused-vars
function formatCost(cost: { food?: number; water?: number; materials?: number }): string {
  const parts = Object.entries(cost)
    .filter(([, v]) => v && v > 0)
    .map(([k, v]) => `${v} ${k}`);
  return parts.length ? parts.join(", ") : "Free";
}

// oxlint-disable-next-line no-unused-vars
function canAssignAny(grantId: number): boolean {
  if (state.districts.length === 0) return false;
  return state.districts.some(
    (d) => gameService.api.grants.canAssignGrant(grantId, d.id).canAssign,
  );
}

// oxlint-disable-next-line no-unused-vars
function canAssignSelected(grantId: number): boolean {
  const districtId = selectedDistricts.value[grantId];
  if (!districtId) return false;
  return gameService.api.grants.canAssignGrant(grantId, districtId).canAssign;
}

// oxlint-disable-next-line no-unused-vars
function handleAssign(grantId: number): void {
  const districtId = selectedDistricts.value[grantId];
  if (!districtId) return;
  gameService.api.grants.assignGrant(grantId, districtId);
  delete selectedDistricts.value[grantId];
}

// oxlint-disable-next-line no-unused-vars
function handleRefresh(): void {
  gameService.api.grants.refreshPanel();
}

// oxlint-disable-next-line no-unused-vars
const canRefresh = computed(() => {
  return state.resources.materials >= GRANT_REFRESH_COST;
});

// Active grants grouped by district
// oxlint-disable-next-line no-unused-vars
const activeByDistrict = computed(() => {
  const groups: Record<string, typeof state.grants.active> = {};
  for (const grant of state.grants.active) {
    if (!groups[grant.districtId]) groups[grant.districtId] = [];
    groups[grant.districtId].push(grant);
  }
  return groups;
});

// oxlint-disable-next-line no-unused-vars
function districtName(districtId: string): string {
  return state.districts.find((d) => d.id === districtId)?.name ?? districtId;
}

// oxlint-disable-next-line no-unused-vars
function grantProgress(grant: (typeof state.grants.active)[number]): number {
  if (!grant.totalDuration || grant.totalDuration === 0) return 100;
  return Math.round(((grant.totalDuration - grant.remainingSols) / grant.totalDuration) * 100);
}
</script>

<template>
  <GPanel title="District Grants" accent="slate">
    <GSection title="Available Grants" variant="muted">
      <GEmptyState
        v-if="state.grants.available.length === 0"
        message="No grants available. Wait for the next refresh or spend materials to refresh now."
      />
      <div v-else class="grants-list">
        <div
          v-for="grant in state.grants.available"
          :key="grant.id"
          class="grant-card"
          :class="{ 'grant-disabled': !canAssignAny(grant.id) }"
        >
          <div class="grant-header">
            <span class="grant-name">{{ grant.name }}</span>
            <div class="grant-badges">
              <GBadge :variant="grant.category === 'identity' ? 'warning' : 'info'" size="sm">
                {{ grant.category === "identity" ? "Identity" : "Infrastructure" }}
              </GBadge>
              <GBadge v-if="grant.isCapstone" variant="positive" size="sm"> Capstone </GBadge>
            </div>
          </div>
          <p v-if="grant.sourceName" class="grant-source">{{ grant.sourceName }}</p>
          <p class="grant-description">{{ grant.description }}</p>
          <div class="grant-meta">
            <span class="grant-cost">Cost: {{ formatCost(grant.cost) }}</span>
            <span class="grant-duration">{{ grant.baseDuration }} sols</span>
          </div>
          <div class="grant-actions">
            <GSelect
              size="sm"
              :options="districtOptions"
              :model-value="selectedDistricts[grant.id]"
              placeholder="Select district..."
              :disabled="!canAssignAny(grant.id)"
              @update:model-value="selectedDistricts[grant.id] = String($event)"
            />
            <GButton
              size="sm"
              :disabled="!canAssignSelected(grant.id)"
              @click="handleAssign(grant.id)"
            >
              Assign
            </GButton>
          </div>
        </div>
      </div>
    </GSection>

    <GSection v-if="state.grants.active.length > 0" title="Active Grants" variant="muted">
      <div
        v-for="(grants, districtId) in activeByDistrict"
        :key="districtId"
        class="district-group"
      >
        <div class="district-group-header">{{ districtName(String(districtId)) }}</div>
        <div v-for="grant in grants" :key="grant.id" class="active-grant">
          <div class="active-grant-header">
            <span class="active-grant-name">{{ grant.name }}</span>
            <span class="active-grant-remaining">{{ grant.remainingSols }} sols left</span>
          </div>
          <GProgress
            :percent="grantProgress(grant)"
            variant="positive"
            show-label
            :label="`${grantProgress(grant)}%`"
          />
        </div>
      </div>
    </GSection>

    <template #footer>
      <div class="grants-footer">
        <GButton size="sm" :disabled="!canRefresh" @click="handleRefresh">
          Refresh ({{ GRANT_REFRESH_COST }} MAT)
        </GButton>
      </div>
    </template>
  </GPanel>
</template>

<style scoped>
.grants-list {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
}

.grant-card {
  padding: var(--g-space-sm);
  background: var(--g-color-bg-elevated);
  border-left: 3px solid var(--g-color-border);
}

.grant-card.grant-disabled {
  opacity: 0.5;
}

.grant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--g-space-sm);
  margin-bottom: var(--g-space-xs);
}

.grant-badges {
  display: flex;
  gap: var(--g-space-xs);
}

.grant-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  color: var(--g-color-text);
}

.grant-source {
  margin: 0 0 var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  font-style: italic;
}

.grant-description {
  margin: 0 0 var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.grant-meta {
  display: flex;
  justify-content: space-between;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-bottom: var(--g-space-sm);
}

.grant-cost {
  color: var(--g-color-text-muted);
}

.grant-duration {
  color: var(--g-color-text-muted);
}

.grant-actions {
  display: flex;
  gap: var(--g-space-sm);
  align-items: center;
}

.district-group {
  margin-bottom: var(--g-space-md);
}

.district-group-header {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  color: var(--g-color-text);
  margin-bottom: var(--g-space-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.active-grant {
  padding: var(--g-space-xs) 0;
}

.active-grant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--g-space-xs);
}

.active-grant-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text);
}

.active-grant-remaining {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
}

.grants-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
