export const TILE_WIDTH = 80;
export const TILE_HEIGHT = 48;
export const GRID_SIZE = 10;

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface GridCoord {
  x: number;
  y: number;
}

/**
 * Convert grid coordinates to screen position (isometric projection).
 * Grid (0,0) is at top-center of the view.
 *
 * In isometric projection:
 * - Moving +x goes down-right
 * - Moving +y goes down-left
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  viewWidth: number,
  _viewHeight: number,
): ScreenPosition {
  // Isometric projection formulas
  const isoX = (gridX - gridY) * (TILE_WIDTH / 2);
  const isoY = (gridX + gridY) * (TILE_HEIGHT / 2);

  // Center the grid in the view
  const centerOffsetX = viewWidth / 2;
  const centerOffsetY = TILE_HEIGHT * 2; // Some padding from top

  return {
    x: isoX + centerOffsetX,
    y: isoY + centerOffsetY,
  };
}

/**
 * Convert screen position back to grid coordinates.
 * Returns floating point - caller should round as needed.
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  viewWidth: number,
  _viewHeight: number,
): GridCoord {
  // Reverse the offset
  const centerOffsetX = viewWidth / 2;
  const centerOffsetY = TILE_HEIGHT * 2;

  const isoX = screenX - centerOffsetX;
  const isoY = screenY - centerOffsetY;

  // Reverse isometric projection
  const gridX = (isoX / (TILE_WIDTH / 2) + isoY / (TILE_HEIGHT / 2)) / 2;
  const gridY = (isoY / (TILE_HEIGHT / 2) - isoX / (TILE_WIDTH / 2)) / 2;

  return { x: gridX, y: gridY };
}

/**
 * Snap screen coordinates to nearest grid cell.
 */
export function snapToGrid(
  screenX: number,
  screenY: number,
  viewWidth: number,
  viewHeight: number,
): GridCoord {
  const grid = screenToGrid(screenX, screenY, viewWidth, viewHeight);
  return {
    x: Math.round(grid.x),
    y: Math.round(grid.y),
  };
}

/**
 * Check if grid coordinates are within bounds.
 */
export function isValidGridPosition(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}
