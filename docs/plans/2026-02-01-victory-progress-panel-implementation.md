# Victory Progress Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Victory Progress Panel to the Politics tab showing progress toward each faction's victory path with projects, council seats, and actionable next steps.

**Architecture:** Single new Vue component (`VictoryProgressPanel.vue`) with a child `FactionTrack.vue` for each faction. All data comes from existing `gameService.getState().ideology` and static `PROJECTS` data. No core logic changes needed.

**Tech Stack:** Vue 3, TypeScript, existing GPanel/GBadge UI components

---

## Task 1: Create FactionTrack Component

**Files:**
- Create: `src/renderer/components/VictoryProgressPanel/FactionTrack.vue`
- Create: `src/renderer/components/VictoryProgressPanel/index.ts`

**Step 1: Create the index barrel file**

```typescript
// src/renderer/components/VictoryProgressPanel/index.ts
export { default as VictoryProgressPanel } from "./VictoryProgressPanel.vue";
export { default as FactionTrack } from "./FactionTrack.vue";
```

**Step 2: Create FactionTrack component with props and basic structure**

```vue
<!-- src/renderer/components/VictoryProgressPanel/FactionTrack.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { NPCFaction, ProjectId } from "../../../core/models/NPCInfluence";
import { PROJECTS, getProjectsByFaction } from "../../../core/data/projects";
import { gameService } from "../../services/GameService";
import { GBadge } from "../../ui";

const props = defineProps<{
  faction: NPCFaction;
}>();

const state = gameService.getState();

// Faction display config
const factionConfig = computed(() => {
  switch (props.faction) {
    case NPCFaction.EarthLoyalists:
      return { name: "Earth Loyalists", color: "var(--color-info)" };
    case NPCFaction.MarsIndependence:
      return { name: "Mars Independence", color: "var(--color-positive)" };
    case NPCFaction.CorporateInterests:
      return { name: "Corporate Interests", color: "var(--color-warning)" };
  }
});

// Get projects for this faction (non-capstone prerequisites)
const prerequisiteProjects = computed(() => {
  return getProjectsByFaction(props.faction).filter((p) => !p.isCapstone);
});

// Get capstone project for this faction
const capstoneProject = computed(() => {
  return getProjectsByFaction(props.faction).find((p) => p.isCapstone);
});

// Project status helper
type ProjectStatus = "passed" | "pending" | "available" | "locked";

function getProjectStatus(projectId: ProjectId): ProjectStatus {
  if (state.ideology.completedProjects.includes(projectId)) {
    return "passed";
  }
  const pending = state.ideology.pendingProposals.find((p) => p.projectId === projectId);
  if (pending) {
    return "pending";
  }
  // Check if can propose (has sufficient support)
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) return "locked";

  const support = getFactionSupport();
  if (support >= project.requiredSupport) {
    return "available";
  }
  return "locked";
}

function getFactionSupport(): number {
  switch (props.faction) {
    case NPCFaction.EarthLoyalists:
      return state.ideology.factionSupport.earthLoyalists;
    case NPCFaction.MarsIndependence:
      return state.ideology.factionSupport.marsIndependence;
    case NPCFaction.CorporateInterests:
      return state.ideology.factionSupport.corporateInterests;
  }
}

// Count passed prerequisites
const passedCount = computed(() => {
  return prerequisiteProjects.value.filter((p) =>
    state.ideology.completedProjects.includes(p.id)
  ).length;
});

// Council seats
const councilSeats = computed(() => {
  return state.ideology.councilFactionCounts[props.faction] ?? 0;
});

const totalSeats = computed(() => {
  return state.ideology.council.length;
});

const seatsNeeded = computed(() => {
  const threshold = Math.ceil(totalSeats.value * 0.65);
  return Math.max(0, threshold - councilSeats.value);
});

const hasCouncilMajority = computed(() => {
  return seatsNeeded.value === 0 && totalSeats.value > 0;
});

// Get pending vote info
function getPendingVoteSols(projectId: ProjectId): number | null {
  const pending = state.ideology.pendingProposals.find((p) => p.projectId === projectId);
  if (!pending) return null;
  return pending.voteSol - state.currentSol;
}

// Next step logic
const nextStep = computed(() => {
  const support = getFactionSupport();
  const capstone = capstoneProject.value;

  // Check if capstone is pending
  if (capstone) {
    const capstonePending = state.ideology.pendingProposals.find(
      (p) => p.projectId === capstone.id
    );
    if (capstonePending) {
      const sols = capstonePending.voteSol - state.currentSol;
      return { action: `${capstone.name} vote in ${sols} sols`, type: "pending" as const };
    }
  }

  // Check if capstone is ready
  if (passedCount.value >= 3 && hasCouncilMajority.value && capstone) {
    return { action: `Propose ${capstone.name} to win!`, type: "ready" as const };
  }

  // Check if projects incomplete
  if (passedCount.value < 3) {
    // Find next project to work on
    for (const project of prerequisiteProjects.value) {
      const status = getProjectStatus(project.id);
      if (status === "pending") {
        const sols = getPendingVoteSols(project.id);
        return { action: `${project.name} vote in ${sols} sols`, type: "pending" as const };
      }
      if (status === "available") {
        return { action: `Propose ${project.name}`, type: "available" as const };
      }
      if (status === "locked") {
        const requiredPct = Math.round(project.requiredSupport * 100);
        const currentPct = Math.round(support * 100);
        return {
          action: `Raise support to ${requiredPct}% to propose ${project.name}`,
          detail: `(current: ${currentPct}%)`,
          type: "locked" as const,
        };
      }
    }
  }

  // Projects done but need seats
  if (passedCount.value >= 3 && !hasCouncilMajority.value) {
    return {
      action: `Gain ${seatsNeeded.value} more council seat${seatsNeeded.value !== 1 ? "s" : ""}`,
      type: "seats" as const,
    };
  }

  return { action: "Victory path complete", type: "ready" as const };
});
</script>

<template>
  <div class="faction-track" :style="{ '--faction-color': factionConfig.color }">
    <div class="track-header">
      <span class="faction-name">{{ factionConfig.name }}</span>
    </div>

    <!-- Projects Section -->
    <div class="projects-section">
      <div class="section-label">Projects ({{ passedCount }}/3)</div>
      <div class="project-list">
        <div
          v-for="project in prerequisiteProjects"
          :key="project.id"
          class="project-row"
          :class="getProjectStatus(project.id)"
        >
          <span class="project-icon">
            <template v-if="getProjectStatus(project.id) === 'passed'">✓</template>
            <template v-else-if="getProjectStatus(project.id) === 'pending'">◐</template>
            <template v-else>○</template>
          </span>
          <span class="project-name">{{ project.name }}</span>
          <GBadge
            v-if="getProjectStatus(project.id) === 'pending'"
            variant="info"
            size="sm"
          >
            {{ getPendingVoteSols(project.id) }} sols
          </GBadge>
        </div>
      </div>

      <!-- Capstone -->
      <div v-if="capstoneProject" class="capstone-section">
        <div class="capstone-label">CAPSTONE</div>
        <div
          class="project-row capstone"
          :class="{ ready: passedCount >= 3 && hasCouncilMajority }"
        >
          <span class="project-name">{{ capstoneProject.name }}</span>
        </div>
        <div class="capstone-reqs">
          Requires: {{ passedCount }}/3 projects, 65% council
        </div>
      </div>
    </div>

    <!-- Council Section -->
    <div class="council-section">
      <div class="section-label">Council Seats</div>
      <div class="council-bar">
        <div
          class="council-fill"
          :style="{ width: totalSeats > 0 ? `${(councilSeats / totalSeats) * 100}%` : '0%' }"
        />
        <div class="council-threshold" />
      </div>
      <div class="council-stats">
        <span class="council-count">{{ councilSeats }}/{{ totalSeats }}</span>
        <span v-if="hasCouncilMajority" class="council-status majority">
          Majority secured ✓
        </span>
        <span v-else class="council-status needed">
          Need {{ seatsNeeded }} more
        </span>
      </div>
    </div>

    <!-- Next Step -->
    <div class="next-step" :class="nextStep.type">
      <span class="step-arrow">→</span>
      <span class="step-action">{{ nextStep.action }}</span>
      <span v-if="nextStep.detail" class="step-detail">{{ nextStep.detail }}</span>
    </div>
  </div>
</template>

<style scoped>
.faction-track {
  display: flex;
  flex-direction: column;
  gap: var(--g-space-sm);
  padding: var(--g-space-md);
  background: var(--g-color-bg-elevated);
  border-top: 3px solid var(--faction-color);
}

.track-header {
  margin-bottom: var(--g-space-xs);
}

.faction-name {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--faction-color);
}

.section-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--g-space-xs);
}

/* Projects */
.project-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.project-row {
  display: flex;
  align-items: center;
  gap: var(--g-space-xs);
  padding: var(--g-space-xs) 0;
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.project-row.passed {
  color: var(--color-positive);
}

.project-row.passed .project-name {
  text-decoration: line-through;
  opacity: 0.7;
}

.project-row.pending {
  color: var(--color-info);
}

.project-row.locked {
  color: var(--g-color-text-muted);
}

.project-row.available {
  color: var(--g-color-text);
}

.project-icon {
  width: 16px;
  text-align: center;
}

.project-name {
  flex: 1;
}

/* Capstone */
.capstone-section {
  margin-top: var(--g-space-sm);
  padding-top: var(--g-space-sm);
  border-top: 1px dashed var(--g-color-border);
}

.capstone-label {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  letter-spacing: 0.1em;
}

.project-row.capstone {
  color: var(--g-color-text-muted);
  font-weight: bold;
}

.project-row.capstone.ready {
  color: var(--faction-color);
}

.capstone-reqs {
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  color: var(--g-color-text-muted);
  margin-top: 2px;
}

/* Council */
.council-section {
  margin-top: var(--g-space-sm);
}

.council-bar {
  position: relative;
  height: 8px;
  background: var(--g-color-bg-base);
  border: 1px solid var(--g-color-border);
}

.council-fill {
  height: 100%;
  background: var(--faction-color);
  transition: width 0.3s;
}

.council-threshold {
  position: absolute;
  left: 65%;
  top: -2px;
  width: 2px;
  height: 12px;
  background: var(--g-color-text);
}

.council-stats {
  display: flex;
  justify-content: space-between;
  margin-top: var(--g-space-xs);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
}

.council-count {
  color: var(--g-color-text);
}

.council-status.majority {
  color: var(--color-positive);
}

.council-status.needed {
  color: var(--g-color-text-muted);
}

/* Next Step */
.next-step {
  margin-top: var(--g-space-sm);
  padding: var(--g-space-sm);
  background: var(--g-color-bg-base);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-xs);
  display: flex;
  gap: var(--g-space-xs);
  flex-wrap: wrap;
}

.step-arrow {
  color: var(--faction-color);
  font-weight: bold;
}

.step-action {
  color: var(--g-color-text);
}

.step-detail {
  color: var(--g-color-text-muted);
}

.next-step.ready .step-action {
  color: var(--color-positive);
  font-weight: bold;
}

.next-step.locked .step-action {
  color: var(--color-warning);
}
</style>
```

