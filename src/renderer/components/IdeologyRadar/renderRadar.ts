import { select } from "d3-selection";
import { lineRadial, curveLinearClosed } from "d3-shape";

export interface RadarData {
  solidarity: number; // -1 to +1
  sovereignty: number; // -1 to +1
  transformation: number; // -1 to +1
}

export interface RadarOptions {
  size: number;
  fillColor: string; // CSS color or hex
  fillOpacity?: number; // default 0.25
  strokeColor?: string; // defaults to fillColor
  showLabels?: boolean; // axis endpoint labels
  showGrid?: boolean; // concentric rings, default true
}

// Axes at 120-degree intervals: top, bottom-left, bottom-right
const AXES = [
  { angle: -Math.PI / 2, key: "transformation" as const, label: "Transformation" },
  { angle: -Math.PI / 2 + (2 * Math.PI) / 3, key: "solidarity" as const, label: "Solidarity" },
  { angle: -Math.PI / 2 + (4 * Math.PI) / 3, key: "sovereignty" as const, label: "Sovereignty" },
];

const GRID_RINGS = 5;

function getThemeColors() {
  const style = getComputedStyle(document.documentElement);
  return {
    border: style.getPropertyValue("--g-color-border").trim() || "#333333",
    textMuted: style.getPropertyValue("--g-color-text-muted").trim() || "#888888",
  };
}

export function renderRadar(
  container: SVGSVGElement,
  data: RadarData,
  options: RadarOptions,
): void {
  const {
    size,
    fillColor,
    fillOpacity = 0.25,
    strokeColor = fillColor,
    showLabels = false,
    showGrid = true,
  } = options;

  const svg = select(container);
  const colors = getThemeColors();

  // Clear previous content
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${size} ${size}`);

  const center = size / 2;
  const labelPadding = showLabels ? size * 0.22 : 6;
  const radius = center - labelPadding;

  const g = svg.append("g").attr("transform", `translate(${center}, ${center})`);

  // Grid: concentric triangular rings
  if (showGrid) {
    const ringLine = lineRadial<number>()
      .angle((_d, i) => AXES[i]!.angle)
      .radius((d) => d)
      .curve(curveLinearClosed);

    for (let i = 1; i <= GRID_RINGS; i++) {
      const r = (i / GRID_RINGS) * radius;
      const isNeutralRing = i === Math.ceil(GRID_RINGS / 2); // middle ring = 0-value

      g.append("path")
        .datum(AXES.map(() => r))
        .attr("d", ringLine as never)
        .attr("fill", "none")
        .attr("stroke", colors.border)
        .attr("stroke-width", isNeutralRing ? 1.2 : 0.5)
        .attr("stroke-opacity", isNeutralRing ? 0.7 : 0.3);
    }
  }

  // Axis lines from center to edge
  for (const axis of AXES) {
    const x = Math.cos(axis.angle) * radius;
    const y = Math.sin(axis.angle) * radius;

    g.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", x)
      .attr("y2", y)
      .attr("stroke", colors.border)
      .attr("stroke-width", 0.7)
      .attr("stroke-opacity", 0.5);
  }

  // Data polygon
  const dataRadii = AXES.map((axis) => {
    const value = data[axis.key];
    return ((value + 1) / 2) * radius;
  });

  const dataLine = lineRadial<number>()
    .angle((_d, i) => AXES[i]!.angle)
    .radius((d) => d)
    .curve(curveLinearClosed);

  g.append("path")
    .datum(dataRadii)
    .attr("d", dataLine as never)
    .attr("fill", fillColor)
    .attr("fill-opacity", fillOpacity)
    .attr("stroke", strokeColor)
    .attr("stroke-width", 1.5);

  // Data dots at vertices
  for (let i = 0; i < AXES.length; i++) {
    const r = dataRadii[i]!;
    const x = Math.cos(AXES[i]!.angle) * r;
    const y = Math.sin(AXES[i]!.angle) * r;

    g.append("circle").attr("cx", x).attr("cy", y).attr("r", 2.5).attr("fill", strokeColor);
  }

  // Labels at axis endpoints
  if (showLabels) {
    const fontSize = Math.max(8, size * 0.07);
    for (const axis of AXES) {
      const labelR = radius + 8;
      const x = Math.cos(axis.angle) * labelR;
      const y = Math.sin(axis.angle) * labelR;
      const rawValue = data[axis.key];
      const valueStr = rawValue >= 0 ? `+${rawValue.toFixed(2)}` : rawValue.toFixed(2);

      // Label name
      g.append("text")
        .attr("x", x)
        .attr("y", y - fontSize * 0.6)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", colors.textMuted)
        .attr("font-size", `${fontSize}px`)
        .attr("font-family", "monospace")
        .text(axis.label);

      // Raw value below name
      g.append("text")
        .attr("x", x)
        .attr("y", y + fontSize * 0.6)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", colors.textMuted)
        .attr("font-size", `${fontSize}px`)
        .attr("font-family", "monospace")
        .attr("font-weight", "bold")
        .text(valueStr);
    }
  }
}
