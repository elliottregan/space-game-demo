// src/core/systems/GridManager.ts
import type { GridCell, GridPosition, BuildingPlacement, Cluster } from "../models/Grid";
import { DepositType, GRID_SIZE, PowerState } from "../models/Grid";
import { BuildingId } from "../models/Building";
import { BATTERY_BACKUP_SOLS, LOW_BATTERY_THRESHOLD } from "../balance/GridBalance";

interface DepositInfo {
  position: GridPosition;
  type: DepositType;
}

interface PowerSource {
  buildingId: string;
  output: number;
}

export interface PlacementResult {
  success: boolean;
  error?: string;
}

export interface PlacementHints {
  position: GridPosition;
  isOccupied: boolean;
  deposit?: DepositType;
  hasPower: boolean;
  powerCapacityAvailable: number;
  distanceToNearestPower: number;
}

export interface GridManagerJSON {
  deposits: Array<{ x: number; y: number; type: DepositType }>;
  placements: Array<{
    buildingId: string;
    x: number;
    y: number;
    batteryLevel: number;
    powerState: PowerState;
  }>;
  powerSources: Array<{ buildingId: string; output: number }>;
  powerConsumption: Array<{ buildingId: string; consumption: number }>;
}

export class GridManager {
  private grid: GridCell[][] = [];
  private placements: Map<string, BuildingPlacement> = new Map();
  private powerSources: Map<string, PowerSource> = new Map();
  private buildingPowerConsumption: Map<string, number> = new Map();
  private clusters: Map<string, Cluster> = new Map();
  private buildingToCluster: Map<string, string> = new Map();

  constructor() {
    this.initializeGrid();
  }