**Step 3: Verify file compiles**

Run: `cd /workspace/.worktrees/victory-progress-panel && bun run build 2>&1 | tail -10`
Expected: Build succeeds (component not yet used, so no import errors)

**Step 4: Commit**

```bash
git add src/renderer/components/VictoryProgressPanel/
git commit -m "feat(politics): add FactionTrack component for victory progress"
```

---

## Task 2: Create VictoryProgressPanel Component

**Files:**
- Create: `src/renderer/components/VictoryProgressPanel/VictoryProgressPanel.vue`
- Modify: `src/renderer/components/VictoryProgressPanel/index.ts`

**Step 1: Create the panel component**

```vue
<!-- src/renderer/components/VictoryProgressPanel/VictoryProgressPanel.vue -->
<script setup lang="ts">
import { NPCFaction } from "../../../core/models/NPCInfluence";
import { GPanel } from "../../ui";
import FactionTrack from "./FactionTrack.vue";

const factions = [
  NPCFaction.EarthLoyalists,
  NPCFaction.MarsIndependence,
  NPCFaction.CorporateInterests,
];
</script>

<template>
  <GPanel title="Victory Progress" accent="slate">
    <div class="victory-grid">
      <FactionTrack
        v-for="faction in factions"
        :key="faction"
        :faction="faction"
      />
    </div>
    <p class="hint">
      Pass 3 faction projects, then secure 65% of council seats to propose the capstone victory project.
    </p>
  </GPanel>
</template>

<style scoped>
.victory-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--g-space-md);
}

@media (max-width: 1200px) {
  .victory-grid {
    grid-template-columns: 1fr;
  }
}

.hint {
  margin-top: var(--g-space-md);
  color: var(--g-color-text-muted);
  font-family: var(--g-font-mono);
  font-size: var(--g-font-size-sm);
}
</style>
```

