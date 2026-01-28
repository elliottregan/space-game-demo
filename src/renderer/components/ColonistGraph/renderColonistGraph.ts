import { select } from "d3-selection";
import { type Colonist, ColonistRole } from "../../../core/models/Colonist";
import type { PositionedColonist } from "../../utils/colonistForceLayout";

export interface ColonistGraphNode extends PositionedColonist {
  colonist: Colonist;
  isWorking: boolean;
  buildingName?: string;
}

export type RelationshipType = "coworker" | "housemate" | "both";

export interface ColonistGraphLink {
  source: string;
  target: string;
  weight: number;
  type: RelationshipType;
}

export interface ColonistGraphData {
  nodes: ColonistGraphNode[];
  links: ColonistGraphLink[];
}

export interface ColonistRenderOptions {
  width: number;
  height: number;
  selectedId: string | null;
  onNodeClick: (colonistId: string | null) => void;
}

const NODE_RADIUS = 18;

// Get theme colors from CSS variables
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue("--g-color-text").trim() || "#1a1a1a",
    textMuted: style.getPropertyValue("--g-color-text-muted").trim() || "#666666",
    border: style.getPropertyValue("--g-color-border-strong").trim() || "#1a1a1a",
    bgSurface: style.getPropertyValue("--g-color-bg-surface").trim() || "#f5f5f5",
    info: style.getPropertyValue("--g-color-info").trim() || "#00838f",
    positive: style.getPropertyValue("--g-color-positive").trim() || "#2e7d32",
    warning: style.getPropertyValue("--g-color-warning").trim() || "#ef6c00",
    danger: style.getPropertyValue("--g-color-danger").trim() || "#c62828",
  };
}

function getRoleColor(role: ColonistRole, colors: ReturnType<typeof getThemeColors>): string {
  switch (role) {
    case ColonistRole.RESEARCH:
      return colors.info; // Blue
    case ColonistRole.ENGINEERING:
      return colors.warning; // Orange
    case ColonistRole.FARMING:
      return colors.positive; // Green
    case ColonistRole.CIVIL_SCIENCE:
      return "#9c27b0"; // Purple
    case ColonistRole.UNASSIGNED:
    default:
      return colors.textMuted; // Gray
  }
}

function getLinkColor(type: RelationshipType, colors: ReturnType<typeof getThemeColors>): string {
  switch (type) {
    case "coworker":
      return colors.warning; // Orange for work
    case "housemate":
      return colors.info; // Blue for housing
    case "both":
      return colors.positive; // Green for both
    default:
      return colors.border;
  }
}

export function renderColonistGraph(
  container: SVGSVGElement,
  data: ColonistGraphData,
  options: ColonistRenderOptions,
): void {
  const { width, height, selectedId, onNodeClick } = options;
  const svg = select(container);
  const colors = getThemeColors();

  // Clear previous content
  svg.selectAll("*").remove();

  // Set dimensions
  svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);

  // Background click to deselect
  svg
    .append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .on("click", () => onNodeClick(null));

  // Create node position lookup
  const nodePositions = new Map(data.nodes.map((n) => [n.id, n]));

  // Define dashed pattern for housemate-only links
  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "housing-pattern")
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("refX", 2)
    .attr("refY", 2)
    .append("circle")
    .attr("cx", 2)
    .attr("cy", 2)
    .attr("r", 1)
    .attr("fill", colors.info);

  // Render edges (behind nodes)
  const edgesGroup = svg.append("g").attr("class", "edges");

  for (const link of data.links) {
    const source = nodePositions.get(link.source);
    const target = nodePositions.get(link.target);
    if (!source || !target) continue;

    const strokeColor = getLinkColor(link.type, colors);
    const strokeWidth = Math.max(1.5, link.weight * 5);
    const isDashed = link.type === "housemate";
    const opacity = link.type === "both" ? 0.7 : 0.5;

    edgesGroup
      .append("line")
      .attr("x1", source.x)
      .attr("y1", source.y)
      .attr("x2", target.x)
      .attr("y2", target.y)
      .attr("stroke", strokeColor)
      .attr("stroke-opacity", opacity)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-dasharray", isDashed ? "6,4" : "none");
  }

  // Render nodes
  const nodesGroup = svg.append("g").attr("class", "nodes");

  for (const node of data.nodes) {
    const isSelected = node.id === selectedId;
    const roleColor = getRoleColor(node.colonist.role, colors);

    const nodeGroup = nodesGroup
      .append("g")
      .attr("class", "node")
      .attr("transform", `translate(${node.x}, ${node.y})`)
      .attr("cursor", "pointer")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        onNodeClick(node.id);
      });

    // Working glow (if colonist is assigned to active building)
    if (node.isWorking) {
      nodeGroup
        .append("circle")
        .attr("r", NODE_RADIUS + 5)
        .attr("fill", "none")
        .attr("stroke", colors.positive)
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 2);
    }

    // Node circle
    nodeGroup
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", colors.bgSurface)
      .attr("stroke", roleColor)
      .attr("stroke-width", isSelected ? 3 : 2);

    // Drop shadow for selected
    if (isSelected) {
      nodeGroup.select("circle").attr("filter", "drop-shadow(0 0 4px rgba(255,255,255,0.5))");
    }

    // Colonist initials
    const initials = node.colonist.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2);

    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", roleColor)
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, sans-serif")
      .text(initials);

    // Colonist name label below
    const displayName = node.colonist.name.split(" ").pop() ?? "";
    nodeGroup
      .append("text")
      .attr("y", NODE_RADIUS + 12)
      .attr("text-anchor", "middle")
      .attr("fill", colors.text)
      .attr("font-size", "9px")
      .attr("font-family", "monospace")
      .text(displayName.length > 8 ? displayName.slice(0, 7) + "…" : displayName);
  }
}
