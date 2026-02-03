import { select } from "d3-selection";
import type { Selection } from "d3-selection";
import { gridToScreen, TILE_WIDTH, TILE_HEIGHT, GRID_SIZE } from "./isometricUtils";
import { DepositType, PowerState } from "../../../core/models/Grid";
import type { GridPosition } from "../../../core/models/Grid";
import { getFactionColorFromTheme, type FactionId } from "../../utils/ideologyDisplay";

/**
 * Get the SVG symbol ID for a building icon.
 * Icons are defined in BuildingIconDefs.vue as <symbol> elements.
 */
function getIconHref(buildingDefId: string): string {
  return `#building-icon-${buildingDefId}`;
}

/**
 * Render a building icon using SVG <use> to reference a symbol.
 */
function renderIcon(
  parent: Selection<SVGGElement, unknown, null, undefined>,
  buildingDefId: string,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  parent
    .append("use")
    .attr("href", getIconHref(buildingDefId))
    .attr("x", cx - size / 2)
    .attr("y", cy - size / 2)
    .attr("width", size)
    .attr("height", size)
    .attr("stroke", color)
    .attr("fill", "none");
}

export type OccupantFaction = FactionId;

export interface OccupantSlot {
  filled: boolean;
  faction?: OccupantFaction;
}

export interface GridNodeData {
  buildingId?: string;
  buildingDefId?: string;
  buildingName?: string;
  position: GridPosition;
  deposit?: DepositType;
  powerState?: PowerState;
  batteryLevel?: number;
  status?: "pending" | "active" | "disabled" | "idle" | "recycling";
  constructionProgress?: number; // 0-1 for pending buildings
  powerSourceId?: string; // ID of the power source this building is connected to
  clusterId?: string; // ID of the transit cluster this building belongs to
  occupants?: OccupantSlot[]; // Colonists assigned/living in this building
}

export interface BaseGridData {
  cells: GridNodeData[];
  selectedPosition: GridPosition | null;
  /** Building definition ID selected for placement (shows ghost preview) */
  selectedBuildingDefId?: string;
  /** Currently selected building ID (for showing cluster connections) */
  selectedBuildingId?: string;
}

export interface BaseGridOptions {
  width: number;
  height: number;
  panX: number;
  panY: number;
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

function getFactionColor(
  faction: OccupantFaction | undefined,
  colors: ReturnType<typeof getThemeColors>,
): string {
  return getFactionColorFromTheme(faction ?? "neutral", colors);
}

interface ScreenPosition {
  x: number;
  y: number;
}

/**
 * Render cluster connection highlights when a building is selected.
 * Shows visual indicators on all buildings in the same transit cluster.
 */
function renderClusterConnections(
  connectionLayer: Selection<SVGGElement, unknown, null, undefined>,
  selectedBuildingId: string | undefined,
  gridData: GridNodeData[],
  buildingPositions: Map<string, ScreenPosition>,
  colors: ReturnType<typeof getThemeColors>,
): void {
  if (!selectedBuildingId) return;

  // Find the selected building's cluster
  const selectedCell = gridData.find((node) => node.buildingId === selectedBuildingId);
  const clusterId = selectedCell?.clusterId;

  if (!clusterId) return;

  // Find all buildings in the same cluster
  const clusterBuildings = gridData.filter(
    (node) => node.buildingId && node.clusterId === clusterId,
  );

  // Draw highlight circles on cluster buildings (except the selected one)
  for (const node of clusterBuildings) {
    if (!node.buildingId || node.buildingId === selectedBuildingId) continue;

    const pos = buildingPositions.get(node.buildingId);
    if (!pos) continue;

    // Draw a glowing ring around cluster members
    connectionLayer
      .append("circle")
      .attr("class", "transit-connection cluster-highlight")
      .attr("cx", pos.x)
      .attr("cy", pos.y)
      .attr("r", 24)
      .attr("fill", "none")
      .attr("stroke", colors.info)
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5)
      .attr("stroke-dasharray", "4,2")
      .style("pointer-events", "none");
  }

