// src/facade/domains/GridFacade.ts
// Grid queries facade for building placement

import type { GameState } from "../../core/GameState";
import type { DepositType, GridPosition } from "../../core/models/Grid";
import { PowerState } from "../../core/models/Grid";
import type { Queryable } from "../types/interfaces";
import type { DepositInfo, GridSnapshot, PlacementHints } from "../types/grid";

/**
 * Facade for grid-related queries.
 * Provides read-only access to grid state for building placement decisions.
 *
 * Implements: Queryable<GridSnapshot>
 */
export class GridFacade implements Queryable<GridSnapshot> {
  constructor(private gameState: GameState) {}

  /**
   * Get complete grid state snapshot.
   */
  snapshot(): GridSnapshot {
    const gridSize = this.gameState.grid.getGridSize();

    // Get all deposits with occupancy info
    const deposits = this.gameState.grid.getAllDeposits().map((d) => {
      const cell = this.gameState.grid.getCell(d.position.x, d.position.y);
      return {
        position: { ...d.position },
        type: d.type,
        isOccupied: !!cell?.buildingId,
      };
    });

    // Get power sources with position
    const powerSources = this.gameState.grid
      .getPowerSources()
      .map((s) => {
        const position = this.gameState.grid.getBuildingPosition(s.buildingId);
        return {
          buildingId: s.buildingId,
          position: position ?? { x: 0, y: 0 },
          output: s.output,
        };
      })
      .filter((s) => s.position.x !== 0 || s.position.y !== 0);

    // Get all occupied cells
    const occupiedCells: GridPosition[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = this.gameState.grid.getCell(x, y);
        if (cell?.buildingId) {
          occupiedCells.push({ x, y });
        }
      }
    }

    return {
      size: gridSize,
      deposits: Object.freeze(deposits),
      powerSources: Object.freeze(powerSources),
      occupiedCells: Object.freeze(occupiedCells),
    };
  }

  /**
   * Get all empty cells on the grid.
   */
  getEmptyCells(): GridPosition[] {
    const gridSize = this.gameState.grid.getGridSize();
    const emptyCells: GridPosition[] = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = this.gameState.grid.getCell(x, y);
        if (!cell?.buildingId) {
          emptyCells.push({ x, y });
        }
      }
    }

    return emptyCells;
  }

  /**
   * Get all deposits on the grid with occupancy status.
   */
  getDeposits(): DepositInfo[] {
    return this.gameState.grid.getAllDeposits().map((d) => {
      const cell = this.gameState.grid.getCell(d.position.x, d.position.y);
      return {
        position: { ...d.position },
        type: d.type,
        isOccupied: !!cell?.buildingId,
      };
    });
  }

  /**
   * Get deposits of a specific type that are not occupied.
   */
  getAvailableDeposits(type: DepositType): DepositInfo[] {
    return this.getDeposits().filter((d) => d.type === type && !d.isOccupied);
  }

  /**
   * Get all cells adjacent to any powered building.
   * These are positions where a new building would have power access.
   */
  getCellsInPowerRange(): GridPosition[] {
    const gridSize = this.gameState.grid.getGridSize();
    const poweredCells = new Set<string>();

    // Find all cells adjacent to any powered building
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const cell = this.gameState.grid.getCell(x, y);
        if (!cell?.buildingId) continue;

        const placement = this.gameState.grid.getPlacement(cell.buildingId);
        if (!placement) continue;

        // Check if this building is powered (either a power source or has power)
        const isPowered = placement.powerState === PowerState.POWERED;

        if (isPowered) {
          // Add all adjacent empty cells
          const adjacent = this.gameState.grid.getAdjacentPositions({ x, y });
          for (const adj of adjacent) {
            poweredCells.add(`${adj.x},${adj.y}`);
          }
          // Also include the powered cell itself
          poweredCells.add(`${x},${y}`);
        }
      }
    }

    return Array.from(poweredCells).map((key) => {
      const parts = key.split(",").map(Number);
      return { x: parts[0] ?? 0, y: parts[1] ?? 0 };
    });
  }

  /**
   * Get placement hints for a specific position.
   */
  getPlacementHints(position: GridPosition): PlacementHints {
    return this.gameState.grid.getPlacementHints(position);
  }

  /**
   * Check if a cell has a deposit.
   */
  hasDeposit(position: GridPosition): boolean {
    const cell = this.gameState.grid.getCell(position.x, position.y);
    return !!cell?.deposit;
  }

  /**
   * Get the deposit type at a position, if any.
   */
  getDepositAt(position: GridPosition): DepositType | undefined {
    const cell = this.gameState.grid.getCell(position.x, position.y);
    return cell?.deposit;
  }

  /**
   * Check if a cell is empty (no building).
   */
  isEmpty(position: GridPosition): boolean {
    const cell = this.gameState.grid.getCell(position.x, position.y);
    return !cell?.buildingId;
  }

  /**
   * Calculate Manhattan distance between two positions.
   */
  calculateDistance(a: GridPosition, b: GridPosition): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Get the cluster ID for a building.
   * Returns undefined if the building is not connected to any habitat.
   */
  getBuildingClusterId(buildingId: string): string | undefined {
    return this.gameState.grid.getBuildingClusterId(buildingId);
  }

  /**
   * Check if a building is connected to a habitat via transit connections.
   */
  isConnectedToHabitat(buildingId: string): boolean {
    return this.gameState.grid.getBuildingClusterId(buildingId) !== undefined;
  }
}
