# Debug Views

## Purpose

Development tools and visualizations to aid in balancing, testing, and debugging the game.

## Location

`src/renderer/components/debug/`

## Debug Components

### 1. Debug Panel (Main Container)

```vue
<!-- src/renderer/components/debug/DebugPanel.vue -->
<template>
  <div v-if="debugEnabled" class="debug-panel">
    <div class="debug-tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab"
        :class="{ active: activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>
    
    <ResourceDebugView v-if="activeTab === 'Resources'" />
    <PopulationDebugView v-if="activeTab === 'Population'" />
    <PoliticsDebugView v-if="activeTab === 'Politics'" />
    <BalanceDebugView v-if="activeTab === 'Balance'" />
    <SimulatorView v-if="activeTab === 'Simulator'" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const debugEnabled = ref(true); // Toggle with 'D' key
const activeTab = ref('Resources');
const tabs = ['Resources', 'Population', 'Politics', 'Balance', 'Simulator'];
</script>
```

### 2. Resource Debug View

Shows resource flow rates and projections.

```vue
<!-- src/renderer/components/debug/ResourceDebugView.vue -->
<template>
  <div class="resource-debug">
    <h3>Resource Flow Analysis</h3>
    
    <table>
      <thead>
        <tr>
          <th>Resource</th>
          <th>Current</th>
          <th>Production</th>
          <th>Consumption</th>
          <th>Net</th>
          <th>Depletion</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(value, key) in resources" :key="key">
          <td>{{ key }}</td>
          <td :class="getStatusClass(value)">{{ value.toFixed(1) }}</td>
          <td class="positive">+{{ production[key]?.toFixed(1) || 0 }}</td>
          <td class="negative">-{{ consumption[key]?.toFixed(1) || 0 }}</td>
          <td :class="netFlow[key] >= 0 ? 'positive' : 'negative'">
            {{ netFlow[key]?.toFixed(1) || 0 }}
          </td>
          <td>
            <span v-if="netFlow[key] < 0">
              {{ calculateDepletionTime(value, netFlow[key]) }} sols
            </span>
            <span v-else class="safe">Stable</span>
          </td>
        </tr>
      </tbody>
    </table>
    
    <div class="projections">
      <h4>30 Sol Projection</h4>
      <ResourceChart :data="projectionData" />
    </div>
    
    <div class="actions">
      <button @click="addResource('food', 100)">+100 Food</button>
      <button @click="addResource('power', 100)">+100 Power</button>
      <button @click="addResource('materials', 100)">+100 Materials</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { gameService } from '@/services/GameService';

const state = gameService.getState();

const resources = computed(() => state.resources);
const production = computed(() => gameService.getProduction());
const consumption = computed(() => gameService.getConsumption());
const netFlow = computed(() => gameService.getNetFlow());

function calculateDepletionTime(current: number, netPerSol: number): number {
  if (netPerSol >= 0) return Infinity;
  return Math.abs(current / netPerSol);
}

function getStatusClass(value: number): string {
  if (value === 0) return 'critical';
  if (value < 20) return 'warning';
  return 'normal';
}

function addResource(type: string, amount: number): void {
  gameService.debugAddResource(type, amount);
}

const projectionData = computed(() => {
  // Calculate 30-sol projection
  const projection = [];
  let current = { ...resources.value };
  
  for (let i = 0; i <= 30; i++) {
    projection.push({
      sol: state.currentSol + i,
      ...current
    });
    
    // Apply net flow
    for (const key in current) {
      current[key] += netFlow.value[key] || 0;
      current[key] = Math.max(0, current[key]);
    }
  }
  
  return projection;
});
</script>
```

### 3. Population Debug View

Visualize colonist roles, experience, and workforce balance.

