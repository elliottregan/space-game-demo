import { polygonHull } from "d3-polygon";
import { select } from "d3-selection";
import type { Colonist, ColonistIdeology } from "../../../core/models/Colonist";
import type { PositionedColonist } from "../../utils/ColonistSimulationManager";
import {
  getIdeologyColorForGraph,
  getAxisColorFromTheme,
  getDominantAxisHexColor,
  type AxisId,
} from "../../utils/ideologyDisplay";

export interface IdeologyPressureData {
  pressure: { solidarity: number; sovereignty: number; transformation: number };
  totalWeight: number;
  neighborCount: number;
}

export interface ColonistGraphNode extends PositionedColonist {
  colonist: Colonist;
  isWorking: boolean;
  buildingName?: string;
  guildCount: number;
  isBridge: boolean;
  connectionCount: number;
  ideologyPressure?: IdeologyPressureData | null;
}

export type RelationshipType = "coworker" | "housemate" | "both" | "guild" | "social";

export interface ColonistGraphLink {
  source: string;
  target: string;
  weight: number;
  type: RelationshipType;
  isWeakTie: boolean;
  isCohort: boolean;
  hasSharedGuild: boolean;
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
  showWeakTies?: boolean;
  showPressureArrows?: boolean;
  pocketAssignments?: Map<string, number>;
  showPockets?: boolean;
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

function getIdeologyColor(
  ideology: ColonistIdeology | undefined,
  colors: ReturnType<typeof getThemeColors>,
): string {
  return getIdeologyColorForGraph(ideology, colors);
}

function getDominantPressureColor(
  pressure: { solidarity: number; sovereignty: number; transformation: number },
  colors: ReturnType<typeof getThemeColors>,
): { color: string; axis: AxisId | "mixed" } | null {
  const { solidarity, sovereignty, transformation } = pressure;
  const max = Math.max(solidarity, sovereignty, transformation);

  // If pressure is too low, don't show an arrow
  if (max < 0.15) return null;

  // Determine dominant axis with threshold for clear dominance
  const threshold = 0.1;
  if (
    solidarity >= max - 0.01 &&
    solidarity - sovereignty >= threshold &&
    solidarity - transformation >= threshold
  ) {
    return { color: getAxisColorFromTheme("solidarity", colors), axis: "solidarity" };
  }
  if (
    sovereignty >= max - 0.01 &&
    sovereignty - solidarity >= threshold &&
    sovereignty - transformation >= threshold
  ) {
    return { color: getAxisColorFromTheme("sovereignty", colors), axis: "sovereignty" };
  }
  if (
    transformation >= max - 0.01 &&
    transformation - solidarity >= threshold &&
    transformation - sovereignty >= threshold
  ) {
    return { color: getAxisColorFromTheme("transformation", colors), axis: "transformation" };
  }

  // Mixed pressure
  return { color: colors.textMuted, axis: "mixed" };
}

function getLinkColor(
  type: RelationshipType,
  hasSharedGuild: boolean,
  colors: ReturnType<typeof getThemeColors>,
): string {
  // Guild connections get a special purple tint
  if (hasSharedGuild && type !== "both") {
    return "#9c27b0"; // Purple for guild connections
  }

  switch (type) {
    case "coworker":
      return colors.warning; // Orange for work
    case "housemate":
      return colors.info; // Blue for housing
    case "both":
      return colors.positive; // Green for both
    case "guild":
      return "#9c27b0"; // Purple for guild-only
    case "social":
      return colors.textMuted; // Gray for social/random connections
    default:
      return colors.border;
  }
}

export function renderColonistGraph(
  container: SVGSVGElement,
  data: ColonistGraphData,
  options: ColonistRenderOptions,
): void {
  const {
    width,
    height,
    selectedId,
    onNodeClick,
    showWeakTies = false,
    showPressureArrows = true,
    pocketAssignments,
    showPockets = false,
  } = options;
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

  // Define arrowhead markers for pressure arrows (one per faction color)
  const factionColors = [
    { id: "pressure-arrow-earth", color: colors.info },
    { id: "pressure-arrow-mars", color: colors.positive },
    { id: "pressure-arrow-corporate", color: colors.warning },
    { id: "pressure-arrow-mixed", color: colors.textMuted },
  ];
  for (const { id, color } of factionColors) {
    defs
      .append("marker")
      .attr("id", id)
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 9)
      .attr("refY", 5)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M 1 1 L 9 5 L 1 9")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
  }