  private initializeGrid(): void {
    this.grid = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row: GridCell[] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        row.push({ position: { x, y } });
      }
      this.grid.push(row);
    }
  }

  getGridSize(): number {
    return GRID_SIZE;
  }

  getCell(x: number, y: number): GridCell | null {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      return null;
    }
    // Safe: bounds are checked above
    return this.grid[y]![x]!;
  }

  generateDeposits(seed: number): void {
    // Simple seeded random
    const random = this.seededRandom(seed);

    // Generate 2-3 water deposits
    const waterCount = 2 + Math.floor(random() * 2);
    this.placeDeposits(DepositType.WATER, waterCount, random);

    // Generate 2-3 mineral deposits
    const mineralCount = 2 + Math.floor(random() * 2);
    this.placeDeposits(DepositType.MINERAL, mineralCount, random);
  }

  private placeDeposits(type: DepositType, count: number, random: () => number): void {
    let placed = 0;
    let attempts = 0;
    const maxAttempts = 100;

    while (placed < count && attempts < maxAttempts) {
      attempts++;
      const x = Math.floor(random() * GRID_SIZE);
      const y = Math.floor(random() * GRID_SIZE);

      // Skip center 4x4 area (cells 3-6)
      if (x >= 3 && x <= 6 && y >= 3 && y <= 6) continue;

      const cell = this.grid[y]![x]!;
      if (cell.deposit) continue; // Already has deposit

      cell.deposit = type;
      placed++;
    }
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  getAllDeposits(): DepositInfo[] {
    const deposits: DepositInfo[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.grid[y]![x]!;
        if (cell.deposit) {
          deposits.push({ position: { x, y }, type: cell.deposit });
        }
      }
    }
    return deposits;
  }

  placeBuilding(buildingId: string, position: GridPosition): PlacementResult {
    const cell = this.getCell(position.x, position.y);

    if (!cell) {
      return { success: false, error: "Position out of bounds" };
    }

    if (cell.buildingId) {
      return { success: false, error: "Cell is occupied" };
    }

    cell.buildingId = buildingId;

    // Create placement record
    this.placements.set(buildingId, {
      buildingId,
      position: { ...position },
      distanceToPower: Infinity,
      batteryLevel: 1.0, // Start with full battery
      powerState: PowerState.UNPOWERED,
    });

    return { success: true };
  }

  removeBuilding(position: GridPosition): PlacementResult {
    const cell = this.getCell(position.x, position.y);

    if (!cell) {
      return { success: false, error: "Position out of bounds" };
    }

    if (!cell.buildingId) {
      return { success: false, error: "No building at position" };
    }

    const buildingId = cell.buildingId;

    // Clean up all tracking maps
    this.powerSources.delete(buildingId);
    this.buildingPowerConsumption.delete(buildingId);
    this.placements.delete(buildingId);

    cell.buildingId = undefined;
    return { success: true };
  }

  getBuildingPosition(buildingId: string): GridPosition | null {
    const placement = this.placements.get(buildingId);
    return placement ? { ...placement.position } : null;
  }

  registerPowerSource(buildingId: string, output: number): void {
    this.powerSources.set(buildingId, { buildingId, output });
  }

  unregisterPowerSource(buildingId: string): void {
    this.powerSources.delete(buildingId);
  }

  getPowerSources(): PowerSource[] {
    return Array.from(this.powerSources.values());
  }

  setBuildingPowerConsumption(buildingId: string, consumption: number): void {
    this.buildingPowerConsumption.set(buildingId, consumption);
  }

  calculateDistance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  updatePowerConnections(activeBuildingIds?: Set<string>): void {
    // Reset all placements to calculate fresh
    for (const placement of this.placements.values()) {
      placement.powerSourceId = undefined;
      placement.distanceToPower = Infinity;
    }

    // Only include power sources that are active (if activeBuildingIds provided)
    const powerSourceList = Array.from(this.powerSources.values()).filter(
      (source) => !activeBuildingIds || activeBuildingIds.has(source.buildingId),
    );

    // Mark active power sources as powered
    for (const placement of this.placements.values()) {
      if (this.powerSources.has(placement.buildingId)) {
        const source = this.powerSources.get(placement.buildingId)!;
        // Only mark as powered if active
        if (!activeBuildingIds || activeBuildingIds.has(source.buildingId)) {
          placement.powerState = PowerState.POWERED;
          placement.distanceToPower = 0;
        }
      }
    }

    // Sort sources by output descending for deterministic priority
    powerSourceList.sort((a, b) => b.output - a.output);

    // Track remaining capacity per source
    const remainingCapacity = new Map<string, number>();
    for (const source of powerSourceList) {
      remainingCapacity.set(source.buildingId, source.output);
    }

    // BFS flood-fill from each power source through adjacent buildings
    for (const source of powerSourceList) {
      const sourcePosition = this.getBuildingPosition(source.buildingId);
      if (!sourcePosition) continue;

      const visited = new Set<string>();
      const queue: { buildingId: string; hops: number }[] = [
        { buildingId: source.buildingId, hops: 0 },
      ];
      visited.add(source.buildingId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentPlacement = this.placements.get(current.buildingId);
        if (!currentPlacement) continue;

        // Try to power this building if it needs power and isn't already powered
        if (!this.powerSources.has(current.buildingId) && !currentPlacement.powerSourceId) {
          const consumption = this.buildingPowerConsumption.get(current.buildingId) ?? 0;
          const available = remainingCapacity.get(source.buildingId) ?? 0;

          if (available >= consumption) {
            currentPlacement.powerSourceId = source.buildingId;
            currentPlacement.distanceToPower = current.hops;
            currentPlacement.powerState = PowerState.POWERED;
            currentPlacement.batteryLevel = 1.0;
            remainingCapacity.set(source.buildingId, available - consumption);
          }
        }

        // Traverse through adjacent buildings (all buildings relay, even if powered by another source)
        const adjacentPositions = this.getAdjacentPositions(currentPlacement.position);
        for (const adjPos of adjacentPositions) {
          const cell = this.grid[adjPos.y]![adjPos.x]!;
          if (cell.buildingId && !visited.has(cell.buildingId)) {
            visited.add(cell.buildingId);
            queue.push({ buildingId: cell.buildingId, hops: current.hops + 1 });
          }
        }
      }
    }

    // Buildings not connected use battery or become unpowered
    for (const placement of this.placements.values()) {
      if (this.powerSources.has(placement.buildingId)) continue;
      if (!placement.powerSourceId) {
        if (placement.batteryLevel > 0) {
          placement.powerState = PowerState.ON_BATTERY;
        } else {
          placement.powerState = PowerState.UNPOWERED;
        }
      }
    }
  }

  getPowerState(buildingId: string): PowerState {
    const placement = this.placements.get(buildingId);
    return placement?.powerState ?? PowerState.UNPOWERED;
  }

  getPlacement(buildingId: string): BuildingPlacement | undefined {
    return this.placements.get(buildingId);
  }

  getPlacementHints(position: GridPosition): PlacementHints {
    const cell = this.getCell(position.x, position.y);

    const hints: PlacementHints = {
      position,
      isOccupied: !!cell?.buildingId,
      deposit: cell?.deposit,
      hasPower: false,
      powerCapacityAvailable: 0,
      distanceToNearestPower: Infinity,
    };

    // Check if any adjacent cell contains a POWERED building
    const adjacentPositions = this.getAdjacentPositions(position);
    for (const adjPos of adjacentPositions) {
      const adjCell = this.grid[adjPos.y]![adjPos.x]!;
      if (!adjCell.buildingId) continue;

      const adjPlacement = this.placements.get(adjCell.buildingId);
      if (!adjPlacement) continue;

      // Distance to any power source
      if (this.powerSources.has(adjCell.buildingId)) {
        const source = this.powerSources.get(adjCell.buildingId)!;
        hints.distanceToNearestPower = Math.min(hints.distanceToNearestPower, 1);
        hints.hasPower = true;
        hints.powerCapacityAvailable = Math.max(hints.powerCapacityAvailable, source.output);
      } else if (adjPlacement.powerState === PowerState.POWERED) {
        hints.hasPower = true;
        hints.distanceToNearestPower = Math.min(
          hints.distanceToNearestPower,
          adjPlacement.distanceToPower + 1,
        );
      }
    }

    return hints;
  }

  getAdjacentPositions(pos: GridPosition): GridPosition[] {
    const deltas = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ];
    return deltas
      .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
      .filter((p) => p.x >= 0 && p.x < GRID_SIZE && p.y >= 0 && p.y < GRID_SIZE);
  }

  getBuildingClusterId(buildingId: string): string | undefined {
    return this.buildingToCluster.get(buildingId);
  }

  getCluster(clusterId: string): Cluster | undefined {
    return this.clusters.get(clusterId);
  }

  updateClusters(
    buildingDefinitions: Map<string, BuildingId>,
    depotRanges: Map<string, number>,
  ): void {
    // Clear existing clusters
    this.clusters.clear();
    this.buildingToCluster.clear();

    // Clear cluster IDs on placements
    for (const placement of this.placements.values()) {
      placement.clusterId = undefined;
    }

    // Find all habitats (cluster roots)
    const habitats: string[] = [];
    for (const [buildingId, defId] of buildingDefinitions) {
      if (defId === BuildingId.HABITAT || defId === BuildingId.ADVANCED_HABITAT) {
        if (this.placements.has(buildingId)) {
          habitats.push(buildingId);
        }
      }
    }

    // Build clusters via flood-fill from each habitat
    for (const habitatId of habitats) {
      const clusterId = `cluster-${habitatId}`;
      const cluster: Cluster = {
        id: clusterId,
        rootHabitatId: habitatId,
        buildingIds: new Set(),
      };

      // BFS flood-fill
      const visited = new Set<string>();
      const queue: string[] = [habitatId];

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId || visited.has(currentId)) continue;
        if (this.buildingToCluster.has(currentId)) continue; // Already in another cluster
        visited.add(currentId);

        const placement = this.placements.get(currentId);
        if (!placement) continue;

        // Add to cluster
        cluster.buildingIds.add(currentId);
        this.buildingToCluster.set(currentId, clusterId);
        placement.clusterId = clusterId;

        // Find adjacent buildings
        const adjacentPositions = this.getAdjacentPositions(placement.position);
        for (const adjPos of adjacentPositions) {
          const cell = this.grid[adjPos.y]![adjPos.x]!;
          if (cell.buildingId && !visited.has(cell.buildingId)) {
            queue.push(cell.buildingId);
          }
        }
      }

      this.clusters.set(clusterId, cluster);
    }

    // Second pass: depot range connections
    for (const [depotId, range] of depotRanges) {
      const depotPlacement = this.placements.get(depotId);
      if (!depotPlacement || !depotPlacement.clusterId) continue;

      const depotClusterId = depotPlacement.clusterId;
      const depotCluster = this.clusters.get(depotClusterId);
      if (!depotCluster) continue;

      // Find buildings within depot range
      for (const [buildingId, placement] of this.placements) {
        if (placement.clusterId) continue; // Already in a cluster

        const distance = this.calculateDistance(depotPlacement.position, placement.position);
        if (distance <= range) {
          // Add to depot's cluster
          depotCluster.buildingIds.add(buildingId);
          this.buildingToCluster.set(buildingId, depotClusterId);
          placement.clusterId = depotClusterId;
        }
      }
    }
  }

  tick(): void {
    const drainPerSol = 1 / BATTERY_BACKUP_SOLS;

    for (const placement of this.placements.values()) {
      // Skip power sources
      if (this.powerSources.has(placement.buildingId)) continue;

      // Skip powered buildings
      if (placement.powerSourceId) continue;

      // Drain battery
      placement.batteryLevel = Math.max(0, placement.batteryLevel - drainPerSol);

      // Update power state based on battery
      if (placement.batteryLevel <= 0) {
        placement.powerState = PowerState.UNPOWERED;
      } else if (placement.batteryLevel <= LOW_BATTERY_THRESHOLD) {
        placement.powerState = PowerState.LOW_BATTERY;
      } else {
        placement.powerState = PowerState.ON_BATTERY;
      }
    }
  }

  toJSON(): GridManagerJSON {
    const deposits: GridManagerJSON["deposits"] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = this.grid[y]![x]!;
        if (cell.deposit) {
          deposits.push({ x, y, type: cell.deposit });
        }
      }
    }

    const placements = Array.from(this.placements.values()).map((p) => ({
      buildingId: p.buildingId,
      x: p.position.x,
      y: p.position.y,
      batteryLevel: p.batteryLevel,
      powerState: p.powerState,
    }));

    const powerSources = Array.from(this.powerSources.values()).map((s) => ({
      buildingId: s.buildingId,
      output: s.output,
    }));

    const powerConsumption = Array.from(this.buildingPowerConsumption.entries()).map(
      ([buildingId, consumption]) => ({ buildingId, consumption }),
    );

    return { deposits, placements, powerSources, powerConsumption };
  }

  fromJSON(json: GridManagerJSON): void {
    // Reset state
    this.initializeGrid();
    this.placements.clear();
    this.powerSources.clear();
    this.buildingPowerConsumption.clear();

    // Restore deposits
    for (const deposit of json.deposits) {
      const cell = this.grid[deposit.y]![deposit.x]!;
      cell.deposit = deposit.type;
    }

    // Restore power sources first
    for (const source of json.powerSources) {
      this.powerSources.set(source.buildingId, source);
    }

    // Restore power consumption
    for (const { buildingId, consumption } of json.powerConsumption) {
      this.buildingPowerConsumption.set(buildingId, consumption);
    }

    // Restore placements
    for (const p of json.placements) {
      const cell = this.grid[p.y]![p.x]!;
      cell.buildingId = p.buildingId;

      this.placements.set(p.buildingId, {
        buildingId: p.buildingId,
        position: { x: p.x, y: p.y },
        distanceToPower: Infinity,
        batteryLevel: p.batteryLevel,
        powerState: p.powerState,
      });
    }

    // Recalculate power connections
    this.updatePowerConnections();
  }
}
