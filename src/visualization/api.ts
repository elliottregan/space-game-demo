// src/visualization/api.ts
// API and file loading functions

import type { AnalysisOutput } from "./types";
import { setApiAvailable, setAvailableLogs } from "./state";

/**
 * Validate that data matches the AnalysisOutput structure.
 */
export function validateAnalysisOutput(data: unknown): data is AnalysisOutput {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.metadata !== "object" || obj.metadata === null) return false;
  if (typeof obj.summary !== "object" || obj.summary === null) return false;
  if (!Array.isArray(obj.victoryTimes)) return false;
  if (!Array.isArray(obj.peakPopulations)) return false;
  const meta = obj.metadata as Record<string, unknown>;
  if (typeof meta.runs !== "number") return false;
  const summary = obj.summary as Record<string, unknown>;
  if (typeof summary.winRate !== "number") return false;
  if (typeof summary.victories !== "number") return false;
  if (typeof summary.defeats !== "number") return false;
  return true;
}

/**
 * Check if the API server is available and fetch log list.
 */
export async function checkApiAvailability(): Promise<void> {
  try {
    const response = await fetch("/api/logs", { method: "GET" });
    if (response.ok) {
      setApiAvailable(true);
      setAvailableLogs(await response.json());
    }
  } catch {
    // API not available (e.g., running as static site)
    setApiAvailable(false);
    setAvailableLogs([]);
  }
}

/**
 * Load analysis data from the server API.
 */
export async function loadFromApi(filename: string): Promise<AnalysisOutput> {
  const response = await fetch(`/api/logs/${filename}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${filename}`);
  }
  const data: unknown = await response.json();
  if (!validateAnalysisOutput(data)) {
    throw new Error("Invalid analysis file format");
  }
  return data;
}

/**
 * Load and parse a JSON file (supports both .json and .json.gz).
 */
export async function loadFile(file: File): Promise<AnalysisOutput> {
  let text: string;

  if (file.name.endsWith(".gz")) {
    // Decompress gzipped files using Compression Streams API
    const ds = new DecompressionStream("gzip");
    const decompressed = file.stream().pipeThrough(ds);
    text = await new Response(decompressed).text();
  } else {
    text = await file.text();
  }

  const data: unknown = JSON.parse(text);
  if (!validateAnalysisOutput(data)) {
    throw new Error("Invalid analysis file format");
  }
  return data;
}