**Step 2: Update index.ts to export VictoryProgressPanel**

Already done in Task 1 - verify the export is correct.

**Step 3: Verify build**

Run: `cd /workspace/.worktrees/victory-progress-panel && bun run build 2>&1 | tail -10`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/renderer/components/VictoryProgressPanel/
git commit -m "feat(politics): add VictoryProgressPanel wrapper component"
```

---

## Task 3: Integrate Panel into PoliticsTab

**Files:**
- Modify: `src/renderer/components/PoliticsTab.vue`

**Step 1: Read current PoliticsTab structure**

Run: `cat src/renderer/components/PoliticsTab.vue`

**Step 2: Add VictoryProgressPanel import and placement**

Update `PoliticsTab.vue` to:
1. Import VictoryProgressPanel
2. Add it above the existing politics-grid

```vue
<script setup lang="ts">
import { CouncilPanel } from "./CouncilPanel";
import { PoliticsPanel } from "./PoliticsPanel";
import { ProjectsPanel } from "./ProjectsPanel";
import { VictoryProgressPanel } from "./VictoryProgressPanel";
</script>

<template>
  <div class="politics-tab">
    <VictoryProgressPanel />
    <div class="politics-grid">
      <div class="politics-col">
        <PoliticsPanel />
      </div>
      <div class="politics-col">
        <CouncilPanel />
        <ProjectsPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.politics-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.politics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.politics-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

