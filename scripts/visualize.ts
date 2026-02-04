#!/usr/bin/env bun
// scripts/visualize.ts
// Standalone server for simulation visualization

import { readdir } from "fs/promises";
import { join } from "path";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const LOGS_DIR = "logs/simulations";

/**
 * List available JSON analysis files (both .json and .json.gz).
 */
async function listLogs(): Promise<string[]> {
  try {
    const files = await readdir(LOGS_DIR);
    return files
      .filter((f) => f.endsWith(".json") || f.endsWith(".json.gz"))
      .sort()
      .reverse(); // Newest first
  } catch {
    return [];
  }
}

/**
 * Serve the visualization app.
 */
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // API: List logs
    if (path === "/api/logs") {
      const logs = await listLogs();
      return Response.json(logs);
    }

    // API: Get specific log
    if (path.startsWith("/api/logs/")) {
      const filename = path.slice("/api/logs/".length);
      if (!filename.endsWith(".json") && !filename.endsWith(".json.gz")) {
        return new Response("Invalid file type", { status: 400 });
      }

      const filepath = join(LOGS_DIR, filename);
      const file = Bun.file(filepath);
      if (!(await file.exists())) {
        return new Response("Not found", { status: 404 });
      }

      // For .gz files, serve with Content-Encoding so browser decompresses
      if (filename.endsWith(".gz")) {
        const content = await file.arrayBuffer();
        return new Response(content, {
          headers: {
            "Content-Type": "application/json",
            "Content-Encoding": "gzip",
          },
        });
      }

      // Regular JSON file
      const content = await file.text();
      return new Response(content, {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Serve static files from src/visualization
    if (path === "/" || path === "/index.html") {
      const file = Bun.file("src/visualization/index.html");
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    // Serve CSS
    if (path.endsWith(".css")) {
      const file = Bun.file(`src/visualization${path}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    // Serve JS/TS (transpiled by Bun)
    if (path.endsWith(".ts") || path.endsWith(".js")) {
      // Handle both root and subdirectory files
      let tsPath = `src/visualization${path.replace(".js", ".ts")}`;

      // Check if file exists
      let file = Bun.file(tsPath);
      if (!(await file.exists())) {
        // Try without .ts replacement for actual .ts files
        tsPath = `src/visualization${path}`;
        file = Bun.file(tsPath);
      }

      if (await file.exists()) {
        const result = await Bun.build({
          entrypoints: [tsPath],
          target: "browser",
          external: [], // Bundle everything
        });
        const firstOutput = result.outputs[0];
        if (firstOutput) {
          const text = await firstOutput.text();
          return new Response(text, {
            headers: { "Content-Type": "application/javascript" },
          });
        }
      }
    }

    // Serve theme.css from renderer
    if (path === "/theme.css") {
      const file = Bun.file("src/renderer/ui/tokens/theme.css");
      if (await file.exists()) {
        return new Response(file, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Visualization server running at http://localhost:${PORT}`);
