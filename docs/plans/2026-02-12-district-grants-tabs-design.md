# District Card Tabs: Buildings + Grants

## Problem

District grants live on the Politics tab (GrantsPanel), separate from the districts they apply to. Players must jump between tabs to manage what is conceptually one thing — a district's buildings and identity.

## Solution

Add a tabbed interface to DistrictCard switching between Buildings and Grants views. Remove GrantsPanel from PoliticsTab.

## Design

### DistrictCard changes

The card keeps its existing always-visible sections: header (name, growth status, founded date), population bar, resource flows, power stats, workforce summary, faction breakdown, ideology radar.

Below the stats, a tab bar with two tabs:

- **Buildings** (default) — existing building slots grid + build panel, unchanged
- **Grants** — available grants filtered to this district + active grants on this district

### Grants tab content

**Available Grants section:**
- List of grants from `state.grants.available`
- Each grant shows: name, category badge (Identity/Infrastructure), capstone badge, description, cost, duration
- "Assign" button per grant (no district dropdown needed — context is the card's district)
- Disabled state when grant can't be assigned to this district
- "Refresh" button at bottom

**Active Grants section:**
- Grants currently active on this district (filtered from `state.grants.active`)
- Each shows: name, remaining sols, progress bar

### PoliticsTab changes

- Remove GrantsPanel import and usage
- GrantsPanel component files can remain (no deletion needed)

### Files modified

1. `src/renderer/components/ColonyView/DistrictCard.vue` — add tab state, tab bar UI, grants tab content, grant logic from GrantsPanel
2. `src/renderer/components/PoliticsTab.vue` — remove GrantsPanel
