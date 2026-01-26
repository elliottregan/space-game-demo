import { select } from "d3-selection";
import { type NPC, NPCFaction } from "../../../core/models/NPCInfluence";
import type { PositionedNode } from "../../utils/forceLayout";

export interface GraphNode extends PositionedNode {
  npc: NPC;
  supportLevel: number | null;
  inCouncil: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
  inSameCouncil: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface RenderOptions {
  width: number;
  height: number;
  selectedId: string | null;
  onNodeClick: (npcId: string | null) => void;
}

const NODE_RADIUS = 20;

// Get theme colors from CSS variables
function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue("--g-color-text").trim() || "#1a1a1a",
    border: style.getPropertyValue("--g-color-border-strong").trim() || "#1a1a1a",
    bgSurface: style.getPropertyValue("--g-color-bg-surface").trim() || "#f5f5f5",
    info: style.getPropertyValue("--g-color-info").trim() || "#00838f",
    positive: style.getPropertyValue("--g-color-positive").trim() || "#2e7d32",
    warning: style.getPropertyValue("--g-color-warning").trim() || "#ef6c00",
  };
}

function getFactionColor(faction: NPCFaction, colors: ReturnType<typeof getThemeColors>): string {
  switch (faction) {
    case NPCFaction.EarthLoyalists:
      return colors.info;
    case NPCFaction.MarsIndependence:
      return colors.positive;
    case NPCFaction.CorporateInterests:
      return colors.warning;
    default:
      return colors.text;
  }
}

export function renderGraph(
  container: SVGSVGElement,
  data: GraphData,
  options: RenderOptions,
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

  // Render edges (behind nodes)
  const edgesGroup = svg.append("g").attr("class", "edges");

  for (const link of data.links) {
    const source = nodePositions.get(link.source);
    const target = nodePositions.get(link.target);
    if (!source || !target) continue;

    const strokeColor = link.inSameCouncil
      ? colors.positive
      : colors.border;
    const strokeWidth = Math.max(1, link.weight * 4);

    edgesGroup
      .append("line")
      .attr("x1", source.x)
      .attr("y1", source.y)
      .attr("x2", target.x)
      .attr("y2", target.y)
      .attr("stroke", strokeColor)
      .attr("stroke-opacity", link.inSameCouncil ? 0.6 : 0.3)
      .attr("stroke-width", strokeWidth);
  }

  // Render nodes
  const nodesGroup = svg.append("g").attr("class", "nodes");

  for (const node of data.nodes) {
    const isSelected = node.id === selectedId;
    const factionColor = getFactionColor(node.npc.faction, colors);

    const nodeGroup = nodesGroup
      .append("g")
      .attr("class", "node")
      .attr("transform", `translate(${node.x}, ${node.y})`)
      .attr("cursor", "pointer")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        onNodeClick(node.id);
      });

    // Node circle
    nodeGroup
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", colors.bgSurface)
      .attr("stroke", factionColor)
      .attr("stroke-width", isSelected ? 3 : 1.5);

    // Drop shadow for selected
    if (isSelected) {
      nodeGroup.select("circle").attr("filter", "drop-shadow(0 0 4px rgba(255,255,255,0.5))");
    }

    // Council glow
    if (node.inCouncil) {
      nodeGroup
        .insert("circle", "circle")
        .attr("r", NODE_RADIUS + 4)
        .attr("fill", "none")
        .attr("stroke", colors.positive)
      .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 2);
    }

    // NPC initials
    const initials = node.npc.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2);

    nodeGroup
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", factionColor)
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .attr("font-family", "system-ui, sans-serif")
      .text(initials);

    // NPC name label below
    const lastName = node.npc.name.split(" ").pop() ?? "";
    nodeGroup
      .append("text")
      .attr("y", NODE_RADIUS + 14)
      .attr("text-anchor", "middle")
      .attr("fill", colors.text)
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text(lastName);
  }
}
