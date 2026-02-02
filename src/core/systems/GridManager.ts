// src/core/systems/GridManager.ts
import {
  GridCell,
  GridPosition,
  DepositType,
  GRID_SIZE,
  BuildingPlacement,
  PowerState,
} from "../models/Grid";

interface DepositInfo {
  position: GridPosition;
  type: DepositType;
}

export interface PlacementResult {
  success: boolean;
  error?: string;
}

export class GridManager {
  private grid: GridCell[][] = [];
  private placements: Map<string, BuildingPlacement> = new Map();

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

    this.placements.delete(cell.buildingId);
    cell.buildingId = undefined;
    return { success: true };
  }

  getBuildingPosition(buildingId: string): GridPosition | null {
    const placement = this.placements.get(buildingId);
    return placement ? { ...placement.position } : null;
  }
}