```vue
<!-- src/renderer/components/debug/PopulationDebugView.vue -->
<template>
  <div class="population-debug">
    <h3>Workforce Overview</h3>
    
    <div class="role-distribution">
      <h4>Role Distribution</h4>
      <div v-for="(count, role) in roleDistribution" :key="role" class="role-bar">
        <span class="role-name">{{ role }}</span>
        <div class="bar">
          <div class="fill" :style="{ width: `${(count / totalColonists) * 100}%` }"></div>
        </div>
        <span class="count">{{ count }}</span>
      </div>
    </div>
    
    <div class="mastery-breakdown">
      <h4>Mastery Levels</h4>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Novice</th>
            <th>Skilled</th>
            <th>Expert</th>
            <th>Master</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(levels, role) in masteryByRole" :key="role">
            <td>{{ role }}</td>
            <td>{{ levels[0] }}</td>
            <td>{{ levels[1] }}</td>
            <td>{{ levels[2] }}</td>
            <td>{{ levels[3] }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <div class="workforce-status">
      <h4>Open Positions: {{ unfilledSlots.length }}</h4>
      <ul>
        <li v-for="slot in unfilledSlots" :key="slot.id">
          {{ slot.role }} - {{ slot.buildingName }} 
          <span v-if="slot.required" class="required">(Required)</span>
        </li>
      </ul>
    </div>
    
    <div class="actions">
      <button @click="spawnColonist()">Spawn Colonist</button>
      <button @click="trainAllUnassigned('farming')">Train All as Farmers</button>
      <button @click="grantMastery()">Grant Random Mastery</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { gameService } from '@/services/GameService';

const state = gameService.getState();

const colonists = computed(() => state.colonists);
const totalColonists = computed(() => colonists.value.length);

const roleDistribution = computed(() => {
  const dist: Record<string, number> = {};
  colonists.value.forEach(c => {
    dist[c.currentRole] = (dist[c.currentRole] || 0) + 1;
  });
  return dist;
});

const masteryByRole = computed(() => {
  const breakdown: Record<string, number[]> = {};
  
  colonists.value.forEach(c => {
    if (!breakdown[c.currentRole]) {
      breakdown[c.currentRole] = [0, 0, 0, 0];
    }
    breakdown[c.currentRole][c.masteryLevel]++;
  });
  
  return breakdown;
});

const unfilledSlots = computed(() => gameService.getUnfilledSlots());

function spawnColonist(): void {
  gameService.debugSpawnColonist();
}

function trainAllUnassigned(role: string): void {
  gameService.debugTrainAllUnassigned(role);
}

function grantMastery(): void {
  gameService.debugGrantRandomMastery();
}
</script>
```

### 4. Balance Debug View

Compare actual progression against targets.

```vue
<!-- src/renderer/components/debug/BalanceDebugView.vue -->
<template>
  <div class="balance-debug">
    <h3>Progression Analysis</h3>
    
    <div class="current-state">
      <p><strong>Current Sol:</strong> {{ currentSol }}</p>
      <p><strong>Population:</strong> {{ population }}</p>
      <p><strong>Buildings:</strong> {{ buildingCount }}</p>
      <p><strong>Techs Researched:</strong> {{ techCount }}</p>
    </div>
    
    <div class="target-comparison">
      <h4>Compared to Target (Sol {{ closestTarget }})</h4>
      <div :class="['metric', getMetricStatus('population')]">
        <span>Population:</span>
        <span>{{ population }} / {{ targetRange.population }}</span>
      </div>
      <div :class="['metric', getMetricStatus('buildings')]">
        <span>Buildings:</span>
        <span>{{ buildingCount }} / {{ targetRange.buildings }}</span>
      </div>
      <div :class="['metric', getMetricStatus('techs')]">
        <span>Technologies:</span>
        <span>{{ techCount }} / {{ targetRange.techs }}</span>
      </div>
    </div>
    
    <div class="recommendations">
      <h4>Balance Recommendations</h4>
      <ul>
        <li v-for="rec in recommendations" :key="rec">{{ rec }}</li>
      </ul>
    </div>
    
    <div class="actions">
      <button @click="jumpToSol(50)">Jump to Sol 50</button>
      <button @click="jumpToSol(100)">Jump to Sol 100</button>
      <button @click="jumpToSol(200)">Jump to Sol 200</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { gameService } from '@/services/GameService';
import { PROGRESSION_TARGETS } from '@/core/balance/ProgressionTargets';

const state = gameService.getState();

const currentSol = computed(() => state.currentSol);
const population = computed(() => state.population);
const buildingCount = computed(() => state.buildings.length);
const techCount = computed(() => state.techsResearched);

const closestTarget = computed(() => {
  const targets = [50, 100, 200, 400];
  return targets.reduce((prev, curr) => 
    Math.abs(curr - currentSol.value) < Math.abs(prev - currentSol.value) ? curr : prev
  );
});

const targetRange = computed(() => {
  const target = PROGRESSION_TARGETS[`sol_${closestTarget.value}`];
  return {
    population: `${target.population.min}-${target.population.max}`,
    buildings: `${target.buildings.min}-${target.buildings.max}`,
    techs: `${target.techs.min}-${target.techs.max}`
  };
});

function getMetricStatus(metric: string): string {
  const target = PROGRESSION_TARGETS[`sol_${closestTarget.value}`];
  const value = metric === 'population' ? population.value 
    : metric === 'buildings' ? buildingCount.value 
    : techCount.value;
  
  const range = target[metric];
  
  if (value < range.min) return 'below';
  if (value > range.max) return 'above';
  return 'on-track';
}

const recommendations = computed(() => {
  const recs: string[] = [];
  
  if (getMetricStatus('population') === 'below') {
    recs.push('Population growth is slow - check food/housing');
  }
  if (getMetricStatus('buildings') === 'below') {
    recs.push('Building construction is behind - check materials/workforce');
  }
  if (getMetricStatus('techs') === 'below') {
    recs.push('Research is slow - build more research labs or assign scientists');
  }
  
  return recs.length > 0 ? recs : ['Progression is on track!'];
});

function jumpToSol(target: number): void {
  gameService.debugJumpToSol(target);
}
</script>
```

