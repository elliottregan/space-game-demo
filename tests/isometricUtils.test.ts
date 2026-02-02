import { describe, expect, it } from "bun:test";
import {
  gridToScreen,
  screenToGrid,
  snapToGrid,
  isValidGridPosition,
  TILE_WIDTH,
  TILE_HEIGHT,
  GRID_SIZE,
} from "../src/renderer/components/BaseGrid/isometricUtils";

describe("Isometric Utils", () => {
  describe("gridToScreen", () => {
    it("converts (0,0) to center offset", () => {
      const screen = gridToScreen(0, 0, 800, 600);
      // (0,0) should be at top-center of visible area
      expect(screen.x).toBeCloseTo(400, 0);
    });

    it("moving right (+x) goes down-right", () => {
      const origin = gridToScreen(0, 0, 800, 600);
      const right = gridToScreen(1, 0, 800, 600);

      expect(right.x).toBeGreaterThan(origin.x);
      expect(right.y).toBeGreaterThan(origin.y);
    });

    it("moving down (+y) goes down-left", () => {
      const origin = gridToScreen(0, 0, 800, 600);
      const down = gridToScreen(0, 1, 800, 600);

      expect(down.x).toBeLessThan(origin.x);
      expect(down.y).toBeGreaterThan(origin.y);
    });

    it("diagonal movement (+x,+y) goes straight down", () => {
      const origin = gridToScreen(0, 0, 800, 600);
      const diagonal = gridToScreen(1, 1, 800, 600);

      // Moving +1 in both x and y should result in same x (horizontal center)
      expect(diagonal.x).toBeCloseTo(origin.x, 0);
      expect(diagonal.y).toBeGreaterThan(origin.y);
    });
  });

  describe("screenToGrid", () => {
    it("inverts gridToScreen", () => {
      const gridX = 5,
        gridY = 3;
      const screen = gridToScreen(gridX, gridY, 800, 600);
      const grid = screenToGrid(screen.x, screen.y, 800, 600);

      expect(grid.x).toBeCloseTo(gridX, 0);
      expect(grid.y).toBeCloseTo(gridY, 0);
    });

    it("inverts gridToScreen for origin", () => {
      const screen = gridToScreen(0, 0, 800, 600);
      const grid = screenToGrid(screen.x, screen.y, 800, 600);

      expect(grid.x).toBeCloseTo(0, 0);
      expect(grid.y).toBeCloseTo(0, 0);
    });

    it("inverts gridToScreen for various coordinates", () => {
      const testCases = [
        { x: 0, y: 0 },
        { x: 5, y: 5 },
        { x: 9, y: 0 },
        { x: 0, y: 9 },
        { x: 3, y: 7 },
      ];

      for (const tc of testCases) {
        const screen = gridToScreen(tc.x, tc.y, 1024, 768);
        const grid = screenToGrid(screen.x, screen.y, 1024, 768);

        expect(grid.x).toBeCloseTo(tc.x, 5);
        expect(grid.y).toBeCloseTo(tc.y, 5);
      }
    });
  });

  describe("snapToGrid", () => {
    it("snaps screen coordinates to nearest grid cell", () => {
      // Get screen position for grid (3, 4)
      const screen = gridToScreen(3, 4, 800, 600);
      // Add small offset
      const snapped = snapToGrid(screen.x + 5, screen.y + 3, 800, 600);

      expect(snapped.x).toBe(3);
      expect(snapped.y).toBe(4);
    });

    it("rounds to nearest integer", () => {
      const screen = gridToScreen(2, 2, 800, 600);
      const snapped = snapToGrid(screen.x, screen.y, 800, 600);

      expect(snapped.x).toBe(2);
      expect(snapped.y).toBe(2);
    });
  });

  describe("isValidGridPosition", () => {
    it("returns true for valid positions", () => {
      expect(isValidGridPosition(0, 0)).toBe(true);
      expect(isValidGridPosition(5, 5)).toBe(true);
      expect(isValidGridPosition(GRID_SIZE - 1, GRID_SIZE - 1)).toBe(true);
    });

    it("returns false for negative coordinates", () => {
      expect(isValidGridPosition(-1, 0)).toBe(false);
      expect(isValidGridPosition(0, -1)).toBe(false);
      expect(isValidGridPosition(-1, -1)).toBe(false);
    });

    it("returns false for coordinates at or beyond grid size", () => {
      expect(isValidGridPosition(GRID_SIZE, 0)).toBe(false);
      expect(isValidGridPosition(0, GRID_SIZE)).toBe(false);
      expect(isValidGridPosition(GRID_SIZE, GRID_SIZE)).toBe(false);
    });
  });

  describe("constants", () => {
    it("exports expected tile dimensions", () => {
      expect(TILE_WIDTH).toBe(140);
      expect(TILE_HEIGHT).toBe(84);
    });

    it("exports grid size", () => {
      expect(GRID_SIZE).toBe(10);
    });

    it("tile height provides adequate vertical space for labels", () => {
      // Height should be at least half width for proper isometric look
      // but can be taller to accommodate labels
      expect(TILE_HEIGHT).toBeGreaterThanOrEqual(TILE_WIDTH / 2);
    });
  });
});
