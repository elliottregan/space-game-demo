// src/visualization/d3.ts
// Barrel file for D3 modules used in visualization charts

export * from "d3-selection";
export * from "d3-scale";
export * from "d3-axis";
export * from "d3-array";
export * from "d3-shape";

// Color interpolation for heatmaps
export const interpolateYlOrRd = (t: number): string => {
  // Yellow to Orange to Red gradient
  const r = Math.round(255);
  const g = Math.round(255 * (1 - t * 0.8));
  const b = Math.round(255 * (1 - t));
  return `rgb(${r},${g},${b})`;
};