### 5. Simulator View

Run automated playthroughs to test balance.

```vue
<!-- src/renderer/components/debug/SimulatorView.vue -->
<template>
  <div class="simulator-debug">
    <h3>Balance Simulator</h3>
    
    <div class="controls">
      <label>
        Strategy:
        <select v-model="selectedStrategy">
          <option value="greedy">Greedy (Build when possible)</option>
          <option value="balanced">Balanced (Equal focus)</option>
          <option value="research">Research-focused</option>
        </select>
      </label>
      
      <label>
        Iterations:
        <input v-model.number="iterations" type="number" min="1" max="100" />
      </label>
      
      <button @click="runSimulation" :disabled="running">
        {{ running ? 'Running...' : 'Run Simulation' }}
      </button>
    </div>
    
    <div v-if="results" class="results">
      <h4>Results ({{ iterations }} runs)</h4>
      <p><strong>Win Rate:</strong> {{ (results.winRate * 100).toFixed(1) }}%</p>
      <p><strong>Avg Victory Sol:</strong> {{ results.avgVictorySol.toFixed(0) }}</p>
      <p><strong>Avg Defeat Sol:</strong> {{ results.avgDefeatSol.toFixed(0) }}</p>
      <p><strong>Common Defeat:</strong> {{ results.commonDefeat }}</p>
      
      <div class="recommendations">
        <h5>Recommendations:</h5>
        <ul>
          <li v-for="rec in results.recommendations" :key="rec">{{ rec }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BalanceSimulator, GreedyAI } from '@/core/balance/Simulator';

const selectedStrategy = ref('greedy');
const iterations = ref(10);
const running = ref(false);
const results = ref(null);

async function runSimulation(): Promise<void> {
  running.value = true;
  
  // Run in background to avoid blocking UI
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const strategy = new GreedyAI(); // Could select based on selectedStrategy
  results.value = BalanceSimulator.runBatch(strategy, iterations.value);
  
  running.value = false;
}
</script>
```

## Debug Keyboard Shortcuts

Implement these in the main App component:

```typescript
// src/renderer/App.vue

import { onMounted, onUnmounted } from 'vue';

onMounted(() => {
  window.addEventListener('keydown', handleDebugKeys);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleDebugKeys);
});

function handleDebugKeys(e: KeyboardEvent): void {
  // Toggle debug panel
  if (e.key === 'd' && e.ctrlKey) {
    e.preventDefault();
    toggleDebugPanel();
  }
  
  // Fast forward
  if (e.key === 'f' && e.ctrlKey) {
    e.preventDefault();
    gameService.debugFastForward(10); // Advance 10 sols
  }
  
  // Add resources
  if (e.key === 'r' && e.ctrlKey) {
    e.preventDefault();
    gameService.debugAddAllResources(100);
  }
  
  // Complete current research
  if (e.key === 't' && e.ctrlKey) {
    e.preventDefault();
    gameService.debugCompleteResearch();
  }
}
```

## Debug Service Methods

Add these to GameService:

```typescript
// src/renderer/services/GameService.ts

class GameService {
  // ... existing methods
  
  debugAddResource(type: string, amount: number): void {
    const delta = { [type]: amount };
    this.gameState.resources.addProduction(delta);
  }
  
  debugSpawnColonist(): void {
    this.gameState.colony.spawnColonist();
    this.syncState();
  }
  
  debugJumpToSol(targetSol: number): void {
    while (this.gameState.currentSol < targetSol) {
      this.gameState.tick();
    }
    this.syncState();
  }
  
  debugFastForward(sols: number): void {
    for (let i = 0; i < sols; i++) {
      this.gameState.tick();
    }
    this.syncState();
  }
  
  debugCompleteResearch(): void {
    const current = this.gameState.technology.getCurrentResearch();
    if (current) {
      current.progress = current.requiredSols;
      this.gameState.technology.tick(this.gameState);
      this.syncState();
    }
  }
  
  debugAddAllResources(amount: number): void {
    this.gameState.resources.addProduction({
      food: amount,
      oxygen: amount,
      water: amount,
      power: amount,
      materials: amount
    });
  }
}
```

## Notes

- Debug panel should be hidden in production builds
- Keyboard shortcuts use Ctrl+Key to avoid conflicts
- Simulator helps validate balance without manual playtesting
- Resource projections help identify bottlenecks early
- All debug actions should be clearly labeled as cheats
