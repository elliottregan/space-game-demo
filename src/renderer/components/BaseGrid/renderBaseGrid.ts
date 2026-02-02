import { select } from "d3-selection";
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT, GRID_SIZE } from "./isometricUtils";
import { DepositType, PowerState } from "../../../core/models/Grid";
import type { GridPosition } from "../../../core/models/Grid";

export interface GridNodeData {
  buildingId?: string;
  buildingName?: string;
  buildingIcon?: string;
  position: GridPosition;
  deposit?: DepositType;
  powerState?: PowerState;
  batteryLevel?: number;
}

export interface BaseGridData {
  cells: GridNodeData[];
  selectedPosition: GridPosition | null;
}

export interface BaseGridOptions {
  width: number;
  height: number;
  onCellClick: (position: GridPosition, hasBuilding: boolean) => void;
  onCellHover: (position: GridPosition | null) => void;
}

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    bgBase: style.getPropertyValue("--g-color-bg-base").trim() || "#1a1a2e",
    bgSurface: style.getPropertyValue("--g-color-bg-surface").trim() || "#252540",
    border: style.getPropertyValue("--g-color-border").trim() || "#3a3a5c",
    text: style.getPropertyValue("--g-color-text").trim() || "#e0e0e0",
    textMuted: style.getPropertyValue("--g-color-text-muted").trim() || "#888",
    positive: style.getPropertyValue("--g-color-positive").trim() || "#4caf50",
    warning: style.getPropertyValue("--g-color-warning").trim() || "#ff9800",
    danger: style.getPropertyValue("--g-color-danger").trim() || "#f44336",
    info: style.getPropertyValue("--g-color-info").trim() || "#2196f3",
  };
}

function getPowerStateColor(
  state: PowerState | undefined,
  colors: ReturnType<typeof getThemeColors>,
): string {
  switch (state) {
    case PowerState.POWERED:
      return colors.positive;
    case PowerState.ON_BATTERY:
      return colors.warning;
    case PowerState.LOW_BATTERY:
      return colors.danger;
    case PowerState.UNPOWERED:
      return colors.textMuted;
    default:
      return colors.border;
  }
}

function getPowerStateIcon(state: PowerState): string {
  switch (state) {
    case PowerState.ON_BATTERY:
      return "\u{1F50B}"; // battery emoji
    case PowerState.LOW_BATTERY:
      return "\u{1FAAB}"; // low battery emoji
    case PowerState.UNPOWERED:
      return "\u{26D4}"; // no entry emoji
    default:
      return "";
  }
}

export function renderBaseGrid(
  container: SVGSVGElement,
  data: BaseGridData,
  options: BaseGridOptions,
): void {
  const { width, height, onCellClick, onCellHover } = options;
  const colors = getThemeColors();

  const svg = select(container);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  // Background for click-away
  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", colors.bgBase)
    .on("click", () => onCellClick({ x: -1, y: -1 }, false));

  // Create cell lookup
  const cellMap = new Map<string, GridNodeData>();
  for (const cell of data.cells) {
    cellMap.set(`${cell.position.x},${cell.position.y}`, cell);
  }

  // Render grid cells
  const cellGroup = svg.append("g").attr("class", "grid-cells");

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const screen = gridToScreen(x, y, width, height);
      const cell = cellMap.get(`${x},${y}`);
      const isSelected = data.selectedPosition?.x === x && data.selectedPosition?.y === y;

      // Diamond shape for isometric tile
      const points = [
        [screen.x, screen.y - TILE_HEIGHT / 2],
        [screen.x + TILE_WIDTH / 2, screen.y],
        [screen.x, screen.y + TILE_HEIGHT / 2],
        [screen.x - TILE_WIDTH / 2, screen.y],
      ]
        .map((p) => p.join(","))
        .join(" ");

      const cellG = cellGroup
        .append("g")
        .attr("class", "grid-cell")
        .attr("data-x", x)
        .attr("data-y", y);

      // Base tile
      cellG
        .append("polygon")
        .attr("points", points)
        .attr("fill", cell?.buildingId ? colors.bgSurface : colors.bgBase)
        .attr("stroke", isSelected ? colors.info : colors.border)
        .attr("stroke-width", isSelected ? 2 : 1)
        .style("cursor", "pointer")
        .on("click", () => onCellClick({ x, y }, !!cell?.buildingId))
        .on("mouseenter", () => onCellHover({ x, y }))
        .on("mouseleave", () => onCellHover(null));

      // Deposit indicator
      if (cell?.deposit && !cell.buildingId) {
        const depositColor = cell.deposit === DepositType.WATER ? colors.info : colors.warning;
        cellG
          .append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 6)
          .attr("fill", depositColor)
          .attr("opacity", 0.6)
          .style("pointer-events", "none");
      }

      // Building node
      if (cell?.buildingId) {
        // Building circle
        cellG
          .append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 14)
          .attr("fill", colors.bgSurface)
          .attr("stroke", getPowerStateColor(cell.powerState, colors))
          .attr("stroke-width", 2);

        // Building label
        cellG
          .append("text")
          .attr("x", screen.x)
          .attr("y", screen.y + 24)
          .attr("text-anchor", "middle")
          .attr("fill", colors.textMuted)
          .attr("font-size", "9px")
          .attr("font-family", "var(--g-font-mono)")
          .text(cell.buildingName?.substring(0, 8) ?? "");

        // Power state icon
        if (cell.powerState && cell.powerState !== PowerState.POWERED) {
          cellG
            .append("text")
            .attr("x", screen.x)
            .attr("y", screen.y + 4)
            .attr("text-anchor", "middle")
            .attr("fill", getPowerStateColor(cell.powerState, colors))
            .attr("font-size", "12px")
            .text(getPowerStateIcon(cell.powerState));
        }
      }
    }
  }
}
