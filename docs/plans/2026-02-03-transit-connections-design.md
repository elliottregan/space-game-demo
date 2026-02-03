# Transit Connections Design

## Overview

Buildings on the base grid form connectivity clusters through adjacency. Colonists can only work at buildings connected to their housing. This adds spatial planning depth, realism, and progression gating to colony layout.

## Goals

1. **Spatial planning challenge** - Make players think about building placement and layout
2. **Realism/immersion** - Colonists need transit access to their workplaces
3. **Progression gate** - Early colonies are compact, expansion requires transit infrastructure

## Core Connectivity Model

### Adjacency Rules

- Buildings connect via **4-way adjacency** (cardinal directions along isometric diamond edges)
- Only direct neighbors count - no diagonal connections
- Connections are automatic and free - no cost to link adjacent buildings

### Clusters

- **Habitats are cluster roots** - each habitat building starts a new cluster
- A cluster = one habitat + all buildings reachable via unbroken adjacency chain
- Multiple independent clusters can exist simultaneously
- No maximum chain length (initially - tune later if needed)

### Example

```
    [Mine]
      |
  [Refinery]--[Farm]
      |
  [HABITAT]--[Solar]--[Lab]
```

All buildings form one cluster rooted at the habitat.

## Colonist Assignment Rules

- Colonists living in a habitat can **only work at buildings in the same cluster**
- When assigning workers, UI filters to show only valid workplaces
- If a colonist's workplace becomes disconnected from their housing, they are **immediately unassigned**

## Transit Infrastructure: Rover Depot

### Purpose

Bridges disconnected clusters, enabling expansion beyond compact adjacency chains.

### Behavior

- Has a **range** (like power sources) - approximately 3-4 cells Manhattan distance
- Any building within depot range becomes connected to the depot's cluster
- Depot itself must be connected to a cluster (adjacent to existing buildings)
- When a depot bridges two habitat clusters, they effectively merge

### Example

```
Cluster A                    Cluster B

[Farm]--[HABITAT A]    [DEPOT]    [HABITAT B]--[Lab]
                          |
                       (range)
                          |
                      [Factory]
```

- Depot connects to Cluster A via adjacency
- Depot's range reaches Habitat B, merging the clusters
- Colonists from either habitat can now work at any building in the merged cluster
- Factory (within depot range) also joins the merged cluster

### Building Properties (Starting Point)

| Property | Value | Notes |
|----------|-------|-------|
| Cost | Moderate | Mid-game investment |
| Workers | 0-1 | Could require driver or be automated |
| Power | Yes | Requires power to function |
| Range | 3-4 cells | Manhattan distance, tunable |

## Disconnection Handling

### Triggers

- Building demolished that was part of a chain
- Depot destroyed or disabled (broken, unpowered)
- Building recycled

### Consequences

1. **Immediate worker unassignment** - all workers removed from disconnected workplaces
2. Building goes idle (no production)
3. Colonists return to unassigned pool
4. Event logged: "Mine lost transit connection, 2 workers unassigned"

### Recovery

- Reconnecting the building (rebuild link, repair depot) allows reassignment
- Workers don't automatically return - requires manual or auto-assign

## Visualization

### On Select/Hover

- Show connection chain from selected building back to its habitat
- Highlighted path along adjacency links
- Label showing "Connected to: Habitat Module #2"

### Disconnection Alerts

- Disconnected buildings display warning icon (similar to unpowered indicator)
- Red outline or caution symbol
- Tooltip: "Not connected to any habitat"

### Assignment UI

- Worker assignment filters to show only valid workplaces in colonist's cluster
- Housing assignment shows which workplaces colonist would have access to
- Warning displayed if assignment would be invalid

## Implementation Notes

### New Data Structures

**GridManager additions:**
- `buildingClusterId: Map<string, string>` - maps building ID to cluster ID
- `clusters: Map<string, Cluster>` - cluster metadata

**Cluster interface:**
```typescript
interface Cluster {
  id: string;
  rootHabitatId: string;
  buildingIds: Set<string>;
}
```

### Cluster Recalculation Triggers

- Building placed
- Building removed/demolished
- Depot broken or repaired
- Depot powered or unpowered

### New Building Definition

Add `ROVER_DEPOT` to `buildings.ts`:
- Purpose: Infrastructure
- Range property for connectivity
- Power consumption

### Modified Systems

| System | Changes |
|--------|---------|
| `GridManager` | Cluster tracking, adjacency calculations |
| `BuildingManager` | Validate cluster on worker assignment |
| `WorkforceManager` | Filter auto-assign candidates by cluster |
| UI components | Connection visualization, cluster filtering |

### New Events

- `BUILDING_DISCONNECTED` - logs when building loses connection
- `CLUSTERS_MERGED` - logs when depot bridges clusters
- `WORKERS_UNASSIGNED_TRANSIT` - logs mass unassignment from disconnection

## Future Considerations

- Maximum chain length if sprawl becomes too easy
- Colonist commute tolerance based on traits/morale
- Multiple depot tiers with different ranges
- Transit capacity limits (max colonists commuting through a depot)
- Visual "traffic" showing colonist movement along connections
