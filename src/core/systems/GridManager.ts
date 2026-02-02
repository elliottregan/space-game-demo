// src/core/systems/GridManager.ts
import {
  GridCell,
  GridPosition,
  DepositType,
  GRID_SIZE,
  BuildingPlacement,
  PowerState,
} from "../models/Grid";
import {
  BATTERY_BACKUP_SOLS,
  LOW_BATTERY_THRESHOLD,
  calculatePowerRange,
} from "../balance/GridBalance";

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
    return this.grid[y][x];
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

      const cell = this.grid[y][x];
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
        const cell = this.grid[y][x];
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

  updatePowerConnections(hasTechBonus: boolean): void {
    // Reset all placements to calculate fresh
    for (const placement of this.placements.values()) {
      placement.powerSourceId = undefined;
      placement.distanceToPower = Infinity;
    }

    // For each power source, find buildings in range
    const powerSourceList = Array.from(this.powerSources.values());

    // Build list of buildings that need power (not power sources themselves)
    const buildingsNeedingPower: { placement: BuildingPlacement; consumption: number }[] = [];

    for (const placement of this.placements.values()) {
      if (this.powerSources.has(placement.buildingId)) {
        // Power sources are always powered
        placement.powerState = PowerState.POWERED;
        placement.distanceToPower = 0;
        continue;
      }

      const consumption = this.buildingPowerConsumption.get(placement.buildingId) ?? 0;
      buildingsNeedingPower.push({ placement, consumption });
    }

    // For each power source, allocate power by distance
    for (const source of powerSourceList) {
      const sourcePosition = this.getBuildingPosition(source.buildingId);
      if (!sourcePosition) continue;

      const range = calculatePowerRange(source.output, hasTechBonus);
      let availablePower = source.output;

      // Find all buildings in range and sort by distance
      const inRange = buildingsNeedingPower
        .map((b) => ({
          ...b,
          distance: this.calculateDistance(sourcePosition, b.placement.position),
        }))
        .filter((b) => b.distance <= range)
        .sort((a, b) => a.distance - b.distance);

      // Allocate power by distance priority
      for (const building of inRange) {
        if (building.placement.powerSourceId) continue; // Already connected

        if (availablePower >= building.consumption) {
          building.placement.powerSourceId = source.buildingId;
          building.placement.distanceToPower = building.distance;
          building.placement.powerState = PowerState.POWERED;
          building.placement.batteryLevel = 1.0; // Recharge battery
          availablePower -= building.consumption;
        }
      }
    }

    // Buildings not connected use battery or become unpowered
    for (const { placement } of buildingsNeedingPower) {
      if (!placement.powerSourceId) {
        // Not connected to power - check battery
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

  getPlacementHints(position: GridPosition, hasTechBonus: boolean): PlacementHints {
    const cell = this.getCell(position.x, position.y);

    const hints: PlacementHints = {
      position,
      isOccupied: !!cell?.buildingId,
      deposit: cell?.deposit,
      hasPower: false,
      powerCapacityAvailable: 0,
      distanceToNearestPower: Infinity,
    };

    // Check power availability from all sources
    for (const source of this.powerSources.values()) {
      const sourcePos = this.getBuildingPosition(source.buildingId);
      if (!sourcePos) continue;

      const distance = this.calculateDistance(position, sourcePos);
      const range = calculatePowerRange(source.output, hasTechBonus);

      if (distance <= range) {
        hints.hasPower = true;
        // Calculate remaining capacity (simplified - full capacity for now)
        hints.powerCapacityAvailable = Math.max(hints.powerCapacityAvailable, source.output);
      }

      hints.distanceToNearestPower = Math.min(hints.distanceToNearestPower, distance);
    }

    return hints;
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
        const cell = this.grid[y][x];
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
      const cell = this.grid[deposit.y][deposit.x];
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
      const cell = this.grid[p.y][p.x];
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
    this.updatePowerConnections(false); // TODO: pass tech bonus from GameState
  }
}
