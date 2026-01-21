<!-- src/renderer/components/NPCInfluencePanel.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { gameService } from '../services/GameService';

const state = gameService.getState();

const selectedProject = ref<string | null>(null);
const selectedNPCForLobby = ref<string | null>(null);
const lobbyAmount = ref(0.3);
const councilName = ref('');
const selectedCouncilMembers = ref<string[]>([]);

function canAfford(cost: Record<string, number>): boolean {
  for (const [key, value] of Object.entries(cost)) {
    const available = state.resources[key as keyof typeof state.resources] ?? 0;
    if (available < value) return false;
  }
  return true;
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canProposeProject = computed(() => {
  if (!selectedProject.value || state.npcInfluence.activeProject) return false;
  const project = state.npcInfluence.projects.find(p => p.id === selectedProject.value);
  if (!project) return false;
  return canAfford(project.proposalCost);
});

const lobbyCost = computed(() => {
  if (!selectedNPCForLobby.value) return 0;
  return gameService.getLobbyCost(selectedNPCForLobby.value, lobbyAmount.value);
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canLobby = computed(() => {
  if (!state.npcInfluence.activeProject || !selectedNPCForLobby.value) return false;
  return state.resources.materials >= lobbyCost.value;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
const canCreateCouncil = computed(() => {
  return selectedCouncilMembers.value.length >= 2 &&
         councilName.value.trim() !== '' &&
         state.resources.materials >= 50;
});

// biome-ignore lint/correctness/noUnusedVariables: used in template
function proposeProject() {
  if (selectedProject.value) {
    gameService.proposeProject(selectedProject.value);
    selectedProject.value = null;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function lobbyNPC() {
  if (selectedNPCForLobby.value) {
    gameService.lobbyNPC(selectedNPCForLobby.value, lobbyAmount.value);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function createCouncil() {
  if (councilName.value && selectedCouncilMembers.value.length >= 2) {
    gameService.createCouncil(councilName.value, selectedCouncilMembers.value);
    councilName.value = '';
    selectedCouncilMembers.value = [];
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function toggleCouncilMember(npcId: string) {
  const idx = selectedCouncilMembers.value.indexOf(npcId);
  if (idx === -1) {
    selectedCouncilMembers.value.push(npcId);
  } else {
    selectedCouncilMembers.value.splice(idx, 1);
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getFactionColor(faction: string): string {
  switch (faction) {
    case 'futurist': return 'var(--color-info)';
    case 'progressive': return 'var(--color-positive)';
    case 'traditionalist': return 'var(--color-warning)';
    default: return 'var(--color-muted)';
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function getSupportColor(support: number): string {
  if (support > 0.3) return 'var(--color-positive)';
  if (support < -0.3) return 'var(--color-danger)';
  return 'var(--color-muted)';
}

// biome-ignore lint/correctness/noUnusedVariables: used in template
function formatSupport(support: number): string {
  const pct = (support * 100).toFixed(0);
  return support >= 0 ? `+${pct}%` : `${pct}%`;
}
</script>

<template>
  <div class="npc-influence-panel">
    <h2>Council Politics</h2>

    <!-- Active Project Status -->
    <section v-if="state.npcInfluence.activeProject" class="active-project">
      <h3>Active Proposal</h3>
      <div class="project-status">
        <strong>{{ state.npcInfluence.projects.find(p => p.id === state.npcInfluence.activeProject?.projectId)?.name }}</strong>
        <div class="status-row">
          <span>Average Support:
            <span :style="{ color: getSupportColor(state.npcInfluence.activeProject.averageSupport) }">
              {{ formatSupport(state.npcInfluence.activeProject.averageSupport) }}
            </span>
          </span>
          <span>Sols until vote: {{ state.npcInfluence.activeProject.solsRemaining }}</span>
        </div>
        <div class="threshold-bar">
          <div
            class="threshold-fill"
            :style="{
              width: `${Math.max(0, (state.npcInfluence.activeProject.averageSupport + 1) / 2 * 100)}%`,
              backgroundColor: getSupportColor(state.npcInfluence.activeProject.averageSupport)
            }"
          ></div>
          <div class="threshold-marker" style="left: 70%"></div>
        </div>
        <small>Need 40% average support to pass</small>
      </div>

      <!-- NPC Support List -->
      <h4>Council Members</h4>
      <div class="npc-list">
        <div
          v-for="npc in state.npcInfluence.npcs"
          :key="npc.id"
          class="npc-row"
          :class="{ selected: selectedNPCForLobby === npc.id }"
          @click="selectedNPCForLobby = npc.id"
        >
          <span class="npc-name">{{ npc.name }}</span>
          <span class="faction-badge" :style="{ backgroundColor: getFactionColor(npc.faction) }">
            {{ npc.faction }}
          </span>
          <span class="support-value" :style="{ color: getSupportColor(state.npcInfluence.activeProject.supportLevels[npc.id] || 0) }">
            {{ formatSupport(state.npcInfluence.activeProject.supportLevels[npc.id] || 0) }}
          </span>
        </div>
      </div>

      <!-- Lobbying Controls -->
      <div v-if="selectedNPCForLobby" class="lobby-controls">
        <h4>Lobby {{ state.npcInfluence.npcs.find(n => n.id === selectedNPCForLobby)?.name }}</h4>
        <div class="lobby-row">
          <label>
            Boost:
            <select v-model.number="lobbyAmount">
              <option :value="0.1">+10%</option>
              <option :value="0.2">+20%</option>
              <option :value="0.3">+30%</option>
              <option :value="0.5">+50%</option>
            </select>
          </label>
          <span>Cost: {{ lobbyCost }} materials</span>
          <button @click="lobbyNPC" :disabled="!canLobby">Lobby</button>
        </div>
      </div>
    </section>

    <!-- Propose New Project -->
    <section v-else class="propose-project">
      <h3>Propose a Project</h3>
      <div class="project-list">
        <div
          v-for="project in state.npcInfluence.projects"
          :key="project.id"
          class="project-option"
          :class="{ selected: selectedProject === project.id }"
          @click="selectedProject = project.id"
        >
          <strong>{{ project.name }}</strong>
          <span class="faction-badge" :style="{ backgroundColor: getFactionColor(project.type) }">
            {{ project.type }}
          </span>
          <p>{{ project.description }}</p>
          <small>Cost: {{ Object.entries(project.proposalCost).map(([k,v]) => `${v} ${k}`).join(', ') }}</small>
        </div>
      </div>
      <button @click="proposeProject" :disabled="!canProposeProject">
        Propose Selected Project
      </button>
    </section>

    <!-- Councils -->
    <section class="councils">
      <h3>Councils</h3>
      <div v-if="state.npcInfluence.councils.length === 0" class="empty-state">
        No councils formed yet.
      </div>
      <div v-else class="council-list">
        <div v-for="council in state.npcInfluence.councils" :key="council.id" class="council-item">
          <strong>{{ council.name }}</strong>
          <span>{{ council.memberIds.length }} members</span>
        </div>
      </div>

      <h4>Form New Council</h4>
      <input v-model="councilName" placeholder="Council name" />
      <div class="council-member-select">
        <div
          v-for="npc in state.npcInfluence.npcs"
          :key="npc.id"
          class="council-member-option"
          :class="{ selected: selectedCouncilMembers.includes(npc.id) }"
          @click="toggleCouncilMember(npc.id)"
        >
          {{ npc.name }}
        </div>
      </div>
      <button @click="createCouncil" :disabled="!canCreateCouncil">
        Create Council (50 materials)
      </button>
    </section>
  </div>
</template>

<style scoped>
.npc-influence-panel {
  padding: 1rem;
}

h2, h3, h4 {
  margin-top: 1rem;
  margin-bottom: 0.5rem;
}

.active-project, .propose-project, .councils {
  margin-bottom: 1.5rem;
  padding: 1rem;
  border: 1px solid var(--color-muted);
  border-radius: 4px;
}

.status-row {
  display: flex;
  justify-content: space-between;
  margin: 0.5rem 0;
}

.threshold-bar {
  position: relative;
  height: 20px;
  background: #333;
  border-radius: 4px;
  overflow: hidden;
}

.threshold-fill {
  height: 100%;
  transition: width 0.3s;
}

.threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: white;
}

.npc-list, .project-list, .council-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.npc-row, .project-option, .council-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border: 1px solid var(--color-muted);
  border-radius: 4px;
  cursor: pointer;
}

.npc-row:hover, .project-option:hover {
  background: rgba(255,255,255,0.05);
}

.npc-row.selected, .project-option.selected {
  border-color: var(--color-info);
}

.npc-name {
  flex: 1;
}

.faction-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.support-value {
  font-weight: bold;
  min-width: 50px;
  text-align: right;
}

.lobby-controls, .councils {
  margin-top: 1rem;
}

.lobby-row {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.council-member-select {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.council-member-option {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-muted);
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.875rem;
}

.council-member-option.selected {
  border-color: var(--color-positive);
  background: rgba(0,255,0,0.1);
}

.project-option p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: var(--color-muted);
}

button {
  margin-top: 0.5rem;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-state {
  color: var(--color-muted);
  font-style: italic;
}

input {
  padding: 0.5rem;
  margin: 0.5rem 0;
  width: 100%;
  box-sizing: border-box;
}
</style>
