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

// Using theme colors from tokens/theme.css
const FACTION_COLORS: Record<NPCFaction, string> = {
  [NPCFaction.EarthLoyalists]: "#00838f", // --g-color-info (cyan)
  [NPCFaction.MarsIndependence]: "#2e7d32", // --g-color-positive (green)
  [NPCFaction.CorporateInterests]: "#ef6c00", // --g-color-warning (amber)
};

const EDGE_COLOR = "#1a1a1a"; // --g-color-border-strong
const TEXT_COLOR = "#1a1a1a"; // --g-color-text

const NODE_RADIUS = 20;

export function renderGraph(
  container: SVGSVGElement,
  data: GraphData,
  options: RenderOptions,
): void {
  const { width, height, selectedId, onNodeClick } = options;
  const svg = select(container);

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
      ? "rgba(46, 125, 50, 0.6)" // --g-color-positive with opacity
      : `${EDGE_COLOR}33`; // --g-color-border-strong with 20% opacity
    const strokeWidth = Math.max(1, link.weight * 4);

    edgesGroup
      .append("line")
      .attr("x1", source.x)
      .attr("y1", source.y)
      .attr("x2", target.x)
      .attr("y2", target.y)
      .attr("stroke", strokeColor)
      .attr("stroke-width", strokeWidth);
  }

  // Render nodes
  const nodesGroup = svg.append("g").attr("class", "nodes");

  for (const node of data.nodes) {
    const isSelected = node.id === selectedId;
    const factionColor = FACTION_COLORS[node.npc.faction];

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
      .attr("fill", "white")
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
        .attr("stroke", "rgba(46, 125, 50, 0.4)") // --g-color-positive with opacity
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
      .attr("fill", TEXT_COLOR)
      .attr("font-size", "10px")
      .attr("font-family", "monospace")
      .text(lastName);
  }
}