  // Render edges (behind nodes)
  const edgesGroup = svg.append("g").attr("class", "edges");

  for (const link of data.links) {
    // Skip weak ties if not showing them
    if (link.isWeakTie && !showWeakTies) continue;

    const source = nodePositions.get(link.source);
    const target = nodePositions.get(link.target);
    if (!source || !target) continue;

    const strokeColor = getLinkColor(link.type, link.hasSharedGuild, colors);

    // Weak ties are thinner
    const baseWidth = link.isWeakTie ? 1 : 1.5;
    const strokeWidth = Math.max(baseWidth, link.weight * 5);

    // Determine dash pattern
    let dashArray = "none";
    if (link.isWeakTie) {
      dashArray = "2,3"; // Dotted for weak ties
    } else if (link.type === "housemate") {
      dashArray = "6,4"; // Dashed for housemates
    } else if (link.type === "guild" || link.type === "social") {
      dashArray = "4,2"; // Short dash for guild/social
    }

    // Opacity based on relationship strength and type
    let opacity = link.type === "both" ? 0.7 : 0.5;
    if (link.isWeakTie) {
      opacity = 0.3; // More transparent for weak ties
    }
    if (link.isCohort) {
      opacity = Math.min(1, opacity + 0.1); // Slightly more visible for cohort connections
    }

    edgesGroup
      .append("line")
      .attr("x1", source.x)
      .attr("y1", source.y)
      .attr("x2", target.x)
      .attr("y2", target.y)
      .attr("stroke", strokeColor)
      .attr("stroke-opacity", opacity)
      .attr("stroke-width", strokeWidth)
      .attr("stroke-dasharray", dashArray);
  }