@media (max-width: 1400px) {
  .politics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .politics-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

**Step 3: Verify build and lint**

Run: `cd /workspace/.worktrees/victory-progress-panel && bun run build && bun run lint`
Expected: Build succeeds, no lint errors

**Step 4: Commit**

```bash
git add src/renderer/components/PoliticsTab.vue
git commit -m "feat(politics): integrate VictoryProgressPanel into Politics tab"
```

---

## Task 4: Manual Testing and Polish

**Step 1: Start dev server and test**

Run: `cd /workspace/.worktrees/victory-progress-panel && bun run dev`

Test checklist:
- [ ] Panel appears at top of Politics tab
- [ ] All 3 faction tracks display
- [ ] Project statuses show correctly (passed/pending/available/locked)
- [ ] Council bar shows correct seats and threshold marker
- [ ] Next step guidance updates appropriately
- [ ] Responsive layout stacks on narrow screens

**Step 2: Fix any visual issues found during testing**

Common fixes:
- Adjust spacing/padding
- Fix color contrast
- Ensure text doesn't overflow

**Step 3: Run full test suite**

Run: `cd /workspace/.worktrees/victory-progress-panel && bun test`
Expected: All tests pass (no test changes needed - this is UI only)

**Step 4: Final commit if any polish changes**

```bash
git add -A
git commit -m "fix(politics): polish VictoryProgressPanel styling"
```

---

## Task 5: Create PR

**Step 1: Push branch**

```bash
cd /workspace/.worktrees/victory-progress-panel
git push -u origin feature/victory-progress-panel
```

**Step 2: Create PR**

```bash
gh pr create --title "feat(politics): add Victory Progress Panel" --body "$(cat <<'EOF'
## Summary
- Adds new Victory Progress Panel to Politics tab
- Shows progress toward each faction's victory path
- Displays project completion, council seats, and actionable next steps

## Test plan
- [ ] Panel appears at top of Politics tab
- [ ] All 3 faction tracks show correct data
- [ ] Project statuses update correctly
- [ ] Council bar reflects actual seat counts
- [ ] Next step guidance is accurate and helpful
- [ ] Responsive layout works on narrow screens

Design doc: docs/plans/2026-02-01-victory-progress-panel-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 3: Report PR URL**
