<script setup lang="ts">
import { computed } from "vue";
import { Home, CircleOff, Crown } from "lucide-vue-next";
import { ColonistRole, ROLE_DISPLAY_NAMES } from "../../../core/models/Colonist";
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { gameService } from "../../services/GameService";
import { GPanel } from "../../ui";

const state = gameService.getState();

// Build colonist data with all relevant details
const colonistData = computed(() => {
  // Build set of council member IDs
  const councilMemberIds = new Set(state.ideology.council.map((m) => m.colonistId));

  // Build map of colonist ID → assigned building info
  const assignments = new Map<string, { buildingName: string; role: ColonistRole }>();
  for (const building of state.buildings) {
    const def = state.buildingDefinitions.find((d) => d.id === building.definitionId);
    if (!def) continue;
    for (const colonistId of building.assignedWorkers) {
      assignments.set(colonistId, {
        buildingName: def.name,
        role: def.workerRole ?? ColonistRole.UNASSIGNED,
      });
    }
  }

  // Count social connections per colonist
  const connectionCounts = new Map<string, number>();
  for (const [key] of state.coworkerRelationships) {
    const [a, b] = key.split("-");
    connectionCounts.set(a, (connectionCounts.get(a) ?? 0) + 1);
    connectionCounts.set(b, (connectionCounts.get(b) ?? 0) + 1);
  }

  return state.colonists
    .map((c) => {
      const assignment = assignments.get(c.id);
      const moraleData = state.colonistMorale[c.id];
      const connections = connectionCounts.get(c.id) ?? 0;

      // Determine primary faction
      let primaryFaction: NPCFaction | null = null;
      if (c.ideology) {
        const maxAffinity = Math.max(
          c.ideology.earthLoyalist,
          c.ideology.marsIndependence,
          c.ideology.corporateInterests,
        );
        if (maxAffinity >= 0.3) {
          if (c.ideology.earthLoyalist === maxAffinity) primaryFaction = NPCFaction.EarthLoyalists;
          else if (c.ideology.marsIndependence === maxAffinity)
            primaryFaction = NPCFaction.MarsIndependence;
          else primaryFaction = NPCFaction.CorporateInterests;
        }
      }

      return {
        id: c.id,
        name: c.name,
        job: assignment ? assignment.role : ColonistRole.UNASSIGNED,
        jobLabel: assignment ? ROLE_DISPLAY_NAMES[assignment.role] : "Idle",
        workplace: assignment?.buildingName ?? null,
        housed: !!c.housingId,
        centrality: moraleData?.centrality ?? 0,
        connections,
        isCouncilMember: councilMemberIds.has(c.id),
        primaryFaction,
        earthLoyalist: c.ideology?.earthLoyalist ?? 0,
        marsIndependence: c.ideology?.marsIndependence ?? 0,
        corporateInterests: c.ideology?.corporateInterests ?? 0,
        conviction: c.ideology?.conviction ?? 0,
      };
    })
    .sort((a, b) => {
      // Sort by centrality (most influential first)
      return b.centrality - a.centrality;
    });
});

// oxlint-disable-next-line no-unused-vars
function getCentralityColor(centrality: number): string {
  if (centrality >= 0.7) return "var(--color-positive)";
  if (centrality >= 0.4) return "var(--color-info)";
  if (centrality >= 0.2) return "var(--g-color-text)";
  return "var(--color-warning)";
}

// oxlint-disable-next-line no-unused-vars
function getConnectionColor(connections: number): string {
  if (connections >= 5) return "var(--color-positive)";
  if (connections >= 3) return "var(--color-info)";
  if (connections >= 1) return "var(--g-color-text)";
  return "var(--color-danger)";
}
</script>

<template>
  <GPanel title="Colonists" accent="cyan">
    <div class="colonist-table">
      <div class="table-header">
        <span class="col-council" title="Council Member"></span>
        <span class="col-name">Name</span>
        <span class="col-job">Job</span>
        <span class="col-housed">Housing</span>
        <span class="col-connections">Connections</span>
        <span class="col-centrality">Centrality</span>
        <span class="col-faction col-el" title="Earth Loyalists">EL</span>
        <span class="col-faction col-mi" title="Mars Independence">MI</span>
        <span class="col-faction col-ci" title="Corporate Interests">CI</span>
      </div>
      <div v-for="colonist in colonistData" :key="colonist.id" class="colonist-row">
        <span class="col-council">
          <Crown
            v-if="colonist.isCouncilMember"
            :size="12"
            class="icon-council"
            title="Council Member"
          />
        </span>
        <span class="col-name" :title="colonist.name">{{ colonist.name }}</span>
        <span
          class="col-job"
          :title="
            colonist.workplace ? `${colonist.jobLabel} at ${colonist.workplace}` : colonist.jobLabel
          "
          :class="{ idle: colonist.job === 'unassigned' }"
        >
          {{ colonist.jobLabel }}
        </span>
        <span class="col-housed">
          <Home v-if="colonist.housed" :size="12" class="icon-housed" />
          <CircleOff v-else :size="12" class="icon-unhoused" />
        </span>
        <span class="col-connections" :style="{ color: getConnectionColor(colonist.connections) }">
          {{ colonist.connections }}
        </span>
        <span class="col-centrality" :style="{ color: getCentralityColor(colonist.centrality) }">
          {{ (colonist.centrality * 100).toFixed(0) }}
        </span>
        <span
          class="col-faction col-el"
          :class="{ primary: colonist.primaryFaction === 'earth_loyalists' }"
        >
          {{ (colonist.earthLoyalist * 100).toFixed(0) }}
        </span>
        <span
          class="col-faction col-mi"
          :class="{ primary: colonist.primaryFaction === 'mars_independence' }"
        >
          {{ (colonist.marsIndependence * 100).toFixed(0) }}
        </span>
        <span
          class="col-faction col-ci"
          :class="{ primary: colonist.primaryFaction === 'corporate_interests' }"
        >
          {{ (colonist.corporateInterests * 100).toFixed(0) }}
        </span>
      </div>
    </div>
    <p class="table-hint">
      Centrality affects social influence. Connections improve cohesion. Unhoused colonists have
      lower morale.
    </p>
  </GPanel>
</template>

<style scoped>
.colonist-table {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 320px;
  overflow-y: auto;
}

.table-header {
  display: flex;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--g-color-border);
  position: sticky;
  top: 0;
  background: var(--g-color-bg-base);
  z-index: 1;
}

.colonist-row {
  display: flex;
  align-items: center;
  padding: var(--g-space-xs) var(--g-space-sm);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  background: var(--g-color-bg-elevated);
}

.colonist-row:hover {
  background: var(--g-color-bg-surface);
}

.col-council {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-council {
  color: var(--color-warning);
}

.col-name {
  flex: 1;
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-job {
  width: 80px;
  text-align: left;
  color: var(--g-color-text);
}

.col-job.idle {
  color: var(--color-warning);
}

.col-housed {
  width: 60px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-housed {
  color: var(--color-positive);
}

.icon-unhoused {
  color: var(--color-danger);
}

.col-connections {
  width: 85px;
  text-align: center;
}

.col-centrality {
  width: 70px;
  text-align: center;
}

.col-faction {
  width: 36px;
  text-align: center;
  color: var(--g-color-text-muted);
}

.col-faction.primary {
  font-weight: bold;
}

.col-el {
  color: var(--color-info);
}

.col-mi {
  color: var(--color-positive);
}

.col-ci {
  color: var(--color-warning);
}

.table-hint {
  margin-top: var(--g-space-sm);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}
</style>