  // Draw a highlight on the selected building to show its cluster membership
  const selectedPos = buildingPositions.get(selectedBuildingId);
  if (selectedPos && clusterBuildings.length > 1) {
    connectionLayer
      .append("circle")
      .attr("class", "transit-connection cluster-selected")
      .attr("cx", selectedPos.x)
      .attr("cy", selectedPos.y)
      .attr("r", 26)
      .attr("fill", "none")
      .attr("stroke", colors.info)
      .attr("stroke-width", 3)
      .attr("stroke-opacity", 0.7)
      .style("pointer-events", "none");
  }
}

export function renderBaseGrid(
  container: SVGSVGElement,
  data: BaseGridData,
  options: BaseGridOptions,
): void {
  const { width, height, panX, panY, onCellClick, onCellHover } = options;
  const colors = getThemeColors();

  const svg = select(container);
  svg.selectAll("*").remove();
  svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  // Background for click-away (fixed, doesn't pan)
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

  // Content group with pan transform
  const contentGroup = svg
    .append("g")
    .attr("class", "content")
    .attr("transform", `translate(${panX}, ${panY})`);

  // Create layer groups - order matters for z-index
  const tileLayer = contentGroup.append("g").attr("class", "tile-layer");
  const depositLayer = contentGroup.append("g").attr("class", "deposit-layer");
  const connectionLayer = contentGroup.append("g").attr("class", "connection-layer");
  const buildingLayer = contentGroup.append("g").attr("class", "building-layer");

  // Build a map of building IDs to their screen positions for connection drawing
  const buildingPositions = new Map<string, { x: number; y: number }>();
  for (const cell of data.cells) {
    if (cell.buildingId) {
      const screen = gridToScreen(cell.position.x, cell.position.y, width, height);
      buildingPositions.set(cell.buildingId, screen);
    }
  }

  // First pass: Render all tiles (bottom layer)
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

      tileLayer
        .append("polygon")
        .attr("points", points)
        .attr("fill", cell?.buildingId ? colors.bgSurface : colors.bgBase)
        .attr("stroke", isSelected ? colors.info : colors.border)
        .attr("stroke-width", isSelected ? 2 : 1)
        .attr("data-x", x)
        .attr("data-y", y)
        .style("cursor", "pointer")
        .on("click", () => onCellClick({ x, y }, !!cell?.buildingId))
        .on("mouseenter", () => onCellHover({ x, y }))
        .on("mouseleave", () => onCellHover(null));
    }
  }

  // Second pass: Render all deposits (middle layer)
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const screen = gridToScreen(x, y, width, height);
      const cell = cellMap.get(`${x},${y}`);

      if (cell?.deposit && !cell.buildingId) {
        const depositColor = cell.deposit === DepositType.WATER ? colors.info : colors.warning;
        depositLayer
          .append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 6)
          .attr("fill", depositColor)
          .attr("opacity", 0.6)
          .style("pointer-events", "none");
      }
    }
  }

  // Third pass: Render power connections
  for (const cell of data.cells) {
    if (cell.buildingId && cell.powerSourceId && cell.powerSourceId !== cell.buildingId) {
      const fromPos = buildingPositions.get(cell.buildingId);
      const toPos = buildingPositions.get(cell.powerSourceId);

      if (fromPos && toPos) {
        connectionLayer
          .append("line")
          .attr("x1", fromPos.x)
          .attr("y1", fromPos.y)
          .attr("x2", toPos.x)
          .attr("y2", toPos.y)
          .attr("stroke", colors.positive)
          .attr("stroke-width", 2)
          .attr("stroke-opacity", 0.4)
          .style("pointer-events", "none");
      }
    }
  }

  // Render cluster connections when a building is selected
  renderClusterConnections(
    connectionLayer,
    data.selectedBuildingId,
    data.cells,
    buildingPositions,
    colors,
  );

  // Fourth pass: Render all buildings and ghost previews (top layer)
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const screen = gridToScreen(x, y, width, height);
      const cell = cellMap.get(`${x},${y}`);
      const isSelected = data.selectedPosition?.x === x && data.selectedPosition?.y === y;

      // Building node
      if (cell?.buildingId) {
        const isPending = cell.status === "pending";
        const nodeG = buildingLayer
          .append("g")
          .attr("class", "building-node")
          .attr("opacity", isPending ? 0.7 : 1)
          .style("cursor", "pointer")
          .on("click", (event: MouseEvent) => {
            event.stopPropagation();
            onCellClick({ x, y }, true);
          });

        // Building circle
        const circle = nodeG
          .append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 18)
          .attr("fill", colors.bgSurface)
          .attr("stroke", isPending ? colors.info : getPowerStateColor(cell.powerState, colors))
          .attr("stroke-width", 2);

        if (isPending) {
          circle.attr("stroke-dasharray", "4,2");
        }

        // Building icon
        if (cell.buildingDefId) {
          renderIcon(
            nodeG,
            cell.buildingDefId,
            screen.x,
            screen.y,
            18,
            isPending ? colors.info : colors.text,
          );
        }

        // Building label - show progress for pending, name for active
        const labelText = isPending
          ? `${Math.round((cell.constructionProgress ?? 0) * 100)}%`
          : (cell.buildingName?.substring(0, 10) ?? "");
        nodeG
          .append("text")
          .attr("x", screen.x)
          .attr("y", screen.y + 32)
          .attr("text-anchor", "middle")
          .attr("fill", isPending ? colors.info : colors.textMuted)
          .attr("font-size", "10px")
          .attr("font-family", "var(--g-font-mono)")
          .text(labelText);

        // Power state indicator (small dot) - only for non-pending buildings
        if (!isPending && cell.powerState && cell.powerState !== PowerState.POWERED) {
          nodeG
            .append("circle")
            .attr("cx", screen.x + 12)
            .attr("cy", screen.y - 12)
            .attr("r", 5)
            .attr("fill", getPowerStateColor(cell.powerState, colors));
        }

        // Occupant dots - only for non-pending buildings with occupants
        if (!isPending && cell.occupants && cell.occupants.length > 0) {
          const dotSize = 6; // 0.75rem ≈ 12px, but 6px radius looks better on grid
          const dotSpacing = 14;
          const totalWidth = (cell.occupants.length - 1) * dotSpacing;
          const startX = screen.x - totalWidth / 2;
          const dotY = screen.y - 28; // Above the building

          cell.occupants.forEach((occupant, i) => {
            const dotX = startX + i * dotSpacing;
            const dotColor = getFactionColor(occupant.faction, colors);

            if (occupant.filled) {
              // Filled dot - solid with border
              nodeG
                .append("circle")
                .attr("cx", dotX)
                .attr("cy", dotY)
                .attr("r", dotSize)
                .attr("fill", dotColor)
                .attr("stroke", colors.bgSurface)
                .attr("stroke-width", 2);
            } else {
              // Empty slot - border only
              nodeG
                .append("circle")
                .attr("cx", dotX)
                .attr("cy", dotY)
                .attr("r", dotSize)
                .attr("fill", "none")
                .attr("stroke", colors.border)
                .attr("stroke-width", 2);
            }
          });
        }
      }

      // Ghost preview for selected building to place
      if (!cell?.buildingId && data.selectedBuildingDefId && isSelected) {
        const ghostG = buildingLayer.append("g").attr("opacity", 0.6);

        ghostG
          .append("circle")
          .attr("cx", screen.x)
          .attr("cy", screen.y)
          .attr("r", 18)
          .attr("fill", colors.bgSurface)
          .attr("stroke", colors.info)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "4,2");

        renderIcon(
          ghostG as Selection<SVGGElement, unknown, null, undefined>,
          data.selectedBuildingDefId,
          screen.x,
          screen.y,
          18,
          colors.info,
        );
      }
    }
  }
}