  // Render ideology pocket hulls
  if (showPockets && pocketAssignments && pocketAssignments.size > 0) {
    const pocketsGroup = svg.append("g").attr("class", "pockets");

    // Group nodes by pocket ID, skip -1 (noise)
    const pocketGroups = new Map<number, ColonistGraphNode[]>();
    for (const node of data.nodes) {
      const pocketId = pocketAssignments.get(node.id);
      if (pocketId === undefined || pocketId === -1) continue;
      if (!pocketGroups.has(pocketId)) pocketGroups.set(pocketId, []);
      pocketGroups.get(pocketId)!.push(node);
    }

    const HULL_PADDING = NODE_RADIUS + 8;

    for (const [, members] of pocketGroups) {
      // Compute centroid of pocket ideology for color
      let sumS = 0,
        sumSov = 0,
        sumT = 0;
      for (const m of members) {
        if (m.colonist.ideology) {
          sumS += m.colonist.ideology.solidarity;
          sumSov += m.colonist.ideology.sovereignty;
          sumT += m.colonist.ideology.transformation;
        }
      }
      const n = members.length;
      const centroidIdeology = {
        solidarity: sumS / n,
        sovereignty: sumSov / n,
        transformation: sumT / n,
      };
      const hullColor = getDominantAxisHexColor(centroidIdeology);

      if (members.length >= 3) {
        // Convex hull
        const screenPoints: [number, number][] = members.map((m) => [m.x, m.y]);
        const hull = polygonHull(screenPoints);
        if (hull) {
          // Compute hull centroid for padding offset
          let cx = 0,
            cy = 0;
          for (const [hx, hy] of hull) {
            cx += hx;
            cy += hy;
          }
          cx /= hull.length;
          cy /= hull.length;

          // Offset each hull point outward from centroid
          const padded = hull.map(([hx, hy]): [number, number] => {
            const dx = hx - cx;
            const dy = hy - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) return [hx, hy];
            return [hx + (dx / dist) * HULL_PADDING, hy + (dy / dist) * HULL_PADDING];
          });

          // Build a smooth closed path using cubic bezier curves for rounded corners
          const pathParts: string[] = [];
          const len = padded.length;
          for (let i = 0; i < len; i++) {
            const p0 = padded[(i - 1 + len) % len]!;
            const p1 = padded[i]!;
            const p2 = padded[(i + 1) % len]!;

            // Midpoints
            const m1x = (p0[0] + p1[0]) / 2;
            const m1y = (p0[1] + p1[1]) / 2;
            const m2x = (p1[0] + p2[0]) / 2;
            const m2y = (p1[1] + p2[1]) / 2;

            if (i === 0) {
              pathParts.push(`M ${m1x} ${m1y}`);
            }
            pathParts.push(`Q ${p1[0]} ${p1[1]} ${m2x} ${m2y}`);
          }
          pathParts.push("Z");

          pocketsGroup
            .append("path")
            .attr("d", pathParts.join(" "))
            .attr("fill", hullColor)
            .attr("fill-opacity", 0.08)
            .attr("stroke", hullColor)
            .attr("stroke-opacity", 0.25)
            .attr("stroke-width", 1.5);
        }
      } else if (members.length === 2) {
        // Capsule between two nodes
        const [a, b] = members;
        const mx = (a!.x + b!.x) / 2;
        const my = (a!.y + b!.y) / 2;
        const dx = b!.x - a!.x;
        const dy = b!.y - a!.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const rx = dist / 2 + HULL_PADDING;
        const ry = HULL_PADDING;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

        pocketsGroup
          .append("ellipse")
          .attr("cx", mx)
          .attr("cy", my)
          .attr("rx", rx)
          .attr("ry", ry)
          .attr("transform", `rotate(${angle}, ${mx}, ${my})`)
          .attr("fill", hullColor)
          .attr("fill-opacity", 0.08)
          .attr("stroke", hullColor)
          .attr("stroke-opacity", 0.25)
          .attr("stroke-width", 1.5);
      } else {
        // Single node - circle around it
        const node = members[0]!;
        pocketsGroup
          .append("circle")
          .attr("cx", node.x)
          .attr("cy", node.y)
          .attr("r", HULL_PADDING)
          .attr("fill", hullColor)
          .attr("fill-opacity", 0.08)
          .attr("stroke", hullColor)
          .attr("stroke-opacity", 0.25)
          .attr("stroke-width", 1.5);
      }
    }
  }

  // Render ideology pressure arrows (between connected nodes)
  if (showPressureArrows) {
    const pressureGroup = svg.append("g").attr("class", "pressure-arrows");

    for (const node of data.nodes) {
      if (!node.ideologyPressure || node.ideologyPressure.neighborCount === 0) continue;

      const pressureInfo = getDominantPressureColor(node.ideologyPressure.pressure, colors);
      if (!pressureInfo) continue;

      // Find the neighbor with the strongest influence toward the dominant pressure
      let strongestNeighborId: string | null = null;
      let strongestWeight = 0;

      for (const link of data.links) {
        if (link.isWeakTie && !showWeakTies) continue;

        let neighborId: string | null = null;
        if (link.source === node.id) neighborId = link.target;
        else if (link.target === node.id) neighborId = link.source;
        else continue;

        const neighborNode = data.nodes.find((n) => n.id === neighborId);
        if (!neighborNode?.colonist.ideology) continue;

        // Check if this neighbor is pushing toward the dominant pressure axis
        const neighborIdeology = neighborNode.colonist.ideology;
        const neighborAxisValue =
          pressureInfo.axis !== "mixed" ? neighborIdeology[pressureInfo.axis] : 0;

        // Weight by relationship strength and neighbor's axis value
        const weight = link.weight * neighborAxisValue;
        if (weight > strongestWeight) {
          strongestWeight = weight;
          strongestNeighborId = neighborId;
        }
      }

      if (!strongestNeighborId) continue;

      const neighborNode = data.nodes.find((n) => n.id === strongestNeighborId);
      if (!neighborNode) continue;

      // Draw curved arrow from neighbor to this node (pressure flows toward the node)
      const dx = node.x - neighborNode.x;
      const dy = node.y - neighborNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      // Normalize direction
      const nx = dx / dist;
      const ny = dy / dist;

      // Perpendicular vector for curve offset
      const px = -ny;
      const py = nx;

      // Rotate connection points slightly toward the curve direction
      const angleOffset = 0.25; // radians, ~14 degrees
      const startNx = nx * Math.cos(angleOffset) - ny * Math.sin(angleOffset);
      const startNy = nx * Math.sin(angleOffset) + ny * Math.cos(angleOffset);
      const endNx = nx * Math.cos(-angleOffset) - ny * Math.sin(-angleOffset);
      const endNy = nx * Math.sin(-angleOffset) + ny * Math.cos(-angleOffset);

      // Start from edge of neighbor node, end at edge of target node
      const startX = neighborNode.x + startNx * (NODE_RADIUS + 4);
      const startY = neighborNode.y + startNy * (NODE_RADIUS + 4);
      const endX = node.x - endNx * (NODE_RADIUS + 8);
      const endY = node.y - endNy * (NODE_RADIUS + 8);

      // Control point offset perpendicular to the line (creates the curve)
      const curveOffset = dist * 0.15;
      const ctrlX = (startX + endX) / 2 + px * curveOffset;
      const ctrlY = (startY + endY) / 2 + py * curveOffset;

      const markerId = `pressure-arrow-${pressureInfo.axis}`;

      // Draw quadratic bezier curve
      pressureGroup
        .append("path")
        .attr("d", `M ${startX} ${startY} Q ${ctrlX} ${ctrlY} ${endX} ${endY}`)
        .attr("fill", "none")
        .attr("stroke", pressureInfo.color)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "5,3")
        .attr("marker-end", `url(#${markerId})`)
        .attr("opacity", 0.75);
    }
  }

  // Render nodes
  const nodesGroup = svg.append("g").attr("class", "nodes");

  for (const node of data.nodes) {
    const isSelected = node.id === selectedId;
    const ideologyColor = getIdeologyColor(node.colonist.ideology, colors);

    const nodeGroup = nodesGroup
      .append("g")
      .attr("class", "node")
      .attr("transform", `translate(${node.x}, ${node.y})`)
      .attr("cursor", "pointer")
      .on("click", (event: MouseEvent) => {
        event.stopPropagation();
        onNodeClick(node.id);
      });

    // Bridge colonist glow (connects different groups)
    if (node.isBridge) {
      nodeGroup
        .append("circle")
        .attr("r", NODE_RADIUS + 8)
        .attr("fill", "none")
        .attr("stroke", "#9c27b0") // Purple for bridges
        .attr("stroke-opacity", 0.3)
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "4,2");
    }

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
      .attr("stroke", ideologyColor)
      .attr("stroke-width", isSelected ? 3 : 2);

    // Drop shadow for selected
    if (isSelected) {
      nodeGroup.select("circle").attr("filter", "drop-shadow(0 0 4px rgba(255,255,255,0.5))");
    }

    // Guild badge (small circle with count)
    if (node.guildCount > 0) {
      nodeGroup
        .append("circle")
        .attr("cx", NODE_RADIUS - 4)
        .attr("cy", -NODE_RADIUS + 4)
        .attr("r", 7)
        .attr("fill", "#9c27b0")
        .attr("stroke", colors.bgSurface)
        .attr("stroke-width", 1);

      nodeGroup
        .append("text")
        .attr("x", NODE_RADIUS - 4)
        .attr("y", -NODE_RADIUS + 4)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", "white")
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text(node.guildCount);
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
      .attr("fill", ideologyColor)
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
